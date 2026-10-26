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
import { applyI18n, detectLang, getLang, onLangChange, pick, pickSkill, regionLabel, setLang, t } from './core/i18n.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// --------------------------------------------------------------------- boot
const canvas = $('#game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const save = new SaveStore(safeStorage());
// Migrate the old default Wide view once, without overwriting later user choices.
if (!save.data.settings.ultraDefaultApplied) {
  if (save.data.settings.view === 'wide') save.data.settings.view = 'ultra';
  save.data.settings.ultraDefaultApplied = true;
  save.save();
}
const mobileTouch = !!(window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
// Language lives outside the save too, so it applies before the first paint.
setLang(save.data.settings.lang || detectLang(), { persist: false });
save.data.settings.lang = getLang();
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
    if (type === 'region') toast(regionLabel(payload, false), 1600, payload.hue);
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
  const phoneCap = mobileTouch ? (save.data.settings.quality === 'high' ? 1.5 : 1.15) : Infinity;
  dpr = Math.min(window.devicePixelRatio || 1, qualitySettings().dprCap, phoneCap);
  const pixelW = Math.max(1, Math.floor(cssW * dpr));
  const pixelH = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== pixelW) canvas.width = pixelW;
  if (canvas.height !== pixelH) canvas.height = pixelH;
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
    $('#pauseSub').textContent = `${formatMeters(game.score.metres)} · ${regionLabel(game.region, false)}`;
  }
}

