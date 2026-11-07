// Form endpoints. Order of checks: rate limit, origin, CSRF, body size, schema, honeypot, Turnstile, business rules.
import express from 'express';
import { content, livePromotions, priceOf } from './content.js';
import { notify } from './notify.js';
import { contactSchema, orderSchema, reservationSchema } from './schemas.js';
import { issueCsrf, limits, sameOrigin, verifyCsrf, verifyTurnstile } from './security.js';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const pragueNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
// Replaceable so tests don't depend on the time they run at
export const clock = { now: pragueNow };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const money = (n) => `${n.toLocaleString('cs-CZ').replace(/ /g, ' ')} Kč`;

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

// Same-day orders only: asap while open, or a later time within today's hours
function orderTimeError(hours, when) {
  const now = clock.now();
  const today = hours[DAYS[now.getDay()]];
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (!today) return { when: 'closedToday' };
  if (when === 'asap') return hhmm >= today[0] && hhmm < today[1] ? null : { when: 'closedNow' };
  return when >= today[0] && when < today[1] && when >= hhmm ? null : { time: 'time' };
}

async function handleOrder(d) {
  const { dishes, promos, site } = content();
  const timeError = orderTimeError(site.hours, d.when);
  if (timeError) return { errors: timeError };
  const lines = [];
  const rows = [];
  let total = 0;
  let hasAlcohol = false;
  for (const row of d.items) {
    const dish = dishes.get(row.id);
    if (!dish || dish.available === false) return { errors: { items: 'items' } };
    const p = priceOf(dish, row.variant);
    if (!p) return { errors: { items: 'items' } };
    total += p.price * row.qty;
    rows.push({ category: dish.category, amount: p.price * row.qty });
    if (dish.alcohol) hasAlcohol = true;
    const label = p.variant ? ` (${p.variant.label.cs})` : '';
    lines.push(`${row.qty} × ${dish.name.cs}${label}: ${money(p.price * row.qty)}`);
  }
  if (hasAlcohol && !d.adult) return { errors: { adult: 'adult' } };

  const gift = livePromotions(promos.promotions).find((p) => p.threshold && p.gift
    && rows.filter((r) => !(p.thresholdExcludes || []).includes(r.category)).reduce((a, r) => a + r.amount, 0) >= p.threshold);
  const giftDish = gift ? dishes.get(gift.gift) : null;

  await notify('🍣 Nová objednávka', [
    ...lines,
    ...(giftDish ? [`🎁 Dárek: ${giftDish.name.cs} (akce ${gift.id})`] : []),
    '',
    `Celkem (bez doručení): ${money(total)}`,
    `Způsob: ${d.mode === 'delivery' ? 'doručení' : 'vyzvednutí'}`,
    ...(d.mode === 'delivery' ? [`Adresa: ${d.address}`] : []),
    `Kdy: ${d.when === 'asap' ? 'co nejdříve' : d.when}`,
    `Jméno: ${d.name}`,
    `Telefon: ${d.phone}`,
    ...(hasAlcohol ? ['Alkohol: potvrzeno 18+, zkontrolujte při předání'] : []),
    ...(d.note ? [`Poznámka: ${d.note}`] : []),
    `Jazyk webu: ${d.lang}`,
  ]);
  return { total, gift: giftDish ? giftDish.name[d.lang] : null };
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
  r.post('/order', limits.order, sameOrigin, verifyCsrf, body, endpoint(orderSchema, handleOrder));
  r.post('/reservation', limits.reservation, sameOrigin, verifyCsrf, body, endpoint(reservationSchema, handleReservation));
  r.post('/contact', limits.contact, sameOrigin, verifyCsrf, body, endpoint(contactSchema, handleContact));
  r.use((_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));
  // Malformed or oversized JSON ends here without leaking a stack trace
  r.use((err, _req, res, _next) => res.status(err.status === 413 ? 413 : 400).json({ ok: false, error: 'invalid' }));
  return r;
}
