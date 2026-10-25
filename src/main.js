/**
 * JUMP TO THE STAR — boot, screens, loop, persistence.
 * Experiment #001, supervised (loosely) by Professor Shapi.
 */
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { SaveStore, CHARACTER_IDS } from './game/save.js';
import { Game } from './game/game.js';
import { AudioEngine } from './game/audio.js';
import { CHARACTERS, CHARACTER_LIST, resolveStats } from './game/characters.js';
import { UPGRADE_INFO, UPGRADE_BY_ID, MAX_LEVEL, costForLevel, ACHIEVEMENTS } from './game/upgrades.js';
import { QUALITY, REGIONS, PX_PER_METER, regionAt } from './config/config.js';
import { renderScene } from './art/scene.js';
import { drawLogo } from './art/ui.js';
import { drawCharacter } from './art/characters.js';
import { drawSky, drawParallax } from './art/world.js';
import { drawItemArt } from './art/items.js';
import { clamp, formatMeters, formatScore } from './core/mathx.js';
import { PAL, hexA, ellipse, fillPath, strokePath, rr, inked, starPath, linear } from './art/art.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// --------------------------------------------------------------------- boot
const canvas = $('#game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const save = new SaveStore(safeStorage());
const audio = new AudioEngine(save.data.settings);
const input = new Input(window);

let cssW = window.innerWidth;
let cssH = window.innerHeight;
let dpr = 1;

const game = new Game({
  canvas,
  save,
  audio,
  onGameOver: handleGameOver,
  onEvent: (type, payload) => {
    if (type === 'region') toast(payload.name, 1600, payload.hue);
  },
});

const uiState = {
  screen: 'menu',
  prevScreen: 'menu',
  charTab: save.data.selected,
  portraitT: 0,
  toastTimer: 0,
};

/* ------------------------------------------------------------------ helpers */
function safeStorage() {
  try {
    const k = '__jtts_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch (_) {
    return null; // private mode / blocked storage → the game still runs, no saves
  }
}

function qualitySettings() {
  return QUALITY[save.data.settings.quality] || QUALITY.balanced;
}

function resize() {
  cssW = window.innerWidth;
  cssH = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, qualitySettings().dprCap);
  canvas.width = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(cssH * dpr));
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  game.resize(cssW, cssH, dpr);
  updateTouchVisibility();
}

function showScreen(name) {
  uiState.prevScreen = uiState.screen;
  uiState.screen = name || null;
  for (const el of $$('.screen')) el.classList.remove('is-active');
  if (!name) {
    $('#pauseBtn').classList.remove('is-on');
    $('#touchControls').classList.remove('is-on');
    return;
  }
  const el = $(`#screen-${name}`);
  if (el) el.classList.add('is-active');
  const playing = name === 'pause' || name === 'gameover';
  $('#pauseBtn').classList.toggle('is-on', playing || game.isRunning() && !name);
  updateTouchVisibility();
  if (name === 'menu') refreshMenu();
  if (name === 'characters') refreshCharacters();
  if (name === 'upgrades') refreshUpgrades();
  if (name === 'records') refreshRecords();
  if (name === 'settings') refreshSettings();
  if (name === 'pause') {
    $('#pauseMap').classList.remove('is-open');
    $('#pauseSub').textContent = `${formatMeters(game.score.metres)} · ${game.region.name}`;
  }
}

function updateTouchVisibility() {
  const mode = save.data.settings.touch;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const touchOn = mode === 'on' || (mode === 'auto' && coarse);
  const playing = uiState.screen === null && (game.state === 'fly' || game.state === 'launch');
  $('#touchControls').classList.toggle('is-on', !!touchOn && playing);
  $('#touchControls').style.setProperty('--touch-scale', String(save.data.settings.touchScale || 1));
  if (uiState.screen === null && game.isRunning()) $('#pauseBtn').classList.add('is-on');
  else $('#pauseBtn').classList.remove('is-on');
}

