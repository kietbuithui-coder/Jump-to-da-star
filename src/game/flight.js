/**
 * One ballistic step. Shared by the live player and the test autopilot so the
 * "can this level be flown?" guarantee is measured with the real integrator.
 */
import { applyDrag, applyGravity, clampSpeed } from './physics.js';
import { PHYS } from '../config/config.js';

export function stepFlight(p, dt, opts = {}) {
  const gravityMul = opts.gravityMul ?? 1;
  const dragMul = opts.dragMul ?? 1;
  applyGravity(p, dt, gravityMul, opts.extraGravity || 0);
  applyDrag(p, dt, dragMul);
  if (opts.fallCap != null && p.vy > opts.fallCap) p.vy = opts.fallCap;
  clampSpeed(p, opts.vxCap || PHYS.maxVx);
}
