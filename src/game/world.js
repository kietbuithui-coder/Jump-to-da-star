/**
 * PHYSICS-AWARE PROCEDURAL WORLD
 *
 * The generator does not scatter random objects and hope. It flies the level
 * before the player does: a reference pilot is simulated forward with the exact
 * same gravity/drag model, and every support pad is placed *on* that simulated
 * arc. The chain is therefore always physically reachable with ZERO boosts,
 * ZERO skill usage and ZERO upgrades — a base-line guarantee, not a lucky roll.
 *
 * Around that guaranteed line the generator lays out optional loot lanes,
 * risky high lines, rescue nets and hazards, scaled by distance.
 */
import { PHYS, WORLD, PX_PER_METER, LAUNCH, regionAt } from '../config/config.js';
import { RNG, clamp, clamp01 } from '../core/mathx.js';
import { ITEM_DEFS, REGION_ITEMS } from './items.js';
import { resolvePadBounce } from './bounce.js';

const SIM_DT = 1 / 120;
const SUPPORT_MIN_UP = 1250; // guarantees height on every support pad
const SUPPORT_MIN_VX = 950; // and a forward kick
const SUPPORT_CLEARANCE = 52; // player sits one radius above the pad surface
const DEBUG = false;

function integrateArc(state, dt, gravityMul = 1, dragMul = 1) {
  state.vy += PHYS.gravity * gravityMul * dt;
  const speed = Math.abs(state.vx);
  if (speed > PHYS.vxDragFloor) {
    state.vx -= Math.sign(state.vx) * PHYS.vxDrag * (speed - PHYS.vxDragFloor) * dragMul * dt;
  }
  state.vx *= 1 - 0.02 * dragMul * dt;
  state.vy = Math.min(state.vy, PHYS.maxFallSpeed);
  state.x += state.vx * dt;
  state.y += state.vy * dt;
  state.t += dt;
}

export class World {
  /**
   * @param {number} seed
   * @param {{gravityMul?:number, dragMul?:number, bounceMul?:number, itemMul?:number}} flight
   *        the current character's flight model — the reference route is flown
   *        with these numbers so the generated level matches this pilot exactly.
   */
  constructor(seed = 1, flight = {}) {
    this.seed = seed >>> 0;
    this.flight = {
      gravityMul: flight.gravityMul ?? 1,
      dragMul: flight.dragMul ?? 1,
      bounceMul: flight.bounceMul ?? 1,
      itemMul: flight.itemMul ?? 1,
    };
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed >>> 0;
    this.rng = new RNG(this.seed);
    this.chunks = new Map();
    this.chunkWidth = WORLD.chunkWidth;
    this.floorPoints = [];
    this.nodeIndex = 0;
    this.startX = LAUNCH.startX;
    this.route = {
      x: LAUNCH.startX,
      y: LAUNCH.startY - 40,
      vx: LAUNCH.vx,
      vy: LAUNCH.vy,
      t: 0,
    };
    this.generatedX = LAUNCH.startX;
    this.baseline = this.route.y;
    this.lastPad = null;
    this.trace = [];
    this._lastRecycleCi = null;
    this._register({
      id: 'spring',
      kind: 'pad',
      x: LAUNCH.startX + 120,
      y: 120,
      angle: 0,
      w: 320,
      nx: 0,
      ny: -1,
      r: 28,
      node: -1,
      launchPad: true,
    });
    this._addFloorPoint(this.route.x - 1400, 900);
    this._addFloorPoint(this.route.x, 880);
    this.ensure(this.route.x + WORLD.spawnAhead);
  }

  // ---------------------------------------------------------------- chunks
  chunkIndexAt(x) {
    return Math.floor((x - this.startX) / this.chunkWidth);
  }

  chunkAt(index) {
    let c = this.chunks.get(index);
    if (!c) {
      const region = regionAt(Math.max(0, (index * this.chunkWidth) / PX_PER_METER));
      c = {
        index,
        x0: this.startX + index * this.chunkWidth,
        x1: this.startX + (index + 1) * this.chunkWidth,
        region: region.id,
        floorY: 900,
        pads: [],
        items: [],
        hazards: [],
        zones: [],
        decor: [],
        built: false,
      };
      this.chunks.set(index, c);
    }
    return c;
  }

