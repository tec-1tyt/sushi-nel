// The document shell shared by all pages: <head>, navigation, footer and the fixed layers.
import { config } from '../config.js';
import { icons } from './icons.js';
import { jsonLd, langPath } from './seo.js';
import { bootScript } from '../security.js';
import { asset, esc, placeholder } from './util.js';

export const LANGS = ['cs', 'uk', 'en'];
const FONT_PRELOAD = { cs: ['display-latin'], uk: ['display-cyrillic'], en: ['display-latin'] };

function head({ lang, c, t, title, description, path, noindex }) {
  const url = config.siteUrl;
  const hreflang = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${url}${l === 'cs' ? '' : `/${l}`}${path}">`).join('');
  const canonical = `${url}${lang === 'cs' ? '' : `/${lang}`}${path}`;
  const heroPreload = path === '/'
    ? '<link rel="preload" as="image" type="image/avif" href="/img/hero/plate-1100.avif" imagesrcset="/img/hero/plate-720.avif 720w, /img/hero/plate-1100.avif 1100w, /img/hero/plate-1536.avif 1536w" imagesizes="(min-width: 1000px) 60vw, 116vw" fetchpriority="high">'
    : '';
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="keywords" content="${esc(t.meta.keywords)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(canonical)}">
${hreflang}<link rel="alternate" hreflang="x-default" href="${url}${path}">
<meta name="theme-color" content="#0b0a0a">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="restaurant">
<meta property="og:site_name" content="${esc(c.site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${url}/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${{ cs: 'cs_CZ', uk: 'uk_UA', en: 'en_GB' }[lang]}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="/img/logo/favicon-32.png">
<link rel="apple-touch-icon" href="/img/logo/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
${path === '/' ? FONT_PRELOAD[lang].map((f) => `<link rel="preload" as="font" type="font/woff2" href="/fonts/${f}.woff2" crossorigin>`).join('\n') : ''}
${heroPreload}
<link rel="stylesheet" href="${asset('/css/site.css')}">
<script>${bootScript()}</script>
${path === '/' ? `<script type="application/ld+json">${jsonLd(c, lang)}</script>` : ''}
</head>`;
}

export function langSwitch(lang, path, t, cls = '') {
  return `<ul class="lang ${cls}" aria-label="${esc(t.nav.lang)}">${LANGS.map((l) => `<li><a href="${l === 'cs' ? '' : `/${l}`}${path}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${l === 'uk' ? 'UA' : l.toUpperCase()}</a></li>`).join('')}</ul>`;
}

export function navLinks(t, base = '') {
  return [['menu', t.nav.menu], ['promo', t.nav.promo], ['delivery', t.nav.delivery], ['about', t.nav.about], ['visit', t.nav.visit]]
    .map(([id, label]) => ({ id, label, href: `${base}#${id}` }));
}

function nav({ lang, c, t, path, home }) {
  const base = home ? '' : langPath(lang);
  const links = navLinks(t, base);
  return `<header class="nav" data-nav>
  <a class="nav__logo" href="${home ? '#top' : langPath(lang)}" aria-label="${esc(t.nav.home)}"><img src="/img/logo/logo-96.webp" width="96" height="96" alt="" decoding="async"></a>
  <nav class="nav__links" aria-label="${esc(t.nav.main)}">${links.map((l) => `<a href="${l.href}" data-spy="${l.id}">${esc(l.label)}</a>`).join('')}</nav>
  <div class="nav__tools">
    ${langSwitch(lang, path, t)}
    <a class="nav__phone" href="tel:${esc(c.site.phone)}">${icons.phone()}<span>${esc(c.site.phoneDisplay)}</span></a>
    ${home ? `<button class="nav__cart js-only" type="button" data-cart-open aria-label="${esc(t.cart.open)}" data-grab>${icons.bag()}<span class="nav__count" data-cart-count hidden>0</span></button>` : ''}
    <button class="burger js-only" type="button" data-burger aria-expanded="false" aria-controls="overlay" aria-label="${esc(t.nav.open)}" data-label-open="${esc(t.nav.open)}" data-label-close="${esc(t.nav.close)}"><i></i><i></i></button>
  </div>
</header>
<div class="overlay" id="overlay" data-overlay hidden>
  <svg class="overlay__shape" aria-hidden="true" preserveAspectRatio="none"><path data-overlay-path fill="#c8221b"/></svg>
  <nav class="overlay__nav" aria-label="${esc(t.nav.main)}">${links.map((l, i) => `<a href="${l.href}" data-overlay-link><span class="overlay__n" aria-hidden="true">${['一', '二', '三', '四', '五'][i]}</span>${esc(l.label)}</a>`).join('')}</nav>
  <div class="overlay__foot">
    <a href="tel:${esc(c.site.phone)}">${icons.phone()}${esc(c.site.phoneDisplay)}</a>
    <p>${esc(c.site.address.street)}, ${esc(c.site.address.city)}</p>
    ${langSwitch(lang, path, t)}
  </div>
</div>`;
}

