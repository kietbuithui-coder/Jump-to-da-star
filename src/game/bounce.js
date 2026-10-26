/**
 * Shared pad-bounce resolution.
 *
 * Design rules that make endless flight fair:
 *  - A support pad launches you along its normal with a FIXED speed
 *    (`fixedUp`), scaled only by the character's bounce stat. Your entry angle
 *    changes the direction, never the energy. No bounce chains, no runaway.
 *  - Tangential speed is preserved (minus a little friction), so speed you
 *    earned with boosts/rockets carries through the bounce.
 *  - The world generator calls this exact function with the exact character
 *    stats, so its reference route IS the player's route.
 */
import { PHYS } from '../config/config.js';
import { clamp } from '../core/mathx.js';

export function resolvePadBounce(def, vx, vy, nx, ny, mul = 1, opts = {}) {
  const vn = vx * nx + vy * ny;
  if (vn >= 0.5) return null; // moving away from the pad: no bounce
  const friction = def.id === 'ice' ? 0.01 : 0.06;
  const bounceMul = opts.bounceMul ?? 1;
  const up = (def.fixedUp ?? 1200) * bounceMul * (0.55 + 0.45 * mul);
  const vtx = vx - vn * nx;
  const vty = vy - vn * ny;
  let outVx = vtx * (1 - friction) + nx * up;
  let outVy = vty * (1 - friction) + ny * up;
  if (def.vxBonus) outVx += def.vxBonus * mul * (opts.itemMul ?? 1);
  const minVx = opts.minVx ?? 0;
  if (minVx > 0 && outVx < minVx) outVx = minVx;
  return {
    vx: clamp(outVx, -PHYS.maxVx * 0.8, PHYS.maxVx),
    vy: clamp(outVy, -PHYS.maxVyUp, PHYS.maxFallSpeed),
  };
}

/** Default catch field: pads grab descending players a little below the surface. */
export const PAD_CATCH = 120;

/**
 * One-way pad contact resolution (shared by the game and the test autopilot).
 *
 * Pads have a designed normal and act like trampolines: you land on the front
 * face, you pass through from behind. A shallow "catch field" below the surface
 * gives generous timing without ever feeling magnetic.
 */
export function padContact(p, x0, y0, radius, pads) {
  let best = null;
  for (const pad of pads) {
    const nx = pad.nx ?? 0;
    const ny = pad.ny ?? -1;
    const dPrev = (x0 - pad.x) * nx + (y0 - pad.y) * ny;
    const dNow = (p.x - pad.x) * nx + (p.y - pad.y) * ny;
    if (!(dNow < dPrev)) continue; // must be moving toward/through the pad face
    const vn = p.vx * nx + p.vy * ny;
    if (vn >= 0) continue;
    const cos = Math.cos(pad.angle || 0);
    const sin = Math.sin(pad.angle || 0);
    const along = (p.x - pad.x) * cos + (p.y - pad.y) * sin;
    const mushroom = pad.id === 'mushroom';
    // The mushroom cap is drawn ~32 px above pad.y. Require an actual swept
    // crossing of that visible top, not the support pad's 170px magnet zone.
    // Test the X position AT IMPACT, not at the end of a fast physics step.
    const surface = radius + (mushroom ? 32 : 4);
    if (mushroom) {
      // Swept circle against the visible cap. Reject the old invisible
      // 170 px catch field, but retain genuine side and fast-frame contacts.
      const bottom = -radius - 8;
      if (dNow > surface || dPrev < bottom) continue;
      const span = dPrev - dNow;
      const first = Math.max(0, Math.min(1, (dPrev - surface) / span));
      const last = Math.max(0, Math.min(1, (dPrev - bottom) / span));
      const previousAlong = (x0 - pad.x) * cos + (y0 - pad.y) * sin;
      const stepAlong = along - previousAlong;
      const nearestT = Math.max(first, Math.min(last, stepAlong ? -previousAlong / stepAlong : first));
      const closestAlong = previousAlong + stepAlong * nearestT;
      if (Math.abs(closestAlong) > (pad.w ?? 250) / 2 + radius * 1.1) continue;
    } else {
      const halfW = pad.w / 2 + radius * 0.3;
      if (Math.abs(along) > halfW) continue;
      const catchDepth = pad.catch ?? 0;
      if (dNow > surface + catchDepth) continue;
    }
    const depth = Math.max(0, surface - dNow);
    if (!best || depth < best.depth) {
      best = { pad, nx, ny, depth, along, surface };
    }
  }
  return best;
}
