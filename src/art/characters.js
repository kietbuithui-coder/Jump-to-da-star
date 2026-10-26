/**
 * Character art. Every creature is drawn with vector shapes and animated by
 * real state (squash & stretch, rotation, expression, limbs, equipment).
 * No emoji. No placeholder shapes. Silhouettes are designed to read at 60px.
 */
import { PAL, rr, ellipse, inked, fillPath, strokePath, shade, linear, radial, starPath, hexA } from './art.js';

const OUT = 4;
const OUTS = 3.2;

function eye(ctx, x, y, r, opts = {}) {
  const { look = 0, expr = 'happy', blink = 0, pupil = 1 } = opts;
  if (expr === 'dead') {
    // X eye
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y - r * 0.6);
      ctx.lineTo(x + r * 0.6, y + r * 0.6);
      ctx.moveTo(x + r * 0.6, y - r * 0.6);
      ctx.lineTo(x - r * 0.6, y + r * 0.6);
    }, PAL.ink, r * 0.5);
    return;
  }
  if (expr === 'ouch') {
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 0.2);
      ctx.lineTo(x, y + r * 0.5);
      ctx.lineTo(x + r * 0.7, y - r * 0.2);
    }, PAL.ink, r * 0.36);
    return;
  }
  inked(ctx, () => ellipse(ctx, x, y, r, r * (1 - blink * 0.92)), PAL.white, { width: OUTS });
  const pr = r * pupil * (expr === 'panic' ? 0.42 : 0.55);
  fillPath(ctx, () => ellipse(ctx, x + look * r * 0.35, y + r * 0.1, pr, pr), PAL.ink);
  fillPath(ctx, () => ellipse(ctx, x + look * r * 0.3 - pr * 0.3, y - pr * 0.35, pr * 0.4, pr * 0.4), PAL.white, 0.95);
}

function mouth(ctx, x, y, w, expr, colour = '#5b1f2e') {
  ctx.save();
  ctx.lineCap = 'round';
  if (expr === 'panic' || expr === 'dead') {
    inked(ctx, () => ellipse(ctx, x, y + w * 0.15, w * 0.5, w * 0.55), colour, { width: OUTS });
    fillPath(ctx, () => ellipse(ctx, x + w * 0.05, y + w * 0.5, w * 0.3, w * 0.2), '#ff7a9c');
  } else if (expr === 'excited') {
    inked(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.6, y);
      ctx.quadraticCurveTo(x, y + w * 0.9, x + w * 0.65, y - w * 0.1);
      ctx.quadraticCurveTo(x, y + w * 0.35, x - w * 0.6, y);
    }, colour, { width: OUTS });
    fillPath(ctx, () => ellipse(ctx, x, y + w * 0.45, w * 0.25, w * 0.15), '#ff7a9c');
  } else if (expr === 'ouch') {
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y + w * 0.2);
      ctx.quadraticCurveTo(x - w * 0.2, y - w * 0.2, x + w * 0.1, y + w * 0.2);
      ctx.quadraticCurveTo(x + w * 0.35, y + w * 0.5, x + w * 0.6, y);
    }, PAL.ink, OUTS);
  } else {
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.45, y);
      ctx.quadraticCurveTo(x, y + w * 0.5, x + w * 0.5, y - w * 0.05);
    }, PAL.ink, OUTS);
  }
  ctx.restore();
}

function blush(ctx, x, y, r, colour = '#ff8fa8') {
  ctx.save();
  ctx.globalAlpha = 0.4;
  fillPath(ctx, () => ellipse(ctx, x, y, r, r * 0.62), colour);
  ctx.restore();
}

function spring(ctx, x, y, len, w, coils, colour = '#c9d6e8') {
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < coils * 2; i++) {
      const t = (i + 1) / (coils * 2);
      ctx.lineTo(x + (i % 2 === 0 ? w : -w) * 0.5, y + len * t);
    }
  }, PAL.ink, 7.5);
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < coils * 2; i++) {
      const t = (i + 1) / (coils * 2);
      ctx.lineTo(x + (i % 2 === 0 ? w : -w) * 0.5, y + len * t);
    }
  }, colour, 4);
}

