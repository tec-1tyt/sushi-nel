// The home page. All content comes from data/*.json, so this file holds structure only.
import { config } from '../config.js';
import { livePromotions } from '../content.js';
import { icons } from './icons.js';
import { page } from './layout.js';
import { branch } from './ornaments.js';
import { asset, esc, exists, fill, kanji, money, picture, placeholder } from './util.js';

const EXCLUDES = ['crustaceans', 'fish', 'milk', 'gluten', 'sesame', 'nuts', 'molluscs'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function dishImage(d, lang, lazy = true) {
  const base = `/img/menu/${d.id}`;
  if (!exists(`${base}-480.webp`)) return `<div class="dish__noimg" aria-hidden="true">${kanji('巻')}</div>`;
  return picture({
    base,
    widths: [240, 480],
    alt: d.name[lang],
    width: 480,
    height: 480,
    sizes: '(min-width: 1000px) 18vw, 112px',
    cls: 'dish__pic',
    imgCls: 'dish__img',
    lazy,
  });
}

function dishCard(d, cat, lang, t, lazy = true) {
  const allergens = (d.allergens || []).filter((a) => a !== 'alcohol');
  const sizeBits = [
    d.pieces ? `${d.pieces} ${t.menu.pcs}` : '',
    d.weight ? d.weight.replace(/\s*g$/i, ' g') : '',
    d.volume || '',
  ].filter(Boolean);
  const first = d.variants ? d.variants[0] : null;
  const search = [...new Set(['cs', 'uk', 'en'].filter((l) => l !== lang).map((l) => d.name[l]))].filter((n) => n !== d.name[lang]).join(' ');
  const attrs = `data-dish="${esc(d.id)}" data-allergens="${esc((d.allergens || []).join(' '))}" ${search ? `data-alt="${esc(search)}" ` : ''}data-name="${esc(d.name[lang])}"${d.alcohol ? ' data-alcohol' : ''}${first ? '' : ` data-price="${d.price}"`}`;
  return `<article class="dish" ${attrs} data-grab-card>
  ${dishImage(d, lang, lazy)}
  <div class="dish__body">
    <h4 class="dish__name"><button class="dish__open" type="button" data-dish-open>${esc(d.name[lang])}</button>${d.badge === 'new' ? ` <span class="tag">${esc(t.menu.new)}</span>` : ''}${d.alcohol ? ` <span class="tag tag--age">${esc(t.menu.adult)}</span>` : ''}</h4>
    ${d.desc?.[lang] ? `<p class="dish__desc">${esc(d.desc[lang])}</p>` : ''}
    ${sizeBits.length ? `<p class="dish__size">${esc(sizeBits.join(' · '))}</p>` : ''}
    ${d.variants ? `<fieldset class="dish__variants"><legend class="sr">${esc(t.menu.variant)}</legend>${d.variants.map((v, k) => `<label class="chip"><input type="radio" name="v-${esc(d.id)}" value="${esc(v.id)}" data-price="${v.price}" data-label="${esc(v.label[lang])}"${k === 0 ? ' checked' : ''}><span>${esc(v.label[lang])}</span><b class="nojs-price">${money(v.price, lang)}</b></label>`).join('')}</fieldset>` : ''}
    <div class="dish__buy">
      <p class="dish__price" data-price-out>${money(first ? first.price : d.price, lang)}</p>
    </div>
    ${allergens.length ? `<p class="dish__al"><span class="dish__al-k">${esc(t.menu.allergens)}:</span> ${esc(allergens.map((a) => t.allergen[a] || a).join(', '))}</p>` : ''}
  </div>
</article>`;
}

function menuSection(c, lang, t) {
  const cats = c.menu.categories;
  const tabs = cats.map((cat, i) => `<a class="tab" href="#cat-${esc(cat.id)}" data-tab="${esc(cat.id)}"${i === 0 ? ' aria-current="true"' : ''}><span>${esc(cat.name[lang])}</span><sup>${cat.items.filter((d) => d.available !== false).length}</sup></a>`).join('');
  const body = cats.map((cat, ci) => {
    let group = null;
    const rows = [];
    cat.items.filter((d) => d.available !== false).forEach((d, i) => {
      const g = d.group?.[lang] || null;
      if (g !== group) { rows.push(`<h4 class="group">${esc(g || '')}</h4>`); group = g; }
      // The first category is open on arrival: load its first photos right away instead of waiting for scroll
      rows.push(dishCard(d, cat, lang, t, !(ci === 0 && i < 6)));
    });
    return `<section class="cat" id="cat-${esc(cat.id)}" data-cat="${esc(cat.id)}"><h3 class="cat__h">${esc(cat.name[lang])}</h3><div class="dishes">${rows.join('')}</div></section>`;
  }).join('');
  const filters = EXCLUDES.map((a) => `<label class="chip chip--x"><input type="checkbox" value="${a}" data-exclude><span>${esc(t.exclude[a])}</span></label>`).join('');
  return `<section class="menu" id="menu" aria-labelledby="menu-h">
  ${branch({ seed: 11, cls: 'orn--menu', blooms: 5 })}
  <aside class="rail">
    <div class="rail__head">
      <h2 class="h-sec" id="menu-h" data-lines>${esc(t.menu.title)}</h2>
      ${kanji('品書', 'kanji--v')}
    </div>
    <label class="search js-only">${icons.search()}<span class="sr">${esc(t.menu.search)}</span><input type="search" data-search-input placeholder="${esc(t.menu.searchPh)}" autocomplete="off" enterkeyhint="search"></label>
    <nav class="tabs" aria-label="${esc(t.menu.title)}" data-tabs>${tabs}</nav>
    <details class="tools js-only" data-tools>
      <summary>${esc(t.menu.filters)}</summary>
      <fieldset class="excl"><legend>${esc(t.menu.without)}</legend>${filters}</fieldset>
      <p class="tools__note">${esc(t.menu.note)}</p>
    </details>
  </aside>
  <div class="menu__list" data-menu-list aria-live="polite">
    <p class="menu__none" data-none hidden>${esc(t.menu.none)} <button class="linkbtn" type="button" data-reset>${esc(t.menu.reset)}</button></p>
    ${body}
  </div>
</section>`;
}

function promoSection(c, lang, t) {
  const live = livePromotions(c.promos.promotions);
  const main = live.find((p) => p.main) || live[0];
  const others = live.filter((p) => p !== main && !p.placeholder);
  const gift = main?.gift ? c.dishes.get(main.gift) : null;
  const newCustomers = c.promos.promotions.find((p) => p.id === 'new-customers');
  const hasFuncoza = c.dishes.has('funchoza-with-vegetables');
  // A real photo from the restaurant, not the studio shot used in the menu
  const giftPic = gift
    ? picture({ base: '/img/venue/promo-tempura', widths: [480, 770], alt: gift.name[lang], width: 770, height: 370, sizes: '(min-width: 1000px) 34vw, 86vw', cls: 'offer__pic' })
    : '';
  const mainHtml = main ? `<div class="offer">
      <p class="offer__num">${main.threshold ? money(main.threshold, lang) : esc(main.title[lang])}</p>
      <div class="offer__body">
        <h3 class="offer__title">${esc(main.title[lang])}</h3>
        ${main.text[lang] ? `<p class="offer__text">${esc(main.text[lang])}</p>` : ''}
        ${main.terms?.[lang] ? `<p class="offer__terms">${esc(main.terms[lang])}</p>` : `<p class="offer__terms">${placeholder(t.promo.termsMissing)}</p>`}
        <a class="btn btn--primary" href="#menu" data-morph data-grab><span>${esc(t.promo.orderNow)}</span></a>
      </div>
      ${giftPic}
    </div>` : '';
  const newCustHtml = newCustomers && !newCustomers.active && config.showPlaceholders
    ? `<p class="promo__todo">${placeholder(t.promo.newCustomers)}</p>`
    : (newCustomers?.active ? `<div class="offer offer--mini"><h3 class="offer__title">${esc(newCustomers.title[lang])}</h3><p class="offer__text">${esc(newCustomers.text[lang])}</p></div>` : '');
  return `<section class="promo" id="promo" aria-labelledby="promo-h" data-promo>
  ${branch({ seed: 23, cls: 'orn--promo', blooms: 5 })}
  <div class="plate" data-plate>
    <svg class="plate__bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path data-plate-path d="M1.500 3.500 98.500 .5 100 97.500 0 100Z"/><path class="plate__bevel" data-plate-bevel/></svg>
    <svg class="plate__sauce" viewBox="0 0 620 170" fill="none" aria-hidden="true">
      <path pathLength="1" data-draw d="M10 42c70-30 112 26 182 12s94-50 170-26 116 40 248 8"/>
      <path pathLength="1" data-draw d="M18 78c70-30 104 30 176 14s98-52 172-28 112 42 238 10"/>
      <path pathLength="1" data-draw d="M28 114c68-28 100 32 170 16s100-52 172-28 108 42 226 12"/>
    </svg>
    <div class="plate__in">
      <header class="plate__head">
        <h2 class="h-sec h-sec--ink" id="promo-h">${esc(t.promo.title)}</h2>
        ${kanji('特典', 'kanji--ink kanji--v')}
      </header>
      ${mainHtml}
      ${newCustHtml}
      ${others.map((p) => `<div class="offer offer--mini"><h3 class="offer__title">${esc(p.title[lang])}</h3><p class="offer__text">${esc(p.text[lang])}</p>${p.terms?.[lang] ? `<p class="offer__terms">${esc(p.terms[lang])}</p>` : ''}</div>`).join('')}
      <ul class="extras">
        ${hasFuncoza ? `<li class="extra extra--photo">${picture({ base: '/img/venue/funcoza', widths: [480, 820], alt: t.promo.newTitle, width: 820, height: 580, sizes: '(min-width: 900px) 34vw, 86vw', imgCls: 'extra__img' })}<div><h3>${esc(t.promo.newTitle)}</h3><p>${esc(t.promo.newText)}</p><p class="extra__price">${esc(t.promo.newPriceFrom)}</p><a class="tlink" href="#cat-funcoza" data-jump-tab="funcoza">${esc(t.promo.newCta)}${icons.arrow()}</a></div></li>` : ''}
        <li class="extra"><div>${icons.gift()}<h3>${esc(t.promo.giftTitle)}</h3><p>${esc(t.promo.giftText)}</p><a class="tlink" href="#cat-poukazy" data-jump-tab="poukazy">${esc(t.promo.giftCta)}${icons.arrow()}</a></div></li>
        <li class="extra extra--cake"><div><h3>${esc(t.promo.cakeTitle)}</h3><p>${esc(t.promo.cakeText)}</p><a class="tlink" href="#cat-dort" data-jump-tab="dort">${esc(t.promo.cakeCta)}${icons.arrow()}</a></div>${picture({ base: '/img/menu/sushi-dort', widths: [240, 480], alt: t.promo.cakeTitle, width: 480, height: 480, sizes: '(min-width: 900px) 16vw, 40vw', imgCls: 'extra__cut' })}</li>
      </ul>
    </div>
  </div>
</section>`;
}

function deliverySection(c, lang, t) {
  const d = c.site.delivery;
  const fact = (label, value) => `<div class="fact"><dt>${esc(label)}</dt><dd>${value ?? placeholder(t.delivery.missing)}</dd></div>`;
  const localizedOr = (v) => (v?.[lang] ? esc(v[lang]) : null);
  const channel = (html) => `<li>${html}</li>`;
  const o = c.site.ordering;
  const s = c.site.socials;
  const row = (href, icon, title, note, ext) => `<a class="chan" href="${esc(href)}"${ext ? ' rel="noopener" target="_blank"' : ''} data-grab>${icon}<span class="chan__t">${esc(title)}${note ? `<small>${esc(note)}</small>` : ''}</span>${icons.arrow()}</a>`;
  return `<section class="delivery" id="delivery" aria-labelledby="delivery-h">
  ${branch({ seed: 37, cls: 'orn--delivery', blooms: 4 })}
  <div class="delivery__head">
    <h2 class="h-sec" id="delivery-h" data-lines>${esc(t.delivery.title)}</h2>
    ${kanji('配達', 'kanji--v')}
    ${d.etaMinutes ? `<p class="eta" data-lines>${esc(fill(t.delivery.eta, { n: d.etaMinutes }))}</p><p class="eta__note">${esc(t.delivery.etaNote)}</p>` : ''}
  </div>
  <svg class="route" viewBox="0 0 1200 160" fill="none" aria-hidden="true" data-route>
    <path class="route__line" pathLength="1" data-draw-route d="M8 112C160 40 276 138 420 104s190-86 330-62 196 96 442 30"/>
    <g data-rider><circle r="5" class="route__dot"/></g>
  </svg>
  <dl class="facts">
    ${d.fees ? `<div class="fact fact--fees"><dt>${esc(t.delivery.fees)}</dt><dd><ul class="fees">${d.fees.map((f) => `<li><span>${esc(f.town)}</span><b>${money(f.fee, lang)}</b></li>`).join('')}${d.otherTowns ? `<li class="fees__other"><span>${esc(fill(t.delivery.otherTowns, { towns: d.otherTowns.join(', ') }))}</span><a href="tel:${esc(c.site.phone)}">${esc(t.delivery.byPhone)}</a></li>` : ''}</ul></dd></div>` : fact(t.delivery.zones, null)}
    ${fact(t.delivery.minOrder, d.minOrder ? money(d.minOrder, lang) : null)}
    ${fact(t.delivery.payment, localizedOr(d.payment))}
  </dl>
  <div class="channels">
    <h3 class="channels__h">${esc(t.delivery.channelsTitle)}</h3>
    <ul>
      ${channel(row(`tel:${c.site.phone}`, icons.phone(), `${t.delivery.phone} ${c.site.phoneDisplay}`))}
      ${o.menuforma ? channel(row(o.menuforma, icons.globe(), t.delivery.menuforma, t.delivery.menuformaNote, true)) : ''}
      ${s.instagram ? channel(row(s.instagram, icons.instagram(), t.delivery.instagram, '', true)) : ''}
      ${s.telegram ? channel(row(s.telegram, icons.telegram(), 'Telegram', '', true)) : ''}
      ${o.wolt ? channel(row(o.wolt, icons.scooter(), 'Wolt', '', true)) : ''}
      ${o.bolt ? channel(row(o.bolt, icons.scooter(), 'Bolt Food', '', true)) : ''}
      ${o.foodora ? channel(row(o.foodora, icons.scooter(), 'Foodora', '', true)) : ''}
    </ul>
    ${d.pickup ? `<p class="channels__note">${esc(t.delivery.pickup)}</p>` : ''}
  </div>
</section>`;
}

function aboutSection(c, lang, t) {
  const story = c.site.story[lang] || [];
  // Chapter n of the owner's story, placed between the photos
  const ch = (i) => {
    const s = story[i];
    if (!s) return '';
    const last = i === story.length - 1;
    return `<article class="panel chapter${s.promise ? ' chapter--promise' : ''}">
        <p class="chapter__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</p>
        ${s.promise ? kanji('心', 'chapter__k') : ''}
        <h3 class="chapter__t">${esc(s.title)}</h3>
        ${s.quote ? `<p class="chapter__q">${esc(s.quote)}</p>` : ''}
        <p class="chapter__p">${esc(s.text)}</p>
        ${last ? `<a class="tlink chapter__cta" href="#visit">${esc(t.about.storyCta)}${icons.arrow()}</a>` : ''}
      </article>`;
  };
  const fig = (name, widths, w, h, cls, sizes) => `<figure class="ph ${cls}" data-mask>${picture({ base: `/img/venue/${name}`, widths, alt: t.about.alt[name], width: w, height: h, sizes })}</figure>`;
  return `<section class="about" id="about" aria-labelledby="about-h" data-makimono>
  <div class="about__sticky">
    <span class="rod rod--t" aria-hidden="true"></span>
    <div class="about__track" data-track tabindex="0" role="group" aria-labelledby="about-h">
      <div class="panel panel--text">
        <h2 class="h-sec" id="about-h">${esc(t.about.title)}</h2>
        ${kanji('物語', 'kanji--v')}
        <p class="about__lead">${esc(t.about.lead)}</p>
        <p class="about__bar">${esc(t.about.bar)}</p>
        ${story.length ? '' : `<p class="about__story">${placeholder(t.about.storyMissing)}</p>`}
        <p class="about__hint" aria-hidden="true">${esc(t.about.hint)} ${icons.arrow()}</p>
      </div>
      ${ch(0)}
      ${fig('night', [520, 900], 900, 975, 'ph--tall', '(min-width: 900px) 40vw, 78vw')}
      ${ch(1)}
      ${fig('lamp', [490], 490, 563, 'ph--low', '(min-width: 900px) 30vw, 70vw')}
      ${ch(2)}
      <div class="panel panel--flower">
        <h3>${esc(t.about.flowerTitle)}</h3>
        <p>${esc(t.about.flower)}</p>
      </div>
      ${fig('tempura', [520, 900], 900, 1088, 'ph--tall', '(min-width: 900px) 38vw, 78vw')}
      ${ch(3)}
      <figure class="panel cert">
        <a class="cert__link" href="${asset('/img/venue/haccp-1400.webp')}" target="_blank" rel="noopener" aria-label="${esc(t.about.haccpOpen)}">${picture({ base: '/img/venue/haccp', widths: [720, 1400], alt: t.about.alt.haccp, width: 1400, height: 1003, sizes: '(min-width: 900px) 40vw, 82vw', imgCls: 'cert__img' })}</a>
        <figcaption><b>${esc(t.about.haccpTitle)}</b><span>${esc(t.about.haccpText)}</span></figcaption>
      </figure>
      ${fig('triptych', [740], 740, 372, 'ph--wide', '(min-width: 900px) 46vw, 86vw')}
      ${ch(4)}
      ${fig('box', [420, 560], 560, 960, 'ph--mid', '(min-width: 900px) 26vw, 66vw')}
      ${fig('cake', [420, 750], 750, 690, 'ph--low', '(min-width: 900px) 32vw, 74vw')}
      ${ch(5)}
      <div class="panel panel--end">${placeholder(t.about.kitchenMissing)}</div>
    </div>
    <span class="rod rod--b" aria-hidden="true"></span>
  </div>
</section>`;
}

function formField({ id, label, type = 'text', name, required = true, attrs = '', ph = '', auto = '' }) {
  return `<div class="field" data-field="${esc(name)}"><label for="${id}">${esc(label)}</label><input id="${id}" name="${esc(name)}" type="${type}"${required ? ' required' : ''}${ph ? ` placeholder="${esc(ph)}"` : ''}${auto ? ` autocomplete="${auto}"` : ''} ${attrs}><p class="field__err" data-err hidden></p></div>`;
}

const honeypot = (id, t) => `<div class="hp" aria-hidden="true"><label for="${id}">${esc(t.form.hp)}</label><input id="${id}" name="website" type="text" tabindex="-1" autocomplete="off"></div>`;

function consentField(id, lang, t) {
  return `<div class="field field--check" data-field="consent"><label for="${id}"><input id="${id}" type="checkbox" name="consent" required><span>${esc(t.form.consent)} <a href="${lang === 'cs' ? '' : `/${lang}`}/soukromi" target="_blank" rel="noopener">${esc(t.form.consentLink)}</a></span></label><p class="field__err" data-err hidden></p></div>`;
}

// instagram.com/<name>/ becomes ig.me/m/<name>, which opens a direct message in the app
const igDirect = (url) => {
  const m = String(url).match(/instagram\.com\/([A-Za-z0-9._]+)/);
  return m ? `https://ig.me/m/${m[1]}` : url;
};

function visitSection(c, lang, t) {
  const s = c.site;
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.address.street}, ${s.address.zip} ${s.address.city}`)}`;
  const hours = DAY_KEYS.map((k) => {
    const h = s.hours[k];
    return `<div class="hours__row" data-day="${k}"><dt>${esc(t.visit.days[k])}</dt><dd>${h ? `${esc(h[0].replace(/^0/, ''))} – ${esc(h[1])}` : esc(t.visit.closedDay)}</dd></div>`;
  }).join('');
  return `<section class="visit" id="visit" aria-labelledby="visit-h">
  ${branch({ seed: 53, cls: 'orn--visit', blooms: 6 })}
  <h2 class="h-sec" id="visit-h" data-lines>${esc(t.visit.title)}</h2>
  ${kanji('案内', 'kanji--v')}
  <div class="visit__grid">
    <div class="map" data-map>
      <div class="map__canvas" data-map-canvas></div>
      <div class="map__poster" data-map-poster>
        <picture><source type="image/avif" srcset="/img/venue/map-poster.avif"><img class="map__art" src="/img/venue/map-poster.webp" alt="${esc(t.visit.mapAlt)}" width="1000" height="720" loading="lazy" decoding="async"></picture>
        <span class="map__pin" aria-hidden="true">${kanji('桜')}</span>
        <small class="map__attr">© <a href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank">OpenStreetMap</a></small>
        <button class="btn-plain btn-plain--on map__load js-only" type="button" data-map-load data-grab>${esc(t.visit.mapLoad)}</button>
        <p class="map__note js-only">${esc(t.visit.mapNote)}</p>
      </div>
    </div>
    <div class="info">
      <p class="info__addr">${esc(s.address.street)}<br>${esc(s.address.zip)} ${esc(s.address.city)}</p>
      <p class="status js-only" data-status></p>
      <a class="btn btn--primary" href="${esc(routeUrl)}" rel="noopener" target="_blank" data-morph data-grab><span>${esc(t.visit.route)}</span></a>
      <a class="info__tel" href="tel:${esc(s.phone)}">${icons.phone()}${esc(s.phoneDisplay)}</a>
      <h3 class="info__h">${esc(t.visit.hours)}</h3>
      <dl class="hours">${hours}</dl>
    </div>
  </div>
  <div class="book">
    <figure class="book__ph" data-mask>${picture({ base: '/img/venue/reserved', widths: [640, 1000], alt: t.visit.reserveAlt, width: 1000, height: 701, sizes: '(min-width: 900px) 46vw, 100vw' })}</figure>
    <div class="book__ways">
      <div class="way">
        <h3 class="form__h">${esc(t.visit.reserveTitle)}</h3>
        <p>${esc(t.visit.reserveText)}</p>
        <div class="way__btns">
          <a class="btn btn--primary" href="tel:${esc(s.phone)}" data-morph data-grab><span>${esc(t.nav.call)}</span></a>
          ${s.socials.instagram ? `<a class="btn-plain btn-plain--on" href="${esc(igDirect(s.socials.instagram))}" rel="noopener" target="_blank" data-grab>${esc(t.visit.writeIg)}</a>` : ''}
        </div>
        <a class="way__tel" href="tel:${esc(s.phone)}">${esc(s.phoneDisplay)}</a>
      </div>
      <div class="way">
        <h3 class="form__h">${esc(t.visit.orderTitle)}</h3>
        <p>${esc(t.visit.orderText)}</p>
        <div class="way__btns">
          ${orderLink(c, t, 'btn btn--primary', `<span>${esc(t.visit.onlineMenu)}</span>`, 'data-morph data-grab')}
          <a class="btn-plain" href="tel:${esc(s.phone)}" data-grab>${esc(t.nav.call)}</a>
        </div>
      </div>
    </div>
  </div>
  <form class="form form--contact" id="contact" data-form="contact" novalidate>
    <h3 class="form__h">${esc(t.visit.contactTitle)}</h3>
    <noscript><p class="form__msg">${esc(t.form.noscript)}</p></noscript>
    <div class="form__row">
      ${formField({ id: 'c-name', label: t.form.name, name: 'name', auto: 'name' })}
      ${formField({ id: 'c-contact', label: t.form.contact, name: 'contact', auto: 'email' })}
    </div>
    <div class="field" data-field="message"><label for="c-message">${esc(t.form.message)}</label><textarea id="c-message" name="message" rows="3" required></textarea><p class="field__err" data-err hidden></p></div>
    ${honeypot('c-hp', t)}
    ${consentField('c-consent', lang, t)}
    <div class="form__turnstile" data-turnstile hidden></div>
    <button class="btn-plain btn-plain--on js-only" type="submit" data-grab>${esc(t.form.sendContact)}</button>
    <p class="form__msg" data-msg role="status" hidden></p>
  </form>
</section>`;
}

