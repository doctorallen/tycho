// Tycho.move: bodies moved against a Space (collide.ts), a fixed step at a
// time. Two movers, each a game's own moved in exactly:
//
//   Platform  a side-on runner (the White Dragon's): a box with gravity,
//             a pace set by how far the stick is pushed, coyote time, a
//             jump cut short when it's let go, small ledges stepped up,
//             walkways and stairs stood on from above, followed down and
//             dropped through, and ladders climbed, jumped off and let go
//   topdown   a round body seen from above (Lodestar's): it slides along
//             what stops it one axis at a time, works its way out of a
//             wedge, and goes round a curve it meets head on
//
// The game keeps its own player and actors and calls the mover with its
// numbers and its controls; what the mover does is the same for the same
// inputs, bit for bit.

import { clamp, lerp } from '../core/math';
import type { Ladder, Space } from './collide';

/** A platform body: x is the middle of its feet, y its soles (world px). */
export interface PlatformBody {
  x: number; y: number; vx: number; vy: number;
  /** 1 facing right, -1 left. */
  face: number;
  ground: boolean;
  /** Seconds left to jump after leaving the ground. */
  coyote: number;
  /** Seconds left falling through walkways. */
  drop: number;
  /** The ladder it's on, or null. */
  ladder: Ladder | null;
  /** Distance walked and climbed (for the stride). */
  walked: number;
}

/** A step's controls. */
export interface PlatformControl {
  /** The stick: -1..1 across, -1 (up) ..1 (down). */
  ax: number; ay: number;
  /** Jump held, and pressed since the last step. */
  jump: boolean; jumpHit: boolean;
  /** The pace times this (1). */
  scale?: number;
  /** The pace times this too, as long as no ladder is taken this step (1): slowed while busy at something. */
  busy?: number;
}

/** The body's size and the speeds (px, px/s, px/s², s), read every step. */
export interface PlatformNumbers {
  w: number; h: number;
  /** Running and walking pace. */
  speed: number; walk: number;
  /** Toward the pace on the ground and in the air; slowing with the stick let go. */
  accel: number; airAccel: number; friction: number;
  jump: number; gravity: number; maxFall: number;
  coyote: number;
  /** Up and down a ladder. */
  climb: number;
}

/** The feel's finer numbers: each defaults to the White Dragon's. */
export interface PlatformOptions {
  /** Under this push of the stick, a walk; then to a run over this much more (0.62, 0.28). */
  walkUnder?: number; runSpan?: number;
  /** A ladder's taken with the stick up or down past grabY and not across past grabX (0.5, 0.6). */
  grabY?: number; grabX?: number;
  /** How far below the feet a ladder's reached going down (3); not within grabTop of its top going up, or grabBottom of its foot going down (2, 1). */
  grabBelow?: number; grabTop?: number; grabBottom?: number;
  /** Jumping off a ladder: this share of a jump, and this fast the way it faces (0.7, 60). */
  leap?: number; leapKick?: number;
  /** Let go of a ladder with the stick across past letGoX and not up or down past letGoY (0.6, 0.3). */
  letGoX?: number; letGoY?: number;
  /** Down past dropY and jump drops through a walkway (not one over something solid within dropFoot of the feet), passing through them for dropTime (0.5, 4, 0.25). */
  dropY?: number; dropFoot?: number; dropTime?: number;
  /** Jump let go while rising faster than hop: gravity this much more (70, 0.9). */
  hop?: number; hopGravity?: number;
  /** Ledges from stepMin to stepMax high stepped up (2, 7). */
  stepMin?: number; stepMax?: number;
  /** Stairs followed this far up or down while walking on them (7). */
  follow?: number;
}

const PLATFORM: Required<PlatformOptions> = {
  walkUnder: 0.62, runSpan: 0.28, grabY: 0.5, grabX: 0.6, grabBelow: 3, grabTop: 2, grabBottom: 1,
  leap: 0.7, leapKick: 60, letGoX: 0.6, letGoY: 0.3, dropY: 0.5, dropFoot: 4, dropTime: 0.25,
  hop: 70, hopGravity: 0.9, stepMin: 2, stepMax: 7, follow: 7,
};

/** What a step did: ended on a ladder, and took one. */
export interface PlatformResult { climbing: boolean; grabbed: boolean }