function goggles(ctx, x, y, r, strap = true) {
  if (strap) {
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x - r * 2.4, y + r * 0.2);
      ctx.quadraticCurveTo(x - r * 1.6, y - r * 0.5, x - r * 0.9, y);
    }, PAL.ink, r * 0.55);
  }
  inked(ctx, () => rr(ctx, x - r, y - r * 0.72, r * 2, r * 1.45, r * 0.45), '#8b5a2b', { width: OUTS });
  inked(ctx, () => ellipse(ctx, x, y, r * 0.72, r * 0.62), linear(ctx, x - r, y - r, x + r, y + r, [[0, '#ffe9a8'], [1, '#ffb020']]), { width: 2.4 });
  fillPath(ctx, () => ellipse(ctx, x - r * 0.25, y - r * 0.25, r * 0.22, r * 0.16), PAL.white, 0.8);
}

// ------------------------------------------------------------------- FROG
function drawFrog(ctx, s) {
  const t = s.t;
  const expr = s.expr;
  const springing = s.skill > 0.05;
  const puff = 1 + Math.sin(t * 4) * 0.02;
  ctx.save();
  ctx.scale(1.06 * puff, 1.02);

  // lab coat (behind)
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-20, -26);
    ctx.quadraticCurveTo(-52, -6, -48, 34);
    ctx.lineTo(-36, 44);
    ctx.quadraticCurveTo(-28, 22, -26, 44);
    ctx.lineTo(-14, 40);
    ctx.lineTo(-16, -20);
    ctx.closePath();
  }, linear(ctx, -50, 0, 0, 40, [[0, '#ffffff'], [1, '#e6e2d2']]), { width: OUT });

  // Coil legs compress on touchdown and extend as the jump takes off.
  // This is true frame-by-frame character animation, not only a screen flash.
  // legs
  const legLen = springing ? 46 : s.pose === 'land' ? 17 : s.pose === 'jump' || s.pose === 'boost' ? 46 : 30;
  const coilCount = springing ? 7 : 4;
  spring(ctx, -10, 24, legLen, springing ? 15 : 10, coilCount, springing ? '#c6f24e' : '#9fb98a');
  spring(ctx, 20, 24, legLen, springing ? 15 : 10, coilCount, springing ? '#c6f24e' : '#9fb98a');
  // flip flops
  inked(ctx, () => ellipse(ctx, -12, 24 + legLen + 4, 17, 8), '#4fd1c5', { width: OUTS });
  inked(ctx, () => ellipse(ctx, 22, 24 + legLen + 4, 17, 8), '#4fd1c5', { width: OUTS });
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-22, 22 + legLen);
    ctx.lineTo(-6, 22 + legLen);
    ctx.moveTo(12, 22 + legLen);
    ctx.lineTo(28, 22 + legLen);
  }, PAL.ink, 3);

  // experiment backpack
  inked(ctx, () => rr(ctx, -58, -34, 34, 52, 11), linear(ctx, -58, -34, -24, 18, [[0, '#8a5a33'], [1, '#5b3521']]), { width: OUT });
  inked(ctx, () => rr(ctx, -52, -26, 18, 26, 6), '#3f2a1a', { width: OUTS });
  fillPath(ctx, () => rr(ctx, -49, -22, 12, 16, 5), linear(ctx, -49, -22, -37, -6, [[0, '#c6f24e'], [1, '#4ade80']]));
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-50, -30);
    ctx.lineTo(-32, -6);
  }, PAL.ink, 3);
  fillPath(ctx, () => ellipse(ctx, -46, -30, 4, 4), PAL.greenLight);
  fillPath(ctx, () => ellipse(ctx, -36, -22, 3, 3), PAL.greenLight);

  // body
  inked(ctx, () => ellipse(ctx, 0, 6, 43, 37), linear(ctx, -30, -26, 26, 40, [[0, '#8ee84a'], [0.55, '#6fcf3a'], [1, '#4d9e28']]), { width: OUT });
  fillPath(ctx, () => ellipse(ctx, 8, 16, 27, 22), '#e8ffc4', 0.92);
  fillPath(ctx, () => ellipse(ctx, -16, -8, 12, 16), PAL.white, 0.12);

  // lab coat front flaps
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(8, -18);
    ctx.quadraticCurveTo(30, -6, 34, 30);
    ctx.lineTo(18, 34);
    ctx.quadraticCurveTo(16, 6, 4, -14);
    ctx.closePath();
  }, linear(ctx, 6, -18, 34, 30, [[0, '#fffdf5'], [1, '#e8e2cf']]), { width: OUT });
  fillPath(ctx, () => rr(ctx, 20, 12, 12, 10, 3), '#efe8d4');
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-4, 30);
    ctx.quadraticCurveTo(6, 36, 16, 30);
  }, PAL.ink, 2.6);

  // arms
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-26, -4);
    ctx.quadraticCurveTo(-46, 6, -42, 22);
    ctx.quadraticCurveTo(-38, 30, -32, 24);
    ctx.quadraticCurveTo(-34, 12, -20, 8);
    ctx.closePath();
  }, '#6fcf3a', { width: OUTS });
  const armLift = s.skill > 0.05 ? -26 : expr === 'excited' ? -14 : 0;
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(24, -6);
    ctx.quadraticCurveTo(48, -10 + armLift, 44, -30 + armLift);
    ctx.quadraticCurveTo(38, -36 + armLift, 34, -26 + armLift);
    ctx.quadraticCurveTo(36, -12, 20, 4);
    ctx.closePath();
  }, '#7fe33f', { width: OUTS });
  fillPath(ctx, () => ellipse(ctx, 43, -32 + armLift, 7, 7), '#c6f24e');

  // head
  inked(ctx, () => ellipse(ctx, 4, -44, 39, 31), linear(ctx, -20, -74, 30, -16, [[0, '#9df05a'], [0.6, '#7fe33f'], [1, '#57b02a']]), { width: OUT });
  // eye bumps
  inked(ctx, () => ellipse(ctx, -12, -70, 19, 17), '#7fe33f', { width: OUT });
  inked(ctx, () => ellipse(ctx, 24, -70, 19, 17), '#7fe33f', { width: OUT });
  const blink = s.blink ? 1 : 0;
  eye(ctx, -11, -70, 12, { look: s.look || 0, expr, blink });
  eye(ctx, 25, -70, 12, { look: (s.look || 0) + 0.2, expr, blink });
  // goggles on forehead
  ctx.save();
  ctx.translate(6, -86);
  ctx.rotate(-0.12);
  goggles(ctx, 0, 0, 13);
  ctx.restore();
  blush(ctx, -6, -36, 9);
  blush(ctx, 30, -38, 9);
  mouth(ctx, 18, -34, 24, expr, '#54202c');
  // nostrils
  fillPath(ctx, () => ellipse(ctx, 2, -52, 2.4, 2), PAL.ink, 0.75);
  fillPath(ctx, () => ellipse(ctx, 14, -53, 2.4, 2), PAL.ink, 0.75);

  // bio-spring aura
  if (s.skill > 0.02) {
    ctx.save();
    ctx.globalAlpha = s.skill * 0.55;
    ctx.strokeStyle = PAL.greenLight;
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(4, 34 + i * 10, 40 + i * 14, 10 + i * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- CHICKEN
function drawChicken(ctx, s) {
  const t = s.t;
  const expr = s.expr;
  const thrust = s.skill;
  const flapSpeed = s.pose === 'jump' || s.pose === 'boost' ? 24 : s.pose === 'fall' ? 10 : 16;
  const flap = Math.sin(t * flapSpeed) * (s.pose === 'jump' || s.pose === 'fall' ? 0.55 : 0.35);

  // engines
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 34, 12 + (side > 0 ? 6 : -2));
    ctx.rotate(side * 0.12);
    inked(ctx, () => rr(ctx, -13, -20, 26, 40, 9), linear(ctx, -13, -20, 13, 20, [[0, '#cfd8e6'], [1, '#7b8aa6']]), { width: OUT });
    inked(ctx, () => rr(ctx, -10, 14, 20, 10, 4), '#4b5872', { width: OUTS });
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-8, -12);
      ctx.lineTo(8, -12);
      ctx.moveTo(-8, -4);
      ctx.lineTo(8, -4);
    }, '#5b6a86', 2.6);
    if (thrust > 0.03) {
      const f = 22 + thrust * 40 + Math.sin(t * 40) * 8;
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-8, 24);
        ctx.quadraticCurveTo(0, 24 + f * 1.4, 8, 24);
        ctx.closePath();
      }, linear(ctx, 0, 24, 0, 24 + f, [[0, '#fff3a0'], [0.45, '#ffb020'], [1, '#ff4d2e']]), { width: 0, glow: '#ff8a3d' });
      fillPath(ctx, () => ellipse(ctx, 0, 30, 5, 8), '#fffbe0', 0.95);
    }
    ctx.restore();
  }

  // tail feathers
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-24, 6);
    ctx.quadraticCurveTo(-58, -16, -50, 10);
    ctx.quadraticCurveTo(-44, -2, -40, 16);
    ctx.quadraticCurveTo(-34, 4, -22, 22);
    ctx.closePath();
  }, '#efe6d2', { width: OUT });

  // body
  inked(ctx, () => ellipse(ctx, 0, 8, 38, 36), linear(ctx, -28, -24, 26, 40, [[0, '#ffffff'], [0.7, '#fdf3e0'], [1, '#e6d4b8']]), { width: OUT });
  fillPath(ctx, () => ellipse(ctx, 10, 16, 24, 22), '#fff8ea', 0.9);

  // wings
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 30, 6);
    ctx.rotate(side * (0.5 + flap) + (side > 0 ? 0.2 : 0));
    inked(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * 6, 26, side * 30, 20);
      ctx.quadraticCurveTo(side * 16, 8, 0, 0);
      ctx.closePath();
    }, '#f6ecd8', { width: OUTS });
    ctx.restore();
  }

  // feet
  for (const side of [-1, 1]) {
    inked(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(side * 10, 42);
      ctx.lineTo(side * 14, 54);
      ctx.lineTo(side * 24, 58);
      ctx.lineTo(side * 14, 58);
      ctx.lineTo(side * 12, 64);
      ctx.lineTo(side * 6, 56);
      ctx.closePath();
    }, '#ffb020', { width: OUTS });
  }

  // head
  inked(ctx, () => ellipse(ctx, 10, -36, 26, 26), linear(ctx, -6, -60, 22, -14, [[0, '#ffffff'], [1, '#f2e6d0']]), { width: OUT });
  // comb
  for (let i = 0; i < 3; i++) {
    inked(ctx, () => {
      const cx = 2 + i * 11;
      const cy = -60 - Math.sin(i * 1.2 + t * 3) * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 7 - i * 0.6, 0, Math.PI * 2);
    }, i % 2 ? '#ff4d6d' : '#ff3355', { width: OUTS });
  }
  // beak
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(32, -38);
    ctx.lineTo(52, -31);
    ctx.lineTo(32, -24);
    ctx.closePath();
  }, linear(ctx, 32, -40, 50, -22, [[0, '#ffd93b'], [1, '#ff9f1c']]), { width: OUTS });
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(33, -31);
    ctx.lineTo(50, -31);
  }, PAL.ink, 2.2);
  // wattle
  inked(ctx, () => {
    ctx.beginPath();
    ctx.arc(31, -17, 6 + Math.sin(t * 6) * 1.2, 0, Math.PI * 2);
  }, '#ff4d6d', { width: OUTS });

  // goggles & eyes
  ctx.save();
  ctx.translate(16, -44);
  ctx.rotate(-0.08);
  goggles(ctx, 0, 0, 10);
  ctx.restore();
  eye(ctx, 20, -34, 9, { look: 1, expr, blink: s.blink });
  blush(ctx, 6, -26, 7);

  if (s.skill > 0.03) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.8, s.skill);
    ctx.strokeStyle = '#ffd93b';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 16, 44 + i * 12 + Math.sin(t * 20 + i) * 4, 0.4, 2.4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- CHEESUS
