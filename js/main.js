// Entry point. Each feature starts inside its own guard: one failure can't take down the rest,
// and if the motion layer fails the page simply stays static and fully readable.
import { initConsent } from './consent.js';
import { initCursor } from './cursor.js';
import { primeToken, wireForm } from './forms.js';
import { initMap } from './map.js';
import { initMenu } from './menu.js';
import { initMotion } from './motion.js';
import { initPetals } from './petals.js';
import { initNav } from './nav.js';
import { initStatus } from './status.js';

const data = JSON.parse(document.getElementById('client-data').textContent);
const guard = (name, fn) => { try { return fn(); } catch (err) { console.error(`[${name}]`, err); return undefined; } };

let lenis = null;
const motion = guard('motion', initMotion);
if (!motion) {
  document.documentElement.classList.remove('fx');
  document.documentElement.classList.add('pre-done');
}
lenis = motion?.lenis || null;

// One way to scroll anywhere, whichever scroller is active
function scrollTo(target, offset) {
  if (!target) return;
  const nav = innerWidth < 1000 ? 60 : 72;
  const off = offset ?? -(nav + 14);
  if (lenis) lenis.scrollTo(target, { offset: off, duration: 1.15, easing: (t) => 1 - (1 - t) ** 4 });
  else window.scrollTo({ top: target.getBoundingClientRect().top + scrollY + off, behavior: document.documentElement.classList.contains('rm') ? 'auto' : 'smooth' });
}

guard('petals', () => initPetals(document.querySelector('[data-petals]')));
guard('cursor', () => initCursor(document.querySelector('[data-chop]')));
guard('consent', initConsent);
guard('nav', () => initNav({ scrollTo, lenis }));
guard('status', () => initStatus(data));

if (data.home) {
  guard('menu', () => initMenu({ scrollTo, data, lenis }));
  guard('map', () => initMap({ data }));

  guard('forms', () => {
    const con = document.querySelector('[data-form="contact"]');
    if (con) {
      wireForm(con, {
        url: '/api/contact',
        data,
        getBody() {
          const f = new FormData(con);
          return { name: f.get('name') || '', contact: f.get('contact') || '', message: f.get('message') || '', consent: f.get('consent') === 'on' };
        },
        onOk() {
          const box = con.querySelector('[data-msg]');
          box.textContent = data.form.okContact;
          box.classList.add('is-ok');
          box.hidden = false;
          con.reset();
        },
      });
    }
  });
  // Issue the form token early enough that a fast human can't trip the "too fast" check
  if ('requestIdleCallback' in window) requestIdleCallback(() => primeToken().catch(() => {}), { timeout: 4000 });
}
