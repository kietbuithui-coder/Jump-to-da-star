/**
 * Browser-path smoke test.
 *
 * Loads index.html into jsdom, stubs the parts a headless Node process cannot
 * provide (2D canvas context, AudioContext, RAF), then boots the REAL src/main.js
 * and drives the actual UI: menus, character select, upgrade purchase, settings,
 * a full run, pause, and game over → record/save write.
 *
 *   node test/browser.mjs
 *
 * This is not a substitute for opening the game in a real browser (no GPU, no
 * real audio), but it proves the boot path, DOM wiring and screen router work.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSDOM_PATH = ['/tmp/jsd/node_modules/jsdom/lib/api.js', path.join(root, 'node_modules/jsdom/lib/api.js')].find((p) =>
  fs.existsSync(p)
);
if (!JSDOM_PATH) {
  console.log('SKIP  jsdom is not installed (npm i jsdom) — browser-path test not run');
  process.exit(0);
}
const { JSDOM } = await import(JSDOM_PATH);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8080/', pretendToBeVisual: true });
const { window } = dom;

/* ------------------------------------------------------------ canvas stub */
const calls = new Map();
function makeCtx(canvas) {
  const target = {
    canvas,
    _stack: 0,
    save() {
      this._stack++;
    },
    restore() {
      this._stack--;
    },
    measureText: (t) => ({ width: String(t).length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData() {},
    drawImage() {},
    setLineDash() {},
    getLineDash: () => [],
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    setTransform() {},
    resetTransform() {},
    isPointInPath: () => false,
    ellipse() {},
    arc() {},
    arcTo() {},
    roundRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    quadraticCurveTo() {},
    rect() {},
    fill() {},
    stroke() {},
    clip() {},
    translate() {},
    rotate() {},
    scale() {},
    transform() {},
    fillText() {},
    strokeText() {},
    fillRect() {},
    strokeRect() {},
    clearRect() {},
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) {
        const v = t[prop];
        if (typeof v !== 'function') return v;
        return (...args) => {
          calls.set(prop, (calls.get(prop) || 0) + 1);
          return v.apply(t, args);
        };
      }
      // any un-stubbed canvas method becomes a counted no-op
      return (...args) => {
        calls.set(prop, (calls.get(prop) || 0) + 1);
        return prop === 'measureText' ? { width: 10 } : undefined;
      };
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    },
  });
}
window.HTMLCanvasElement.prototype.getContext = function getContext() {
  if (!this.__ctx) this.__ctx = makeCtx(this);
  return this.__ctx;
};
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

/* --------------------------------------------------------------- timing */
let rafQueue = [];
window.requestAnimationFrame = (cb) => {
  rafQueue.push(cb);
  return rafQueue.length;
};
window.cancelAnimationFrame = () => {};
let now = 0;
function tick(frames = 1, stepMs = 16.7) {
  for (let i = 0; i < frames; i++) {
    now += stepMs;
    const queue = rafQueue;
    rafQueue = [];
    for (const cb of queue) cb(now);
  }
}
try {
  Object.defineProperty(window, 'performance', { value: { now: () => now, mark() {}, measure() {} }, configurable: true });
} catch (_) {
  window.performance.now = () => now;
}

/* ------------------------------------------------------- storage / audio */
window.localStorage.clear();
let audioUnlocked = 0;
class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = { connect() {} };
    this.sampleRate = 48000;
  }
  createGain() {
    return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {} };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 440, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      detune: { value: 0, setValueAtTime() {} },
      connect() {},
      start() {},
      stop() {},
      onended: null,
    };
  }
  createBuffer(channels, length, rate) {
    return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { buffer: null, playbackRate: { value: 1, setValueAtTime() {} }, connect() {}, start() {}, stop() {}, onended: null };
  }
  createBiquadFilter() {
    return { type: 'lowpass', frequency: { value: 400, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 1 }, connect() {}, disconnect() {} };
  }
  createDynamicsCompressor() {
    return { threshold: { value: 0, setValueAtTime() {} }, knee: { value: 0 }, ratio: { value: 1 }, attack: { value: 0 }, release: { value: 0 }, connect() {} };
  }
  createStereoPanner() {
    return { pan: { value: 0, setValueAtTime() {} }, connect() {} };
  }
  createWaveShaper() {
    return { curve: null, connect() {} };
  }
  createDelay() {
    return { delayTime: { value: 0, setValueAtTime() {} }, connect() {} };
  }
  resume() {
    this.state = 'running';
    audioUnlocked++;
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}
window.AudioContext = FakeAudioContext;
window.webkitAudioContext = FakeAudioContext;
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
window.confirm = () => true;
window.scrollTo = () => {};
Object.defineProperty(window, 'innerWidth', { value: 1366, writable: true, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true });
window.devicePixelRatio = 1;

