// Small helpers shared by the page templates.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, config } from '../config.js';

const PUBLIC = join(ROOT, 'public');

// Every value that reaches HTML goes through esc(). Templates never concatenate raw data.
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const versions = new Map();
export function asset(path) {
  if (!config.isProd || !versions.has(path)) {
    let v = '0';
    try { v = createHash('sha1').update(readFileSync(join(PUBLIC, path))).digest('hex').slice(0, 10); } catch { /* missing file: leave v=0 */ }
    versions.set(path, v);
  }
  return `${path}?v=${versions.get(path)}`;
}

export const exists = (path) => existsSync(join(PUBLIC, path));

export function fill(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

const LOCALE = { cs: 'cs-CZ', uk: 'uk-UA', en: 'en-GB' };
export function money(n, lang) {
  return `${Number(n).toLocaleString(LOCALE[lang] || 'cs-CZ').replace(/[  ]/g, ' ')} Kč`;
}

export const placeholder = (text) =>
  config.showPlaceholders ? `<span class="todo" title="Doplňte údaj v data/*.json">[${esc(text)}]</span>` : '';

// A <picture> with AVIF first. Only existing files are referenced, so a missing size can't produce a broken image.
// Every file carries a content hash (?v=), so a replaced photo shows at once instead of the browser's cached copy.
export function picture({ base, widths, alt, width, height, sizes, cls = '', imgCls = '', eager = false, avif = true, attrs = '' }) {
  const srcset = (ext) => widths.filter((w) => exists(`${base}-${w}.${ext}`)).map((w) => `${asset(`${base}-${w}.${ext}`)} ${w}w`).join(', ');
  const webp = srcset('webp');
  const av = avif ? srcset('avif') : '';
  const largest = widths[widths.length - 1];
  return `<picture class="${esc(cls)}">${av ? `<source type="image/avif" srcset="${av}" sizes="${esc(sizes)}">` : ''}${webp ? `<source type="image/webp" srcset="${webp}" sizes="${esc(sizes)}">` : ''}<img class="${esc(imgCls)}" src="${asset(`${base}-${largest}.webp`)}" alt="${esc(alt)}" width="${width}" height="${height}" decoding="async" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} ${attrs}></picture>`;
}

export const kanji = (text, cls = '') => `<span class="kanji ${esc(cls)}" data-k="${esc(text)}" aria-hidden="true"></span>`;