function drawCheesus(ctx, s) {
  const t = s.t;
  const expr = s.expr;
  const pulse = 1 + Math.sin(t * 3.4) * 0.03;
  ctx.save();
  ctx.scale(1.04 * pulse, 1.02 * pulse);
  // glow aura
  if (s.skill > 0.02) {
    ctx.save();
    ctx.globalAlpha = s.skill * 0.4;
    fillPath(ctx, () => ellipse(ctx, 0, 0, 90, 80), hexA(PAL.yellow, 0.25));
    ctx.restore();
  }
  // wedge body: front triangle face with depth
  const top = -46;
  const bottom = 44;
  const back = 20;
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-40, bottom);
    ctx.lineTo(-40, top + 10);
    ctx.lineTo(back + 26, bottom - 6);
    ctx.closePath();
  }, linear(ctx, -40, -40, 30, 44, [[0, '#ffd93b'], [0.6, '#ffc21c'], [1, '#e8a30d']]), { width: OUT });
  // rind
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-40, bottom);
    ctx.lineTo(-40, top + 10);
    ctx.lineTo(-26, top + 14);
    ctx.lineTo(-26, bottom);
    ctx.closePath();
  }, '#ffb020', { width: OUTS });
  // top face
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-40, top + 10);
    ctx.lineTo(-6, top - 4);
    ctx.lineTo(back + 26, bottom - 6);
    ctx.lineTo(-4, bottom + 4);
    ctx.closePath();
  }, linear(ctx, -30, top, 40, 40, [[0, '#fff1a8'], [1, '#ffcf3d']]), { width: OUTS });
  // holes
  const holes = [[-22, -18, 7], [-6, 6, 9], [-24, 18, 5], [2, -14, 5], [12, 20, 6], [-12, 30, 4]];
  for (const [hx, hy, hr] of holes) {
    fillPath(ctx, () => ellipse(ctx, hx, hy, hr, hr * 0.9), '#e09b12', 0.9);
    fillPath(ctx, () => ellipse(ctx, hx + hr * 0.2, hy + hr * 0.2, hr * 0.55, hr * 0.5), '#c9870a', 0.7);
  }
  // tiny arms
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-38, -6);
    ctx.quadraticCurveTo(-56, -14 + Math.sin(t * 5) * 4, -54, 4);
    ctx.quadraticCurveTo(-48, 8, -44, 0);
    ctx.closePath();
  }, '#ffd93b', { width: OUTS });
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(6, -22);
    ctx.quadraticCurveTo(26, -34 + Math.sin(t * 5 + 1) * 4, 30, -20);
    ctx.quadraticCurveTo(24, -16, 18, -20);
    ctx.closePath();
  }, '#ffd93b', { width: OUTS });

  // face
  eye(ctx, -14, -16, 11, { look: s.look || 0.2, expr, blink: s.blink });
  eye(ctx, 10, -20, 11, { look: (s.look || 0.2) + 0.2, expr, blink: s.blink });
  blush(ctx, -24, -2, 8, '#ff9f6b');
  blush(ctx, 20, -6, 8, '#ff9f6b');
  mouth(ctx, 0, 6, 26, expr, '#7a3b10');
  // crumbs orbiting
  for (let i = 0; i < 5; i++) {
    const a = t * 1.6 + i * 1.26;
    const rr2 = 62 + Math.sin(t * 2 + i) * 8;
    const cx = Math.cos(a) * rr2;
    const cy = Math.sin(a) * rr2 * 0.7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a * 1.5);
    inked(ctx, () => rr(ctx, -4, -4, 8, 8, 2), '#ffd93b', { width: 2.2 });
    ctx.restore();
  }
  ctx.restore();
}

