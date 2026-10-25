/** Upgrade catalogue: bounded levels, readable effects, sane price curve. */
export const MAX_LEVEL = 5;

export const UPGRADE_INFO = [
  {
    id: 'launch',
    label: 'LAUNCH POWER',
    desc: 'The catapult argument gets 5.5% more convincing per level.',
    effect: (lv) => `+${(lv * 5.5).toFixed(1)}% launch velocity`,
    colour: '#7fe33f',
  },
  {
    id: 'boost',
    label: 'BOOST ENGINE',
    desc: 'Bigger boost impulses. Still only three of them, hero.',
    effect: (lv) => `+${(lv * 7.5).toFixed(1)}% boost power`,
    colour: '#ffd93b',
  },
  {
    id: 'energy',
    label: 'ENERGY CAPACITY',
    desc: 'A bigger tank means more skills before you are running on fumes.',
    effect: (lv) => `+${(lv * 8.5).toFixed(0)}% max energy`,
    colour: '#7ee8ff',
  },
  {
    id: 'aero',
    label: 'AERODYNAMICS',
    desc: 'Duct tape, wax and one very questionable fin. Gravity minds less.',
    effect: (lv) => `-${(lv * 2.2).toFixed(1)}% gravity · -${(lv * 5).toFixed(0)}% drag`,
    colour: '#c58bff',
  },
  {
    id: 'steer',
    label: 'STEERING',
    desc: 'Stronger air control to line up the next pad at speed.',
    effect: (lv) => `+${(lv * 7).toFixed(0)}% steering authority`,
    colour: '#ff5ea8',
  },
  {
    id: 'efficiency',
    label: 'ENERGY EFFICIENCY',
    desc: 'Skills cost less energy per level.',
    effect: (lv) => `-${(lv * 7).toFixed(0)}% skill energy cost`,
    colour: '#9ff7a0',
  },
  {
    id: 'synergy',
    label: 'ITEM SYNERGY',
    desc: 'Pads kick harder and buffs land sweeter.',
    effect: (lv) => `+${(lv * 6).toFixed(0)}% item effect`,
    colour: '#ffb020',
  },
  {
    id: 'skill',
    label: 'SPECIAL SKILL',
    desc: 'The signature move gets more absurd.',
    effect: (lv) => `+${(lv * 9).toFixed(0)}% skill power`,
    colour: '#ff8a3d',
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADE_INFO.map((u) => [u.id, u]));

/** 120 / 240 / 460 / 800 / 1400 — cheap first, meaningful later. */
export const UPGRADE_COSTS = [120, 240, 460, 800, 1400];

export function costForLevel(level) {
  if (level >= MAX_LEVEL) return null;
  return UPGRADE_COSTS[level];
}

export function totalInvested(upgrades) {
  let total = 0;
  for (const cat of Object.keys(upgrades || {})) {
    const lv = upgrades[cat] || 0;
    for (let i = 0; i < lv; i++) total += UPGRADE_COSTS[i] || 0;
  }
  return total;
}

export const ACHIEVEMENTS = [
  { id: 'first_flight', label: 'First flight (survive the launch)', hint: 'Play one run' },
  { id: 'five_hundred', label: '500 m — officially airborne', hint: 'Reach 500 m' },
  { id: 'two_thousand', label: '2,000 m — out of the tutorial', hint: 'Reach 2,000 m' },
  { id: 'five_thousand', label: '5,000 m — illegal science territory', hint: 'Reach 5,000 m' },
  { id: 'fifteen_thousand', label: '15,000 m — Star Frontier', hint: 'Reach 15,000 m' },
  { id: 'combo_insane', label: 'INSANE combo (15+)', hint: 'Chain 15 actions' },
  { id: 'all_characters', label: 'All five pilots recruited', hint: 'Unlock everyone' },
  { id: 'boost_master', label: 'Boost master (10 boosts in one run)', hint: 'Use 10 boosts' },
  { id: 'spring_chain', label: 'Spring enthusiast (12 pad hits)', hint: 'Bounce 12 times in a run' },
  { id: 'scientist', label: 'Shapi-approved scientist (25,000 m)', hint: 'Reach 25,000 m' },
];
