/** Cinematic side-scrolling camera: leads to the right, smooth, never jitters. */
import { CAMERA } from '../config/config.js';
import { clamp, clamp01, damp, lerp } from '../core/mathx.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.baseZoom = 1;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.vw = 1600;
    this.vh = 900;
    this.leadX = 0;
    this.zoomPulse = 0;
    this.angle = 0;
    this.reduceShake = false;
  }

  setViewport(w, h, baseZoom) {
    this.vw = w;
    this.vh = h;
    this.baseZoom = baseZoom;
  }

  snapTo(px, py) {
    this.x = px + this.vw * 0.16;
    this.y = py - this.vh * 0.06;
    this.zoom = this.baseZoom;
    this.targetZoom = this.baseZoom;
    this.shake = 0;
  }

  addShake(amount) {
    if (this.reduceShake) amount *= 0.35;
    this.shake = Math.min(1.4, this.shake + amount);
  }

  pulseZoom(amount) {
    this.zoomPulse = Math.min(0.09, this.zoomPulse + amount);
  }

  update(dt, player, opts = {}) {
    const speed = Math.max(0, player.vx);
    const lead = clamp(speed * CAMERA.lookAhead * 0.32, 0, CAMERA.lookAheadMax);
    this.leadX += (lead - this.leadX) * damp(2.4, dt);
    // Aim point: player is kept left-of-centre with room to read what is coming.
    const aimX = player.x + this.leadX + this.vw * 0.055;
    const aimY = player.y + clamp(player.vy * 0.11, -140, 190);
    this.x += (aimX - this.x) * damp(CAMERA.smoothX, dt);
    this.y += (aimY - this.y) * damp(CAMERA.smoothY, dt);

    const speedZoom = clamp01((speed - 900) / 1800) * 0.055;
    this.targetZoom = this.baseZoom * (1 - speedZoom - this.zoomPulse);
    if (opts.zoomOut) this.targetZoom *= 0.96;
    this.zoom += (this.targetZoom - this.zoom) * damp(CAMERA.zoomSpeed, dt);
    this.zoomPulse *= 1 - damp(3.4, dt);

    this.shake *= 1 - damp(CAMERA.shakeDecay, dt);
    if (this.shake < 0.002) this.shake = 0;
    const s = this.shake * this.shake * 26;
    this.shakeX = (Math.random() * 2 - 1) * s;
    this.shakeY = (Math.random() * 2 - 1) * s;
  }

  get left() {
    return this.x - this.vw / 2;
  }
  get top() {
    return this.y - this.vh / 2;
  }

  applyTo(ctx, w, h) {
    const z = this.zoom;
    ctx.setTransform(z, 0, 0, z, w / 2 - this.x * z + this.shakeX, h / 2 - this.y * z + this.shakeY);
  }

  worldToScreen(wx, wy, w, h) {
    const z = this.zoom;
    return {
      x: (wx - this.x) * z + w / 2 + this.shakeX,
      y: (wy - this.y) * z + h / 2 + this.shakeY,
    };
  }

  visibleWidth() {
    return this.vw / this.zoom;
  }
  visibleHeight() {
    return this.vh / this.zoom;
  }
}

export function zoomForViewport(cssW, cssH) {
  // Show at least ~1450 world-px horizontally and ~820 vertically so incoming
  // pads and loot are always readable before they arrive.
  const z = Math.min(cssW / 1480, cssH / 800);
  return clamp(z, 0.5, 1.45);
}