function heroSection(c, lang, t) {
  const h = t.hero;
  return `<section class="hero" id="top" aria-labelledby="hero-h">
  <div class="hero__plate" data-hero-plate>
    ${picture({ base: '/img/hero/plate', widths: [720, 1100, 1536], alt: h.plateAlt, width: 1536, height: 1236, sizes: '(min-width: 1000px) 60vw, 116vw', imgCls: 'hero__img', eager: true })}
  </div>
  <img class="hero__logo" src="/img/logo/logo-320.webp" srcset="/img/logo/logo-192.webp 192w, /img/logo/logo-320.webp 320w, /img/logo/logo-512.webp 512w" sizes="(min-width: 900px) 168px, 92px" width="320" height="320" alt="${esc(c.site.name)}" decoding="async" data-hero-logo>
  <h1 class="hero__h1" id="hero-h" data-hero-h>${h.h1.map((l) => `<span class="ln"><span class="ln__in">${esc(l)}</span></span>`).join(' ')}</h1>
  <div class="hero__below">
    <p class="hero__other" lang="${esc(h.otherLang)}">${esc(h.other)}</p>
    <p class="hero__slogan">${esc(h.slogan)}</p>
    <div class="hero__cta">
      ${orderLink(c, t, 'btn btn--primary btn--xl', `<span>${esc(t.nav.order)}</span>`, 'data-morph data-grab')}
      <a class="tlink tlink--light hero__call" href="tel:${esc(c.site.phone)}">${icons.phone()}${esc(c.site.phoneDisplay)}</a>
    </div>
    <p class="status js-only" data-status></p>
  </div>
  <div class="hanko" role="img" aria-label="${esc(h.seal)}"><span aria-hidden="true">桜</span></div>
</section>`;
}