// -------------------------------------------------------------- PIG METEOR
function drawPig(ctx, s) {
  const t = s.t;
  const expr = s.expr;
  const diving = s.skill;
  ctx.save();
  // suit backpack
  inked(ctx, () => rr(ctx, -48, -28, 30, 44, 10), linear(ctx, -48, -28, -18, 16, [[0, '#cfd8e6'], [1, '#8b9bb5']]), { width: OUT });
  fillPath(ctx, () => rr(ctx, -42, -20, 18, 10, 5), '#ffd93b');
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-38, -10);
    ctx.lineTo(-28, -10);
  }, PAL.ink, 2.4);

  // body (round, spacesuit)
  inked(ctx, () => ellipse(ctx, 0, 8, 46, 40), linear(ctx, -30, -26, 30, 44, [[0, '#ffffff'], [0.65, '#eef3fb'], [1, '#c9d6e8']]), { width: OUT });
  fillPath(ctx, () => ellipse(ctx, 10, 18, 26, 22), '#ffffff', 0.9);
  // suit seams
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.arc(4, 10, 30, -1.2, 1.4);
  }, '#b7c5da', 3);
  // chest patch
  inked(ctx, () => rr(ctx, 14, 6, 20, 14, 4), '#8fd6ff', { width: 2.4 });
  fillPath(ctx, () => starPath(ctx, 24, 13, 5, 0), '#ffd93b');

  // legs
  for (const side of [-1, 1]) {
    inked(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(side * 22, 38);
      ctx.quadraticCurveTo(side * 30, 48, side * 26, 56);
      ctx.lineTo(side * 14, 54);
      ctx.quadraticCurveTo(side * 16, 46, side * 12, 40);
      ctx.closePath();
    }, '#e6eefc', { width: OUTS });
    fillPath(ctx, () => ellipse(ctx, side * 21, 54, 10, 5), '#ffd93b');
  }
  // arms
  const armUp = expr === 'panic' || diving > 0.05;
  for (const side of [-1, 1]) {
    inked(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(side * 36, 0);
      ctx.quadraticCurveTo(side * 54, armUp ? -22 : 10, side * 48, armUp ? -34 : 24);
      ctx.quadraticCurveTo(side * 40, -30 * (armUp ? 1 : 0) + 16, side * 30, 10);
      ctx.closePath();
    }, '#eef3fb', { width: OUTS });
    fillPath(ctx, () => ellipse(ctx, side * 48, armUp ? -36 : 26, 8, 8), '#ffb4c4');
  }

  // head inside helmet
  inked(ctx, () => ellipse(ctx, 10, -34, 30, 28), '#ffb4c4', { width: OUTS });
  // ears
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-6, -56);
    ctx.lineTo(-12, -74);
    ctx.lineTo(8, -62);
    ctx.closePath();
  }, '#ff9db4', { width: OUTS });
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(24, -56);
    ctx.lineTo(32, -74);
    ctx.lineTo(38, -56);
    ctx.closePath();
  }, '#ff9db4', { width: OUTS });
  // snout
  inked(ctx, () => ellipse(ctx, 30, -30, 15, 12), '#ff9db4', { width: OUTS });
  fillPath(ctx, () => ellipse(ctx, 26, -31, 3, 4), PAL.ink);
  fillPath(ctx, () => ellipse(ctx, 35, -32, 3, 4), PAL.ink);
  eye(ctx, 6, -42, 8, { look: 1, expr, blink: s.blink });
  eye(ctx, 22, -44, 8, { look: 1, expr, blink: s.blink });
  blush(ctx, 2, -26, 7, '#ff7a9c');

  // helmet glass
  ctx.save();
  ctx.globalAlpha = 0.22;
  inked(ctx, () => ellipse(ctx, 10, -34, 38, 36), '#bff7ff', { width: 0 });
  ctx.restore();
  strokePath(ctx, () => ellipse(ctx, 10, -34, 38, 36), '#dff6ff', 4, 0.85);
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.arc(10, -34, 30, -2.4, -1.5);
  }, PAL.white, 6, 0.6);

  // meteor flames
  if (diving > 0.02) {
    for (let i = 0; i < 3; i++) {
      const a = -0.6 + i * 0.6;
      const len = 30 + diving * 60 + Math.sin(t * 22 + i) * 8;
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(0, -34 + i * 24);
        ctx.quadraticCurveTo(-len * 0.8, -46 + i * 26, -len * 1.4, -14 + i * 26);
        ctx.quadraticCurveTo(-len * 0.6, -22 + i * 26, 0, -22 + i * 24);
        ctx.closePath();
      }, linear(ctx, -len, 0, 0, 0, [[0, '#ff4d2e'], [0.6, '#ffd93b'], [1, '#fff6c9']]), { width: 0, glow: '#ff8a3d' });
    }
  }
  ctx.restore();
}

