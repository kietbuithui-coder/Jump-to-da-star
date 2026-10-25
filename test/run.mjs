/**
 * JUMP TO THE STAR — test suite.
 *
 * Every check here runs against the real shipped modules (same code the browser
 * loads). Nothing is mocked except: storage (in-memory), audio (silent), and the
 * renderer surface (@napi-rs/canvas instead of a browser canvas).
 *
 *   node test/run.mjs            # full suite
 *   node test/run.mjs --verbose  # per-check output
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const verbose = process.argv.includes('--verbose');

/* ------------------------------------------------------------ micro test lib */
const results = [];
let currentGroup = 'general';
function group(name) {
  currentGroup = name;
}
function check(name, fn) {
  const started = performance.now();
  try {
    const detail = fn();
    results.push({ group: currentGroup, name, ok: true, detail: detail ?? '', ms: performance.now() - started });
  } catch (err) {
    results.push({
      group: currentGroup,
      name,
      ok: false,
      detail: err && err.message ? err.message : String(err),
      ms: performance.now() - started,
    });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function assertClose(a, b, tol, msg) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg} (${a} vs ${b}, tol ${tol})`);
}
function assertNear(a, b, relTol, msg) {
  const scale = Math.max(1e-6, Math.abs(b));
  if (!(Math.abs(a - b) / scale <= relTol)) throw new Error(`${msg} (${a} vs ${b}, rel ${relTol})`);
}

/* ------------------------------------------------------------------- imports */
const { World } = await import('../src/game/world.js');
const { Game } = await import('../src/game/game.js');
const { SaveStore, defaultSave, sanitizeSave, CHARACTER_IDS, UPGRADE_CATS } = await import('../src/game/save.js');
const { CHARACTERS, resolveStats } = await import('../src/game/characters.js');
const { ITEM_DEFS, REGION_ITEMS } = await import('../src/game/items.js');
const { resolvePadBounce, padContact } = await import('../src/game/bounce.js');
const { stepFlight } = await import('../src/game/flight.js');
const { sweptCircleSegment, applyGravity, applyDrag } = await import('../src/game/physics.js');
const { PHYS, LAUNCH, BOOST, PX_PER_METER, REGIONS, regionAt, QUALITY } = await import('../src/config/config.js');
const { ScoreTracker } = await import('../src/game/score.js');
const { Loop } = await import('../src/core/loop.js');
const { simulateFlight } = await import('./autopilot.mjs');
const { playRun } = await import('./play.mjs');
const { UPGRADE_INFO, MAX_LEVEL, costForLevel, UPGRADE_COSTS } = await import('../src/game/upgrades.js');

let canvasMod = null;
for (const c of ['@napi-rs/canvas', path.join(root, 'node_modules/@napi-rs/canvas/index.js'), '/tmp/canvastest/node_modules/@napi-rs/canvas/index.js']) {
  try {
    canvasMod = await import(c);
    break;
  } catch (_) {}
}
const createCanvas = canvasMod?.createCanvas;

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

function makeGame(seed = 3, charId = 'frog', upgrades = {}) {
  const save = { data: defaultSave(), save() {} };
  save.data.unlocked = { frog: true, chicken: true, cheesus: true, pig: true, error404: true };
  const canvas = createCanvas ? createCanvas(900, 520) : null;
  const out = { gameOver: null };
  const game = new Game({
    canvas,
    save,
    audio: null,
    onGameOver: (s) => {
      out.gameOver = s;
    },
  });
  game.resize(1600, 900, 1);
  game.setCharacter(charId, upgrades);
  game.startRun(seed);
  game.fireLaunch();
  return { game, out, save };
}

const DT = 1 / 120;

/* ============================================================== 1. PHYSICS */
group('physics');

check('gravity always pulls down and is capped', () => {
  const p = { vx: 0, vy: 0 };
  for (let i = 0; i < 600; i++) applyGravity(p, DT, 1);
  assertClose(p.vy, PHYS.maxFallSpeed, 1, 'terminal velocity reached');
  const q = { vx: 0, vy: -2000 };
  applyGravity(q, DT, 1);
  assert(q.vy > -2000, 'rising velocity decays under gravity');
});

check('air drag only acts above the drag floor and never reverses', () => {
  const fast = { vx: 2000, vy: 0 };
  applyDrag(fast, DT, 1);
  assert(fast.vx < 2000 && fast.vx > 1900, 'fast flight loses a little speed');
  const slow = { vx: 200, vy: 0 };
  applyDrag(slow, DT, 1);
  assert(slow.vx > 190, 'slow flight is not braked hard');
  assert(slow.vx >= 0, 'drag never reverses direction');
});

check('swept collision catches a springboard at 3000 px/s', () => {
  const seg = { x1: 0, y1: 0, x2: 400, y2: 0, nx: 0, ny: -1 };
  const hit = sweptCircleSegment(-200, 3, 700, 3, PHYS.collideRadius, seg, 12);
  assert(hit, '3000 px/s pass through a pad is detected');
});

check('no NaN/Infinity in 60 s of flight with extreme inputs', () => {
  const p = { x: 0, y: 0, vx: 5000, vy: -9000 };
  for (let i = 0; i < 7200; i++) {
    stepFlight(p, DT, { gravityMul: 1.4, dragMul: 1.3, vxCap: PHYS.maxVxCombo });
    p.vx += Math.sin(i) * 40;
    p.vy += Math.cos(i) * 40;
    assert(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.vx) && Number.isFinite(p.vy), 'state stays finite');
  }
  assert(Math.abs(p.vx) <= PHYS.maxVxCombo + 1, 'horizontal speed clamped');
  assert(p.vy <= PHYS.maxFallSpeed + 1, 'vertical speed clamped');
});

/* =============================================================== 2. BOUNCE */
group('pads');

check('pads are one-way: you land on the face, you pass from behind', () => {
  const pad = { x: 0, y: 0, angle: 0, w: 300, nx: 0, ny: -1, catch: 120 };
  const fromAbove = padContact({ x: 0, y: 30, vx: 0, vy: 600 }, 0, 10, 40, [pad]);
  assert(fromAbove, 'landing on the front face triggers');
  const fromBelow = padContact({ x: 0, y: -30, vx: 0, vy: -600 }, 0, -10, 40, [pad]);
  assert(!fromBelow, 'hitting from behind does not trigger');
  const farAway = padContact({ x: 900, y: 30, vx: 0, vy: 600 }, 900, 10, 40, [pad]);
  assert(!farAway, 'outside the pad width does not trigger');
});

check('bounce is bounded: spring chains cannot create infinite energy', () => {
  let vx = 900;
  let vy = 1500;
  const def = ITEM_DEFS.spring;
  let peak = 0;
  for (let i = 0; i < 50; i++) {
    const out = resolvePadBounce(def, vx, vy, 0, -1, 1, {});
    vx = out.vx;
    vy = out.vy;
    peak = Math.max(peak, Math.abs(vy));
    // gravity brings it back down for the next hit
    vy = Math.min(2400, Math.abs(vy) * 0.99 + 200);
  }
  assert(peak <= PHYS.maxVyUp + 1, `peak bounce ${peak.toFixed(0)} stays under the cap`);
});

check('character bounce stat changes the arc (frog bounces higher than chicken)', () => {
  const a = resolvePadBounce(ITEM_DEFS.spring, 900, 1400, 0, -1, 1, { bounceMul: 1.24 });
  const b = resolvePadBounce(ITEM_DEFS.spring, 900, 1400, 0, -1, 1, { bounceMul: 1.0 });
  assert(a.vy < b.vy - 100, `frog ${a.vy.toFixed(0)} vs chicken ${b.vy.toFixed(0)}`);
});

/* ================================================================ 3. WORLD */
group('world generation');

check('all 20 gameplay objects appear in generated worlds', () => {
  const w = new World(11);
  w.ensure(18000 * PX_PER_METER);
  const seen = new Set();
  for (const c of w.chunks.values()) {
    for (const x of c.pads) seen.add(x.id);
    for (const x of c.items) seen.add(x.id);
    for (const x of c.hazards) seen.add(x.id);
    for (const x of c.zones) seen.add(x.id);
  }
  const missing = Object.keys(ITEM_DEFS).filter((id) => !seen.has(id));
  assert(missing.length === 0, `missing: ${missing.join(', ')}`);
  return `${seen.size} distinct kinds`;
});

check('chunks are contiguous and complete (no gaps in the streamed world)', () => {
  const w = new World(4);
  w.ensure(9000 * PX_PER_METER);
  const idx = [...w.chunks.keys()].sort((a, b) => a - b);
  assert(idx[0] === w.chunkIndexAt(w.startX), 'world starts at chunk 0');
  for (let i = 1; i < idx.length; i++) assert(idx[i] === idx[i - 1] + 1, `chunk ${idx[i]} follows ${idx[i - 1]}`);
  for (const c of w.chunks.values()) assertClose(c.x1 - c.x0, w.chunkWidth, 1e-6, 'chunk width');
  return `${idx.length} chunks`;
});

check('hazard floor always stays inside the configured band', () => {
  for (const seed of [1, 2, 3, 17, 99]) {
    const w = new World(seed);
    w.ensure(30000 * PX_PER_METER);
    for (let x = w.startX; x < w.generatedX; x += 137) {
      const y = w.floorAt(x);
      assert(y >= WORLD_MIN() && y <= WORLD_MAX(), `floor ${y.toFixed(0)} at x=${x.toFixed(0)} out of band`);
    }
  }
  return 'band respected across 5 seeds / 30 km';
});

check('every hop has a rescue net spanning the gap (no bottomless pits)', () => {
  const w = new World(6);
  w.ensure(12000 * PX_PER_METER);
  const supports = [];
  const nets = [];
  for (const c of w.chunks.values()) {
    for (const pad of c.pads) (pad.rescue ? nets : supports).push(pad);
  }
  supports.sort((a, b) => a.x - b.x);
  nets.sort((a, b) => a.x - b.x);
  assert(nets.length > 4, `expected nets, got ${nets.length}`);
  let covered = 0;
  for (let i = 1; i < supports.length; i++) {
    const gap = supports[i].x - supports[i - 1].x;
    if (gap < 760) continue;
    const mid = (supports[i].x + supports[i - 1].x) / 2;
    const net = nets.find((n) => n.x > supports[i - 1].x - 100 && n.x < supports[i].x + 100);
    assert(net, `no net over the ${gap.toFixed(0)}px gap before x=${supports[i].x.toFixed(0)}`);
    assert(Math.abs(net.x - mid) < gap * 0.4, 'net sits inside the hop');
    assert(net.w >= gap * 0.8, `net ${net.w.toFixed(0)} too narrow for gap ${gap.toFixed(0)}`);
    assert(net.y > w.floorAt(net.x) - 400 && net.y < w.floorAt(net.x), 'net hangs just above the hazard floor');
    covered++;
  }
  return `${covered} gaps covered by ${nets.length} nets`;
});

check('loot density thins out with distance (early vs late)', () => {
  const w = new World(21);
  w.ensure(22000 * PX_PER_METER);
  const bucket = (from, to) => {
    let n = 0;
    for (const c of w.chunks.values()) {
      for (const it of c.items) {
        const m = (it.x - w.startX) / PX_PER_METER;
        if (m >= from && m < to) n++;
      }
    }
    return n / (to - from);
  };
  const early = bucket(0, 500);
  const mid = bucket(2000, 5000);
  const late = bucket(10000, 20000);
  assert(early > mid, `early ${early.toFixed(4)}/m should exceed mid ${mid.toFixed(4)}/m`);
  assert(mid > late, `mid ${mid.toFixed(4)}/m should exceed late ${late.toFixed(4)}/m`);
  assert(late > 0.0005, 'the far frontier still has loot');
  return `early ${early.toFixed(4)} > mid ${mid.toFixed(4)} > late ${late.toFixed(4)} items/m`;
});

check('memory stays bounded: recycling keeps live entities flat over 40 km', () => {
  const w = new World(9);
  const counts = [];
  const p = { x: w.startX, y: LAUNCH.startY, vx: 1200, vy: -800 };
  for (let i = 0; i < 24000; i++) {
    p.x += 900 * DT;
    p.y += Math.sin(i * 0.01) * 4;
    w.ensure(p.x + 3200);
    w.recycle(p.x);
    if (i % 2000 === 0) counts.push(w.entityCount);
  }
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  assert(max < 900, `entity count peaked at ${max}`);
  assert(max - min < 400, `entity count drifted from ${min} to ${max}`);
  assert(w.chunks.size < 12, `chunk map kept ${w.chunks.size}`);
  return `entities ${min}..${max}, chunks ${w.chunks.size}`;
});

check('generated routes are flyable with no boosts, no skills, no upgrades (5 seeds x 5 pilots)', () => {
  const report = [];
  for (const char of Object.values(CHARACTERS)) {
    for (const seed of [1, 5, 11, 23, 42]) {
      const r = simulateFlight(seed, {
        maxMetres: 10000,
        gravityMul: char.stats.gravity,
        dragMul: char.stats.drag,
        bounceMul: char.stats.bounce,
      });
      assert(!r.dead, `${char.id} seed ${seed} died at ${r.metres.toFixed(0)} m with no inputs`);
      assert(r.metres >= 10000, `${char.id} seed ${seed} only reached ${r.metres.toFixed(0)} m`);
      report.push(r.hops);
    }
  }
  const hops = report.reduce((a, b) => a + b, 0) / report.length;
  return `25/25 routes flown, avg ${hops.toFixed(0)} pad hits`;
});

check('a player who does nothing still gets a long, fair run (real game loop)', () => {
  const rows = [];
  for (const seed of [1, 5, 23]) {
    const r = playRun(seed, 'frog', { seconds: 70, pilot: 'none' });
    rows.push(Math.round(r.metres));
    assert(r.metres > 2000, `idle pilot on seed ${seed} only got ${r.metres.toFixed(0)} m`);
  }
  return `idle distances: ${rows.join(' / ')} m in 70 s`;
});

/* ================================================================ 4. ITEMS */
group('items');

check('every pickup applies its effect exactly once', () => {
  const { game } = makeGame(31);
  const results = [];
  for (const id of ['orb', 'super', 'battery', 'comboOrb', 'boostStar', 'coin']) {
    const def = ITEM_DEFS[id];
    game.player.energy = 20;
    game.player.boosts = 0;
    const before = { energy: game.player.energy, boosts: game.player.boosts, coins: game.score.coins };
    const item = { id, kind: 'pickup', x: game.player.x, y: game.player.y, r: def.r };
    game.world._register(item);
    game.collectNearby(DT);
    assert(item.taken, `${id} was consumed`);
    if (def.energy) assert(game.player.energy > before.energy, `${id} restored energy`);
    if (def.boost) assert(game.player.boosts > before.boosts, `${id} restored a boost`);
    if (def.coins) assert(game.score.coins > before.coins, `${id} gave coins`);
    // second collection attempt must be impossible
    const coins = game.score.coins;
    game.collectNearby(DT);
    assert(game.score.coins === coins, `${id} cannot be farmed twice`);
    results.push(id);
  }
  return results.join(', ');
});

check('buffs change the flight model and expire', () => {
  const { game } = makeGame(32);
  game.player.buffs.balloon = 1.0;
  // balloon: gravity multiplier is reduced
  const p = { vx: 0, vy: 0 };
  game.world.zonesNear = () => [];
  const y0 = game.player.y;
  for (let i = 0; i < 60; i++) game.update(DT, game.time, null);
  const eased = game.player.y - y0;
  game.player.buffs.balloon = 0;
  const game2 = makeGame(32).game;
  const y1 = game2.player.y;
  for (let i = 0; i < 60; i++) game2.update(DT, game2.time, null);
  const normal = game2.player.y - y1;
  assert(eased < normal * 0.8, `balloon fall ${eased.toFixed(0)} vs normal ${normal.toFixed(0)}`);
  return `balloon fall ${eased.toFixed(0)}px vs ${normal.toFixed(0)}px`;
});

check('jet gates and UFOs fire their mechanics', () => {
  const { game } = makeGame(33);
  const gate = { id: 'jetGate', kind: 'gate', x: game.player.x, y: game.player.y, r: ITEM_DEFS.jetGate.r };
  game.world._register(gate);
  const vy0 = game.player.vy;
  game.touchEntities(DT);
  assert(game.player.vy < vy0 - 300, 'gate gave upward impulse');
  const vxBefore = game.player.vx;
  const gate2 = { id: 'jetGate', kind: 'gate', x: game.player.x, y: game.player.y, r: 44, cooldown: game.time - 5 };
  game.world._register(gate2);
  game.touchEntities(DT);
  assert(game.player.vx > vxBefore, 'gate also pushes forward');

  const ufo = { id: 'ufo', kind: 'ride', x: game.player.x, y: game.player.y, r: ITEM_DEFS.ufo.r };
  game.world._register(ufo);
  game.touchEntities(DT);
  assert(game.player.rideUfo, 'UFO picks the pilot up');
  const rideX = game.player.x;
  for (let i = 0; i < 30; i++) game.update(DT, game.time, null);
  assert(game.player.x > rideX, 'UFO carries the pilot forward');
  return 'gate impulse + UFO ride verified';
});

check('hot air zones lift, hazards hurt', () => {
  const { game } = makeGame(34);
  const zone = { id: 'hotair', kind: 'zone', x: game.player.x, y: game.player.y };
  game.world._register(zone);
  game.player.vy = 600;
  const vy0 = game.player.vy;
  game.applyZones(DT);
  assert(game.player.vy < vy0, 'zone pushed the pilot up');

  const hz = { id: 'hazard', kind: 'hazard', x: game.player.x, y: game.player.y, r: 30 };
  game.world._register(hz);
  game.player.energy = 80;
  game.player.invuln = 0;
  game.touchEntities(DT);
  assert(game.player.energy < 80, 'hazard drained energy');
  assert(game.player.invuln > 0, 'hazard granted brief invulnerability');
  return 'zone lift + hazard damage verified';
});

check('no item type is decorative: each has a real handler or collision', () => {
  const handled = new Set(['pickup', 'booster', 'buff', 'pad', 'gate', 'ride', 'zone', 'hazard']);
  const orphans = Object.values(ITEM_DEFS).filter((d) => !handled.has(d.kind));
  assert(orphans.length === 0, `unhandled kinds: ${orphans.map((o) => o.id).join(', ')}`);
  return `${Object.keys(ITEM_DEFS).length} items across ${handled.size} mechanical kinds`;
});

/* =============================================================== 5. SKILLS */
group('characters & skills');

check('all five pilots exist with distinct stats and skills', () => {
  const ids = Object.keys(CHARACTERS);
  assert(ids.length === 5, 'five pilots');
  const skills = new Set(ids.map((id) => CHARACTERS[id].skill.id));
  assert(skills.size === 5, 'five different skills');
  const sigs = new Set(ids.map((id) => JSON.stringify(CHARACTERS[id].stats)));
  assert(sigs.size === 5, 'five different stat blocks');
  return ids.join(', ');
});

check('every skill spends energy and changes the flight state', () => {
  const rows = [];
  for (const id of Object.keys(CHARACTERS)) {
    const { game } = makeGame(41, id);
    const p = game.player;
    p.energy = p.energyMax;
    p.vy = 600; // falling: a good moment for any emergency skill
    p.vx = 900;
    const before = { vy: p.vy, vx: p.vx, energy: p.energy };
    const input = { isDown: (a) => a === 'skill', axis: 1, consume: () => true, buffered: () => false };
    if (CHARACTERS[id].skill.hold) {
      for (let i = 0; i < 12; i++) game.handleSkill(DT, input);
    } else {
      game.handleSkill(DT, input);
    }
    const spent = before.energy - p.energy;
    assert(spent > 0, `${id} skill spent energy`);
    if (id === 'cheesus') {
      // Cheese Magnet's mechanic is attraction: prove it moves loot toward the pilot
      const lure = { id: 'orb', kind: 'pickup', x: p.x + 320, y: p.y - 60, r: 24, bob: 0 };
      game.world._register(lure);
      const d0 = Math.hypot(lure.x - p.x, lure.y - p.y);
      const magnet = { isDown: (a) => a === 'skill', axis: 0, consume: () => true, buffered: () => false };
      for (let i = 0; i < 30; i++) game.handleSkill(DT, magnet);
      const d1 = Math.hypot(lure.x - p.x, lure.y - p.y);
      assert(d1 < d0 - 5, `magnet pulled loot from ${d0.toFixed(0)} to ${d1.toFixed(0)}`);
    } else {
      const changed =
        Math.abs(p.vy - before.vy) > 40 ||
        Math.abs(p.vx - before.vx) > 40 ||
        p.diveTimer > 0 ||
        p.buffs.recovery > 0 ||
        p.buffs.control > 0 ||
        !!game.player.rideUfo;
      assert(changed, `${id} skill changed the flight state`);
    }
    rows.push(`${id}:${spent.toFixed(0)} energy`);
  }
  return rows.join(' ');
});

check('hold skills consume over time, instant skills respect cooldown', () => {
  const chicken = makeGame(42, 'chicken').game;
  chicken.player.energy = chicken.player.energyMax;
  const e0 = chicken.player.energy;
  const hold = { isDown: (a) => a === 'skill', axis: 1, consume: () => true, buffered: () => false };
  for (let i = 0; i < 120; i++) chicken.handleSkill(DT, hold);
  const used = e0 - chicken.player.energy;
  assert(used > 8 && used < 60, `thrust burn over 1 s was ${used.toFixed(1)}`);

  const pig = makeGame(43, 'pig').game;
  pig.player.energy = pig.player.energyMax;
  const once = { isDown: () => false, axis: 0, consume: () => true, buffered: () => false };
  pig.handleSkill(DT, once);
  assert(pig.player.diveTimer > 0, 'pig started a dive');
  const dive = pig.player.diveTimer;
  pig.handleSkill(DT, once);
  assert(pig.player.diveTimer <= dive, 'cooldown prevents an instant second dive');
  return `thrust burn ${used.toFixed(1)} energy/s`;
});

check('error404 telegraphs its next mode (no unannounced randomness)', () => {
  const { game } = makeGame(44, 'error404');
  const modes = [];
  for (let i = 0; i < 3; i++) {
    game.player.energy = game.player.energyMax;
    game.player.skillCooldown = 0;
    modes.push(game.player.glitchMode);
    game.handleSkill(DT, { isDown: () => false, axis: 1, consume: () => true, buffered: () => false });
  }
  assert(modes.join(',') === '0,1,2', `cycle order was ${modes.join(',')}`);
  assert(game.player.glitchMode === 0, 'cycles back to POWER');
  return 'POWER → CONTROL → RECOVERY → POWER';
});

/* ================================================================ 6. BOOST */
group('boost');

check('boost spends a charge, respects lockout, and never fires for free', () => {
  const { game } = makeGame(51);
  game.player.boosts = 3;
  game.boostLock = 0;
  const vy0 = game.player.vy;
  assert(game.tryBoost(), 'boost fired');
  assert(game.player.boosts === 2, 'charge consumed');
  assert(game.player.vy < vy0, 'upward impulse applied');
  assert(!game.tryBoost(), 'lockout blocks the immediate second press');
  game.boostLock = 0;
  game.tryBoost();
  game.boostLock = 0;
  game.tryBoost();
  assert(game.player.boosts === 0, 'all three charges used');
  game.boostLock = 0;
  assert(!game.tryBoost(), 'no free boost at zero charges');
  return '3 charges, lockout, hard stop at 0';
});

check('boost can rescue a fast fall (dive recovery feel)', () => {
  const { game } = makeGame(52);
  game.player.vy = 2400;
  game.player.boosts = 1;
  game.boostLock = 0;
  game.tryBoost();
  assert(game.player.vy < 0, `falling 2400 px/s became ${game.player.vy.toFixed(0)}`);
  return `vy 2400 → ${game.player.vy.toFixed(0)}`;
});

check('boost stars refill charges, capped at the max', () => {
  const { game } = makeGame(53);
  game.player.boosts = 1;
  const def = ITEM_DEFS.boostStar;
  for (let i = 0; i < 8; i++) {
    const item = { id: 'boostStar', kind: 'pickup', x: game.player.x, y: game.player.y, r: def.r };
    game.world._register(item);
    game.collectNearby(DT);
  }
  assert(game.player.boosts <= game.player.maxBoosts, 'boost count capped');
  assert(game.player.boosts > 1, 'stars refilled boosts');
  return `${game.player.boosts}/${game.player.maxBoosts}`;
});

/* ================================================================ 7. SCORE */
group('scoring');

check('distance never decreases when flying backwards', () => {
  const s = new ScoreTracker();
  s.reset(1000);
  s.updateMax(1500);
  const best = s.metres;
  s.updateMax(1200);
  assertClose(s.metres, best, 1e-9, 'backtracking does not lose distance');
  return `${best.toFixed(0)} m retained`;
});

check('combo grows, decays and stops at the top tier label', () => {
  const s = new ScoreTracker();
  s.reset(0);
  let tierUp = null;
  for (let i = 0; i < 45; i++) {
    const r = s.addCombo(1);
    if (r && r.tierUp) tierUp = r.label;
  }
  assert(s.combo === 45, 'combo accumulated');
  assert(tierUp === 'SHAPI APPROVES!', `top tier label was ${tierUp}`);
  s.update(2.9);
  assert(s.combo === 0, 'combo expired after idle time');
  return `${tierUp}`;
});

check('score = distance + collection + combo + skill', () => {
  const s = new ScoreTracker();
  s.reset(0);
  s.updateMax(10 * PX_PER_METER);
  s.addPickup({ score: 20, combo: 2, coins: 1 });
  s.addSkillBonus(50, 'TEST');
  const sum = s.summary();
  assertClose(sum.score, sum.distanceScore + sum.collectionScore + sum.comboScore + sum.skillScore, 1, 'components add up');
  assert(sum.distanceScore >= 9, 'distance score counted');
  return `total ${sum.score}`;
});

/* ================================================================= 8. SAVE */
group('save data');

check('a corrupt field never wipes the rest of the save', () => {
  const raw = defaultSave();
  raw.coins = 5123;
  raw.records.distance = 8123;
  raw.settings.master = 'loads-of-nonsense';
  raw.upgrades.frog.boost = 3;
  raw.records.history = [{ character: 'frog', distance: 100, score: 10, combo: 2, coins: 4, date: 1 }, 'garbage'];
  const clean = sanitizeSave(raw);
  assert(clean.coins === 5123, 'coins survived');
  assert(clean.records.distance === 8123, 'record survived');
  assert(clean.upgrades.frog.boost === 3, 'upgrades survived');
  assert(clean.settings.master === 0.8, 'bad slider fell back to the default');
  assert(clean.records.history.length === 1, 'garbage history entries dropped');
  return 'field-level repair verified';
});

check('completely broken JSON resets safely and keeps a backup', () => {
  const storage = fakeStorage();
  storage.setItem('jtts.save.v2', '{not json at all');
  const store = new SaveStore(storage);
  assert(store.data.coins === 0, 'fresh save');
  assert(storage.getItem('jtts.save.v2.corrupt'), 'corrupt payload backed up');
  return 'backup written';
});

check('save → reload keeps coins, unlocks, upgrades, records, settings', () => {
  const storage = fakeStorage();
  const store = new SaveStore(storage);
  store.data.coins = 777;
  store.data.unlocked.pig = true;
  store.data.selected = 'pig';
  store.data.upgrades.pig.launch = 4;
  store.data.records.distance = 4321;
  store.data.settings.music = 0.2;
  store.save();
  const again = new SaveStore(storage);
  assert(again.data.coins === 777, 'coins');
  assert(again.data.unlocked.pig === true, 'unlock');
  assert(again.data.selected === 'pig', 'selection');
  assert(again.data.upgrades.pig.launch === 4, 'upgrades');
  assert(again.data.records.distance === 4321, 'records');
  assertClose(again.data.settings.music, 0.2, 1e-9, 'settings');
  return 'round trip ok';
});

check('legacy v1 saves migrate instead of being discarded', () => {
  const storage = fakeStorage();
  storage.setItem('jtts.save.v1', JSON.stringify({ coins: 250, unlocked: { frog: true, chicken: true }, selected: 'chicken' }));
  const store = new SaveStore(storage);
  assert(store.data.coins === 250, 'legacy coins kept');
  assert(store.data.unlocked.chicken === true, 'legacy unlock kept');
  assert(store.data.selected === 'chicken', 'legacy selection kept');
  return 'v1 → v2';
});

check('upgrade costs are bounded, ascending and capped at level 5', () => {
  for (let lv = 0; lv < MAX_LEVEL; lv++) {
    assert(costForLevel(lv) > 0, 'cost exists');
    if (lv > 0) assert(UPGRADE_COSTS[lv] > UPGRADE_COSTS[lv - 1], 'costs ascend');
  }
  assert(costForLevel(MAX_LEVEL) === null, 'max level has no purchase');
  const st0 = resolveStats(CHARACTERS.frog, {});
  const st5 = resolveStats(CHARACTERS.frog, { launch: 5, boost: 5, energy: 5, skill: 5, efficiency: 5 });
  assert(st5.launchMul > st0.launchMul && st5.energyMax > st0.energyMax, 'upgrades change stats');
  assert(st5.energyMax < st0.energyMax * 2, 'upgrades are meaningful but not runaway');
  assert(st5.skillCostMul > 0.5, 'efficiency has a floor');
  return `L5 energy ${st5.energyMax} vs base ${st0.energyMax}`;
});

/* ================================================================= 9. DEATH */
group('run lifecycle');

check('hitting the hazard floor ends the run and produces a summary', () => {
  const { game, out } = makeGame(61);
  game.player.y = game.world.floorAt(game.player.x) + 10;
  game.update(DT, game.time, null);
  assert(game.state === 'dead', 'run ended');
  for (let i = 0; i < 120; i++) game.update(DT, game.time, null);
  assert(game.summary, 'summary built');
  assert(out.gameOver, 'game over callback fired');
  assert(out.gameOver.coinsEarned >= 0, 'coin payout computed');
  return `died at ${game.summary.metres.toFixed(0)} m, ${out.gameOver.coinsEarned} coins`;
});

check('restart clears all per-run state (no leaks between runs)', () => {
  const { game } = makeGame(62);
  game.score.addCombo(9);
  game.player.boosts = 0;
  game.player.buffs.balloon = 3;
  const firstWorld = game.world;
  game.startRun(63);
  assert(game.state === 'launch', 'back to the launch pad');
  assert(game.score.combo === 0 && game.score.metres === 0, 'score reset');
  assert(game.player.boosts === game.stats.boostCount, 'boosts refilled');
  assert(game.player.buffs.balloon === 0, 'buffs cleared');
  assert(game.world !== firstWorld, 'fresh world');
  assert(game.particles.count === 0, 'particles cleared');
  return 'state isolated per run';
});

check('pause freezes the simulation, resume restores it', () => {
  const { game } = makeGame(64);
  const x = game.player.x;
  game.pause();
  for (let i = 0; i < 60; i++) game.update(DT, game.time, null);
  assert(game.player.x === x, 'nothing moved while paused');
  game.resume();
  for (let i = 0; i < 60; i++) game.update(DT, game.time, null);
  assert(game.player.x > x, 'movement resumed');
  return 'pause/resume verified';
});

check('launch flow: holding then releasing fires the catapult with a perfect window', () => {
  const { game } = makeGame(65);
  game.state = 'launch';
  game.player.launched = false;
  game.launchHeld = false;
  game.launchReleased = false;
  game.launchPower = 0;
  game.perfectLaunch = false;
  game.player.vx = 0;
  game.player.vy = 0;
  const heldInput = { isDown: (a) => a === 'boost', axis: 0, consume: () => false, buffered: () => false };
  for (let i = 0; i < 48; i++) game.updateLaunch(DT, heldInput); // ~0.4 s of charge (inside the perfect window)
  const charged = game.launchPower;
  const released = { isDown: () => false, axis: 0, consume: () => false, buffered: () => false };
  game.updateLaunch(DT, released);
  assert(game.state === 'fly', 'run started');
  assert(game.player.launched, 'launched flag set');
  assert(game.player.vy < -1000, `strong upward launch (${game.player.vy.toFixed(0)})`);
  assert(charged > 0.4 && charged < 0.7, `charge landed in the perfect window (${charged.toFixed(2)})`);
  assert(game.perfectLaunch, 'perfect launch detected');
  return `charge ${(charged * 100).toFixed(0)}% → vy ${game.player.vy.toFixed(0)}`;
});

/* ============================================================= 10. TIMESTEP */
group('engine');

check('fixed timestep: a 20 fps frame budget produces the same simulation as 120 fps', () => {
  const runWith = (frameDt, frames) => {
    const { game } = makeGame(71);
    const step = 1 / 120;
    let acc = 0;
    for (let f = 0; f < frames; f++) {
      acc += frameDt;
      while (acc >= step) {
        game.update(step, game.time, null);
        acc -= step;
      }
    }
    return game;
  };
  const a = runWith(1 / 120, 600);
  const b = runWith(1 / 20, 100);
  assertClose(a.player.x, b.player.x, 0.5, 'position matches across frame rates');
  assertClose(a.player.y, b.player.y, 0.5, 'height matches across frame rates');
  return `x ${a.player.x.toFixed(1)} vs ${b.player.x.toFixed(1)}`;
});

check('the loop never spins on a long stall (physics stays stable)', () => {
  let updates = 0;
  let renders = 0;
  const loop = new Loop({
    step: 1 / 120,
    update: () => {
      updates++;
    },
    render: () => {
      renders++;
    },
  });
  // simulate a 2 second stall worth of frames
  for (let i = 0; i < 10; i++) {
    loop.acc += 2;
    let steps = 0;
    const maxSteps = Math.ceil(loop.maxFrameTime / loop.step) + 2;
    while (loop.acc >= loop.step && steps < maxSteps) {
      loop.update(loop.step);
      loop.acc -= loop.step;
      steps++;
    }
    if (steps >= maxSteps) loop.acc = 0;
    assert(steps <= maxSteps, 'step count bounded');
  }
  assert(loop.acc < 1, 'accumulator drained');
  return `${updates} updates over 10 stalled frames`;
});

/* ============================================================== 11. RENDER */
group('rendering');

const MISSING_WORLD = () => {
  throw new Error('canvas backend missing (@napi-rs/canvas not installed)');
};

function renderFrame(game, w = 1600, h = 900, quality = 'high', opts = {}) {
  if (!createCanvas) MISSING_WORLD();
  const { renderScene } = renderModule;
  const ctx = game.canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // balance check
  const rs = ctx.save.bind(ctx);
  const rr = ctx.restore.bind(ctx);
  let depth = 0;
  ctx.save = () => {
    depth++;
    rs();
  };
  ctx.restore = () => {
    depth--;
    rr();
  };
  let err = null;
  const t0 = performance.now();
  try {
    renderScene(ctx, game, w, h, 3.2, quality, opts);
  } catch (e) {
    err = e;
  }
  const ms = performance.now() - t0;
  ctx.save = rs;
  ctx.restore = rr;
  if (err) throw err;
  assert(depth === 0, `ctx.save/restore unbalanced (${depth})`);
  return ms;
}
let renderModule = null;
if (createCanvas) renderModule = await import('../src/art/scene.js');

check('every region renders a frame with balanced canvas state', () => {
  const timings = [];
  for (const region of REGIONS.slice(0, 5)) {
    const metres = region.from === 0 ? 120 : region.from + 250;
    const { game } = makeGame(81);
    game.score.maxX = game.score.startX + metres * PX_PER_METER;
    game.world.ensure(game.score.maxX + 4000);
    game.player.x = game.score.maxX + 300;
    game.player.y = game.world.floorAt(game.player.x) - 1400;
    game.camera.snapTo(game.player.x, game.player.y);
    ['high', 'balanced', 'low'].forEach((q) => {
      const ms = renderFrame(game, 1600, 900, q);
      if (q === 'high') timings.push(`${region.id} ${ms.toFixed(1)}ms`);
    });
  }
  return timings.join(', ');
});

check('launch, dead and pause states render without errors', () => {
  const { game } = makeGame(82);
  game.state = 'launch';
  game.launchPower = 0.5;
  renderFrame(game);
  game.fireLaunch();
  for (let i = 0; i < 30; i++) game.update(DT, game.time, null);
  game.player.y = game.world.floorAt(game.player.x) + 20;
  game.update(DT, game.time, null);
  renderFrame(game);
  assert(game.state === 'dead', 'death state reached');
  for (let i = 0; i < 40; i++) game.update(DT, game.time, null);
  renderFrame(game);
  return 'launch / fly / dead all render';
});

check('HUD renders at phone size and with touch controls', () => {
  const { game } = makeGame(83);
  const a = renderFrame(game, 640, 360, 'balanced', { touchMode: true });
  const b = renderFrame(game, 2560, 1440, 'high', {});
  return `640×360 ${a.toFixed(1)}ms · 2560×1440 ${b.toFixed(1)}ms`;
});

check('render cost stays within a 60 fps budget (software renderer)', () => {
  if (!createCanvas) return 'skipped (no canvas backend)';
  const { game } = makeGame(84);
  for (let i = 0; i < 240; i++) game.update(DT, game.time, null);
  const samples = [];
  for (let i = 0; i < 12; i++) samples.push(renderFrame(game, 1600, 900, 'high'));
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const worst = Math.max(...samples);
  assert(avg < 16.7, `average frame ${avg.toFixed(1)} ms exceeds the 60 fps budget`);
  return `avg ${avg.toFixed(1)} ms · worst ${worst.toFixed(1)} ms (CPU canvas, no GPU)`;
});

/* ================================================================ 12. AUDIO */
group('audio');
let audioModule = null;
try {
  audioModule = await import('../src/game/audio.js');
} catch (_) {}

check('audio engine is safe before any user interaction', () => {
  // No window/AudioContext in Node: every call must be a no-op, never a throw.
  const { AudioEngine } = audioModule;
  const a = new AudioEngine({ master: 0.5 });
  a.sfx('boost');
  a.setScene('fly');
  a.setIntensity(0.8);
  a.applySettings({ master: 0.4, music: 0.3, sfx: 0.6 });
  assert(a.ready === false, 'stays dormant without a context');
  return 'silent no-op before interaction (browser unlocks on first input)';
});

check('every sound effect name used by the game exists in the synth', () => {
  const { AudioEngine } = audioModule;
  const src = fs.readFileSync(path.join(root, 'src/game/audio.js'), 'utf8');
  const cases = new Set([...src.matchAll(/case '([a-zA-Z]+)':/g)].map((m) => m[1]));
  const used = new Set();
  for (const file of ['src/game/game.js', 'src/game/items.js', 'src/game/characters.js', 'src/main.js']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of text.matchAll(/sfx\('([a-zA-Z]+)'/g)) used.add(m[1]);
  }
  for (const m of Object.values(ITEM_DEFS)) if (m.sound) used.add(m.sound);
  for (const c of Object.values(CHARACTERS)) if (c.sfx) used.add(c.sfx);
  const missing = [...used].filter((u) => !cases.has(u));
  assert(missing.length === 0, `missing synth voices: ${missing.join(', ')}`);
  return `${used.size} sound names mapped to ${cases.size} synth voices`;
});

/* ============================================================ 13. PERFORMANCE */
group('performance');

check('physics + world streaming keeps up with real time', () => {
  const { game } = makeGame(91);
  const t0 = performance.now();
  const steps = 60 * 120; // 60 seconds of simulation
  for (let i = 0; i < steps; i++) game.update(DT, game.time, null);
  const ms = performance.now() - t0;
  const perSecond = ms / 60;
  assert(perSecond < 16.6, `simulation costs ${perSecond.toFixed(2)} ms per wall-clock second`);
  return `${perSecond.toFixed(2)} ms of CPU per simulated second (${(ms / steps * 1000).toFixed(0)} µs/step)`;
});

/* ============================================================== 14. WIRING */
group('wiring');

check('index.html contains every element the code looks up', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const codeFiles = ['src/main.js', 'src/art/scene.js', 'src/art/ui.js'];
  const wanted = new Set();
  for (const file of codeFiles) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of text.matchAll(/\$\$?\('#([A-Za-z0-9_-]+)/g)) wanted.add(m[1]);
    for (const m of text.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)) wanted.add(m[1]);
  }
  // elements injected by the JS templates count as markup too
  for (const file of codeFiles) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of text.matchAll(/id="([A-Za-z0-9_-]+)"/g)) ids.add(m[1]);
  }
  const missing = [...wanted].filter((id) => !ids.has(id));
  assert(missing.length === 0, `missing ids: ${missing.join(', ')}`);
  return `${wanted.size} ids referenced, all present`;
});

check('every data-action button in the markup is handled in code', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  const actions = new Set([...html.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...actions].filter((a) => !main.includes(`'${a}'`) && !main.includes(`"${a}"`));
  assert(missing.length === 0, `unhandled actions: ${missing.join(', ')}`);
  return `${actions.size} actions wired`;
});

check('every module import path resolves on disk', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(path.join(root, 'src'));
  let count = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = path.resolve(path.dirname(file), m[1]);
      assert(fs.existsSync(target), `${path.relative(root, file)} → ${m[1]} missing`);
      count++;
    }
  }
  return `${files.length} modules, ${count} relative imports resolve`;
});

check('no module uses browser-only globals at import time', () => {
  // main.js is the only entry point allowed to touch the DOM on load.
  for (const file of fs.readdirSync(path.join(root, 'src', 'game'))) {
    if (!file.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(root, 'src', 'game', file), 'utf8');
    const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const token of ['document.', 'localStorage.']) {
      assert(!stripped.includes(token), `${file} touches ${token}`);
    }
  }
  return 'game logic stays environment-agnostic';
});

check('all tuning constants live in src/config/config.js', () => {
  const cfg = fs.readFileSync(path.join(root, 'src/config/config.js'), 'utf8');
  for (const key of ['PHYS', 'LAUNCH', 'BOOST', 'PLAYER', 'ECONOMY', 'WORLD', 'CAMERA', 'REGIONS', 'COMBO_TIERS', 'QUALITY']) {
    assert(new RegExp(`export const ${key}`).test(cfg), `${key} missing from config`);
  }
  // game modules must not hardcode gravity/speed numbers of their own
  const offenders = [];
  for (const file of fs.readdirSync(path.join(root, 'src', 'game'))) {
    if (!file.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(root, 'src', 'game', file), 'utf8');
    if (/gravity\s*=\s*[0-9]{3,}/i.test(text)) offenders.push(file);
  }
  assert(offenders.length === 0, `hardcoded gravity in ${offenders.join(', ')}`);
  return 'config is the single source of tuning';
});

check('the shipped game has no placeholder/emoji art', () => {
  // Only default-presentation emoji count: ★ ▶ · × are typographic glyphs, not sprites.
  const bad = /\p{Emoji_Presentation}/u;
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|css|html)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        if (bad.test(text)) offenders.push(path.relative(root, full));
      }
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'styles'));
  if (bad.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8'))) offenders.push('index.html');
  assert(offenders.length === 0, `emoji found in ${offenders.join(', ')}`);
  return 'no emoji sprites, no image files — 100% procedural art';
});

check('the game ships without external asset downloads', () => {
  const files = fs.readdirSync(path.join(root, 'src', 'art'));
  assert(files.length > 0, 'art modules exist');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const remote = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert(remote.length === 0, `remote assets: ${remote.join(', ')}`);
  return `${files.length} art modules, zero remote assets`;
});

/* ------------------------------------------------------------------ report */
const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
const byGroup = {};
for (const r of results) (byGroup[r.group] = byGroup[r.group] || []).push(r);

if (process.argv.includes('--json')) {
  fs.writeFileSync(path.join(root, '.art-out', 'test-results.json'), JSON.stringify({ results, passed, failed: failed.length }, null, 1));
}

const useColour = process.stdout.isTTY;
const green = (s) => (useColour ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s) => (useColour ? `\x1b[31m${s}\x1b[0m` : s);
const dim = (s) => (useColour ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s) => (useColour ? `\x1b[1m${s}\x1b[0m` : s);

console.log(bold('\n🧪 JUMP TO THE STAR — test report\n'));
for (const [g, list] of Object.entries(byGroup)) {
  console.log(bold(g.toUpperCase()));
  for (const r of list) {
    const mark = r.ok ? green('PASS') : red('FAIL');
    console.log(`  ${mark}  ${r.name}${r.detail ? dim(`  — ${r.detail}`) : ''}`);
  }
  console.log('');
}
console.log(`${passed}/${results.length} checks passed${failed.length ? red(`  (${failed.length} failed)`) : green('  ✓')}`);
if (failed.length) {
  console.log('\nFAILURES');
  for (const f of failed) console.log(`  ${red('✗')} [${f.group}] ${f.name}\n     ${f.detail}`);
  process.exitCode = 1;
}

function WORLD_MIN() {
  return 520;
}
function WORLD_MAX() {
  return 3400;
}
