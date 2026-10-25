/** HUD, gauges, minimap, combo callouts, launch meter, logo. */
import {
  PAL, rr, ellipse, inked, fillPath, strokePath, starPath, linear, radial, hexA, glowDot,
  bigText, shade, clamp01, lerp,
} from './art.js';
import { COMBO_TIERS, PX_PER_METER, REGIONS } from '../config/config.js';
import { CHARACTERS, GLITCH_MODES, GLITCH_INFO } from '../game/characters.js';

function panel(ctx, x, y, w, h, opts = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(8,4,20,0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  rr(ctx, x, y, w, h, opts.r ?? 16);
  ctx.fillStyle = opts.fill || 'rgba(24,14,46,0.82)';
  ctx.fill();
  ctx.restore();
  rr(ctx, x, y, w, h, opts.r ?? 16);
  ctx.strokeStyle = opts.stroke || 'rgba(255,255,255,0.14)';
  ctx.lineWidth = opts.lw ?? 2;
  ctx.stroke();
  if (opts.accent) {
    rr(ctx, x + 2, y + 2, w - 4, 4, 3);
    ctx.fillStyle = opts.accent;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function drawTopHUD(ctx, game, w, h, t, hudInset = 0) {
  const p = game.player;
  const s = game.score;
  const compact = w < 760;
  const pad = compact ? 12 : 20;
  // keep the right-hand pills clear of the DOM overlay buttons (pause/fullscreen)
  const rpad = pad + hudInset;

  // distance block
  const dw = compact ? 186 : 240;
  panel(ctx, pad, pad, dw, compact ? 66 : 78, { accent: '#7fe33f' });
  ctx.save();
  bigText(ctx, game.distanceLabel, pad + 16, pad + (compact ? 30 : 34), compact ? 30 : 38, '#ffffff', {
    align: 'left',
    stroke: PAL.ink,
    strokeWidth: 5,
  });
  bigText(ctx, `SCORE ${s.score.toLocaleString('en-US')}`, pad + 16, pad + (compact ? 54 : 64), compact ? 14 : 16, '#ffe86b', {
    align: 'left',
    stroke: PAL.ink,
    strokeWidth: 3,
  });
  ctx.restore();

  // region pill
  const region = game.region;
  const rw = compact ? 150 : 210;
  panel(ctx, pad + dw + 10, pad, rw, compact ? 34 : 38, { fill: 'rgba(20,10,40,0.72)', r: 12 });
  ctx.save();
  ctx.beginPath();
  ctx.arc(pad + dw + 28, pad + (compact ? 17 : 19), 5, 0, Math.PI * 2);
  ctx.fillStyle = region.hue;
  ctx.fill();
  bigText(ctx, region.short, pad + dw + 40, pad + (compact ? 17 : 19), compact ? 12 : 14, '#ffffff', {
    align: 'left', stroke: null, strokeWidth: 0,
  });
  ctx.restore();

  // coins + boosts (right)
  const cw = compact ? 92 : 112;
  panel(ctx, w - rpad - cw, pad, cw, compact ? 34 : 38, { fill: 'rgba(20,10,40,0.72)', r: 12 });
  ctx.save();
  ctx.translate(w - rpad - cw + 22, pad + (compact ? 17 : 19));
  ctx.scale(0.72, 0.72);
  // coin icon
  inked(ctx, () => ellipse(ctx, 0, 0, 15, 15), linear(ctx, -12, -14, 12, 14, [[0, '#fff3a8'], [0.6, '#ffd93b'], [1, '#e8a30d']]), { stroke: '#7a4b0a', width: 3 });
  fillPath(ctx, () => starPath(ctx, 0, 0, 7, 0), '#a86e0a', 0.7);
  ctx.restore();
  bigText(ctx, `${s.coins}`, w - rpad - cw + 42, pad + (compact ? 17 : 19), compact ? 16 : 18, '#ffe86b', {
    align: 'left', stroke: PAL.ink, strokeWidth: 3,
  });

  // boost stars
  const bx = w - rpad - (compact ? 126 : 150);
  const by = pad + (compact ? 52 : 60);
  for (let i = 0; i < p.maxBoosts; i++) {
    const filled = i < p.boosts;
    ctx.save();
    ctx.translate(bx + i * (compact ? 22 : 26), by);
    const scale = compact ? 0.66 : 0.8;
    ctx.scale(scale, scale);
    if (filled) glowDot(ctx, 0, 0, 26, '#ffd93b', 0.5);
    inked(ctx, () => starPath(ctx, 0, 0, 15, 0, 5, 0.46), filled
      ? linear(ctx, -12, -12, 12, 12, [[0, '#fff9c4'], [1, '#ffb020']])
      : 'rgba(255,255,255,0.10)', {
      stroke: filled ? '#7a4b0a' : 'rgba(255,255,255,0.28)',
      width: 3,
      glow: filled ? '#ffe86b' : null,
    });
    ctx.restore();
  }
}

export function drawBottomHUD(ctx, game, w, h, t, touchMode) {
  const p = game.player;
  const compact = w < 760;
  const pad = compact ? 12 : 20;
  const barW = compact ? 190 : 280;
  const barH = compact ? 16 : 20;
  const bx = pad;
  const by = h - pad - (compact ? 46 : 56);

  // energy
  panel(ctx, bx - 6, by - 30, barW + 40, compact ? 58 : 70, { accent: '#7ee8ff', r: 14 });
  bigText(ctx, 'ENERGY', bx + 8, by - 8, compact ? 12 : 14, '#bff7ff', { align: 'left', stroke: PAL.ink, strokeWidth: 3 });
  const frac = clamp01(p.energy / p.energyMax);
  rr(ctx, bx + 6, by + 4, barW, barH, barH / 2);
  ctx.fillStyle = 'rgba(8,20,32,0.85)';
  ctx.fill();
  const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
  const low = frac < 0.25;
  grad.addColorStop(0, low ? '#ff4d6d' : '#3fd0ff');
  grad.addColorStop(0.6, low ? '#ff8a3d' : '#7ee8ff');
  grad.addColorStop(1, low ? '#ffd93b' : '#c6f24e');
  rr(ctx, bx + 6, by + 4, Math.max(0, barW * frac), barH, barH / 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = low ? '#ff4d6d' : '#3fd0ff';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  rr(ctx, bx + 6, by + 4, barW, barH, barH / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  bigText(ctx, `${Math.round(p.energy)}`, bx + barW + 20, by + 4 + barH / 2, compact ? 13 : 15, '#ffffff', { align: 'left', stroke: PAL.ink, strokeWidth: 3 });

  // skill badge
  const def = CHARACTERS[game.characterId];
  const sx = bx + barW + (compact ? 66 : 92);
  const sy = by - 20;
  const size = compact ? 54 : 66;
  const cdFrac = p.skillCooldown > 0 ? p.skillCooldown / Math.max(0.001, def.skill.cooldown || 0.6) : 0;
  panel(ctx, sx, sy, size, size, { fill: 'rgba(24,14,46,0.85)', r: 14, stroke: 'rgba(255,255,255,0.2)' });
  ctx.save();
  ctx.translate(sx + size / 2, sy + size / 2);
  const ready = p.skillCooldown <= 0 && p.energy >= def.skill.cost * 0.3;
  if (ready) glowDot(ctx, 0, 0, size * 0.7, '#ffd93b', 0.35 + Math.sin(t * 4) * 0.1);
  ctx.scale(size / 60, size / 60);
  drawSkillGlyph(ctx, def.skill.id, ready, t);
  ctx.restore();
  if (cdFrac > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx + size / 2, sy + size / 2);
    ctx.arc(sx + size / 2, sy + size / 2, size * 0.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cdFrac));
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.restore();
  }
  bigText(ctx, 'SKILL', sx + size / 2, sy + size + 10, compact ? 10 : 11, '#ffe86b', { stroke: PAL.ink, strokeWidth: 3 });

  // glitch mode indicator
  if (def.skill.id === 'glitchBoost') {
    const mode = GLITCH_MODES[p.glitchMode];
    panel(ctx, sx + size + 10, sy + 8, compact ? 92 : 108, 46, { fill: 'rgba(20,10,40,0.8)', r: 12 });
    bigText(ctx, 'NEXT', sx + size + 20, sy + 22, 10, '#c58bff', { align: 'left', stroke: null, strokeWidth: 0 });
    bigText(ctx, mode, sx + size + 20, sy + 40, compact ? 14 : 16, GLITCH_INFO[mode].colour, {
      align: 'left', stroke: PAL.ink, strokeWidth: 3,
    });
  }

  // combo meter (centre-bottom, out of the flight path)
  if (game.score.combo >= 2) {
    const cx = w / 2;
    const cy = h - pad - (compact ? 26 : 34);
    const frac2 = game.score.comboFraction;
    const tier = game.score.tierIndex;
    const colour = tier > 0 ? COMBO_TIERS[tier - 1].colour : '#ffffff';
    ctx.save();
    bigText(ctx, `${Math.floor(game.score.combo)}× COMBO`, cx, cy - 18, compact ? 18 : 22, colour, {
      stroke: PAL.ink, strokeWidth: 5,
    });
    rr(ctx, cx - 90, cy, 180, 7, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    rr(ctx, cx - 90, cy, 180 * frac2, 7, 4);
    ctx.fillStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  }

  // touch hint / pause hint
  if (!touchMode && game.state === 'fly' && game.score.metres < 24) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    bigText(ctx, 'SPACE = BOOST   ·   SHIFT = SKILL   ·   A / D = STEER   ·   ESC = PAUSE', w / 2, h - pad - 4, 13, '#dff6ff', {
      stroke: PAL.ink, strokeWidth: 3,
    });
    ctx.restore();
  }
}

function drawSkillGlyph(ctx, id, ready, t) {
  const c = ready ? '#ffe86b' : '#8b93a8';
  switch (id) {
    case 'bioSpring':
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-2, -22);
        for (let i = 0; i < 5; i++) ctx.lineTo(i % 2 ? -16 : 12, -16 + i * 8);
        ctx.lineTo(0, 22);
      }, c, 5);
      break;
    case 'panicThrust':
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-4, -24);
        ctx.lineTo(18, 0);
        ctx.lineTo(-4, 24);
        ctx.closePath();
      }, c, { width: 0, glow: c });
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-16, -18);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-16, 18);
        ctx.closePath();
      }, hexA(c, 0.7), { width: 0 });
      break;
    case 'cheeseMagnet':
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.arc(0, 4, 16, Math.PI, 0);
        ctx.moveTo(-16, 4);
        ctx.lineTo(-16, 16);
        ctx.moveTo(16, 4);
        ctx.lineTo(16, 16);
      }, c, 7);
      break;
    case 'meteorSlam':
      inked(ctx, () => starPath(ctx, 0, 0, 20, 0, 5, 0.5), c, { width: 0, glow: c });
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-24, -16);
        ctx.lineTo(-12, -4);
        ctx.moveTo(-22, 6);
        ctx.lineTo(-8, 6);
      }, c, 4);
      break;
    case 'glitchBoost':
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(4, -24);
        ctx.lineTo(-12, 2);
        ctx.lineTo(0, 2);
        ctx.lineTo(-4, 24);
        ctx.lineTo(14, -4);
        ctx.lineTo(2, -4);
        ctx.closePath();
      }, c, 4);
      break;
    default:
      break;
  }
}

