// Scroll-linked effects measured live from getBoundingClientRect on every frame, instead of cached trigger
// positions. Tabs that change the page height, late fonts and lazy images can't leave an effect "stuck":
// that is the bug that used to need a window resize to fix.

const items = new Set();
let ticking = false;
let vh = window.innerHeight;

function update(it) {
  const r = it.el.getBoundingClientRect();
  const startPx = vh * it.start;
  const endPx = vh * it.end + (it.useHeight ? -r.height : 0);
  const p = Math.min(1, Math.max(0, (startPx - r.top) / Math.max(1, startPx - endPx)));
  if (p !== it.last) { it.last = p; it.fn(p, r); }
}

const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.target._sfx) return;
      e.target._sfx.forEach((it) => {
        it.near = e.isIntersecting;
        // A fast jump can carry an element out of range mid-effect. Settle it at its end state on the way out.
        if (!it.near) update(it);
      });
    });
    request();
  }, { rootMargin: '35% 0px 35% 0px' })
  : null;

function run() {
  ticking = false;
  items.forEach((it) => { if (it.near) update(it); });
}

export function request() {
  if (!ticking) { ticking = true; requestAnimationFrame(run); }
}

// start/end: viewport fractions the element's top passes through. useHeight: end when its bottom reaches `end`.
export function track(el, { start = 1, end = 0, useHeight = false, fn }) {
  if (!el) return;
  const it = { el, start, end, useHeight, fn, near: !io, last: -1 };
  items.add(it);
  (el._sfx = el._sfx || []).push(it);
  if (io) io.observe(el);
  request();
}

// After scrolling stops, settle every effect once, even ones a fast jump skipped over entirely
let idle;
window.addEventListener('scroll', () => {
  request();
  clearTimeout(idle);
  idle = setTimeout(() => items.forEach(update), 160);
}, { passive: true });
window.addEventListener('resize', () => {
  vh = window.innerHeight;
  items.forEach((it) => { it.last = -1; });
  request();
}, { passive: true });
