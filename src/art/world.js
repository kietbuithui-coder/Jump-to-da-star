/**
 * World rendering: five distinct skies, parallax props, the hazard floor,
 * floating islands, the launch lab and the bounce pads.
 */
import {
  PAL, rr, ellipse, inked, fillPath, strokePath, starPath, linear, radial, hexA,
  glowDot, bigText, shade, clamp01,
} from './art.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
import { drawItemArt } from './items.js';
import { ITEM_DEFS } from '../game/items.js';
import { LAUNCH } from '../config/config.js';

// ---------------------------------------------------------------- utilities
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function skyGradient(ctx, w, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function regionStops(id) {
  switch (id) {
    case 'wilds':
      return [[0, '#2ec5d8'], [0.42, '#7ee6c6'], [0.72, '#c8f5a8'], [1, '#a8e06a']];
    case 'clouds':
      return [[0, '#5b6ef0'], [0.32, '#8b9cf7'], [0.62, '#ffc7e0'], [1, '#ffe9c2']];
    case 'illegal':
      return [[0, '#2a0f3d'], [0.35, '#5b1e56'], [0.66, '#b73a5a'], [1, '#ff9a3d']];
    case 'star':
      return [[0, '#0a0620'], [0.42, '#1d0b45'], [0.75, '#3d1466'], [1, '#6a2b8f']];
    default:
      return [[0, '#1f8fd6'], [0.4, '#57d5e8'], [0.75, '#bdf2d8'], [1, '#e7ffd0']];
  }
}

// -------------------------------------------------------------------- sky
export function drawSky(ctx, w, h, regionId, t, quality = 1) {
  skyGradient(ctx, w, h, regionStops(regionId));

  if (regionId === 'star') {
    // nebula blooms
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const cx = w * (0.18 + i * 0.24) + Math.sin(t * 0.1 + i) * 30;
      const cy = h * (0.22 + hash(i + 3) * 0.4);
      const r = h * (0.3 + hash(i + 7) * 0.25);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, hexA(['#c58bff', '#4a7dff', '#ff5ea8', '#7ee8ff'][i], 0.20));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
  if (regionId === 'illegal') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(w * 0.72, h * 0.7, 0, w * 0.72, h * 0.7, h * 0.8);
    g.addColorStop(0, 'rgba(255,154,61,0.30)');
    g.addColorStop(1, 'rgba(255,154,61,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

/** Stars fixed to the sky (screen space) with a slow twinkle. */
export function drawStars(ctx, w, h, t, alpha = 1) {
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const x = hash(i * 1.7) * w;
    const y = hash(i * 3.1 + 5) * h * 0.85;
    const s = 0.6 + hash(i * 5.3) * 2.2;
    const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.6 + hash(i) * 1.4) + i));
    ctx.globalAlpha = tw * alpha;
    ctx.fillStyle = i % 7 === 0 ? '#ffd93b' : i % 5 === 0 ? '#7ee8ff' : '#ffffff';
    starPath(ctx, x, y, s * 1.6, i, 4, 0.35);
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------- parallax props
/**
 * Infinite, index-based parallax.
 *
 * Scenery positions are generated from integer indices (`hash(i)`), so the sky
 * never runs out of clouds no matter how far the experiment flies — and the
 * layers stay stable instead of jittering on modulo wrap-around.
 */
function parallaxLayer(ctx, cam, w, h, regionId, t, f, yf, draw) {
  const halfW = w / cam.zoom / 2;
  const halfH = h / cam.zoom / 2;
  const originX = cam.x * f;
  const oy = clamp(-cam.y * f * cam.zoom * yf, -h * 0.5, h * 0.5);
  ctx.save();
  ctx.translate(w / 2, h / 2 + oy);
  ctx.scale(cam.zoom, cam.zoom);
  draw(ctx, originX, halfW, halfH, regionId, t);
  ctx.restore();
}

export function drawParallax(ctx, cam, w, h, regionId, t, parallax = 1) {
  parallaxLayer(ctx, cam, w, h, regionId, t, 0.06, 0.24, drawFarLayer);
  parallaxLayer(ctx, cam, w, h, regionId, t, 0.18, 0.5, drawMidLayer);
  if (parallax >= 0.7) parallaxLayer(ctx, cam, w, h, regionId, t, 0.36, 0.78, drawNearLayer);
}

function drawPlanet(ctx, x, y, r, colours, ring = false, rot = 0) {
  if (ring) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1, 0.24);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.72, 0, Math.PI * 2);
    ctx.lineWidth = r * 0.3;
    ctx.strokeStyle = hexA(colours[2], 0.6);
    ctx.stroke();
    ctx.restore();
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, colours[0]);
  g.addColorStop(0.62, colours[1]);
  g.addColorStop(1, colours[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // bands + terminator shadow for a bit of planet character
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = colours[2];
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y + i * r * 0.34, r * 0.92, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  const sh = ctx.createRadialGradient(x + r * 0.45, y + r * 0.35, r * 0.2, x + r * 0.2, y + r * 0.2, r * 1.15);
  sh.addColorStop(0, 'rgba(10,4,24,0)');
  sh.addColorStop(1, 'rgba(10,4,24,0.55)');
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Iterate scenery indices covering the visible band (plus margin). */
function forIndices(originX, halfW, spacing, fn) {
  const i0 = Math.floor((originX - halfW * 1.35) / spacing);
  const i1 = Math.ceil((originX + halfW * 1.35) / spacing);
  for (let i = i0; i <= i1; i++) fn(i, i * spacing - originX);
}

/** Vertical band position for a scenery item, in layer space. */
function bandY(i, halfH, spread = 1) {
  return (hash(i * 1.73 + 0.31) - 0.5) * halfH * 1.5 * spread;
}

function drawFarLayer(ctx, originX, halfW, halfH, regionId, t) {
  if (regionId === 'star') {
    const drift = (originX * 0.02) % (halfW * 3.2);
    drawPlanet(ctx, -halfW * 1.5 - drift, -halfH * 0.7, 250, ['#ffd98a', '#ff9a3d', '#c1481f'], true, -0.35);
    drawPlanet(ctx, halfW * 0.9 - drift, -halfH * 0.95, 150, ['#bff7ff', '#4a9fd8', '#1b3f7a']);
    drawPlanet(ctx, halfW * 0.1 - drift * 0.6, halfH * 0.75, 95, ['#e9d5ff', '#a855f7', '#4c1d95']);
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.rotate(-0.18);
    const g = ctx.createLinearGradient(-halfW * 1.4, 0, halfW * 1.4, 0);
    g.addColorStop(0, 'rgba(197,139,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(126,232,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-halfW * 1.4, -halfH * 1.2, halfW * 2.8, 130);
    ctx.restore();
    forIndices(originX, halfW, 700, (i, x) => {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.translate(x, bandY(i, halfH, 0.8));
      ctx.rotate(hash(i * 3.1) * 6);
      drawSatellite(ctx, 0, 0, 0.62 + hash(i) * 0.3);
      ctx.restore();
    });
  } else if (regionId === 'illegal') {
    forIndices(originX, halfW, 340, (i, x) => {
      const hh = 200 + hash(i + 2) * 300;
      const baseY = halfH * 0.9;
      ctx.fillStyle = hexA('#2a1040', 0.7);
      ctx.fillRect(x, baseY - hh, 150 + hash(i + 4) * 80, hh);
      ctx.fillStyle = hexA('#ff9a3d', 0.32);
      for (let k = 0; k < 5; k++) ctx.fillRect(x + 20 + k * 26, baseY - hh + 30 + k * 26, 12, 8);
      ctx.fillStyle = hexA('#3a2050', 0.3);
      ctx.beginPath();
      ctx.arc(x + 70, baseY - hh - 40, 60 + Math.sin(t + i) * 10, 0, Math.PI * 2);
      ctx.fill();
    });
    forIndices(originX * 1.2, halfW, 520, (i, x) => {
      drawCloud(ctx, x, bandY(i + 40, halfH, 0.9), 120, hexA('#ff9a9a', 0.16));
    });
  } else if (regionId === 'clouds') {
    forIndices(originX, halfW, 460, (i, x) => {
      const s = 150 + hash(i + 1) * 90;
      drawCloud(ctx, x + Math.sin(t * 0.12 + i) * 16, bandY(i, halfH, 0.9) - halfH * 0.35, s, hexA('#ffffff', 0.24));
    });
    forIndices(originX * 1.15, halfW, 520, (i, x) => {
      const s = 170 + hash(i) * 80;
      drawCloud(ctx, x, bandY(i + 17, halfH, 0.9) + halfH * 0.7, s, hexA('#ffe3f0', 0.26));
    });
  } else if (regionId === 'wilds') {
    for (let pass = 0; pass < 2; pass++) {
      const f = pass ? 1.25 : 1;
      forIndices(originX * f, halfW * f, 420, (i, x) => {
        const hh = 240 + hash(i * 1.3 + pass) * 280;
        ctx.fillStyle = hexA(pass ? '#1b8a8b' : '#2fa39a', pass ? 0.32 : 0.2);
        ctx.beginPath();
        ctx.moveTo(x - 420, halfH * 1.0);
        ctx.quadraticCurveTo(x, halfH * 1.0 - hh, x + 420, halfH * 1.0);
        ctx.closePath();
        ctx.fill();
      });
    }
    forIndices(originX * 1.1, halfW, 400, (i, x) => {
      drawCloud(ctx, x, bandY(i, halfH, 0.85) - halfH * 0.4, 110 + hash(i + 3) * 70, hexA('#ffffff', 0.36));
    });
  } else {
    // LAB: big warm sun, layered teal hills, fat cartoon clouds
    const g = ctx.createRadialGradient(halfW * 0.65, -halfH * 0.6, 0, halfW * 0.65, -halfH * 0.6, 480);
    g.addColorStop(0, 'rgba(255,246,180,0.95)');
    g.addColorStop(0.35, 'rgba(255,214,90,0.5)');
    g.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-halfW * 1.4, -halfH * 1.6, halfW * 2.8, halfH * 3.2);
    for (let pass = 0; pass < 2; pass++) {
      forIndices(originX * (pass ? 1.3 : 1), halfW, 520, (i, x) => {
        ctx.fillStyle = hexA(pass ? '#249b93' : '#37b0a6', pass ? 0.34 : 0.24);
        ctx.beginPath();
        ctx.moveTo(x - 400, halfH * 1.05);
        ctx.quadraticCurveTo(x, halfH * 1.05 - 300 - hash(i + pass * 7) * 150, x + 400, halfH * 1.05);
        ctx.closePath();
        ctx.fill();
      });
    }
    forIndices(originX * 1.2, halfW, 480, (i, x) => {
      drawCloud(ctx, x, bandY(i + 5, halfH, 0.85) - halfH * 0.35, 140 + hash(i) * 80, hexA('#ffffff', 0.42));
    });
  }
}

function drawCloud(ctx, x, y, s, colour) {
  ctx.save();
  // shaded underside first, then the bright body — reads as volume, not a blob
  ctx.fillStyle = colour.replace(/rgba\(([^)]+)\)/, 'rgba(120,150,220,0.34)');
  ctx.beginPath();
  ctx.arc(x, y + s * 0.14, s * 0.56, 0, Math.PI * 2);
  ctx.arc(x + s * 0.55, y + s * 0.22, s * 0.43, 0, Math.PI * 2);
  ctx.arc(x - s * 0.5, y + s * 0.26, s * 0.39, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
  ctx.arc(x + s * 0.55, y + s * 0.08, s * 0.42, 0, Math.PI * 2);
  ctx.arc(x - s * 0.5, y + s * 0.12, s * 0.38, 0, Math.PI * 2);
  ctx.arc(x + s * 0.1, y - s * 0.3, s * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Little platforms that make pads feel like they belong to the world. */
export function drawPadSupport(ctx, pad, regionId, t) {
  if (pad.rescue) return;
  const x = pad.x;
  const y = pad.y;
  ctx.save();
  if (regionId === 'clouds') {
    drawCloud(ctx, x, y + 46, 150, 'rgba(255,255,255,0.92)');
    drawCloud(ctx, x - 60, y + 70, 90, 'rgba(240,248,255,0.8)');
    drawCloud(ctx, x + 70, y + 76, 80, 'rgba(240,248,255,0.75)');
  } else if (regionId === 'star') {
    ctx.save();
    ctx.translate(x, y + 40);
    inked(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-110, 0);
      ctx.quadraticCurveTo(-70, 70, 0, 104);
      ctx.quadraticCurveTo(70, 70, 110, 0);
      ctx.closePath();
    }, linear(ctx, -60, 0, 60, 100, [[0, '#4c2a80'], [1, '#1b0f33']]), { stroke: PAL.ink, width: 5 });
    inked(ctx, () => ellipse(ctx, 0, 0, 112, 22), linear(ctx, -110, -10, 110, 18, [[0, '#7c4dc0'], [1, '#3b1f6b']]), { stroke: PAL.ink, width: 5 });
    for (let i = 0; i < 3; i++) fillPath(ctx, () => ellipse(ctx, -50 + i * 50, 6, 10 + i * 3, 4), hexA('#c58bff', 0.5));
    ctx.restore();
  } else if (regionId === 'illegal') {
    ctx.save();
    ctx.translate(x, y + 34);
    inked(ctx, () => rr(ctx, -120, 0, 240, 26, 8), linear(ctx, 0, 0, 0, 26, [[0, '#8b9bb5'], [1, '#4b5872']]), { stroke: PAL.ink, width: 4 });
    strokePath(ctx, () => {
      ctx.beginPath();
      for (let i = -5; i <= 5; i++) {
        ctx.moveTo(i * 22, 4);
        ctx.lineTo(i * 22 + 10, 22);
      }
    }, hexA('#ffb020', 0.75), 3);
    for (const side of [-1, 1]) {
      inked(ctx, () => rr(ctx, side * 96 - 26, 22, 52, 34, 6), '#3a4560', { stroke: PAL.ink, width: 3 });
      fillPath(ctx, () => ellipse(ctx, side * 96, 40, 9, 9), hexA('#ff8a3d', 0.6 + Math.sin(t * 5 + side) * 0.3));
    }
    ctx.restore();
  } else if (regionId === 'wilds') {
    ctx.save();
    ctx.translate(x, y + 30);
    inked(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-105, 6);
      ctx.quadraticCurveTo(0, 54, 105, 6);
      ctx.quadraticCurveTo(60, -16, 0, -10);
      ctx.quadraticCurveTo(-60, -16, -105, 6);
      ctx.closePath();
    }, linear(ctx, 0, -10, 0, 54, [[0, '#7fe33f'], [0.4, '#3f8a1f'], [1, '#22401a']]), { stroke: PAL.ink, width: 5 });
    for (let i = 0; i < 3; i++) {
      inked(ctx, () => rr(ctx, -70 + i * 62, 2, 9, 18, 4), '#fff4d6', { stroke: PAL.ink, width: 2.4 });
      inked(ctx, () => ellipse(ctx, -66 + i * 62, 0, 12, 7), i % 2 ? '#ffb4d4' : '#ff9ad5', { stroke: PAL.ink, width: 2.4 });
    }
    ctx.restore();
  } else {
    // lab: timber scaffold + bolts
    ctx.save();
    ctx.translate(x, y + 26);
    inked(ctx, () => rr(ctx, -118, 0, 236, 20, 6), linear(ctx, 0, 0, 0, 20, [[0, '#c9a06a'], [1, '#8a5a33']]), { stroke: PAL.ink, width: 4 });
    for (const side of [-1, 1]) {
      inked(ctx, () => rr(ctx, side * 96 - 8, 14, 16, 44, 4), '#7a4321', { stroke: PAL.ink, width: 3 });
      fillPath(ctx, () => ellipse(ctx, side * 96, 34, 4, 4), '#ffd93b');
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawMidLayer(ctx, originX, halfW, halfH, regionId, t) {
  if (regionId === 'star') {
    forIndices(originX, halfW, 900, (i, x) => {
      drawIsland(ctx, x, bandY(i, halfH, 0.8), 0.9 + hash(i) * 0.6, t + i, '#3b2a6b', '#5a3fa0');
    });
    forIndices(originX * 1.2, halfW, 1100, (i, x) => {
      ctx.save();
      ctx.translate(x, bandY(i + 7, halfH, 0.7) - 60);
      ctx.rotate(hash(i) * 6);
      drawSatellite(ctx, 0, 0, 1.05);
      ctx.restore();
    });
  } else if (regionId === 'clouds') {
    forIndices(originX, halfW, 620, (i, x) => {
      drawCloud(ctx, x + Math.sin(t * 0.2 + i) * 24, bandY(i, halfH, 0.85), 160, hexA('#ffffff', 0.4));
    });
    forIndices(originX * 1.3, halfW, 1500, (i, x) => {
      drawAirship(ctx, x, bandY(i + 3, halfH, 0.6) - 40, 0.95, t + i);
    });
  } else if (regionId === 'illegal') {
    forIndices(originX, halfW, 820, (i, x) => {
      const y = bandY(i, halfH, 0.8);
      drawIsland(ctx, x, y, 0.85 + hash(i + 1) * 0.5, t + i, '#4a2340', '#6b3050');
      drawRobot(ctx, x + 170, y - 150, 0.9, t + i);
    });
    forIndices(originX * 1.2, halfW, 700, (i, x) => {
      ctx.save();
      ctx.globalAlpha = 0.45;
      drawCloud(ctx, x, bandY(i + 5, halfH, 0.8) + 120, 130, hexA('#ff9a9a', 0.3));
      ctx.restore();
    });
  } else if (regionId === 'wilds') {
    forIndices(originX, halfW, 660, (i, x) => {
      const y = bandY(i, halfH, 0.8);
      drawIsland(ctx, x, y, 0.8 + hash(i + 2) * 0.5, t + i, '#2f7a4a', '#7fe33f');
      if (i % 2 === 0) drawBalloon(ctx, x + 190, y - 200, 0.85, t + i);
    });
    forIndices(originX * 1.3, halfW, 1000, (i, x) => {
      ctx.save();
      ctx.translate(x, bandY(i + 4, halfH, 0.7));
      drawWindmill(ctx, t + i);
      ctx.restore();
    });
    forIndices(originX * 1.1, halfW, 720, (i, x) => {
      drawCloud(ctx, x, bandY(i + 9, halfH, 0.85), 150, hexA('#ffffff', 0.42));
    });
  } else {
    forIndices(originX, halfW, 900, (i, x) => {
      drawDistantLab(ctx, x, bandY(i, halfH, 0.6) + halfH * 0.3, 0.9 + hash(i) * 0.4, t + i);
    });
    forIndices(originX * 1.15, halfW, 620, (i, x) => {
      drawCloud(ctx, x, bandY(i + 6, halfH, 0.8) - 120, 130, hexA('#ffffff', 0.42));
    });
  }
}

function drawNearLayer(ctx, originX, halfW, halfH, regionId, t) {
  if (regionId === 'wilds' || regionId === 'lab') {
    forIndices(originX, halfW, 620, (i, x) => {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = regionId === 'lab' ? '#2a9e86' : '#2b8f5c';
      ellipse(ctx, x, halfH * 0.95 + hash(i) * 60, 230, 95);
      ctx.fill();
      ctx.restore();
    });
  }
  if (regionId === 'clouds') {
    forIndices(originX, halfW, 560, (i, x) => {
      drawCloud(ctx, x, halfH * 0.6 + hash(i) * 100, 130, hexA('#c9ecff', 0.42));
    });
  }
  if (regionId === 'illegal' || regionId === 'star') {
    forIndices(originX, halfW, 700, (i, x) => {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#120a22';
      ctx.beginPath();
      ctx.moveTo(x - 200, halfH * 1.3);
      ctx.lineTo(x - 70, halfH * 0.5);
      ctx.lineTo(x + 40, halfH * 0.68);
      ctx.lineTo(x + 210, halfH * 1.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }
}

function drawIsland(ctx, x, y, s, t, rockColour, grassColour) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.6) * 8);
  ctx.scale(s, s);
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-120, 0);
    ctx.quadraticCurveTo(-90, 90, 0, 140);
    ctx.quadraticCurveTo(90, 90, 120, 0);
    ctx.closePath();
  }, linear(ctx, -60, 0, 60, 140, [[0, rockColour], [1, shade(rockColour, -0.16)]]), { stroke: PAL.ink, width: 5 });
  inked(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 124, 26, 0, 0, Math.PI * 2);
  }, linear(ctx, -120, -10, 120, 20, [[0, '#8ee84a'], [1, grassColour || '#4d9e28']]), { stroke: PAL.ink, width: 5 });
  // tiny trees
  for (let i = -1; i <= 1; i++) {
    inked(ctx, () => rr(ctx, i * 46 - 5, -34, 10, 34, 4), '#7a4321', { stroke: PAL.ink, width: 3 });
    inked(ctx, () => ellipse(ctx, i * 46, -46, 22, 20), '#5ec13a', { stroke: PAL.ink, width: 3 });
  }
  ctx.restore();
}

