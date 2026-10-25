/**
 * Drawing helpers + the JTTS palette.
 * Style: premium stylised cartoon — thick ink outlines, saturated fills,
 * warm highlights, careful material contrast. All shapes are vector, so the
 * game is crisp at any resolution without a single downloaded asset.
 */
export const PAL = {
  ink: '#241238',
  inkSoft: '#3a2458',
  cream: '#fff4d6',
  white: '#ffffff',
  paper: '#ffeec2',
  sky: '#39c0e8',
  skyDeep: '#1d6fb8',
  space: '#160b33',
  spaceMid: '#2c1457',
  spaceLight: '#5b2596',
  green: '#7fe33f',
  greenDeep: '#3f8a1f',
  greenLight: '#c6f24e',
  yellow: '#ffd93b',
  gold: '#ffb020',
  orange: '#ff8a3d',
  red: '#ff4d6d',
  pink: '#ff5ea8',
  purple: '#c58bff',
  cyan: '#7ee8ff',
  blue: '#4a7dff',
  wood: '#b06f35',
  woodDark: '#7a4321',
  metal: '#b9c6dd',
  metalDark: '#6b7a99',
  brown: '#5b3521',
  radius: 3.4,
};

export function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2);
}

export function inked(ctx, pathFn, fill, opts = {}) {
  const { stroke = PAL.ink, width = 4, glow = null } = opts;
  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
  }
  pathFn();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  if (stroke && width > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

export function fillPath(ctx, pathFn, fill, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  pathFn();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

export function strokePath(ctx, pathFn, stroke, width = 3, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  pathFn();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

export function radial(ctx, x, y, r, colourInner, colourOuter = 'rgba(0,0,0,0)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  g.addColorStop(0, colourInner);
  g.addColorStop(1, colourOuter);
  return g;
}

export function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

export function glowDot(ctx, x, y, r, colour, alpha = 0.9) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(colour, alpha));
  g.addColorStop(0.45, hexA(colour, alpha * 0.35));
  g.addColorStop(1, hexA(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function starPath(ctx, x, y, r, rot = 0, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points - Math.PI / 2;
    const rr2 = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr2;
    const py = y + Math.sin(a) * rr2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.5, x - s * 0.45, y - s, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.5, x, y + s * 0.35);
  ctx.closePath();
}

export function hexA(hex, a) {
  if (!hex) return `rgba(255,255,255,${a})`;
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function shade(hex, amt) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  let r = parseInt(n.slice(0, 2), 16);
  let g = parseInt(n.slice(2, 4), 16);
  let b = parseInt(n.slice(4, 6), 16);
  r = Math.max(0, Math.min(255, Math.round(r + 255 * amt)));
  g = Math.max(0, Math.min(255, Math.round(g + 255 * amt)));
  b = Math.max(0, Math.min(255, Math.round(b + 255 * amt)));
  return `rgb(${r},${g},${b})`;
}

export function arcText(ctx, text, cx, cy, radius, startAngle, size, fill, stroke) {
  ctx.save();
  ctx.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let a = startAngle;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    a += w / radius / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.rotate(a + Math.PI / 2);
    if (stroke) {
      ctx.lineWidth = size * 0.16;
      ctx.strokeStyle = stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(ch, 0, 0);
    }
    ctx.fillStyle = fill;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += w / radius / 2;
  }
  ctx.restore();
}

export function bigText(ctx, text, x, y, size, fill, opts = {}) {
  const {
    align = 'center',
    baseline = 'middle',
    stroke = PAL.ink,
    strokeWidth = Math.max(2, size * 0.14),
    shadow = null,
    letterSpacing = 0,
    font = '"Arial Black", Impact, "Segoe UI Black", system-ui, sans-serif',
    alpha = 1,
  } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `900 ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(text, x + size * 0.05, y + size * 0.07);
  }
  if (stroke && strokeWidth > 0) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