export function drawMinimap(ctx, game, w, h, t) {
  const data = game.minimapData();
  if (!data) return;
  const compact = w < 760;
  const mw = compact ? 200 : 300;
  const mh = compact ? 40 : 48;
  const x = w / 2 - mw / 2;
  const y = compact ? 58 : 20;
  panel(ctx, x, y, mw, mh, { fill: 'rgba(16,8,34,0.74)', r: 12, stroke: 'rgba(255,255,255,0.16)' });
  ctx.save();
  ctx.beginPath();
  rr(ctx, x + 6, y + 6, mw - 12, mh - 12, 8);
  ctx.clip();
  // region bands
  const px = data.playerX;
  const span = data.span;
  const toX = (wx) => x + 10 + ((wx - px) / span) * (mw - 20) + (mw - 20) * 0.22;
  const metres = data.metres;
  // region colour strip from current region
  const g = ctx.createLinearGradient(x, 0, x + mw, 0);
  g.addColorStop(0, hexA(data.region.hue, 0.1));
  g.addColorStop(0.22, hexA(data.region.hue, 0.35));
  g.addColorStop(1, hexA(data.region.hue, 0.08));
  ctx.fillStyle = g;
  ctx.fillRect(x + 4, y + 4, mw - 8, mh - 8);
  // floor line
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const wx = px + (i / 20 - 0.22) * span;
    const mx = toX(wx);
    const my = y + mh / 2 + 8 + Math.sin(i * 0.7) * 2;
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.lineTo(mx, my);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // pads
  for (const pad of data.pads) {
    const mx = toX(pad.x);
    if (mx < x + 6 || mx > x + mw - 6) continue;
    const my = y + mh / 2 + 4;
    ctx.fillStyle = '#9ff7a0';
    ctx.fillRect(mx - 2, my - 3, 4, 6);
  }
  // distance ticks every 500m
  const stepM = 500;
  const startM = Math.floor(metres / stepM) * stepM;
  for (let m = startM - stepM * 4; m < startM + stepM * 8; m += stepM) {
    if (m < 0) continue;
    const wx = game.score.startX + m * PX_PER_METER;
    const mx = toX(wx);
    if (mx < x + 8 || mx > x + mw - 8) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(mx, y + mh - 12, 1, 7);
  }
  // player arrow
  const pxs = toX(px);
  const pys = y + mh / 2 + 2;
  ctx.save();
  ctx.translate(pxs, pys);
  ctx.fillStyle = '#ffe86b';
  ctx.shadowColor = '#ffb020';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -7);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  bigText(ctx, data.region.short, x + mw - 12, y + mh - 9, compact ? 9 : 10, 'rgba(255,255,255,0.7)', {
    align: 'right', stroke: null, strokeWidth: 0,
  });
  bigText(ctx, `${Math.floor(metres)} m`, x + 12, y + mh - 9, compact ? 9 : 10, 'rgba(255,255,255,0.7)', {
    align: 'left', stroke: null, strokeWidth: 0,
  });
}

