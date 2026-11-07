// Fixed navigation: solid after the hero, scroll-spy, hides while scrolling down on phones, and the morphing overlay.
import { circle, mix, polygonSampler, sample, toPath } from './shapes.js';

export function initNav({ scrollTo, lenis }) {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const html = document.documentElement;
  const isHome = document.body.classList.contains('is-home');

  /* solid background + hide on scroll down (phones only) */
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('is-solid', y > innerHeight * .55 || !isHome);
    if (innerWidth < 1000) {
      const down = y > lastY + 4, up = y < lastY - 4;
      if (down && y > 160) { nav.classList.add('is-hidden'); html.classList.remove('nav-up'); }
      if (up || y < 80) { nav.classList.remove('is-hidden'); html.classList.add('nav-up'); }
    }
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  html.classList.add('nav-up');
  onScroll();

  /* scroll spy */
  const links = [...nav.querySelectorAll('[data-spy]')];
  const sections = links.map((l) => document.getElementById(l.dataset.spy)).filter(Boolean);
  if (sections.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((l) => {
          const on = l.dataset.spy === e.target.id;
          l.classList.toggle('is-active', on);
          if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }

  /* in-page links go through the same scroller */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.matches('[data-tab], [data-jump-tab], [data-cart-close], [data-dock-order]')) return;
    const id = a.getAttribute('href').slice(1);
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    e.preventDefault();
    scrollTo(el, id === 'top' ? 0 : undefined);
    history.replaceState(null, '', `#${id}`);
  });

  /* overlay: a drop grows out of the burger until it fills the screen */
  const burger = nav.querySelector('[data-burger]');
  const overlay = document.querySelector('[data-overlay]');
  if (!burger || !overlay) return;
  const svg = overlay.querySelector('svg');
  const path = overlay.querySelector('[data-overlay-path]');
  const items = [...overlay.querySelectorAll('[data-overlay-link], .overlay__foot > *')];
  const G = window.gsap;
  const N = 44;
  const st = { t: 0 };
  let A, B;
  const buf = new Float32Array(N * 2);
  const shapes = () => {
    const w = innerWidth, h = innerHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const r = burger.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    A = sample((t) => { const [x, y] = circle(t); return [cx - 14 + x * 28, cy - 14 + y * 28]; }, N, 1, 1);
    const m = Math.max(w, h) * .25;
    B = sample(polygonSampler([[-m, -m], [w + m, -m], [w + m, h + m], [-m, h + m]]), N, 1, 1);
  };
  const paint = () => path.setAttribute('d', toPath(mix(A, B, st.t, buf)));
  const motionOk = G && !html.classList.contains('rm');

  function open() {
    shapes();
    overlay.hidden = false;
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', burger.dataset.labelClose);
    nav.classList.remove('is-hidden');
    lenis?.stop();
    html.classList.add('menu-open');
    document.querySelector('main').inert = true;
    if (motionOk) {
      G.killTweensOf(st);
      G.to(st, { t: 1, duration: .85, ease: 'expo.inOut', onUpdate: paint });
      G.fromTo(items, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: 'expo.out', stagger: .05, delay: .3 });
    } else { st.t = 1; paint(); }
  }
  function close() {
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', burger.dataset.labelOpen);
    lenis?.start();
    html.classList.remove('menu-open');
    document.querySelector('main').inert = false;
    const hide = () => { overlay.hidden = true; };
    if (motionOk) {
      G.killTweensOf(st);
      G.to(items, { opacity: 0, duration: .2 });
      G.to(st, { t: 0, duration: .6, ease: 'expo.inOut', onUpdate: paint, onComplete: hide });
    } else hide();
  }
  burger.addEventListener('click', () => (burger.getAttribute('aria-expanded') === 'true' ? close() : open()));
  overlay.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { close(); burger.focus(); } });
}
