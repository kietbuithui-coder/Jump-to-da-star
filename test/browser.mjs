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
const drawnText = [];
const VI_CHARS = /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/;
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
    fillText(text) {
      drawnText.push(String(text));
    },
    strokeText(text) {
      drawnText.push(String(text));
    },
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
    // keep the fake audio clock in step with the fake frame clock, and drive
    // the music scheduler by hand (jsdom timers do not run inside a sync loop)
    if (window.__audioCtx) {
      window.__audioCtx.currentTime = now / 1000;
      if (window.JTTS?.audio?.ready) window.JTTS.audio._schedule();
    }
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
let oscCount = 0;
let noiseCount = 0;
class FakeAudioContext {
  constructor() {
    window.__audio = { osc: 0, noise: 0, contexts: (window.__audio?.contexts || 0) + 1 };
    window.__audioCtx = this;
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = { connect() {} };
    this.sampleRate = 48000;
  }
  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        setTargetAtTime() {},
        cancelScheduledValues() {},
      },
      connect() {},
      disconnect() {},
    };
  }
  createOscillator() {
    oscCount++;
    if (window.__audio) window.__audio.osc = oscCount;
    const param = (v) => ({
      value: v,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
      setTargetAtTime() {},
      cancelScheduledValues() {},
    });
    return {
      type: 'sine',
      frequency: param(440),
      detune: param(0),
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
    noiseCount++;
    if (window.__audio) window.__audio.noise = noiseCount;
    return { buffer: null, playbackRate: { value: 1, setValueAtTime() {} }, connect() {}, start() {}, stop() {}, onended: null };
  }
  createBiquadFilter() {
    const param = (v) => ({
      value: v,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
      setTargetAtTime() {},
      cancelScheduledValues() {},
    });
    return { type: 'lowpass', frequency: param(400), Q: param(1), gain: param(1), connect() {}, disconnect() {} };
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

/** Guarantee a live, flying run: retries after a death and re-launches. */
function ensureFlying() {
  const g = window.JTTS.game;
  if (g.state === 'fly') return g;
  if (g.state === 'launch') {
    key('Space');
    tick(30);
    key('Space', 'keyup');
    tick(4);
    if (g.state !== 'fly') throw new Error(`could not launch (${g.state})`);
    return g;
  }
  const retry = $('#screen-gameover .btn--primary[data-action="retry"]') || $('#screen-gameover [data-action="retry"]');
  if (retry && $('#screen-gameover').classList.contains('is-active')) click(retry);
  else click($('[data-action="play"]'));
  tick(2);
  if (g.state !== 'launch') throw new Error(`retry did not restart a run (${g.state})`);
  key('Space');
  tick(30);
  key('Space', 'keyup');
  tick(4);
  if (g.state !== 'fly') throw new Error(`re-launch failed (${g.state})`);
  return g;
}

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

check('the menu has a fullscreen button and it does not throw', () => {
  const btn = $('[data-action="fullscreen"]');
  if (!btn) throw new Error('no fullscreen button in the menu');
  if (!btn.textContent.includes('⛶')) throw new Error('button is unlabelled');
  if (!$('#fsBtn')) throw new Error('the in-game fullscreen FAB is missing');
  click(btn);
  tick(1);
  return 'menu fullscreen button wired';
});

check('view setting switches camera zoom and persists', () => {
  window.JTTS.showScreen('settings');
  tick(1);
  const seg = $('#setView');
  if (!seg) throw new Error('no VIEW control in settings');
  const ultra = seg.querySelector('[data-v="ultra"]');
  click(ultra);
  tick(1);
  if (window.JTTS.save.data.settings.view !== 'ultra') throw new Error('view not saved');
  const stored = JSON.parse(window.localStorage.getItem('jtts.save.v2'));
  if (stored.settings.view !== 'ultra') throw new Error('view not persisted');
  const zoomUltra = window.JTTS.game.camera.zoom;
  click(seg.querySelector('[data-v="normal"]'));
  tick(1);
  const zoomNormal = window.JTTS.game.camera.zoom;
  if (!(zoomUltra < zoomNormal)) throw new Error(`ultra zoom ${zoomUltra} is not smaller than normal ${zoomNormal}`);
  click(seg.querySelector('[data-v="hyper"]'));
  tick(1);
  if (window.JTTS.save.data.settings.view !== 'hyper') throw new Error('hyper option not selectable');
  const zoomHyper = window.JTTS.game.camera.zoom;
  if (!(zoomHyper < zoomUltra)) throw new Error('0.25x did not zoom further than 0.5x');
  click(seg.querySelector('[data-v="ultra"]'));
  tick(1);
  return `hyper ${zoomHyper.toFixed(2)}× / ultra ${zoomUltra.toFixed(2)}× / normal ${zoomNormal.toFixed(2)}×`;
});

check('the menu track (EDM) is scheduled once audio unlocks', () => {
  const before = window.__audio?.osc || 0;
  // the fake clock is driven by requestAnimationFrame ticks
  for (let i = 0; i < 40; i++) tick(1);
  const after = window.__audio?.osc || 0;
  if (after <= before) throw new Error(`no oscillators scheduled (${before} → ${after})`);
  return `${after - before} notes scheduled by the music engine`;
});

check('language switch (VI ⇄ EN) translates the UI and persists', () => {
  const playBtn = $('[data-action="play"] span');
  const before = playBtn.textContent;
  const langBtn = $('#menuLang');
  if (!langBtn) throw new Error('no language chip in the menu');
  // force VI first
  while (window.JTTS.save.data.settings.lang !== 'vi') click(langBtn);
  tick(1);
  if (playBtn.textContent !== 'CHƠI') throw new Error(`VI play label was "${playBtn.textContent}"`);
  click(langBtn);
  tick(1);
  if (window.JTTS.save.data.settings.lang !== 'en') throw new Error('language did not switch to EN');
  if (playBtn.textContent !== 'PLAY') throw new Error(`EN play label was "${playBtn.textContent}"`);
  const stored = JSON.parse(window.localStorage.getItem('jtts.save.v2'));
  if (stored.settings.lang !== 'en') throw new Error('language not persisted in the save');
  click(langBtn);
  tick(1);
  return `"${before}" → VI "CHƠI" → EN "PLAY" → VI`;
});

check('NEW TAB button opens a standalone link (and shows a manual fallback)', () => {
  click($('[data-action="newtab"]'));
  tick(1);
  const hint = $('#newTabHint');
  if (!hint) throw new Error('no fallback hint rendered');
  const link = hint.querySelector('a');
  if (!link) throw new Error('fallback hint has no link');
  if (!link.href.includes('standalone=1')) throw new Error(`link is ${link.href}`);
  if (link.target !== '_blank') throw new Error('link does not open a new tab');
  hint.remove();
  return `${new URL(link.href).pathname}?standalone=1`;
});

check('the standalone gate stays hidden in a normal visit', () => {
  const gate = $('#standaloneGate');
  if (!gate) throw new Error('gate markup missing');
  if (!gate.hidden) throw new Error('gate is blocking the menu without ?standalone=1');
  return 'hidden unless ?standalone=1';
});

check('RESTART refills the launch bar (regression: charge was dead after restart)', () => {
  const g = window.JTTS.game;
  // start a fresh run, launch, then restart from the pause menu
  if (window.JTTS.screen === 'gameover') click($('#screen-gameover [data-action="retry"]'));
  else click($('[data-action="play"]'));
  tick(1);
  key('Space');
  tick(20);
  key('Space', 'keyup');
  tick(6);
  key('Escape');
  tick(2);
  click($('[data-action="restart"]'));
  tick(2);
  if (g.state !== 'launch') throw new Error(`state after restart: ${g.state}`);
  if (g.launchPower !== 0) throw new Error(`charge carried over (${g.launchPower})`);
  key('Space');
  tick(30);
  const charged = g.launchPower;
  key('Space', 'keyup');
  tick(2);
  if (!(charged > 0.2)) throw new Error(`charge bar did not move after restart (${charged})`);
  if (g.state !== 'fly') throw new Error(`release did not launch (${g.state})`);
  return `charge rebuilt to ${(charged * 100).toFixed(0)}% and launched`;
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
  let g = ensureFlying();
  let best = 0;
  let deaths = 0;
  // no steering at all: some runs genuinely die (that is the game), so a death
  // is retried and the stability check continues on a fresh run.
  for (let s = 0; s < 20; s++) {
    tick(60);
    if (!Number.isFinite(g.player.x) || !Number.isFinite(g.player.y)) throw new Error('NaN in player state');
    best = Math.max(best, g.score.metres);
    if (g.state === 'dead' || g.state === 'gameover' || window.JTTS.screen === 'gameover') {
      deaths++;
      tick(30); // let the result screen settle
      g = ensureFlying();
    }
  }
  g = ensureFlying();
  if (best < 50) throw new Error(`only ${best.toFixed(0)} m in 20 s`);
  return `${Math.round(best)} m best of ${deaths + 1} run(s), ${deaths} death(s) with no input, state ${g.state}`;
});

await checkAsync('the running HUD is drawn in Vietnamese, then in English', async () => {
  const { setLang } = await import('../src/core/i18n.js');
  const g = ensureFlying();
  const hudText = () => {
    tick(3);
    const seen = drawnText.filter((t) => t && t.trim());
    drawnText.length = 0;
    return seen;
  };
  setLang('vi');
  const vi = hudText();
  if (!vi.length) throw new Error('nothing was drawn onto the HUD canvas');
  if (!vi.some((t) => t.includes('NĂNG LƯỢNG'))) throw new Error('VI energy label missing from the HUD');
  if (!vi.some((t) => VI_CHARS.test(t))) throw new Error('no Vietnamese diacritics on the canvas at all');

  setLang('en');
  const en = hudText();
  if (!en.some((t) => t.includes('ENERGY'))) throw new Error('EN energy label missing from the HUD');
  if (en.some((t) => t.includes('NĂNG LƯỢNG'))) throw new Error('VI label survived the switch to EN');

  // never paint a broken translation on screen
  const broken = [...vi, ...en].filter((t) => /\{n\}|undefined|\[object /.test(t));
  if (broken.length) throw new Error(`broken label painted: ${broken.slice(0, 3).join(' | ')}`);

  setLang('vi');
  const metres = Math.round(g.score.metres);
  return `VI + EN HUD both rendered at ${metres} m (${vi.length}/${en.length} strings per frame)`;
});

check('right mouse button fires the character skill', () => {
  const g = ensureFlying();
  g.player.energy = g.player.energyMax;
  g.player.skillCooldown = 0;
  const before = g.player.energy;
  const down = new window.MouseEvent('mousedown', { bubbles: true, button: 2 });
  window.dispatchEvent(down);
  tick(8);
  const spent = before - g.player.energy;
  window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true, button: 2 }));
  tick(2);
  if (spent <= 0) throw new Error(`right-click spent ${spent} energy (skill did not fire)`);
  if (window.JTTS.input.isDown('skill')) throw new Error('skill stuck on after mouseup');
  return `spent ${spent.toFixed(0)} energy, released cleanly`;
});

