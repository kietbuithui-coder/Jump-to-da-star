/**
 * Fixed timestep game loop. Gameplay never depends on FPS.
 * Backgrounded tabs are paused (and the accumulator clamped) so physics stays stable.
 */
export class Loop {
  constructor({ update, render, step = 1 / 120, maxFrameTime = 0.25 }) {
    this.update = update;
    this.render = render;
    this.step = step;
    this.maxFrameTime = maxFrameTime;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.frame = 0;
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsFrames = 0;
    this.onSecond = null;
    this._tick = this._tick.bind(this);
    this._raf = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  _tick(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, this.maxFrameTime);
    this.acc += dt;
    let steps = 0;
    const maxSteps = Math.ceil(this.maxFrameTime / this.step) + 2;
    while (this.acc >= this.step && steps < maxSteps) {
      this.update(this.step, now / 1000);
      this.acc -= this.step;
      steps++;
    }
    if (steps >= maxSteps) this.acc = 0; // never spiral
    this.frame++;
    this._fpsAcc += dt;
    this._fpsFrames++;
    if (this._fpsAcc >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAcc;
      this._fpsAcc = 0;
      this._fpsFrames = 0;
      if (this.onSecond) this.onSecond(this.fps);
    }
    this.render(dt, now / 1000);
  }
}