/* ------------------------------------------------------ global bridges */
const globals = [
  'window',
  'document',
  'localStorage',
  'HTMLCanvasElement',
  'Image',
  'performance',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'devicePixelRatio',
  'matchMedia',
  'AudioContext',
  'setTimeout',
  'clearTimeout',
  'confirm',
  'navigator',
];
for (const g of globals) {
  const value = g === 'matchMedia' ? window.matchMedia.bind(window) : g === 'confirm' ? () => true : g === 'devicePixelRatio' ? 1 : g === 'setTimeout' || g === 'clearTimeout' ? globalThis[g] : window[g];
  try {
    Object.defineProperty(globalThis, g, { value, configurable: true, writable: true });
  } catch (_) {}
}

/* ------------------------------------------------------------ run the tests */
const results = [];
function check(name, fn) {
  const t0 = Date.now();
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: `${detail ?? ''} (${Date.now() - t0}ms)` });
  } catch (err) {
    results.push({ name, ok: false, detail: err?.stack ? String(err.stack).split('\n').slice(0, 4).join('\n') : String(err) });
  }
}
async function checkAsync(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: `${detail ?? ''} (${Date.now() - t0}ms)` });
  } catch (err) {
    results.push({ name, ok: false, detail: err?.stack ? String(err.stack).split('\n').slice(0, 4).join('\n') : String(err) });
  }
}
const $ = (s) => window.document.querySelector(s);
const $$ = (s) => Array.from(window.document.querySelectorAll(s));
const click = (el) => {
  if (!el) throw new Error('element not found');
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
};
const key = (code, type = 'keydown') => window.dispatchEvent(new window.KeyboardEvent(type, { code, key: code, bubbles: true }));

let bootError = null;
try {
  await import('../src/main.js?' + Date.now());
} catch (err) {
  bootError = err;
}

check('the game boots from index.html with no exceptions', () => {
  if (bootError) throw bootError;
  if (!window.JTTS) throw new Error('window.JTTS debug handle missing');
  return `version ${window.JTTS.version}`;
});

check('the menu screen is active and the hero canvas is sized', () => {
  if (!$('#screen-menu')?.classList.contains('is-active')) throw new Error('menu not active');
  const c = $('#game');
  if (!c.width || !c.height) throw new Error(`canvas not sized (${c.width}x${c.height})`);
  return `canvas ${c.width}×${c.height}`;
});

check('a menu frame renders (backdrop + logo + portraits)', () => {
  tick(4);
  if (calls.size < 5) throw new Error('almost nothing was drawn');
  return `${[...calls.keys()].slice(0, 6).join(', ')}…`;
});

check('navigation: menu → characters → upgrades → records → settings → menu', () => {
  const route = [
    ['characters', '#screen-characters'],
    ['upgrades', '#screen-upgrades'],
    ['records', '#screen-records'],
    ['settings', '#screen-settings'],
    ['menu', '#screen-menu'],
  ];
  for (const [name, sel] of route) {
    window.JTTS.showScreen(name);
    tick(1);
    if (window.JTTS.screen !== name) throw new Error(`screen state is ${window.JTTS.screen}`);
    if (!$(sel)?.classList.contains('is-active')) throw new Error(`${sel} not active`);
  }
  return '5 screens routed';
});

