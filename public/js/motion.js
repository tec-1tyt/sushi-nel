// Page choreography: preloader, hero entrance, scroll-linked morphs, reveals, the unrolling "about" scroll, button morphs.
// Nothing here is required to read or use the page.
import { track, request } from './scrollfx.js';
import { brush, circle, drop, mix, petal, pill, polygonSampler, sample, toPath } from './shapes.js';

const reduced = () => document.documentElement.classList.contains('rm');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- preloader: a drop of soy falls, lands, opens into a petal ---------- */
function preloader(G, done) {
  const html = document.documentElement;
  const pre = $('[data-pre]');
  if (!pre || html.classList.contains('pre-done') || !G) { html.classList.add('pre-done'); done(); return; }
  const path = $('[data-pre-path]', pre);
  const ring = $('.pre__ring', pre);
  const N = 40;
  const A = sample(drop, N);
  const B = sample(petal, N);
  const buf = new Float32Array(A.length);
  path.setAttribute('d', toPath(A));
  const st = { t: 0 };
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    html.classList.add('pre-done');
    try { sessionStorage.setItem('sn_pre', '1'); } catch { /* storage blocked */ }
  };
  const tl = G.timeline({ onComplete: finish });
  tl.fromTo(path, { y: -150, scaleY: 1.25, transformOrigin: '50% 50%' }, { y: 0, scaleY: 1, duration: .55, ease: 'power2.in' })
    .call(done)
    .fromTo(ring, { attr: { r: 8 }, opacity: .7 }, { attr: { r: 46 }, opacity: 0, duration: .75, ease: 'expo.out', immediateRender: false }, '>-0.02')
    .to(st, {
      t: 1,
      duration: .55,
      ease: 'expo.out',
      onUpdate() { path.setAttribute('d', toPath(mix(A, B, st.t, buf))); },
    }, '<')
    .to(path, { fill: '#eec3cb', duration: .35 }, '<')
    .to(path, { y: 120, x: 40, rotation: 70, opacity: 0, duration: .55, ease: 'power2.in', transformOrigin: '50% 50%' }, '>-0.05')
    .to(pre, { opacity: 0, duration: .32, ease: 'power1.out' }, '<0.18');
}

/* ---------- hero entrance ---------- */
function heroIn(G) {
  if (!G) return;
  const lines = $$('.hero .ln__in');
  const plate = $('[data-hero-plate]');
  const rest = $$('.hero__below > *, .hero__logo, .hanko');
  if (!lines.length) return;   // pages without a hero
  G.from(lines, { yPercent: 108, duration: 1.15, ease: 'expo.out', stagger: .09 });
  if (plate) G.from(plate, { rotation: -14, scale: 1.1, xPercent: 8, opacity: 0, duration: 1.5, ease: 'expo.out', clearProps: 'opacity' });
  G.from(rest, { opacity: 0, y: 16, duration: .9, ease: 'power3.out', stagger: .06, delay: .25, clearProps: 'all' });
}

