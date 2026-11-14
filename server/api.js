// The contact form endpoint. Orders go by phone or MenuForma, bookings by phone or Instagram.
// Order of checks: rate limit, origin, CSRF, body size, schema, honeypot, Turnstile, business rules.
import express from 'express';
import { notify } from './notify.js';
import { contactSchema } from './schemas.js';
import { issueCsrf, limits, sameOrigin, verifyCsrf, verifyTurnstile } from './security.js';

function fieldErrors(zodError) {
  const errors = {};
  for (const issue of zodError.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (errors[key]) continue;
    const m = issue.message;
    errors[key] = /^[a-zA-Z]+$/.test(m) && m.length < 16 ? m : 'invalid';
  }
  return errors;
}

// Runs the shared gate, then the handler. A filled honeypot gets a normal-looking success and goes nowhere.
function endpoint(schema, handler) {
  return async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ ok: false, errors: fieldErrors(parsed.error) });
    const data = parsed.data;
    if (data.website) return res.json({ ok: true });
    if (!(await verifyTurnstile(data.turnstile, req.ip))) return res.status(422).json({ ok: false, error: 'invalid' });
    try {
      const out = await handler(data, req);
      if (out?.errors) return res.status(422).json({ ok: false, errors: out.errors });
      res.json({ ok: true, ...(out || {}) });
    } catch (err) {
      console.error('[api]', err.message);
      res.status(502).json({ ok: false, error: 'server' });
    }
  };
}

async function handleContact(d) {
  await notify('✉️ Zpráva z webu', [`Jméno: ${d.name}`, `Kontakt: ${d.contact}`, '', d.message, '', `Jazyk webu: ${d.lang}`]);
}

export function apiRouter() {
  const r = express.Router();
  r.get('/csrf', limits.csrf, issueCsrf);
  const body = express.json({ limit: '24kb', strict: true });
  r.post('/contact', limits.contact, limits.contactDay, limits.contactAll, sameOrigin, verifyCsrf, body, endpoint(contactSchema, handleContact));
  r.use((_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));
  // Malformed or oversized JSON ends here without leaking a stack trace
  r.use((err, _req, res, _next) => res.status(err.status === 413 ? 413 : 400).json({ ok: false, error: 'invalid' }));
  return r;
}
