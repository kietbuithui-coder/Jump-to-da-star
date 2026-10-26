/**
 * Save system — resilient localStorage schema with per-field sanitisation.
 * If one field is corrupt, only that field resets. Player progress is never
 * wiped because of a single bad number.
 */
import { SAVE_KEY, SAVE_VERSION, QUALITY } from '../config/config.js';

export const CHARACTER_IDS = ['frog', 'chicken', 'cheesus', 'pig', 'error404'];

export const UPGRADE_CATS = [
  'launch',
  'boost',
  'energy',
  'aero',
  'steer',
  'efficiency',
  'synergy',
  'skill',
];

export const UNLOCK_COST = {
  frog: 0,
  chicken: 900,
  cheesus: 1800,
  pig: 3000,
  error404: 4200,
};

const DEFAULT_ACHIEVEMENTS = {
  first_flight: false,
  five_hundred: false,
  two_thousand: false,
  five_thousand: false,
  fifteen_thousand: false,
  combo_insane: false,
  all_characters: false,
  boost_master: false,
  spring_chain: false,
  scientist: false,
};

function emptyUpgrades() {
  const out = {};
  for (const id of CHARACTER_IDS) {
    out[id] = {};
    for (const cat of UPGRADE_CATS) out[id][cat] = 0;
  }
  return out;
}

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    coins: 0,
    totalRuns: 0,
    selected: 'frog',
    unlocked: { frog: true, chicken: false, cheesus: false, pig: false, error404: false },
    upgrades: emptyUpgrades(),
    records: {
      distance: 0,
      score: 0,
      combo: 0,
      coinsEarned: 0,
      best: {}, // per character: { distance, score, runs }
      history: [], // last 8 runs
    },
    achievements: { ...DEFAULT_ACHIEVEMENTS },
    settings: {
      master: 0.8,
      music: 0.55,
      sfx: 0.85,
      quality: 'balanced',
      view: 'wide',
      lang: 'vi',
      touch: 'auto',
      touchScale: 0.5,
      showFps: false,
      reduceShake: false,
    },
    stats: {
      orbs: 0,
      boosts: 0,
      springs: 0,
      skills: 0,
      playtime: 0,
    },
  };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v, fb, lo = -Infinity, hi = Infinity) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
const str = (v, fb) => (typeof v === 'string' ? v : fb);
const bool = (v, fb) => (typeof v === 'boolean' ? v : fb);

/** Deep-merge a raw parsed object onto defaults, sanitising every leaf. */
export function sanitizeSave(raw) {
  const def = defaultSave();
  if (!isObj(raw)) return def;
  const s = def;

  s.coins = Math.floor(finite(raw.coins, 0, 0, 1e12));
  s.totalRuns = Math.floor(finite(raw.totalRuns, 0, 0, 1e9));

  if (isObj(raw.unlocked)) {
    s.unlocked.frog = true;
    for (const id of CHARACTER_IDS) {
      if (id === 'frog') continue;
      s.unlocked[id] = bool(raw.unlocked[id], false);
    }
  }
  s.selected = CHARACTER_IDS.includes(raw.selected) ? raw.selected : 'frog';
  if (!s.unlocked[s.selected]) s.selected = 'frog';

  if (isObj(raw.upgrades)) {
    for (const id of CHARACTER_IDS) {
      const src = raw.upgrades[id];
      if (!isObj(src)) continue;
      for (const cat of UPGRADE_CATS) {
        s.upgrades[id][cat] = Math.floor(finite(src[cat], 0, 0, 5));
      }
    }
  }

  if (isObj(raw.records)) {
    const r = raw.records;
    s.records.distance = finite(r.distance, 0, 0, 1e9);
    s.records.score = Math.floor(finite(r.score, 0, 0, 1e12));
    s.records.combo = Math.floor(finite(r.combo, 0, 0, 999));
    s.records.coinsEarned = Math.floor(finite(r.coinsEarned, 0, 0, 1e12));
    if (isObj(r.best)) {
      for (const id of CHARACTER_IDS) {
        const b = r.best[id];
        if (!isObj(b)) continue;
        s.records.best[id] = {
          distance: finite(b.distance, 0, 0, 1e9),
          score: Math.floor(finite(b.score, 0, 0, 1e12)),
          runs: Math.floor(finite(b.runs, 0, 0, 1e6)),
        };
      }
    }
    if (Array.isArray(r.history)) {
      s.records.history = r.history
        .filter(isObj)
        .slice(0, 8)
        .map((h) => ({
          character: CHARACTER_IDS.includes(h.character) ? h.character : 'frog',
          distance: finite(h.distance, 0, 0, 1e9),
          score: Math.floor(finite(h.score, 0, 0, 1e12)),
          combo: Math.floor(finite(h.combo, 0, 0, 999)),
          coins: Math.floor(finite(h.coins, 0, 0, 1e9)),
          date: Math.floor(finite(h.date, 0, 0, 4e12)),
        }));
    }
  }

  if (isObj(raw.achievements)) {
    for (const k of Object.keys(s.achievements)) {
      s.achievements[k] = bool(raw.achievements[k], false);
    }
  }

  if (isObj(raw.settings)) {
    const st = raw.settings;
    s.settings.master = finite(st.master, 0.8, 0, 1);
    s.settings.music = finite(st.music, 0.55, 0, 1);
    s.settings.sfx = finite(st.sfx, 0.85, 0, 1);
    s.settings.quality = Object.prototype.hasOwnProperty.call(QUALITY, st.quality)
      ? st.quality
      : 'balanced';
    s.settings.view = ['normal', 'wide', 'ultra'].includes(st.view) ? st.view : 'wide';
    s.settings.lang = ['vi', 'en'].includes(st.lang) ? st.lang : 'vi';
    s.settings.touch = ['auto', 'on', 'off'].includes(st.touch) ? st.touch : 'auto';
    s.settings.touchScale = finite(st.touchScale, 0.5, 0.5, 1.5);
    s.settings.showFps = bool(st.showFps, false);
    s.settings.reduceShake = bool(st.reduceShake, false);
  }

  if (isObj(raw.stats)) {
    for (const k of Object.keys(s.stats)) {
      s.stats[k] = Math.floor(finite(raw.stats[k], 0, 0, 1e12));
    }
    s.stats.playtime = finite(raw.stats.playtime, 0, 0, 1e9);
  }

  s.version = SAVE_VERSION;
  return s;
}

export class SaveStore {
  constructor(storage) {
    this.storage = storage || null;
    this.data = this.load();
  }

  load() {
    try {
      if (!this.storage) return defaultSave();
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) {
        // Migrate from v1 if present (kept intentionally: never drop progress).
        const legacy = this.storage.getItem('jtts.save.v1');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          return sanitizeSave(parsed);
        }
        return defaultSave();
      }
      return sanitizeSave(JSON.parse(raw));
    } catch (err) {
      // Corrupt JSON: never lose everything silently — reset schema but keep a backup.
      try {
        if (this.storage) {
          const raw = this.storage.getItem(SAVE_KEY);
          if (raw) this.storage.setItem(`${SAVE_KEY}.corrupt`, raw.slice(0, 20000));
        }
      } catch (_) {
        /* ignore */
      }
      return defaultSave();
    }
  }

  save() {
    if (!this.storage) return false;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch (_) {
      return false;
    }
  }

  reset() {
    this.data = defaultSave();
    this.save();
  }
}
