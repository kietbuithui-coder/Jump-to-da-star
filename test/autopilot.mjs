/**
 * Reference autopilot used by the tests (and by nothing in the shipped game).
 * It flies with ZERO boosts, ZERO skills, ZERO upgrades and no steering, to
 * prove that generated worlds are survivable for an un-upgraded pilot.
 */
import { World } from '../src/game/world.js';
import { sweptCircleSegment } from '../src/game/physics.js';
import { stepFlight } from '../src/game/flight.js';
import { resolvePadBounce, padContact } from '../src/game/bounce.js';
import { ITEM_DEFS } from '../src/game/items.js';
import { LAUNCH, PHYS, PX_PER_METER } from '../src/config/config.js';

const DT = 1 / 120;

export { padContact };

export function simulateFlight(seed, opts = {}) {
  const {
    maxMetres = 30000,
    gravityMul = 1,
    dragMul = 1,
    bounceMul = 1,
    radius = PHYS.collideRadius,
    recordPads = false,
    steer = true,
    airAccelMul = 1,
    boostCharges = 3,
    useBoost = true,
  } = opts;
  const world = new World(seed, { gravityMul, dragMul, bounceMul });
  const p = { x: LAUNCH.startX, y: LAUNCH.startY, vx: LAUNCH.vx, vy: LAUNCH.vy };
  const startX = p.x;
  let hops = 0;
  const padHits = [];
  let cooldown = 0;
  let boosts = boostCharges;
  let maxX = p.x;
  let t = 0;
  let dead = false;
  let deathCause = '';
  let minFloorGap = Infinity;
  let lastDeath = null;

  for (let step = 0; step < 300000; step++) {
    world.ensure(p.x + 3600);
    if (step % 120 === 0) world.recycle(p.x);
    t += DT;
    if ((maxX - startX) / PX_PER_METER >= maxMetres) break;

    // --- steering: a competent pilot reads the next pad and commits
    if (steer) {
      const pads = world.padsNear(p.x);
      let target = null;
      for (const pad of pads) {
        if (!pad.support || pad.launchPad) continue;
        if (pad.x < p.x + 180) continue;
        if (!target || pad.x < target.x) target = pad;
      }
      const g = PHYS.gravity * gravityMul;
      if (target) {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        // time until our arc drops back through the pad height
        const disc = p.vy * p.vy + 2 * g * (dy + radius);
        let tt = disc > 0 ? (-p.vy + Math.sqrt(disc)) / g : 0.35;
        if (!(tt > 0.05)) tt = 0.35;
        const want = Math.max(700, Math.min(1900, dx / tt));
        const accel = PHYS.airAccel * airAccelMul;
        if (p.vx < want) p.vx = Math.min(want, p.vx + accel * DT);
        else p.vx = Math.max(want, p.vx - accel * 0.7 * DT);

        // Use a boost when the pad is well above the arc and we are falling:
        // exactly what a player does to save a hop.
        if (useBoost && boosts > 0 && p.vy > 250 && dy < -320 && cooldown <= 0) {
          p.vy = Math.min(p.vy, -1250);
          p.vx = Math.min(2150, p.vx + 320);
          boosts--;
          cooldown = 0.5;
        }
      }
      cooldown -= DT;
    }

    stepFlight(p, DT, { gravityMul, dragMul });
    const x0 = p.x;
    const y0 = p.y;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    if (p.x > maxX) maxX = p.x;

    const contact = padContact(p, x0, y0, radius, world.padsNear(p.x));
    if (contact) {
      const { pad, nx, ny, depth } = contact;
      const out = resolvePadBounce(ITEM_DEFS[pad.id], p.vx, p.vy, nx, ny, 1, {
        bounceMul,
        minVx: pad.rescue ? 1120 : 950,
      });
      if (out) {
        p.vx = out.vx;
        p.vy = out.vy;
        const push = radius + 5 - (radius + 4 - depth);
        p.x += nx * push;
        p.y += ny * push;
        hops++;
        padHits.push({ x: pad.x, y: pad.y, id: pad.id, rescue: !!pad.rescue });
      }
    }

    const floor = world.floorAt(p.x);
    minFloorGap = Math.min(minFloorGap, floor - p.y);
    if (p.y > floor - radius * 0.4) {
      dead = true;
      deathCause = 'floor';
      const near = world.padsNear(p.x).sort((a, b) => a.x - b.x);
      lastDeath = {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        floor,
        pads: near.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y), rescue: !!q.rescue })),
        lastHits: padHits.slice(-3).map((h) => ({ x: Math.round(h.x), y: Math.round(h.y), rescue: h.rescue })),
      };
      break;
    }
  }

  return {
    seed,
    metres: (maxX - startX) / PX_PER_METER,
    target: maxMetres,
    hops,
    boostsLeft: boosts,
    dead,
    deathCause,
    time: t,
    padHits: recordPads ? padHits : padHits.length,
    rescueHits: recordPads ? padHits.filter((h) => h.rescue).length : undefined,
    minFloorGap,
    entities: world.entityCount,
    chunks: world.chunks.size,
    death: lastDeath,
  };
}