  _addFloorPoint(x, y) {
    const py = clamp(y, WORLD.floorMinY, WORLD.floorMaxY);
    this.floorPoints.push({ x, y: py });
  }

  /** Hazard floor height at world x (piecewise linear, smooth between points). */
  floorAt(x) {
    const pts = this.floorPoints;
    if (!pts.length) return 900;
    if (x <= pts[0].x) return pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i].x) {
        const a = pts[i - 1];
        const b = pts[i];
        const t = (x - a.x) / Math.max(1, b.x - a.x);
        return a.y + (b.y - a.y) * t;
      }
    }
    return pts[pts.length - 1].y;
  }

  // ------------------------------------------------------------- generation
  /** Generate until at least `targetX` exists in the world. */
  ensure(targetX) {
    let guard = 0;
    while (this.generatedX < targetX && guard++ < 800) this._planHop();
    this._buildChunkDecor();
  }

  _difficultyAt(x) {
    const m = Math.max(0, (x - this.startX) / PX_PER_METER);
    return clamp(regionAt(m).difficulty + clamp((m - 15000) / 90000, 0, 0.25), 0, 1.2);
  }

  _densityAt(x) {
    const m = Math.max(0, (x - this.startX) / PX_PER_METER);
    // Region flavour × a long-haul falloff: Shapi's lab is generous, the Star
    // Frontier is a wasteland where every orb matters.
    const falloff = 1 / (1 + Math.max(0, m - 500) / 7000);
    return regionAt(m).density * falloff;
  }

  _planHop() {
    const route = this.route;
    const prevX = route.x;
    const region = regionAt(Math.max(0, (route.x - this.startX) / PX_PER_METER));
    const diff = this._difficultyAt(route.x);
    const rng = this.rng;

    const metres = Math.max(0, (route.x - this.startX) / PX_PER_METER);
    // The launch lab is deliberately forgiving: wider pads, shorter hops, no
    // tilt. The ramp fades out by ~700 m so the real game starts after.
    const easing = clamp01(1 - metres / 700);
    // Late-run scarcity: the far frontier really is emptier.
    const late = clamp01((metres - 3000) / 14000);
    const maxHop = Math.min(
      3100,
      (WORLD.routeStep + WORLD.routeStepVariance * (rng.next() * 2 - 1) + diff * 260) * (1 - easing * 0.22),
    );

    // The corridor waves up and down inside a fixed band. `drop` is measured
    // from the current flight line, so consecutive pads step vertically by
    // exactly this amount — that is how the whole route is kept inside a band.
    const wave =
      Math.sin(this.nodeIndex * 0.42) * WORLD.waveAmp + Math.sin(this.nodeIndex * 0.13) * WORLD.waveAmp2;
    // Climb into the new upper atmosphere gradually over ~5.5 km. The support
    // chain still uses the same real physics and per-hop dropMax, so pads never
    // teleport vertically or require an impossible jump.
    const heightT = clamp01((metres - 100) / 5500);
    const gradualRise = 3200 * heightT * heightT * (3 - 2 * heightT);
    const desiredY = WORLD.routeBaseY - gradualRise + wave + rng.range(-150, 150) + diff * 60;
    const dropMax = WORLD.dropMax * (1 - easing * 0.35);
    const drop = clamp(desiredY - (route.y - 30), -dropMax, dropMax);

    // ---- 1. fly the reference arc
    const sim = { x: route.x, y: route.y, vx: route.vx, vy: route.vy, t: 0 };
    const startY = sim.y;
    const samples = [{ x: sim.x, y: sim.y }];
    let nextSampleX = sim.x + 150;
    let guard = 0;
    while (guard++ < 2400) {
      integrateArc(sim, SIM_DT, this.flight.gravityMul, this.flight.dragMul);
      if (sim.x >= nextSampleX) {
        samples.push({ x: sim.x, y: sim.y });
        nextSampleX = sim.x + 150;
      }
      const descended = sim.vy >= 0 && sim.y - startY >= drop;
      const tooFar = sim.x - route.x >= maxHop && sim.vy >= 0 && sim.y > startY + 150;
      if (descended || tooFar) break;
    }
    if (guard >= 2400) {
      sim.x = route.x + 820;
      sim.y = startY + 380;
      sim.vx = Math.max(sim.vx, 900);
      sim.vy = 380;
    }

    // ---- 2. pick a support pad appropriate to the region
    const pool = REGION_ITEMS[region.id] || REGION_ITEMS.lab;
    const padId = rng.pick(pool.pads);
    const def = ITEM_DEFS[padId];
    let tilt = rng.chance(0.34 * (1 - easing)) ? rng.range(-0.15, 0.15) : 0;
    const padX = sim.x;
    // In the upper sky, the exact mushroom cap is more restrictive than the
    // former 170px catch zone; lower the support cap slightly so the physics
    // reference route remains reachable without an invisible bounce.
    const padY = sim.y + (padId === 'mushroom' && metres > 4500 ? 120 : 0);
    const width = def.width * (0.94 + rng.next() * 0.28) * (1 + easing * 0.4);
    let nx = Math.sin(tilt);
    let ny = -Math.cos(tilt);

    // A tilted pad can be "moving away" from a fast horizontal reference.
    // Fall back to a flat pad so the reference bounce is always defined.
    if (resolvePadBounce(def, sim.vx, sim.vy, nx, ny, 1, { bounceMul: this.flight.bounceMul }) == null) {
      tilt = 0;
      nx = 0;
      ny = -1;
    }

    this._register({
      id: padId,
      kind: 'pad',
      x: padX,
      y: padY,
      angle: tilt,
      w: width,
      nx,
      ny,
      r: 26,
      node: this.nodeIndex,
      support: true,
      catch: 170,
    });

    // ---- 3. reference velocity after the bounce (identical math to the player)
    const out = resolvePadBounce(def, sim.vx, sim.vy, nx, ny, 1, {
      bounceMul: this.flight.bounceMul,
      minVx: SUPPORT_MIN_VX,
      itemMul: this.flight.itemMul,
    }) || { vx: Math.max(sim.vx, SUPPORT_MIN_VX), vy: -SUPPORT_MIN_UP };
    route.x = padX;
    route.y = padY - SUPPORT_CLEARANCE;
    route.vx = out.vx;
    route.vy = out.vy;
    route.t = 0;
    this.baseline = this.baseline * 0.8 + route.y * 0.2;
    this.lastPad = { x: padX, y: padY };

    // The hazard floor tracks the flight corridor so the danger is always
    // visible on screen, but stays far enough below to be survivable.
    this._addFloorPoint(padX, padY + 560 + rng.range(-80, 110));

    // ---- 4. loot along the reference arc (sparse, on the natural flight line)
    const density = this._densityAt(padX);
    // Loot also spreads out physically with distance: same clusters, further apart.
    const thinOut = 1 + clamp01((metres - 700) / 22000) * 2.4;
    const heightAboveLaunch = Math.max(0, LAUNCH.startY - padY);
    // Loot becomes progressively less common at altitude as well as distance.
    // A continuous falloff avoids a visible "everything disappears" boundary.
    const skyThinOut = 1 + 1.1 * (heightAboveLaunch / (heightAboveLaunch + 2800));
    const spacing = (340 / Math.max(0.24, density)) * thinOut * skyThinOut;
    let acc = rng.range(0, spacing);
    for (let i = 1; i < samples.length; i++) {
      const s = samples[i];
      if (s.x > padX - 260) break;
      acc += 150;
      if (acc < spacing) continue;
      acc = 0;
      // Loot thins out with distance: ~1 cluster per hop early, much sparser late.
      const visible = rng.next() < 0.12 + 0.5 * Math.min(1, density * 1.6);
      if (!visible) continue;
      const roll = rng.next();
      let id = 'orb';
      if (roll > 0.982 && this.nodeIndex > 2) id = 'boostStar';
      else if (roll > 0.94) id = 'super';
      else if (roll > 0.82) id = 'comboOrb';
      else if (roll > 0.56) id = 'coin';
      this._register({
        id,
        kind: 'pickup',
        x: s.x + rng.range(-26, 26),
        y: s.y + rng.range(-44, 30),
        r: ITEM_DEFS[id].r,
        bob: rng.range(0, 6.28),
      });
    }

    // ---- 5. risky high line: better loot that needs a boost or a skill to reach
    if (this.nodeIndex > 1 && rng.chance(0.3 * (0.5 + diff) * (1 - late * 0.55))) {
      const count = Math.max(1, Math.round(rng.int(2, 4) * (1 - late * 0.4)));
      const baseX = padX - rng.range(760, 1120);
      for (let i = 0; i < count; i++) {
        const roll = rng.next();
        const id = roll < 0.42 ? 'super' : roll < 0.78 ? 'comboOrb' : 'orb';
        const x = baseX + i * rng.range(110, 170);
        this._register({
          id,
          kind: 'pickup',
          x,
          y: padY + rng.range(-560, -380),
          r: ITEM_DEFS[id].r,
          bob: rng.range(0, 6.28),
          high: true,
        });
      }
    }

    // ---- 6. a tool: booster / buff / gate / ride near the line (not every hop)
    if (rng.chance(0.74 * (1 - late * 0.3))) {
      const midX = (padX + prevX) / 2 + rng.range(-180, 180);
      const choices = [];
      if (pool.boosters.length) choices.push(rng.pick(pool.boosters));
      if (pool.buffs.length) choices.push(rng.pick(pool.buffs));
      if (rng.chance(0.34)) choices.push('jetGate');
      if (rng.chance(0.22)) choices.push('ufo');
      if (rng.chance(0.3)) choices.push('battery');
      if (rng.chance(0.16)) choices.push('hotair');
      if (rng.chance(0.14)) choices.push('balloon');
      if (choices.length) {
        const id = rng.pick(choices);
        const d = ITEM_DEFS[id];
        const isZone = d.kind === 'zone';
        // Preserve RNG and all other tools: only suppress half the extra hot-air jets.
        const registerOptional = entity => {
          if (id !== 'hotair' || (this.nodeIndex + this.seed) % 2 === 0) this._register(entity);
        };
        registerOptional({
          id,
          kind: d.kind,
          x: midX,
          y: padY - 260 + (isZone ? rng.range(-140, 60) : rng.range(-80, 80)),
          r: d.r,
          angle: d.kind === 'gate' ? rng.range(-0.34, -0.12) : 0,
          bob: rng.range(0, 6.28),
        });
      }
    }

    // ---- 7. SKY SHELF: premium loot parked high above the route.
    // A normal bounce never gets there. A thermal column (or a boost chain)
    // does — that is the whole point: spend a resource, take a risk, get paid.
    if (this.nodeIndex > 1 && rng.chance(WORLD.skyChance)) {
      // Alternate potential shelf columns deterministically without consuming
      // extra RNG calls. The safe pad route and all subsequent RNG remain intact.
      const showColumn = (this.nodeIndex + this.seed) % 2 === 0;
      const registerShelf = entity => { if (showColumn) this._register(entity); };
      const sx = padX - rng.range(480, 1000);
      const skyT = clamp01((metres - 200) / 6000);
      const skyEase = skyT * skyT * (3 - 2 * skyT);
      const maxClimb = WORLD.skyMax / 3 + (WORLD.skyMax * 2 / 3) * skyEase;
      const climb = rng.range(WORLD.skyMin, maxClimb);
      const sy = padY - climb;
      const premium = rng.pick(['boostStar', 'super', 'magnet', 'coffee', 'balloon', 'parachute']);
      const def = ITEM_DEFS[premium];
      // At true high altitude, the reward trail now continues UPWARD for four
      // distinct extra tiers, not sideways across another flight lane.
      // No extra calls to the world RNG: pad placements and existing sky
      // column frequency remain identical across seeds and saved runs.
      const upperTierCount = LAUNCH.startY - sy >= 900 ? 4 : 0;
      const tierGap = 195 + 55 * skyEase;
      const height = climb + 320 + upperTierCount * tierGap;

      // thermal column from the flight line up past the shelf
      registerShelf({
        id: 'hotair',
        kind: 'zone',
        x: sx,
        y: padY - height * 0.5 + 160,
        width: 240 + 1000 * skyEase,
        height,
        upperTierCount,
        lift: ITEM_DEFS.hotair.lift + 5900 * skyEase,
        r: ITEM_DEFS.hotair.r,
        bob: 0,
        sky: true,
      });

      // breadcrumb trail climbing inside the column
      for (let i = 0; i < 3; i++) {
        registerShelf({
          id: 'orb',
          kind: 'pickup',
          x: sx + rng.range(-46, 46),
          // Breadcrumb gaps widen smoothly as the pilot rises through the plume.
          y: padY - climb * Math.pow((i + 1) / 4, 1 + 0.7 * skyEase),
          r: ITEM_DEFS.orb.r,
          bob: rng.range(0, 6.28),
          sky: true,
        });
      }
      registerShelf({
        id: premium,
        kind: def.kind,
        x: sx,
        y: sy,
        r: def.r,
        bob: rng.range(0, 6.28),
        sky: true,
        high: true,
        anchorY: padY,
      });
      // Four new vertical shelves ABOVE the old top prize (2 close-together
      // pickups per tier). Both pickups lie on the thermal's centreline,
      // within 30px horizontally, for a readable straight-up ascent.
      const upperPrizes = ['coin', 'battery', 'super', 'boostStar'];
      for (let level = 0; level < upperTierCount; level++) {
        const tierY = sy - (level + 1) * tierGap;
        const bonusId = upperPrizes[(this.nodeIndex + this.seed + level) % upperPrizes.length];
        for (const [itemId, side] of [['orb', -1], [bonusId, 1]]) {
          registerShelf({
            id: itemId,
            kind: 'pickup',
            x: sx + side * (level % 2 === 0 ? 30 : -30),
            y: tierY,
            r: ITEM_DEFS[itemId].r,
            bob: (level * 1.7 + (side + 1) * 1.4) % 6.28,
            sky: true,
            high: true,
            upperTier: level + 1,
            anchorY: padY,
          });
        }
      }
      if (rng.chance(0.4)) {
        registerShelf({
          id: 'jetGate',
          kind: 'gate',
          x: sx + rng.range(160, 340),
          y: padY - 120,
          r: ITEM_DEFS.jetGate.r,
          angle: rng.range(-0.22, -0.08), // near vertical: a second path up
          bob: 0,
          sky: true,
        });
      }
    }

    // ---- 8. hazards only outside the safe corridor
    if (diff > 0.4 && rng.chance(0.4 * diff)) {
      const hx = padX - rng.range(520, 920);
      const hy = padY + rng.range(170, 330);
      if (hy < this.floorAt(hx) - 140) {
        this._register({
          id: 'hazard',
          kind: 'hazard',
          x: hx,
          y: hy,
          r: 30,
          spin: rng.range(0, 6.28),
        });
      }
    }

    this.trace.push({
      node: this.nodeIndex,
      pad: padId,
      x: padX,
      y: padY,
      drop,
      inVx: sim.vx,
      inVy: sim.vy,
      outVx: out.vx,
      outVy: out.vy,
    });
    if (this.trace.length > 400) this.trace.shift();

    this.generatedX = padX;
    this.nodeIndex++;
  }

  /** Register an entity into its chunk (chunk arrays are the only owner). */
  _register(ent) {
    const ci = ent.chunk ?? this.chunkIndexAt(ent.x);
    const chunk = this.chunkAt(ci);
    ent.chunk = ci;
    if (ent.kind === 'pad') chunk.pads.push(ent);
    else if (ent.kind === 'hazard') chunk.hazards.push(ent);
    else if (ent.kind === 'zone') chunk.zones.push(ent);
    else chunk.items.push(ent);
    return ent;
  }

  /** Decorative props per chunk (purely visual, deterministic). */
  _buildChunkDecor() {
    const rng = this.rng;
    for (const chunk of this.chunks.values()) {
      if (chunk.built) continue;
      chunk.built = true;
      chunk.floorY = this.floorAt((chunk.x0 + chunk.x1) / 2);
      const count = 9 + Math.floor(rng.next() * 7);
      for (let i = 0; i < count; i++) {
        const x = chunk.x0 + rng.next() * this.chunkWidth;
        const floor = this.floorAt(x);
        const k = rng.next();
        let type = 'cloud';
        if (chunk.region === 'lab') type = k < 0.26 ? 'gear' : k < 0.52 ? 'sign' : k < 0.74 ? 'pipe' : 'cloud';
        else if (chunk.region === 'wilds') type = k < 0.32 ? 'mushroom' : k < 0.58 ? 'balloon' : k < 0.8 ? 'cloud' : 'island';
        else if (chunk.region === 'clouds') type = k < 0.48 ? 'cloud' : k < 0.7 ? 'airship' : k < 0.86 ? 'balloon' : 'island';
        else if (chunk.region === 'illegal') type = k < 0.32 ? 'station' : k < 0.58 ? 'robot' : k < 0.78 ? 'cloud' : 'island';
        else type = k < 0.4 ? 'asteroid' : k < 0.64 ? 'satellite' : k < 0.86 ? 'star' : 'island';
        chunk.decor.push({
          type,
          x,
          y: floor - rng.range(120, 1350),
          s: rng.range(0.6, 1.9),
          rot: rng.range(0, 6.28),
          drift: rng.range(0.4, 1.6),
          phase: rng.range(0, 6.28),
        });
      }
      for (let i = 0; i < 3; i++) {
        chunk.decor.push({
          type: 'fg',
          x: chunk.x0 + rng.next() * this.chunkWidth,
          y: this.floorAt(chunk.x0) + rng.range(0, 220),
          s: rng.range(0.7, 1.5),
          rot: 0,
          drift: 0,
          phase: rng.range(0, 6.28),
        });
      }
    }
  }

  // --------------------------------------------------------------- queries
  chunksNear(x, behind = 1, ahead = 2) {
    const out = [];
    const ci = this.chunkIndexAt(x);
    for (let i = ci - behind; i <= ci + ahead; i++) {
      const c = this.chunks.get(i);
      if (c) out.push(c);
    }
    return out;
  }

  padsNear(x) {
    const out = [];
    for (const c of this.chunksNear(x)) out.push(...c.pads);
    return out;
  }

  itemsNear(x) {
    const out = [];
    for (const c of this.chunksNear(x)) out.push(...c.items);
    return out;
  }

  zonesNear(x) {
    const out = [];
    for (const c of this.chunksNear(x)) out.push(...c.zones);
    return out;
  }

  hazardsNear(x) {
    const out = [];
    for (const c of this.chunksNear(x)) out.push(...c.hazards);
    return out;
  }

  /** Remove a collected pickup from its chunk (swap-pop, no array leaks). */
  removeItem(ent) {
    const chunk = this.chunks.get(ent.chunk);
    if (!chunk) return;
    ent.taken = true;
    const idx = chunk.items.indexOf(ent);
    if (idx >= 0) {
      chunk.items[idx] = chunk.items[chunk.items.length - 1];
      chunk.items.pop();
    }
  }

  /** Drop chunks that are far behind to keep memory flat over very long runs. */
  recycle(playerX) {
    const ci = this.chunkIndexAt(playerX);
    if (this._lastRecycleCi === ci) return;
    this._lastRecycleCi = ci;
    for (const idx of [...this.chunks.keys()]) {
      if (idx < ci - WORLD.chunkBehindKeep) this.chunks.delete(idx);
    }
  }

  get currentRegion() {
    return regionAt(Math.max(0, (this.generatedX - this.startX) / PX_PER_METER));
  }

  /** number of live entities — used by tests to prove memory stays bounded */
  get entityCount() {
    let n = 0;
    for (const c of this.chunks.values()) n += c.pads.length + c.items.length + c.hazards.length + c.zones.length + c.decor.length;
    return n;
  }
}

export function metresBetween(ax, bx) {
  return (bx - ax) / PX_PER_METER;
}

export { SUPPORT_MIN_UP, DEBUG };