check('escape pauses, escape resumes', () => {
  const g = ensureFlying();
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

check('the pause journey map shows Vietnamese region names', () => {
  ensureFlying();
  key('Escape');
  tick(2);
  const langBefore = window.JTTS.save.data.settings.lang;
  click($('[data-action="map"]'));
  tick(1);
  const panel = $('#pauseMap');
  if (!panel.classList.contains('is-open')) throw new Error('map panel did not open');
  const text = panel.textContent;
  if (langBefore === 'vi') {
    if (!text.includes('PHÒNG PHÓNG SHAPI')) throw new Error(`VI region names missing: ${text.slice(0, 80)}`);
    if (!text.includes('Đang bay')) throw new Error('VI "current flight" label missing');
  } else if (!text.includes("SHAPI'S LAUNCH LAB")) throw new Error(`EN region names missing: ${text.slice(0, 80)}`);
  click($('[data-action="map"]'));
  tick(1);
  key('Escape');
  tick(2);
  return `${langBefore.toUpperCase()} map: ${panel.querySelectorAll('.map-region').length} regions, ${text.length} chars`;
});

check('game over saves coins, records and a recent run', () => {
  const g = ensureFlying();
  const coinsBefore = window.JTTS.save.data.coins;
  const runsBefore = window.JTTS.save.data.totalRuns;
  // deterministic death: temporarily remove every pad so the fall is real
  const originalPadsNear = g.world.padsNear.bind(g.world);
  const originalZonesNear = g.world.zonesNear.bind(g.world);
  g.world.padsNear = () => [];
  g.world.zonesNear = () => [];
  const spot = g.player.x;
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
  g.world.padsNear = originalPadsNear;
  g.world.zonesNear = originalZonesNear;
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