// "Order" always means the MenuForma online menu, or a phone call if that link is ever removed
function orderLink(c, t, cls, inner, attrs = '') {
  const url = c.site.ordering.menuforma;
  return url
    ? `<a class="${cls}" href="${esc(url)}" rel="noopener" target="_blank" ${attrs}>${inner}</a>`
    : `<a class="${cls}" href="tel:${esc(c.site.phone)}" ${attrs}>${inner}</a>`;
}

// One dialog for every dish. menu.js fills it from the clicked card.
function dishDialog(c, t) {
  return `<dialog class="dlg" data-dlg aria-labelledby="dlg-title" data-lenis-prevent>
  <div class="dlg__box" tabindex="-1" autofocus>
    <button class="dlg__x" type="button" data-dlg-close aria-label="${esc(t.menu.close)}">${icons.close()}</button>
    <div class="dlg__pic" data-dlg-pic></div>
    <div class="dlg__body">
      <h2 class="dlg__name" id="dlg-title" data-dlg-name></h2>
      <div data-dlg-info></div>
      <div class="dlg__acts">
        ${orderLink(c, t, 'btn btn--primary', `<span>${esc(t.nav.order)}</span>`)}
        <a class="btn-plain dlg__call" href="tel:${esc(c.site.phone)}">${icons.phone()}<span>${esc(t.nav.call)}</span></a>
      </div>
    </div>
  </div>
</dialog>`;
}

