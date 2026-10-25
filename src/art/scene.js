/** Composes one full gameplay frame. Pure rendering — no game logic here. */
import { PAL, hexA, glowDot, ellipse, fillPath, inked, starPath, strokePath, rr, linear } from './art.js';
import { drawCharacter } from './characters.js';
import { drawItemArt } from './items.js';
import { ITEM_DEFS } from '../game/items.js';
import {
  drawSky, drawStars, drawParallax, drawFloor, drawDecor, drawPad, drawPadSupport, drawZones, drawLaunchSite,
} from './world.js';
import {
  drawTopHUD, drawBottomHUD, drawMinimap, drawFloters, drawLaunchMeter,
  drawVignette, drawSpeedLines, drawFlash,
} from './ui.js';
import { LAUNCH } from '../config/config.js';

export function renderScene(ctx, game, cssW, cssH, now, quality = 'balanced', opts = {}) {
  const t = now;
  const cam = game.camera;
  const region = game.region;
  const q = quality === 'high' ? 1 : quality === 'low' ? 0.45 : 0.75;

  ctx.save();
  drawSky(ctx, cssW, cssH, region.id, t, q);
  if (region.id === 'star' || region.id === 'clouds' || region.id === 'illegal') {
    drawStars(ctx, cssW, cssH, t, region.id === 'star' ? 1 : 0.25);
  }

  // ---- parallax background (screen space: draws its own offsets)
  drawParallax(ctx, cam, cssW, cssH, region.id, t, q);
  // atmospheric depth haze pushes the scenery behind the gameplay plane
  ctx.save();
  const hazeColour = { lab: '110,200,220', wilds: '120,220,200', clouds: '140,150,240', illegal: '90,40,90', star: '40,20,70' }[region.id] || '110,200,220';
  const hz = ctx.createLinearGradient(0, 0, 0, cssH);
  hz.addColorStop(0, `rgba(${hazeColour},0.10)`);
  hz.addColorStop(0.55, `rgba(${hazeColour},0.22)`);
  hz.addColorStop(1, `rgba(${hazeColour},0.10)`);
  ctx.fillStyle = hz;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.restore();

  // ---- gameplay layer
  ctx.save();
  ctx.translate(cssW / 2 - cam.x * cam.zoom + cam.shakeX, cssH / 2 - cam.y * cam.zoom + cam.shakeY);
  ctx.scale(cam.zoom, cam.zoom);

  const world = game.world;
  if (world) {
    if (game.player.x < LAUNCH.startX + 2600) drawLaunchSite(ctx, world, t, game.player.launched);

    drawDecor(ctx, cam, world, t, q);
    drawFloor(ctx, cam, world, t, region.id, q);

    // zones under everything else
    for (const chunk of world.chunksNear(cam.x, 2, 2)) {
      if (chunk.zones.length) drawZones(ctx, chunk.zones, t);
    }

    // pads (with their regional support props underneath)
    for (const chunk of world.chunksNear(cam.x, 2, 2)) {
      for (const pad of chunk.pads) {
        if (pad.x < cam.x - cam.vw / 2 - 400 || pad.x > cam.x + cam.vw / 2 + 500) continue;
        drawPadSupport(ctx, pad, region.id, t);
      }
    }
    for (const chunk of world.chunksNear(cam.x, 2, 2)) {
      for (const pad of chunk.pads) {
        if (pad.x < cam.x - cam.vw / 2 - 300 || pad.x > cam.x + cam.vw / 2 + 400) continue;
        drawPad(ctx, pad, t);
      }
    }

    // items with bobbing
    for (const chunk of world.chunksNear(cam.x, 2, 2)) {
      for (const it of chunk.items) {
        if (it.taken) continue;
        if (it.x < cam.x - cam.vw / 2 - 220 || it.x > cam.x + cam.vw / 2 + 400) continue;
        const def = ITEM_DEFS[it.id];
        if (!def) continue;
        const bob = Math.sin(t * 2 + (it.bob || 0)) * 8;
        ctx.save();
        ctx.translate(it.x, it.y + bob);
        if (it.pulled) ctx.globalAlpha = 0.95;
        drawItemArt(ctx, it.id, t + (it.bob || 0), { scale: (def.r / 24) * 1.15 });
        ctx.restore();
      }
    }

    // hazards
    for (const chunk of world.chunksNear(cam.x, 2, 2)) {
      for (const hz of chunk.hazards) {
        if (hz.x < cam.x - cam.vw / 2 - 200 || hz.x > cam.x + cam.vw / 2 + 300) continue;
        ctx.save();
        ctx.translate(hz.x, hz.y);
        drawItemArt(ctx, 'hazard', t + (hz.spin || 0), { scale: 1 });
        ctx.restore();
      }
    }
  }

  // ---- particles behind player
  game.particles.draw(ctx, cam);

  // ---- player
  if (game.player && game.state !== 'dead') drawPlayer(ctx, game, t);
  else if (game.player && game.state === 'dead') drawFallingPlayer(ctx, game, t);

  // ---- floating callouts (world space)
  for (const f of game.floaters) {
    const sx = f.x;
    const sy = f.y;
    if (sx < cam.x - cam.vw / 2 - 300 || sx > cam.x + cam.vw / 2 + 300) continue;
  }
  ctx.restore();

  // ---- screen space FX
  drawSpeedLines(ctx, game, cssW, cssH, t);
  drawFloters(ctx, game, cam, cssW, cssH);
  drawVignette(ctx, cssW, cssH, quality === 'low' ? 0.4 : 0.5);
  drawFlash(ctx, game, cssW, cssH);

  // ---- HUD
  if (!opts.hideHud && game.player && game.state !== 'idle') {
    const dead = game.state === 'dead';
    ctx.save();
    ctx.globalAlpha = dead ? 0.25 : 1;
    drawTopHUD(ctx, game, cssW, cssH, t);
    drawBottomHUD(ctx, game, cssW, cssH, t, opts.touchMode);
    drawMinimap(ctx, game, cssW, cssH, t);
    ctx.restore();
  }
  drawLaunchMeter(ctx, game, cssW, cssH, t);
  ctx.restore();
}

