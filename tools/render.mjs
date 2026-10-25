/**
 * Offline art harness.
 * Renders real game frames to PNG using @napi-rs/canvas so the artwork and HUD
 * can be reviewed without a browser. Not part of the shipped game.
 *
 *   node tools/render.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.art-out');
fs.mkdirSync(outDir, { recursive: true });

async function loadCanvas() {
  const candidates = [
    '@napi-rs/canvas',
    path.join(root, 'node_modules/@napi-rs/canvas/index.js'),
    '/tmp/canvastest/node_modules/@napi-rs/canvas/index.js',
  ];
  for (const c of candidates) {
    try {
      return await import(c);
    } catch (_) {
      /* try next */
    }
  }
  throw new Error('Install @napi-rs/canvas to use the art harness: npm i -D @napi-rs/canvas');
}

const { createCanvas, GlobalFonts } = await loadCanvas();
try {
  GlobalFonts.registerFromPath?.('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'Arial Black');
} catch (_) {
  /* font fallback is fine */
}

const { Game } = await import('../src/game/game.js');
const { defaultSave } = await import('../src/game/save.js');
const { renderScene } = await import('../src/art/scene.js');
const { drawCharacter } = await import('../src/art/characters.js');
const { drawItemArt } = await import('../src/art/items.js');
const { drawLogo } = await import('../src/art/ui.js');
const { ITEM_DEFS } = await import('../src/game/items.js');
const { CHARACTER_LIST } = await import('../src/game/characters.js');
const { bigText, PAL } = await import('../src/art/art.js');

const W = 1600;
const H = 900;

function makeGame(seed = 7, charId = 'frog') {
  const canvas = createCanvas(W, H);
  const stubSave = {
    data: defaultSave(),
    save() {},
  };
  stubSave.data.unlocked = { frog: true, chicken: true, cheesus: true, pig: true, error404: true };
  stubSave.data.upgrades[charId] = {};
  const game = new Game({ canvas, save: stubSave, audio: null });
  game.setQuality('high');
  game.resize(W, H, 1);
  game.setCharacter(charId, stubSave.data.upgrades);
  game.startRun(seed);
  return { game, canvas, stubSave };
}

function save(canvas, name) {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log('wrote', path.relative(root, file));
}

const t = 1.7;

// ------------------------------------------------------------- character sheet
{
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a0f3a');
  g.addColorStop(1, '#3a1d6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  CHARACTER_LIST.forEach((c, i) => {
    const x = 165 + i * 320;
    ctx.save();
    ctx.translate(x, 470);
    ctx.scale(2.1, 2.1);
    drawCharacter(ctx, c.id, {
      t: t + i,
      expr: 'happy',
      look: 0.4,
      rot: 0,
      squash: 1,
      stretch: 1,
      skill: 0,
      mode: 0,
    });
    ctx.restore();
    bigText(ctx, c.name, x, 700, 26, '#ffe86b', { stroke: PAL.ink, strokeWidth: 6 });
    bigText(ctx, c.skill.name, x, 736, 18, '#7ee8ff', { stroke: PAL.ink, strokeWidth: 4 });
    bigText(ctx, c.difficulty, x, 766, 14, c.difficulty === 'EASY' ? '#9ff7a0' : c.difficulty === 'MEDIUM' ? '#ffd93b' : '#ff8a8a', {
      stroke: PAL.ink, strokeWidth: 3,
    });
  });
  save(canvas, 'characters.png');
}

// ---------------------------------------------------------------- expressions
{
  const canvas = createCanvas(1400, 520);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#241238';
  ctx.fillRect(0, 0, 1400, 520);
  const exprs = ['happy', 'excited', 'panic', 'ouch', 'dead'];
  exprs.forEach((e, i) => {
    ctx.save();
    ctx.translate(140 + i * 280, 260);
    ctx.scale(1.5, 1.5);
    drawCharacter(ctx, 'frog', { t, expr: e, look: 0.3, squash: 1, stretch: 1 });
    ctx.restore();
    bigText(ctx, e.toUpperCase(), 140 + i * 280, 450, 18, '#ffe86b', { stroke: PAL.ink, strokeWidth: 4 });
    ctx.save();
    ctx.translate(140 + i * 280 + 150, 260);
    ctx.scale(1.2, 1.2);
    drawCharacter(ctx, 'chicken', { t: t + i, expr: e, look: 0.3, squash: 1, stretch: 1 });
    ctx.restore();
  });
  save(canvas, 'expressions.png');
}

// ------------------------------------------------------------------ item sheet
{
  const canvas = createCanvas(1400, 760);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 760);
  g.addColorStop(0, '#151033');
  g.addColorStop(1, '#2b1450');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1400, 760);
  const ids = Object.keys(ITEM_DEFS).filter((id) => id !== 'safetyNet');
  ids.forEach((id, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = 140 + col * 280;
    const y = 130 + row * 175;
    ctx.save();
    ctx.translate(x, y);
    drawItemArt(ctx, id, t + i * 0.3, { scale: 1.25 });
    ctx.restore();
    bigText(ctx, ITEM_DEFS[id].name, x, y + 74, 15, '#fff4d6', { stroke: PAL.ink, strokeWidth: 4 });
    bigText(ctx, ITEM_DEFS[id].desc, x, y + 96, 12, '#9ff7a0', { stroke: PAL.ink, strokeWidth: 3 });
  });
  save(canvas, 'items.png');
}