check('character select: locked pilots are refused, unlocked pilots are chosen', () => {
  const save = window.JTTS.save;
  save.data.coins = 0;
  for (const id of ['chicken', 'cheesus', 'pig', 'error404']) save.data.unlocked[id] = false;
  window.JTTS.showScreen('characters');
  tick(1);
  const cards = $$('#charGrid .char-card');
  if (cards.length !== 5) throw new Error(`${cards.length} cards rendered`);
  const pigCard = cards.find((c) => c.dataset.char === 'pig');
  click(pigCard);
  tick(1);
  if (save.data.selected === 'pig') throw new Error('locked pilot was selected without paying');
  if (save.data.unlocked.pig) throw new Error('locked pilot unlocked for free');

  save.data.coins = 2000;
  const chickenCard = cards.find((c) => c.dataset.char === 'chicken');
  click(chickenCard);
  tick(1);
  if (save.data.selected !== 'chicken') throw new Error(`refused a paid unlock (selected ${save.data.selected})`);
  if (!save.data.unlocked.chicken) throw new Error('chicken did not unlock');
  if (!(save.data.coins >= 0)) throw new Error('coins went negative');

  // now that it is yours, clicking it just selects it
  click(chickenCard);
  tick(1);
  if (save.data.selected !== 'chicken') throw new Error('unlocked pilot not selected');
  return `${cards.length} cards · unlock cost paid · reselect ok`;
});

check('upgrade lab refuses purchases you cannot afford and accepts ones you can', () => {
  const save = window.JTTS.save;
  save.data.selected = 'frog';
  save.data.coins = 0;
  window.JTTS.showScreen('upgrades');
  tick(1);
  const buy = $$('#upgradeList .up-buy')[0];
  if (!buy) throw new Error('no buy buttons rendered');
  const before = save.data.upgrades.frog.launch || 0;
  click(buy);
  tick(1);
  if ((save.data.upgrades.frog.launch || 0) !== before) throw new Error('bought an upgrade with 0 coins!');

  save.data.coins = 5000;
  window.JTTS.showScreen('upgrades');
  tick(1);
  const buy2 = $$('#upgradeList .up-buy')[0];
  click(buy2);
  tick(1);
  const after = save.data.upgrades.frog.launch || 0;
  if (after !== before + 1) throw new Error(`purchase did not apply (${before} → ${after})`);
  if (save.data.coins >= 5000) throw new Error('coins were not deducted');
  const persisted = JSON.parse(window.localStorage.getItem('jtts.save.v2'));
  if ((persisted.upgrades.frog.launch || 0) !== after) throw new Error('upgrade was not persisted');
  return `launch ${before} → ${after}, ${save.data.coins} coins left, saved`;
});

check('settings sliders persist to storage', () => {
  window.JTTS.showScreen('settings');
  tick(1);
  const slider = $('#setMusic');
  slider.value = '25';
  slider.dispatchEvent(new window.Event('input', { bubbles: true }));
  tick(1);
  const stored = JSON.parse(window.localStorage.getItem('jtts.save.v2'));
  if (Math.abs(stored.settings.music - 0.25) > 1e-6) throw new Error(`stored music = ${stored.settings.music}`);
  return `music → ${stored.settings.music}`;
});

check('PLAY starts a run and the HUD comes alive', () => {
  window.JTTS.save.data.selected = 'frog';
  const play = $('[data-action="play"]');
  click(play);
  tick(1);
  const g = window.JTTS.game;
  if (g.state !== 'launch') throw new Error(`state ${g.state}`);
  if (window.JTTS.screen !== null) throw new Error('menu still open');
  // hold space to charge, release to launch
  key('Space');
  tick(30);
  key('Space', 'keyup');
  tick(4);
  if (g.state !== 'fly') throw new Error(`still ${g.state} after launch`);
  return `launched at ${g.player.vx.toFixed(0)} px/s`;
});

check('flying for 20 s keeps the simulation stable and the score moving', () => {
  const g = window.JTTS.game;
  const x0 = g.player.x;
  for (let s = 0; s < 20; s++) tick(60);
  if (!Number.isFinite(g.player.x) || !Number.isFinite(g.player.y)) throw new Error('NaN in player state');
  if (g.score.metres < 50) throw new Error(`only ${g.score.metres.toFixed(0)} m after 20 s`);
  return `${Math.round(g.score.metres)} m, state ${g.state}, ${g.particles.count} particles`;
});