// --------------------------------------------------------------- ERROR-404
function drawError(ctx, s) {
  const t = s.t;
  const expr = s.expr;
  const mode = s.mode || 0;
  const modeColours = ['#ff7a3d', '#7ee8ff', '#9ff7a0'];
  const accent = modeColours[mode] || '#c58bff';
  const glitch = s.skill;

  // cables behind
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const ph = t * 3 + i;
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-30, 6 + i * 6);
      ctx.bezierCurveTo(-46, 14 + i * 8 + Math.sin(ph) * 6, -20, 34 + i * 8, -34, 46 + i * 4);
    }, ['#8b5a2b', '#4b5872', '#7a4321'][i], 4);
  }
  ctx.restore();

  // toaster body
  inked(ctx, () => rr(ctx, -38, -34, 76, 72, 12), linear(ctx, -38, -34, 38, 38, [[0, '#e3ebf7'], [0.6, '#b9c6dd'], [1, '#8494b0']]), { width: OUT });
  // slot
  inked(ctx, () => rr(ctx, -24, -28, 46, 12, 5), '#3a4560', { width: OUTS });
  fillPath(ctx, () => rr(ctx, -20, -25, 10, 6, 3), '#0f1424');
  // toast popping out
  inked(ctx, () => rr(ctx, -12, -44, 24, 20, 4), '#c98a3d', { width: OUTS });
  fillPath(ctx, () => rr(ctx, -8, -40, 16, 8, 3), '#e8b86a');
  // screen face
  inked(ctx, () => rr(ctx, -26, -8, 52, 34, 8), '#101a2e', { width: OUTS });
  ctx.save();
  ctx.globalAlpha = 0.25 + Math.sin(t * 8) * 0.05;
  fillPath(ctx, () => rr(ctx, -26, -8, 52, 34, 8), accent);
  ctx.restore();
  // pixel eyes
  const blink = s.blink;
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  if (expr === 'dead') {
    for (const [ex, ey] of [[-14, 4], [8, 4]]) {
      ctx.fillRect(ex - 7, ey - 1, 14, 4);
      ctx.fillRect(ex - 1, ey - 7, 4, 14);
    }
  } else if (blink) {
    ctx.fillRect(-20, 6, 12, 3);
    ctx.fillRect(8, 6, 12, 3);
  } else {
    const h = expr === 'panic' ? 8 : 12;
    ctx.fillRect(-20, 2 - h / 4, 12, h);
    ctx.fillRect(8, 2 - h / 4, 12, h);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(-20, 14, 12, 2);
    ctx.fillRect(8, 14, 12, 2);
  }
  ctx.restore();
  // mouth line on screen
  strokePath(ctx, () => {
    ctx.beginPath();
    if (expr === 'panic' || expr === 'dead') {
      for (let i = 0; i < 4; i++) {
        ctx.lineTo(-14 + i * 8, 20 + (i % 2 ? -4 : 2));
      }
    } else {
      ctx.moveTo(-12, 20);
      ctx.quadraticCurveTo(0, 26, 12, 19);
    }
  }, accent, 3);

  // knobs
  for (let i = 0; i < 2; i++) {
    inked(ctx, () => ellipse(ctx, -28 + i * 22, 30, 6, 6), '#5b6a86', { width: 2.4 });
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-28 + i * 22, 30);
      ctx.lineTo(-28 + i * 22 + Math.cos(t * 2 + i) * 4, 30 + Math.sin(t * 2 + i) * 4);
    }, '#e3ebf7', 2);
  }
  // antenna with bulb
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(24, -44);
    ctx.quadraticCurveTo(38, -66, 30, -78);
  }, PAL.ink, 4);
  inked(ctx, () => ellipse(ctx, 30, -82, 8, 8), accent, { width: OUTS, glow: accent });

  // arms: one fork, one fan
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-36, 6);
    ctx.lineTo(-56, 20 + Math.sin(t * 4) * 4);
  }, '#8b9bb5', 6);
  inked(ctx, () => rr(ctx, -70, 12, 20, 8, 3), '#c9d6e8', { width: 2.6 });
  for (let i = 0; i < 3; i++) {
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-70, 14 + i * 2.4);
      ctx.lineTo(-78, 13 + i * 3);
    }, '#c9d6e8', 2);
  }
  strokePath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(36, 10);
    ctx.lineTo(56, 22 + Math.cos(t * 4) * 4);
  }, '#8b9bb5', 6);
  ctx.save();
  ctx.translate(60, 24);
  ctx.rotate(t * 12);
  for (let i = 0; i < 4; i++) {
    inked(ctx, () => rr(ctx, -3, -12, 6, 12, 3), '#bff7ff', { width: 2 });
    ctx.rotate(Math.PI / 2);
  }
  ctx.restore();

  if (glitch > 0.02) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.6, glitch);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = accent;
      ctx.fillRect(-46 + Math.random() * 80, -40 + Math.random() * 80, 10 + Math.random() * 20, 3);
    }
    ctx.restore();
  }
}

