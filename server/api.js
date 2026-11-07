// Form endpoints (table booking and contact). Orders go by phone or the MenuForma online menu.
// Order of checks: rate limit, origin, CSRF, body size, schema, honeypot, Turnstile, business rules.
import express from 'express';
import { content } from './content.js';
import { notify } from './notify.js';
import { contactSchema, reservationSchema } from './schemas.js';
import { issueCsrf, limits, sameOrigin, verifyCsrf, verifyTurnstile } from './security.js';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const pragueNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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

async function handleReservation(d) {
  const { site } = content();
  const today = ymd(pragueNow());
  const when = new Date(`${d.date}T00:00:00Z`);
  if (Number.isNaN(when.getTime()) || d.date < today) return { errors: { date: 'date' } };
  const maxDate = new Date(pragueNow().getTime() + site.reservations.maxDaysAhead * 864e5);
  if (d.date > ymd(maxDate)) return { errors: { date: 'date' } };
  if (d.guests > site.reservations.maxGuests) return { errors: { guests: 'guests' } };
  const hours = site.hours[DAYS[when.getUTCDay()]];
  if (!hours) return { errors: { date: 'closedDay' } };
  if (d.time < hours[0] || d.time >= hours[1]) return { errors: { time: 'time' } };
  await notify('📅 Rezervace stolu', [
    `Datum: ${d.date}, ${d.time}`,
    `Počet osob: ${d.guests}`,
    `Jméno: ${d.name}`,
    `Telefon: ${d.phone}`,
    ...(d.note ? [`Poznámka: ${d.note}`] : []),
    `Jazyk webu: ${d.lang}`,
  ]);
}

async function handleContact(d) {
  await notify('✉️ Zpráva z webu', [`Jméno: ${d.name}`, `Kontakt: ${d.contact}`, '', d.message, '', `Jazyk webu: ${d.lang}`]);
}

export function apiRouter() {
  const r = express.Router();
  r.get('/csrf', limits.csrf, issueCsrf);
  const body = express.json({ limit: '24kb', strict: true });
  r.post('/reservation', limits.reservation, sameOrigin, verifyCsrf, body, endpoint(reservationSchema, handleReservation));
  r.post('/contact', limits.contact, sameOrigin, verifyCsrf, body, endpoint(contactSchema, handleContact));
  r.use((_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));
  // Malformed or oversized JSON ends here without leaking a stack trace
  r.use((err, _req, res, _next) => res.status(err.status === 413 ? 413 : 400).json({ ok: false, error: 'invalid' }));
  return r;
}
