/** Math + random helpers. Deterministic RNG so runs/seeds are reproducible in tests. */

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInQuad = (t) => clamp01(t) * clamp01(t);
export const approach = (cur, target, maxDelta) => {
  if (cur < target) return Math.min(cur + maxDelta, target);
  if (cur > target) return Math.max(cur - maxDelta, target);
  return target;
};
/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this._r = mulberry32(this.seed);
  }
  next() {
    return this._r();
  }
  range(a, b) {
    return a + (b - a) * this._r();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  pick(arr) {
    return arr[Math.floor(this._r() * arr.length) % arr.length];
  }
  chance(p) {
    return this._r() < p;
  }
  /** roughly gaussian, mean 0, sd 1 (irwin-hall) */
  gauss() {
    return (this._r() + this._r() + this._r() + this._r() - 2) * 0.8660254;
  }
  fork() {
    return new RNG(Math.floor(this._r() * 0xffffffff));
  }
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

/** Distance from point to segment (returns {d, px, py, t}). */
export function closestOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby || 1e-6;
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = clamp01(t);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return { d: Math.hypot(px - cx, py - cy), x: cx, y: cy, t };
}

export const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

export function formatMeters(m) {
  if (!Number.isFinite(m)) return '0 m';
  if (m < 10) return `${m.toFixed(1)} m`;
  return `${Math.floor(m).toLocaleString('en-US')} m`;
}

export function formatScore(n) {
  return Math.floor(num(n, 0)).toLocaleString('en-US');
}
