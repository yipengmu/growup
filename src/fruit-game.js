// All gameplay distances use stage short-side units; time uses seconds.
export const FRUIT_CONFIG = Object.freeze({ target: 12, maxFruit: 3, radius: .065, tolerance: .2, maxGap: .18, jump: 1.2, speed: .8, displacement: .1, trailLife: .22, effectLife: .95 });
export const FRUIT_TYPES = ['apple', 'orange', 'watermelon', 'strawberry'];
// MediaPipe image coordinates increase downward; use shoulder width for the raise margin.
export function handsRaised(pose) {
  if (![11, 12, 13, 14, 15, 16].every(i => pose?.[i]?.visibility >= .6 && Number.isFinite(pose[i].x) && Number.isFinite(pose[i].y))) return false;
  const width = Math.hypot(pose[11].x - pose[12].x, pose[11].y - pose[12].y);
  return width > .02 && pose[15].y < pose[11].y - width * .15 && pose[16].y < pose[12].y - width * .15;
}
export function sweptHit(a, b, before, after, radius) {
  const x = a.x - before.x, y = a.y - before.y;
  const dx = b.x - after.x - x, dy = b.y - after.y - y;
  const t = Math.max(0, Math.min(1, -(x * dx + y * dy) / (dx * dx + dy * dy || 1)));
  return (x + dx * t) ** 2 + (y + dy * t) ** 2 <= radius ** 2;
}
export function seededRandom(seed = 42) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}
export class HandInput {
  constructor() { this.clear(); }
  clear() { this.history = []; this.previous = null; }
  sample(point, raw, time, scale, enabled = true) {
    if (!enabled || !point || !raw || !Number.isFinite(scale) || scale <= 0) { this.clear(); return null; }
    const prev = this.previous;
    if (prev && (time - prev.time > FRUIT_CONFIG.maxGap || Math.hypot(raw.x - prev.raw.x, raw.y - prev.raw.y) / scale > FRUIT_CONFIG.jump)) this.clear();
    this.history = this.history.filter(p => time - p.time <= .15);
    const origin = this.history[0];
    const distance = origin ? Math.hypot(raw.x - origin.raw.x, raw.y - origin.raw.y) / scale : 0;
    const active = origin && distance >= FRUIT_CONFIG.displacement && distance / Math.max(.001, time - origin.time) >= FRUIT_CONFIG.speed;
    const moving = this.previous && Math.hypot(raw.x - this.previous.raw.x, raw.y - this.previous.raw.y) / scale / Math.max(.001, time - this.previous.time) >= FRUIT_CONFIG.speed;
    const segment = active && moving && this.previous ? { a: this.previous.point, b: point } : null;
    this.previous = { point: { ...point }, raw: { ...raw }, time };
    this.history.push(this.previous);
    return segment;
  }
}
export class CooperationBasket {
  total = 0; rounds = new Set();
  add(game) {
    if (game.status !== 'results' || game.demo || this.rounds.has(game.roundId)) return false;
    this.rounds.add(game.roundId); this.total += game.collected; return true;
  }
  clear() { this.total = 0; this.rounds.clear(); }
}
let roundSequence = 0;
export class FruitGame {
  constructor(options = {}) { this.random = seededRandom(options.seed ?? 42); this.status = 'setup'; this.fruits = []; this.effects = []; this.duration = 60; this.pace = 'slow'; this.demo = true; this.collected = 0; this.remaining = 60; this.bounds = { left: .2, right: .8, top: .3, bottom: .85 }; }
  prepare({ duration = 60, pace = 'slow', demo = true, autoStart = false } = {}) {
    this.autoStart = autoStart; this.duration = duration; this.pace = pace; this.demo = demo; this.remaining = duration; this.collected = 0; this.counts = Object.fromEntries(FRUIT_TYPES.map(t => [t, 0]));
    this.roundId = ++roundSequence; this.serial = 0; this.fruits = []; this.effects = []; this.stable = 0; this.status = 'calibrating'; this.tutorialDone = false; this.first = true; this.time = 0; this.spawnIn = .3; this.fruitBag = [];
  }
  tutorial() { if (this.status !== 'calibrating' || this.stable < 1) return; this.status = 'tutorial'; this.spawnIn = 0; }
  start() { if (this.status !== 'tutorial' || this.stable < 1) return; this.status = 'countdown'; this.countdown = 3; this.fruits = []; this.effects = []; this.first = true; this.spawnIn = .3; }
  end() { if (!['playing', 'countdown'].includes(this.status)) return; this.status = 'results'; this.fruits = []; this.effects = []; }
  dispose() { this.status = 'disposed'; this.fruits = []; this.effects = []; }
  spawn() {
    const b = this.bounds;
    if (!this.fruitBag.length) {
      this.fruitBag = [...FRUIT_TYPES];
      for (let i = this.fruitBag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.fruitBag[i], this.fruitBag[j]] = [this.fruitBag[j], this.fruitBag[i]];
      }
    }
    const fruit = { id: `${this.roundId}-${++this.serial}`, type: this.fruitBag.pop(), x: this.first ? (b.left + b.right) / 2 : b.left + (b.right - b.left) * this.random(), y: b.top, radius: FRUIT_CONFIG.radius, age: 0, vx: (this.random() - .5) * .015, vy: (b.bottom - b.top) / (this.status === 'tutorial' ? 6 : 3.6), status: 'falling' };
    this.first = false; this.fruits.push(fruit);
  }
  update(dt, ready, segments = [], raised = false) {
    if (!Number.isFinite(dt) || dt < 0) return;
    this.stable = ready ? this.stable + dt : 0;
    if (ready && raised && this.autoStart && this.status === 'calibrating') {
      this.status = 'playing';
      this.spawn(); this.spawnIn = this.pace === 'slow' ? 2 : 1.5;
      return;
    }
    if (this.status === 'countdown') {
      if (!ready) { this.countdown = 3; return; }
      this.countdown -= dt;
      if (this.countdown <= 0) { this.status = 'playing'; }
      return;
    }
    if (!['playing', 'tutorial'].includes(this.status)) return;
    if (this.status === 'playing') {
      dt = Math.min(dt, this.remaining); this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining <= 0) { this.end(); return; }
    }
    this.time += dt;
    // Real elapsed time counts even when a browser suspends rendering. Do not replay
    // old swipes or create a backlog of fruit when frames return after a long gap.
    if (dt > FRUIT_CONFIG.maxGap) {
      this.fruits = []; this.effects = []; this.spawnIn = .3;
      return;
    }
    this.effects = this.effects.filter(e => (e.age += dt) < FRUIT_CONFIG.effectLife);
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && this.fruits.length < (this.status === 'tutorial' ? 1 : FRUIT_CONFIG.maxFruit)) {
      if (!(this.status === 'tutorial' && this.tutorialDone)) this.spawn();
      this.spawnIn = (this.pace === 'slow' ? 2 : 1.5) + this.random() * .2;
    }
    for (const fruit of this.fruits) {
      const before = { x: fruit.x, y: fruit.y };
      fruit.age += dt;
      if (fruit.age > .25) { fruit.x += fruit.vx * dt; fruit.y += fruit.vy * dt; }
      for (const segment of segments) {
        if (!ready || fruit.age <= .25 || !sweptHit(segment.a, segment.b, before, fruit, fruit.radius * (1 + FRUIT_CONFIG.tolerance))) continue;
        fruit.status = 'sliced';
        this.effects.push({ ...fruit, age: 0, practice: this.status === 'tutorial', dx: segment.b.x - segment.a.x, dy: segment.b.y - segment.a.y });
        if (this.status === 'playing') { this.collected++; this.counts[fruit.type]++; } else this.tutorialDone = true;
        break;
      }
      if (fruit.status === 'falling' && (fruit.y > this.bounds.bottom + fruit.radius || fruit.age > 8)) fruit.status = 'expired';
    }
    this.fruits = this.fruits.filter(f => f.status === 'falling');
  }
}
