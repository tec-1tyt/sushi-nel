// Thin-line sakura branches, generated from a seed so each section edge gets its own drawing.
// Every stroke has pathLength=1, so the front end can draw it on scroll. Purely decorative: aria-hidden.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => n.toFixed(1);

function bezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

function bezierAngle(p0, p1, p2, p3, t) {
  const a = bezierPoint(p0, p1, p2, p3, Math.max(0, t - 0.01));
  const b = bezierPoint(p0, p1, p2, p3, Math.min(1, t + 0.01));
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

// One notched sakura petal pointing along +y from the origin, placed by rotate/translate
function petal(cx, cy, r, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (x, y) => `${f(cx + (x * c - y * s) * r)} ${f(cy + (x * s + y * c) * r)}`;
  return `M${P(0, 0.12)}C${P(-0.42, 0.34)} ${P(-0.56, 0.86)} ${P(-0.13, 1.02)}L${P(0, 0.9)}L${P(0.13, 1.02)}C${P(0.56, 0.86)} ${P(0.42, 0.34)} ${P(0, 0.12)}Z`;
}

function blossom(x, y, r, spin, rand) {
  let out = `<g class="orn-bloom" data-orn-bloom>`;
  for (let i = 0; i < 5; i += 1) {
    out += `<path class="orn-petal" d="${petal(x, y, r, spin + (i * Math.PI * 2) / 5)}"/>`;
  }
  let st = '';
  for (let i = 0; i < 6; i += 1) {
    const a = rand() * Math.PI * 2;
    const l = r * (0.26 + rand() * 0.14);
    st += `M${f(x)} ${f(y)}L${f(x + Math.cos(a) * l)} ${f(y + Math.sin(a) * l)}`;
  }
  return `${out}<path class="orn-stamen" d="${st}"/></g>`;
}

function leaf(x, y, len, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (a, b) => `${f(x + a * c - b * s)} ${f(y + a * s + b * c)}`;
  return `<path class="orn-line" pathLength="1" d="M${P(0, 0)}C${P(len * 0.3, -len * 0.3)} ${P(len * 0.74, -len * 0.26)} ${P(len, 0)}C${P(len * 0.74, len * 0.26)} ${P(len * 0.3, len * 0.3)} ${P(0, 0)}Z"/><path class="orn-line orn-line--thin" pathLength="1" d="M${P(0, 0)}L${P(len * 0.86, 0)}"/>`;
}

// A smooth spine through jittered points, sampled for twig positions.
function spine(points) {
  const P = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  const segs = [];
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = P(i), p3 = P(i + 1);
    const p1 = [p0[0] + (p3[0] - P(i - 1)[0]) / 6, p0[1] + (p3[1] - P(i - 1)[1]) / 6];
    const p2 = [p3[0] - (P(i + 2)[0] - p0[0]) / 6, p3[1] - (P(i + 2)[1] - p0[1]) / 6];
    d += `C${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])} ${f(p3[0])} ${f(p3[1])}`;
    segs.push([p0, p1, p2, p3]);
  }
  const at = (t) => {
    const u = Math.min(0.9999, Math.max(0, t)) * segs.length;
    const i = Math.floor(u);
    const [a, b, c, e] = segs[i];
    return { p: bezierPoint(a, b, c, e, u - i), angle: bezierAngle(a, b, c, e, u - i) };
  };
  return { d, at };
}

function bud(x, y, ang) {
  return `<path class="orn-petal" d="${petal(x, y, 5.5, ang - Math.PI / 2)}"/>`;
}

// Draws a branch that starts off-canvas at one edge and reaches into the page.
export function branch({ seed = 1, w = 420, h = 620, cls = '', blooms = 6 } = {}) {
  const r = rng(seed);
  const j = (n) => (r() - 0.5) * n;
  const main = spine([
    [w * 1.02, -12],
    [w * (0.84 + j(0.05)), h * 0.14],
    [w * (0.74 + j(0.06)), h * 0.32],
    [w * (0.5 + j(0.08)), h * 0.46],
    [w * (0.4 + j(0.08)), h * 0.66],
    [w * (0.2 + j(0.06)), h * 0.8],
    [w * (0.1 + j(0.05)), h * 0.97],
  ]);
  const lines = [`<path class="orn-line orn-line--main" pathLength="1" d="${main.d}"/>`];
  const extras = [];
  let placed = 0;
  const n = blooms + 4;
  for (let i = 0; i < n; i += 1) {
    const t = 0.1 + (i / n) * 0.86 + j(0.03);
    const { p: [x, y], angle } = main.at(t);
    const side = i % 2 ? 1 : -1;
    const ang = angle + side * (0.7 + r() * 0.55);
    const len = 28 + r() * 70;
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    const cx = x + Math.cos(ang + side * 0.42) * len * 0.56;
    const cy = y + Math.sin(ang + side * 0.42) * len * 0.56;
    lines.push(`<path class="orn-line" pathLength="1" d="M${f(x)} ${f(y)}Q${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)}"/>`);
    if (i % 4 === 3) extras.push(leaf(ex, ey, 20 + r() * 16, ang + j(0.7)));
    else if (i % 4 === 1 && placed >= 2) extras.push(`<g class="orn-bloom" data-orn-bloom>${bud(ex, ey, ang)}</g>`);
    else if (placed < blooms) { extras.push(blossom(ex, ey, 10 + r() * 8, r() * 6.28, r)); placed += 1; }
  }
  return `<svg class="orn ${cls}" viewBox="0 0 ${w} ${h}" fill="none" aria-hidden="true" focusable="false" data-orn>${lines.join('')}${extras.join('')}</svg>`;
}
