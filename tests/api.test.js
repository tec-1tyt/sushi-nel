// Backend tests: npm test. No extra packages, runs on node:test against a real server instance.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
// A little more headroom than production, so every check below gets its own requests
process.env.CONTACT_RATE_LIMIT = '8';
const { createApp } = await import('../server/index.js');

let server, base, cookie, token;

async function csrf() {
  const r = await fetch(`${base}/api/csrf`);
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  token = (await r.json()).token;
}

const post = (path, body, headers = {}) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': token, ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const order = (over = {}) => ({
  name: 'Test Zákazník',
  phone: '+420 777 123 456',
  mode: 'delivery',
  address: 'Vršovců 1, Chomutov',
  when: 'asap',
  note: '',
  consent: true,
  items: [{ id: 'phila-set', qty: 1 }],
  ...over,
});

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  await csrf();
  await new Promise((r) => setTimeout(r, 1700));   // token must be older than the human-speed minimum
});

after(() => server.close());

test('security headers are present', async () => {
  const r = await fetch(base);
  assert.equal(r.status, 200);
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('page has no inline style attributes and carries structured data', async () => {
  const html = await (await fetch(`${base}/uk/`)).text();
  assert.doesNotMatch(html, /\sstyle="/);
  assert.match(html, /"@type":"Restaurant"/);
  assert.match(html, /Найкращі/);
  assert.match(html, /Nejlepší sushi v Chomutově/);
});

test('order and booking endpoints are gone: phone, Instagram or MenuForma instead', async () => {
  assert.equal((await post('/api/order', order())).status, 404);
  assert.equal((await post('/api/reservation', order())).status, 404);
});

test('POST without a CSRF token is refused', async () => {
  const r = await fetch(`${base}/api/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(order()) });
  assert.equal(r.status, 403);
});

test('POST with a forged token is refused', async () => {
  const r = await post('/api/contact', order(), { 'x-csrf-token': `${Date.now() - 5000}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` });
  assert.equal(r.status, 403);
});

test('cross-site origin is refused even with a valid token', async () => {
  const r = await post('/api/contact', order(), { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('invalid contact input returns field errors', async () => {
  const j = await (await post('/api/contact', { name: 'A', contact: 'x', message: '', consent: false })).json();
  assert.ok(j.errors.name && j.errors.contact && j.errors.message && j.errors.consent);
});

test('a filled honeypot looks like success but sends nothing', async () => {
  const r = await post('/api/contact', { name: 'Bot Name', contact: 'bot@example.com', message: 'buy now please', consent: true, website: 'http://spam.example' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test('oversized and malformed bodies are rejected without a stack trace', async () => {
  const big = await post('/api/contact', JSON.stringify({ message: 'x'.repeat(40000) }));
  assert.equal(big.status, 413);
  const bad = await post('/api/contact', '{not json');
  assert.equal(bad.status, 400);
  assert.doesNotMatch(await bad.text(), /at .*\.js/);
});

test('rate limiting kicks in', async () => {
  let last;
  for (let i = 0; i < 8; i += 1) last = await post('/api/contact', { name: 'Test', contact: 'a@b.cz', message: 'zprava', consent: true });
  assert.equal(last.status, 429);
});

test('robots, sitemap and languages resolve', async () => {
  assert.match(await (await fetch(`${base}/robots.txt`)).text(), /Sitemap:/);
  assert.match(await (await fetch(`${base}/sitemap.xml`)).text(), /hreflang="uk"/);
  for (const p of ['/', '/uk/', '/en/', '/soukromi', '/uk/soukromi', '/en/soukromi']) assert.equal((await fetch(base + p)).status, 200, p);
  assert.equal((await fetch(`${base}/missing`)).status, 404);
});
