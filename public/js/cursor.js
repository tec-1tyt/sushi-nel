// Chopsticks cursor. Tips sit on the pointer, the pair leans with mouse speed.
// Over buttons and dishes the tips close, as if picking the thing up. Over plain links the sticks cross.
// Only for a real mouse. The system cursor is hidden only after this has started, so it stays as the fallback.

const lerp = (a, b, k) => a + (b - a) * k;

export function initCursor(root) {
  if (!root) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const svg = root.querySelector('svg');
  const a = root.querySelector('[data-stick="a"]');
  const b = root.querySelector('[data-stick="b"]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const follow = reduced ? 1 : 0.24;

  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const target = { x: pos.x, y: pos.y };
  let tilt = 0, gap = 7, spread = 4.5, lift = 0;
  let goal = { gap: 7, spread: 4.5 };
  let lastX = target.x;
  let vx = 0;
  let pressed = false;
  let mode = 'idle';
  let grabbed = null;
  let visible = false;

  const MODES = {
    idle: { gap: 7, spread: 4.5 },
    grab: { gap: .4, spread: 1 },
    link: { gap: -3.5, spread: -7 },
  };

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    goal = MODES[next];
  }

  function release() {
    if (grabbed) {
      grabbed.classList.remove('is-grabbed');
      grabbed.style.removeProperty('--gx');
      grabbed.style.removeProperty('--gy');
      grabbed = null;
    }
  }

  function classify(el) {
    if (!el || !el.closest) return setMode('idle');
    if (el.closest('input:not([type="radio"],[type="checkbox"]), textarea')) {
      root.classList.remove('is-on');
      visible = false;
      return setMode('idle');
    }
    if (!visible) { root.classList.add('is-on'); visible = true; }
    const g = el.closest('[data-grab], [data-grab-card], .chip, .seg label');
    if (g) {
      setMode('grab');
      if (g !== grabbed) {
        release();
        if (g.matches('[data-grab]')) { grabbed = g; g.classList.add('is-grabbed'); }
      }
      return undefined;
    }
    release();
    if (el.closest('a, button, summary')) return setMode('link');
    return setMode('idle');
  }

  addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    target.x = e.clientX;
    target.y = e.clientY;
    if (!visible && !e.target.closest?.('input:not([type="radio"],[type="checkbox"]), textarea')) { root.classList.add('is-on'); visible = true; }
    classify(e.target);
    if (grabbed && !reduced) {
      const r = grabbed.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      grabbed.style.setProperty('--gx', `${(dx * 0.1).toFixed(1)}px`);
      grabbed.style.setProperty('--gy', `${(dy * 0.16).toFixed(1)}px`);
    }
  }, { passive: true });

  addEventListener('pointerdown', () => { pressed = true; }, { passive: true });
  addEventListener('pointerup', () => { pressed = false; }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { root.classList.remove('is-on'); visible = false; release(); });
  document.documentElement.addEventListener('mouseenter', () => { root.classList.add('is-on'); visible = true; });

  function frame() {
    pos.x = lerp(pos.x, target.x, follow);
    pos.y = lerp(pos.y, target.y, follow);
    const dx = target.x - lastX;
    lastX = target.x;
    vx = lerp(vx, dx, 0.1);
    tilt = lerp(tilt, reduced ? 0 : Math.max(-20, Math.min(20, vx * 1.3)), 0.12);
    const g = pressed ? 0 : goal.gap;
    gap = lerp(gap, g, 0.2);
    spread = lerp(spread, pressed ? .6 : goal.spread, 0.2);
    lift = lerp(lift, mode === 'grab' ? -3 : 0, 0.18);

    root.style.transform = `translate3d(${pos.x.toFixed(1)}px,${(pos.y + lift).toFixed(1)}px,0)`;
    svg.style.transform = `rotate(${(38 + tilt).toFixed(2)}deg)`;
    a.setAttribute('transform', `translate(0 ${(-gap).toFixed(2)}) rotate(${(-spread).toFixed(2)})`);
    b.setAttribute('transform', `translate(0 ${gap.toFixed(2)}) rotate(${spread.toFixed(2)})`);
    requestAnimationFrame(frame);
  }

  root.hidden = false;
  document.documentElement.classList.add('has-chop');
  requestAnimationFrame(frame);
}
