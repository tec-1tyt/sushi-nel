// Loads data/*.json, validates it and hot-reloads on save, so prices change without touching code.
// A broken file never takes the site down: the last good version stays live and the error is logged.
import { readFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './config.js';
import { menuSchema, promotionsSchema, siteSchema } from './schemas.js';

const DATA = join(ROOT, 'data');
const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

export function loadFromDisk() {
  const menu = menuSchema.parse(read('menu.json'));
  const site = siteSchema.parse(read('site.json'));
  const promos = promotionsSchema.parse(read('promotions.json'));
  const i18n = read('i18n.json');
  const dishes = new Map();
  for (const c of menu.categories) for (const d of c.items) dishes.set(d.id, { ...d, category: c.id });
  return { menu, site, promos, i18n, dishes, version: Date.now() };
}

let current = loadFromDisk();
const listeners = new Set();

export const content = () => current;
export const onContentChange = (fn) => listeners.add(fn);

let timer;
export function watchContent() {
  try {
    watch(DATA, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          current = loadFromDisk();
          listeners.forEach((fn) => fn());
          console.log('[content] reloaded');
        } catch (err) {
          console.error('[content] keeping the previous version, this file has a problem:', err.message);
        }
      }, 200);
    });
  } catch (err) {
    console.warn('[content] cannot watch data folder, restart to apply changes:', err.message);
  }
}

// Promotions visible right now, honouring optional dates
export function livePromotions(all, today = new Date().toISOString().slice(0, 10)) {
  return all.filter((p) => p.active && (!p.validFrom || p.validFrom <= today) && (!p.validTo || p.validTo >= today));
}

// Authoritative price lookup. Prices sent by a browser are never trusted.
export function priceOf(dish, variantId) {
  if (dish.variants) {
    const v = variantId ? dish.variants.find((x) => x.id === variantId) : null;
    return v ? { price: v.price, variant: v } : null;
  }
  return variantId ? null : { price: dish.price, variant: null };
}
