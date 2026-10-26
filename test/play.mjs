/**
 * Headless gameplay harness.
 * Drives the REAL Game class (physics, world streaming, items, skills, HUD
 * state) with a synthetic input device at a fixed 120 Hz. Optionally renders
 * gameplay frames to PNG so the visuals can be inspected without a browser.
 *
 *   node test/play.mjs [seed] [character] [seconds]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function loadCanvas() {
  for (const c of [
    '@napi-rs/canvas',
    path.join(root, 'node_modules/@napi-rs/canvas/index.js'),
    '/tmp/canvastest/node_modules/@napi-rs/canvas/index.js',
  ]) {
    try {
      return await import(c);
    } catch (_) {}
  }
  return null;
}

const { Game } = await import('../src/game/game.js');
const { defaultSave } = await import('../src/game/save.js');
const { CHARACTERS } = await import('../src/game/characters.js');
const { PHYS } = await import('../src/config/config.js');
const { renderScene } = await import('../src/art/scene.js');

const canvasMod = await loadCanvas();
const createCanvas = canvasMod?.createCanvas;

/** Minimal input device with the same interface as core/input.js. */
class BotInput {
  constructor() {
    this.held = { left: false, right: false, boost: false, skill: false };
    this.pressAt = { boost: -99, skill: -99 };
    this.clock = 0;
  }
  isDown(a) {
    return !!this.held[a];
  }
  get axis() {
    return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
  }
  buffered(a, now, win) {
    return now - (this.pressAt[a] ?? -99) <= win;
  }
  consume(a, now, win) {
    if (this.buffered(a, now, win)) {
      this.pressAt[a] = -99;
      return true;
    }
    return false;
  }
  press(a) {
    this.pressAt[a] = this.clock;
  }
  endFrame() {}
}

function makeGame(seed, charId) {
  const save = { data: defaultSave(), save() {} };
  save.data.unlocked = { frog: true, chicken: true, cheesus: true, pig: true, error404: true };
  const canvas = createCanvas ? createCanvas(1600, 900) : null;
  const events = { gameOver: null };
  const game = new Game({
    canvas,
    save,
    audio: null,
    onGameOver: (s) => {
      events.gameOver = s;
    },
  });
  game.resize(1600, 900, 1);
  game.setQuality('high');
  game.setCharacter(charId, {});
  game.startRun(seed);
  return { game, input: new BotInput(), events, save };
}

/** A competent pilot: steers to the next support pad, boosts when needed. */
function drive(game, input, mode = 'bot') {
  const p = game.player;
  const w = game.world;
  const s = game.stats;
  if (mode === 'none') {
    input.held.left = false;
    input.held.right = false;
    input.held.skill = false;
    return;
  }
  const pads = w.padsNear(p.x + 2200).filter((q) => q.support && !q.launchPad && q.x > p.x + 220);
  pads.sort((a, b) => a.x - b.x);
  const target = pads[0];
  input.held.left = false;
  input.held.right = false;
  if (target) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const g = PHYS.gravity * s.gravityMul;
    const disc = p.vy * p.vy + 2 * g * (dy + PHYS.collideRadius);
    let tt = disc > 0 ? (-p.vy + Math.sqrt(disc)) / g : 0.7;
    if (!(tt > 0.05)) tt = 0.7;
    const want = Math.max(700, Math.min(1400, dx / tt));
    const err = want - p.vx;
    // steer in proportion: a light tap of braking, never a full panic reversal
    input.held.right = err > 90;
    input.held.left = err < -160 && p.x > target.x - 1400;
    if (p.vx * tt < dx - 340 && p.boosts > 0 && !input.buffered('boost', game.time, 0.6)) {
      input.press('boost');
    }
  }

  if (mode === 'steer') return;
  const def = CHARACTERS[game.characterId];
  const cost = def.skill.cost * s.skillCostMul;
  const hasEnergy = p.energy > Math.max(cost * 1.6, 26);
  if (def.skill.hold) {
    input.held.skill = hasEnergy && (p.vy > 320 || (p.boosts === 0 && p.vy > 60));
  } else if (hasEnergy && p.skillCooldown <= 0 && !input.buffered('skill', game.time, 0.5)) {
    const want =
      (game.characterId === 'pig' && p.vy > 260 && p.y < w.floorAt(p.x) - 760) ||
      (game.characterId === 'error404' && (p.vy > 520 || p.vx < 900)) ||
      (game.characterId === 'frog' && p.vy > 520);
    if (want) input.press('skill');
  }
}

