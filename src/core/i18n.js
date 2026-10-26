/**
 * i18n — English + Vietnamese.
 *
 * Everything the player reads goes through `t(key)`. Static markup uses
 * `data-i18n="key"` / `data-i18n-title="key"`; dynamically built UI calls `t()`.
 * Data-driven content (pilots, items, upgrades) carries a `vi` block that
 * `pick()` selects from, falling back to English when a translation is missing.
 *
 * Language is stored in the save file, so it survives reloads.
 */

const DICT = {
  /* ------------------------------------------------------------- language */
  'lang.name': { en: 'ENGLISH', vi: 'TIẾNG VIỆT' },
  'lang.label': { en: 'LANGUAGE', vi: 'NGÔN NGỮ' },

  /* ----------------------------------------------------------------- menu */
  'menu.play': { en: 'PLAY', vi: 'CHƠI' },
  'menu.play.sub': { en: 'LAUNCH THE EXPERIMENT', vi: 'PHÓNG THÍ NGHIỆM #001' },
  'menu.characters': { en: 'CHARACTERS', vi: 'NHÂN VẬT' },
  'menu.characters.sub': { en: '5 questionable pilots', vi: '5 phi công rất đáng ngờ' },
  'menu.upgrades': { en: 'UPGRADES', vi: 'NÂNG CẤP' },
  'menu.upgrades.sub': { en: 'spend Star Coins', vi: 'dùng Sao Coin' },
  'menu.records': { en: 'RECORDS', vi: 'THÀNH TÍCH' },
  'menu.records.sub': { en: 'failed experiments', vi: 'các thí nghiệm thất bại' },
  'menu.settings': { en: 'SETTINGS', vi: 'CÀI ĐẶT' },
  'menu.settings.sub': { en: 'audio · graphics', vi: 'âm thanh · đồ hoạ' },
  'menu.fullscreen': { en: '⛶ FULLSCREEN', vi: '⛶ TOÀN MÀN HÌNH' },
  'menu.newtab': { en: '▶ NEW TAB · FULLSCREEN', vi: '▶ TAB MỚI · TOÀN MÀN HÌNH' },
  'menu.newtab.sub': { en: 'play outside the preview frame', vi: 'chơi ngoài khung preview' },
  'menu.coins': { en: 'STAR COINS', vi: 'SAO COIN' },
  'menu.best': { en: 'BEST', vi: 'KỶ LỤC' },
  'menu.tagline': { en: "EXPERIMENT #001 · PROF. SHAPI'S LAUNCH LAB", vi: 'THÍ NGHIỆM #001 · PHÒNG THÍ NGHIỆM SHAPI' },
  'menu.tagline2': { en: 'An endless flight experiment about very unqualified animals.', vi: 'Thí nghiệm bay vô tận của những sinh vật hoàn toàn không đủ tiêu chuẩn.' },
  'menu.credits': { en: 'Procedural art · procedural audio · zero downloads', vi: 'Đồ hoạ tự sinh · âm thanh tự sinh · không tải gì thêm' },

  /* ----------------------------------------------------------- characters */
  'char.title': { en: 'CHOOSE YOUR PILOT', vi: 'CHỌN PHI CÔNG' },
  'char.sub': {
    en: 'Five creatures. Five flight models. Professor Shapi accepts no responsibility.',
    vi: 'Năm sinh vật. Năm kiểu bay. Giáo sư Shapi không chịu trách nhiệm gì cả.',
  },
  'char.skill': { en: 'SKILL', vi: 'KỸ NĂNG' },
  'char.hold': { en: '(HOLD)', vi: '(GIỮ)' },
  'char.unlockFree': { en: 'available from the start', vi: 'có sẵn từ đầu' },
  'char.unlockCost': { en: '{n} ★ Star Coins', vi: '{n} ★ Sao Coin' },
  'char.playAs': { en: 'PLAY AS', vi: 'CHƠI VỚI' },
  'char.upgrades': { en: 'UPGRADES', vi: 'NÂNG CẤP' },
  'char.stat.launch': { en: 'LAUNCH', vi: 'LỰC PHÓNG' },
  'char.stat.bounce': { en: 'BOUNCE', vi: 'ĐỘ NẢY' },
  'char.stat.energy': { en: 'ENERGY', vi: 'NĂNG LƯỢNG' },
  'char.stat.steer': { en: 'STEER', vi: 'LÁI' },
  'char.stat.speed': { en: 'SPEED', vi: 'TỐC ĐỘ' },
  'char.stat.agility': { en: 'AGILITY', vi: 'LANH LẸ' },
  'diff.easy': { en: 'EASY', vi: 'DỄ' },
  'diff.medium': { en: 'MEDIUM', vi: 'TRUNG BÌNH' },
  'diff.hard': { en: 'HARD', vi: 'KHÓ' },

  /* -------------------------------------------------------------- upgrades */
  'up.title': { en: 'THE UPGRADE ROOM', vi: 'PHÒNG NÂNG CẤP' },
  'up.sub': {
    en: 'Bolting better science onto your creature. Every part has a limit — Shapi checked.',
    vi: 'Gắn thêm khoa học xịn hơn vào sinh vật. Mọi bộ phận đều có giới hạn — Shapi đã kiểm tra.',
  },
  'up.stat.launch': { en: 'Launch', vi: 'Lực phóng' },
  'up.stat.boost': { en: 'Boost', vi: 'Tăng tốc' },
  'up.stat.energy': { en: 'Energy', vi: 'Năng lượng' },
  'up.stat.gravity': { en: 'Gravity', vi: 'Trọng lực' },
  'up.stat.skillCost': { en: 'Skill cost', vi: 'Chi phí kỹ năng' },
  'up.stat.skillPower': { en: 'Skill power', vi: 'Sức kỹ năng' },
  'up.stat.item': { en: 'Item bonus', vi: 'Thưởng vật phẩm' },
  'up.none': { en: 'no modification yet', vi: 'chưa nâng cấp gì' },
  'up.buy': { en: 'UPGRADE', vi: 'NÂNG CẤP' },
  'up.maxed': { en: 'MAXED', vi: 'TỐI ĐA' },

  /* --------------------------------------------------------------- records */
  'rec.title': { en: 'RECORDS & FAILED EXPERIMENTS', vi: 'THÀNH TÍCH & THÍ NGHIỆM THẤT BẠI' },
  'rec.sub': { en: 'A tidy archive of every time physics won.', vi: 'Hồ sơ gọn gàng mỗi lần vật lý thắng.' },
  'rec.distance': { en: 'FARTHEST FLIGHT', vi: 'BAY XA NHẤT' },
  'rec.score': { en: 'HIGHEST SCORE', vi: 'ĐIỂM CAO NHẤT' },
  'rec.combo': { en: 'BEST COMBO', vi: 'CHUỖI TỐT NHẤT' },
  'rec.coins': { en: 'COINS EARNED', vi: 'SAO COIN KIẾM ĐƯỢC' },
  'rec.runs': { en: 'TOTAL RUNS', vi: 'TỔNG SỐ LƯỢT' },
  'rec.unlocked': { en: 'CHARACTERS UNLOCKED', vi: 'NHÂN VẬT ĐÃ MỞ' },
  'rec.logbook': { en: 'PILOT LOGBOOK', vi: 'SỔ NHẬT KÝ PHI CÔNG' },
  'rec.recent': { en: 'RECENT LAUNCHES', vi: 'CÁC LẦN PHÓNG GẦN ĐÂY' },
  'rec.achievements': { en: 'ACHIEVEMENTS', vi: 'THÀNH TỰU' },
  'rec.none': { en: 'No flights logged yet.', vi: 'Chưa có lượt bay nào.' },

  /* -------------------------------------------------------------- settings */
  'set.title': { en: 'LAB SETTINGS', vi: 'CÀI ĐẶT PHÒNG LAB' },
  'set.sub': { en: 'Calibrate the noise and the pixels.', vi: 'Chỉnh âm thanh và hình ảnh.' },
  'set.master': { en: 'MASTER', vi: 'ÂM LƯỢNG CHUNG' },
  'set.music': { en: 'MUSIC', vi: 'NHẠC' },
  'set.sfx': { en: 'SFX', vi: 'HIỆU ỨNG' },
  'set.view': { en: 'VIEW', vi: 'TẦM NHÌN' },
  'set.view.normal': { en: 'NORMAL', vi: 'THƯỜNG' },
  'set.view.wide': { en: 'WIDE', vi: 'RỘNG' },
  'set.view.ultra': { en: 'ULTRA 0.5×', vi: 'SIÊU RỘNG 0.5×' },
  'set.graphics': { en: 'GRAPHICS', vi: 'ĐỒ HOẠ' },
  'set.q.low': { en: 'LOW', vi: 'THẤP' },
  'set.q.balanced': { en: 'BALANCED', vi: 'CÂN BẰNG' },
  'set.q.high': { en: 'HIGH', vi: 'CAO' },
  'set.touch': { en: 'TOUCH CONTROLS', vi: 'NÚT CẢM ỨNG' },
  'set.touch.auto': { en: 'AUTO', vi: 'TỰ ĐỘNG' },
  'set.touch.on': { en: 'ON', vi: 'BẬT' },
  'set.touch.off': { en: 'OFF', vi: 'TẮT' },
  'set.touchScale': { en: 'TOUCH BUTTON SIZE', vi: 'CỠ NÚT CẢM ỨNG' },
  'set.shake': { en: 'REDUCE CAMERA SHAKE', vi: 'GIẢM RUNG MÀN HÌNH' },
  'set.fps': { en: 'SHOW FPS', vi: 'HIỆN FPS' },
  'set.reset': { en: 'RESET ALL PROGRESS', vi: 'XOÁ TOÀN BỘ TIẾN TRÌNH' },
  'set.note': {
    en: 'Progress saves automatically to this browser (localStorage). Corrupt fields are repaired individually — one bad number never wipes a save.',
    vi: 'Tiến trình tự lưu trong trình duyệt này (localStorage). Dữ liệu hỏng được sửa từng trường — một con số lỗi không bao giờ xoá sạch save.',
  },

  /* ----------------------------------------------------------------- pause */
  'pause.title': { en: 'PAUSED', vi: 'TẠM DỪNG' },
  'pause.sub': { en: 'The experiment is on hold.', vi: 'Thí nghiệm đang tạm hoãn.' },
  'pause.resume': { en: 'RESUME', vi: 'TIẾP TỤC' },
  'pause.restart': { en: 'RESTART', vi: 'CHƠI LẠI' },
  'pause.map': { en: 'JOURNEY MAP', vi: 'BẢN ĐỒ HÀNH TRÌNH' },
  'map.current': { en: 'Current flight', vi: 'Đang bay' },
  'pause.settings': { en: 'SETTINGS', vi: 'CÀI ĐẶT' },
  'pause.menu': { en: 'MAIN MENU', vi: 'MENU CHÍNH' },

  /* ------------------------------------------------------------- game over */
  'go.ribbon': { en: 'EXPERIMENT FAILED', vi: 'THÍ NGHIỆM THẤT BẠI' },
  'go.title': { en: 'SPLAT.', vi: 'BỊCH.' },
  'go.sub': { en: 'The lawn got another pilot.', vi: 'Bãi cỏ lại có thêm một phi công.' },
  'go.score': { en: 'SCORE', vi: 'ĐIỂM' },
  'go.combo': { en: 'BEST COMBO', vi: 'CHUỖI TỐT NHẤT' },
  'go.coins': { en: 'COINS EARNED', vi: 'SAO COIN' },
  'go.boosts': { en: 'BOOSTS USED', vi: 'BOOST ĐÃ DÙNG' },
  'go.skills': { en: 'SKILLS FIRED', vi: 'KỸ NĂNG ĐÃ DÙNG' },
  'go.springs': { en: 'SPRINGS HIT', vi: 'LẦN NẢY' },
  'go.retry': { en: 'RETRY', vi: 'THỬ LẠI' },
  'go.upgrades': { en: 'UPGRADES', vi: 'NÂNG CẤP' },
  'go.pilots': { en: 'PILOTS', vi: 'PHI CÔNG' },
  'go.menu': { en: 'MENU', vi: 'MENU' },
  'go.newBest': { en: 'NEW RECORD!', vi: 'KỶ LỤC MỚI!' },

  /* ------------------------------------------------------------------- hud */
  'hud.score': { en: 'SCORE {n}', vi: 'ĐIỂM {n}' },
  'hud.energy': { en: 'ENERGY', vi: 'NĂNG LƯỢNG' },
  'hud.skill': { en: 'SKILL', vi: 'KỸ NĂNG' },
  'hud.next': { en: 'NEXT', vi: 'TIẾP' },
  'hud.combo': { en: '{n}× COMBO', vi: 'CHUỖI {n}×' },
  'hud.hint': {
    en: 'SPACE = BOOST   ·   SHIFT = SKILL   ·   A / D = STEER   ·   ESC = PAUSE',
    vi: 'SPACE = BOOST   ·   SHIFT = KỸ NĂNG   ·   A / D = LÁI   ·   ESC = TẠM DỪNG',
  },
  'hud.launch': {
    en: 'HOLD TO CHARGE — RELEASE IN THE GOLD ZONE',
    vi: 'GIỮ ĐỂ TÍCH LỰC — THẢ KHI KIM VÀO VÙNG VÀNG',
  },
  'hud.power': { en: 'POWER {n}%', vi: 'LỰC {n}%' },
  'hud.touch.boost': { en: 'BOOST', vi: 'BAY LÊN' },
  'hud.touch.skill': { en: 'SKILL', vi: 'KỸ NĂNG' },

  /* --------------------------------------------------------------- toasts */
  'toast.recruited': { en: '{name} RECRUITED!', vi: 'ĐÃ CHIÊU MỘ {name}!' },
  'toast.needCoins': { en: 'NEED {n} MORE STAR COINS', vi: 'CẦN THÊM {n} SAO COIN' },
  'toast.notEnough': { en: 'NOT ENOUGH STAR COINS', vi: 'KHÔNG ĐỦ SAO COIN' },
  'toast.level': { en: '{label} → LEVEL {lv}', vi: '{label} → CẤP {lv}' },
  'toast.reset': { en: 'SAVE RESET. SCIENCE STARTS OVER.', vi: 'ĐÃ XOÁ SAVE. KHOA HỌC LÀM LẠI TỪ ĐẦU.' },
  'toast.fullscreen.on': { en: 'FULLSCREEN — press F or ⛶ to exit', vi: 'TOÀN MÀN HÌNH — bấm F hoặc ⛶ để thoát' },
  'toast.fullscreen.off': { en: 'FULLSCREEN OFF', vi: 'ĐÃ THOÁT TOÀN MÀN HÌNH' },
  'toast.view': { en: 'VIEW: {mode}', vi: 'TẦM NHÌN: {mode}' },
  'toast.muted': { en: 'SOUND MUTED', vi: 'ĐÃ TẮT TIẾNG' },
  'toast.soundOn': { en: 'SOUND ON', vi: 'ĐÃ BẬT TIẾNG' },
  'toast.autoQuality': { en: 'AUTO-QUALITY: BALANCED (slow device detected)', vi: 'TỰ GIẢM ĐỒ HOẠ: CÂN BẰNG (máy yếu)' },
  'toast.newtab': { en: 'Opening a new tab… if nothing happens, allow pop-ups.', vi: 'Đang mở tab mới… nếu không thấy gì, hãy cho phép pop-up.' },
  'toast.lang': { en: 'LANGUAGE: {lang}', vi: 'NGÔN NGỮ: {lang}' },

  /* -------------------------------------------------- in-game tutorial tips */
  'hint.boost': { en: 'TAP SCREEN / SPACE — boost, use charges wisely', vi: 'CHẠM MÀN HÌNH / SPACE — bay lên, dùng lượt cho khéo' },
  'hint.skill': { en: 'SKILL BUTTON / SHIFT — {skill}', vi: 'NÚT KỸ NĂNG / SHIFT — {skill}' },
  'hint.energy': { en: 'ENERGY = SKILL FUEL. Grab the orbs.', vi: 'NĂNG LƯỢNG = NHIÊN LIỆU KỸ NĂNG. Nhặt orb đi.' },
  'hint.spring': { en: 'PADS BOUNCE ALONG THEIR NORMAL — aim your landing!', vi: 'PAD NẢY THEO HƯỚNG MẶT PAD — nhắm chỗ đáp!' },
  'hint.sky': { en: 'LOOK UP: thermals lift you to premium loot', vi: 'NHÌN LÊN: cột khí nóng đưa bạn tới loot xịn' },
  'hint.boostHint': { en: 'BOOST!', vi: 'BAY LÊN!' },

  /* ------------------------------------------------------- combo tier names */
  'combo.1': { en: 'NICE!', vi: 'ĐƯỢC ĐÓ!' },
  'combo.2': { en: 'GREAT!', vi: 'HAY ĐẤY!' },
  'combo.3': { en: 'AMAZING!', vi: 'QUÁ ĐỈNH!' },
  'combo.4': { en: 'INSANE!', vi: 'ĐIÊN RỒI!' },
  'combo.5': { en: 'PHYSICS IS CRYING!', vi: 'VẬT LÝ ĐANG KHÓC!' },
  'combo.6': { en: 'SCIENCE HAS LEFT THE CHAT!', vi: 'KHOA HỌC BỎ NHÓM RỒI!' },
  'combo.7': { en: 'SHAPI APPROVES!', vi: 'SHAPI DUYỆT!' },

  /* ------------------------------------------------------------- regions */
  'region.lab': { en: "SHAPI'S LAUNCH LAB", vi: 'PHÒNG PHÓNG SHAPI' },
  'region.lab.short': { en: 'LAUNCH LAB', vi: 'PHÒNG PHÓNG' },
  'region.wilds': { en: 'THE BOUNCY WILDS', vi: 'ĐỒNG NẢY' },
  'region.wilds.short': { en: 'BOUNCY WILDS', vi: 'ĐỒNG NẢY' },
  'region.clouds': { en: 'CLOUD CHAOS', vi: 'MÂY HỖN LOẠN' },
  'region.clouds.short': { en: 'CLOUD CHAOS', vi: 'MÂY HỖN LOẠN' },
  'region.illegal': { en: 'ILLEGAL SCIENCE ZONE', vi: 'VÙNG KHOA HỌC PHI PHÁP' },
  'region.illegal.short': { en: 'ILLEGAL SCIENCE', vi: 'KHOA HỌC PHI PHÁP' },
  'region.star': { en: 'THE STAR FRONTIER', vi: 'BIÊN GIỚI VÌ SAO' },
  'region.star.short': { en: 'STAR FRONTIER', vi: 'BIÊN GIỚI SAO' },

  /* --------------------------------------------------------- gameover quotes */
  'quote.1': { en: '"Science is mostly falling over. Repeatedly."', vi: '"Khoa học chủ yếu là ngã. Nhiều lần."' },
  'quote.2': { en: '"That was not flying. That was a very long mistake."', vi: '"Đó không phải bay. Đó là một sai lầm rất dài."' },
  'quote.3': { en: '"Note to self: the ground is still there."', vi: '"Ghi chú: mặt đất vẫn ở đó."' },
  'quote.4': { en: '"We shall call this result: data."', vi: '"Ta gọi kết quả này là: dữ liệu."' },
  'quote.5': { en: '"The chicken would have made it. Probably."', vi: '"Con gà chắc sẽ qua được. Chắc thế."' },
  'quote.6': { en: '"I have 47 years of experience and still no idea."', vi: '"Ta có 47 năm kinh nghiệm và vẫn không hiểu gì."' },

  /* ------------------------------------------------------------- loading / misc */
  'loading': { en: 'CALIBRATING LAUNCH MACHINE…', vi: 'ĐANG HIỆU CHUẨN MÁY PHÓNG…' },
  'standalone.title': { en: 'JUMP TO THE STAR', vi: 'NHẢY TỚI VÌ SAO' },
  'standalone.body': {
    en: 'Tap once to enter fullscreen and start.',
    vi: 'Chạm một lần để vào toàn màn hình và bắt đầu.',
  },
  'standalone.go': { en: '▶ START FULLSCREEN', vi: '▶ BẮT ĐẦU TOÀN MÀN HÌNH' },
  'standalone.skip': { en: 'or continue in this tab', vi: 'hoặc chơi tiếp trong tab này' },
};