function drawBalloon(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.8) * 12);
  ctx.scale(s, s);
  inked(ctx, () => {
    ctx.beginPath();
    ctx.arc(0, 0, 44, Math.PI, 0);
    ctx.quadraticCurveTo(0, 18, -44, 0);
    ctx.closePath();
  }, linear(ctx, -40, -40, 40, 10, [[0, '#ff9ad5'], [0.6, '#ffd93b'], [1, '#ff8a3d']]), { stroke: PAL.ink, width: 4 });
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-14, 12);
    ctx.lineTo(-14, 22);
    ctx.moveTo(14, 12);
    ctx.lineTo(14, 22);
  }, PAL.ink, 2.4);
  inked(ctx, () => rr(ctx, -18, 18, 36, 24, 6), '#b06f35', { stroke: PAL.ink, width: 3.4 });
  ctx.restore();
}

function drawAirship(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.7) * 10);
  ctx.scale(s, s);
  inked(ctx, () => ellipse(ctx, 0, 0, 80, 32), linear(ctx, -80, -20, 80, 20, [[0, '#e3ebf7'], [1, '#8b9bb5']]), { stroke: PAL.ink, width: 4 });
  inked(ctx, () => rr(ctx, -26, 22, 52, 26, 8), '#b06f35', { stroke: PAL.ink, width: 3.4 });
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-20, 10);
    ctx.lineTo(-16, 24);
    ctx.moveTo(20, 10);
    ctx.lineTo(16, 24);
  }, PAL.ink, 2.4);
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-78, -4);
    ctx.lineTo(-104, -18);
    ctx.lineTo(-100, 6);
    ctx.closePath();
  }, '#ff4d6d', { stroke: PAL.ink, width: 3 });
  ctx.restore();
}

