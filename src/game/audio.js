/**
 * Procedural audio: everything is synthesised with WebAudio at runtime.
 * No sample downloads, no startup stalls, full volume control and a voice cap.
 * "A boost should sound like someone lit a jet engine in a kitchen." — Shapi
 */
import { AUDIO } from '../config/config.js';
import { TRACKS, eventsAt, stepSeconds, trackLength } from './music.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

const hzOf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export class AudioEngine {
  constructor(settings = {}) {
    this.ctx = null;
    this.ready = false;
    this.settings = { master: 0.8, music: 0.55, sfx: 0.85, ...settings };
    this.voices = 0;
    this.musicVoices = 0;
    this.mode = 'menu';
    this.tempo = TRACKS.menu.bpm;
    this.step = 0;
    this.nextNoteTime = 0;
    this.timer = null;
    this.intensity = 0;
    this.musicOn = true;
    this.track = TRACKS.menu;
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
    // sidechain pump: melodic parts duck under the kick, drums bypass it
    this.duckGain = this.ctx.createGain();
    this.duckGain.gain.value = 1;
    this.drumBus = this.ctx.createGain();
    this.drumBus.gain.value = this.settings.music * 0.9;
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.settings.sfx;
    this.musicBus.connect(this.duckGain);
    this.duckGain.connect(this.master);
    this.drumBus.connect(this.master);
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
    this.drumBus.gain.value = this.settings.music * 0.9;
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

  /** Release the scheduler (used by tests and on page teardown). */
  dispose() {
    this.stopMusic();
    this.ready = false;
  }

  setScene(mode) {
    const next = TRACKS[mode] || TRACKS.menu;
    if (this.mode === mode && this.track === next) return;
    this.mode = mode;
    this.track = next;
    this.tempo = this.track.bpm;
    if (this.ready) {
      // restart the loop on the next bar so scene changes land musically
      this.step = 0;
      this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.04);
    }
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  _schedule() {
    if (!this.ready) return;
    const ahead = 0.18;
    const track = this.track || (this.track = TRACKS.menu);
    if (this.nextNoteTime < this.ctx.currentTime - 0.5) {
      // tab was asleep: don't try to backfill minutes of missed notes
      this.nextNoteTime = this.ctx.currentTime + 0.05;
    }
    const stepDur = stepSeconds(track);
    const total = trackLength(track);
    while (this.nextNoteTime < this.ctx.currentTime + ahead) {
      const time = this.nextNoteTime;
      if (this.settings.music > 0.001) {
        for (const ev of eventsAt(track, this.step, this.musicIntensity())) {
          this._playMusicEvent(ev, time);
        }
      }
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % total;
    }
  }

  /** Menu stays loud and confident; flight adds energy as the combo climbs. */
  musicIntensity() {
    const base = (this.track || TRACKS.menu).intensity;
    if (this.mode === 'menu' || this.mode === 'gameover') return base;
    return Math.min(1, base + this.intensity * 0.35);
  }

  _duck(time) {
    const g = this.duckGain && this.duckGain.gain;
    if (!g || !g.cancelScheduledValues) return;
    try {
      g.cancelScheduledValues(time);
      g.setValueAtTime(0.42, time);
      g.linearRampToValueAtTime(1, time + 0.17);
    } catch (_) {}
  }

  /** Turn one sequencer event into sound. */
  _playMusicEvent(ev, time) {
    const delay = Math.max(0, time - this.ctx.currentTime);
    const drums = this.drumBus || this.musicBus;
    const melodic = this.musicBus;
    const dur = ev.dur || 0.15;
    const gain = ev.gain || 0.1;
    switch (ev.voice) {
      case 'kick':
        this._musicTone(52, 0.2, { type: 'sine', gain: gain, to: 31, delay, bus: drums });
        this._musicNoise(0.05, { gain: gain * 0.35, freq: 180, type: 'lowpass', delay, bus: drums, q: 0.6 });
        this._duck(time);
        break;
      case 'clap':
        this._musicNoise(dur, { gain, freq: 1500, type: 'bandpass', delay, bus: drums, q: 1.5 });
        this._musicNoise(dur * 0.6, { gain: gain * 0.6, freq: 2400, type: 'bandpass', delay: delay + 0.012, bus: drums, q: 1.8 });
        break;
      case 'hat':
        this._musicNoise(dur, { gain, freq: 8800, type: 'highpass', delay, bus: drums, q: 0.8 });
        break;
      case 'ohat':
        this._musicNoise(dur, { gain, freq: 7200, type: 'highpass', delay, bus: drums, q: 1.1 });
        break;
      case 'snare':
        this._musicNoise(dur, { gain, freq: 1400, type: 'bandpass', delay, bus: drums, q: 1.2 });
        this._musicTone(180, dur, { type: 'triangle', gain: gain * 0.6, to: 120, delay, bus: drums });
        break;
      case 'bass':
        this._musicTone(hzOf(ev.note), dur, {
          type: 'sawtooth',
          gain,
          delay,
          bus: melodic,
          filter: { type: 'lowpass', freq: 320, to: 110 },
        });
        this._musicTone(hzOf(ev.note) / 2, dur * 0.9, { type: 'sine', gain: gain * 0.7, delay, bus: melodic });
        break;
      case 'stab': {
        const notes = ev.notes || [];
        notes.forEach((n, i) => {
          this._musicTone(hzOf(n), dur, {
            type: 'sawtooth',
            gain: gain / Math.max(2, notes.length),
            delay,
            detune: i % 2 ? 7 : -7,
            bus: melodic,
            filter: { type: 'lowpass', freq: 2600, to: 900 },
          });
        });
        break;
      }
      case 'lead':
        this._musicTone(hzOf(ev.note), dur, {
          type: 'square',
          gain,
          delay,
          bus: melodic,
          filter: { type: 'lowpass', freq: 3800, to: 1600 },
        });
        break;
      case 'pluck':
        this._musicTone(hzOf(ev.note), dur, { type: 'triangle', gain, delay, bus: melodic });
        break;
      case 'sub':
        this._musicTone(hzOf(ev.note), dur, { type: 'sine', gain, delay, bus: melodic });
        break;
      case 'pad': {
        const notes = ev.notes || [];
        for (const n of notes) {
          this._musicTone(hzOf(n), dur, {
            type: 'sawtooth',
            gain: gain / Math.max(2, notes.length),
            delay,
            detune: 5,
            bus: melodic,
            filter: { type: 'lowpass', freq: 1400, to: 700 },
          });
        }
        break;
      }
      case 'riser':
        this._musicRiser(dur, gain, delay);
        break;
      case 'impact':
        this._musicTone(90, dur, { type: 'sine', gain, to: 32, delay, bus: drums });
        this._musicNoise(0.3, { gain: gain * 0.5, freq: 600, type: 'lowpass', delay, bus: drums, q: 0.5 });
        break;
      default:
        break;
    }
  }

  _musicRiser(dur, gain, delay) {
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(320, t0);
    f.frequency.exponentialRampToValueAtTime(7200, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.drumBus || this.musicBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  _musicTone(freq, dur, opts) {
    const t0 = this.ctx.currentTime + opts.delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.detune && osc.detune) osc.detune.value = opts.detune;
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