check('escape pauses, escape resumes', () => {
  const g = window.JTTS.game;
  key('Escape');
  tick(2);
  if (g.state !== 'paused') throw new Error(`state ${g.state}`);
  if (window.JTTS.screen !== 'pause') throw new Error('pause screen not shown');
  const x = g.player.x;
  tick(30);
  if (g.player.x !== x) throw new Error('simulation moved while paused');
  key('Escape');
  tick(2);
  if (g.state === 'paused') throw new Error('did not resume');
  return 'pause/resume via keyboard';
});

check('game over saves coins, records and a recent run', () => {
  const g = window.JTTS.game;
  const coinsBefore = window.JTTS.save.data.coins;
  const runsBefore = window.JTTS.save.data.totalRuns;
  // find a stretch with no rescue net above it, so this is a genuine fall
  let spot = g.player.x;
  for (let x = g.player.x + 600; x < g.player.x + 40000; x += 120) {
    if (!g.world.padsNear(x).length) {
      spot = x;
      break;
    }
  }
  g.player.x = spot;
  g.player.vx = 0;
  g.player.rideUfo = null;
  const floorY = g.world.floorAt(spot);
  g.player.y = floorY + 300;
  g.player.vy = 1500;
  const trace = [];
  for (let i = 0; i < 10; i++) {
    tick(1);
    trace.push(`${g.state}@${Math.round(g.player.y - floorY)}`);
    if (g.state === 'dead') break;
  }
  if (g.state !== 'dead') throw new Error(`state ${g.state}; ${trace.join(' ')}`);
  tick(60);
  tick(120);
  const data = window.JTTS.save.data;
  if (data.totalRuns !== runsBefore + 1) throw new Error('run not counted');
  if (data.coins < coinsBefore) throw new Error('coins went down on death');
  if (!data.records.history.length) throw new Error('history empty');
  if (!window.localStorage.getItem('jtts.save.v2')) throw new Error('save not written');
  const go = $('#screen-gameover');
  if (!go.classList.contains('is-active')) throw new Error('game over screen not shown');
  return `${data.coins} coins, ${data.records.history.length} recent runs`;
});

await checkAsync('the persisted save reloads into a fresh store (survives a page reload)', async () => {
  const { SaveStore } = await import('../src/game/save.js');
  const raw = window.localStorage.getItem('jtts.save.v2');
  if (!raw) throw new Error('nothing in localStorage');
  const live = window.JTTS.save.data;
  const reloaded = new SaveStore(window.localStorage).data;
  if (reloaded.coins !== live.coins) throw new Error(`coins ${reloaded.coins} vs ${live.coins}`);
  if (reloaded.totalRuns !== live.totalRuns) throw new Error('run count lost');
  if ((reloaded.upgrades.frog.launch || 0) !== (live.upgrades.frog.launch || 0)) throw new Error('upgrades lost');
  if (reloaded.records.history.length !== live.records.history.length) throw new Error('history lost');
  if ((reloaded.unlocked.chicken ?? false) !== (live.unlocked.chicken ?? false)) throw new Error('unlock lost');
  return `${reloaded.coins} coins, ${reloaded.totalRuns} runs, ${reloaded.records.history.length} history rows restored`;
});

check('quality switch re-renders without errors', () => {
  const g = window.JTTS.game;
  for (const q of ['low', 'balanced', 'high']) {
    g.setQuality(q);
    window.JTTS.showScreen('menu');
    tick(2);
  }
  return 'low / balanced / high';
});

check('no stray uncaught errors during the whole session', () => {
  if (window.__errors?.length) throw new Error(window.__errors.join(' | '));
  return 'clean console';
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${String(r.detail).split('\n')[0]}` : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} browser-path checks passed`);
if (failed.length) {
  console.log('\nFAILURES');
  for (const f of failed) console.log(`  ✗ ${f.name}\n${f.detail.split('\n').map((l) => '     ' + l).join('\n')}`);
  process.exitCode = 1;
}
// the live game loop keeps timers scheduled; stop it explicitly
window.JTTS?.audio?.dispose?.();
process.exit(failed.length ? 1 : 0);