export const LANGS = ['vi', 'en'];
let lang = 'vi';
const listeners = [];

/**
 * Reading `localStorage` itself throws a SecurityError on an opaque origin
 * (`file://` in some browsers, private mode, a sandboxed iframe). Touching the
 * global at all can throw, so even the feature test has to live inside try/catch.
 */
function readStoredLang() {
  try {
    const store = typeof localStorage !== 'undefined' ? localStorage : null;
    if (!store) return null;
    const stored = store.getItem('jtts.lang');
    return LANGS.includes(stored) ? stored : null;
  } catch (_) {
    return null;
  }
}

function writeStoredLang(value) {
  try {
    const store = typeof localStorage !== 'undefined' ? localStorage : null;
    if (store) store.setItem('jtts.lang', value);
    return true;
  } catch (_) {
    return false; // storage blocked: the choice still applies for this session
  }
}

export function detectLang() {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
    const stored = readStoredLang();
    if (stored) return stored;
    if (nav.toLowerCase().startsWith('vi')) return 'vi';
  } catch (_) {}
  return 'vi'; // the lab is in Ho Chi Minh City
}

export function getLang() {
  return lang;
}

export function setLang(next, { persist = true } = {}) {
  const value = LANGS.includes(next) ? next : 'vi';
  lang = value;
  // Never let a blocked storage write stop the UI from re-rendering: the
  // language must change even when saving it is impossible.
  if (persist) writeStoredLang(value);
  if (typeof document !== 'undefined') {
    try {
      document.documentElement.lang = value;
    } catch (_) {}
    applyI18n(document);
  }
  for (const fn of listeners) {
    try {
      fn(value);
    } catch (_) {}
  }
  return value;
}

