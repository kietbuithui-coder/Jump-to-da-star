/**
 * JUMP TO THE STAR — game controller.
 * Owns the run: player physics, skills, items, world streaming, scoring, death.
 */
import {
  PHYS,
  LAUNCH,
  BOOST,
  PLAYER,
  CAMERA,
  WORLD,
  PX_PER_METER,
  ECONOMY,
  REGIONS,
  regionAt,
} from '../config/config.js';
import { clamp, clamp01, damp, lerp, RNG, formatMeters } from '../core/mathx.js';
import { pick, pickSkill, regionLabel, t } from '../core/i18n.js';
import { stepFlight } from './flight.js';
import { padContact, resolvePadBounce } from './bounce.js';
import { World } from './world.js';
import { ITEM_DEFS } from './items.js';
import { CHARACTERS, resolveStats, GLITCH_MODES } from './characters.js';
import { ScoreTracker } from './score.js';
import { Particles } from './particles.js';
import { Camera, VIEW_SCALES, zoomForViewport } from './camera.js';

const RUN = {
  respawnDelay: 0.55,
  coyote: 0.1,
  hazardEnergyLoss: 18,
};

export class Game {
  constructor({ canvas, save, audio, onGameOver, onEvent }) {
    this.canvas = canvas;
    this.save = save;
    this.audio = audio;
    this.onGameOver = onGameOver || (() => {});
    this.onEvent = onEvent || (() => {});
    this.particles = new Particles();
    this.camera = new Camera();
    this.score = new ScoreTracker();
    this.world = null;
    this.player = null;
    this.state = 'idle';
    this.time = 0;
    this.quality = 'balanced';
    this.dpr = 1;
    this.cssW = 800;
    this.cssH = 450;
    this.floaters = [];
    this.slowmo = 0;
    this.shakeScale = 1;
    this.fps = 60;
    this.rng = new RNG(1);
    this.characterId = 'frog';
    this.stats = resolveStats(CHARACTERS.frog, {});
    this.upgrades = {};
    this.hintTimer = 0;
    this.hintsShown = new Set();
    this.boostLock = 0;
    this.deadTimer = 0;
    this.summary = null;
    this.launchPower = 0;
    this.launchHeld = false;
    this.launchReleased = false;
    this.perfectLaunch = false;
    this.tutorialStep = 0;
    this.nearestInfo = null;
    this.statusFlash = 0;
    this.runStats = { boosts: 0, skills: 0, springs: 0, orbs: 0, nets: 0, padHits: 0 };
    this.bgTime = 0;
    this.lastRegion = null;
  }

  // ------------------------------------------------------------- lifecycle
  configure({ characterId, upgrades, quality }) {
    this.characterId = characterId in CHARACTERS ? characterId : 'frog';
    this.upgrades = upgrades || {};
    if (quality) this.setQuality(quality);
  }

  setQuality(q) {
    this.quality = q;
    this.shakeScale = this.save?.data?.settings?.reduceShake ? 0.4 : 1;
  }

  /** 'normal' | 'wide' | 'ultra' — how much of the world you can read ahead. */
  setViewMode(view) {
    const v = VIEW_SCALES[view] ? view : 'normal';
    this.viewMode = v;
    if (this.cssW) this.resize(this.cssW, this.cssH, this.dpr);
    return v;
  }

