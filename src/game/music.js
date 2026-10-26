/**
 * JUMP TO THE STAR — music sequencer (electric EDM).
 *
 * Pure data + pure functions: this module never touches WebAudio, so the
 * patterns can be unit-tested. The AudioEngine turns the events into sound.
 *
 * One "step" is a 16th note. Every track is a loop of `bars` bars.
 * Voices: kick, clap, hat, ohat, snare, bass, stab, lead, pluck, sub, riser,
 *         impact, pad.
 */

export function hz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A-minor dance progressions. Each entry is a chord in semitones from A2 (45). */
const PROG = {
  // Am - F - C - G  (the classic four-chord EDM loop)
  house: [
    { root: 45, notes: [0, 3, 7, 10] }, // Am7
    { root: 41, notes: [0, 4, 7, 11] }, // Fmaj7
    { root: 48, notes: [0, 4, 7, 11] }, // Cmaj7
    { root: 43, notes: [0, 4, 7, 10] }, // G7
  ],
  // Am - C - F - G, brighter, for the fast flight loops
  drive: [
    { root: 45, notes: [0, 3, 7, 12] },
    { root: 48, notes: [0, 4, 7, 12] },
    { root: 41, notes: [0, 4, 7, 12] },
    { root: 43, notes: [0, 4, 7, 12] },
  ],
  // Am9 - Fmaj9 for the slower, spacier game-over loop
  chill: [
    { root: 45, notes: [0, 3, 7, 10] },
    { root: 41, notes: [0, 4, 7, 11] },
    { root: 45, notes: [0, 3, 7, 14] },
    { root: 43, notes: [0, 4, 7, 10] },
  ],
};

export const TRACKS = {
  menu: { id: 'menu', bpm: 128, bars: 8, stepsPerBar: 16, prog: 'house', style: 'edm', intensity: 0.72 },
  launch: { id: 'launch', bpm: 132, bars: 8, stepsPerBar: 16, prog: 'drive', style: 'edm', intensity: 0.8 },
  fly: { id: 'fly', bpm: 138, bars: 8, stepsPerBar: 16, prog: 'drive', style: 'edm', intensity: 0.9 },
  gameover: { id: 'gameover', bpm: 96, bars: 8, stepsPerBar: 16, prog: 'chill', style: 'chill', intensity: 0.3 },
};

export function stepSeconds(track) {
  return 60 / track.bpm / 4;
}

export function trackLength(track) {
  return track.bars * track.stepsPerBar;
}

function chordAt(track, bar) {
  const prog = PROG[track.prog] || PROG.house;
  return prog[bar % prog.length];
}

/** Arpeggio shape (indexes into the chord, then up an octave). */
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 1, 2, 3, 2, 1, 0, 1, 2];

/**
 * All note events that start on this step.
 * @param {object} track  one of TRACKS
 * @param {number} step   absolute step in the loop
 * @param {number} [intensity] 0..1, layers extra energy on top of the track
 * @returns {Array<object>} events, each { voice, note?, notes?, dur, gain }
 */
export function eventsAt(track, step, intensity = track.intensity) {
  const out = [];
  const bar = Math.floor(step / track.stepsPerBar) % track.bars;
  const s = step % track.stepsPerBar;
  const chord = chordAt(track, bar);
  const root = chord.root;
  const energy = Math.max(0, Math.min(1, intensity));
  const lastBar = bar === track.bars - 1;
  const half = bar >= track.bars / 2;

  if (track.style === 'chill') {
    // Slow, wide, melancholic: no four-on-the-floor, just a soft pulse.
    if (s === 0) {
      out.push({ voice: 'pad', notes: chord.notes.map((n) => root + n), dur: 2.6, gain: 0.085 });
      out.push({ voice: 'sub', note: root - 12, dur: 1.4, gain: 0.09 });
    }
    if (s === 6) out.push({ voice: 'pluck', note: root + 24 + chord.notes[(bar + 2) % chord.notes.length], dur: 0.5, gain: 0.05 });
    if (s === 10 && bar % 2 === 0) out.push({ voice: 'pluck', note: root + 31, dur: 0.6, gain: 0.042 });
    if (s === 12) out.push({ voice: 'hat', dur: 0.05, gain: 0.03 });
    return out;
  }

  /* --------------------------------------------------------------- drums */
  // four-on-the-floor
  if (s % 4 === 0) out.push({ voice: 'kick', dur: 0.22, gain: 0.5 });
  // clap on 2 and 4
  if (s === 4 || s === 12) out.push({ voice: 'clap', dur: 0.14, gain: 0.24 });
  // offbeat open hats, the backbone of the groove
  if (s % 4 === 2) out.push({ voice: 'hat', dur: 0.055, gain: 0.12 });
  // 16th ghost hats once the track has energy
  if (energy > 0.45 && s % 2 === 1) out.push({ voice: 'hat', dur: 0.03, gain: 0.045 + 0.03 * energy });
  // open hat lift at the end of every second bar
  if (s === 14 && bar % 2 === 1) out.push({ voice: 'ohat', dur: 0.26, gain: 0.09 });

  /* ---------------------------------------------------------------- bass */
  // rolling offbeat bass: the classic pumping 8th/16th pattern
  if (s % 4 === 2) out.push({ voice: 'bass', note: root - 12, dur: 0.16, gain: 0.3 });
  if (energy > 0.55 && s % 4 === 3) out.push({ voice: 'bass', note: root - 12 + 12, dur: 0.09, gain: 0.15 });
  if (s === 14 && half) out.push({ voice: 'bass', note: root - 5, dur: 0.12, gain: 0.2 });

  /* --------------------------------------------------------------- chords */
  // supersaw stabs on the offbeats
  if (s % 4 === 2) {
    out.push({
      voice: 'stab',
      notes: chord.notes.map((n) => root + 12 + n),
      dur: 0.19,
      gain: 0.1 + 0.06 * energy,
    });
  }
  // wider sustained chord on the last bar to signal the loop turnaround
  if (lastBar && s === 0) {
    out.push({ voice: 'pad', notes: chord.notes.map((n) => root + 12 + n), dur: 1.4, gain: 0.06 });
  }

  /* ----------------------------------------------------------------- lead */
  if (half) {
    const leadOn = energy > 0.35;
    if (leadOn && s % 2 === 0) {
      const idx = ARP[(s / 2 + bar * 3) % ARP.length];
      const octave = energy > 0.7 ? 24 : 12;
      out.push({ voice: 'lead', note: root + octave + chord.notes[idx], dur: 0.14, gain: 0.075 + 0.05 * energy });
    }
    // sparkle on the very top of the phrase
    if (energy > 0.6 && bar % 2 === 1 && s === 12) {
      out.push({ voice: 'lead', note: root + 36 + chord.notes[0], dur: 0.22, gain: 0.06 });
    }
  }

  /* ------------------------------------------------------- transitions */
  if (lastBar && s >= 8) {
    // build-up riser into the loop restart
    out.push({ voice: 'riser', dur: stepSeconds(track) * 1.9, gain: 0.05 + 0.02 * ((s - 8) / 8) });
  }
  if (bar === 0 && s === 0) {
    out.push({ voice: 'impact', dur: 0.5, gain: 0.22 });
  }
  return out;
}

/** Convenience: every event of one full loop, for tests and previews. */
export function loopEvents(track, intensity = track.intensity) {
  const total = trackLength(track);
  const events = [];
  for (let step = 0; step < total; step++) {
    for (const ev of eventsAt(track, step, intensity)) events.push({ ...ev, step, time: step * stepSeconds(track) });
  }
  return events;
}