export function onLangChange(fn) {
  listeners.push(fn);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, key) => (vars[key] != null ? String(vars[key]) : m));
}

/** Translate a key. Unknown keys fall back to the key itself (visible, not silent). */
export function t(key, vars) {
  const entry = DICT[key];
  if (!entry) return interpolate(key, vars);
  const str = entry[lang] ?? entry.en ?? key;
  return interpolate(str, vars);
}

/** Pick a translated field from a data object: `vi` block first, then the plain field. */
export function pick(obj, field) {
  if (!obj) return '';
  if (lang !== 'en' && obj.vi && obj.vi[field] != null) return obj.vi[field];
  return obj[field] != null ? obj[field] : '';
}

/**
 * Pick a localised field from a character's skill.
 * The Vietnamese block lives on the character (`char.vi.skill`), not on the
 * skill object, so it needs its own accessor.
 */
export function pickSkill(character, field) {
  if (!character) return '';
  const skill = character.skill || {};
  if (lang !== 'en' && character.vi && character.vi.skill && character.vi.skill[field] != null) {
    return character.vi.skill[field];
  }
  return skill[field] != null ? skill[field] : '';
}

/** Region name/short for the current language. */
export function regionLabel(region, short = false) {
  if (!region) return '';
  const key = short ? `region.${region.id}.short` : `region.${region.id}`;
  const translated = DICT[key];
  if (translated) return translated[lang] ?? translated.en;
  return short ? region.short : region.name;
}

/** Replace every `data-i18n` / `data-i18n-title` node inside `root`. */
export function applyI18n(root = document) {
  if (!root || !root.querySelectorAll) return;
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
    if (el.getAttribute('aria-label')) el.setAttribute('aria-label', t(el.dataset.i18nTitle));
  }
  if (root.documentElement) root.documentElement.lang = lang;
}
