/**
 * Arcade physics. Real velocities, real impulses, no fake animation-driven motion.
 * Fixed timestep + swept collision so a 3000 px/s boost cannot tunnel a springboard.
 */
import { PHYS } from '../config/config.js';
import { clamp, closestOnSegment } from '../core/mathx.js';

export function applyDrag(p, dt, dragMul = 1) {
  const speed = Math.abs(p.vx);
  const over = speed - PHYS.vxDragFloor;
  if (over > 0) p.vx -= Math.sign(p.vx) * PHYS.vxDrag * over * dragMul * dt;
  // gentle global damping so flight never becomes a rocket that never slows
  p.vx *= 1 - 0.02 * dragMul * dt;
}

export function applyGravity(p, dt, gravityMul = 1, extra = 0) {
  const g = Math.min(PHYS.gravityCap, PHYS.gravity * gravityMul + extra);
  p.vy = Math.min(PHYS.maxFallSpeed, p.vy + g * dt);
}

export function clampSpeed(p, cap) {
  const c = cap || PHYS.maxVx;
  if (p.vx > c) p.vx = c;
  if (p.vx < -c * 0.72) p.vx = -c * 0.72;
  if (p.vy < -PHYS.maxVyUp) p.vy = -PHYS.maxVyUp;
  if (p.vy > PHYS.maxFallSpeed) p.vy = PHYS.maxFallSpeed;
}

/**
 * Swept circle vs. oriented segment (a "pad"). Movement is split into short
 * sub-steps of PHYS.subStepLen px so nothing is ever missed.
 * Returns null or { nx, ny, cx, cy, speed } describing the first contact.
 */
export function sweptCircleSegment(x0, y0, x1, y1, r, seg, thickness = 10) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const travel = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.min(24, Math.ceil(travel / PHYS.subStepLen)));
  const R = r + thickness;
  const ax = seg.x1;
  const ay = seg.y1;
  const bx = seg.x2;
  const by = seg.y2;
  let prevX = x0;
  let prevY = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    const hit = closestOnSegment(px, py, ax, ay, bx, by);
    if (hit.d <= R) {
      // Choose a stable normal: pad's own normal if the contact is close to the
      // segment spine, otherwise the radial direction from the closest point.
      let nx = seg.nx ?? 0;
      let ny = seg.ny ?? -1;
      const radialX = px - hit.x;
      const radialY = py - hit.y;
      const rl = Math.hypot(radialX, radialY) || 1;
      const dot = (radialX / rl) * nx + (radialY / rl) * ny;
      if (dot < 0.35) {
        nx = radialX / rl;
        ny = radialY / rl;
      }
      const len = Math.hypot(nx, ny) || 1;
      return {
        nx: nx / len,
        ny: ny / len,
        cx: hit.x,
        cy: hit.y,
        px,
        py,
        prevX,
        prevY,
        speed: travel,
      };
    }
    prevX = px;
    prevY = py;
  }
  return null;
}

export function reflect(p, nx, ny, restitution, tangentFriction = 0.06) {
  const vn = p.vx * nx + p.vy * ny;
  if (vn >= 0) return 0;
  const vtx = p.vx - vn * nx;
  const vty = p.vy - vn * ny;
  const newVn = -vn * restitution;
  p.vx = vtx * (1 - tangentFriction) + nx * newVn;
  p.vy = vty * (1 - tangentFriction) + ny * newVn;
  return -vn; // impact speed
}

/** AABB-ish overlap used for pickups (generous, never jittery). */
export function pickupOverlap(px, py, r, item, extra = 0) {
  const rr = r + (item.r || 24) + extra;
  const dx = px - item.x;
  const dy = py - item.y;
  return dx * dx + dy * dy <= rr * rr;
}

export function clampVel(v, lo, hi) {
  return clamp(v, lo, hi);
}
