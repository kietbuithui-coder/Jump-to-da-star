/**
 * Input — keyboard + touch buttons + short input buffering.
 * The game reads intents (not raw keys) so PC and Android share one code path.
 */
const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'left',
  Space: 'boost',
  KeyW: 'boost',
  KeyJ: 'boost',
  ShiftLeft: 'skill',
  ShiftRight: 'skill',
  KeyK: 'skill',
  KeyL: 'skill',
  Escape: 'pause',
  KeyP: 'pause',
  Enter: 'confirm',
  KeyM: 'mute',
};

const GAME_KEYS = new Set(Object.keys(KEYMAP));

export class Input {
  constructor(target) {
    this.held = { left: false, right: false, boost: false, skill: false };
    this.virtual = { left: false, right: false, boost: false, skill: false };
    this.pressAt = { boost: -99, skill: -99, confirm: -99, pause: -99, mute: -99 };
    this.pressedFrame = new Set();
    this.enabled = true;
    this.anyInput = false;
    this.listeners = [];
    this._bound = false;
    if (target && typeof window !== 'undefined') this.attach(window);
  }

  attach(win) {
    if (this._bound) return;
    this._bound = true;
    const onKey = (e, down) => {
      if (!this.enabled) return;
      const action = KEYMAP[e.code];
      if (!action) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (down) this.press(action);
      else this.release(action);
      this.anyInput = true;
      this.listeners.forEach((fn) => fn(action, down, e));
    };
    win.addEventListener('keydown', (e) => {
      if (e.repeat) {
        if (GAME_KEYS.has(e.code)) e.preventDefault();
        return;
      }
      onKey(e, true);
    });
    win.addEventListener('keyup', (e) => onKey(e, false));
    win.addEventListener('blur', () => this.releaseAll());
  }

  onEvent(fn) {
    this.listeners.push(fn);
  }

  press(action) {
    this.held[action] = true;
    this.pressedFrame.add(action);
  }

  release(action) {
    this.held[action] = false;
  }

  releaseAll() {
    for (const k of Object.keys(this.held)) this.held[k] = false;
    for (const k of Object.keys(this.virtual)) this.virtual[k] = false;
  }

  /** Called by on-screen touch controls. */
  setVirtual(action, down) {
    if (!(action in this.virtual)) return;
    if (down && !this.virtual[action]) this.press(action);
    if (!down) this.release(action);
    this.virtual[action] = down;
    this.anyInput = true;
  }

  isDown(action) {
    return !!this.held[action] || !!this.virtual[action];
  }

  /** Was this action pressed within the last `window` seconds? (game clock) */
  buffered(action, now, window = 0.14) {
    return now - (this.pressAt[action] ?? -99) <= window;
  }

  consume(action, now, window = 0.14) {
    if (this.buffered(action, now, window)) {
      this.pressAt[action] = -99;
      return true;
    }
    return false;
  }

  /** Called once per rendered frame, after actions have been read. */
  endFrame(now) {
    for (const action of this.pressedFrame) {
      if (action in this.pressAt) this.pressAt[action] = now;
    }
    this.pressedFrame.clear();
  }

  get axis() {
    return (this.isDown('right') ? 1 : 0) + (this.isDown('left') ? -1 : 0);
  }
}
