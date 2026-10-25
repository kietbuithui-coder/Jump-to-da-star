/**
 * Pooled particle system with a hard budget. No allocation per frame,
 * no unbounded growth over a 40-minute flight.
 */
import { clamp01 } from '../core/mathx.js';

const MAX_PARTICLES = 900;

export class Particles {
  constructor() {
    this.pool = new Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 4,
        colour: '#fff',
        kind: 'spark',
        gravity: 0,
        drag: 1,
        rot: 0,
        vr: 0,
        glow: false,
        alpha: 1,
      };
    }
    this.cursor = 0;
    this.budget = 1;
    this.count = 0;
  }

  clear() {
    for (const p of this.pool) p.active = false;
    this.count = 0;
  }

  spawn(cfg) {
    if (this.budget <= 0) return null;
    const max = Math.floor(MAX_PARTICLES * clamp01(this.budget));
    for (let i = 0; i < max; i++) {
      this.cursor = (this.cursor + 1) % max;
      const p = this.pool[this.cursor];
      if (p.active) continue;
      p.active = true;
      p.x = cfg.x;
      p.y = cfg.y;
      p.vx = cfg.vx || 0;
      p.vy = cfg.vy || 0;
      p.maxLife = cfg.life || 0.6;
      p.life = p.maxLife;
      p.size = cfg.size || 4;
      p.colour = cfg.colour || '#fff';
      p.kind = cfg.kind || 'spark';
      p.gravity = cfg.gravity || 0;
      p.drag = cfg.drag ?? 1.6;
      p.rot = cfg.rot || 0;
      p.vr = cfg.vr || 0;
      p.glow = !!cfg.glow;
      p.alpha = cfg.alpha ?? 1;
      this.count++;
      return p;
    }
    return null;
  }

  burst(x, y, count, cfg = {}) {
    const n = Math.round(count * (0.4 + 0.6 * this.budget));
    for (let i = 0; i < n; i++) {
      const a = cfg.angle != null ? cfg.angle + (Math.random() - 0.5) * (cfg.spread || 0.8) : Math.random() * Math.PI * 2;
      const sp = (cfg.speed || 300) * (0.35 + Math.random() * 0.9);
      this.spawn({
        x: x + (Math.random() - 0.5) * (cfg.jitter || 0),
        y: y + (Math.random() - 0.5) * (cfg.jitter || 0),
        vx: Math.cos(a) * sp + (cfg.biasX || 0),
        vy: Math.sin(a) * sp + (cfg.biasY || 0),
        life: (cfg.life || 0.6) * (0.6 + Math.random() * 0.8),
        size: (cfg.size || 5) * (0.6 + Math.random() * 0.9),
        colour: Array.isArray(cfg.colour)
          ? cfg.colour[Math.floor(Math.random() * cfg.colour.length)]
          : cfg.colour || '#fff',
        kind: cfg.kind || 'spark',
        gravity: cfg.gravity ?? 900,
        drag: cfg.drag ?? 1.2,
        glow: cfg.glow,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  update(dt) {
    this.count = 0;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const d = 1 / (1 + p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      this.count++;
    }
  }

  draw(ctx, cam) {
    const left = cam.left - 120;
    const right = cam.left + cam.visibleWidth() + 120;
    const top = cam.top - 120;
    const bottom = cam.top + cam.visibleHeight() + 120;
    ctx.save();
    for (const p of this.pool) {
      if (!p.active) continue;
      if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue;
      const t = clamp01(p.life / p.maxLife);
      const alpha = t * p.alpha;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.colour;
      if (p.glow) {
        ctx.shadowColor = p.colour;
        ctx.shadowBlur = p.size * 2.4;
      } else {
        ctx.shadowBlur = 0;
      }
      switch (p.kind) {
        case 'ring': {
          ctx.globalAlpha = alpha * 0.7;
          ctx.strokeStyle = p.colour;
          ctx.lineWidth = Math.max(1, p.size * 0.14 * t);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.6 - t * 1.2), 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'smoke': {
          ctx.globalAlpha = alpha * 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.5 - t * 0.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'star': {
          drawStar(ctx, p.x, p.y, p.size * (0.5 + t * 0.8), p.rot);
          break;
        }
        case 'streak': {
          ctx.globalAlpha = alpha * 0.85;
          ctx.lineWidth = p.size * 0.5;
          ctx.strokeStyle = p.colour;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
          break;
        }
        default: {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.35 + t * 0.75), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}

function drawStar(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export { MAX_PARTICLES };