function drawWindmill(ctx, t) {
  inked(ctx, () => rr(ctx, -10, -60, 20, 100, 6), '#d9cbb8', { stroke: PAL.ink, width: 3.4 });
  ctx.save();
  ctx.translate(0, -60);
  ctx.rotate(t * 0.8);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    inked(ctx, () => rr(ctx, -4, -6, 8, -56, 4), '#fff4d6', { stroke: PAL.ink, width: 2.4 });
    ctx.restore();
  }
  ctx.restore();
}

function drawDistantLab(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  inked(ctx, () => rr(ctx, -90, -110, 180, 130, 10), '#c9a06a', { stroke: PAL.ink, width: 4 });
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-110, -110);
    ctx.lineTo(0, -170);
    ctx.lineTo(110, -110);
    ctx.closePath();
  }, '#8a5a33', { stroke: PAL.ink, width: 4 });
  inked(ctx, () => rr(ctx, -60, -80, 44, 44, 6), '#7ee8ff', { stroke: PAL.ink, width: 3 });
  inked(ctx, () => rr(ctx, 16, -80, 44, 44, 6), '#ffe86b', { stroke: PAL.ink, width: 3 });
  // radar dish
  ctx.save();
  ctx.translate(60, -120);
  ctx.rotate(Math.sin(t * 0.4) * 0.4);
  inked(ctx, () => {
    ctx.beginPath();
    ctx.arc(0, 0, 22, Math.PI * 1.15, Math.PI * 1.85);
    ctx.closePath();
  }, '#d9e6f7', { stroke: PAL.ink, width: 3 });
  ctx.restore();
  ctx.restore();
}

