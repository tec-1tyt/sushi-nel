// Menu tabs, search, allergen filter and variant prices. Without JS every category is simply listed.

import { request } from './scrollfx.js';

const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function initMenu({ scrollTo, data, lenis }) {
  const list = document.querySelector('[data-menu-list]');
  if (!list) return null;
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const cats = [...list.querySelectorAll('[data-cat]')];
  const dishes = [...list.querySelectorAll('[data-dish]')];
  const none = list.querySelector('[data-none]');
  const input = document.querySelector('[data-search-input]');
  const excl = [...document.querySelectorAll('[data-exclude]')];
  dishes.forEach((d) => {
    const own = [d.querySelector('.dish__name')?.textContent, d.querySelector('.dish__desc')?.textContent, d.dataset.alt].filter(Boolean).join(' ');
    d._search = norm(own);
    d._al = (d.dataset.allergens || '').split(' ').filter(Boolean);
  });

  let active = cats[0]?.dataset.cat;
  const tabsBox = document.querySelector('[data-tabs]');

  function apply() {
    const q = norm(input?.value.trim() || '');
    const bad = excl.filter((c) => c.checked).map((c) => c.value);
    const searching = q.length > 0;
    let visibleTotal = 0;
    cats.forEach((cat) => {
      const inScope = searching || cat.dataset.cat === active;
      let count = 0;
      cat.querySelectorAll('[data-dish]').forEach((d) => {
        const hit = (!q || q.split(/\s+/).every((w) => d._search.includes(w))) && !bad.some((a) => d._al.includes(a));
        d.hidden = !hit;
        if (hit && inScope) count += 1;
      });
      // Group headings disappear with their dishes
      cat.querySelectorAll('.group').forEach((g) => {
        let n = g.nextElementSibling, any = false;
        while (n && !n.classList.contains('group')) { if (!n.hidden) any = true; n = n.nextElementSibling; }
        g.hidden = !any;
      });
      cat.hidden = !inScope || count === 0;
      visibleTotal += count;
    });
    if (none) none.hidden = visibleTotal > 0;
    list.classList.toggle('is-searching', searching);
    document.querySelector('[data-tools]')?.classList.toggle('has-active', bad.length > 0);
    tabs.forEach((t) => {
      if (t.dataset.tab === active && !searching) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
    });
    window.__snObserveDishes?.();
    request();
  }

  function show(id, { scroll = true } = {}) {
    active = id;
    if (input) input.value = '';
    apply();
    const tab = tabs.find((t) => t.dataset.tab === id);
    if (tab && tabsBox && tabsBox.scrollWidth > tabsBox.clientWidth) {
      tabsBox.scrollTo({ left: tab.offsetLeft - tabsBox.clientWidth / 2 + tab.offsetWidth / 2, behavior: 'smooth' });
    }
    if (scroll) scrollTo(document.querySelector('[data-menu-list]'), -(window.innerWidth < 1000 ? 120 : 100));
  }

  tabs.forEach((t) => t.addEventListener('click', (e) => { e.preventDefault(); show(t.dataset.tab); }));

  // Start downloading a category's photos the moment a finger or mouse reaches its tab, before the click lands
  const warm = (id) => {
    const cat = cats.find((c) => c.dataset.cat === id);
    if (!cat || cat._warm) return;
    cat._warm = true;
    cat.querySelectorAll('img[loading="lazy"]').forEach((img, k) => { if (k < 9) img.loading = 'eager'; });
  };
  tabs.forEach((t) => {
    ['pointerenter', 'touchstart', 'focus'].forEach((ev) => t.addEventListener(ev, () => warm(t.dataset.tab), { passive: true }));
  });
  document.querySelectorAll('[data-jump-tab]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); show(a.dataset.jumpTab); }));

  let timer;
  input?.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(apply, 110); });
  excl.forEach((c) => c.addEventListener('change', apply));
  list.querySelector('[data-reset]')?.addEventListener('click', () => {
    if (input) input.value = '';
    excl.forEach((c) => { c.checked = false; });
    apply();
  });

  // Variant selection updates the shown price
  const LOCALE = { cs: 'cs-CZ', uk: 'uk-UA', en: 'en-GB' }[data.lang] || 'cs-CZ';
  const fmt = (n) => `${Number(n).toLocaleString(LOCALE).replace(/[  ]/g, ' ')} Kč`;
  list.addEventListener('change', (e) => {
    const r = e.target;
    if (r.type !== 'radio') return;
    const out = r.closest('[data-dish]')?.querySelector('[data-price-out]');
    if (out) out.textContent = fmt(r.dataset.price);
  });

  initDialog(list, fmt, lenis);
  apply();
  return { fmt };
}

// Tapping a dish opens it large: photo, full text, sizes, price and the ways to order
function initDialog(list, fmt, lenis) {
  const dlg = document.querySelector('[data-dlg]');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const pic = dlg.querySelector('[data-dlg-pic]');
  const name = dlg.querySelector('[data-dlg-name]');
  const info = dlg.querySelector('[data-dlg-info]');

  function open(card) {
    const p = card.querySelector('.dish__pic, .dish__noimg')?.cloneNode(true);
    p?.querySelectorAll('source, img').forEach((el) => { el.sizes = '(min-width: 760px) 440px, 100vw'; el.removeAttribute('style'); if (el.tagName === 'IMG') el.loading = 'eager'; });
    pic.replaceChildren(...(p ? [p] : []));
    name.innerHTML = card.querySelector('.dish__name').innerHTML;
    name.querySelector('[data-dish-open]')?.replaceWith(card.dataset.name);
    const body = card.querySelector('.dish__body').cloneNode(true);
    body.querySelector('.dish__name')?.remove();
    // Radio groups need their own names here, or picking a size in the dialog would change the card
    body.querySelectorAll('input[type=radio]').forEach((r) => { r.name = `dlg-${r.name}`; r.id = ''; });
    info.replaceChildren(...body.childNodes);
    lenis?.stop();
    dlg.showModal();
  }

  function close() {
    if (!dlg.open) return;
    if (document.documentElement.classList.contains('rm')) { dlg.close(); return; }
    dlg.classList.add('is-closing');
    setTimeout(() => { dlg.classList.remove('is-closing'); dlg.close(); }, 220);
  }

  list.addEventListener('click', (e) => {
    const card = e.target.closest('[data-dish]');
    // Size chips keep working inside the card
    if (!card || e.target.closest('input, label, a')) return;
    open(card);
  });
  dlg.addEventListener('close', () => lenis?.start());
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.querySelector('[data-dlg-close]').addEventListener('click', close);
  // A click on the dimmed backdrop lands on the dialog element itself
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  info.addEventListener('change', (e) => {
    const r = e.target;
    if (r.type !== 'radio') return;
    const out = info.querySelector('[data-price-out]');
    if (out) out.textContent = fmt(r.dataset.price);
  });
}