let toastEl = null;
function toast(text, ms = 1400, colour = '#ffe86b') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.getElementById('app').appendChild(toastEl);
    const style = document.createElement('style');
    style.textContent = `
      .toast{position:absolute;left:50%;top:12%;transform:translateX(-50%);z-index:30;
        padding:10px 18px;border-radius:14px;background:rgba(16,8,34,.92);
        border:2px solid rgba(255,255,255,.18);font-family:var(--font-display);
        letter-spacing:1px;font-size:14px;text-align:center;pointer-events:none;
        opacity:0;transition:opacity .18s ease, transform .18s ease;max-width:86vw}
      .toast.is-on{opacity:1;transform:translateX(-50%) translateY(-6px)}
    `;
    document.head.appendChild(style);
  }
  toastEl.textContent = text;
  toastEl.style.color = colour;
  toastEl.style.borderColor = colour + '55';
  toastEl.classList.add('is-on');
  clearTimeout(uiState.toastTimer);
  uiState.toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), ms);
}

// ---------------------------------------------------------------- menu bits
function refreshMenu() {
  $('#menuCoins').textContent = formatScore(save.data.coins);
  $('#menuBest').textContent = formatMeters(save.data.records.distance);
  $('#menuPilot').textContent = CHARACTERS[save.data.selected].name;
}

function drawLogoFrame() {
  const lc = $('#logoCanvas');
  if (!lc) return;
  const lctx = lc.getContext('2d');
  const w = lc.width;
  const h = lc.height;
  lctx.clearRect(0, 0, w, h);
  lctx.save();
  lctx.translate(w / 2, h / 2 + 6);
  drawLogo(lctx, 0, 0, 1.28, performance.now() / 1000);
  lctx.restore();
}

/** Animated menu backdrop drawn on the main canvas. */
function renderBackdrop(t) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const region = regionAt(0);
  drawSky(ctx, cssW, cssH, 'lab', t, 1);
  const zoom = clamp(Math.min(cssW / 1340, cssH / 760), 0.55, 1.4);
  const cam = { x: t * 70, y: -180, zoom, vw: cssW / zoom, vh: cssH / zoom };
  ctx.save();
  ctx.translate(cssW / 2 - cam.x * zoom, cssH / 2 - cam.y * zoom);
  ctx.scale(zoom, zoom);
  drawParallax(ctx, cam, cssW, cssH, 'lab', t, 1);
  // floating loot
  const floaters = [
    { id: 'orb', x: 240, y: -360, r: 34 },
    { id: 'super', x: 980, y: -620, r: 30 },
    { id: 'boostStar', x: 1620, y: -420, r: 40 },
    { id: 'coin', x: 640, y: -740, r: 22 },
  ];
  for (const f of floaters) {
    const x = f.x + Math.sin(t * 0.6 + f.x) * 30;
    const y = f.y + Math.sin(t * 0.9 + f.x * 0.01) * 24;
    ctx.save();
    ctx.translate(x, y);
    drawItemArt(ctx, f.id, t + f.x, { scale: 1.1 });
    ctx.restore();
  }
  // the pilot doing a show-off lap
  const px = 300 + ((t * 220) % (cssW / zoom + 900));
  const py = -520 + Math.sin(t * 1.4) * 70;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.sin(t * 1.1) * 0.1);
  drawCharacter(ctx, save.data.selected, {
    t,
    expr: 'excited',
    look: 0.6,
    rot: 0.1,
    squash: 1,
    stretch: 1.04,
    skill: 0.5 + Math.sin(t * 6) * 0.3,
    mode: 0,
    facing: 1,
    scale: 1.15,
  });
  ctx.restore();
  // exhaust puffs
  for (let i = 0; i < 5; i++) {
    const k = (t * 2 + i * 0.2) % 1;
    ctx.globalAlpha = (1 - k) * 0.4;
    fillPath(ctx, () => ellipse(ctx, px - 60 - k * 120, py + 24 + Math.sin(i) * 10, 12 + k * 22, 10 + k * 18), '#ffe86b');
  }
  ctx.globalAlpha = 1;
  // ground silhouette
  ctx.fillStyle = 'rgba(10,26,24,0.35)';
  ctx.beginPath();
  const gy = 420;
  ctx.moveTo(-500, gy + 400);
  for (let x = -600; x < cssW / zoom + 800; x += 80) {
    ctx.lineTo(x, gy + Math.sin(x * 0.004) * 26);
  }
  ctx.lineTo(cssW / zoom + 800, gy + 500);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------- characters UI