function drawSatellite(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  inked(ctx, () => rr(ctx, -16, -14, 32, 28, 5), '#c9d6e8', { stroke: PAL.ink, width: 3 });
  for (const side of [-1, 1]) {
    inked(ctx, () => rr(ctx, side > 0 ? 18 : -52, -12, 34, 24, 3), linear(ctx, 0, -12, 0, 12, [[0, '#4a7dff'], [1, '#1d3f8a']]), { stroke: PAL.ink, width: 2.6 });
    strokePath(ctx, () => {
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        ctx.moveTo(side > 0 ? 18 + i * 11 : -52 + i * 11, -12);
        ctx.lineTo(side > 0 ? 18 + i * 11 : -52 + i * 11, 12);
      }
    }, PAL.ink, 1.6);
  }
  inked(ctx, () => {
    ctx.beginPath();
    ctx.arc(0, -22, 12, Math.PI, 0);
    ctx.closePath();
  }, '#e3ebf7', { stroke: PAL.ink, width: 2.6 });
  ctx.restore();
}

function drawRobot(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.4) * 10);
  ctx.scale(s, s);
  inked(ctx, () => rr(ctx, -22, -22, 44, 44, 8), linear(ctx, -22, -22, 22, 22, [[0, '#e3ebf7'], [1, '#8494b0']]), { stroke: PAL.ink, width: 3.4 });
  fillPath(ctx, () => rr(ctx, -14, -10, 28, 14, 4), '#7ee8ff');
  for (const side of [-1, 1]) {
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(side * 20, 0);
      ctx.lineTo(side * 34, 10 + Math.sin(t * 4) * 4);
    }, '#8494b0', 4);
    inked(ctx, () => ellipse(ctx, side * 34, 8, 6, 8), '#c9d6e8', { stroke: PAL.ink, width: 2.4 });
  }
  inked(ctx, () => rr(ctx, -6, 24, 12, 10, 3), '#8494b0', { stroke: PAL.ink, width: 2.4 });
  ctx.restore();
}