  resize(cssW, cssH, dpr) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    const zoom = zoomForViewport(cssW, cssH, this.viewMode || 'normal');
    this.camera.setViewport(cssW / zoom, cssH / zoom, zoom);
    this.camera.reduceShake = !!this.save?.data?.settings?.reduceShake;
    if (this.player) this.camera.snapTo(this.player.x, this.player.y);
  }

  setCharacter(id, upgrades) {
    this.characterId = id in CHARACTERS ? id : 'frog';
    this.upgrades = upgrades || this.upgrades;
    this.stats = resolveStats(CHARACTERS[this.characterId], this.upgrades[this.characterId] || {});
  }

  /** Start a fresh run. Uses a new seed; old runs never leak state. */
  startRun(seed = null) {
    this.setCharacter(this.characterId, this.upgrades);
    const s = this.stats;
    this.seed = seed ?? Math.floor(Math.random() * 0xffffffff);
    this.rng = new RNG(this.seed);
    this.world = new World(this.seed, {
      gravityMul: s.gravityMul,
      dragMul: s.dragMul,
      bounceMul: s.bounceMul,
      itemMul: s.itemMul,
    });
    this.score.reset(LAUNCH.startX);
    this.particles.clear();
    this.floaters.length = 0;
    this.time = 0;
    this.deadTimer = 0;
    this.summary = null;
    this.slowmo = 0;
    this.hintTimer = 0;
    this.hintsShown.clear();
    this.boostLock = 0;
    this.tutorialStep = 0;
    // Launch state MUST be reset, otherwise the charge bar is dead after a
    // restart (launchHeld stayed true from the previous run).
    this.launchHeld = false;
    this.launchReleased = false;
    this.launchPower = 0;
    this.perfectLaunch = false;
    this.runStats = { boosts: 0, skills: 0, springs: 0, orbs: 0, nets: 0, padHits: 0 };
    this.lastRegion = null;
    this.statusFlash = 0;

    const player = {
      x: LAUNCH.startX,
      y: LAUNCH.startY,
      vx: 0,
      vy: 0,
      facing: 1,
      energy: s.energyMax,
      energyMax: s.energyMax,
      boosts: s.boostCount,
      maxBoosts: Math.min(BOOST.max, s.boostCount + 2),
      skillCooldown: 0,
      glitchMode: 0,
      glitchFlash: 0,
      buffs: { balloon: 0, coffee: 0, magnet: 0, parachute: 0, ufo: 0, control: 0, recovery: 0 },
      rideUfo: null,
      squash: 1,
      stretch: 1,
      rot: 0,
      animT: 0,
      animState: 'idle',
      landTimer: 0,
      jumpTimer: 0,
      landPulse: 0,
      takeoffPulse: 0,
      expression: 'happy',
      diveTimer: 0,
      diveActive: false,
      divePower: 0,
      hurt: 0,
      trail: [],
      lastPadAt: -9,
      lastBoostAt: -9,
      invuln: 0,
      launched: false,
      charge: 0,
      boostPulse: 0,
      skillPulse: 0,
      landed: false,
      springChain: 0,
    };
    this.player = player;
    this.state = 'launch';
    this.camera.snapTo(player.x + 200, player.y - 60);
    this.camera.zoom = this.camera.baseZoom;
    this.audio?.setScene('launch');
    this.audio?.setIntensity(0.15);
  }

  pause() {
    if (this.state === 'fly' || this.state === 'launch') {
      this.prevState = this.state;
      this.state = 'paused';
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.state = this.prevState || 'fly';
    }
  }

  isRunning() {
    return this.state === 'fly' || this.state === 'launch' || this.state === 'dead';
  }

  // ------------------------------------------------------------ main update
  update(dt, now, input) {
    this.input = input;
    this.bgTime += dt;
    this.time += this.state === 'paused' ? 0 : dt;

    if (this.state === 'launch') this.updateLaunch(dt, input);
    else if (this.state === 'fly') this.updateFlight(dt, input);
    else if (this.state === 'dead') {
      this.deadTimer += dt;
      this.updateEffects(dt);
      this.particles.update(dt);
      if (Math.random() < 0.4) {
        this.particles.spawn({
          x: this.player.x + (Math.random() - 0.5) * 60,
          y: this.player.y + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 200,
          vy: -120 - Math.random() * 200,
          life: 0.8,
          size: 6,
          colour: '#ffb020',
          kind: 'smoke',
          gravity: -60,
          drag: 1.2,
        });
      }
      if (this.deadTimer > RUN.respawnDelay && this.summary && !this.summarySent) {
        this.summarySent = true;
        this.onGameOver(this.summary);
      }
    } else {
      this.particles.update(dt);
    }

    // camera follows the action in every state
    const target = this.player;
    if (target) {
      this.camera.update(dt, target, { zoomOut: this.state === 'dead' });
    }
    this.updateFloaters(dt);
    if (this.audio) {
      const intensity = clamp01(this.score.combo / 30 + this.score.metres / 6000);
      this.audio.setIntensity(intensity);
    }
  }

  // ----------------------------------------------------------------- launch
  updateLaunch(dt, input) {
    const p = this.player;
    p.animT += dt;
    p.animState = 'launch';
    const held = input?.isDown('boost');
    if (held && !this.launchHeld) {
      this.launchHeld = true;
      this.launchPower = 0;
      this.audio?.sfx('click');
    }
    if (this.launchHeld) {
      this.launchPower = Math.min(1, this.launchPower + dt / LAUNCH.chargeTime);
      this.audio?.sfx('wind', { throttle: 0.2, volume: 0.4 });
      if (this.launchPower >= 1 && !this.launchReleased) {
        this.fireLaunch();
      }
    }
    if (this.launchHeld && !held && !this.launchReleased) {
      this.perfectLaunch =
        this.launchPower >= LAUNCH.perfectWindowStart && this.launchPower <= LAUNCH.perfectWindowEnd;
      this.fireLaunch();
    }
    // idle auto-launch so the run never stalls
    if (this.time > 7 && !this.launchReleased) this.fireLaunch(true);
    this.updateEffects(dt);
    this.particles.update(dt);
  }

  fireLaunch(auto = false) {
    if (this.state !== 'launch') return;
    const p = this.player;
    const s = this.stats;
    const power = auto ? 1 : Math.max(0.62, this.launchPower);
    const perfect = this.perfectLaunch;
    p.launched = true;
    p.jumpTimer = 0.3;
    p.takeoffPulse = 1;
    p.animState = 'jump';
    p.vx = LAUNCH.vx * s.launchMul * (0.82 + 0.18 * power) + (perfect ? LAUNCH.perfectVxBonus : 0);
    p.vy = LAUNCH.vy * s.launchMul * (0.8 + 0.22 * power) - (perfect ? LAUNCH.perfectVyBonus : 0);
    p.charge = power;
    this.launchReleased = true;
    this.state = 'fly';
    this.audio?.sfx('launch');
    this.audio?.sfx('ey', { volume: perfect ? 0.9 : 0.55, crowd: perfect ? 2 : 1, pitch: perfect ? 1.06 : 0.94, throttle: 0.2 });
    this.audio?.setScene('fly');
    this.camera.addShake(0.55);
    this.camera.pulseZoom(0.06);
    this.particles.burst(p.x - 30, p.y + 40, 44, {
      colour: ['#ffd93b', '#ff9f1c', '#ff5e3a', '#bff7ff'],
      speed: 700,
      angle: -Math.PI / 2,
      spread: 1.9,
      life: 0.9,
      size: 7,
      gravity: 520,
      glow: true,
      kind: 'spark',
      jitter: 40,
    });
    this.particles.burst(p.x - 30, p.y + 40, 16, {
      colour: '#d8dce8',
      speed: 320,
      life: 1.3,
      size: 26,
      kind: 'smoke',
      gravity: -40,
      drag: 1.6,
    });
    this.addFloater(perfect ? 'PERFECT LAUNCH!' : auto ? 'LAUNCH!' : 'GO!', p.x, p.y - 120, perfect ? '#ffd93b' : '#ffffff', perfect ? 40 : 32);
    if (perfect) {
      this.score.addSkillBonus(120, 'PERFECT LAUNCH');
      this.addFloater('+120 PHYSICS BONUS', p.x, p.y - 170, '#9ff7a0', 24);
    }
    this.hintTimer = 0;
  }

  // ----------------------------------------------------------------- flight
  updateFlight(dt, input) {
    const p = this.player;
    const s = this.stats;
    p.animT += dt;
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    this.boostLock = Math.max(0, this.boostLock - dt);
    p.lastPadAt += dt;
    p.lastBoostAt += dt;
    p.boostPulse = Math.max(0, p.boostPulse - dt * 3.4);
    p.skillPulse = Math.max(0, p.skillPulse - dt * 3);
    p.glitchFlash = Math.max(0, p.glitchFlash - dt * 2);

    for (const k of Object.keys(p.buffs)) {
      if (p.buffs[k] > 0) p.buffs[k] = Math.max(0, p.buffs[k] - dt);
    }

    // energy trickle: slow, deliberately not a crutch
    p.energy = Math.min(p.energyMax, p.energy + 1.6 * dt);

    // Boost is edge-triggered with a short input buffer so a press near the
    // end of the lockout is never swallowed.
    if (input && input.buffered('boost', this.time, BOOST.bufferTime)) {
      input.consume('boost', this.time, BOOST.bufferTime);
      this.tryBoost();
    }

    this.handleSkill(dt, input);
    this.applySteering(dt, input);
    this.applyZones(dt);

    // ---- ride (glitch UFO) overrides normal flight
    if (p.rideUfo) {
      const u = p.rideUfo;
      u.timer -= dt;
      p.buffs.ufo = u.timer;
      p.x = u.x;
      p.y = u.y - 74 + Math.sin(this.time * 9) * 5;
      p.vx = u.vx;
      p.vy = 0;
      u.x += u.vx * dt;
      u.phase += dt;
      if (Math.random() < 0.6) {
        this.particles.spawn({
          x: u.x + (Math.random() - 0.5) * 90,
          y: u.y + 30,
          vx: -u.vx * 0.15,
          vy: 90 + Math.random() * 120,
          life: 0.6,
          size: 5,
          colour: Math.random() < 0.5 ? '#c58bff' : '#7ee8ff',
          kind: 'spark',
          glow: true,
          gravity: -80,
        });
      }
      if (u.timer <= 0) {
        p.rideUfo = null;
        p.vx = Math.max(p.vx, 760) + 320;
        p.vy = -620;
        p.buffs.ufo = 0;
        this.audio?.sfx('whoosh');
        this.camera.addShake(0.25);
        this.addFloater('EJECT!', p.x, p.y - 90, '#c58bff', 26);
        this.score.addSkillBonus(60, 'UFO EJECT');
        this.particles.burst(p.x, p.y, 22, { colour: ['#c58bff', '#7ee8ff'], speed: 420, life: 0.6, size: 6, gravity: 0, glow: true });
      }
      this.score.updateMax(p.x);
      this.score.update(dt);
      this.world.ensure(p.x + WORLD.spawnAhead);
      this.world.recycle(p.x);
      this.updateEffects(dt);
      this.particles.update(dt);
      this.updateTrail(dt);
      this.checkDeath();
      return;
    }

    // ---- flight model (buffs modify gravity / fall speed)
    let gravityMul = s.gravityMul;
    if (p.buffs.balloon > 0) gravityMul *= 0.42;
    let fallCap = null;
    if (p.buffs.parachute > 0) fallCap = 300;
    if (p.buffs.recovery > 0) fallCap = Math.min(fallCap ?? 1e9, 220);
    let dive = false;
    if (p.diveTimer > 0) {
      p.diveTimer -= dt;
      dive = true;
      gravityMul *= 2.35;
      p.vx = Math.min(PHYS.maxVxCombo, p.vx + 340 * dt);
      if (Math.random() < 0.7) {
        this.particles.spawn({
          x: p.x + (Math.random() - 0.5) * 50,
          y: p.y + 30,
          vx: -p.vx * 0.12,
          vy: -60 - Math.random() * 120,
          life: 0.5,
          size: 8 + Math.random() * 8,
          colour: Math.random() < 0.5 ? '#ff6b3d' : '#ffd93b',
          kind: 'smoke',
          gravity: -200,
          drag: 1.1,
          glow: true,
        });
      }
    }

    stepFlight(p, dt, {
      gravityMul,
      dragMul: s.dragMul,
      fallCap,
      vxCap: PHYS.maxVx * s.vxCapMul * (this.score.combo > 15 ? 1.25 : 1),
    });
    if (p.vy > PHYS.maxFallSpeed) p.vy = PHYS.maxFallSpeed;

    const prevX = p.x;
    const prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Stream scattered pickups without guaranteeing vertical ascent.
    this.world.ensureAltitudeLoot(p);

    // ---- pad collisions (one-way, shared with the generator's model)
    const pads = this.world.padsNear(p.x);
    const contact = padContact(p, prevX, prevY, PHYS.collideRadius, pads);
    if (contact) this.hitPad(contact, dive);

    // ---- pickups / gates / rides / hazards
    this.collectNearby(dt);
    this.touchEntities(dt);

    // ---- animation state
    this.updateAnimation(dt);

    // ---- scoring, world streaming, effects
    this.score.updateMax(p.x);
    this.score.update(dt);
    this.world.ensure(p.x + WORLD.spawnAhead);
    this.world.recycle(p.x);
    this.updateEffects(dt);
    this.particles.update(dt);
    this.updateTrail(dt);
    this.checkDeath();
    this.checkRegionChange();

    // hints for the tutorial zone
    this.hintTimer += dt;
    const metres = this.score.metres;
    // Tutorial hints fire once each and are spaced out, so two lines can never
    // land on top of each other mid-screen.
    const hint = (key, atMetres, textKey, colour, vars) => {
      if (metres < atMetres || this.hintsShown.has(key)) return;
      if (this.time - (this.lastHintAt || -99) < 2.6) return;
      this.hintsShown.add(key);
      this.lastHintAt = this.time;
      this.addFloater(t(textKey, vars), p.x + 300, p.y - 230, colour, 20, 3.2);
    };
    const skillName = pickSkill(CHARACTERS[this.characterId], 'name');
    hint('boost', 30, 'hint.boost', '#7ee8ff');
    hint('skill', 120, 'hint.skill', '#ffd93b', { skill: skillName });
    hint('energy', 260, 'hint.energy', '#9ff7a0');
    hint('spring', 420, 'hint.spring', '#ff9ad5');
    hint('sky', 700, 'hint.sky', '#7ee8ff');
  }

  updateAnimation(dt) {
    const p = this.player;
    p.landTimer = Math.max(0, p.landTimer - dt);
    p.jumpTimer = Math.max(0, p.jumpTimer - dt);
    p.landPulse = Math.max(0, p.landPulse - dt * 5);
    p.takeoffPulse = Math.max(0, p.takeoffPulse - dt * 3.5);
    if (p.hurt > 0) p.animState = 'hit';
    else if (p.landTimer > 0) p.animState = 'land';
    else if (p.boostPulse > 0.3) p.animState = 'boost';
    else if (p.diveTimer > 0) p.animState = 'dive';
    else if (p.skillPulse > 0.45) p.animState = 'skill';
    else if (p.vy > 160) p.animState = 'fall';
    else if (p.vy < -230) p.animState = p.jumpTimer > 0 ? 'jump' : 'rise';
    else p.animState = 'glide';

    const targetRot = clamp(p.vy / 2600, -0.5, 0.7) + (p.vx > 0 ? 0.06 : 0);
    p.rot += (targetRot - p.rot) * damp(9, dt);
    const speedStretch = clamp(1 + Math.abs(p.vy) / 6200, 1, 1.25);
    const targetStretch = p.animState === 'land' ? 0.78
      : p.animState === 'jump' || p.animState === 'boost' ? 1.19
      : p.animState === 'fall' ? 0.95 : speedStretch;
    const targetSquash = p.animState === 'land' ? 1.27
      : p.animState === 'jump' || p.animState === 'boost' ? 0.89
      : p.animState === 'fall' ? 1.04 : 1;
    p.stretch += (targetStretch - p.stretch) * damp(12, dt);
    p.squash += (targetSquash - p.squash) * damp(12, dt);
    p.facing = p.vx < -40 ? -1 : 1;
    p.expression = p.hurt > 0 ? 'ouch' : p.diveTimer > 0 ? 'panic'
      : p.animState === 'fall' ? 'panic'
      : p.animState === 'jump' || p.animState === 'boost' ? 'excited' : 'happy';
  }

  updateTrail(dt) {
    const p = this.player;
    if (p.vx > 900 && this.particles.budget > 0.2) {
      if (Math.random() < 0.55) {
        this.particles.spawn({
          x: p.x - 34,
          y: p.y + (Math.random() - 0.5) * 44,
          vx: -p.vx * 0.12 + (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 90,
          life: 0.35,
          size: 3 + Math.random() * 3,
          colour: p.boostPulse > 0.2 ? '#ffd93b' : '#bff7ff',
          kind: 'streak',
          gravity: 0,
          drag: 2.2,
          glow: true,
        });
      }
    }
    if (p.boostPulse > 0.05) {
      for (let i = 0; i < 2; i++) {
        this.particles.spawn({
          x: p.x - 40 + Math.random() * 24,
          y: p.y + 20 + (Math.random() - 0.5) * 40,
          vx: -240 - Math.random() * 220,
          vy: 120 + Math.random() * 180,
          life: 0.38,
          size: 8 + Math.random() * 8,
          colour: Math.random() < 0.5 ? '#ffd93b' : '#ff8a3d',
          kind: 'smoke',
          gravity: -140,
          drag: 1.4,
          glow: true,
        });
      }
    }
  }

  applySteering(dt, input) {
    const p = this.player;
    const s = this.stats;
    if (!input) return;
    const axis = input.axis;
    if (p.buffs.control > 0 && axis === 0) return;
    let steerMul = s.steerMul * (p.buffs.control > 0 ? 1.9 : 1);
    if (p.diveTimer > 0) steerMul *= 0.5;
    const accel = PHYS.airAccel * steerMul;
    if (axis > 0) {
      p.vx = Math.min(PHYS.maxVx * s.vxCapMul + 120, p.vx + accel * dt);
      if (p.vx < 0) p.vx += accel * 1.4 * dt;
    } else if (axis < 0) {
      p.vx = Math.max(-PHYS.maxVx * 0.55, p.vx - PHYS.airAccelBack * steerMul * dt);
    }
    if (axis !== 0 && Math.random() < 0.35) {
      this.particles.spawn({
        x: p.x - 20 * axis,
        y: p.y + 24,
        vx: -axis * 120,
        vy: -40,
        life: 0.3,
        size: 4,
        colour: '#dff6ff',
        kind: 'smoke',
        gravity: 0,
        drag: 2,
      });
    }
  }

  applyZones(dt) {
    const p = this.player;
    for (const z of this.world.zonesNear(p.x)) {
      const def = ITEM_DEFS[z.id];
      const halfW = (z.width ?? def.width ?? 160) / 2;
      const halfH = (z.height ?? def.height ?? 600) / 2;
      if (Math.abs(p.x - z.x) < halfW + 30 && Math.abs(p.y - z.y) < halfH + 30) {
        p.vy -= (z.lift ?? def.lift ?? 1800) * dt;
        p.vx += (def.vxPush || 0) * dt;
        p.vy = Math.max(p.vy, -PHYS.maxVyUp);
        if (Math.random() < 0.5) {
          this.particles.spawn({
            x: z.x + (Math.random() - 0.5) * halfW * 1.6,
            y: p.y + 40,
            vx: (Math.random() - 0.5) * 70,
            vy: -320 - Math.random() * 260,
            life: 0.8,
            size: 6 + Math.random() * 8,
            colour: Math.random() < 0.5 ? '#ffb020' : '#ffd93b',
            kind: 'smoke',
            gravity: -220,
            drag: 0.8,
            glow: true,
          });
        }
      }
    }
  }

  // ------------------------------------------------------------------ skill
  handleSkill(dt, input) {
    const p = this.player;
    const s = this.stats;
    const def = CHARACTERS[this.characterId];
    const skill = def.skill;
    p.skillCooldown = Math.max(0, p.skillCooldown - dt);
    const cost = skill.cost * s.skillCostMul * (skill.hold ? dt : 1);
    const wants = input ? (skill.hold ? input.isDown('skill') : input.consume('skill', this.time, 0.16)) : false;

    // a released hold skill stops counting as one continuous cast
    if (skill.hold && p.holdActive) {
      if (!wants) {
        p.holdReset = (p.holdReset ?? 0) - dt;
        if (p.holdReset <= 0) p.holdActive = false;
        else p.holdReset = 0.25;
      } else {
        p.holdReset = 0.25;
      }
    }
    if (!wants) return;
    if (p.skillCooldown > 0) return;
    if (p.energy < cost) {
      if (!skill.hold) {
        this.addFloater('NO ENERGY!', p.x, p.y - 100, '#ff8a8a', 22, 0.8);
        this.audio?.sfx('hit', { volume: 0.4, throttle: 0.5 });
      }
      return;
    }
    const freshCast = skill.hold ? p.skillCooldown <= 0 && !p.holdActive : true;
    p.energy -= cost;
    if (freshCast) {
      this.runStats.skills++;
      p.holdActive = !!skill.hold;
      if (skill.hold) p.holdReset = 0.25;
    }
    p.skillPulse = 1;

    switch (skill.id) {
      case 'bioSpring': {
        p.vy = Math.min(p.vy - 980 * s.skillPower, -760 * s.skillPower);
        p.vx = Math.min(PHYS.maxVx, p.vx + 70);
        p.skillCooldown = skill.cooldown;
        p.squash = 0.75;
        p.stretch = 1.3;
        p.springBuff = 0.6;
        this.audio?.sfx('sproing', { volume: 1 });
        this.camera.addShake(0.18);
        this.particles.burst(p.x, p.y + 50, 26, {
          colour: ['#9ff7a0', '#c6f24e', '#ffffff'],
          speed: 460,
          angle: Math.PI / 2,
          spread: 1.5,
          life: 0.55,
          size: 6,
          gravity: 700,
          glow: true,
        });
        this.particles.spawn({ x: p.x, y: p.y + 40, vx: 0, vy: 0, life: 0.4, size: 130, colour: '#9ff7a0', kind: 'ring', gravity: 0, drag: 0 });
        break;
      }
      case 'panicThrust': {
        if (p.energy <= 0) break;
        p.vy -= 1550 * s.skillPower * dt;
        p.vy = Math.max(p.vy, -PHYS.maxVyUp);
        p.vx = Math.min(PHYS.maxVx * s.vxCapMul, p.vx + 760 * dt);
        p.energy = Math.max(0, p.energy - 0.5 * dt);
        p.skillCooldown = 0;
        this.audio?.sfx('fwooom', { throttle: 0.14, volume: 0.5, pitch: 1 });
        for (let i = 0; i < 2; i++) {
          this.particles.spawn({
            x: p.x - 46,
            y: p.y + 10 + (Math.random() - 0.5) * 40,
            vx: -520 - Math.random() * 320,
            vy: 140 + Math.random() * 220,
            life: 0.3,
            size: 9 + Math.random() * 10,
            colour: Math.random() < 0.5 ? '#ffd93b' : '#ff7a3d',
            kind: 'smoke',
            gravity: -100,
            drag: 1.5,
            glow: true,
          });
        }
        if (Math.random() < 0.25) {
          this.particles.spawn({
            x: p.x - 40, y: p.y - 10, vx: -300, vy: -60, life: 1.1, size: 5,
            colour: '#fff7e8', kind: 'spark', gravity: 380, rot: Math.random() * 6, vr: 6,
          });
        }
        break;
      }
      case 'cheeseMagnet': {
        if (p.energy <= 0) break;
        p.energy = Math.max(0, p.energy - 0.6 * dt);
        this.pullLoot(560, 1500, dt, true);
        // and a gentle personal attraction toward the nearest cluster
        let nearest = null;
        let bestD = 1e9;
        for (const it of this.world.itemsNear(p.x)) {
          if (it.kind !== 'pickup' || it.taken) continue;
          const d = Math.hypot(it.x - p.x, it.y - p.y);
          if (d < bestD) {
            bestD = d;
            nearest = it;
          }
        }
        if (nearest && bestD < 900) {
          const dx = nearest.x - p.x;
          const dy = nearest.y - p.y;
          const l = Math.hypot(dx, dy) || 1;
          p.vx += (dx / l) * 240 * dt;
          p.vy += (dy / l) * 240 * dt;
        }
        this.audio?.sfx('zap', { throttle: 0.3, volume: 0.35 });
        if (Math.random() < 0.7) {
          const a = Math.random() * 6.28;
          this.particles.spawn({
            x: p.x + Math.cos(a) * 130,
            y: p.y + Math.sin(a) * 130,
            vx: -Math.cos(a) * 280,
            vy: -Math.sin(a) * 280,
            life: 0.4,
            size: 4,
            colour: '#ffd93b',
            kind: 'spark',
            gravity: 0,
            glow: true,
          });
        }
        break;
      }
      case 'meteorSlam': {
        p.diveTimer = 0.85;
        p.diveActive = true;
        p.skillCooldown = skill.cooldown;
        p.vy = Math.max(p.vy, 260);
        this.audio?.sfx('thoomp');
        this.camera.addShake(0.2);
        this.particles.spawn({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.5, size: 90, colour: '#ff8a3d', kind: 'ring', gravity: 0, drag: 0 });
        break;
      }
      case 'glitchBoost': {
        const mode = GLITCH_MODES[p.glitchMode];
        p.glitchMode = (p.glitchMode + 1) % GLITCH_MODES.length;
        p.glitchFlash = 1;
        p.skillCooldown = skill.cooldown;
        this.audio?.sfx('glitch');
        this.camera.addShake(0.22);
        this.particles.spawn({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.45, size: 110, colour: '#c58bff', kind: 'ring', gravity: 0, drag: 0 });
        if (mode === 'POWER') {
          p.vy = Math.min(p.vy, -1250 * s.skillPower);
          p.vx = Math.min(PHYS.maxVx, p.vx + 420);
          this.addFloater('POWER!', p.x, p.y - 100, '#ff7a3d', 26, 0.9);
          this.particles.burst(p.x, p.y, 24, { colour: ['#ff7a3d', '#ffd93b'], speed: 520, life: 0.5, size: 7, gravity: 200, glow: true });
        } else if (mode === 'CONTROL') {
          const axis = input?.axis || 1;
          p.vx += axis * 720;
          p.vy = axis > 0 ? Math.min(p.vy, 80) * 0.4 : p.vy * 0.55;
          p.buffs.control = 1.6;
          this.addFloater('CONTROL!', p.x, p.y - 100, '#7ee8ff', 26, 0.9);
          this.particles.burst(p.x, p.y, 20, { colour: ['#7ee8ff', '#bff7ff'], speed: 480, life: 0.5, size: 6, gravity: 0, glow: true });
        } else {
          p.vy = Math.min(p.vy, -320);
          p.buffs.recovery = 1.8;
          this.addFloater('RECOVERY!', p.x, p.y - 100, '#9ff7a0', 26, 0.9);
          this.particles.burst(p.x, p.y, 20, { colour: ['#9ff7a0', '#ffffff'], speed: 380, life: 0.6, size: 6, gravity: 0, glow: true });
        }
        break;
      }
      default:
        break;
    }
    if (def.sfx && skill.id !== 'glitchBoost' && skill.id !== 'bioSpring') this.audio?.sfx(def.sfx, { volume: 0.7 });
  }

  /** Attract nearby pickups toward the player (cheese skill / reverse magnet). */
  pullLoot(radius, force, dt, strong = false) {
    const p = this.player;
    for (const it of this.world.itemsNear(p.x)) {
      if (it.taken || it.kind !== 'pickup') continue;
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const d = Math.hypot(dx, dy);
      if (d > radius || d < 1) continue;
      const f = force * (1 - d / radius) * dt;
      it.x += (dx / d) * f;
      it.y += (dy / d) * f;
      it.pulled = true;
      if (strong && Math.random() < 0.08) {
        this.particles.spawn({
          x: it.x, y: it.y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80,
          life: 0.3, size: 3, colour: '#ffd93b', kind: 'spark', gravity: 0, glow: true,
        });
      }
    }
  }

  // ------------------------------------------------------------- collisions
  hitPad(contact, diving) {
    const p = this.player;
    const s = this.stats;
    const { pad, nx, ny } = contact;
    const def = ITEM_DEFS[pad.id];
    const isRescue = !!pad.rescue;
    const skillBuff = p.springBuff > 0;
    const out = resolvePadBounce(def, p.vx, p.vy, nx, ny, s.itemMul, {
      bounceMul: s.bounceMul * (skillBuff ? 1.12 : 1),
      minVx: isRescue ? 1020 : 950,
      itemMul: s.itemMul,
    });
    if (!out) return;
    const impactSpeed = Math.hypot(p.vx, p.vy);
    p.vx = out.vx;
    p.vy = out.vy;
    // place the player just above the surface, along the pad's normal
    const surf = (contact.surface ?? PHYS.collideRadius + 4) + 1;
    const d = (p.x - pad.x) * nx + (p.y - pad.y) * ny;
    p.x += nx * (surf - d);
    p.y += ny * (surf - d);
    p.squash = 1.25;
    p.stretch = 0.82;
    p.landTimer = 0.15;
    p.jumpTimer = 0.34;
    p.landPulse = 1;
    p.takeoffPulse = 1;
    p.lastPadAt = 0;
    this.runStats.springs++;
    if (isRescue) this.runStats.nets = (this.runStats.nets || 0) + 1;
    else this.runStats.padHits = (this.runStats.padHits || 0) + 1;
    this.camera.addShake(isRescue ? 0.15 : 0.22);
    this.audio?.sfx(def.sound || 'boing', { pitch: 0.9 + Math.random() * 0.25, volume: isRescue ? 0.8 : 1 });

    // ---- meteor slam conversion: kinetic energy becomes altitude
    if (diving || p.diveTimer > 0) {
      const power = clamp(impactSpeed / 900, 0.6, 2.2);
      const bonus = 560 * power * s.skillPower;
      p.vy = Math.max(-PHYS.maxVyUp, p.vy - bonus);
      p.vx = Math.min(PHYS.maxVx, p.vx + 220 * power);
      p.diveTimer = 0;
      p.diveActive = false;
      this.score.addSkillBonus(Math.round(80 + 90 * power), 'METEOR CONVERSION');
      this.addFloater(`METEOR LAUNCH! +${Math.round(80 + 90 * power)}`, p.x, p.y - 130, '#ff9a3d', 28, 1.4);
      this.camera.addShake(0.6);
      this.camera.pulseZoom(0.05);
      this.particles.burst(p.x, p.y + 30, 34, {
        colour: ['#ff9a3d', '#ffd93b', '#ffffff'],
        speed: 720,
        life: 0.7,
        size: 8,
        gravity: 320,
        glow: true,
      });
      this.particles.spawn({ x: p.x, y: p.y + 20, vx: 0, vy: 0, life: 0.6, size: 180, colour: '#ff9a3d', kind: 'ring', gravity: 0, drag: 0 });
    }

    if (isRescue) {
      this.score.breakCombo();
      // A net is a second chance, not a free ride: it burns energy.
      p.energy = Math.max(0, p.energy - p.energyMax * 0.08);
      this.addFloater('SAFETY NET! -8%', p.x, p.y - 110, '#9ff7a0', 26, 1.2);
    } else {
      const chain = this.score.addCombo(1);
      if (chain) this.onCombo(chain, p);
      this.particles.burst(p.x, p.y + 34, 14, {
        colour: ['#ffffff', def.colour || '#ffd93b'],
        speed: 300,
        angle: Math.PI / 2,
        spread: 1.8,
        life: 0.4,
        size: 5,
        gravity: 520,
        glow: true,
      });
      this.addFloater(pick(def, 'name'), p.x, p.y - 96, '#ffffff', 18, 0.8);
      if (p.y < this.world.floorAt(p.x) - 1300) {
        // grabbed something from the high shelf: the lab is impressed
        this.audio?.sfx('ooh', { volume: 0.5, crowd: 2, pitch: 1.1 });
      }
    }
    p.springBuff = Math.max(0, (p.springBuff || 0) - 0.3);
    this.screenFlash = Math.min(1, (this.screenFlash || 0) + 0.18);
  }

  collectNearby(dt) {
    const p = this.player;
    if (p.buffs.magnet > 0) this.pullLoot(430, 900, dt, false);
    const radius = PHYS.collideRadius;
    for (const it of this.world.itemsNear(p.x)) {
      if (it.taken) continue;
      const def = ITEM_DEFS[it.id];
      if (!def) continue;
      const d2 = (it.x - p.x) ** 2 + (it.y - p.y) ** 2;
      const rr = radius + (def.r || 24) * 0.9;
      if (d2 > rr * rr) continue;
      this.consumeItem(it, def);
    }
  }

  consumeItem(it, def) {
    const p = this.player;
    this.world.removeItem(it);
    this.score.addPickup(def);
    if (def.energy) p.energy = Math.min(p.energyMax, p.energy + def.energy);
    if (def.boost) {
      p.boosts = Math.min(p.maxBoosts, p.boosts + def.boost);
      this.addFloater('+1 BOOST!', it.x, it.y - 40, '#ffe86b', 26, 1.1);
      this.camera.addShake(0.12);
    }
    if (def.buff) {
      p.buffs[def.buff] = Math.max(p.buffs[def.buff] || 0, def.duration);
      this.addFloater(def.name, it.x, it.y - 44, def.colour, 22, 1.2);
    }
    if (def.kind === 'booster') {
      p.vx = Math.min(PHYS.maxVx, p.vx + (def.vx || 0));
      p.vy = (def.vy || 0) + Math.min(p.vy, 0) * 0.4;
      p.boostPulse = 1;
      this.camera.addShake(0.3);
      this.camera.pulseZoom(0.04);
      this.particles.burst(it.x, it.y, 22, {
        colour: ['#ffd93b', '#ff7a3d', '#ffffff'],
        speed: 520,
        life: 0.55,
        size: 7,
        gravity: 240,
        glow: true,
      });
    }
    if (def.id === 'coin') {
      this.audio?.sfx('coin', { pitch: 0.95 + Math.random() * 0.2, throttle: 0.03 });
    } else {
      this.audio?.sfx(def.sound || 'pop', { pitch: 0.95 + Math.random() * 0.2 });
    }
    this.particles.burst(it.x, it.y, def.kind === 'pickup' ? 8 : 14, {
      colour: [def.colour, def.glow || '#ffffff', '#ffffff'],
      speed: 260,
      life: 0.45,
      size: 4,
      gravity: 120,
      glow: true,
    });
    this.addFloater(`+${def.score || 0}`, it.x, it.y - 24, def.colour, 16, 0.7);
    if (def.energy) this.addFloater(`+${def.energy} ENERGY`, it.x, it.y - 52, '#7ee8ff', 16, 0.75);
    if (this.score.tierIndex > 0 && Math.random() < 0.15) {
      this.audio?.sfx('combo', { pitch: 1 + this.score.tierIndex * 0.08, volume: 0.5 });
    }
  }

  touchEntities(dt) {
    const p = this.player;
    // jet gates
    for (const it of this.world.itemsNear(p.x)) {
      if (it.taken) continue;
      const def = ITEM_DEFS[it.id];
      if (!def) continue;
      if (def.kind === 'gate') {
        const d = Math.hypot(it.x - p.x, it.y - p.y);
        if (d < def.r + PHYS.collideRadius) {
          if (!it.cooldown || this.time - it.cooldown > 1.2) {
            it.cooldown = this.time;
            const ang = it.angle ?? -0.22;
            p.vx = Math.min(PHYS.maxVx, Math.max(p.vx, 900) + def.vx);
            // additive thrust along the gate's designed angle: you always feel it
            p.vy = Math.max(-PHYS.maxVyUp, p.vy - def.impulse * 0.9 * Math.cos(ang));
            p.boostPulse = 1;
            this.audio?.sfx('rocket', { volume: 0.9 });
            this.camera.addShake(0.25);
            this.score.addPickup({ score: def.score, combo: def.combo });
            this.addFloater('JET GATE!', it.x, it.y - 60, '#ffb020', 24, 1);
            this.particles.burst(it.x, it.y, 20, { colour: ['#ffb020', '#ff7a1a', '#fff'], speed: 480, life: 0.5, size: 7, gravity: 0, glow: true });
          }
        }
      } else if (def.kind === 'ride') {
        if (!p.rideUfo) {
          const d = Math.hypot(it.x - p.x, it.y - p.y);
          if (d < def.r + PHYS.collideRadius) {
            p.rideUfo = { x: it.x, y: it.y, vx: Math.max(760, p.vx * 0.8), timer: def.rideTime, phase: 0 };
            this.world.removeItem(it);
            this.score.addPickup({ score: def.score, combo: def.combo });
            this.audio?.sfx('glitch');
            this.addFloater('GLITCH UFO!', it.x, it.y - 70, '#c58bff', 26, 1.2);
            this.particles.burst(it.x, it.y, 18, { colour: ['#c58bff', '#7ee8ff'], speed: 420, life: 0.5, size: 6, gravity: 0, glow: true });
          }
        }
      }
    }
    // hazards
    if (p.invuln <= 0) {
      for (const h of this.world.hazardsNear(p.x)) {
        const d = Math.hypot(h.x - p.x, h.y - p.y);
        if (d < h.r + PHYS.collideRadius * 0.8) {
          p.energy = Math.max(0, p.energy - RUN.hazardEnergyLoss);
          p.invuln = 0.7;
          p.hurt = 0.6;
          p.vx = Math.max(600, p.vx * 0.72);
          p.vy = -480;
          this.score.breakCombo();
          this.audio?.sfx('hit');
          this.camera.addShake(0.5);
          this.screenFlash = 1;
          this.addFloater('OUCH! -' + RUN.hazardEnergyLoss + ' ENERGY', p.x, p.y - 110, '#ff6b6b', 24, 1.2);
          this.particles.burst(p.x, p.y, 26, { colour: ['#ff4d6d', '#ffd93b'], speed: 520, life: 0.6, size: 7, gravity: 400, glow: true });
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------ boost
  tryBoost() {
    const p = this.player;
    if (!p || (this.state !== 'fly' && this.state !== 'launch')) return false;
    if (this.boostLock > 0) return false;
    if (p.boosts <= 0) {
      this.boostLock = 0.4;
      this.addFloater('NO BOOSTS LEFT — FIND A STAR', p.x, p.y - 100, '#ff9a9a', 20, 1);
      this.audio?.sfx('click', { volume: 0.5 });
      return false;
    }
    p.boosts--;
    this.runStats.boosts++;
    const coffee = p.buffs.coffee > 0 ? BOOST.coffeeMul : 1;
    const power = this.stats.boostMul * coffee;
    if (p.vy > BOOST.fallCancel) p.vy = BOOST.fallCancel * Math.min(1.25, power);
    else p.vy -= BOOST.extraUp * power;
    p.vx = Math.min(PHYS.maxVx, p.vx + BOOST.vxImpulse * power);
    p.boostPulse = 1;
    p.takeoffPulse = 1;
    p.jumpTimer = 0.25;
    p.squash = 0.8;
    p.stretch = 1.25;
    p.lastBoostAt = 0;
    this.boostLock = BOOST.lockout;
    this.audio?.sfx('boost', { pitch: 1 + (coffee > 1 ? 0.16 : 0) });
    this.camera.addShake(0.34);
    this.camera.pulseZoom(0.035);
    const chain = this.score.addCombo(1);
    if (chain) this.onCombo(chain, p);
    if (p.lastPadAt < BOOST.comboWindow) {
      this.score.addSkillBonus(30, 'BOOST CHAIN');
      this.addFloater('BOOST COMBO +30', p.x, p.y - 150, '#7ee8ff', 22, 1);
    }
    this.particles.burst(p.x - 30, p.y + 30, 30, {
      colour: ['#ffd93b', '#ff9f1c', '#ffffff', '#7ee8ff'],
      speed: 620,
      angle: Math.PI * 0.62,
      spread: 1.1,
      life: 0.65,
      size: 8,
      gravity: 260,
      glow: true,
    });
    this.particles.spawn({ x: p.x, y: p.y + 20, vx: 0, vy: 0, life: 0.45, size: 120, colour: '#ffd93b', kind: 'ring', gravity: 0, drag: 0, glow: true });
    this.screenFlash = Math.min(1, (this.screenFlash || 0) + 0.22);
    return true;
  }

  onCombo(chain, p) {
    if (!chain) return;
    if (chain.tierUp) {
      this.addFloater(chain.label, p.x + 40, p.y - 190, chain.colour, 34, 1.4, true);
      this.audio?.sfx('ding', { pitch: 1 + chain.tier * 0.07, volume: 0.8 });
      if (chain.tier >= 3) {
        // the crowd starts believing
        this.audio?.sfx('ooh', { volume: 0.45 + Math.min(0.4, chain.tier * 0.05), crowd: Math.min(3, chain.tier - 1), pitch: 0.95 + chain.tier * 0.02 });
      }
      this.camera.addShake(0.18);
      this.particles.burst(p.x, p.y - 60, 18, {
        colour: [chain.colour, '#ffffff'],
        speed: 380,
        life: 0.7,
        size: 7,
        gravity: -40,
        glow: true,
        kind: 'star',
      });
    }
  }

  // ------------------------------------------------------------------- death
  checkDeath() {
    const p = this.player;
    const floor = this.world.floorAt(p.x);
    const below = p.y > floor - 8;
    const lost = p.y > floor + 2600 || !Number.isFinite(p.x) || !Number.isFinite(p.y);
    if (below || lost) this.die(below ? 'floor' : 'void');
  }

  die(cause) {
    if (this.state === 'dead') return;
    const p = this.player;
    this.state = 'dead';
    this.deadTimer = 0;
    this.summarySent = false;
    p.animState = 'dead';
    p.expression = 'dead';
    p.rideUfo = null;
    this.audio?.sfx('dead');
    this.audio?.sfx('ooh', { volume: 0.6, crowd: 1, pitch: 0.78, dur: 1.25 });
    this.audio?.setScene('gameover');
    this.camera.addShake(0.8);
    this.camera.pulseZoom(0.05);
    this.particles.burst(p.x, p.y, 46, {
      colour: ['#ff6b4a', '#ffd93b', '#ffffff', '#c58bff'],
      speed: 700,
      life: 1.1,
      size: 9,
      gravity: 620,
      glow: true,
      jitter: 30,
    });
    this.particles.burst(p.x, p.y, 18, {
      colour: '#e6e9f5',
      speed: 260,
      life: 1.6,
      size: 30,
      kind: 'smoke',
      gravity: -30,
      drag: 1.8,
    });
    const metres = this.score.metres;
    const sum = this.score.summary();
    const charId = this.characterId;
    const sa = this.save?.data;
    const prevBest = sa?.records?.best?.[charId]?.distance || 0;
    const newBest = metres > (sa?.records?.distance || 0);
    const newCharBest = metres > prevBest;
    const coinPayout = Math.floor(sum.coins + metres * ECONOMY.starCoinPerMeter + (newBest ? 50 : 0));
    const bonus = newCharBest ? Math.max(0, Math.floor(metres / 25)) : 0;
    this.summary = {
      ...sum,
      cause,
      character: charId,
      metres,
      coinsEarned: coinPayout + bonus,
      newBest,
      newCharBest,
      perfectLaunch: this.perfectLaunch,
      floorReached: floorName(metres),
      boostsUsed: this.runStats.boosts,
      springs: this.runStats.springs,
      skills: this.runStats.skills,
    };
    // A tiny slow-motion beat makes the failure feel like comedy, not lag.
    this.slowmo = 0.5;
  }

  checkRegionChange() {
    const region = regionAt(this.score.metres);
    if (this.lastRegion !== region.id) {
      if (this.lastRegion) {
        this.addFloater(regionLabel(region, false), this.player.x + 420, this.player.y - 240, region.hue, 34, 2.6, true);
        this.audio?.sfx('ding', { pitch: 1.1, volume: 0.8 });
        this.camera.addShake(0.2);
        this.particles.burst(this.player.x + 200, this.player.y - 120, 26, {
          colour: [region.hue, '#ffffff'], speed: 420, life: 1, size: 8, gravity: -30, glow: true, kind: 'star',
        });
      }
      this.lastRegion = region.id;
      this.onEvent('region', region);
    }
  }

  // ---------------------------------------------------------------- effects
  addFloater(text, x, y, colour = '#fff', size = 24, life = 1, big = false) {
    this.floaters.push({ text, x, y, colour, size, life, maxLife: life, vy: -62, big });
    if (this.floaters.length > 26) this.floaters.shift();
  }

  updateFloaters(dt) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 1 - damp(1.6, dt);
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  updateEffects(dt) {
    this.screenFlash = Math.max(0, (this.screenFlash || 0) - dt * 3.2);
    this.slowmo = Math.max(0, this.slowmo - dt);
    if (this.audio) {
      this.audio.sfxVolume = 1;
    }
  }

  get region() {
    return regionAt(this.state === 'launch' ? 0 : this.score.metres);
  }

  get distanceLabel() {
    return formatMeters(this.score.metres);
  }

  /** Data for the minimap. */
  minimapData() {
    if (!this.player) return null;
    const px = this.player.x;
    const span = 5200;
    const pads = [];
    for (const chunk of this.world.chunksNear(px, 0, 3)) {
      for (const pad of chunk.pads) {
        if (pad.rescue) continue;
        if (pad.x > px - 400 && pad.x < px + span) pads.push({ x: pad.x, y: pad.y });
      }
    }
    return {
      playerX: px,
      playerY: this.player.y,
      vx: this.player.vx,
      pads,
      span,
      metres: this.score.metres,
      region: this.region,
      regions: REGIONS,
    };
  }
}

function floorName(metres) {
  return regionAt(metres).short;
}
