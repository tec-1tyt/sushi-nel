// Validation for content files and for everything a visitor can submit.
import { z } from 'zod';

const localized = z.object({ cs: z.string(), uk: z.string(), en: z.string() });
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/* ---------- content files ---------- */

const variant = z.object({ id: z.string().min(1), label: localized, price: z.number().nonnegative() });

const dish = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: localized,
  desc: localized.optional(),
  price: z.number().nonnegative().optional(),
  variants: z.array(variant).min(1).optional(),
  weight: z.string().optional(),
  volume: z.string().optional(),
  pieces: z.number().int().positive().optional(),
  allergens: z.array(z.string()).default([]),
  alcohol: z.boolean().optional(),
  badge: z.enum(['new']).optional(),
  group: localized.optional(),
  available: z.boolean().default(true),
}).refine((d) => d.price !== undefined || d.variants, { message: 'A dish needs "price" or "variants"' });

export const menuSchema = z.object({
  _help: z.string().optional(),
  currency: z.string(),
  source: z.string().optional(),
  categories: z.array(z.object({ id: z.string(), name: localized, items: z.array(dish).min(1) })).min(1),
}).superRefine((m, ctx) => {
  const seen = new Set();
  for (const c of m.categories) for (const d of c.items) {
    if (seen.has(d.id)) ctx.addIssue({ code: 'custom', message: `Duplicate dish id: ${d.id}` });
    seen.add(d.id);
  }
});

const hoursDay = z.tuple([hhmm, hhmm]).nullable();

export const siteSchema = z.object({
  _help: z.string().optional(),
  name: z.string(),
  legal: z.object({ company: z.string().nullable(), ico: z.string().nullable(), dic: z.string().nullable(), seat: z.string().nullable() }),
  phone: z.string(),
  phoneDisplay: z.string(),
  email: z.string().nullable(),
  address: z.object({ street: z.string(), zip: z.string(), city: z.string(), country: z.string() }),
  geo: z.object({ lat: z.number(), lng: z.number() }),
  hours: z.object({ mon: hoursDay, tue: hoursDay, wed: hoursDay, thu: hoursDay, fri: hoursDay, sat: hoursDay, sun: hoursDay }),
  socials: z.object({ instagram: z.string().nullable(), threads: z.string().nullable(), telegram: z.string().nullable(), facebook: z.string().nullable() }),
  ordering: z.object({ menuforma: z.string().nullable(), wolt: z.string().nullable(), bolt: z.string().nullable(), foodora: z.string().nullable() }),
  delivery: z.object({
    etaMinutes: z.number().nullable(),
    zones: localized.nullable(),
    minOrder: z.number().nullable(),
    fee: localized.nullable(),
    payment: localized.nullable(),
    pickup: z.boolean().nullable(),
  }),
  story: z.object({ cs: z.string().nullable(), uk: z.string().nullable(), en: z.string().nullable() }),
});

export const promotionsSchema = z.object({
  _help: z.string().optional(),
  promotions: z.array(z.object({
    id: z.string(),
    active: z.boolean(),
    main: z.boolean().optional(),
    placeholder: z.boolean().optional(),
    validFrom: z.string().nullable().optional(),
    validTo: z.string().nullable().optional(),
    source: z.string().optional(),
    threshold: z.number().optional(),
    thresholdExcludes: z.array(z.string()).optional(),
    gift: z.string().optional(),
    title: localized,
    text: localized,
    terms: localized.nullable().optional(),
  })),
});

/* ---------- form input ---------- */

// Strips control, zero-width and bidi-override characters (Unicode classes Cc, Cf, Zl, Zp), collapses whitespace.
// Everything leaves the server as plain text (Telegram without parse_mode, e-mail text part),
// so markup in a field is inert anyway.
const clean = (max) => z.string().transform((s) =>
  s.normalize('NFC').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim()
).pipe(z.string().max(max));

const name = clean(80).pipe(z.string().min(2, 'required'));
const phone = clean(24).refine((s) => /^\+?[0-9 ()./-]{9,24}$/.test(s) && s.replace(/\D/g, '').length >= 9, 'phone');
const note = clean(600).optional().default('');
const consent = z.literal(true, { message: 'consent' });

const common = {
  lang: z.enum(['cs', 'uk', 'en']).default('cs'),
  website: z.string().max(200).optional().default(''),   // honeypot, real visitors never see it
  turnstile: z.string().max(4096).optional(),
};

export const contactSchema = z.object({
  ...common,
  name,
  contact: clean(120).refine((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) || (/^\+?[0-9 ()./-]{9,24}$/.test(s)), 'invalid'),
  message: clean(1500).pipe(z.string().min(5, 'required')),
  consent,
});
