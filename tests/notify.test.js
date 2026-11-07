// Delivery of submissions, with the network stubbed. No real message is ever sent from here.
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_CHAT_ID = '12345';
const { notify, notifyConfigured } = await import('../server/notify.js');

test('a submission goes to Telegram as plain text, so markup in a field stays inert', async () => {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, status: 200 }; };
  try {
    assert.equal(notifyConfigured(), true);
    await notify('Nová objednávka', ['Jméno: <b>Hacker</b> <script>alert(1)</script>']);
  } finally { globalThis.fetch = real; }
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /api\.telegram\.org\/bottest-token\/sendMessage/);
  assert.equal(calls[0].body.chat_id, '12345');
  assert.equal(calls[0].body.parse_mode, undefined);
  assert.match(calls[0].body.text, /<script>alert\(1\)<\/script>/);
});

test('when every channel fails the caller is told, so the visitor is sent to the phone', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  const quiet = console.error;
  console.error = () => {};
  try {
    await assert.rejects(() => notify('x', ['y']));
  } finally { globalThis.fetch = real; console.error = quiet; }
});
