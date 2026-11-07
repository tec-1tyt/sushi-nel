// Falling sakura petals on one fixed canvas. They drift with the wind, get blown by scrolling and move out of the way of the mouse.
// Counts stay low on purpose, and the loop stops whenever the tab is hidden.

export function initPetals(canvas) {
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('lite')) return null;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return null;

  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const small = innerWidth < 760;
  const COUNT = small ? (weak ? 9 : 14) : (weak ? 18 : 34);
  const dpr = Math.min(window.devicePixelRatio || 1, small || weak ? 1.25 : 1.6);
  let W = 0, H = 0;
  const mouse = { x: -999, y: -999, active: false };
  let scrollV = 0, lastY = scrollY;

  function resize() {
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // One petal shape, drawn once per colour so frames only blit images
  const TINTS = ['rgba(240,186,198,.92)', 'rgba(246,212,218,.86)', 'rgba(226,158,174,.82)'];
  const sprites = TINTS.map((fill) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.translate(32, 34);
    g.scale(2.6, 2.6);
    g.beginPath();
    g.moveTo(0, 8);
    g.bezierCurveTo(-8, 3, -7.5, -6, -2, -9);
    g.lineTo(0, -6.4);
    g.lineTo(2, -9);
    g.bezierCurveTo(7.5, -6, 8, 3, 0, 8);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = 'rgba(190,110,130,.32)';
    g.lineWidth = .35;
    g.beginPath();
    g.moveTo(0, 7);
    g.lineTo(0, -3);
    g.stroke();
    return c;
  });

  const rnd = (a, b) => a + Math.random() * (b - a);
  const spawn = (p = {}, anywhere = false) => {
    p.x = rnd(-40, W + 40);
    p.y = anywhere ? rnd(-40, H) : rnd(-90, -20);
    p.size = rnd(9, small ? 18 : 24);
    p.vy = rnd(.22, .62);
    p.vx = rnd(-.1, .22);
    p.rot = rnd(0, 6.28);
    p.vr = rnd(-.014, .014);
    p.flip = rnd(0, 6.28);
    p.vflip = rnd(.008, .026);
    p.sway = rnd(0, 6.28);
    p.swayS = rnd(.004, .012);
    p.ox = 0;
    p.oy = 0;
    p.s = sprites[Math.floor(rnd(0, sprites.length))];
    return p;
  };

  resize();
  const petals = Array.from({ length: COUNT }, () => spawn({}, true));

  let running = true;
  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(2.4, (now - last) / 16.67);
    last = now;
    const y = scrollY;
    scrollV += ((y - lastY) * 0.05 - scrollV) * 0.14;
    lastY = y;
    const wind = Math.max(-5, Math.min(5, scrollV));

    ctx.clearRect(0, 0, W, H);
    for (const p of petals) {
      p.sway += p.swayS * dt;
      p.flip += p.vflip * dt;
      p.rot += (p.vr + wind * 0.002) * dt;
      p.x += (p.vx + Math.sin(p.sway) * 0.42 + Math.abs(wind) * 0.12) * dt;
      p.y += (p.vy - wind * 0.42) * dt;

      if (mouse.active) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 19600) {
          const f = (1 - Math.sqrt(d2) / 140) * 0.9;
          const inv = 1 / (Math.sqrt(d2) + 1);
          p.ox += dx * inv * f * dt - dy * inv * f * 0.45 * dt;
          p.oy += dy * inv * f * dt + dx * inv * f * 0.45 * dt;
        }
      }
      p.ox *= 0.94;
      p.oy *= 0.94;
      p.x += p.ox * dt;
      p.y += p.oy * dt;

      if (p.y > H + 40 || p.x > W + 60 || p.x < -60) spawn(p);
      else if (p.y < -110) p.y = H + 30;

      const sx = Math.abs(Math.cos(p.flip)) * 0.86 + 0.14;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(sx, 1);
      ctx.globalAlpha = 0.5 + sx * 0.45;
      ctx.drawImage(p.s, -p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }

  let resizeTimer;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); }, { passive: true });
  if (matchMedia('(hover: hover)').matches) {
    addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running = false;
    else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);
  return { stop() { running = false; ctx.clearRect(0, 0, W, H); } };
}