const DRAWERS = {
  frog: drawFrog,
  chicken: drawChicken,
  cheesus: drawCheesus,
  pig: drawPig,
  error404: drawError,
};

/**
 * Draw a character at the origin, facing right by default.
 * s = { t, expr, look, blink, rot, squash, stretch, skill, mode, facing, scale }
 */
export function drawCharacter(ctx, id, s = {}) {
  const st = {
    t: s.t || 0,
    expr: s.expr || 'happy',
    look: s.look ?? 0.35,
    blink: s.blink ? 1 : 0,
    skill: s.skill || 0,
    mode: s.mode || 0,
    scale: s.scale || 1,
    pose: s.pose || 'idle',
    poseTime: s.poseTime || 0,
  };
  const draw = DRAWERS[id] || drawFrog;
  ctx.save();
  const scale = st.scale;
  const sx = (s.facing ?? 1) * scale * (s.stretch || 1) * (s.squash || 1);
  const sy = scale * (s.stretch || 1) / (s.squash || 1 || 1);
  ctx.scale(sx * 0.98, sy * 0.98);
  if (s.rot) ctx.rotate(s.rot);
  // Responsive leaning/tumbling and a single, brief upward leg tuck.
  if (st.pose === 'jump' || st.pose === 'boost') {
    ctx.rotate(Math.sin(st.poseTime * 9) * 0.025);
    ctx.translate(0, -3);
  } else if (st.pose === 'fall') {
    ctx.rotate(Math.sin(st.poseTime * 6) * 0.045);
    ctx.translate(0, 2);
  } else if (st.pose === 'land') {
    ctx.translate(0, 9);
  } else if (st.pose === 'glide' || st.pose === 'rise') {
    ctx.rotate(Math.sin(st.poseTime * 2.8) * 0.017);
  }
  draw(ctx, st);
  ctx.restore();
}

export const CHARACTER_DRAWERS = DRAWERS;