// ------------------------------------------------------------------ floor
export function floorStyle(regionId) {
  switch (regionId) {
    case 'wilds':
      return { rock: '#2b6b46', rockDark: '#17402c', glow: '#9ff7a0', top: '#5ec13a', hazard: '#b6ff6a' };
    case 'clouds':
      return { rock: '#3a3d78', rockDark: '#22224d', glow: '#7ee8ff', top: '#8fb6ff', hazard: '#bff7ff' };
    case 'illegal':
      return { rock: '#3d1f3a', rockDark: '#241024', glow: '#ff9a3d', top: '#6b3050', hazard: '#ffd93b' };
    case 'star':
      return { rock: '#1b0f33', rockDark: '#0d061d', glow: '#c58bff', top: '#4c2a80', hazard: '#ff9ad5' };
    default:
      return { rock: '#7a5a3a', rockDark: '#4a3324', glow: '#ffb020', top: '#5ec13a', hazard: '#ffd93b' };
  }
}

export function drawFloor(ctx, cam, world, t, regionId, quality = 1) {
  const style = floorStyle(regionId);
  const left = cam.x - cam.vw / 2 - 200;
  const right = cam.x + cam.vw / 2 + 400;
  const step = 70;
  const x0 = Math.floor(left / step) * step;
  const dangerPts = [];
  const bodyPts = [];

  for (let x = x0; x <= right; x += step) {
    const y = world.floorAt(x);
    dangerPts.push([x, y]);
    bodyPts.push([x, y + 1400]);
  }

  // hazard glow band
  ctx.save();
  const grad = ctx.createLinearGradient(0, dangerPts[0][1] - 160, 0, dangerPts[0][1] + 420);
  grad.addColorStop(0, hexA(style.glow, 0));
  grad.addColorStop(0.45, hexA(style.glow, 0.22));
  grad.addColorStop(1, hexA(style.glow, 0.02));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(dangerPts[0][0], dangerPts[0][1] - 200);
  for (const [x, y] of dangerPts) ctx.lineTo(x, y - 200);
  for (let i = dangerPts.length - 1; i >= 0; i--) ctx.lineTo(dangerPts[i][0], dangerPts[i][1] + 500);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // rock body
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(bodyPts[0][0], bodyPts[0][1]);
    for (const [x, y] of bodyPts) ctx.lineTo(x, y);
    for (let i = dangerPts.length - 1; i >= 0; i--) ctx.lineTo(dangerPts[i][0], dangerPts[i][1]);
    ctx.closePath();
  }, linear(ctx, 0, dangerPts[0][1] - 60, 0, dangerPts[0][1] + 900, [[0, style.top], [0.18, style.rock], [1, style.rockDark]]), { stroke: PAL.ink, width: 6 });

  // hazard teeth / spikes
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dangerPts[0][0], dangerPts[0][1]);
  for (const [x, y] of dangerPts) ctx.lineTo(x, y);
  for (let i = dangerPts.length - 1; i >= 0; i--) ctx.lineTo(dangerPts[i][0], dangerPts[i][1] - 26);
  ctx.closePath();
  ctx.fillStyle = style.top;
  ctx.fill();
  ctx.restore();

  const spikeEvery = 64;
  for (let x = Math.floor(left / spikeEvery) * spikeEvery; x < right; x += spikeEvery) {
    const y = world.floorAt(x);
    const hgt = 22 + hash(x * 0.01) * 18;
    inked(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x - 16, y + 4);
      ctx.lineTo(x, y - hgt);
      ctx.lineTo(x + 16, y + 4);
      ctx.closePath();
    }, linear(ctx, x, y - hgt, x, y, [[0, '#ffffff'], [0.4, style.hazard], [1, style.rock]]), { stroke: PAL.ink, width: 2.4 });
  }

  // glowing seam line
  strokePath(ctx, () => {
    ctx.beginPath();
    for (let i = 0; i < dangerPts.length; i++) {
      const [x, y] = dangerPts[i];
      if (i === 0) ctx.moveTo(x, y - 6);
      else ctx.lineTo(x, y - 6);
    }
  }, hexA(style.glow, 0.55 + Math.sin(t * 3) * 0.12), 3);
}