export class Platform {
  /** The numbers, kept by reference (a game's tuning can change under it). */
  readonly n: PlatformNumbers;
  readonly o: Required<PlatformOptions>;
  private readonly res: PlatformResult = { climbing: false, grabbed: false };

  constructor(numbers: PlatformNumbers, options: PlatformOptions = {}) {
    this.n = numbers;
    this.o = Object.assign({}, PLATFORM, options);
  }

  /** The body's box at x, y: [x0, y0, x1, y1]. */
  box(x: number, y: number): [number, number, number, number] { const P = this.n; return [x - P.w / 2, y - P.h, x + P.w / 2, y]; }

  /** What the body's box at x, y overlaps (a hair inside its edges), or null. */
  hits(space: Space, x: number, y: number) {
    const P = this.n;
    return space.hits(x - P.w / 2 + 0.01, y - P.h + 0.01, x + P.w / 2 - 0.01, y - 0.01);
  }

  /** One step of dt seconds. The result is kept and reused: read it before the next step. */
  step(space: Space, b: PlatformBody, c: PlatformControl, dt: number): PlatformResult {
    const P = this.n, O = this.o, res = this.res;
    const ax = c.ax, ay = c.ay, jumpHit = c.jumpHit;
    let busy = c.busy === undefined ? 1 : c.busy;
    res.climbing = false; res.grabbed = false;
    b.drop = Math.max(0, b.drop - dt);
    if (ax) b.face = ax > 0 ? 1 : -1;
    // ---- on a ladder
    if (!b.ladder && Math.abs(ay) > O.grabY && Math.abs(ax) < O.grabX) {
      const l = space.ladderAt(b.x, b.y - P.h, b.y + (ay > 0 ? O.grabBelow : 0));
      if (l && (ay < 0 ? b.y > l.y0 + O.grabTop : b.y < l.y1 - O.grabBottom)) { b.ladder = l; b.x = l.x; b.vx = 0; res.grabbed = true; busy = 1; }
    }
    if (b.ladder) {
      const l = b.ladder;
      b.vy = ay * P.climb; b.y += b.vy * dt; b.vx = 0;
      if (b.y <= l.y0) { b.y = l.y0; b.ladder = null; b.ground = true; b.vy = 0; }
      else if (b.y >= l.y1) { b.y = l.y1; b.ladder = null; b.ground = true; b.vy = 0; }
      else if (jumpHit) { b.ladder = null; b.vy = -P.jump * O.leap; b.vx = b.face * O.leapKick; }
      else if (Math.abs(ax) > O.letGoX && Math.abs(ay) < O.letGoY) { b.ladder = null; }
      if (b.ladder) { b.walked += Math.abs(b.vy * dt); res.climbing = true; return res; }
    }
    // ---- running: the stick sets the pace, a light push walks and a full one runs
    const m = Math.abs(ax), sp = c.scale === undefined ? 1 : c.scale;
    const pace = (m < O.walkUnder ? P.walk : lerp(P.walk, P.speed, clamp((m - O.walkUnder) / O.runSpan, 0, 1))) * sp;
    const target = Math.sign(ax) * pace * busy, acc = b.ground ? P.accel : P.airAccel;
    if (ax) b.vx += clamp(target - b.vx, -acc * dt, acc * dt);
    else b.vx -= clamp(b.vx, -P.friction * dt, P.friction * dt);
    // ---- jumping, dropping through
    b.coyote = b.ground ? P.coyote : Math.max(0, b.coyote - dt);
    if (jumpHit) {
      const onWay = b.ground && !space.hits(b.x - O.dropFoot, b.y, b.x + O.dropFoot, b.y + 2) && space.way(b.x, b.y - 1, b.y + 1) !== null;
      if (ay > O.dropY && onWay) { b.drop = O.dropTime; b.ground = false; b.y += 1; }
      else if (b.coyote > 0) { b.vy = -P.jump; b.coyote = 0; b.ground = false; }
    }
    b.vy = Math.min(b.vy + P.gravity * dt, P.maxFall);
    if (!c.jump && b.vy < -O.hop) b.vy += P.gravity * dt * O.hopGravity;
    // ---- across: step up a small ledge, or stop at the wall
    let nx = b.x + b.vx * dt;
    const hx = this.hits(space, nx, b.y);
    if (hx) {
      let stepped = false;
      if (b.ground) for (let s = O.stepMin; s <= O.stepMax; s += 1) if (!this.hits(space, nx, b.y - s)) { b.y -= s; stepped = true; break; }
      if (!stepped) { nx = b.vx > 0 ? hx.x0 - P.w / 2 - 0.01 : hx.x1 + P.w / 2 + 0.01; if (this.hits(space, nx, b.y)) nx = b.x; b.vx = 0; }
    }
    b.walked += Math.abs(nx - b.x); b.x = nx;
    // following stairs down or up while walking on them
    if (b.ground && b.vy >= 0 && !b.drop) { const s = space.way(b.x, b.y - O.follow, b.y + O.follow); if (s !== null && !this.hits(space, b.x, s)) b.y = s; }
    // ---- down (or up)
    const wasY = b.y;
    let ny = b.y + b.vy * dt;
    b.ground = false;
    if (b.vy >= 0) {
      const hy = this.hits(space, b.x, ny);
      if (hy) { ny = hy.y0; b.vy = 0; b.ground = true; }
      else if (!b.drop) { const s = space.way(b.x, wasY - 0.5, ny + 0.5); if (s !== null) { ny = s; b.vy = 0; b.ground = true; } }
    } else {
      const hy = this.hits(space, b.x, ny);
      if (hy) { ny = hy.y1 + P.h + 0.01; b.vy = 0; }
    }
    b.y = ny;
    return res;
  }
}

