/**
 * Procedural audio: everything is synthesised with WebAudio at runtime.
 * No sample downloads, no startup stalls, full volume control and a voice cap.
 * "A boost should sound like someone lit a jet engine in a kitchen." — Shapi
 */
import { AUDIO } from '../config/config.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor(settings = {}) {
    this.ctx = null;
    this.ready = false;
    this.settings = { master: 0.8, music: 0.55, sfx: 0.85, ...settings };
    this.voices = 0;
    this.musicVoices = 0;
    this.mode = 'menu';
    this.tempo = 126;
    this.step = 0;
    this.nextNoteTime = 0;
    this.timer = null;
    this.intensity = 0;
    this.musicOn = true;
    this.lastPlay = {};
    this.muted = false;
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlock();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
    }
  }

  unlock() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.settings.master;
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 22;
    this.comp.ratio.value = 7;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.18;
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.settings.music * 0.9;
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.settings.sfx;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.comp);
    this.comp.connect(this.ctx.destination);

    // shared noise buffer (cheap, reused by all percussive sounds)
    const len = Math.floor(this.ctx.sampleRate * 1.2);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.ready = true;
    this.startMusic();
  }

  applySettings(s) {
    this.settings = { ...this.settings, ...s };
    if (!this.ready) return;
    this.master.gain.value = this.muted ? 0 : this.settings.master;
    this.musicBus.gain.value = this.settings.music * 0.9;
    this.sfxBus.gain.value = this.settings.sfx;
  }

  setMuted(m) {
    this.muted = m;
    if (this.ready) this.master.gain.value = m ? 0 : this.settings.master;
  }

  // ---------------------------------------------------------------- voices
  _voice(bus, dur) {
    if (!this.ready || this.voices >= AUDIO.voices) return false;
    this.voices++;
    setTimeout(() => {
      this.voices = Math.max(0, this.voices - 1);
    }, dur * 1000 + 40);
    return true;
  }

  tone(freq, dur, opts = {}) {
    if (!this.ready) return;
    const {
      type = 'sine',
      gain = 0.25,
      to = null,
      bus = this.sfxBus,
      attack = 0.005,
      delay = 0,
      detune = 0,
      filter = null,
      vibrato = 0,
      pan = 0,
    } = opts;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (to != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.setValueAtTime(filter.freq, t0);
      if (filter.to) f.frequency.exponentialRampToValueAtTime(Math.max(60, filter.to), t0 + dur);
      f.Q.value = filter.q ?? 1;
      node.connect(f);
      node = f;
    }
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      node = p;
    }
    node.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, opts = {}) {
    if (!this.ready) return;
    const { gain = 0.2, freq = 1200, to = null, type = 'bandpass', q = 1.2, delay = 0, bus = this.sfxBus } = opts;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  // ------------------------------------------------------------------- sfx
  sfx(name, opts = {}) {
    if (!this.ready) return;
    const now = performance.now() / 1000;
    const last = this.lastPlay[name] || 0;
    if (now - last < (opts.throttle ?? 0.045)) return;
    this.lastPlay[name] = now;
    const pitch = opts.pitch ?? 1;
    const vol = opts.volume ?? 1;
    switch (name) {
      case 'launch':
        this._voice(this.sfxBus, 0.8);
        this.noise(0.55, { gain: 0.3 * vol, freq: 300, to: 2600, type: 'bandpass', q: 0.8 });
        this.tone(120 * pitch, 0.55, { type: 'sawtooth', gain: 0.22 * vol, to: 55, filter: { type: 'lowpass', freq: 900 } });
        this.tone(260 * pitch, 0.4, { type: 'square', gain: 0.09 * vol, to: 620, delay: 0.04 });
        break;
      case 'boost':
        this._voice(this.sfxBus, 0.5);
        this.noise(0.3, { gain: 0.26 * vol, freq: 700 * pitch, to: 3600, type: 'bandpass', q: 0.7 });
        this.tone(180 * pitch, 0.28, { type: 'sawtooth', gain: 0.2 * vol, to: 520, filter: { type: 'lowpass', freq: 1800, to: 5000 } });
        this.tone(90 * pitch, 0.3, { type: 'sine', gain: 0.24 * vol, to: 45 });
        break;
      case 'rocket':
        this.noise(0.42, { gain: 0.24 * vol, freq: 500, to: 2400, q: 0.6 });
        this.tone(220, 0.35, { type: 'sawtooth', gain: 0.14 * vol, to: 700, filter: { type: 'lowpass', freq: 2400 } });
        break;
      case 'pop':
        this.tone(620 * pitch, 0.1, { type: 'sine', gain: 0.18 * vol, to: 1300 });
        this.noise(0.06, { gain: 0.08 * vol, freq: 3000, to: 6000, type: 'highpass', q: 0.7 });
        break;
      case 'ding':
        this.tone(880 * pitch, 0.22, { type: 'triangle', gain: 0.2 * vol });
        this.tone(1320 * pitch, 0.18, { type: 'sine', gain: 0.12 * vol, delay: 0.02 });
        break;
      case 'star':
        this.tone(880, 0.16, { type: 'triangle', gain: 0.2 * vol });
        this.tone(1174, 0.16, { type: 'triangle', gain: 0.18 * vol, delay: 0.07 });
        this.tone(1568, 0.26, { type: 'triangle', gain: 0.16 * vol, delay: 0.14 });
        break;
      case 'coin':
        this.tone(1046 * pitch, 0.1, { type: 'square', gain: 0.09 * vol, to: 1568 });
        this.tone(1568 * pitch, 0.12, { type: 'square', gain: 0.07 * vol, delay: 0.05 });
        break;
      case 'spring':
      case 'twang':
        this._voice(this.sfxBus, 0.3);
        this.tone(240 * pitch, 0.26, { type: 'triangle', gain: 0.24 * vol, to: 520 });
        this.tone(480 * pitch, 0.2, { type: 'sine', gain: 0.1 * vol, to: 900, delay: 0.02 });
        break;
      case 'boing':
        this.tone(300 * pitch, 0.3, { type: 'sine', gain: 0.22 * vol, to: 760 });
        this.tone(150 * pitch, 0.34, { type: 'triangle', gain: 0.16 * vol, to: 420 });
        break;
      case 'sproing':
        this.tone(180, 0.3, { type: 'triangle', gain: 0.24 * vol, to: 900 });
        this.noise(0.12, { gain: 0.1 * vol, freq: 1400, to: 3400 });
        break;
      case 'zap':
        this.tone(1200, 0.1, { type: 'square', gain: 0.1 * vol, to: 300 });
        this.noise(0.08, { gain: 0.1 * vol, freq: 4000, type: 'highpass' });
        break;
      case 'boom':
        this._voice(this.sfxBus, 0.6);
        this.noise(0.5, { gain: 0.34 * vol, freq: 220, to: 60, type: 'lowpass', q: 0.9 });
        this.tone(70, 0.5, { type: 'sine', gain: 0.3 * vol, to: 30 });
        break;
      case 'hit':
        this.noise(0.18, { gain: 0.24 * vol, freq: 900, to: 200 });
        this.tone(160, 0.2, { type: 'square', gain: 0.12 * vol, to: 70 });
        break;
      case 'dead':
        this._voice(this.sfxBus, 1.1);
        this.tone(300, 0.9, { type: 'triangle', gain: 0.22 * vol, to: 60 });
        this.noise(0.8, { gain: 0.16 * vol, freq: 800, to: 90, type: 'lowpass' });
        this.tone(180, 0.25, { type: 'square', gain: 0.1 * vol, to: 90, delay: 0.18 });
        break;
      case 'upgrade':
        this.tone(520, 0.12, { type: 'square', gain: 0.16 * vol, to: 780 });
        this.tone(780, 0.14, { type: 'triangle', gain: 0.14 * vol, delay: 0.08 });
        this.noise(0.09, { gain: 0.1 * vol, freq: 2200, type: 'bandpass' });
        break;
      case 'click':
        this.tone(560, 0.06, { type: 'square', gain: 0.1 * vol, to: 700 });
        break;
      case 'hover':
        this.tone(760, 0.05, { type: 'sine', gain: 0.05 * vol });
        break;
      case 'whoosh':
        this.noise(0.5, { gain: 0.2 * vol, freq: 300, to: 2200, type: 'bandpass', q: 0.4 });
        break;
      case 'wind':
        this.noise(0.6, { gain: 0.09 * vol, freq: 500, to: 1200, type: 'lowpass' });
        break;
      case 'flutter':
        this.noise(0.4, { gain: 0.1 * vol, freq: 900, to: 2200, type: 'bandpass', q: 2 });
        break;
      case 'slide':
        this.noise(0.3, { gain: 0.14 * vol, freq: 2600, to: 900, type: 'bandpass', q: 1.4 });
        break;
      case 'slurp':
        this.tone(240, 0.18, { type: 'sawtooth', gain: 0.1 * vol, to: 520 });
        this.noise(0.16, { gain: 0.08 * vol, freq: 700, to: 1600 });
        break;
      case 'bloop':
        this.tone(420, 0.18, { type: 'sine', gain: 0.18 * vol, to: 900 });
        break;
      case 'glitch':
        this._voice(this.sfxBus, 0.4);
        for (let i = 0; i < 4; i++) {
          this.tone(200 + Math.random() * 900, 0.06, { type: 'square', gain: 0.08 * vol, delay: i * 0.045 });
        }
        this.noise(0.24, { gain: 0.1 * vol, freq: 2400, to: 300, type: 'bandpass' });
        break;
      case 'thoomp':
        this.tone(90, 0.4, { type: 'sine', gain: 0.3 * vol, to: 40 });
        this.noise(0.24, { gain: 0.16 * vol, freq: 300, to: 80, type: 'lowpass' });
        break;
      case 'fwooom':
        this.noise(0.7, { gain: 0.24 * vol, freq: 260, to: 1800, type: 'bandpass', q: 0.5 });
        this.tone(140, 0.7, { type: 'sawtooth', gain: 0.12 * vol, to: 220, filter: { type: 'lowpass', freq: 800, to: 2600 } });
        break;
      case 'squelch':
        this.tone(180, 0.22, { type: 'sine', gain: 0.16 * vol, to: 90 });
        this.noise(0.18, { gain: 0.1 * vol, freq: 600, to: 200, type: 'lowpass' });
        break;
      case 'combo':
        this.tone(660 * pitch, 0.14, { type: 'triangle', gain: 0.14 * vol });
        this.tone(990 * pitch, 0.18, { type: 'triangle', gain: 0.1 * vol, delay: 0.05 });
        break;
      default:
        break;
    }
  }

  // ----------------------------------------------------------------- music
  startMusic() {
    if (!this.ready || this.timer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this._schedule(), 25);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setScene(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    const tempos = { menu: 112, launch: 124, fly: 132, gameover: 92 };
    this.tempo = tempos[mode] || 126;
    if (this.ready) this.step = 0;
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  _schedule() {
    if (!this.ready) return;
    const ahead = 0.16;
    const beat = 60 / this.tempo;
    while (this.nextNoteTime < this.ctx.currentTime + ahead) {
      this._playStep(this.step, this.nextNoteTime, beat);
      this.nextNoteTime += beat / 2;
      this.step = (this.step + 1) % 32;
    }
  }

  _playStep(step, time, beat) {
    if (this.settings.music <= 0.001) return;
    const bus = this.musicBus;
    const delay = Math.max(0, time - this.ctx.currentTime);
    const mode = this.mode;
    // A-minor-ish funk vamp: Am | F | C | G
    const roots = [57, 53, 48, 55];
    const chords = [
      [0, 3, 7, 10],
      [-4, 0, 3, 7],
      [3, 7, 10, 14],
      [-2, 2, 5, 10],
    ];
    const bar = Math.floor(step / 8) % 4;
    const s = step % 8;
    const chord = chords[bar];
    const root = roots[bar];

    const quiet = mode === 'gameover' ? 0.55 : 1;
    // bass on beats 1 & 3 (+ pickup)
    if (s === 0 || s === 3 || s === 6) {
      this._musicTone(NOTE(root - 24), 0.22, {
        type: 'sawtooth',
        gain: 0.16 * quiet,
        delay,
        filter: { type: 'lowpass', freq: 420, to: 220 },
        bus,
      });
    }
    // arpeggio 16ths with intensity-based octave shimmer
    if (mode !== 'menu' || s % 2 === 0) {
      const note = chord[(step + bar) % chord.length] + 12;
      this._musicTone(NOTE(note + (mode === 'fly' && this.intensity > 0.5 ? 12 : 0)), 0.12, {
        type: mode === 'menu' ? 'triangle' : 'square',
        gain: 0.045 * quiet * (0.7 + this.intensity * 0.6),
        delay,
        filter: { type: 'lowpass', freq: 2400, to: 1200 },
        bus,
      });
    }
    // drums
    if (s === 0 || s === 4) {
      this._musicNoise(0.11, { gain: 0.2 * quiet, freq: 120, type: 'lowpass', delay, bus, q: 0.7 });
      this._musicTone(52, 0.18, { type: 'sine', gain: 0.16 * quiet, to: 38, delay, bus });
    }
    if (s === 2 || s === 6) this._musicNoise(0.07, { gain: 0.09 * quiet, freq: 2200, type: 'bandpass', delay, bus, q: 2 });
    if (mode !== 'menu' && s % 2 === 1) {
      this._musicNoise(0.035, { gain: 0.045 * quiet, freq: 8200, type: 'highpass', delay, bus, q: 0.6 });
    }
    // combo layer: extra sparkle at high intensity
    if (this.intensity > 0.35 && s === 3) {
      this._musicTone(NOTE(root + 24), 0.16, { type: 'sine', gain: 0.05 * this.intensity, delay, bus });
    }
    if (mode === 'launch' && s === 0) {
      this._musicNoise(0.2, { gain: 0.08, freq: 300, to: 1600, type: 'bandpass', delay, bus, q: 0.8 });
    }
  }

  _musicTone(freq, dur, opts) {
    const t0 = this.ctx.currentTime + opts.delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(opts.gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (opts.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = opts.filter.type;
      f.frequency.setValueAtTime(opts.filter.freq, t0);
      if (opts.filter.to) f.frequency.exponentialRampToValueAtTime(Math.max(60, opts.filter.to), t0 + dur);
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(opts.bus || this.musicBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _musicNoise(dur, opts) {
    const t0 = this.ctx.currentTime + opts.delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.value = opts.freq;
    f.Q.value = opts.q ?? 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(opts.bus || this.musicBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }
}
