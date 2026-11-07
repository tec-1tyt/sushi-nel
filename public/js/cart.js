// Cart: lives in localStorage, reads names and prices from the menu in the page, sends only ids and quantities.
// The server computes the total itself.
import { icons } from './ui-icons.js';
import { primeToken, wireForm } from './forms.js';

const KEY = 'sn_cart_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: cart lasts this visit */ } };

export function initCart({ data, fmt, scrollTo, lenis }) {
  const root = document.querySelector('[data-cart]');
  if (!root) return null;
  const T = data.cart;
  const panel = root.querySelector('[data-cart-panel]');
  const linesBox = root.querySelector('[data-cart-lines]');
  const form = root.querySelector('[data-form="order"]');
  const emptyBox = root.querySelector('[data-cart-empty]');
  const totalRow = root.querySelector('[data-cart-total-row]');
  const totalEl = root.querySelector('[data-cart-total]');
  const note = root.querySelector('[data-cart-note]');
  const giftBox = root.querySelector('[data-cart-gift]');
  const giftText = root.querySelector('[data-cart-gift-text]');
  const giftBar = root.querySelector('[data-cart-gift-bar]');
  const done = root.querySelector('[data-cart-done]');
  const counts = document.querySelectorAll('[data-cart-count]');
  const dockLabel = document.querySelector('[data-dock-label]');
  const dockOrder = document.querySelector('[data-dock-order]');
  const adultWrap = root.querySelector('[data-adult-wrap]');
  const adultInput = adultWrap?.querySelector('input');

  let items = load();
  let lastFocus = null;

  const card = (id) => document.querySelector(`[data-dish="${CSS.escape(id)}"]`);
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);

  // Turns stored rows into displayable ones. Dishes removed from the menu drop out quietly.
  function resolved() {
    return items.map((row) => {
      const c = card(row.id);
      if (!c) return null;
      if (row.variant) {
        const v = c.querySelector(`input[value="${CSS.escape(row.variant)}"]`);
        if (!v) return null;
        return { ...row, name: c.dataset.name, label: v.dataset.label, price: Number(v.dataset.price), alcohol: 'alcohol' in c.dataset };
      }
      if (!c.dataset.price) return null;
      return { ...row, name: c.dataset.name, label: '', price: Number(c.dataset.price), alcohol: 'alcohol' in c.dataset };
    }).filter(Boolean);
  }

  function render() {
    const rows = resolved();
    const count = rows.reduce((a, r) => a + r.qty, 0);
    const total = rows.reduce((a, r) => a + r.qty * r.price, 0);
    const empty = rows.length === 0;

    counts.forEach((c) => { c.textContent = count; c.hidden = count === 0; });
    if (dockLabel) dockLabel.textContent = empty ? dockLabel.dataset.default : `${count} · ${fmt(total)}`;

    emptyBox.hidden = !empty;
    linesBox.hidden = empty;
    form.hidden = empty;
    totalRow.hidden = empty;
    note.hidden = empty;
    if (!empty) done.hidden = true;
    totalEl.textContent = fmt(total);

    linesBox.textContent = '';
    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'cart__line';
      const info = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = r.name;
      info.append(b);
      if (r.label) { const s = document.createElement('small'); s.textContent = r.label; info.append(s); }
      const price = document.createElement('p');
      price.className = 'cart__line-p';
      price.textContent = fmt(r.price * r.qty);
      const qty = document.createElement('div');
      qty.className = 'qty';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.innerHTML = icons.minus;
      minus.setAttribute('aria-label', r.qty === 1 ? fill(T.remove, { n: r.name }) : `${T.minus}: ${r.name}`);
      minus.addEventListener('click', () => change(r, -1));
      const n = document.createElement('span');
      n.textContent = r.qty;
      n.setAttribute('aria-live', 'polite');
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.innerHTML = icons.plus;
      plus.setAttribute('aria-label', `${T.plus}: ${r.name}`);
      plus.addEventListener('click', () => change(r, 1));
      qty.append(minus, n, plus);
      li.append(info, price, qty);
      linesBox.append(li);
    });

    if (giftBox && data.gift) {
      const left = data.gift.threshold - total;
      giftBox.hidden = empty;
      giftText.textContent = left > 0 ? fill(T.giftLeft, { n: left.toLocaleString('cs-CZ').replace(/[  ]/g, ' ') }) : T.giftDone;
      giftBar.style.transform = `scaleX(${Math.min(1, total / data.gift.threshold)})`;
    }

    const hasAlcohol = rows.some((r) => r.alcohol);
    if (adultWrap) {
      adultWrap.hidden = !hasAlcohol;
      adultInput.required = hasAlcohol;
    }
  }

  function change(r, delta) {
    const row = items.find((x) => x.id === r.id && x.variant === r.variant);
    if (!row) return;
    row.qty = Math.max(0, Math.min(30, row.qty + delta));
    items = items.filter((x) => x.qty > 0);
    save(items);
    render();
  }

  function add(id, variant) {
    const row = items.find((x) => x.id === id && x.variant === variant);
    if (row) row.qty = Math.min(30, row.qty + 1);
    else items.push({ id, ...(variant ? { variant } : {}), qty: 1 });
    save(items);
    render();
  }

  /* ---- open / close ---- */
  const outside = () => [...document.body.children].filter((el) => el !== root && !el.matches('script, .chop, .petals, .pre'));
  function open() {
    lastFocus = document.activeElement;
    root.hidden = false;
    outside().forEach((el) => { el.inert = true; });
    lenis?.stop();
    document.documentElement.classList.add('cart-open');
    if (window.gsap && !document.documentElement.classList.contains('rm')) {
      const wide = innerWidth >= 1000;
      window.gsap.fromTo(panel, wide ? { xPercent: 100 } : { yPercent: 100 }, { xPercent: 0, yPercent: 0, duration: .7, ease: 'expo.out' });
      window.gsap.fromTo('.cart__scrim', { opacity: 0 }, { opacity: 1, duration: .4 });
    }
    panel.focus({ preventScroll: true });
    primeToken().catch(() => {});
  }
  function close() {
    root.hidden = true;
    outside().forEach((el) => { el.inert = false; });
    lenis?.start();
    document.documentElement.classList.remove('cart-open');
    lastFocus?.focus?.({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-cart-open]');
    if (openBtn) { e.preventDefault(); open(); return; }
    const closeBtn = e.target.closest('[data-cart-close]');
    if (closeBtn) {
      const a = closeBtn.closest('a[href^="#"]');
      if (a) e.preventDefault();
      close();
      if (a) scrollTo(document.querySelector(a.getAttribute('href')));
      return;
    }
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const c = addBtn.closest('[data-dish]');
      const checked = c.querySelector('input[type="radio"]:checked');
      add(c.dataset.dish, checked ? checked.value : undefined);
      addBtn.classList.add('is-added');
      setTimeout(() => addBtn.classList.remove('is-added'), 800);
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });

  // The phone dock opens the cart when there is something in it, otherwise jumps to the menu
  dockOrder?.addEventListener('click', (e) => {
    e.preventDefault();
    if (items.length) open(); else scrollTo(document.querySelector('#menu'));
  });

  /* ---- order form ---- */
  const addrWrap = form.querySelector('[data-address-wrap]');
  const timeWrap = form.querySelector('[data-time-wrap]');
  const addr = form.querySelector('[name="address"]');
  const syncForm = () => {
    const mode = form.querySelector('[name="mode"]:checked')?.value;
    addrWrap.hidden = mode !== 'delivery';
    addr.required = mode === 'delivery';
    timeWrap.hidden = form.querySelector('[name="whenMode"]:checked')?.value !== 'time';
  };
  form.addEventListener('change', syncForm);
  syncForm();

  wireForm(form, {
    url: '/api/order',
    data,
    getBody() {
      const f = new FormData(form);
      const timed = f.get('whenMode') === 'time' && f.get('time');
      return {
        name: f.get('name') || '',
        phone: f.get('phone') || '',
        mode: f.get('mode'),
        address: f.get('mode') === 'delivery' ? (f.get('address') || '') : '',
        when: timed ? f.get('time') : 'asap',
        note: f.get('note') || '',
        adult: f.get('adult') === 'on',
        consent: f.get('consent') === 'on',
        items: items.map(({ id, variant, qty }) => ({ id, ...(variant ? { variant } : {}), qty })),
      };
    },
    onOk(_json, body) {
      items = [];
      save(items);
      form.reset();
      syncForm();
      render();
      done.textContent = fill(data.form.okOrder, { phone: body.phone });
      done.hidden = false;
      emptyBox.hidden = true;
      panel.scrollTop = 0;
    },
  });

  render();
  return { open, close, add };
}