function buildCharacterCards() {
  const grid = $('#charGrid');
  if (grid.childElementCount) return;
  for (const c of CHARACTER_LIST) {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.dataset.char = c.id;
    card.innerHTML = `
      <canvas width="150" height="130"></canvas>
      <div class="cc-name">${c.name}</div>
      <div class="cc-diff" style="color:${c.difficulty === 'EASY' ? '#9ff7a0' : c.difficulty === 'MEDIUM' ? '#ffd93b' : '#ff8a8a'}">${c.difficulty}</div>
    `;
    card.addEventListener('click', () => onCharacterClick(c.id));
    grid.appendChild(card);
  }
}

function refreshCharacters() {
  buildCharacterCards();
  const data = save.data;
  for (const card of $$('.char-card')) {
    const id = card.dataset.char;
    const c = CHARACTERS[id];
    const unlocked = !!data.unlocked[id];
    card.classList.toggle('is-locked', !unlocked);
    card.classList.toggle('is-selected', data.selected === id);
    let lock = card.querySelector('.cc-lock');
    let owned = card.querySelector('.cc-owned');
    if (!unlocked) {
      if (!lock) {
        lock = document.createElement('div');
        lock.className = 'cc-lock';
        card.appendChild(lock);
      }
      lock.innerHTML = `${c.unlockCost} ★ COINS`;
      if (owned) owned.remove();
    } else {
      if (lock) lock.remove();
      if (!owned) {
        owned = document.createElement('div');
        owned.className = 'cc-owned';
        card.appendChild(owned);
      }
    }
  }
  refreshCharDetail();
}

function refreshCharDetail() {
  const id = save.data.selected;
  const c = CHARACTERS[id];
  const st = resolveStats(c, save.data.upgrades[id] || {});
  const stats = [
    ['LAUNCH', c.stats.launch],
    ['BOUNCE', c.stats.bounce],
    ['ENERGY', st.energyMax / 140],
    ['STEER', c.stats.steer],
    ['SPEED', c.stats.vxCap],
    ['AGILITY', 1.6 - c.stats.gravity],
  ];
  const detail = $('#charDetail');
  detail.innerHTML = `
    <div>
      <h3>${c.name}</h3>
      <div class="cd-skill">SKILL · ${c.skill.name} ${c.skill.hold ? '(HOLD)' : ''}</div>
      <p>${c.blurb}</p>
      <p style="color:#bff7ff">${c.skill.desc}</p>
      <div class="sw">
        ${c.strengths.map((s) => `<span class="good">+ ${s}</span>`).join('')}
        ${c.weaknesses.map((s) => `<span class="bad">− ${s}</span>`).join('')}
      </div>
      <p style="opacity:.7">Unlocks: ${c.unlockCost === 0 ? 'available from the start' : `${c.unlockCost} Star Coins`}</p>
    </div>
    <div>
      <div class="stat-bars">
        ${stats
          .map(
            ([label, v]) => `<div class="stat-bar"><span>${label}</span><span class="track"><i class="fill" style="width:${clamp(v, 0.15, 1) * 100}%"></i></span><span>${Math.round(clamp(v, 0.15, 1) * 100)}</span></div>`,
          )
          .join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn--primary" id="detailPlay">PLAY AS ${c.name.split(' ')[0]}</button>
        <button class="btn" id="detailUpgrade">UPGRADES</button>
      </div>
    </div>
  `;
  $('#detailPlay').addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    startRun();
  });
  $('#detailUpgrade').addEventListener('click', () => {
    uiState.charTab = save.data.selected;
    showScreen('upgrades');
  });
}

function onCharacterClick(id) {
  const c = CHARACTERS[id];
  const data = save.data;
  audio.unlock();
  if (!data.unlocked[id]) {
    if (data.coins >= c.unlockCost) {
      data.coins -= c.unlockCost;
      data.unlocked[id] = true;
      data.selected = id;
      if (Object.values(data.unlocked).every(Boolean)) data.achievements.all_characters = true;
      save.save();
      audio.sfx('upgrade');
      toast(`${c.name} RECRUITED!`, 1800, '#9ff7a0');
      refreshMenu();
    } else {
      audio.sfx('hit', { volume: 0.5 });
      toast(`NEED ${c.unlockCost - data.coins} MORE STAR COINS`, 1500, '#ff9db0');
      return;
    }
  } else {
    data.selected = id;
    save.save();
    audio.sfx('click');
  }
  game.setCharacter(id, data.upgrades);
  refreshCharacters();
  refreshMenu();
}