/** The finer numbers of the top-down slide: each defaults to Lodestar's. */
export interface TopdownOptions {
  /** Halvings to find how far an axis goes before it's stopped (4). */
  bisect?: number;
  /** Moved less than this share of the way: met a curve head on (0.3). */
  round?: number;
  /** The turns tried to go round it, in order (radians: 0.7, -0.7, 1.2, -1.2), at this share of the step (0.8). */
  turns?: readonly number[]; reach?: number;
}

const TURNS = [0.7, -0.7, 1.2, -1.2];
const TURN_CS = TURNS.map((t) => [Math.cos(t), Math.sin(t)]);

/**
 * Moves a round body of radius r at b.x, b.y by dx, dy against the space
 * (Lodestar's moveBody). Clear: it goes. Already wedged in something (pushed
 * onto a ragged edge): it may work its way out, or along at the same depth
 * with its middle clear, but never deeper in. Blocked: it slides along, one
 * axis at a time, as far as each goes; and if that got it less than a third
 * of the way, it tries going round, a little either side, then more.
 */
export function topdown(space: Space, b: { x: number; y: number }, dx: number, dy: number, r: number, o: TopdownOptions = {}): void {
  if (!dx && !dy) return;
  if (!space.circleHits(b.x + dx, b.y + dy, r)) { b.x += dx; b.y += dy; return; }
  if (space.circleHits(b.x, b.y, r)) {
    const was = space.circleDepth(b.x, b.y, r), now = space.circleDepth(b.x + dx, b.y + dy, r);
    if (now < was || (now === was && !space.inTiles(b.x + dx, b.y + dy))) { b.x += dx; b.y += dy; }
    return;
  }
  const x0 = b.x, y0 = b.y, halvings = o.bisect === undefined ? 4 : o.bisect;
  for (let axis = 0; axis < 2; axis++) {
    const mx = axis ? 0 : dx, my = axis ? dy : 0;
    if (!mx && !my) continue;
    let lo = 0, hi = 1;
    if (!space.circleHits(b.x + mx, b.y + my, r)) lo = 1;
    else for (let k = 0; k < halvings; k++) { const mid = (lo + hi) / 2; if (space.circleHits(b.x + mx * mid, b.y + my * mid, r)) hi = mid; else lo = mid; }
    b.x += mx * lo; b.y += my * lo;
  }
  const m = Math.hypot(dx, dy);
  if (Math.hypot(b.x - x0, b.y - y0) < m * (o.round === undefined ? 0.3 : o.round)) {
    const turns = o.turns ? o.turns.map((t) => [Math.cos(t), Math.sin(t)]) : TURN_CS, k = o.reach === undefined ? 0.8 : o.reach;
    for (const [c, s] of turns) {
      const tx = (dx * c - dy * s) * k, ty = (dx * s + dy * c) * k;
      if (!space.circleHits(x0 + tx, y0 + ty, r)) { b.x = x0 + tx; b.y = y0 + ty; return; }
    }
  }
}
