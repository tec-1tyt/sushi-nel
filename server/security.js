// CSRF tokens, origin checks, rate limits and optional Turnstile.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import rateLimit from 'express-rate-limit';
import { ROOT, config } from './config.js';

// Runs before first paint. Inlined so it costs no request, and allowed by hash so CSP needs no 'unsafe-inline'.
// HTML parsers turn CRLF into LF before hashing, so normalise first or the hash will not match on Windows checkouts
const BOOT = readFileSync(join(ROOT, 'public', 'js', 'boot.js'), 'utf8').replace(/\r\n?/g, '\n').trim();
const BOOT_HASH = createHash('sha256').update(BOOT).digest('base64');
export const bootScript = () => BOOT;

const COOKIE = config.isProd ? '__Host-sn_csrf' : 'sn_csrf';
const MIN_AGE_MS = 1500;                // a human can't open a form and submit it faster than this
const MAX_AGE_MS = 1000 * 60 * 60 * 4;

const sign = (secret, ts) => createHmac('sha256', config.csrfSecret).update(`${secret}.${ts}`).digest('base64url');

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// GET /api/csrf : ties a token to a random HttpOnly cookie (signed double submit)
export function issueCsrf(req, res) {
  let secret = readCookie(req, COOKIE);
  if (!secret || !/^[A-Za-z0-9_-]{40,}$/.test(secret)) {
    secret = randomBytes(32).toString('base64url');
    res.cookie(COOKIE, secret, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.isProd,
      path: '/',
      maxAge: 1000 * 60 * 60 * 12,
    });
  }
  const ts = Date.now();
  res.set('Cache-Control', 'no-store');
  res.json({ token: `${ts}.${sign(secret, ts)}`, turnstileSiteKey: config.turnstile.siteKey || null });
}

export function verifyCsrf(req, res, next) {
  const fail = (code) => res.status(403).json({ ok: false, error: code });
  const secret = readCookie(req, COOKIE);
  const header = req.get('x-csrf-token') || '';
  const [tsStr, mac] = header.split('.');
  const ts = Number(tsStr);
  if (!secret || !mac || !Number.isFinite(ts)) return fail('csrf');
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(secret, tsStr));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail('csrf');
  const age = Date.now() - ts;
  if (age > MAX_AGE_MS) return fail('csrf');
  if (age < MIN_AGE_MS) return res.status(429).json({ ok: false, error: 'tooFast' });
  next();
}

// Browsers state where a request came from. Anything cross-site is refused before it reads the body.
export function sameOrigin(req, res, next) {
  const site = req.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return res.status(403).json({ ok: false, error: 'csrf' });
  const origin = req.get('origin');
  if (origin) {
    const host = req.get('host');
    let ok = false;
    try { ok = new URL(origin).host === host; } catch { ok = false; }
    if (!ok) return res.status(403).json({ ok: false, error: 'csrf' });
  }
  next();
}

const limiter = (windowMs, limit) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'rate' },
});

export const limits = {
  order: limiter(10 * 60 * 1000, 8),
  reservation: limiter(10 * 60 * 1000, 6),
  contact: limiter(10 * 60 * 1000, 5),
  csrf: limiter(60 * 1000, 40),
};

export async function verifyTurnstile(token, ip) {
  if (!config.turnstile.secret) return true;
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: config.turnstile.secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(6000),
    });
    return (await r.json()).success === true;
  } catch {
    return false;
  }
}

export function securityDirectives() {
  const ts = config.turnstile.siteKey ? ['https://challenges.cloudflare.com'] : [];
  const d = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", `'sha256-${BOOT_HASH}'`, ...ts],
    styleSrc: ["'self'"],
    // Leaflet and GSAP position things through element.style, which CSP allows. No inline style attributes anywhere.
    imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    frameSrc: ts.length ? ts : ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    manifestSrc: ["'self'"],
  };
  if (config.isProd) d.upgradeInsecureRequests = [];
  else d.upgradeInsecureRequests = null;
  return d;
}