// --------------------------------------------------------------- decor props
export function drawDecor(ctx, cam, world, t, quality) {
  const visible = world.chunksNear(cam.x, 2, 2);
  const pad = 400;
  for (const chunk of visible) {
    for (const d of chunk.decor) {
      if (d.x < cam.x - cam.vw / 2 - pad || d.x > cam.x + cam.vw / 2 + pad) continue;
      drawDecorProp(ctx, d, t, quality);
    }
  }
}

function drawDecorProp(ctx, d, t, quality) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.s, d.s);
  switch (d.type) {
    case 'cloud':
      drawCloud(ctx, 0, 0, 90, hexA('#ffffff', 0.42));
      break;
    case 'gear': {
      ctx.rotate(t * 0.18 + d.phase);
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 10; i++) {
        ctx.save();
        ctx.rotate((i / 10) * Math.PI * 2);
        inked(ctx, () => rr(ctx, -9, -70, 18, 26, 5), '#9a6b3d', { stroke: PAL.ink, width: 3 });
        ctx.restore();
      }
      inked(ctx, () => ellipse(ctx, 0, 0, 52, 52), linear(ctx, -50, -50, 50, 50, [[0, '#c9a06a'], [1, '#7a4321']]), { stroke: PAL.ink, width: 4 });
      inked(ctx, () => ellipse(ctx, 0, 0, 20, 20), '#4a2c19', { stroke: PAL.ink, width: 3 });
      ctx.restore();
      break;
    }
    case 'sign': {
      ctx.rotate(d.rot * 0.1);
      inked(ctx, () => rr(ctx, -8, 0, 16, 90, 4), '#7a4321', { stroke: PAL.ink, width: 3 });
      inked(ctx, () => rr(ctx, -64, -44, 128, 54, 8), '#c9a06a', { stroke: PAL.ink, width: 4 });
      bigText(ctx, 'CAUTION', 0, -26, 20, '#ff4d6d', { stroke: PAL.ink, strokeWidth: 4 });
      bigText(ctx, 'LAUNCH ZONE', 0, -8, 12, '#5b3521', { stroke: null, strokeWidth: 0 });
      break;
    }
    case 'pipe': {
      inked(ctx, () => rr(ctx, -18, -120, 36, 240, 10), linear(ctx, -18, 0, 18, 0, [[0, '#b9c6dd'], [0.5, '#e3ebf7'], [1, '#6b7a99']]), { stroke: PAL.ink, width: 3.4 });
      inked(ctx, () => rr(ctx, -26, -40, 52, 18, 6), '#8494b0', { stroke: PAL.ink, width: 3 });
      inked(ctx, () => rr(ctx, -26, 60, 52, 18, 6), '#8494b0', { stroke: PAL.ink, width: 3 });
      break;
    }
    case 'mushroom': {
      inked(ctx, () => rr(ctx, -14, -10, 28, 90, 10), '#fff4d6', { stroke: PAL.ink, width: 3.4 });
      inked(ctx, () => {
        ctx.beginPath();
        ctx.arc(0, -10, 66, Math.PI, 0);
        ctx.quadraticCurveTo(0, 20, -66, -10);
        ctx.closePath();
      }, linear(ctx, -60, -70, 60, 10, [[0, '#ffb4d4'], [1, '#d6337d']]), { stroke: PAL.ink, width: 4 });
      for (const [sx, sy, sr] of [[-30, -34, 9], [10, -44, 7], [34, -26, 8]]) {
        fillPath(ctx, () => ellipse(ctx, sx, sy, sr, sr * 0.8), '#fff0f6', 0.9);
      }
      break;
    }
    case 'balloon':
      drawBalloon(ctx, 0, Math.sin(t * 0.6 + d.phase) * 10, 0.8, t + d.phase);
      break;
    case 'island': {
      ctx.save();
      ctx.globalAlpha = 0.9;
      drawIsland(ctx, 0, 0, 0.7, t + d.phase, '#3b2a6b', '#7fe33f');
      ctx.restore();
      break;
    }
    case 'airship':
      ctx.save();
      ctx.globalAlpha = 0.9;
      drawAirship(ctx, 0, 0, 0.8, t + d.phase);
      ctx.restore();
      break;
    case 'station': {
      inked(ctx, () => rr(ctx, -70, -40, 140, 80, 14), '#8494b0', { stroke: PAL.ink, width: 4 });
      inked(ctx, () => rr(ctx, -46, -20, 40, 30, 6), '#7ee8ff', { stroke: PAL.ink, width: 3 });
      fillPath(ctx, () => rr(ctx, 10, -20, 40, 30, 6), '#ffd93b');
      for (let i = 0; i < 3; i++) inked(ctx, () => ellipse(ctx, -40 + i * 26, 34, 6, 6), '#ff4d6d', { stroke: PAL.ink, width: 2 });
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#8494b0';
      ctx.fillRect(-96, -6, 26, 8);
      ctx.fillRect(70, -6, 26, 8);
      ctx.restore();
      break;
    }
    case 'robot':
      drawRobot(ctx, 0, 0, 0.8, t + d.phase);
      break;
    case 'asteroid': {
      ctx.rotate(d.rot + t * 0.05);
      for (let i = 0; i < 3; i++) {
        const a = d.phase + i * 2.1;
        inked(ctx, () => {
          ctx.beginPath();
          const r0 = 30 + hash(i + d.phase) * 20;
          for (let k = 0; k < 7; k++) {
            const ang = (k / 7) * Math.PI * 2;
            const rr2 = r0 * (0.75 + hash(k + i) * 0.5);
            const px = Math.cos(ang) * rr2 + Math.cos(a) * 50;
            const py = Math.sin(ang) * rr2 + Math.sin(a) * 40;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
        }, linear(ctx, -50, -40, 50, 40, [[0, '#6b5a7a'], [1, '#2b2138']]), { stroke: PAL.ink, width: 3 });
      }
      break;
    }
    case 'satellite':
      drawSatellite(ctx, 0, 0, 1);
      break;
    case 'star': {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(t * 2 + d.phase) * 0.2;
      glowDot(ctx, 0, 0, 60, '#ffd93b', 0.5);
      ctx.restore();
      inked(ctx, () => starPath(ctx, 0, 0, 18, t * 0.4 + d.phase, 5, 0.45), '#fff6c9', { stroke: '#ffb020', width: 2.4, glow: '#ffd93b' });
      break;
    }
    case 'fg': {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#0d1a16';
      ctx.beginPath();
      ctx.ellipse(0, 40, 120, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// --------------------------------------------------------------- gameplay objs
export function drawPad(ctx, pad, t) {
  const def = ITEM_DEFS[pad.id];
  ctx.save();
  ctx.translate(pad.x, pad.y);
  ctx.rotate(pad.angle || 0);
  const w = pad.w;
  if (pad.id === 'safetyNet') {
    drawItemArt(ctx, 'safetyNet', t, { scale: w / 440 });
    ctx.restore();
    return;
  }
  if (pad.id === 'spring') {
    const compress = 0.9 + Math.sin(t * 2 + pad.x * 0.001) * 0.06;
    ctx.scale(w / 68, compress);
    drawItemArt(ctx, 'spring', t, { scale: 1 });
    ctx.restore();
    // catch field hint
    ctx.save();
    ctx.globalAlpha = 0.12;
    fillPath(ctx, () => rr(ctx, pad.x - w / 2, pad.y + 6, w, (pad.catch || 120) * 0.8, 12), PAL.yellow);
    ctx.restore();
    return;
  }
  if (pad.id === 'mushroom') {
    ctx.scale(w / 64, 1);
    drawItemArt(ctx, 'mushroom', t, { scale: 1 });
    ctx.restore();
    return;
  }
  if (pad.id === 'ice') {
    ctx.scale(w / 92, 1);
    drawItemArt(ctx, 'ice', t, { scale: 1 });
    ctx.restore();
    return;
  }
  ctx.scale(w / 68, 1);
  drawItemArt(ctx, def.id, t, { scale: 1 });
  ctx.restore();
}

export function drawZones(ctx, zones, t) {
  for (const z of zones) {
    const def = ITEM_DEFS[z.id];
    ctx.save();
    ctx.translate(z.x, z.y);
    const halfH = (def.height || 600) / 2;
    const halfW = (def.width || 160) / 2;
    ctx.save();
    ctx.globalAlpha = 0.16 + Math.sin(t * 3) * 0.03;
    const g = ctx.createLinearGradient(0, -halfH, 0, halfH);
    g.addColorStop(0, hexA(def.colour, 0.1));
    g.addColorStop(0.5, hexA(def.colour, 0.5));
    g.addColorStop(1, hexA(def.colour, 0.1));
    ctx.fillStyle = g;
    rr(ctx, -halfW, -halfH, halfW * 2, halfH * 2, 40);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const ph = ((t * 0.55 + i / 5) % 1);
      const y = halfH - ph * halfH * 2;
      ctx.save();
      ctx.globalAlpha = 0.35 * (1 - Math.abs(ph - 0.5) * 1.4);
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-halfW + 14, y);
        ctx.quadraticCurveTo(0, y + 26, halfW - 14, y);
      }, def.colour, 4);
      ctx.restore();
    }
    // vents
    for (const side of [-1, 1]) {
      inked(ctx, () => rr(ctx, side * halfW - 14, -14, 28, 28, 6), '#5b6a86', { stroke: PAL.ink, width: 3 });
      fillPath(ctx, () => ellipse(ctx, side * halfW, 0, 8, 8), hexA(def.colour, 0.8));
    }
    ctx.restore();
  }
}