// --------------------------------------------------------------------- scenes
function shot(name, setup) {
  const { game, canvas } = makeGame(11, setup.char || 'frog');
  game.state = 'fly';
  setup(game);
  // frame like the live camera does mid-flight: player left-of-centre,
  // lead space and the arc below visible.
  game.camera.x = game.player.x + game.camera.vw * 0.14;
  game.camera.y = game.player.y + game.camera.vh * 0.16;
  game.camera.zoom = game.camera.baseZoom;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  renderScene(ctx, game, W, H, t, 'high', {});
  save(canvas, name);
}

function padAhead(game, minX) {
  for (const chunk of [...game.world.chunks.values()].sort((a, b) => a.x0 - b.x0)) {
    for (const pad of chunk.pads) {
      if (pad.support && pad.x > minX) return pad;
    }
  }
  return null;
}

shot('scene-launch.png', (game) => {
  game.state = 'launch';
  game.time = 1.2;
  game.launchPower = 0.52;
  game.launchHeld = true;
  game.player.launched = false;
  game.player.animState = 'launch';
  game.score.maxX = game.player.x;
});

shot('scene-lab.png', (game) => {
  const pad = padAhead(game, 2200) || padAhead(game, 0);
  game.player.x = pad.x - 260;
  game.player.y = pad.y - 420;
  game.player.vx = 1050;
  game.player.vy = -180;
  game.score.updateMax(game.player.x);
  game.score.combo = 7;
  game.score.comboTimer = 2;
  game.score.tierIndex = 2;
  game.particles.burst(game.player.x - 60, game.player.y, 30, { colour: ['#ffd93b', '#7ee8ff'], speed: 300, life: 0.7, glow: true });
});

shot('scene-wilds.png', (game) => {
  const metres = 1200;
  game.score.maxX = game.score.startX + metres * 18;
  game.world.ensure(game.score.maxX + 3600);
  const pad = padAhead(game, game.score.maxX) || padAhead(game, 0);
  game.player.x = pad.x - 300;
  game.player.y = pad.y - 380;
  game.player.vx = 1250;
  game.player.vy = 200;
  game.player.energy = 74;
  game.player.boosts = 2;
  game.score.updateMax(game.player.x);
  game.lastRegion = 'wilds';
});

shot('scene-clouds.png', (game) => {
  const metres = 3200;
  game.score.maxX = game.score.startX + metres * 18;
  game.world.ensure(game.score.maxX + 3600);
  const pad = padAhead(game, game.score.maxX) || padAhead(game, 0);
  game.player.x = pad.x - 420;
  game.player.y = pad.y - 520;
  game.player.vx = 1500;
  game.player.vy = -100;
  game.score.updateMax(game.player.x);
  game.lastRegion = 'clouds';
  game.player.buffs.balloon = 2;
});

shot('scene-illegal.png', (game) => {
  const metres = 7000;
  game.score.maxX = game.score.startX + metres * 18;
  game.world.ensure(game.score.maxX + 3600);
  const pad = padAhead(game, game.score.maxX) || padAhead(game, 0);
  game.player.x = pad.x - 300;
  game.player.y = pad.y - 460;
  game.player.vx = 1700;
  game.player.vy = 320;
  game.score.updateMax(game.player.x);
  game.score.combo = 16;
  game.score.tierIndex = 4;
  game.score.comboTimer = 2.5;
  game.lastRegion = 'illegal';
});

shot('scene-star.png', (game) => {
  const metres = 16000;
  game.score.maxX = game.score.startX + metres * 18;
  game.world.ensure(game.score.maxX + 3600);
  const pad = padAhead(game, game.score.maxX) || padAhead(game, 0);
  game.player.x = pad.x - 380;
  game.player.y = pad.y - 620;
  game.player.vx = 1900;
  game.player.vy = -260;
  game.score.updateMax(game.player.x);
  game.lastRegion = 'star';
  game.player.boosts = 4;
  game.player.maxBoosts = 5;
});

shot('scene-chicken.png', (game) => {
  const metres = 900;
  game.score.maxX = game.score.startX + metres * 18;
  game.world.ensure(game.score.maxX + 3600);
  const pad = padAhead(game, game.score.maxX) || padAhead(game, 0);
  game.player.x = pad.x - 500;
  game.player.y = pad.y - 700;
  game.player.vx = 1300;
  game.player.vy = 120;
  game.player.skillPulse = 1;
  game.player.buffs.parachute = 1;
  game.lastRegion = 'wilds';
}, 'chicken');

// ------------------------------------------------------------------- logo
{
  const canvas = createCanvas(900, 520);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 900, 520);
  ctx.save();
  ctx.translate(450, 270);
  drawLogo(ctx, 0, 0, 1.35, t);
  ctx.restore();
  save(canvas, 'logo.png');
}

console.log('art harness done');