// ---------------------------------------------------------------- upgrades UI
function refreshUpgrades() {
  const data = save.data;
  $('#upgradeCoins').textContent = formatScore(data.coins);
  const tabs = $('#upgradeTabs');
  tabs.innerHTML = '';
  for (const c of CHARACTER_LIST) {
    const b = document.createElement('button');
    b.textContent = c.name;
    b.classList.toggle('is-active', uiState.charTab === c.id);
    b.addEventListener('click', () => {
      uiState.charTab = c.id;
      audio.sfx('click');
      refreshUpgrades();
    });
    tabs.appendChild(b);
  }
  const id = uiState.charTab;
  const c = CHARACTERS[id];
  const lvls = data.upgrades[id] || {};
  const st = resolveStats(c, lvls);
  $('#upgradeName').textContent = c.name;
  $('#upgradeStats').innerHTML = `
    <div><span>Launch</span><b>${(st.launchMul * 100).toFixed(0)}%</b></div>
    <div><span>Boost</span><b>${(st.boostMul * 100).toFixed(0)}%</b></div>
    <div><span>Energy</span><b>${st.energyMax}</b></div>
    <div><span>Gravity</span><b>${(st.gravityMul * 100).toFixed(0)}%</b></div>
    <div><span>Skill cost</span><b>${(st.skillCostMul * 100).toFixed(0)}%</b></div>
    <div><span>Skill power</span><b>${(st.skillPower * 100).toFixed(0)}%</b></div>
    <div><span>Item bonus</span><b>+${((st.itemMul - 1) * 100).toFixed(0)}%</b></div>
  `;
  const list = $('#upgradeList');
  list.innerHTML = '';
  for (const info of UPGRADE_INFO) {
    const lv = lvls[info.id] || 0;
    const cost = costForLevel(lv);
    const row = document.createElement('div');
    row.className = 'up-row';
    row.innerHTML = `
      <div>
        <h4 style="color:${info.colour}">${info.label}</h4>
        <p>${info.desc}</p>
        <p style="color:#bff7ff">${lv > 0 ? info.effect(lv) : 'no modification yet'}</p>
        <div class="pips">${Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <button class="up-buy" ${cost == null || data.coins < cost ? 'disabled' : ''}>
        ${cost == null ? 'MAXED' : `UPGRADE<small>${cost} ★</small>`}
      </button>
    `;
    const btn = row.querySelector('button');
    if (cost != null) {
      btn.addEventListener('click', () => {
        if (data.coins < cost) {
          audio.sfx('hit', { volume: 0.45 });
          toast('NOT ENOUGH STAR COINS', 1300, '#ff9db0');
          return;
        }
        data.coins -= cost;
        data.upgrades[id][info.id] = lv + 1;
        save.save();
        audio.sfx('upgrade');
        toast(`${info.label} → LEVEL ${lv + 1}`, 1400, info.colour);
        refreshUpgrades();
        refreshMenu();
      });
    }
    list.appendChild(row);
  }
}