function footer({ lang, c, t, home }) {
  const s = c.site;
  const legal = s.legal.company
    ? `<p>${esc(s.legal.company)}${s.legal.ico ? `, IČO ${esc(s.legal.ico)}` : ''}${s.legal.dic ? `, DIČ ${esc(s.legal.dic)}` : ''}${s.legal.seat ? `<br>${esc(s.legal.seat)}` : ''}</p>`
    : `<p>${placeholder(t.footer.legalMissing)}</p>`;
  const ctaHref = home ? '#menu' : `${langPath(lang)}#menu`;
  return `<footer class="foot">
  <a class="foot__cta" href="${ctaHref}" data-grab><span data-foot-word>${esc(t.footer.cta)}</span>${icons.arrow()}</a>
  <div class="foot__grid">
    <img class="foot__logo" src="/img/logo/logo-320.webp" width="320" height="320" alt="${esc(s.name)}" loading="lazy" decoding="async">
    <div>
      <h2 class="foot__h">${esc(t.footer.contact)}</h2>
      <p><a href="tel:${esc(s.phone)}">${esc(s.phoneDisplay)}</a></p>
      ${s.email ? `<p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}
      <p>${esc(s.address.street)}<br>${esc(s.address.zip)} ${esc(s.address.city)}</p>
    </div>
    <div>
      <h2 class="foot__h">${esc(t.footer.follow)}</h2>
      <ul class="foot__social">
        ${s.socials.instagram ? `<li><a href="${esc(s.socials.instagram)}" rel="noopener" target="_blank">${icons.instagram()}Instagram</a></li>` : ''}
        ${s.socials.threads ? `<li><a href="${esc(s.socials.threads)}" rel="noopener" target="_blank">${icons.threads()}Threads</a></li>` : ''}
        ${s.socials.telegram ? `<li><a href="${esc(s.socials.telegram)}" rel="noopener" target="_blank">${icons.telegram()}Telegram</a></li>` : ''}
      </ul>
    </div>
    <div>
      <h2 class="foot__h">${esc(t.footer.legal)}</h2>
      ${legal}
      <p><a href="${lang === 'cs' ? '' : `/${lang}`}/soukromi">${esc(t.footer.privacy)}</a></p>
      <p class="js-only"><button class="linkbtn" type="button" data-cookie-open>${esc(t.footer.cookies)}</button></p>
    </div>
  </div>
  <p class="foot__copy">© ${new Date().getFullYear()} ${esc(s.name)}. ${esc(t.footer.rights)}</p>
</footer>`;
}

function cookieBanner(lang, t) {
  return `<aside class="cookie js-only" data-cookie hidden aria-label="${esc(t.cookie.title)}">
  <p>${esc(t.cookie.text)} <a href="${lang === 'cs' ? '' : `/${lang}`}/soukromi#cookies">${esc(t.cookie.more)}</a></p>
  <div class="cookie__btns">
    <button class="btn-plain" type="button" data-cookie-deny>${esc(t.cookie.deny)}</button>
    <button class="btn-plain btn-plain--on" type="button" data-cookie-allow>${esc(t.cookie.allow)}</button>
  </div>
</aside>`;
}

// Shared values the browser needs. Lives in a JSON data block, which a strict CSP allows.
function clientData({ lang, c, t, home }) {
  const gift = c.promos.promotions.find((p) => p.active && p.threshold && p.gift);
  return JSON.stringify({
    lang,
    home,
    errors: t.errors,
    form: t.form,
    cart: t.cart,
    status: t.status,
    menu: { add: t.menu.add, addAria: t.menu.addAria, from: t.menu.from },
    hours: c.site.hours,
    geo: c.site.geo,
    gift: gift ? { threshold: gift.threshold } : null,
    mapAttr: '© OpenStreetMap contributors',
    placeName: `${c.site.name}, ${c.site.address.street}`,
  }).replace(/</g, '\\u003c');
}

export function page({ lang, c, t, title, description, path, body, home = false, noindex = false, extra = '' }) {
  return `<!doctype html>
<html lang="${lang}" class="no-js">
${head({ lang, c, t, title, description, path, noindex })}
<body${home ? ' class="is-home"' : ''}>
<a class="skip" href="#main">${esc(t.nav.skip)}</a>
<canvas class="petals" data-petals aria-hidden="true"></canvas>
${nav({ lang, c, t, path, home })}
<main id="main">
${body}
</main>
${footer({ lang, c, t, home })}
${extra}
${cookieBanner(lang, t)}
<div class="chop" data-chop aria-hidden="true" hidden>
  <svg viewBox="-6 -6 92 92" width="92" height="92" fill="none">
    <g data-stick="a"><path class="chop__out" d="M0 0 72 -3"/><path class="chop__stick" d="M0 0 72 -3"/><path class="chop__tip" d="M0 0 13 -.5"/></g>
    <g data-stick="b"><path class="chop__out" d="M0 0 72 3"/><path class="chop__stick" d="M0 0 72 3"/><path class="chop__tip" d="M0 0 13 .5"/></g>
  </svg>
</div>
<script type="application/json" id="client-data">${clientData({ lang, c, t, home })}</script>
<script src="${asset('/vendor/gsap.min.js')}" defer></script>
<script src="${asset('/vendor/lenis.min.js')}" defer></script>
<script type="module" src="${asset('/js/main.js')}"></script>
</body>
</html>`;
}
