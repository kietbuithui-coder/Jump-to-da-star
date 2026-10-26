/**
 * The five creatures that should never have been issued a flight licence.
 * Each entry changes real physics numbers and a unique skill — never just a skin.
 */
export const CHARACTERS = {
  frog: {
    id: 'frog',
    name: 'PROFESSOR FROG',
    tagline: 'BIO SPRING · EASY',
    difficulty: 'EASY',
    difficultyStars: 1,
    blurb:
      'A fat frog in a lab coat who turned his own legs into a pair of industrial springs. High arcs, generous bounces, forgiving landings.',
    skill: {
      id: 'bioSpring',
      name: 'BIO SPRING',
      hold: false,
      cost: 24,
      cooldown: 0.45,
      desc: 'Legs become giant springs: a huge upward kick. Spring pads bounce you even higher.',
    },
    stats: {
      launch: 1.06,
      boost: 1.0,
      energyMax: 100,
      gravity: 1.0,
      drag: 1.0,
      steer: 1.06,
      bounce: 1.24,
      wind: 1.0,
      vxCap: 1.0,
    },
    colours: { main: '#6fcf3a', dark: '#3f8a1f', light: '#c6f24e', accent: '#ffd93b' },
    strengths: ['Easiest to fly', 'Best springs', 'Forgiving arcs'],
    weaknesses: ['Average speed', 'Poor brakes'],
    vi: {
      tagline: 'LÒ XO SINH HỌC · DỄ',
      blurb:
        'Một con ếch mập mặc áo blouse đã biến đôi chân mình thành hai cái lò xo công nghiệp. Bay cao, nảy êm, đáp rất dễ.',
      strengths: ['Dễ bay nhất', 'Nảy tốt nhất', 'Quỹ đạo dễ chịu'],
      weaknesses: ['Tốc độ trung bình', 'Phanh kém'],
      skill: { name: 'LÒ XO SINH HỌC', desc: 'Chân biến thành lò xo khổng lồ: cú đá cực mạnh lên trên. Pad lò xo còn nảy bạn cao hơn nữa.' },
    },
    sfx: 'sproing',
    unlockCost: 0,
  },
  chicken: {
    id: 'chicken',
    name: 'CHICKEN 9000',
    tagline: 'PANIC THRUST · MEDIUM',
    difficulty: 'MEDIUM',
    difficultyStars: 2,
    blurb:
      'Two mismatched jet engines bolted to a very confident chicken. Hold the skill to burn fuel and fly like you meant to do that.',
    skill: {
      id: 'panicThrust',
      name: 'PANIC THRUST',
      hold: true,
      cost: 17, // per second
      cooldown: 0,
      desc: 'HOLD for continuous thrust. Steer with the engines running. Watch the fuel — it is your wings.',
    },
    stats: {
      launch: 0.99,
      boost: 0.82,
      energyMax: 115,
      gravity: 1.03,
      drag: 0.9,
      steer: 1.12,
      bounce: 1.0,
      wind: 1.0,
      vxCap: 1.1,
    },
    colours: { main: '#fff7e8', dark: '#e2a25c', light: '#ffffff', accent: '#ff6b3d' },
    strengths: ['Sustained flight', 'Precise steering', 'Great top speed'],
    weaknesses: ['Weak instant boost', 'Thirsty engines'],
    vi: {
      tagline: 'PHẢN LỰC HOẢNG · TRUNG BÌNH',
      blurb:
        'Hai động cơ phản lực lệch nhau gắn vào một con gà rất tự tin. Giữ kỹ năng để đốt nhiên liệu và bay như thể bạn cố ý.',
      strengths: ['Bay lâu', 'Lái chính xác', 'Tốc độ cao'],
      weaknesses: ['Boost yếu', 'Ngốn nhiên liệu'],
      skill: { name: 'PHẢN LỰC HOẢNG', desc: 'GIỮ để bay liên tục. Vẫn lái được khi động cơ chạy. Coi chừng nhiên liệu — đó là đôi cánh của bạn.' },
    },
    sfx: 'fwooom',
    unlockCost: 900,
  },
  cheesus: {
    id: 'cheesus',
    name: 'CHEESUS',
    tagline: 'CHEESE MAGNETISM · MEDIUM',
    difficulty: 'MEDIUM',
    difficultyStars: 2,
    blurb:
      'A living cheese wedge with glowing eyes and a small gravitational problem. Light, floaty, and hopelessly attracted to snacks.',
    skill: {
      id: 'cheeseMagnet',
      name: 'CHEESE MAGNETISM',
      hold: true,
      cost: 9, // per second
      cooldown: 0,
      desc: 'HOLD to suck in nearby energy, coins and boosts — and to gently fall toward the tastiest cluster.',
    },
    stats: {
      launch: 1.0,
      boost: 0.94,
      energyMax: 130,
      gravity: 0.92,
      drag: 1.16,
      steer: 0.92,
      bounce: 1.02,
      wind: 1.5,
      vxCap: 0.98,
    },
    colours: { main: '#ffcf3d', dark: '#c98a12', light: '#fff1a8', accent: '#ff9f1c' },
    strengths: ['Resource magnet', 'Big energy tank', 'Floaty arcs'],
    weaknesses: ['Light in wind', 'Slow to accelerate'],
    vi: {
      tagline: 'TỪ TÍNH PHÔ MAI · TRUNG BÌNH',
      blurb:
        'Một miếng phô mai linh thiêng biết hút năng lượng về phía mình. Trọng lực nhẹ, quỹ đạo bay lơ lửng.',
      strengths: ['Hút tài nguyên', 'Bình năng lượng lớn', 'Bay lơ lửng'],
      weaknesses: ['Nhẹ, dễ bị gió', 'Tăng tốc chậm'],
      skill: { name: 'TỪ TÍNH PHÔ MAI', desc: 'GIỮ để hút năng lượng, coin và boost gần đó — và hơi trôi về cụm loot ngon nhất.' },
    },
    sfx: 'squelch',
    unlockCost: 1800,
  },
  pig: {
    id: 'pig',
    name: 'PIG METEOR',
    tagline: 'METEOR SLAM · HARD',
    difficulty: 'HARD',
    difficultyStars: 3,
    blurb:
      'A very round pig in a very small spacesuit. Dives like a meteor and converts that terror into a monstrous bounce — if you hit a pad.',
    skill: {
      id: 'meteorSlam',
      name: 'METEOR SLAM',
      hold: false,
      cost: 18,
      cooldown: 0.6,
      desc: 'Dive to build kinetic energy. Landing on a bounce pad converts it into a colossal launch. Miss, and it is a pig-shaped crater.',
    },
    stats: {
      launch: 1.02,
      boost: 1.08,
      energyMax: 90,
      gravity: 1.06,
      drag: 1.0,
      steer: 0.95,
      bounce: 1.08,
      wind: 0.8,
      vxCap: 1.02,
    },
    colours: { main: '#ffb4c4', dark: '#d96a86', light: '#ffe0e8', accent: '#8fd6ff' },
    strengths: ['Massive bounce payoff', 'Strong boosts', 'Heavy in wind'],
    weaknesses: ['Dive is lethal if missed', 'Small energy tank'],
    vi: {
      tagline: 'THIÊN THẠCH ĐẬP · KHÓ',
      blurb:
        'Một con heo tin rằng trọng lực chỉ là gợi ý. Bổ nhào để lấy động năng rồi biến nó thành cú phóng khổng lồ.',
      strengths: ['Cú nảy cực mạnh', 'Boost khoẻ', 'Nặng, ít bị gió'],
      weaknesses: ['Bổ nhào trượt là chết', 'Bình năng lượng nhỏ'],
      skill: { name: 'THIÊN THẠCH ĐẬP', desc: 'Bổ nhào để tích động năng. Đáp trúng pad sẽ biến nó thành cú phóng khổng lồ. Trượt thì thành cái hố hình con heo.' },
    },
    sfx: 'thoomp',
    unlockCost: 3000,
  },
  error404: {
    id: 'error404',
    name: 'ERROR-404',
    tagline: 'GLITCH BOOST · HARD',
    difficulty: 'HARD',
    difficultyStars: 3,
    blurb:
      'A toaster, some wires, and a dream. Cycles through three clearly-telegraphed thrust modes. Improvisation is mandatory.',
    skill: {
      id: 'glitchBoost',
      name: 'GLITCH BOOST',
      hold: false,
      cost: 19,
      cooldown: 0.35,
      desc: 'Fire the shown mode: POWER (huge kick), CONTROL (instant redirect), RECOVERY (stabilise). Next mode is always displayed.',
    },
    stats: {
      launch: 1.01,
      boost: 1.0,
      energyMax: 105,
      gravity: 1.0,
      drag: 1.02,
      steer: 1.08,
      bounce: 1.04,
      wind: 1.0,
      vxCap: 1.06,
    },
    colours: { main: '#c9d6e8', dark: '#5b6a86', light: '#ffffff', accent: '#c58bff' },
    strengths: ['Highest ceiling', 'Answer to every situation', 'Strong tech bonuses'],
    weaknesses: ['Punishing mode timing', 'No passive power'],
    vi: {
      tagline: 'GLITCH BOOST · KHÓ',
      blurb:
        'Một lỗi hệ thống được cấp phép bay. Xoay vòng ba chế độ, mỗi chế độ mạnh ở một thời điểm khác nhau.',
      strengths: ['Trần sức mạnh cao nhất', 'Xử lý mọi tình huống', 'Thưởng kỹ thuật cao'],
      weaknesses: ['Canh nhịp chế độ khó', 'Không có sức mạnh thụ động'],
      skill: { name: 'GLITCH BOOST', desc: 'Kích hoạt chế độ đang hiện: POWER (bật mạnh), CONTROL (đổi hướng tức thì), RECOVERY (ổn định). Chế độ tiếp theo luôn hiển thị.' },
    },
    sfx: 'glitch',
    unlockCost: 4200,
  },
};

