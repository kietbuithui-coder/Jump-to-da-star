/**
 * JUMP TO THE STAR — central tuning configuration.
 * "Every number in here is an experiment. Adjust. Measure. Repeat." — Prof. Shapi
 *
 * Units: world pixels (px) and seconds (s). +x = right, +y = DOWN (canvas space).
 * 18 px == 1 metre of journey distance.
 */

export const PX_PER_METER = 18;

export const PHYS = {
  gravity: 1500, // px/s^2 downward, always on
  gravityCap: 2600, // never exceed this downward accel (stability)
  maxFallSpeed: 2450, // terminal velocity
  vxDrag: 0.045, // linear air drag coefficient (1/s)
  vxDragFloor: 380, // no drag below this speed (keeps the launch feeling snappy)
  maxVx: 2150,
  maxVxCombo: 3400,
  maxVyUp: 2300,
  airAccel: 1500, // horizontal steering acceleration
  airAccelBack: 1900, // slightly stronger when braking/going left
  steerSpeedCap: 290, // steering can only change vx by this much above base drift
  step: 1 / 120, // fixed physics timestep
  maxSubSteps: 10,
  collideRadius: 40, // player collision radius
  subStepLen: 14, // max px travelled per collision sub-step
};

export const LAUNCH = {
  // The catapult in Prof. Frog's Launch Lab.
  idleTime: 0.0,
  chargeTime: 0.75, // anticipation animation length
  perfectWindowStart: 0.42,
  perfectWindowEnd: 0.62,
  vx: 1040,
  vy: -1520,
  perfectVxBonus: 210,
  perfectVyBonus: 190,
  startX: 320,
  startY: -180, // pad sits slightly above the hazard floor (y grows downward)
};

export const BOOST = {
  start: 3,
  max: 6,
  lockout: 0.22, // seconds between boosts (prevents accidental double fire)
  bufferTime: 0.14, // input buffering window
  fallCancel: -1080, // if falling faster than this, boost resets vy to here
  extraUp: 260, // additional upward impulse when already rising
  vxImpulse: 330,
  vxCap: 2150,
  coffeeMul: 1.45,
  comboWindow: 1.6, // boosting inside this window chains the combo
};

export const PLAYER = {
  radius: 40,
  energyMax: 100,
  comboTime: 2.8, // seconds a combo survives without a new action
  invulnAfterHit: 0.6,
  w: 104,
  h: 96,
};

export const ECONOMY = {
  coinValue: 1,
  starCoinPerMeter: 0.02, // end-of-run payout from distance
  distanceScore: 1, // 1 point per metre
  orbScore: 5,
  superScore: 20,
  comboScore: 12, // per combo action
  skillScore: 25,
};

export const WORLD = {
  chunkWidth: 2200,
  chunksAhead: 3,
  chunkBehindKeep: 2,
  spawnAhead: 3200, // generate this far in front of the player
  floorDrop: 1150, // hazard floor distance below the reference flight line
  floorMinY: 520,
  floorMaxY: 3400,
  itemMinGap: 190,
  routeStep: 1250, // nominal horizontal distance between support nodes (px)
  routeStepVariance: 260,
  routeBaseY: -420, // nominal height of the flight corridor
  waveAmp: 640, // primary vertical wave (how high and low the route breathes)
  waveAmp2: 240,
  dropMax: 520, // biggest vertical step between two pads
  skyChance: 0.62, // chance a hop carries a high-altitude reward shelf
  skyMin: 620, // px above the pad line (needs a thermal / boost chain)
  skyMax: 1400,
};

export const CAMERA = {
  lookAhead: 0.42, // fraction of view width the camera leads by at speed
  lookAheadMax: 420,
  smoothX: 6.5,
  smoothY: 4.4,
  zoomSpeed: 2.2,
  baseZoomBoost: 0.965, // subtle zoom-out on huge boosts
  shakeDecay: 6.5,
};

/** Journey regions. Distances are metres from the launch pad (horizontal). */
export const REGIONS = [
  {
    id: 'lab',
    name: "SHAPI'S LAUNCH LAB",
    short: 'LAUNCH LAB',
    from: 0,
    to: 500,
    difficulty: 0.15,
    density: 1.0,
    hue: '#7fe33f',
  },
  {
    id: 'wilds',
    name: 'THE BOUNCY WILDS',
    short: 'BOUNCY WILDS',
    from: 500,
    to: 2000,
    difficulty: 0.35,
    density: 0.86,
    hue: '#ffd93b',
  },
  {
    id: 'clouds',
    name: 'CLOUD CHAOS',
    short: 'CLOUD CHAOS',
    from: 2000,
    to: 5000,
    difficulty: 0.55,
    density: 0.72,
    hue: '#7ee8ff',
  },
  {
    id: 'illegal',
    name: 'ILLEGAL SCIENCE ZONE',
    short: 'ILLEGAL SCIENCE',
    from: 5000,
    to: 15000,
    difficulty: 0.75,
    density: 0.58,
    hue: '#ff8a3d',
  },
  {
    id: 'star',
    name: 'THE STAR FRONTIER',
    short: 'STAR FRONTIER',
    from: 15000,
    to: Infinity,
    difficulty: 0.95,
    density: 0.5,
    hue: '#c58bff',
  },
];

export function regionAt(metres) {
  for (let i = REGIONS.length - 1; i >= 0; i--) {
    if (metres >= REGIONS[i].from) return REGIONS[i];
  }
  return REGIONS[0];
}

export const COMBO_TIERS = [
  { at: 3, label: 'NICE!', colour: '#9ff7a0' },
  { at: 6, label: 'GREAT!', colour: '#7ee8ff' },
  { at: 10, label: 'AMAZING!', colour: '#ffd93b' },
  { at: 15, label: 'INSANE!', colour: '#ff9a3d' },
  { at: 22, label: 'PHYSICS IS CRYING!', colour: '#ff6b4a' },
  { at: 30, label: 'SCIENCE HAS LEFT THE CHAT!', colour: '#ff5ea8' },
  { at: 42, label: 'SHAPI APPROVES!', colour: '#c58bff' },
];

export const QUALITY = {
  high: { particles: 1, parallax: 1, bloom: true, shake: 1, dprCap: 2, shadow: true },
  balanced: { particles: 0.6, parallax: 0.8, bloom: true, shake: 0.7, dprCap: 1.6, shadow: true },
  low: { particles: 0.32, parallax: 0.55, bloom: false, shake: 0.35, dprCap: 1.25, shadow: false },
};

export const SAVE_KEY = 'jtts.save.v2';
export const SAVE_VERSION = 2;

export const AUDIO = {
  master: 0.8,
  music: 0.55,
  sfx: 0.85,
  voices: 18, // max simultaneous synth voices
};