export function playRun(seed, charId = 'frog', opts = {}) {
  const { seconds = 120, shots = [], quality = 'high', outDir = path.join(root, '.art-out'), pilot = 'bot' } = opts;
  const { game, input, events } = makeGame(seed, charId);
  const dt = 1 / 120;
  const stats = {
    seed,
    charId,
    items: 0,
    boosts: 0,
    itemsById: {},
    shots: [],
    renderMs: [],
    minEnergy: 1e9,
    timeline: [],
    frames: 0,
  };
  const consume = game.consumeItem.bind(game);
  game.consumeItem = (it, def) => {
    stats.items++;
    stats.itemsById[it.id] = (stats.itemsById[it.id] || 0) + 1;
    return consume(it, def);
  };
  const tryBoost = game.tryBoost.bind(game);
  game.tryBoost = () => {
    const ok = tryBoost();
    if (ok) stats.boosts++;
    return ok;
  };

  game.fireLaunch();
  const shown = new Set();
  for (let i = 0; i < seconds * 120; i++) {
    input.clock = game.time;
    drive(game, input, pilot);
    game.update(dt, game.time, input);
    stats.frames++;
    stats.minEnergy = Math.min(stats.minEnergy, game.player.energy);
    if (game.state === 'dead') break;
    const m = Math.round(game.score.metres);
    for (const target of shots) {
      if (!shown.has(target) && m >= target) {
        shown.add(target);
        if (process.env.JTTS_DEBUG) {
          const c = game.camera;
          console.error('SHOT', m, 'state', game.state,
            'cam', c.x.toFixed(1), c.y.toFixed(1), c.zoom.toFixed(3),
            'vw', c.vw.toFixed(0), c.vh.toFixed(0),
            'player', game.player.x.toFixed(0), game.player.y.toFixed(0),
            'screen', JSON.stringify(c.worldToScreen(game.player.x, game.player.y, 1600, 900)));
        }
        if (game.canvas) {
          const ctx = game.canvas.getContext('2d');
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          const t0 = performance.now();
          try {
            renderScene(ctx, game, 1600, 900, game.time + 1.7, quality, {});
          } catch (err) {
            console.error('RENDER ERROR at', m, 'm:', err.message);
            console.error(err.stack.split('\n').slice(0, 4).join('\n'));
            stats.renderError = err.message;
          }
          stats.renderMs.push(+(performance.now() - t0).toFixed(2));
          fs.mkdirSync(outDir, { recursive: true });
          const file = path.join(outDir, `play-${charId}-${seed}-${m}m.png`);
          fs.writeFileSync(file, game.canvas.toBuffer('image/png'));
          stats.shots.push(path.relative(root, file));
        }
      }
    }
    if (i % 900 === 0) {
      stats.timeline.push({
        t: +game.time.toFixed(1),
        m: Math.round(game.score.metres),
        energy: Math.round(game.player.energy),
        boosts: game.player.boosts,
        combo: game.score.combo,
      });
    }
  }
  stats.metres = game.score.metres;
  stats.score = game.score.score;
  stats.maxCombo = game.score.bestCombo;
  stats.pads = game.runStats.springs;
  stats.padHits = game.runStats.padHits || 0;
  stats.nets = game.runStats.nets || 0;
  stats.skills = game.runStats.skills;
  stats.finalState = game.state;
  stats.summary = game.summary;
  stats.entityCount = game.world.entityCount;
  stats.chunks = game.world.chunks.size;
  stats.gameOverFired = !!events.gameOver;
  stats.region = game.region.id;
  return stats;
}

if (process.argv[1] && process.argv[1].endsWith('play.mjs')) {
  const seed = Number(process.argv[2] || 5);
  const char = process.argv[3] || 'frog';
  const secs = Number(process.argv[4] || 150);
  const r = playRun(seed, char, { seconds: secs, shots: [400, 1200, 3000, 6000, 12000] });
  delete r.summary;
  console.log(JSON.stringify(r, null, 1));
}
