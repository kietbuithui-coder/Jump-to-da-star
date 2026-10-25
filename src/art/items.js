/** Hand-built vector art for every gameplay object (no emoji, no placeholders). */
import { PAL, rr, ellipse, inked, fillPath, strokePath, starPath, linear, radial, hexA, glowDot } from './art.js';

function shine(ctx, x, y, r, a = 0.85) {
  fillPath(ctx, () => ellipse(ctx, x, y, r, r * 0.7, -0.5), PAL.white, a);
}

export function drawItemArt(ctx, id, t = 0, opts = {}) {
  const scale = opts.scale || 1;
  ctx.save();
  ctx.scale(scale, scale);
  switch (id) {
    case 'orb': {
      glowDot(ctx, 0, 0, 34, '#3fd0ff', 0.55);
      inked(ctx, () => ellipse(ctx, 0, 0, 15, 15), linear(ctx, -12, -12, 12, 12, [[0, '#d7fbff'], [0.5, '#7ee8ff'], [1, '#2fa8d8']]), { stroke: '#0d4d78', width: 3 });
      fillPath(ctx, () => ellipse(ctx, 0, 0, 8, 8), hexA('#ffffff', 0.5));
      shine(ctx, -5, -5, 4);
      ctx.save();
      ctx.rotate(t * 2);
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2);
      }, hexA('#bff7ff', 0.7), 2);
      ctx.restore();
      break;
    }
    case 'super': {
      glowDot(ctx, 0, 0, 48, '#ffb020', 0.6);
      ctx.save();
      ctx.rotate(Math.sin(t * 1.4) * 0.15);
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(18, -10);
        ctx.lineTo(14, 16);
        ctx.lineTo(0, 25);
        ctx.lineTo(-14, 16);
        ctx.lineTo(-18, -10);
        ctx.closePath();
      }, linear(ctx, -18, -24, 18, 25, [[0, '#fff6b0'], [0.45, '#ffd93b'], [1, '#ff9f1c']]), { stroke: '#7a3b10', width: 3, glow: '#ffd93b' });
      fillPath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(18, -10);
        ctx.lineTo(0, 0);
        ctx.lineTo(-18, -10);
        ctx.closePath();
      }, hexA('#ffffff', 0.55));
      strokePath(ctx, () => starPath(ctx, 0, 2, 9, t), '#7a3b10', 2.4);
      ctx.restore();
      break;
    }
    case 'comboOrb': {
      glowDot(ctx, 0, 0, 32, '#8b5cf6', 0.5);
      ctx.save();
      ctx.rotate(t * 2.2);
      inked(ctx, () => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        }
        ctx.closePath();
      }, linear(ctx, -14, -14, 14, 14, [[0, '#e9d5ff'], [1, '#a855f7']]), { stroke: '#4c1d95', width: 3 });
      ctx.restore();
      fillPath(ctx, () => ellipse(ctx, 0, 0, 6, 6), '#f3e8ff');
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.arc(0, 0, 20, t * 1.5, t * 1.5 + 2.4);
      }, hexA('#e9d5ff', 0.8), 2.6);
      break;
    }
    case 'boostStar': {
      glowDot(ctx, 0, 0, 46, '#ffd93b', 0.7);
      ctx.save();
      ctx.rotate(Math.sin(t * 2) * 0.22);
      inked(ctx, () => starPath(ctx, 0, 0, 21, 0, 5, 0.46), linear(ctx, -20, -20, 20, 20, [[0, '#fff9c4'], [0.5, '#ffe86b'], [1, '#ffb020']]), { stroke: '#7a4b0a', width: 3, glow: '#ffe86b' });
      fillPath(ctx, () => starPath(ctx, -3, -3, 8, 0, 5, 0.46), PAL.white, 0.55);
      ctx.restore();
      // little wings
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side, 1);
        inked(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(14, -2);
          ctx.quadraticCurveTo(30, -16, 32, 2);
          ctx.quadraticCurveTo(24, 8, 14, 8);
          ctx.closePath();
        }, '#bff7ff', { stroke: '#0d4d78', width: 2.4 });
        ctx.restore();
      }
      break;
    }
    case 'coin': {
      glowDot(ctx, 0, 0, 28, '#ffd93b', 0.4);
      ctx.save();
      ctx.scale(Math.max(0.25, Math.abs(Math.cos(t * 2.2))), 1);
      inked(ctx, () => ellipse(ctx, 0, 0, 13, 13), linear(ctx, -10, -12, 10, 12, [[0, '#fff3a8'], [0.6, '#ffd93b'], [1, '#e8a30d']]), { stroke: '#7a4b0a', width: 2.6 });
      strokePath(ctx, () => ellipse(ctx, 0, 0, 8.5, 8.5), '#7a4b0a', 1.8);
      fillPath(ctx, () => starPath(ctx, 0, 0, 6, 0, 5, 0.45), '#a86e0a', 0.65);
      ctx.restore();
      break;
    }
    case 'battery': {
      glowDot(ctx, 0, 0, 34, '#4ade80', 0.5);
      inked(ctx, () => rr(ctx, -13, -18, 26, 36, 6), linear(ctx, -13, -18, 13, 18, [[0, '#d9ffe0'], [1, '#4ade80']]), { stroke: '#14532d', width: 3 });
      fillPath(ctx, () => rr(ctx, -8, -21, 16, 5, 2), '#14532d');
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(2, -12);
        ctx.lineTo(-7, 2);
        ctx.lineTo(-1, 2);
        ctx.lineTo(-3, 13);
        ctx.lineTo(7, -2);
        ctx.lineTo(1, -2);
        ctx.closePath();
      }, '#fff9c4', { stroke: '#14532d', width: 2 });
      fillPath(ctx, () => rr(ctx, -11, 8, 22, 6, 3), hexA('#ffffff', 0.35));
      break;
    }
    case 'rocket': {
      glowDot(ctx, 6, 4, 40, '#ff7a3d', 0.5);
      ctx.save();
      ctx.rotate(sin01(t) * 0.12);
      // flame
      inked(ctx, () => {
        const f = 18 + Math.abs(Math.sin(t * 18)) * 12;
        ctx.beginPath();
        ctx.moveTo(-14, 6);
        ctx.quadraticCurveTo(-30 - f * 0.4, 10, -16 - f, 18);
        ctx.quadraticCurveTo(-24, 24, -14, 26);
        ctx.closePath();
      }, linear(ctx, -40, 18, -10, 18, [[0, '#ff4d2e'], [0.6, '#ffd93b'], [1, '#fff6c9']]), { width: 0, glow: '#ff8a3d' });
      // fins
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-8, 4);
        ctx.lineTo(-22, 20);
        ctx.lineTo(-6, 20);
        ctx.closePath();
      }, '#ff4d6d', { stroke: '#5b1f2e', width: 2.4 });
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-8, -6);
        ctx.lineTo(-22, -22);
        ctx.lineTo(-6, -20);
        ctx.closePath();
      }, '#ff4d6d', { stroke: '#5b1f2e', width: 2.4 });
      // body
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(24, 0);
        ctx.quadraticCurveTo(6, -16, -16, -12);
        ctx.lineTo(-16, 14);
        ctx.quadraticCurveTo(6, 16, 24, 0);
        ctx.closePath();
      }, linear(ctx, 24, 0, -16, 12, [[0, '#fff7e8'], [0.55, '#ff8a3d'], [1, '#ff4d2e']]), { stroke: '#5b1f2e', width: 3 });
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(24, 0);
        ctx.quadraticCurveTo(16, -8, 8, -11);
        ctx.quadraticCurveTo(20, -2, 8, 11);
        ctx.quadraticCurveTo(16, 8, 24, 0);
        ctx.closePath();
      }, '#ffd93b', { stroke: '#5b1f2e', width: 2.2 });
      fillPath(ctx, () => ellipse(ctx, 4, -2, 5, 5), '#dff6ff');
      strokePath(ctx, () => ellipse(ctx, 4, -2, 5, 5), '#0d4d78', 1.8);
      ctx.restore();
      break;
    }
    case 'bomb': {
      glowDot(ctx, 0, 0, 34, '#ff2d55', 0.45);
      inked(ctx, () => ellipse(ctx, 0, 3, 17, 16), linear(ctx, -14, -12, 14, 16, [[0, '#5b6a86'], [1, '#1b2438']]), { stroke: '#0b1020', width: 3 });
      fillPath(ctx, () => ellipse(ctx, -6, -4, 5, 4, -0.4), hexA('#ffffff', 0.4));
      inked(ctx, () => rr(ctx, -6, -18, 12, 7, 3), '#5b6a86', { stroke: '#0b1020', width: 2.2 });
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.quadraticCurveTo(12, -30, 6, -36);
      }, '#c98a3d', 3.4);
      const spark = 3 + Math.abs(Math.sin(t * 14)) * 4;
      inked(ctx, () => {
        ctx.beginPath();
        ctx.arc(6, -38, spark, 0, Math.PI * 2);
      }, '#ffd93b', { width: 0, glow: '#ff7a3d' });
      // spikes
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        inked(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15 + 3);
          ctx.lineTo(Math.cos(a) * 23, Math.sin(a) * 23 + 3);
          ctx.lineTo(Math.cos(a + 0.25) * 15, Math.sin(a + 0.25) * 15 + 3);
          ctx.closePath();
        }, '#ff4d6d', { stroke: '#5b1f2e', width: 1.6 });
      }
      break;
    }
    case 'balloon': {
      glowDot(ctx, 0, 0, 34, '#ff5ea8', 0.4);
      ctx.save();
      ctx.rotate(Math.sin(t * 1.8) * 0.12);
      inked(ctx, () => ellipse(ctx, 0, -6, 17, 20), linear(ctx, -14, -24, 14, 14, [[0, '#ffd6ec'], [0.6, '#ff9ad5'], [1, '#ff5ea8']]), { stroke: '#7a1038', width: 3, glow: '#ff5ea8' });
      fillPath(ctx, () => ellipse(ctx, -5, -14, 5, 7, -0.4), PAL.white, 0.6);
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-4, 14);
        ctx.lineTo(4, 14);
        ctx.lineTo(0, 20);
        ctx.closePath();
      }, '#ff5ea8', { stroke: '#7a1038', width: 2 });
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.quadraticCurveTo(6 + Math.sin(t * 3) * 4, 30, -2, 40);
      }, '#ffd6ec', 2);
      // happy face
      fillPath(ctx, () => ellipse(ctx, -6, -8, 2.4, 3), PAL.ink);
      fillPath(ctx, () => ellipse(ctx, 6, -8, 2.4, 3), PAL.ink);
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.arc(0, -2, 6, 0.3, 2.8);
      }, PAL.ink, 2);
      ctx.restore();
      break;
    }
    case 'coffee': {
      glowDot(ctx, 0, 0, 36, '#ffb020', 0.4);
      inked(ctx, () => rr(ctx, -14, -8, 28, 26, 6), linear(ctx, -14, -8, 14, 18, [[0, '#ffffff'], [1, '#d9c4a8']]), { stroke: '#3a2a1a', width: 3 });
      fillPath(ctx, () => rr(ctx, -14, -8, 28, 8, 4), hexA('#c48a5a', 0.35));
      inked(ctx, () => {
        ctx.beginPath();
        ctx.arc(16, 4, 7, -1.2, 1.2);
      }, '#ffffff', { stroke: '#3a2a1a', width: 3 });
      inked(ctx, () => ellipse(ctx, 0, -9, 14, 4), '#6b3f22', { stroke: '#3a2a1a', width: 2.4 });
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        strokePath(ctx, () => {
          ctx.beginPath();
          const x = -6 + i * 6;
          const ph = t * 2 + i;
          ctx.moveTo(x, -14);
          ctx.bezierCurveTo(x - 6, -22 - Math.sin(ph) * 4, x + 6, -26, x - 2, -36 - Math.sin(ph) * 4);
        }, '#ffffff', 2.4);
        ctx.restore();
      }
      break;
    }
    case 'magnet': {
      glowDot(ctx, 0, 0, 34, '#3b82f6', 0.45);
      inked(ctx, () => {
        ctx.beginPath();
        ctx.arc(0, 0, 16, Math.PI, Math.PI * 2);
        ctx.lineTo(16, 12);
        ctx.lineTo(6, 12);
        ctx.lineTo(6, 0);
        ctx.arc(0, 0, 6, 0, Math.PI, true);
        ctx.lineTo(-6, 12);
        ctx.lineTo(-16, 12);
        ctx.closePath();
      }, linear(ctx, -16, -16, 16, 12, [[0, '#bff7ff'], [1, '#3b82f6']]), { stroke: '#0b2a5e', width: 3 });
      fillPath(ctx, () => rr(ctx, -16, 12, 10, 6, 2), '#ff4d6d');
      fillPath(ctx, () => rr(ctx, 6, 12, 10, 6, 2), '#ff4d6d');
      ctx.save();
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 2; i++) {
        strokePath(ctx, () => {
          ctx.beginPath();
          ctx.arc(0, 0, 22 + i * 7 + Math.sin(t * 3 + i) * 2, -2.5, -0.6);
          ctx.stroke();
        }, '#7ee8ff', 2.4);
      }
      ctx.restore();
      break;
    }
    case 'parachute': {
      glowDot(ctx, 0, 0, 34, '#60a5fa', 0.35);
      // canopy
      inked(ctx, () => {
        ctx.beginPath();
        ctx.arc(0, -4, 22, Math.PI, 0);
        ctx.quadraticCurveTo(0, 6, -22, -4);
        ctx.closePath();
      }, linear(ctx, -20, -26, 20, 0, [[0, '#dff6ff'], [1, '#60a5fa']]), { stroke: '#0b2a5e', width: 3 });
      for (let i = -1; i <= 1; i++) {
        strokePath(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(i * 10, -20);
          ctx.lineTo(i * 10, -4);
        }, '#93c5fd', 2);
      }
      // strings
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-20, -4);
        ctx.lineTo(-8, 14);
        ctx.moveTo(20, -4);
        ctx.lineTo(8, 14);
      }, '#dff6ff', 2);
      // underpants
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-12, 12);
        ctx.lineTo(12, 12);
        ctx.lineTo(10, 26);
        ctx.quadraticCurveTo(0, 22, -10, 26);
        ctx.closePath();
      }, linear(ctx, -12, 12, 12, 26, [[0, '#9fd6ff'], [1, '#3b82f6']]), { stroke: '#0b2a5e', width: 3 });
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-12, 17);
        ctx.lineTo(12, 17);
      }, '#dff6ff', 2.4);
      break;
    }
    case 'spring': {
      // mount
      inked(ctx, () => rr(ctx, -34, 12, 68, 14, 6), '#5b6a86', { stroke: PAL.ink, width: 3 });
      // coil
      for (let i = 0; i < 5; i++) {
        const y = 10 - i * 6;
        strokePath(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(-20, y);
          ctx.lineTo(20, y - 4);
        }, '#c9d6e8', 5);
        strokePath(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(-20, y);
          ctx.lineTo(20, y - 4);
        }, PAL.ink, 1.6);
      }
      inked(ctx, () => rr(ctx, -30, -30, 60, 14, 7), linear(ctx, -30, -30, 30, -16, [[0, '#ff8fa8'], [1, '#ff4d6d']]), { stroke: PAL.ink, width: 3 });
      fillPath(ctx, () => rr(ctx, -24, -27, 48, 4, 2), hexA('#ffffff', 0.5));
      break;
    }
    case 'safetyNet': {
      // trampoline net with side poles (drawn wide, centred)
      const w = 220;
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-w, 4);
        ctx.lineTo(w, 4);
      }, '#8a5a33', 8);
      for (let i = -6; i <= 6; i++) {
        strokePath(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(i * 17, -6);
          ctx.lineTo(i * 17, 10);
        }, hexA('#9ff7a0', 0.75), 2);
      }
      for (let i = -6; i <= 6; i++) {
        strokePath(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(-w, 4 + i * 0.4);
          ctx.lineTo(w, 4 + i * 0.4);
        }, hexA('#9ff7a0', 0.35), 1.6);
      }
      inked(ctx, () => rr(ctx, -w - 6, -6, 12, 22, 4), '#7a4321', { stroke: PAL.ink, width: 2.6 });
      inked(ctx, () => rr(ctx, w - 6, -6, 12, 22, 4), '#7a4321', { stroke: PAL.ink, width: 2.6 });
      break;
    }
    case 'mushroom': {
      inked(ctx, () => rr(ctx, -12, -6, 24, 26, 8), linear(ctx, -12, -6, 12, 20, [[0, '#fff7e8'], [1, '#e2cbb0']]), { stroke: PAL.ink, width: 3 });
      inked(ctx, () => {
        ctx.beginPath();
        ctx.arc(0, -6, 32, Math.PI, 0);
        ctx.quadraticCurveTo(0, 8, -32, -6);
        ctx.closePath();
      }, linear(ctx, -30, -38, 30, 0, [[0, '#ffb4d4'], [0.6, '#ff5ea8'], [1, '#d6337d']]), { stroke: PAL.ink, width: 3 });
      for (const [sx, sy, sr] of [[-16, -16, 5], [6, -22, 4], [18, -12, 4.5], [-2, -8, 3]]) {
        fillPath(ctx, () => ellipse(ctx, sx, sy, sr, sr * 0.8), '#fff0f6', 0.9);
      }
      fillPath(ctx, () => ellipse(ctx, -10, -26, 8, 3, -0.5), PAL.white, 0.35);
      break;
    }
    case 'ice': {
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-46, -6);
        ctx.lineTo(40, -12);
        ctx.lineTo(48, 12);
        ctx.lineTo(-40, 16);
        ctx.closePath();
      }, linear(ctx, -40, -14, 40, 16, [[0, '#e6fdff'], [0.5, '#a8ecff'], [1, '#5cc8ea']]), { stroke: '#0d4d78', width: 3 });
      strokePath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-30, -4);
        ctx.lineTo(24, -8);
        ctx.moveTo(-20, 8);
        ctx.lineTo(34, 2);
      }, hexA('#ffffff', 0.6), 2);
      ctx.save();
      ctx.translate(0, 2);
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3);
        strokePath(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.lineTo(0, 8);
        }, hexA('#ffffff', 0.75), 2);
        ctx.restore();
      }
      ctx.restore();
      break;
    }
    case 'jetGate': {
      glowDot(ctx, 0, 0, 56, '#ff9f1c', 0.5);
      ctx.save();
      ctx.rotate(-0.22);
      inked(ctx, () => {
        ctx.beginPath();
        ctx.ellipse(0, 0, 42, 30, 0, 0, Math.PI * 2);
      }, linear(ctx, -40, -30, 40, 30, [[0, '#ffe86b'], [1, '#ff7a1a']]), { stroke: '#5b2a06', width: 5 });
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t;
        fillPath(ctx, () => ellipse(ctx, Math.cos(a) * 36, Math.sin(a) * 25, 4, 4), '#fff9c4');
      }
      // chevrons
      for (let i = 0; i < 3; i++) {
        const off = (t * 40 + i * 14) % 42;
        strokePath(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(-30 + off, -10);
          ctx.lineTo(-20 + off, 0);
          ctx.lineTo(-30 + off, 10);
        }, hexA('#5b2a06', 0.8), 4);
      }
      ctx.restore();
      break;
    }
    case 'ufo': {
      glowDot(ctx, 0, 0, 60, '#7c3aed', 0.55);
      // beam
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(t * 4) * 0.06;
      fillPath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-18, 8);
        ctx.lineTo(-44, 90);
        ctx.lineTo(44, 90);
        ctx.lineTo(18, 8);
        ctx.closePath();
      }, linear(ctx, 0, 8, 0, 90, [[0, '#c58bff'], [1, 'rgba(197,139,255,0)']]));
      ctx.restore();
      inked(ctx, () => {
        ctx.beginPath();
        ctx.ellipse(0, 4, 44, 15, 0, 0, Math.PI * 2);
      }, linear(ctx, -44, -6, 44, 16, [[0, '#8b5cf6'], [0.6, '#c58bff'], [1, '#5b21b6']]), { stroke: '#2e1065', width: 3.4 });
      inked(ctx, () => {
        ctx.beginPath();
        ctx.arc(0, 0, 20, Math.PI, 0);
        ctx.closePath();
      }, linear(ctx, -20, -20, 20, 0, [[0, '#e9d5ff'], [1, '#a78bfa']]), { stroke: '#2e1065', width: 3 });
      fillPath(ctx, () => ellipse(ctx, -6, -9, 6, 4, -0.4), PAL.white, 0.6);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const on = (Math.sin(t * 6 + i) + 1) / 2;
        fillPath(ctx, () => ellipse(ctx, Math.cos(a) * 30, 2 + Math.sin(a) * 8, 3.4, 3.4), hexA('#ffd93b', 0.4 + on * 0.6));
      }
      fillPath(ctx, () => ellipse(ctx, 0, 16, 20, 5), hexA('#7c3aed', 0.7));
      break;
    }
    case 'hotair': {
      for (let i = 0; i < 6; i++) {
        const ph = (t * 0.6 + i / 6) % 1;
        ctx.save();
        ctx.globalAlpha = 0.28 * (1 - ph);
        fillPath(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(-70, 320 - ph * 640);
          ctx.quadraticCurveTo(0, 280 - ph * 640, 70, 320 - ph * 640);
          ctx.quadraticCurveTo(20, 380 - ph * 640, -70, 320 - ph * 640);
        }, '#ffb020');
        ctx.restore();
      }
      break;
    }
    case 'hazard': {
      glowDot(ctx, 0, 0, 38, '#ff2d55', 0.5);
      ctx.save();
      ctx.rotate(Math.sin(t * 2) * 0.25);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        inked(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
          ctx.lineTo(Math.cos(a + 0.18) * 26, Math.sin(a + 0.18) * 26);
          ctx.lineTo(Math.cos(a + 0.36) * 12, Math.sin(a + 0.36) * 12);
          ctx.closePath();
        }, '#ff4d6d', { stroke: '#5b1f2e', width: 2.4 });
      }
      inked(ctx, () => ellipse(ctx, 0, 0, 13, 13), linear(ctx, -12, -12, 12, 12, [[0, '#ffd0d8'], [1, '#d6335d']]), { stroke: '#5b1f2e', width: 3 });
      fillPath(ctx, () => ellipse(ctx, 0, 0, 6, 6), '#5b1f2e');
      ctx.restore();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function sin01(t) {
  return Math.sin(t * 1.7);
}

export const ITEM_GLOW = {
  orb: '#3fd0ff',
  super: '#ffb020',
  comboOrb: '#8b5cf6',
  boostStar: '#ffe86b',
  coin: '#ffd93b',
};