function drawUpgradePortrait(t) {
  const cv = $('#upgradePortrait');
  if (!cv || uiState.screen !== 'upgrades') return;
  const c = cv.getContext('2d');
  const w = cv.width;
  const h = cv.height;
  c.clearRect(0, 0, w, h);
  const g = c.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, w * 0.6);
  g.addColorStop(0, 'rgba(127,227,63,0.20)');
  g.addColorStop(1, 'rgba(127,227,63,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  // pedestal
  c.save();
  c.translate(w / 2, h * 0.83);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.ellipse(0, 6, 96, 22, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(255,217,59,0.35)';
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(0, 0, 96, 22, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
  c.save();
  c.translate(w / 2, h * 0.54);
  c.scale(1.7, 1.7);
  drawCharacter(c, uiState.charTab, {
    t,
    expr: Math.sin(t * 0.9) > 0.93 ? 'excited' : 'happy',
    look: 0.4,
    blink: Math.sin(t * 1.3) > 0.985 ? 1 : 0,
    rot: Math.sin(t * 1.2) * 0.03,
    squash: 1,
    stretch: 1,
    skill: 0,
    mode: 0,
    facing: 1,
  });
  c.restore();
}

function drawCharacterPortraits(t) {
  if (uiState.screen !== 'characters') return;
  for (const card of $$('.char-card')) {
    const id = card.dataset.char;
    const cv = card.querySelector('canvas');
    if (!cv) continue;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    const unlocked = save.data.unlocked[id];
    c.save();
    c.translate(cv.width / 2, cv.height * 0.58);
    c.scale(0.86, 0.86);
    if (!unlocked) c.globalAlpha = 0.55;
    drawCharacter(c, id, {
      t: t + (id.length * 0.7),
      expr: Math.sin(t * 1.1 + id.length) > 0.93 ? 'excited' : 'happy',
      look: 0.4,
      blink: Math.sin(t * 1.5 + id.length) > 0.985 ? 1 : 0,
      rot: 0,
      squash: 1,
      stretch: 1 + Math.sin(t * 2 + id.length) * 0.015,
      skill: 0,
      mode: 0,
      facing: 1,
    });
    c.restore();
    if (!unlocked) {
      c.save();
      c.globalAlpha = 0.5;
      c.fillStyle = '#0b0620';
      c.fillRect(0, 0, cv.width, cv.height);
      c.restore();
    }
  }
}

// ---------------------------------------------------------------- records UI
function refreshRecords() {
  const r = save.data.records;
  $('#recDistance').textContent = formatMeters(r.distance);
  $('#recScore').textContent = formatScore(r.score);
  $('#recCombo').textContent = String(r.combo);
  $('#recCoins').textContent = formatScore(r.coinsEarned);
  $('#recRuns').textContent = String(save.data.totalRuns);
  $('#recUnlocked').textContent = `${CHARACTER_IDS.filter((id) => save.data.unlocked[id]).length} / 5`;

  const best = r.best || {};
  $('#recBestList').innerHTML = CHARACTER_LIST.map((c) => {
    const b = best[c.id] || { distance: 0, runs: 0 };
    return `<div><span>${c.name}</span><b>${formatMeters(b.distance || 0)} <small style="opacity:.5">(${b.runs || 0} runs)</small></b></div>`;
  }).join('');

  const hist = r.history || [];
  $('#recHistory').innerHTML = hist.length
    ? hist
        .map(
          (h) =>
            `<div><span>${CHARACTERS[h.character]?.name.split(' ')[0] || '?'} · ${new Date(h.date).toLocaleDateString()}</span><b>${formatMeters(h.distance)} · ${formatScore(h.score)}</b></div>`,
        )
        .join('')
    : '<div class="h-empty">No flights logged yet. Shapi is waiting.</div>';

  $('#recAchievements').innerHTML = ACHIEVEMENTS.map(
    (a) => `<div class="ach ${save.data.achievements[a.id] ? 'on' : ''}"><span class="dot"></span>${a.label}</div>`,
  ).join('');
}

// --------------------------------------------------------------- settings UI
function refreshSettings() {
  const s = save.data.settings;
  $('#setMaster').value = Math.round(s.master * 100);
  $('#setMusic').value = Math.round(s.music * 100);
  $('#setSfx').value = Math.round(s.sfx * 100);
  $('#outMaster').textContent = Math.round(s.master * 100) + '%';
  $('#outMusic').textContent = Math.round(s.music * 100) + '%';
  $('#outSfx').textContent = Math.round(s.sfx * 100) + '%';
  $('#setTouchScale').value = Math.round(s.touchScale * 100);
  $('#outTouch').textContent = Math.round(s.touchScale * 100) + '%';
  $('#setShake').checked = !!s.reduceShake;
  $('#setFps').checked = !!s.showFps;
  for (const b of $$('#setQuality button')) b.classList.toggle('is-active', b.dataset.q === s.quality);
  for (const b of $$('#setTouch button')) b.classList.toggle('is-active', b.dataset.t === s.touch);
}

function bindSettings() {
  const apply = () => {
    save.save();
    audio.applySettings(save.data.settings);
    game.setQuality(save.data.settings.quality);
    game.camera.reduceShake = !!save.data.settings.reduceShake;
    $('#fpsReadout').classList.toggle('is-on', !!save.data.settings.showFps);
    resize();
    updateTouchVisibility();
  };
  const bindSlider = (id, out, key) => {
    const el = $(id);
    el.addEventListener('input', () => {
      const v = Number(el.value) / 100;
      save.data.settings[key] = v;
      $(out).textContent = Math.round(v * 100) + '%';
      apply();
    });
  };
  bindSlider('#setMaster', '#outMaster', 'master');
  bindSlider('#setMusic', '#outMusic', 'music');
  bindSlider('#setSfx', '#outSfx', 'sfx');
  $('#setTouchScale').addEventListener('input', (e) => {
    save.data.settings.touchScale = Number(e.target.value) / 100;
    $('#outTouch').textContent = e.target.value + '%';
    apply();
  });
  for (const b of $$('#setQuality button')) {
    b.addEventListener('click', () => {
      save.data.settings.quality = b.dataset.q;
      audio.sfx('click');
      refreshSettings();
      apply();
    });
  }
  for (const b of $$('#setTouch button')) {
    b.addEventListener('click', () => {
      save.data.settings.touch = b.dataset.t;
      audio.sfx('click');
      refreshSettings();
      apply();
    });
  }
  $('#setShake').addEventListener('change', (e) => {
    save.data.settings.reduceShake = e.target.checked;
    apply();
  });
  $('#setFps').addEventListener('change', (e) => {
    save.data.settings.showFps = e.target.checked;
    apply();
  });
  $('#btnReset').addEventListener('click', () => {
    if (!window.confirm('Reset ALL progress? Coins, unlocks, upgrades and records will be deleted. This cannot be undone.')) return;
    save.reset();
    audio.applySettings(save.data.settings);
    game.setCharacter(save.data.selected, save.data.upgrades);
    refreshMenu();
    refreshSettings();
    toast('SAVE RESET. SCIENCE STARTS OVER.', 2000, '#ff9db0');
  });
}

// ------------------------------------------------------------------ run flow
function startRun() {
  audio.unlock();
  game.setQuality(save.data.settings.quality);
  game.setCharacter(save.data.selected, save.data.upgrades);
  game.setQuality(save.data.settings.quality);
  showScreen(null);
  game.startRun();
  updateTouchVisibility();
  $('#pauseBtn').classList.add('is-on');
  input.releaseAll();
  input.pressAt = { boost: -99, skill: -99, confirm: -99, pause: -99, mute: -99 };
}

function handleGameOver(summary) {
  const data = save.data;
  const charId = summary.character;
  data.coins += summary.coinsEarned;
  data.totalRuns += 1;
  data.records.coinsEarned += summary.coinsEarned;
  data.records.distance = Math.max(data.records.distance, summary.metres);
  data.records.score = Math.max(data.records.score, summary.score);
  data.records.combo = Math.max(data.records.combo, summary.bestCombo);
  data.records.best[charId] = data.records.best[charId] || { distance: 0, score: 0, runs: 0 };
  const b = data.records.best[charId];
  b.distance = Math.max(b.distance, summary.metres);
  b.score = Math.max(b.score, summary.score);
  b.runs += 1;
  data.records.history.unshift({
    character: charId,
    distance: summary.metres,
    score: summary.score,
    combo: summary.bestCombo,
    coins: summary.coinsEarned,
    date: Date.now(),
  });
  data.records.history = data.records.history.slice(0, 8);
  data.stats.orbs += Math.round(summary.pickups || 0);
  data.stats.boosts += summary.boostsUsed || 0;
  data.stats.springs += summary.springs || 0;
  data.stats.skills += summary.skills || 0;

  // achievements
  const a = data.achievements;
  a.first_flight = true;
  if (summary.metres >= 500) a.five_hundred = true;
  if (summary.metres >= 2000) a.two_thousand = true;
  if (summary.metres >= 5000) a.five_thousand = true;
  if (summary.metres >= 15000) a.fifteen_thousand = true;
  if (summary.metres >= 25000) a.scientist = true;
  if (summary.bestCombo >= 15) a.combo_insane = true;
  if ((summary.boostsUsed || 0) >= 10) a.boost_master = true;
  if ((summary.springs || 0) >= 12) a.spring_chain = true;
  if (CHARACTER_IDS.every((id) => data.unlocked[id])) a.all_characters = true;

  save.save();
  refreshMenu();

  // fill the result modal
  $('#goRibbon').textContent = summary.newBest ? 'NEW WORLD RECORD' : 'EXPERIMENT FAILED';
  $('#goRibbon').classList.toggle('is-record', !!summary.newBest);
  $('#goTitle').textContent = summary.cause === 'floor' ? 'SPLAT.' : 'LOST IN SPACE.';
  $('#goSub').textContent =
    summary.cause === 'floor'
      ? 'The launch lab floor claims another volunteer.'
      : 'The pilot exceeded the documented universe.';
  $('#goDistance').textContent = formatMeters(summary.metres);
  $('#goRegion').textContent = summary.floorReached;
  $('#goScore').textContent = formatScore(summary.score);
  $('#goCombo').textContent = `${summary.bestCombo}×`;
  $('#goCoins').textContent = `+${summary.coinsEarned}`;
  $('#goBoosts').textContent = String(summary.boostsUsed || 0);
  $('#goSkills').textContent = String(summary.skills || 0);
  $('#goSprings').textContent = String(summary.springs || 0);
  const quotes = [
    '"Science is mostly falling over. Repeatedly."',
    '"That was not flying. That was a very long mistake."',
    '"Note to self: the ground is still there."',
    '"We shall call this result: data."',
    '"The chicken would have made it. Probably."',
    '"I have 47 years of experience and still no idea."',
  ];
  $('#goQuote').textContent = quotes[Math.floor(Math.random() * quotes.length)];
  showScreen('gameover');
  $('#pauseBtn').classList.remove('is-on');
}

function pauseGame() {
  if (uiState.screen || !game.isRunning()) return;
  game.pause();
  showScreen('pause');
  audio.sfx('click');
}

function resumeGame() {
  if (uiState.screen === 'pause') {
    showScreen(null);
    game.resume();
  }
}

function quitToMenu() {
  game.state = 'idle';
  game.particles.clear();
  game.floaters.length = 0;
  showScreen('menu');
  audio.setScene('menu');
  $('#pauseBtn').classList.remove('is-on');
}

function openJourneyMap() {
  const panel = $('#pauseMap');
  panel.classList.toggle('is-open');
  if (!panel.classList.contains('is-open')) return;
  const m = game.score.metres;
  panel.innerHTML = `
    <div class="map-track"><i style="left:${clamp((m / 15000) * 100, 0, 100)}%"></i></div>
    ${REGIONS.map((r) => {
      const reached = m >= r.from;
      return `<div class="map-region"><span class="dot" style="background:${r.hue};opacity:${reached ? 1 : 0.25}"></span>
        <span style="opacity:${reached ? 1 : 0.5}">${r.name}</span>
        <b>${r.to === Infinity ? '∞' : r.to.toLocaleString('en-US') + ' m'}</b></div>`;
    }).join('')}
    <p class="modal-sub" style="margin-top:10px">Current flight: <b style="color:#ffe86b">${formatMeters(m)}</b> · ${game.region.name}</p>
  `;
}

// --------------------------------------------------------------------- input
function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (uiState.screen === 'pause') {
        resumeGame();
        e.preventDefault();
      } else if (uiState.screen === 'gameover') {
        quitToMenu();
      } else if (!uiState.screen && game.isRunning()) {
        pauseGame();
        e.preventDefault();
      } else if (uiState.screen && ['characters', 'upgrades', 'records', 'settings'].includes(uiState.screen)) {
        showScreen('menu');
      }
    }
    if (e.code === 'Enter') {
      if (uiState.screen === 'gameover') startRun();
      else if (uiState.screen === 'menu') startRun();
      else if (uiState.screen === null && game.state === 'launch') game.fireLaunch();
    }
    if (e.code === 'KeyM' && !uiState.screen) {
      audio.setMuted(!audio.muted);
      toast(audio.muted ? 'SOUND MUTED' : 'SOUND ON', 900);
    }
  });

  $('#pauseBtn').addEventListener('click', () => pauseGame());

  // Right mouse button = character skill (works held, like Shift).
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 2 || uiState.screen) return;
    e.preventDefault();
    audio.unlock();
    input.setVirtual('skill', true);
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) input.setVirtual('skill', false);
  });
  window.addEventListener('contextmenu', (e) => {
    if (!uiState.screen) e.preventDefault();
  });

  for (const btn of $$('[data-touch]')) {
    const action = btn.dataset.touch;
    const down = (e) => {
      e.preventDefault();
      audio.unlock();
      btn.classList.add('is-down');
      input.setVirtual(action, true);
      if (btn.setPointerCapture && e.pointerId != null) {
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      }
      if (action === 'boost' && game.state === 'launch') {
        // the launch charge reads the same virtual button
      }
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove('is-down');
      input.setVirtual(action, false);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', (e) => {
      if (e.buttons === 0) return;
      up(e);
    });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // menu + modal actions
  document.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    audio.unlock();
    audio.sfx('click', { volume: 0.6 });
    switch (action) {
      case 'play':
        startRun();
        break;
      case 'characters':
        showScreen('characters');
        break;
      case 'upgrades':
        uiState.charTab = save.data.selected;
        showScreen('upgrades');
        break;
      case 'records':
        showScreen('records');
        break;
      case 'settings':
        uiState.prevSettings = uiState.screen;
        showScreen('settings');
        break;
      case 'menu':
        quitToMenu();
        break;
      case 'back':
        showScreen(uiState.prevSettings === 'pause' ? 'pause' : 'menu');
        break;
      case 'resume':
        resumeGame();
        break;
      case 'restart':
        startRun();
        break;
      case 'map':
        openJourneyMap();
        break;
      case 'retry':
        startRun();
        break;
      case 'quit':
        quitToMenu();
        break;
      default:
        break;
    }
  });

  window.addEventListener('blur', () => {
    if (!uiState.screen && game.isRunning()) pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !uiState.screen && game.isRunning()) pauseGame();
  });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
}

