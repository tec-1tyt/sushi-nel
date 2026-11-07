// Cookie banner. The site has one necessary cookie and no tracking, so the only real choice is the third-party map.
const KEY = 'sn_consent';
const listeners = [];

export function getConsent() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export const onConsent = (fn) => listeners.push(fn);

function setConsent(v) {
  try { localStorage.setItem(KEY, v); } catch { /* storage blocked: the banner shows again next visit */ }
  listeners.forEach((fn) => fn(v));
}

export function initConsent() {
  const box = document.querySelector('[data-cookie]');
  if (!box) return;
  if (!getConsent()) {
    // Nothing optional runs before a choice, so the banner can wait until the first screen has been seen
    const show = () => { box.hidden = false; removeEventListener('scroll', show); clearTimeout(timer); };
    const timer = setTimeout(show, 6000);
    addEventListener('scroll', show, { passive: true, once: true });
  }
  box.querySelector('[data-cookie-allow]')?.addEventListener('click', () => { setConsent('map'); box.hidden = true; });
  box.querySelector('[data-cookie-deny]')?.addEventListener('click', () => { setConsent('necessary'); box.hidden = true; });
  document.querySelectorAll('[data-cookie-open]').forEach((b) => b.addEventListener('click', () => { box.hidden = false; box.querySelector('button')?.focus(); }));
}
