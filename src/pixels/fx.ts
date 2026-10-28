// Small effects: particles thrown and falling, effects that run out, and
// words that rise over what they're about. Nothing here is saved or tested
// for its pictures, so an effect may draw from Tycho.seed.fxRand; the White
// Dragon's are drawn from hashes of the frame instead, and either works:
// an emitter takes the random source it's given.
//
//   tick     a list of effects, each with t (time left), counted down and
//            the spent ones dropped, in place (Lodestar's).
//   age      the same counted up, to each one's life (the White Dragon's puffs).
//   move     one particle: drag, gravity, motion, a bounce off its floor
//            (Lodestar's cast effects; without drag or a floor, the White
//            Dragon's sparks).
//   Particles a list of particles that moves and runs out, kept to a size.
//   sparks, burst  the White Dragon's emitters: sparks thrown up and falling
//            (a hot color), and a ring flying out.
//   rise     where a rising line of text is at an age, and how faded (the
//            White Dragon's gains).
//
// Bit for bit the games' own (test/pixels.test.mjs).

/** Anything with time left. */
export interface Timed { t: number }

/** Counts each one's time down by dt and drops those run out (t <= 0), in
 * place. Returns the list. */
export function tick<E extends Timed>(list: E[], dt: number): E[] {
  let m = 0;
  for (const o of list) if ((o.t -= dt) > 0) list[m++] = o;
  list.length = m;
  return list;
}

/** Counts each one's age (t) up by dt and drops those past their life
 * (`life`, or the one given for all), in place. Returns the list. */
export function age<E extends Timed & { life?: number }>(list: E[], dt: number, life?: number): E[] {
  let m = 0;
  for (const o of list) { o.t += dt; if (o.t < (life === undefined ? (o.life as number) : life)) list[m++] = o; }
  list.length = m;
  return list;
}

/** A particle: where it is, how it moves, its time left. Gravity `g` (px/s²),
 * `drag` (the share of speed lost a second, as e^(-drag·dt)), and a `floor`
 * it bounces off (y down). Anything else it carries is the game's. */
export interface Particle extends Timed { x: number; y: number; vx: number; vy: number; g?: number; drag?: number; floor?: number }

/** How a particle bounces off its floor: how much of its fall it keeps
 * (0.35) and of its slide (0.6). */
export interface Bounce { bounce?: number; slide?: number }

/** Moves a particle by dt: drag, then gravity, then motion; landing on its
 * floor while falling, it bounces. */
export function move(q: Particle, dt: number, o: Bounce = {}): void {
  if (q.drag) { const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k; }
  q.vy += (q.g || 0) * dt;
  q.x += q.vx * dt; q.y += q.vy * dt;
  if (q.floor !== undefined && q.y > q.floor && q.vy > 0) { q.y = q.floor; q.vy *= -(o.bounce === undefined ? 0.35 : o.bounce); q.vx *= o.slide === undefined ? 0.6 : o.slide; }
}

/** A list of particles that move and run out, kept under a size: past `max`
 * the oldest go until `keep` are left (260 and 200, the White Dragon's). */
export class Particles<P extends Particle = Particle> {
  list: P[]; max: number; keep: number; bounce: Bounce;
  constructor(o: { max?: number; keep?: number } & Bounce = {}) {
    this.list = []; this.max = o.max === undefined ? 260 : o.max; this.keep = o.keep === undefined ? 200 : o.keep;
    this.bounce = { bounce: o.bounce, slide: o.slide };
  }
  add(p: P): P { this.list.push(p); return p; }
  /** The oldest let go if there are too many. */
  cap(): void { if (this.list.length > this.max) this.list.splice(0, this.list.length - this.keep); }
  /** Each moves by dt and loses dt of its time; those run out go. */
  step(dt: number): void {
    const L = this.list;
    let m = 0;
    for (const q of L) { if ((q.t -= dt) <= 0) continue; move(q, dt, this.bounce); L[m++] = q; }
    L.length = m;
  }
  get length(): number { return this.list.length; }
}

/** A random source for an emitter: the k-th particle's s-th draw, 0..1 (the
 * White Dragon's is hash(frame, k, s); fxRand.f() ignores both). */
export type Draw = (k: number, s: number) => number;

/** Sparks thrown up and falling: n of them from (x, y), each its own speed,
 * life and a hot color from orange to yellow (the White Dragon's). */
export function sparks(x: number, y: number, n: number, draw: Draw, o: { spread?: number; up?: number; upMore?: number; life?: number; lifeMore?: number; g?: number } = {}): (Particle & { c: number[] })[] {
  const spread = o.spread === undefined ? 160 : o.spread, up = o.up === undefined ? 40 : o.up, upMore = o.upMore === undefined ? 110 : o.upMore;
  const life = o.life === undefined ? 0.25 : o.life, lifeMore = o.lifeMore === undefined ? 0.35 : o.lifeMore, g = o.g === undefined ? 400 : o.g, out: (Particle & { c: number[] })[] = [];
  for (let k = 0; k < n; k++) { const h1 = draw(k, 1), h2 = draw(k, 2), h3 = draw(k, 3); out.push({ x, y, vx: (h1 - 0.5) * spread, vy: -up - h2 * upMore, t: life + h3 * lifeMore, c: [255, 160 + h3 * 90, 60 + h3 * 120], g }); }
  return out;
}

/** A ring of n flying out from (x, y) in one color, each a little off its
 * place round the ring and its own speed and life (the White Dragon's). */
export function burst<C>(x: number, y: number, c: C, n: number, draw: Draw, o: { speed?: number; speedMore?: number; life?: number; lifeMore?: number } = {}): (Particle & { c: C })[] {
  const sp = o.speed === undefined ? 40 : o.speed, spMore = o.speedMore === undefined ? 70 : o.speedMore, life = o.life === undefined ? 0.3 : o.life, lifeMore = o.lifeMore === undefined ? 0.3 : o.lifeMore, out: (Particle & { c: C })[] = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + draw(k, 4), s = sp + draw(k, 5) * spMore; out.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: life + draw(k, 6) * lifeMore, c, g: 0 }); }
  return out;
}

/** How rising lines of text go. */
export interface RiseOpts {
  /** Px a second it rises (12). */
  speed?: number;
  /** Px between the lines of one rising (21). */
  line?: number;
  /** When it starts to fade (1.8 s), how long the fade takes (0.6 s), and
   * when it's gone (2.4 s). */
  fade?: number; out?: number; life?: number;
}

/** Where the i-th of `of` lines rising together is at an age (seconds): how
 * far above where it started its line sits (`stack`: the first highest) and
 * how far it has risen (`up`), and its opacity; null before it starts or
 * once it's gone. (Its place is start - stack - up.) */
export function rise(age: number, i = 0, of = 1, o: RiseOpts = {}): { stack: number; up: number; alpha: number } | null {
  const life = o.life === undefined ? 2.4 : o.life, fade = o.fade === undefined ? 1.8 : o.fade, out = o.out === undefined ? 0.6 : o.out;
  if (age < 0 || !(age < life)) return null;
  return { stack: (of - 1 - i) * (o.line === undefined ? 21 : o.line), up: age * (o.speed === undefined ? 12 : o.speed), alpha: age > fade ? Math.max(0, 1 - (age - fade) / out) : 1 };
}