function drawPlayer(ctx, game, t) {
  const p = game.player;
  const def = game.characterId;
  const blink = Math.sin(t * 1.7) > 0.986 ? 1 : 0;
  const skillGlow =
    def === 'chicken' ? Math.min(1, p.skillPulse)
    : def === 'pig' ? (p.diveTimer > 0 ? 1 : p.skillPulse * 0.5)
    : p.skillPulse;

  ctx.save();
  ctx.translate(p.x, p.y);

  // ground shadow / glow
  const g = ctx.createRadialGradient(0, 20, 10, 0, 20, 120);
  g.addColorStop(0, hexA(PAL.yellow, 0.16 + p.boostPulse * 0.2));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 20, 120, 0, Math.PI * 2);
  ctx.fill();

  // buff auras
  if (p.buffs.balloon > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(t * 5) * 0.06;
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.arc(0, -10, 86, 0, Math.PI * 2);
    }, PAL.pink, 4);
    ctx.restore();
  }
  if (p.buffs.parachute > 0) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.translate(0, -108);
    drawItemArt(ctx, 'parachute', t, { scale: 1.2 });
    ctx.restore();
  }
  if (p.buffs.magnet > 0 || def === 'cheesus' && p.skillPulse > 0.1) {
    ctx.save();
    ctx.globalAlpha = 0.22 + Math.sin(t * 6) * 0.05;
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.arc(0, 0, 120 + Math.sin(t * 4) * 8, 0, Math.PI * 2);
    }, '#7ee8ff', 3);
    ctx.restore();
  }
  if (p.invuln > 0 && Math.floor(t * 16) % 2 === 0) ctx.globalAlpha = 0.55;

  drawCharacter(ctx, def, {
    t,
    expr: p.expression,
    look: 0.45,
    blink,
    rot: p.rot,
    squash: p.squash,
    stretch: p.stretch,
    skill: skillGlow,
    mode: p.glitchMode,
    facing: 1,
    scale: 1,
  });

  // boost ring
  if (p.boostPulse > 0.02) {
    ctx.save();
    ctx.globalAlpha = p.boostPulse * 0.8;
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.arc(-10, 10, 40 + (1 - p.boostPulse) * 90, 0, Math.PI * 2);
    }, '#ffe86b', 6);
    ctx.restore();
  }
  // energy low warning
  if (p.energy < p.energyMax * 0.2) {
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(t * 10) * 0.2;
    strokePath(ctx, () => {
      ctx.beginPath();
      ctx.arc(0, 0, 74, 0, Math.PI * 2);
    }, '#ff4d6d', 3);
    ctx.restore();
  }
  ctx.restore();
}

function drawFallingPlayer(ctx, game, t) {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  const spin = Math.min(2.4, game.deadTimer * 4.5);
  ctx.rotate(spin);
  drawCharacter(ctx, game.characterId, {
    t,
    expr: 'dead',
    look: 0,
    rot: 0,
    squash: 1,
    stretch: 1,
    skill: 0,
    mode: p.glitchMode,
    facing: -1,
    scale: 1,
  });
  ctx.restore();
}
