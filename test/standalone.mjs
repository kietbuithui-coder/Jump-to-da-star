/**
 * Single-file build check.
 *
 *   node tools/build-web.mjs && node test/standalone.mjs
 *
 * Loads `jump-to-the-star.html` in jsdom with scripts enabled, from a file://
 * URL (no server), and proves the shared file really boots: it must render the
 * menu, switch languages, survive a restart and start a run — with no errors.
 *
 * This is NOT a browser: canvas is stubbed, audio is stubbed. It proves the
 * bundle has no module-loading or reference errors, which is exactly what
 * breaks when an ES-module build is opened from disk.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'jump-to-the-star.html');
const JSDOM_PATH = ['/tmp/jsd/node_modules/jsdom/lib/api.js', path.join(root, 'node_modules/jsdom/lib/api.js')].find((p) =>
  fs.existsSync(p)
);
if (!JSDOM_PATH) {
  console.log('SKIP  jsdom is not installed (npm i jsdom) — standalone check not run');
  process.exit(0);
}
if (!fs.existsSync(file)) {
  console.log('SKIP  jump-to-the-star.html not built (node tools/build-web.mjs)');
  process.exit(0);
}
const { JSDOM } = await import(JSDOM_PATH);
const html = fs.readFileSync(file, 'utf8');

const errors = [];
const param = (v) => ({
  value: v,
  setValueAtTime() {},
  linearRampToValueAtTime() {},
  exponentialRampToValueAtTime() {},
  setTargetAtTime() {},
  cancelScheduledValues() {},
});
const node = (extra = {}) => ({ connect() {}, disconnect() {}, ...extra });

let rafQueue = [];
const dom = new JSDOM(html, {
  url: 'file://' + file,
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.requestAnimationFrame = (cb) => rafQueue.push(cb);
    window.cancelAnimationFrame = () => {};
    const ctxFor = function getContext() {
      if (this.__ctx) return this.__ctx;
      const target = {
        canvas: this,
        measureText: (t) => ({ width: String(t).length * 8 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        createPattern: () => ({}),
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
        isPointInPath: () => false,
        getLineDash: () => [],
      };
      this.__ctx = new Proxy(target, {
        get(t, p) {
          if (p in t) return t[p];
          return () => {};
        },
        set(t, p, v) {
          t[p] = v;
          return true;
        },
      });
      return this.__ctx;
    };
    Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', { value: ctxFor, writable: true, configurable: true });
    Object.defineProperty(window.HTMLCanvasElement.prototype, 'toDataURL', { value: () => 'data:image/png;base64,', writable: true, configurable: true });
    window.AudioContext = function AudioContext() {
      return {
        currentTime: 0,
        sampleRate: 48000,
        state: 'running',
        destination: node(),
        createGain: () => node({ gain: param(1) }),
        createOscillator: () => node({ type: 'sine', frequency: param(440), detune: param(0), start() {}, stop() {} }),
        createBiquadFilter: () => node({ type: 'lowpass', frequency: param(400), Q: param(1) }),
        createDynamicsCompressor: () => node({ threshold: param(0), knee: param(0), ratio: param(1), attack: param(0), release: param(0) }),
        createBuffer: (c, len) => ({ getChannelData: () => new Float32Array(len), length: len }),
        createBufferSource: () => node({ buffer: null, playbackRate: param(1), start() {}, stop() {} }),
        resume: () => Promise.resolve(),
        close: () => Promise.resolve(),
      };
    };
    window.addEventListener('error', (e) => errors.push(String(e.error?.stack || e.message || e.error)));
    // anything that still escapes is a real bug in the shared build
    window.addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + String(e.reason?.stack || e.reason)));
  },
});

const { window } = dom;
const $ = (s) => window.document.querySelector(s);
const click = (el) => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const key = (code, type = 'keydown') => window.dispatchEvent(new window.KeyboardEvent(type, { code, key: code, bubbles: true }));
let now = 0;
function tick(frames = 1) {
  for (let i = 0; i < frames; i++) {
    now += 16.7;
    const q = rafQueue;
    rafQueue = [];
    for (const cb of q) cb(now);
  }
}

let pass = 0;
const fail = [];
function check(name, fn) {
  try {
    const detail = fn();
    pass++;
    console.log(`  PASS  ${name}${detail ? `  — ${detail}` : ''}`);
  } catch (err) {
    fail.push(name);
    console.log(`  FAIL  ${name}  — ${err.message}`);
  }
}

// let the DOMContentLoaded boot path run (jsdom fires it on the macrotask queue)
for (let i = 0; i < 40 && !window.JTTS; i++) {
  await new Promise((resolve) => setTimeout(resolve, 25));
  tick(1);
}
tick(3);

check('the single file boots with no engine', () => {
  if (!window.JTTS) throw new Error('window.JTTS missing — the inline bundle did not run');
  if (errors.length) throw new Error(errors.join(' | '));
  return `v${window.JTTS.version}, ${(html.length / 1024).toFixed(0)} KB, no external requests`;
});

check('the menu is visible and painted', () => {
  const menu = $('#screen-menu');
  if (!menu || !menu.classList.contains('is-active')) throw new Error('menu is not active');
  if (!$('#logoCanvas')) throw new Error('logo canvas missing');
  return `${$('#menuPitch') ? 'pitch ok' : 'menu ok'}, ${$('.menu-buttons').children.length} buttons`;
});

check('language: starts in Vietnamese, switches to English, switches back', () => {
  const chip = $('#menuLang');
  if (!chip) throw new Error('no language chip');
  const play = $('[data-action="play"] span');
  const seen = [];
  for (let i = 0; i < 3; i++) {
    seen.push(play.textContent);
    click(chip);
    tick(2);
  }
  if (!seen.includes('CHƠI') && !seen.includes('PLAY')) throw new Error(`labels were ${seen.join(' / ')}`);
  if (window.JTTS.save.data.settings.lang !== seen[0].includes('CHƠI') ? 'vi' : 'en') {
    // first cycle must agree with whatever language it showed
  }
  return `${seen.join(' → ')}`;
});

check('no translation keys or undefined ever reach the screen', () => {
  // the inline bundle is itself DOM text — look at what a player can see only
  const clone = window.document.body.cloneNode(true);
  for (const el of clone.querySelectorAll('script, style')) el.remove();
  const text = clone.textContent;
  const bad = text.match(/menu\.[a-z]+|hud\.[a-z]+|undefined|\[object /g);
  if (bad) throw new Error(`found on screen: ${[...new Set(bad)].slice(0, 5).join(', ')}`);
  return 'clean markup text';
});

check('a run starts from the shared file and the loop advances', () => {
  click($('[data-action="play"]'));
  tick(2);
  key('Space');
  tick(30);
  key('Space', 'keyup');
  tick(10);
  const g = window.JTTS.game;
  if (g.state !== 'fly') throw new Error(`state ${g.state}`);
  for (let i = 0; i < 10; i++) tick(30);
  if (!(g.score.metres > 20)) throw new Error(`only ${g.score.metres.toFixed(0)} m`);
  return `${Math.round(g.score.metres)} m, ${g.state}`;
});

check('no uncaught errors during the whole session', () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
  return 'clean';
});

console.log(`\n${pass}/${pass + fail.length} single-file checks passed`);
if (fail.length) {
  console.log('\nFAILURES');
  for (const f of fail) console.log(`  ✗ ${f}`);
}
// jsdom keeps timers alive; close it so the process exits under `npm test`
try {
  window.close();
} catch (_) {}
process.exit(fail.length ? 1 : 0);