// ---------------------------------------------------------------------- loop
const loop = new Loop({
  step: 1 / 120,
  update: (dt, now) => {
    if (uiState.screen === null || game.state === 'dead') {
      if (game.state !== 'paused') game.update(dt, now * 1, input);
    }
    input.endFrame(game.time);
  },
  render: (dt, now) => {
    const t = now;
    if (uiState.screen === 'menu' || uiState.screen === 'characters' || uiState.screen === 'records' || uiState.screen === 'upgrades' || uiState.screen === 'settings') {
      renderBackdrop(t);
      if (uiState.screen === 'menu') drawLogoFrame();
      drawCharacterPortraits(t);
      drawUpgradePortrait(t);
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const touchMode = $('#touchControls').classList.contains('is-on');
      renderScene(ctx, game, cssW, cssH, t, save.data.settings.quality, { touchMode });
    }
    $('#fpsReadout').textContent = `${Math.round(loop.fps)} fps`;
  },
});
loop.onSecond = (fps) => {
  if (fps < 45 && save.data.settings.quality === 'high') {
    // graceful auto-degrade so weak devices stay playable
    save.data.settings.quality = 'balanced';
    save.save();
    game.setQuality('balanced');
    resize();
    toast('AUTO-QUALITY: BALANCED (slow device detected)', 1800, '#ffd93b');
  }
};

// ---------------------------------------------------------------------- init
function init() {
  resize();
  game.setQuality(save.data.settings.quality);
  game.setCharacter(save.data.selected, save.data.upgrades);
  game.state = 'idle';
  bindInput();
  bindSettings();
  refreshMenu();
  refreshSettings();
  showScreen('menu');
  $('#fpsReadout').classList.toggle('is-on', !!save.data.settings.showFps);
  audio.setScene('menu');
  audio.applySettings(save.data.settings);
  // unlock audio on the first real interaction
  const kick = () => audio.unlock();
  window.addEventListener('pointerdown', kick, { once: true });
  window.addEventListener('keydown', kick, { once: true });
  setTimeout(() => $('#loading').classList.add('is-done'), 450);
  loop.start();

  // expose a tiny debug handle for the console and for automated tests
  window.JTTS = {
    game,
    save,
    audio,
    input,
    startRun,
    showScreen,
    get screen() {
      return uiState.screen;
    },
    version: '1.0.0',
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