function dockAndPreloader(c, lang, t) {
  const s = c.site;
  return `${dishDialog(c, t)}
<nav class="dock js-only" aria-label="${esc(t.nav.order)}">
  <a href="tel:${esc(s.phone)}" class="dock__b">${icons.phone()}<span>${esc(t.nav.call)}</span></a>
  ${orderLink(c, t, 'dock__b dock__b--main', `<span>${esc(t.nav.order)}</span>`)}
  <a href="#visit" class="dock__b">${icons.pin()}<span>${esc(t.nav.route)}</span></a>
</nav>
<div class="pre" data-pre aria-hidden="true"><svg viewBox="-50 -50 100 100" class="pre__svg"><defs><linearGradient id="pre-petal" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-41"><stop offset="0" stop-color="#e07a9c"/><stop offset=".55" stop-color="#f4b3c7"/><stop offset="1" stop-color="#fde3ea"/></linearGradient></defs><g data-pre-flower><g transform="rotate(0)"><path class="pre__petal" data-pre-petal d="M0 0C-15-7-18-29-7-41L0-35.5L7-41C18-29 15-7 0 0Z"/><path class="pre__vein" data-pre-vein d="M0-3V-30"/></g><g transform="rotate(72)"><path class="pre__petal" data-pre-petal d="M0 0C-15-7-18-29-7-41L0-35.5L7-41C18-29 15-7 0 0Z"/><path class="pre__vein" data-pre-vein d="M0-3V-30"/></g><g transform="rotate(144)"><path class="pre__petal" data-pre-petal d="M0 0C-15-7-18-29-7-41L0-35.5L7-41C18-29 15-7 0 0Z"/><path class="pre__vein" data-pre-vein d="M0-3V-30"/></g><g transform="rotate(216)"><path class="pre__petal" data-pre-petal d="M0 0C-15-7-18-29-7-41L0-35.5L7-41C18-29 15-7 0 0Z"/><path class="pre__vein" data-pre-vein d="M0-3V-30"/></g><g transform="rotate(288)"><path class="pre__petal" data-pre-petal d="M0 0C-15-7-18-29-7-41L0-35.5L7-41C18-29 15-7 0 0Z"/><path class="pre__vein" data-pre-vein d="M0-3V-30"/></g><g data-pre-stamen><path class="pre__stem" d="M0 0L7.1 -9.7"/><circle class="pre__anther" cx="7.1" cy="-9.7" r="1.7"/></g><g data-pre-stamen><path class="pre__stem" d="M0 0L11.4 3.7"/><circle class="pre__anther" cx="11.4" cy="3.7" r="1.7"/></g><g data-pre-stamen><path class="pre__stem" d="M0 0L0.0 12.0"/><circle class="pre__anther" cx="0.0" cy="12.0" r="1.7"/></g><g data-pre-stamen><path class="pre__stem" d="M0 0L-11.4 3.7"/><circle class="pre__anther" cx="-11.4" cy="3.7" r="1.7"/></g><g data-pre-stamen><path class="pre__stem" d="M0 0L-7.1 -9.7"/><circle class="pre__anther" cx="-7.1" cy="-9.7" r="1.7"/></g><circle class="pre__core" data-pre-core r="4.2"/></g></svg></div>`;
}

export function renderHome(c, lang) {
  const t = c.i18n[lang];
  const body = [heroSection(c, lang, t), menuSection(c, lang, t), promoSection(c, lang, t), deliverySection(c, lang, t), aboutSection(c, lang, t), visitSection(c, lang, t)].join('\n');
  return page({ lang, c, t, title: t.meta.title, description: t.meta.description, path: '/', body, home: true, extra: dockAndPreloader(c, lang, t) });
}