export const GLITCH_MODES = ['POWER', 'CONTROL', 'RECOVERY'];
export const GLITCH_INFO = {
  POWER: { colour: '#ff7a3d', label: 'POWER' },
  CONTROL: { colour: '#7ee8ff', label: 'CONTROL' },
  RECOVERY: { colour: '#9ff7a0', label: 'RECOVERY' },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);

/** Upgrade effects applied to the raw character stats. */
export function resolveStats(char, upgrades = {}, meta = {}) {
  const u = upgrades || {};
  const lv = (k) => (Number.isFinite(u[k]) ? Math.max(0, Math.min(5, u[k])) : 0);
  const s = char.stats;
  const launchLv = lv('launch');
  const boostLv = lv('boost');
  const energyLv = lv('energy');
  const aeroLv = lv('aero');
  const steerLv = lv('steer');
  const effLv = lv('efficiency');
  const synLv = lv('synergy');
  const skillLv = lv('skill');

  return {
    launchMul: s.launch * (1 + 0.055 * launchLv),
    boostMul: s.boost * (1 + 0.075 * boostLv),
    boostCount: 3 + (meta.bonusBoost || 0),
    energyMax: Math.round(s.energyMax * (1 + 0.085 * energyLv)),
    gravityMul: s.gravity * (1 - 0.022 * aeroLv),
    dragMul: s.drag * (1 - 0.05 * aeroLv),
    steerMul: s.steer * (1 + 0.07 * steerLv),
    skillCostMul: 1 - 0.07 * effLv,
    itemMul: 1 + 0.06 * synLv,
    skillPower: 1 + 0.09 * skillLv,
    bounceMul: s.bounce,
    windMul: s.wind,
    vxCapMul: s.vxCap,
  };
}