export function drawLaunchSite(ctx, world, t, launched) {
  const x = LAUNCH.startX;
  const y = LAUNCH.startY;
  // lab shack (background)
  ctx.save();
  ctx.translate(x - 520, launchGround(world));
  ctx.scale(1.5, 1.5);
  inked(ctx, () => rr(ctx, -170, -230, 340, 240, 12), linear(ctx, -170, -230, 170, 10, [[0, '#c9a06a'], [1, '#9a7448']]), { stroke: PAL.ink, width: 5 });
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-200, -230);
    ctx.lineTo(0, -330);
    ctx.lineTo(200, -230);
    ctx.closePath();
  }, linear(ctx, -100, -330, 100, -230, [[0, '#b06f35'], [1, '#7a4321']]), { stroke: PAL.ink, width: 5 });
  // windows
  inked(ctx, () => rr(ctx, -120, -180, 90, 80, 8), '#7ee8ff', { stroke: PAL.ink, width: 4 });
  inked(ctx, () => rr(ctx, 20, -180, 90, 80, 8), '#ffe86b', { stroke: PAL.ink, width: 4 });
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-75, -180);
    ctx.lineTo(-75, -100);
    ctx.moveTo(65, -180);
    ctx.lineTo(65, -100);
  }, PAL.ink, 3);
  // sign
  inked(ctx, () => rr(ctx, -150, -70, 300, 54, 8), '#8a5a33', { stroke: PAL.ink, width: 4 });
  bigText(ctx, "PROF. FROG'S LAUNCH LAB", 0, -43, 22, '#ffe86b', { stroke: PAL.ink, strokeWidth: 5 });
  ctx.restore();

  // catapult machine
  ctx.save();
  ctx.translate(x - 40, y + 44);
  inked(ctx, () => rr(ctx, -96, 10, 192, 34, 10), '#5b6a86', { stroke: PAL.ink, width: 4 });
  inked(ctx, () => ellipse(ctx, -60, 44, 22, 14), '#3a4560', { stroke: PAL.ink, width: 3 });
  inked(ctx, () => ellipse(ctx, 60, 44, 22, 14), '#3a4560', { stroke: PAL.ink, width: 3 });
  // arm
  ctx.save();
  ctx.rotate(launched ? -0.5 : -0.18 - Math.sin(t * 3) * 0.02);
  inked(ctx, () => rr(ctx, -20, -46, 40, 70, 10), '#b9c6dd', { stroke: PAL.ink, width: 4 });
  inked(ctx, () => rr(ctx, -34, -58, 68, 24, 10), '#ff4d6d', { stroke: PAL.ink, width: 4 });
  ctx.restore();
  // spring
  for (let i = 0; i < 4; i++) {
    const yy = 8 - i * 5;
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-40, yy);
      ctx.lineTo(46, yy - 3);
    }, '#c9d6e8', 4);
  }
  // pressure gauge
  inked(ctx, () => ellipse(ctx, 74, -18, 18, 18), '#e3ebf7', { stroke: PAL.ink, width: 3.4 });
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(74, -18);
    ctx.lineTo(74 + Math.cos(-2 + t * 2) * 12, -18 + Math.sin(-2 + t * 2) * 12);
  }, '#ff4d6d', 3);
  ctx.restore();

  // warning flags + barrels
  for (let i = 0; i < 3; i++) {
    const bx = x - 300 + i * 46;
    inked(ctx, () => rr(ctx, bx, y + 150, 34, 44, 6), i % 2 ? '#ffd93b' : '#ff8a3d', { stroke: PAL.ink, width: 3 });
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(bx + 4, y + 166);
      ctx.lineTo(bx + 30, y + 166);
    }, PAL.ink, 3);
  }
  // "JUMP TEST. REPEAT." chalkboard
  ctx.save();
  ctx.translate(x - 900, y + 150);
  ctx.rotate(-0.04);
  inked(ctx, () => rr(ctx, -110, -90, 220, 120, 8), '#2d3a2a', { stroke: '#7a4321', width: 8 });
  bigText(ctx, 'JUMP', 0, -52, 26, '#e8ffe8', { stroke: null, strokeWidth: 0 });
  bigText(ctx, 'TEST. REPEAT.', 0, -18, 20, '#e8ffe8', { stroke: null, strokeWidth: 0 });
  bigText(ctx, 'SCIENCE!', 0, 14, 18, '#9ff7a0', { stroke: null, strokeWidth: 0 });
  ctx.restore();
}

function launchGround(world) {
  return world.floorAt(LAUNCH.startX - 400) - 2;
}
