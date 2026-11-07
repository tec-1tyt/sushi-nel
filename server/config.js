// Reads every setting from the environment. Secrets never live in code.
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = process.env;
const isProd = env.NODE_ENV === 'production';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function secret() {
  if (env.CSRF_SECRET && env.CSRF_SECRET.length >= 32) return env.CSRF_SECRET;
  if (isProd) {
    console.error('CSRF_SECRET is missing or shorter than 32 characters. Set it in .env (see .env.example).');
    process.exit(1);
  }
  console.warn('[dev] CSRF_SECRET not set, using a temporary one. Form tokens reset on every restart.');
  return randomBytes(48).toString('hex');
}

export const config = {
  isProd,
  port: Number(env.PORT) || 3000,
  siteUrl: (env.SITE_URL || `http://localhost:${Number(env.PORT) || 3000}`).replace(/\/+$/, ''),
  trustProxy: Number(env.TRUST_PROXY) || 0,
  csrfSecret: secret(),
  telegram: { token: env.TELEGRAM_BOT_TOKEN || '', chatId: env.TELEGRAM_CHAT_ID || '' },
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 587,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || '',
    to: env.MAIL_TO || '',
  },
  turnstile: { siteKey: env.TURNSTILE_SITE_KEY || '', secret: env.TURNSTILE_SECRET || '' },
  showPlaceholders: env.SHOW_PLACEHOLDERS !== 'false',
};