function updateTouchVisibility() {
  const mode = save.data.settings.touch;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const touchOn = mode === 'on' || (mode === 'auto' && coarse);
  const playing = uiState.screen === null && (game.state === 'fly' || game.state === 'launch');
  $('#touchControls').classList.toggle('is-on', !!touchOn && playing);
  $('#touchControls').style.setProperty('--touch-scale', String(save.data.settings.touchScale ?? 0.5));
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

let lastLogoPaint = -1;
function drawLogoFrame(now = performance.now() / 1000) {
  // The vector logo is expensive at 720×420; 30 Hz is smooth for a subtle
  // rocking animation and avoids repeated blur/shadow work on Android.
  if (mobileTouch && now - lastLogoPaint < 1 / 30) return;
  lastLogoPaint = now;
  const lc = $('#logoCanvas');
  if (!lc) return;
  const lctx = lc.getContext('2d');
  const w = lc.width;
  const h = lc.height;
  lctx.clearRect(0, 0, w, h);
  lctx.save();
  lctx.translate(w / 2, h / 2 + 6);
  drawLogo(lctx, 0, 0, 1.28, now);
  lctx.restore();
}

/** Animated menu backdrop drawn on the main canvas. */
function renderBackdrop(t) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const q = qualitySettings();
  drawSky(ctx, cssW, cssH, 'lab', t, q.parallax);
  const zoom = clamp(Math.min(cssW / 1250, cssH / 740), 0.55, 1.25);
  const cam = { x: t * 85, y: -180, zoom, vw: cssW / zoom, vh: cssH / zoom };

  // Parallax draws in SCREEN coordinates and applies its own transforms.
  // Never nest it inside the animated foreground camera: that doubled zoom
  // and pushed clouds/scenery out of view, especially in mobile landscape.
  drawParallax(ctx, cam, cssW, cssH, 'lab', t, q.parallax);

  // The foreground lives on a looping, viewport-relative track. It cannot
  // drift out of existence when the menu stays open for several minutes.
  ctx.save();
  ctx.translate(cssW / 2, cssH / 2);
  ctx.scale(zoom, zoom);
  const vw = cssW / zoom;
  const vh = cssH / zoom;
  const wrap = (v, range) => ((v % range) + range) % range;
  const floaters = [
    { id: 'orb', x: 0.08, y: -0.28, speed: 27 },
    { id: 'super', x: 0.68, y: -0.12, speed: -34 },
    { id: 'boostStar', x: 0.40, y: 0.22, speed: 24 },
    { id: 'coin', x: 0.92, y: 0.31, speed: -19 },
  ];
  for (const f of floaters) {
    const fx = -vw / 2 - 80 + wrap(f.x * vw + t * f.speed, vw + 160);
    const fy = vh * f.y + Math.sin(t * 0.9 + f.x * 9) * 22;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(Math.sin(t * 1.2 + f.x * 7) * 0.12);
    drawItemArt(ctx, f.id, t + f.x * 9, { scale: 0.98 });
    ctx.restore();
  }

  const px = -vw / 2 - 130 + wrap(t * 185, vw + 260);
  const py = -vh * 0.23 + Math.sin(t * 1.4) * 40;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.sin(t * 1.1) * 0.08);
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
  for (let i = 0; i < 5; i++) {
    const k = wrap(t * 2 + i * 0.2, 1);
    ctx.globalAlpha = (1 - k) * 0.36;
    fillPath(ctx, () => ellipse(ctx, px - 60 - k * 120, py + 24 + Math.sin(i) * 10, 12 + k * 22, 10 + k * 18), '#ffe86b');
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(10,26,24,0.30)';
  ctx.beginPath();
  const gy = vh * 0.48;
  ctx.moveTo(-vw / 2 - 160, gy + 200);
  for (let x = -vw / 2 - 160; x <= vw / 2 + 160; x += 80) {
    ctx.lineTo(x, gy + Math.sin(x * 0.004 + t * 0.06) * 26);
  }
  ctx.lineTo(vw / 2 + 160, gy + 300);
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
      <div class="cc-diff" style="color:${c.difficulty === 'EASY' ? '#9ff7a0' : c.difficulty === 'MEDIUM' ? '#ffd93b' : '#ff8a8a'}">${t(`diff.${c.difficulty.toLowerCase()}`)}</div>
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
      lock.innerHTML = t('char.unlockCost', { n: c.unlockCost });
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

/* ------------------------------------------------------------ i18n helpers */
const skillName = (c) => pickSkill(c, 'name');
const skillDesc = (c) => pickSkill(c, 'desc');
const blurbOf = (c) => pick(c, 'blurb');
const listOf = (c, field) => (getLang() !== 'en' && c.vi && c.vi[field] ? c.vi[field] : c[field]);
const upLabel = (info) => (getLang() !== 'en' && info.vi ? info.vi.label : info.label);
const upDesc = (info) => (getLang() !== 'en' && info.vi ? info.vi.desc : info.desc);

/** Upgrade effect text, localised without duplicating the maths. */
function effectText(info, lv) {
  const raw = info.effect(lv); // e.g. "+11.0% launch velocity"
  if (getLang() === 'en') return raw;
  const vi = {
    launch: `+${(lv * 5.5).toFixed(1)}% tốc độ phóng`,
    boost: `+${(lv * 7.5).toFixed(1)}% sức boost`,
    energy: `+${(lv * 8.5).toFixed(0)}% năng lượng tối đa`,
    aero: `-${(lv * 2.2).toFixed(1)}% trọng lực · -${(lv * 5).toFixed(0)}% lực cản`,
    steer: `+${(lv * 7).toFixed(0)}% khả năng lái`,
    efficiency: `-${(lv * 7).toFixed(0)}% chi phí kỹ năng`,
    synergy: `+${(lv * 6).toFixed(0)}% hiệu quả vật phẩm`,
    skill: `+${(lv * 8).toFixed(0)}% sức kỹ năng`,
  };
  return vi[info.id] || raw;
}

function refreshCharDetail() {
  const id = save.data.selected;
  const c = CHARACTERS[id];
  const st = resolveStats(c, save.data.upgrades[id] || {});
  const stats = [
    [t('char.stat.launch'), c.stats.launch],
    [t('char.stat.bounce'), c.stats.bounce],
    [t('char.stat.energy'), st.energyMax / 140],
    [t('char.stat.steer'), c.stats.steer],
    [t('char.stat.speed'), c.stats.vxCap],
    [t('char.stat.agility'), 1.6 - c.stats.gravity],
  ];
  const detail = $('#charDetail');
  detail.innerHTML = `
    <div>
      <h3>${c.name}</h3>
      <div class="cd-skill">${t('char.skill')} · ${skillName(c)} ${c.skill.hold ? t('char.hold') : ''}</div>
      <p>${blurbOf(c)}</p>
      <p style="color:#bff7ff">${skillDesc(c)}</p>
      <div class="sw">
        ${listOf(c, 'strengths').map((s) => `<span class="good">+ ${s}</span>`).join('')}
        ${listOf(c, 'weaknesses').map((s) => `<span class="bad">− ${s}</span>`).join('')}
      </div>
      <p style="opacity:.7">${c.unlockCost === 0 ? t('char.unlockFree') : t('char.unlockCost', { n: c.unlockCost })}</p>
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
        <button class="btn btn--primary" id="detailPlay">${t('char.playAs')} ${c.name.split(' ')[0]}</button>
        <button class="btn" id="detailUpgrade">${t('char.upgrades')}</button>
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
      toast(t('toast.recruited', { name: c.name }), 1800, '#9ff7a0');
      refreshMenu();
    } else {
      audio.sfx('hit', { volume: 0.5 });
      toast(t('toast.needCoins', { n: c.unlockCost - data.coins }), 1500, '#ff9db0');
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
    <div><span>${t('up.stat.launch')}</span><b>${(st.launchMul * 100).toFixed(0)}%</b></div>
    <div><span>${t('up.stat.boost')}</span><b>${(st.boostMul * 100).toFixed(0)}%</b></div>
    <div><span>${t('up.stat.energy')}</span><b>${st.energyMax}</b></div>
    <div><span>${t('up.stat.gravity')}</span><b>${(st.gravityMul * 100).toFixed(0)}%</b></div>
    <div><span>${t('up.stat.skillCost')}</span><b>${(st.skillCostMul * 100).toFixed(0)}%</b></div>
    <div><span>${t('up.stat.skillPower')}</span><b>${(st.skillPower * 100).toFixed(0)}%</b></div>
    <div><span>${t('up.stat.item')}</span><b>+${((st.itemMul - 1) * 100).toFixed(0)}%</b></div>
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
        <h4 style="color:${info.colour}">${upLabel(info)}</h4>
        <p>${upDesc(info)}</p>
        <p style="color:#bff7ff">${lv > 0 ? effectText(info, lv) : t('up.none')}</p>
        <div class="pips">${Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <button class="up-buy" ${cost == null || data.coins < cost ? 'disabled' : ''}>
        ${cost == null ? t('up.maxed') : `${t('up.buy')}<small>${cost} ★</small>`}
      </button>
    `;
    const btn = row.querySelector('button');
    if (cost != null) {
      btn.addEventListener('click', () => {
        if (data.coins < cost) {
          audio.sfx('hit', { volume: 0.45 });
          toast(t('toast.notEnough'), 1300, '#ff9db0');
          return;
        }
        data.coins -= cost;
        data.upgrades[id][info.id] = lv + 1;
        save.save();
        audio.sfx('upgrade');
        toast(t('toast.level', { label: upLabel(info), lv: lv + 1 }), 1400, info.colour);
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
  for (const b of $$('#setView button')) b.classList.toggle('is-active', b.dataset.v === s.view);
  for (const b of $$('#setLang button')) b.classList.toggle('is-active', b.dataset.l === (s.lang || getLang()));
  for (const b of $$('#setQuality button')) b.classList.toggle('is-active', b.dataset.q === s.quality);
  for (const b of $$('#setTouch button')) b.classList.toggle('is-active', b.dataset.t === s.touch);
}

function applyLanguage(next, { announce = true } = {}) {
  const lang = setLang(next);
  save.data.settings.lang = lang;
  save.save();
  applyI18n(document);
  $('#menuLang').textContent = lang === 'vi' ? 'VI' : 'EN';
  refreshMenu();
  refreshSettings();
  if (uiState.screen === 'characters') refreshCharacters();
  if (uiState.screen === 'upgrades') refreshUpgrades();
  if (uiState.screen === 'records') refreshRecords();
  if (uiState.screen === 'pause') $('#pauseSub').textContent = `${formatMeters(game.score.metres)} · ${regionLabel(game.region, false)}`;
  if (announce) toast(t('toast.lang', { lang: t('lang.name') }), 1100, '#7ee8ff');
}

function bindSettings() {
  const apply = () => {
    save.save();
    audio.applySettings(save.data.settings);
    game.setQuality(save.data.settings.quality);
    game.setViewMode(save.data.settings.view);
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
  for (const b of $$('#setLang button')) {
    b.addEventListener('click', () => {
      audio.sfx('click');
      applyLanguage(b.dataset.l);
    });
  }
  for (const b of $$('#setView button')) {
    b.addEventListener('click', () => {
      save.data.settings.view = b.dataset.v;
      audio.sfx('click');
      refreshSettings();
      apply();
    });
  }
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
    toast(t('toast.reset'), 2000, '#ff9db0');
  });
}

// ------------------------------------------------------------------ run flow
function startRun() {
  audio.unlock();
  game.setViewMode(save.data.settings.view);
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
  $('#goRegion').textContent = regionLabel(summary.region || game.region, true);
  $('#goScore').textContent = formatScore(summary.score);
  $('#goCombo').textContent = `${summary.bestCombo}×`;
  $('#goCoins').textContent = `+${summary.coinsEarned}`;
  $('#goBoosts').textContent = String(summary.boostsUsed || 0);
  $('#goSkills').textContent = String(summary.skills || 0);
  $('#goSprings').textContent = String(summary.springs || 0);
  const quoteKey = `quote.${1 + Math.floor(Math.random() * 6)}`;
  $('#goQuote').textContent = t(quoteKey);
  showScreen('gameover');
  $('#pauseBtn').classList.remove('is-on');
}

/**
 * Open the game in a real top-level tab (outside the Arena preview iframe) and
 * let it take the whole screen. Anchors with target=_blank survive iframe
 * sandboxes far more often than window.open, so we try that first.
 */
function openInNewTab() {
  audio.unlock();
  const url = new URL(window.location.href);
  url.searchParams.set('standalone', '1');
  url.hash = '';
  const href = url.toString();

  // 1) Programmatic anchor click: usually allowed even inside a sandboxed iframe.
  try {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (_) {}

  // 2) Guaranteed manual route: a real link the player taps themselves, which
  //    no browser blocks (it is a direct user gesture).
  showNewTabHint(href);
}

/** Floating "open in a new tab" link, shown for a few seconds after PLAY IN TAB. */
function showNewTabHint(href) {
  const existing = document.getElementById('newTabHint');
  if (existing) existing.remove();
  const box = document.createElement('div');
  box.id = 'newTabHint';
  box.className = 'newtab-hint';
  box.innerHTML = `<span>${t('toast.newtab')}</span>`;
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = t('menu.newtab');
  box.appendChild(link);
  document.getElementById('app').appendChild(box);
  const kill = setTimeout(() => box.remove(), 9000);
  link.addEventListener('click', () => {
    clearTimeout(kill);
    box.remove();
  });
  box.addEventListener('click', (e) => {
    if (e.target === box) {
      clearTimeout(kill);
      box.remove();
    }
  });
}

function isStandaloneRequest() {
  try {
    return new URL(window.location.href).searchParams.get('standalone') === '1';
  } catch (_) {
    return false;
  }
}

function bindStandaloneGate() {
  const gate = $('#standaloneGate');
  if (!gate) return;
  if (!isStandaloneRequest()) {
    gate.hidden = true;
    return;
  }
  // In a normal top-level tab we can take the whole screen; inside the preview
  // iframe we cannot, so offer the button anyway and simply start in-tab.
  gate.hidden = false;
  const enter = async () => {
    audio.unlock();
    gate.hidden = true;
    if (window.self === window.top) {
      try {
        const root = document.documentElement;
        const req = root.requestFullscreen || root.webkitRequestFullscreen;
        if (req && !document.fullscreenElement) await req.call(root, { navigationUI: 'hide' });
        const orient = window.screen && window.screen.orientation;
        if (orient && orient.lock) {
          try {
            await orient.lock('landscape');
          } catch (_) {}
        }
      } catch (_) {}
    }
    setTimeout(resize, 200);
    showScreen('menu');
    refreshMenu();
  };
  $('#standaloneGo').addEventListener('click', enter);
  $('#standaloneSkip').addEventListener('click', () => {
    gate.hidden = true;
    showScreen('menu');
    refreshMenu();
  });
}

function toggleFullscreen() {
  const doc = document;
  const root = doc.documentElement;
  const isFull = () => doc.fullscreenElement || doc.webkitFullscreenElement;
  audio.unlock();
  if (!isFull()) {
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (request) {
      try {
        const p = request.call(root, { navigationUI: 'hide' });
        if (p && p.catch) p.catch(() => {});
      } catch (_) {}
    }
    const orient = window.screen && window.screen.orientation;
    if (orient && orient.lock) {
      try {
        const p = orient.lock('landscape');
        if (p && p.catch) p.catch(() => {});
      } catch (_) {}
    }
    toast(t('toast.fullscreen.on'), 1500);
  } else {
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (exit) {
      try {
        const p = exit.call(doc);
        if (p && p.catch) p.catch(() => {});
      } catch (_) {}
    }
  }
  setTimeout(resize, 260);
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
        <span style="opacity:${reached ? 1 : 0.5}">${regionLabel(r, false)}</span>
        <b>${r.to === Infinity ? '∞' : r.to.toLocaleString('en-US') + ' m'}</b></div>`;
    }).join('')}
    <p class="modal-sub" style="margin-top:10px">${t('map.current')}: <b style="color:#ffe86b">${formatMeters(m)}</b> · ${regionLabel(game.region, false)}</p>
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
    if (e.code === 'KeyZ' && !uiState.screen) {
      const order = ['normal', 'wide', 'ultra', 'hyper'];
      const next = order[(order.indexOf(save.data.settings.view) + 1) % order.length];
      save.data.settings.view = next;
      game.setViewMode(next);
      save.save();
      toast(t('toast.view', { mode: t(`set.view.${next}`) }), 1000, '#7ee8ff');
      e.preventDefault();
    }
    if (e.code === 'KeyF') {
      toggleFullscreen();
      e.preventDefault();
    }
    if (e.code === 'KeyM' && !uiState.screen) {
      audio.setMuted(!audio.muted);
      toast(audio.muted ? t('toast.muted') : t('toast.soundOn'), 900);
    }
  });

  $('#pauseBtn').addEventListener('click', () => pauseGame());

  // ---- fullscreen: the same button works on desktop and on phones,
  // where it also tries to lock landscape (best effort, some browsers refuse).
  $('#fsBtn').addEventListener('click', () => toggleFullscreen());

  // Touch/click anywhere on the active game canvas: tap to boost, hold/release
  // during launch to charge. UI buttons stay independent, so two thumbs work.
  const canvasPointers = new Set();
  canvas.addEventListener('pointerdown', (e) => {
    if (uiState.screen !== null || (game.state !== 'fly' && game.state !== 'launch')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    audio.unlock();
    canvasPointers.add(e.pointerId);
    if (canvasPointers.size === 1) input.setVirtual('boost', true);
    try { canvas.setPointerCapture?.(e.pointerId); } catch (_) {}
  });
  const releaseCanvasPointer = (e) => {
    if (!canvasPointers.delete(e.pointerId)) return;
    e.preventDefault();
    if (canvasPointers.size === 0) {
      input.setVirtual('boost', false);
      // Very quick taps can complete between two physics ticks.
      if (game.state === 'launch' && !game.launchHeld) game.fireLaunch();
    }
  };
  canvas.addEventListener('pointerup', releaseCanvasPointer);
  canvas.addEventListener('pointercancel', releaseCanvasPointer);
  canvas.addEventListener('lostpointercapture', releaseCanvasPointer);
  window.addEventListener('blur', () => {
    canvasPointers.clear();
    input.setVirtual('boost', false);
  });

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
      case 'fullscreen':
        toggleFullscreen();
        break;
      case 'lang': {
        const order = ['vi', 'en'];
        const next = order[(order.indexOf(getLang()) + 1) % order.length];
        applyLanguage(next);
        break;
      }
      case 'newtab':
        openInNewTab();
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
  // Keep swept collisions accurate, but avoid 120 JS updates per second on
  // entry-level Android devices. Desktop retains the original 120 Hz step.
  step: mobileTouch ? 1 / 90 : 1 / 120,
  maxFrameTime: mobileTouch ? 0.12 : 0.25,
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
      if (uiState.screen === 'menu') drawLogoFrame(t);
      drawCharacterPortraits(t);
      drawUpgradePortrait(t);
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const touchMode = $('#touchControls').classList.contains('is-on');
      // the pause + fullscreen buttons live in that column: don't draw under them
      const hudInset = 62;
      renderScene(ctx, game, cssW, cssH, t, save.data.settings.quality, { touchMode, hudInset });
    }
    $('#fpsReadout').textContent = `${Math.round(loop.fps)} fps`;
  },
});
loop.onSecond = (fps) => {
  if (mobileTouch && fps < 42 && save.data.settings.quality !== 'low'
    || fps < 45 && save.data.settings.quality === 'high') {
    // Auto-degrade on slow phones (balanced → low as needed).
    save.data.settings.quality = mobileTouch ? 'low' : 'balanced';
    save.save();
    game.setQuality(save.data.settings.quality);
    resize();
    toast(t('toast.autoQuality'), 1800, '#ffd93b');
  }
};

// ---------------------------------------------------------------------- init
function init() {
  applyI18n(document);
  $('#menuLang').textContent = getLang() === 'vi' ? 'VI' : 'EN';
  resize();
  game.setQuality(save.data.settings.quality);
  game.setCharacter(save.data.selected, save.data.upgrades);
  game.state = 'idle';
  game.setViewMode(save.data.settings.view);
  bindInput();
  bindSettings();
  bindStandaloneGate();
  onLangChange(() => audio.sfx('click'));
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