export function drawFloters(ctx, game, cam, w, h) {
  for (const f of game.floaters) {
    const s = cam.worldToScreen(f.x, f.y, w, h);
    if (s.x < -200 || s.x > w + 200 || s.y < -100 || s.y > h + 100) continue;
    const life = f.life / f.maxLife;
    const pop = f.life > f.maxLife - 0.12 ? 1 + (f.maxLife - f.life) * 3 : 1;
    const alpha = Math.min(1, life * 2.2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(s.x, s.y);
    ctx.scale(pop * (f.big ? 1.05 : 1), pop * (f.big ? 1.05 : 1));
    bigText(ctx, f.text, 0, 0, f.size, f.colour, {
      stroke: PAL.ink,
      strokeWidth: Math.max(3, f.size * 0.2),
      shadow: 'rgba(0,0,0,0.35)',
    });
    ctx.restore();
  }
}

export function drawLaunchMeter(ctx, game, w, h, t) {
  if (game.state !== 'launch') return;
  const p = game.player;
  const cam = game.camera;
  const pos = cam.worldToScreen(p.x + 60, p.y - 170, w, h);
  const meterW = 260;
  const x = pos.x - meterW / 2;
  const y = pos.y;
  panel(ctx, x - 10, y - 26, meterW + 20, 74, { fill: 'rgba(20,10,40,0.86)', r: 14, accent: '#ffd93b' });
  bigText(ctx, 'HOLD TO CHARGE — RELEASE IN THE GOLD ZONE', x + meterW / 2, y - 10, 12, '#ffe86b', {
    stroke: PAL.ink, strokeWidth: 3,
  });
  rr(ctx, x, y + 6, meterW, 18, 9);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  // perfect zone
  const zs = x + meterW * 0.42;
  const zw = meterW * 0.2;
  rr(ctx, zs, y + 6, zw, 18, 6);
  ctx.fillStyle = 'rgba(255,217,59,0.35)';
  ctx.fill();
  rr(ctx, zs, y + 6, zw, 18, 6);
  ctx.strokeStyle = '#ffd93b';
  ctx.lineWidth = 2;
  ctx.stroke();
  const fill = meterW * clamp01(game.launchPower);
  rr(ctx, x, y + 6, Math.max(6, fill), 18, 9);
  ctx.fillStyle = linear(ctx, x, 0, x + meterW, 0, [[0, '#7fe33f'], [0.6, '#ffd93b'], [1, '#ff4d6d']]);
  ctx.fill();
  bigText(ctx, `POWER ${Math.round(game.launchPower * 100)}%`, x + meterW / 2, y + 44, 14, '#ffffff', {
    stroke: PAL.ink, strokeWidth: 3,
  });
}

export function drawVignette(ctx, w, h, intensity = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(8,3,20,${intensity})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawSpeedLines(ctx, game, w, h, t) {
  const p = game.player;
  const speed = Math.max(0, p.vx - 1200);
  if (speed <= 0) return;
  const a = Math.min(0.35, speed / 3200);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const yy = ((t * 900 + i * 137) % (h + 200)) - 100;
    const xx = ((t * -2600 - i * 211) % (w + 400)) + w + 200;
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.lineTo(xx + 90 + speed * 0.06, yy);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFlash(ctx, game, w, h) {
  if (!game.screenFlash || game.screenFlash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, game.screenFlash * 0.5);
  ctx.fillStyle = '#fff6d0';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// -------------------------------------------------------------------- logo
export function drawLogo(ctx, cx, cy, scale, t) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.rotate(Math.sin(t * 1.2) * 0.012);

  // crown
  ctx.save();
  ctx.translate(0, -108);
  ctx.rotate(Math.sin(t * 2) * 0.05);
  inked(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-34, 10);
    ctx.lineTo(-26, -22);
    ctx.lineTo(-8, 0);
    ctx.lineTo(0, -30);
    ctx.lineTo(10, 0);
    ctx.lineTo(28, -22);
    ctx.lineTo(34, 10);
    ctx.closePath();
  }, linear(ctx, -30, -30, 30, 10, [[0, '#fff9c4'], [0.5, '#ffd93b'], [1, '#ffb020']]), { stroke: PAL.ink, width: 5 });
  fillPath(ctx, () => ellipse(ctx, 0, 2, 5, 5), '#ff4d6d');
  ctx.restore();

  // JUMP
  bigText(ctx, 'JUMP', 0, -52, 74, linear(ctx, -120, -90, 120, -20, [[0, '#d9ff9a'], [0.5, '#7fe33f'], [1, '#3f8a1f']]), {
    stroke: PAL.ink, strokeWidth: 14, shadow: 'rgba(20,60,10,0.55)', letterSpacing: 2,
  });
  // TO THE
  bigText(ctx, 'To The', 0, 4, 34, '#fff4d6', { stroke: PAL.ink, strokeWidth: 9, font: 'italic 900 34px "Arial Black", Impact, sans-serif' });
  // STAR
  bigText(ctx, 'STAR', 0, 62, 84, linear(ctx, -140, 20, 140, 80, [[0, '#fff6b0'], [0.45, '#ffd93b'], [1, '#ff8a3d']]), {
    stroke: PAL.ink, strokeWidth: 15, shadow: 'rgba(120,40,0,0.5)', letterSpacing: 4,
  });
  // little star accent on the R
  inked(ctx, () => starPath(ctx, 148, 34, 22, t * 0.6, 5, 0.45), linear(ctx, 130, 16, 168, 52, [[0, '#fff'], [1, '#7ee8ff']]), {
    stroke: PAL.ink, width: 4, glow: '#7ee8ff',
  });
  bigText(ctx, 'JTTS', 0, 112, 20, '#dff6ff', { stroke: PAL.ink, strokeWidth: 6, letterSpacing: 7 });
  ctx.restore();
}

export function drawIcon(ctx, name, x, y, size, colour = '#ffe86b') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 40, size / 40);
  switch (name) {
    case 'play':
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-10, -16);
        ctx.lineTo(16, 0);
        ctx.lineTo(-10, 16);
        ctx.closePath();
      }, colour, { stroke: PAL.ink, width: 4 });
      break;
    case 'lock':
      inked(ctx, () => rr(ctx, -13, -2, 26, 20, 5), colour, { stroke: PAL.ink, width: 4 });
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.arc(0, -2, 9, Math.PI, 0);
      }, PAL.ink, 5);
      break;
    case 'coin':
      inked(ctx, () => ellipse(ctx, 0, 0, 15, 15), colour, { stroke: '#7a4b0a', width: 4 });
      fillPath(ctx, () => starPath(ctx, 0, 0, 7, 0), '#a86e0a', 0.7);
      break;
    default:
      break;
  }
  ctx.restore();
}