/* ---------- things that follow the scroll ---------- */
function scrollLinked() {
  // Hero: the plate turns and rises, the headline lines slide apart
  const hero = $('.hero');
  const plate = $('[data-hero-plate]');
  const lines = $$('.hero .ln');
  const desktop = matchMedia('(min-width: 1000px)').matches;
  if (hero && plate) {
    track(hero, {
      start: 0,
      end: -1,
      fn(p) {
        plate.style.translate = `0 ${(-p * 16).toFixed(2)}vh`;
        plate.style.rotate = `${(p * 9).toFixed(2)}deg`;
        lines.forEach((ln, i) => { ln.style.transform = `translateX(${((i % 2 ? 1 : -1) * p * 7).toFixed(2)}vw)`; });
      },
    });
  }

  // Falling drop: leaves the plate, reaches the menu heading as a petal
  const dropSvg = $('[data-flowdrop]');
  if (dropSvg && hero) {
    const path = dropSvg.querySelector('path');
    const N = 36;
    const A = sample(drop, N), B = sample(petal, N);
    const buf = new Float32Array(A.length);
    path.setAttribute('d', toPath(A));
    track(hero, {
      start: 0,
      end: -.82,
      fn(p) {
        const inFlight = p > .001 && p < .995;
        dropSvg.style.opacity = inFlight ? String(Math.min(1, p * 8) * Math.min(1, (1 - p) * 8)) : '0';
        if (!inFlight) return;
        const eased = p * p;
        dropSvg.style.transform = `translate3d(${(Math.sin(p * 5) * 26 * p).toFixed(1)}px,${(eased * innerHeight * .72).toFixed(1)}px,0) rotate(${(p > .5 ? (p - .5) * 170 : 0).toFixed(1)}deg)`;
        const m = Math.min(1, Math.max(0, (p - .42) / .4));
        path.setAttribute('d', toPath(mix(A, B, m, buf)));
        path.setAttribute('fill', m > .5 ? '#eec3cb' : '#6b2f14');
      },
    });
  }

  // Promo: a drop of white swells into the plate
  const promo = $('[data-promo]');
  const plateBox = $('[data-plate]');
  const platePath = $('[data-plate-path]');
  if (promo && plateBox && platePath) {
    const svg = platePath.closest('svg');
    const content = $('.plate__in', plateBox);
    const N = 150;
    const bevel = $('[data-plate-bevel]');
    let A, B, W = 0, H = 0;
    const buf = new Float32Array(N * 2);
    const measure = () => {
      const r = svg.getBoundingClientRect();
      if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1 && A) return;
      W = r.width; H = r.height;
      svg.setAttribute('viewBox', `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      const side = Math.min(W, 340);
      const ox = (W - side) / 2, oy = Math.min(120, H * .08);
      A = sample((t) => { const [x, y] = drop(t); return [ox + x * side, oy + y * side]; }, N, 1, 1);
      const inset = Math.min(W * .012, 16);
      const c = [[inset, 22], [W - inset * .4, 4], [W, H - 18], [0, H]];
      B = sample(polygonSampler(c), N, 1, 1);
      // The rim of a square plate: an inner outline with lines running out to each corner
      const k = Math.min(W, H) * .028;
      const inner = [[c[0][0] + k, c[0][1] + k], [c[1][0] - k, c[1][1] + k], [c[2][0] - k, c[2][1] - k], [c[3][0] + k, c[3][1] - k]];
      if (bevel) bevel.setAttribute('d', `M${inner.map((v) => v.map((n) => n.toFixed(1)).join(' ')).join('L')}Z${c.map((v, i) => `M${v[0].toFixed(1)} ${v[1].toFixed(1)}L${inner[i][0].toFixed(1)} ${inner[i][1].toFixed(1)}`).join('')}`);
    };
    measure();
    if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(() => { measure(); request(); })).observe(plateBox);
    track(plateBox, {
      start: 1.05,
      end: .34,
      fn(p) {
        if (!A) return;
        const e = 1 - (1 - p) ** 3;
        platePath.setAttribute('d', toPath(mix(A, B, e, buf)));
        const show = Math.min(1, Math.max(0, (p - .55) / .32));
        content.style.opacity = String(show);
        if (bevel) bevel.style.opacity = String(show);
      },
    });
  }

  // Sauce lines on the plate and the delivery route are drawn by scrolling
  $$('[data-draw]').forEach((path) => {
    path.style.strokeDasharray = '1';
    path.style.strokeDashoffset = '1';
    track(path.closest('.plate') || path, {
      start: .75,
      end: -.1,
      fn(p) { path.style.strokeDashoffset = String(1 - p); },
    });
  });

  const route = $('[data-route]');
  if (route) {
    const line = $('[data-draw-route]', route);
    const rider = $('[data-rider]', route);
    const len = line.getTotalLength();
    line.style.strokeDasharray = '1';
    track(route, {
      start: .95,
      end: .38,
      fn(p) {
        line.style.strokeDashoffset = String(1 - p);
        const pt = line.getPointAtLength(len * p);
        rider.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      },
    });
  }
}

/* ---------- about: a handscroll that unrolls sideways while the page scrolls ---------- */
function makimono() {
  const about = $('[data-makimono]');
  if (!about) return;
  const mm = matchMedia('(min-width: 1000px)');
  if (!mm.matches) return;
  const track_ = $('[data-track]', about);
  let dist = 0;
  const measure = () => {
    dist = Math.max(0, track_.scrollWidth - innerWidth);
    about.style.height = `${Math.round(dist + innerHeight)}px`;
  };
  about.classList.add('is-pinned');
  measure();
  addEventListener('resize', measure, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(measure)).observe(track_);
  track(about, {
    start: 0,
    end: 1,
    useHeight: true,
    fn(p) { track_.style.transform = `translate3d(${(-p * dist).toFixed(1)}px,0,0)`; },
  });
}

/* ---------- reveals. IntersectionObserver never goes stale, so these can't get stuck hidden ---------- */
function splitLines(el) {
  const words = el.textContent.trim().split(/\s+/);
  const original = el.innerHTML;
  el.textContent = '';
  const spans = words.map((w, i) => {
    const s = document.createElement('span');
    s.textContent = w;
    el.append(s, i < words.length - 1 ? ' ' : '');
    return s;
  });
  const rows = [];
  let top = null;
  spans.forEach((s) => {
    if (top === null || Math.abs(s.offsetTop - top) > 4) { rows.push([]); top = s.offsetTop; }
    rows[rows.length - 1].push(s.textContent);
  });
  el.textContent = '';
  const inners = rows.map((row) => {
    const m = document.createElement('span');
    m.className = 'line-mask';
    const n = document.createElement('span');
    n.className = 'line-in';
    n.textContent = row.join(' ');
    m.append(n);
    el.append(m);
    return n;
  });
  el._original = original;
  el.classList.add('is-split');
  return inners;
}

function reveals(G) {
  const html = document.documentElement;
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      obs.unobserve(e.target);
      e.target.classList.add('is-in');
      const inners = e.target._lines;
      if (inners && G) {
        G.to(inners, {
          yPercent: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger: .08,
          onComplete() {
            e.target.innerHTML = e.target._original;
            e.target.classList.remove('is-split');
            e.target.classList.add('is-done');
          },
        });
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .05 });

  html.classList.add('fx');
  $$('[data-mask], .orn').forEach((el) => io.observe(el));
  observeDishes(io);
  window.__snObserveDishes = () => observeDishes(io);

  const fonts = document.fonts?.ready || Promise.resolve();
  Promise.race([fonts, new Promise((r) => setTimeout(r, 900))]).then(() => {
    $$('[data-lines]').forEach((el) => {
      if (!G) { el.classList.add('is-done'); return; }
      const inners = splitLines(el);
      G.set(inners, { yPercent: 110 });
      el._lines = inners;
      io.observe(el);
    });
  });
}

function observeDishes(io) {
  $$('.dish:not(.is-in)').forEach((d) => {
    if (d.closest('[hidden]') || d.hidden) return;
    io.observe(d);
  });
}

/* ---------- buttons: pill morphs into a brush stroke on hover ---------- */
function buttons(G) {
  if (!G || !matchMedia('(hover: hover)').matches) return;
  const NS = 'http://www.w3.org/2000/svg';
  const N = 34;
  $$('[data-morph]').forEach((btn) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'btn__bg');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    svg.append(path);
    btn.prepend(svg);
    let A, B, buf;
    const measure = () => {
      const r = btn.getBoundingClientRect();
      const w = btn.offsetWidth || r.width, h = btn.offsetHeight || r.height;
      if (!w || !h) return false;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      A = sample(pill, N, w, h);
      B = sample(brush, N, w, h);
      buf = new Float32Array(A.length);
      path.setAttribute('d', toPath(A));
      return true;
    };
    if (!measure()) { svg.remove(); return; }
    btn.classList.add('has-morph');
    const st = { t: 0 };
    const draw = () => path.setAttribute('d', toPath(mix(A, B, st.t, buf)));
    btn.addEventListener('pointerenter', () => { measure(); G.to(st, { t: 1, duration: .6, ease: 'expo.out', onUpdate: draw, overwrite: true }); });
    btn.addEventListener('pointerleave', () => { G.to(st, { t: 0, duration: .7, ease: 'expo.out', onUpdate: draw, overwrite: true }); });
    if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(() => { if (st.t === 0) measure(); })).observe(btn);
  });
}

/* ---------- smooth wheel scrolling, native touch ---------- */
function smoothScroll() {
  const Lenis = window.Lenis;
  if (!Lenis || !matchMedia('(hover: hover) and (pointer: fine)').matches) return null;
  const lenis = new Lenis({ lerp: .115, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, anchors: false, autoRaf: false });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  lenis.on('scroll', request);
  return lenis;
}

export function initMotion() {
  const G = window.gsap || null;
  let lenis = null;
  if (reduced()) {
    document.documentElement.classList.add('pre-done');
    return { lenis: null };
  }
  try { lenis = smoothScroll(); } catch (err) { console.warn('smooth scroll off', err); }
  let heroStarted = false;
  const startHero = () => { if (!heroStarted) { heroStarted = true; heroIn(G); } };
  // Set hero start states first, so the first revealed frame is already correct
  if (document.documentElement.classList.contains('pre-done')) startHero();
  else preloader(G, startHero);
  scrollLinked();
  makimono();
  reveals(G);
  buttons(G);
  return { lenis };
}
