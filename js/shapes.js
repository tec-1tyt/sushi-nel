// Path morphing without a plugin. Every shape is sampled to the same number of points in the same order
// (starting at the top, going clockwise), so any shape can blend into any other with a plain lerp.

const TAU = Math.PI * 2;

export function sample(fn, n, w = 100, h = 100) {
  const pts = new Float32Array(n * 2);
  for (let i = 0; i < n; i += 1) {
    const [x, y] = fn((i / n) * TAU, i / n);
    pts[i * 2] = x * w;
    pts[i * 2 + 1] = y * h;
  }
  return pts;
}

// A falling drop with its tip at the top
export const drop = (t) => {
  const s = Math.sin(t / 2);
  return [0.5 + 0.44 * Math.sin(t) * s * s, 0.52 - 0.42 * Math.cos(t)];
};

// A sakura petal: notched tip at the top, narrow at the base
export const petal = (t) => {
  const a = t > Math.PI ? t - TAU : t;
  const notch = 0.15 * Math.exp(-((a / 0.24) ** 2));
  return [0.5 + 0.36 * Math.sin(t) * (0.74 + 0.26 * Math.cos(t)), 0.53 - 0.42 * Math.cos(t) + notch];
};

export const circle = (t) => [0.5 + 0.42 * Math.sin(t), 0.5 - 0.42 * Math.cos(t)];

// Rounded pill for buttons
export const pill = (t) => {
  const s = Math.sin(t), c = Math.cos(t);
  const p = 0.32;
  return [0.5 + 0.5 * Math.sign(s) * Math.abs(s) ** p, 0.5 - 0.5 * Math.sign(c) * Math.abs(c) ** p];
};

// The same pill with brush-stroke edges and pointed ends
export const brush = (t) => {
  const s = Math.sin(t), c = Math.cos(t);
  const p = 0.5;
  const wob = 1 + 0.055 * Math.sin(t * 5 + 0.6) + 0.035 * Math.sin(t * 11);
  return [0.5 + 0.54 * Math.sign(s) * Math.abs(s) ** p * wob, 0.5 - 0.5 * Math.sign(c) * Math.abs(c) ** 0.7 * wob];
};

// A polygon walked at even steps from the middle of its top edge, so it lines up with the curves above
export function polygonSampler(corners) {
  const start = [(corners[0][0] + corners[1][0]) / 2, (corners[0][1] + corners[1][1]) / 2];
  const ring = [start, ...corners.slice(1), corners[0], start];
  const lens = [];
  let total = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const l = Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]);
    lens.push(l);
    total += l;
  }
  return (_t, u) => {
    let d = u * total;
    for (let i = 0; i < lens.length; i += 1) {
      if (d <= lens[i]) {
        const k = d / lens[i];
        return [ring[i][0] + (ring[i + 1][0] - ring[i][0]) * k, ring[i][1] + (ring[i + 1][1] - ring[i][1]) * k];
      }
      d -= lens[i];
    }
    return start;
  };
}

// Closed Catmull-Rom spline through the points, as cubic bezier path data
export function toPath(pts) {
  const n = pts.length / 2;
  const X = (i) => pts[((i + n) % n) * 2];
  const Y = (i) => pts[((i + n) % n) * 2 + 1];
  let d = `M${X(0).toFixed(2)} ${Y(0).toFixed(2)}`;
  for (let i = 0; i < n; i += 1) {
    const c1x = X(i) + (X(i + 1) - X(i - 1)) / 6;
    const c1y = Y(i) + (Y(i + 1) - Y(i - 1)) / 6;
    const c2x = X(i + 1) - (X(i + 2) - X(i)) / 6;
    const c2y = Y(i + 1) - (Y(i + 2) - Y(i)) / 6;
    d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${X(i + 1).toFixed(2)} ${Y(i + 1).toFixed(2)}`;
  }
  return `${d}Z`;
}

export function mix(a, b, t, out = new Float32Array(a.length)) {
  for (let i = 0; i < a.length; i += 1) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}
