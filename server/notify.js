// Sends submissions to Telegram and/or e-mail. Plain text only, so nothing a visitor types can act as markup.
import nodemailer from 'nodemailer';
import { config } from './config.js';

const hasTelegram = () => config.telegram.token && config.telegram.chatId;
const hasMail = () => config.smtp.host && config.smtp.from && config.smtp.to;

let transport;
function mailer() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transport;
}

async function toTelegram(text) {
  const url = `https://api.telegram.org/bot${config.telegram.token}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: config.telegram.chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Telegram responded ${r.status}`);
}

async function toMail(subject, text) {
  await mailer().sendMail({ from: config.smtp.from, to: config.smtp.to, subject, text });
}

export const notifyConfigured = () => Boolean(hasTelegram() || hasMail());

// Resolves when at least one channel took the message. Throws otherwise, so the visitor is told to call
// instead of believing an order went through.
export async function notify(subject, lines) {
  const text = [subject, '', ...lines].join('\n');
  if (!notifyConfigured()) {
    if (config.isProd) throw new Error('No notification channel configured');
    console.log(`[dev] no Telegram/e-mail set, message would be:\n${text}\n`);
    return;
  }
  const jobs = [];
  if (hasTelegram()) jobs.push(toTelegram(text));
  if (hasMail()) jobs.push(toMail(subject, text));
  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === 'rejected');
  // Log the failure reason only, never the customer's data
  failed.forEach((f) => console.error('[notify] channel failed:', f.reason?.message));
  if (failed.length === results.length) throw new Error('All notification channels failed');
}
