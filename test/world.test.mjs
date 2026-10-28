// The world layer (grid, collide, move, path) against the games' own code,
// which it replaced or will: for the same inputs it must give the same
// outputs, bit for bit, or a runner would land somewhere else, a body slide
// another way round a wall, or a crowd take another way. The games' versions
// are kept here as they were: the White Dragon's World.hits, way and
// ladderAt and its runner's step (js/world.js, js/player.js), Lodestar's
// floorTile, rockAt, bodyHits, bodyInRock, moveBody and floorDistances
// (js/floor.js, js/game.js), and Merryfolk's findPath (js/world.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Tycho from '../dist/tycho.mjs';

const { grid, collide, move, path } = Tycho;
const { Rng, hashInts } = Tycho.seed;
const { lerp, clamp } = Tycho.math;
const WD = JSON.parse(readFileSync(new URL('./fixtures/wd-levels.json', import.meta.url), 'utf8'));

// ---- the White Dragon's originals -------------------------------------------
function wdWorld(L, props) {
  return {
    L, props,
    hits(x0, y0, x1, y1) {
      for (const r of this.L.solids) if (x1 > r.x0 && x0 < r.x1 && y1 > r.y0 && y0 < r.y1) return r;
      for (const p of this.props) if (p.block && !p.done) { const r = p.block; if (x1 > r.x0 && x0 < r.x1 && y1 > r.y0 && y0 < r.y1) return r; }
      if (x0 < 0 || x1 > this.L.w) return { x0: x0 < 0 ? -100 : this.L.w, y0: -1e4, x1: x0 < 0 ? 0 : this.L.w + 100, y1: 1e4 };
      return null;
    },
    way(x, y0, y1) {
      let best = null;
      for (const w of this.L.ways) {
        if (x < w.x0 || x > w.x1) continue;
        const y = w.y0 + (w.y1 - w.y0) * ((x - w.x0) / Math.max(1, w.x1 - w.x0));
        if (y >= y0 && y <= y1 && (best === null || y < best)) best = y;
      }
      return best;
    },
    ladderAt(x, y0, y1) { for (const l of this.L.ladders) if (Math.abs(x - l.x) < 6 && y1 > l.y0 && y0 < l.y1) return l; return null; },
  };
}
// the runner's step as it was, its use of the controls, the dev speed and
// the hold (what Use is busy at) made arguments; 'climb' where it returned
// early on a ladder
function wdStep(self, World, P, Input, sp, dt) {
  const box = (x, y) => [x - P.w / 2, y - P.h, x + P.w / 2, y];
  const hits = (x, y) => { const b = box(x, y); return World.hits(b[0] + 0.01, b[1] + 0.01, b[2] - 0.01, b[3] - 0.01); };
  const ax = Input.ax, ay = Input.ay;
  self.drop = Math.max(0, self.drop - dt);
  if (ax) self.face = ax > 0 ? 1 : -1;
  const jumpHit = Input.jumpHit;
  if (!self.ladder && Math.abs(ay) > 0.5 && Math.abs(ax) < 0.6) {
    const l = World.ladderAt(self.x, self.y - P.h, self.y + (ay > 0 ? 3 : 0));
    if (l && (ay < 0 ? self.y > l.y0 + 2 : self.y < l.y1 - 1)) { self.ladder = l; self.x = l.x; self.vx = 0; self.hold = null; }
  }
  if (self.ladder) {
    const l = self.ladder;
    self.vy = ay * P.climb; self.y += self.vy * dt; self.vx = 0;
    if (self.y <= l.y0) { self.y = l.y0; self.ladder = null; self.ground = true; self.vy = 0; }
    else if (self.y >= l.y1) { self.y = l.y1; self.ladder = null; self.ground = true; self.vy = 0; }
    else if (jumpHit) { self.ladder = null; self.vy = -P.jump * 0.7; self.vx = self.face * 60; }
    else if (Math.abs(ax) > 0.6 && Math.abs(ay) < 0.3) { self.ladder = null; }
    if (self.ladder) { self.walked += Math.abs(self.vy * dt); return 'climb'; }
  }
  const m = Math.abs(ax), pace = (m < 0.62 ? P.walk : lerp(P.walk, P.speed, clamp((m - 0.62) / 0.28, 0, 1))) * sp;
  const busy = self.hold ? 0.15 : 1, target = Math.sign(ax) * pace * busy, acc = self.ground ? P.accel : P.airAccel;
  if (ax) self.vx += clamp(target - self.vx, -acc * dt, acc * dt);
  else self.vx -= clamp(self.vx, -P.friction * dt, P.friction * dt);
  self.coyote = self.ground ? P.coyote : Math.max(0, self.coyote - dt);
  if (jumpHit) {
    const onWay = self.ground && !World.hits(self.x - 4, self.y, self.x + 4, self.y + 2) && World.way(self.x, self.y - 1, self.y + 1) !== null;
    if (ay > 0.5 && onWay) { self.drop = 0.25; self.ground = false; self.y += 1; }
    else if (self.coyote > 0) { self.vy = -P.jump; self.coyote = 0; self.ground = false; }
  }
  self.vy = Math.min(self.vy + P.gravity * dt, P.maxFall);
  if (!Input.jump && self.vy < -70) self.vy += P.gravity * dt * 0.9;
  let nx = self.x + self.vx * dt;
  const hx = hits(nx, self.y);
  if (hx) {
    let stepped = false;
    if (self.ground) for (let s = 2; s <= 7; s += 1) if (!hits(nx, self.y - s)) { self.y -= s; stepped = true; break; }
    if (!stepped) { nx = self.vx > 0 ? hx.x0 - P.w / 2 - 0.01 : hx.x1 + P.w / 2 + 0.01; if (hits(nx, self.y)) nx = self.x; self.vx = 0; }
  }
  self.walked += Math.abs(nx - self.x); self.x = nx;
  if (self.ground && self.vy >= 0 && !self.drop) { const s = World.way(self.x, self.y - 7, self.y + 7); if (s !== null && !hits(self.x, s)) self.y = s; }
  const wasY = self.y; let ny = self.y + self.vy * dt; self.ground = false;
  if (self.vy >= 0) {
    const hy = hits(self.x, ny);
    if (hy) { ny = hy.y0; self.vy = 0; self.ground = true; }
    else if (!self.drop) { const s = World.way(self.x, wasY - 0.5, ny + 0.5); if (s !== null) { ny = s; self.vy = 0; self.ground = true; } }
  } else {
    const hy = hits(self.x, ny);
    if (hy) { ny = hy.y1 + P.h + 0.01; self.vy = 0; }
  }
  self.y = ny;
  return 'move';
}

// ---- Lodestar's originals ----------------------------------------------------
const TILE = 16, TILE_EDGE = 3;
const TILE_SOLID = [false, true, true, true, false, false, false];
const TILE_RISES = [false, true, true, false, false, false, false];
const LS = {
  floorTile(f, tx, ty) { return tx < 0 || ty < 0 || tx >= f.w || ty >= f.h ? TILE_EDGE : f.tiles[ty * f.w + tx]; },
  wallNoise(x, y, scale) {
    const gx = x / scale, gy = y / scale, x0 = Math.floor(gx), y0 = Math.floor(gy);
    const u = gx - x0, v = gy - y0, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const n = (i, j) => (hashInts(i, j, 0x5a17) & 0xffff) / 32767.5 - 1;
    return lerp(lerp(n(x0, y0), n(x0 + 1, y0), su), lerp(n(x0, y0 + 1), n(x0 + 1, y0 + 1), su), sv);
  },
  rockAt(f, x, y, S = TILE_SOLID) {
    const gx = x / TILE - 0.5, gy = y / TILE - 0.5, tx = Math.floor(gx), ty = Math.floor(gy), u = gx - tx, v = gy - ty;
    const s = (i, j) => (S[LS.floorTile(f, i, j)] ? 1 : 0);
    const a = s(tx, ty), b = s(tx + 1, ty), c = s(tx, ty + 1), d = s(tx + 1, ty + 1);
    if (a === b && b === c && c === d) return a === 1;
    let blend = lerp(lerp(a, b, u), lerp(c, d, u), v);
    if (a === d && b === c) blend *= 0.55;
    return blend + (f.wallNoise !== undefined ? f.wallNoise : 0.14) * LS.wallNoise(x, y, 7) > 0.5;
  },
  RING: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]),
  bodyHits(f, x, y, r) {
    if (LS.rockAt(f, x, y)) return true;
    for (const [c, s] of LS.RING) if (LS.rockAt(f, x + c * r, y + s * r)) return true;
    if (f.solids) for (const o of f.solids) { const u = (x - o.x) / (o.rx + r), v = (y - o.y) / (o.ry + r); if (u * u + v * v < 1) return true; }
    return false;
  },
  bodyInRock(f, x, y, r) {
    let n = LS.rockAt(f, x, y) ? 2 : 0;
    for (const [c, s] of LS.RING) if (LS.rockAt(f, x + c * r, y + s * r)) n++;
    return n;
  },
  moveBody(f, b, dx, dy, r) {
    if (!dx && !dy) return;
    if (!LS.bodyHits(f, b.x + dx, b.y + dy, r)) { b.x += dx; b.y += dy; return; }
    if (LS.bodyHits(f, b.x, b.y, r)) {
      const was = LS.bodyInRock(f, b.x, b.y, r), now = LS.bodyInRock(f, b.x + dx, b.y + dy, r);
      if (now < was || (now === was && !LS.rockAt(f, b.x + dx, b.y + dy))) { b.x += dx; b.y += dy; }
      return;
    }
    const x0 = b.x, y0 = b.y;
    for (const [mx, my] of [[dx, 0], [0, dy]]) {
      if (!mx && !my) continue;
      let lo = 0, hi = 1;
      if (!LS.bodyHits(f, b.x + mx, b.y + my, r)) lo = 1;
      else for (let k = 0; k < 4; k++) { const mid = (lo + hi) / 2; if (LS.bodyHits(f, b.x + mx * mid, b.y + my * mid, r)) hi = mid; else lo = mid; }
      b.x += mx * lo; b.y += my * lo;
    }
    const m = Math.hypot(dx, dy);
    if (Math.hypot(b.x - x0, b.y - y0) < m * 0.3) {
      for (const turn of [0.7, -0.7, 1.2, -1.2]) {
        const c = Math.cos(turn), s = Math.sin(turn), tx = (dx * c - dy * s) * 0.8, ty = (dx * s + dy * c) * 0.8;
        if (!LS.bodyHits(f, x0 + tx, y0 + ty, r)) { b.x = x0 + tx; b.y = y0 + ty; return; }
      }
    }
  },
  floorDistances(tiles, w, h, x, y, avoid) {
    const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const d = new Int16Array(w * h).fill(-1), q = [y * w + x];
    d[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], cx = i % w, cy = (i - cx) / w;
      for (const [dx, dy] of DIRS4) {
        const j = (cy + dy) * w + cx + dx;
        if (d[j] < 0 && !TILE_SOLID[tiles[j]] && !(avoid && avoid[j])) { d[j] = d[i] + 1; q.push(j); }
      }
    }
    return d;
  },
};
// a floor like Lodestar's: rock dug out in lumps, an edge all round, some ore, a pad and a portal
function lodeFloor(seed, w = 64, h = 48, wallNoise) {
  const rng = new Rng(seed), tiles = new Uint8Array(w * h).fill(1);
  for (let n = 0; n < 40; n++) {
    const cx = rng.f(3, w - 3), cy = rng.f(3, h - 3), r = rng.f(1, 4.5);
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) tiles[y * w + x] = 0;
  }
  for (let i = 0; i < w * h; i++) if (tiles[i] === 1 && rng.chance(0.08)) tiles[i] = 2;
  for (let i = 0; i < w * h; i++) if (tiles[i] === 0 && rng.chance(0.01)) tiles[i] = rng.chance(0.5) ? 4 : 5;
  for (let x = 0; x < w; x++) { tiles[x] = TILE_EDGE; tiles[(h - 1) * w + x] = TILE_EDGE; }
  for (let y = 0; y < h; y++) { tiles[y * w] = TILE_EDGE; tiles[y * w + w - 1] = TILE_EDGE; }
  const f = { w, h, tiles, ore: new Uint8Array(w * h) };
  if (wallNoise !== undefined) f.wallNoise = wallNoise;
  return f;
}
// the same floor as Tycho sees it: a flat grid over its own arrays, its tiles felt along the wall line
function lodeSpace(f) {
  const g = new grid.Grid({ w: f.w, h: f.h, layers: [{ name: 'tiles', data: f.tiles, edge: TILE_EDGE }, { name: 'ore', data: f.ore }] });
  const rock = new collide.Tiles(g, 0, { size: TILE, solid: TILE_SOLID, smooth: { noise: (x, y) => LS.wallNoise(x, y, 7), amp: f.wallNoise !== undefined ? f.wallNoise : 0.14 } });
  const space = new collide.Space().tiles(rock).ellipses(() => f.solids || []);
  return { g, rock, space };
}

// ---- grid ------------------------------------------------------------------------
test('a flat grid wraps a game\'s arrays as they are, with the edge outside', () => {
  const f = lodeFloor(5);
  const { g } = lodeSpace(f);
  assert.equal(g.array(0), f.tiles);
  assert.equal(g.array(1), f.ore);
  for (let y = -3; y < f.h + 3; y++) for (let x = -3; x < f.w + 3; x++) assert.equal(g.get(0, x, y), LS.floorTile(f, x, y));
  assert.equal(g.get(1, -1, 0), 0);
  // set writes through to the game's array and marks its chunk's rectangle
  const v = f.tiles[9 * f.w + 40] === 4 ? 5 : 4;
  assert.equal(g.set(0, 40, 9, v), true); assert.equal(f.tiles[9 * f.w + 40], v);
  // (the same value again is no change)
  g.takeDirty(); g.set(0, 40, 9, v); assert.deepEqual(g.takeDirty(), []); g.set(0, 40, 9, v === 4 ? 5 : 4); g.set(0, 40, 9, v);
  g.set(0, 33, 3, 2); g.set(0, 5, 40, 4); g.set(0, 6, 41, 4);
  assert.equal(g.set(0, -1, 0, 0), false);
  assert.deepEqual(g.takeDirty(), [{ x0: 33, y0: 3, x1: 41, y1: 10 }, { x0: 5, y0: 40, x1: 7, y1: 42 }]);
  assert.deepEqual(g.takeDirty(), []);
});

test('a chunked grid makes its chunks when they\'re touched, in two sizes of tile', () => {
  let made = 0;
  const g = new grid.Grid({ w: 1000, h: 700, chunk: 16, layers: [{ name: 'ground', fill: 1, edge: 9 }, { name: 'light', bits: 16 }], make: (c) => { made++; for (let i = 0; i < 256; i++) c.cells[1][i] = c.cx * 1000 + c.cy + i; } });
  assert.equal(g.cw, 63); assert.equal(g.ch, 44);
  assert.equal(g.has(3, 4), false);
  assert.equal(g.get(0, 50, 70), 1); assert.equal(made, 1); assert.equal(g.has(3, 4), true);
  assert.equal(g.get(1, 48 + 5, 64 + 2), 3004 + 2 * 16 + 5);
  assert.equal(g.get(0, 1000, 0), 9); assert.equal(g.get(1, -1, 0), 0);
  g.set(1, 999, 699, 60000); assert.equal(g.get(1, 999, 699), 60000);
  g.fill(0, 10, 10, 40, 12, 7);
  for (let x = 10; x < 40; x++) assert.equal(g.get(0, x, 11), 7);
  assert.equal(g.get(0, 40, 11), 1);
  assert.throws(() => g.array(0));
  assert.throws(() => new grid.Grid({ w: 10, h: 10, chunk: 24, layers: [{ name: 'a' }] }));
});

test('a sealed grid keeps only the changes from what the seed made, and puts them back', () => {
  const make = (c) => { for (let i = 0; i < c.cells[0].length; i++) c.cells[0][i] = (hashInts(c.cx, c.cy, i) % 3); };
  const a = new grid.Grid({ w: 300, h: 200, layers: [{ name: 'tiles' }, { name: 'wet' }], make });
  for (let y = 0; y < 200; y += 7) a.get(0, 0, y); // (some chunks made before the seal)
  a.seal();
  const rng = new Rng(3), want = new Map();
  for (let n = 0; n < 500; n++) {
    const x = rng.i(0, 299), y = rng.i(0, 199), l = rng.i(0, 1), v = rng.i(0, 5);
    a.set(l, x, y, v);
  }
  // one set back to what the seed made isn't a change any more
  const seedV = a.get(0, 250, 150); a.set(0, 250, 150, (seedV + 1) % 3); a.set(0, 250, 150, seedV);
  const ch = a.changes();
  assert.ok(!(ch.tiles || []).some((_, i, L) => i % 3 === 0 && L[i] === 250 && L[i + 1] === 150));
  // a world made again from the seed, with them put back, is the same world
  const b = new grid.Grid({ w: 300, h: 200, layers: [{ name: 'tiles' }, { name: 'wet' }], make });
  b.seal(); b.apply(JSON.parse(JSON.stringify(ch)));
  for (let y = 0; y < 200; y++) for (let x = 0; x < 300; x++) for (const l of [0, 1]) assert.equal(b.get(l, x, y), a.get(l, x, y));
  assert.deepEqual(b.changes(), ch);
  // rows in order, x before y within one
  const t = ch.tiles;
  for (let i = 3; i < t.length; i += 3) assert.ok(t[i + 1] > t[i - 2] || (t[i + 1] === t[i - 2] && t[i] > t[i - 3]));
});

// ---- collide -----------------------------------------------------------------------
test('a Space answers the White Dragon\'s World.hits, way and ladderAt, bit for bit', () => {
  const rng = new Rng(17);
  for (const [id, L] of Object.entries(WD.levels)) {
    const props = [{ block: { x0: 300, y0: L.h - 80, x1: 330, y1: L.h - 44 } }, { block: { x0: 340, y0: L.h - 80, x1: 360, y1: L.h - 44 }, done: true }, {}];
    const W = wdWorld(L, props);
    const space = new collide.Space().boxes(L.solids).boxes(() => props, (p) => p.block && !p.done ? p.block : null).bounds(0, L.w).ways(L.ways).ladders(L.ladders);
    for (let n = 0; n < 20000; n++) {
      const x = rng.f(-30, L.w + 30), y = rng.f(L.h - 300, L.h + 10), w = rng.f(0, 14), h = rng.f(0, 34);
      const a = W.hits(x, y, x + w, y + h), b = space.hits(x, y, x + w, y + h);
      if (a && a.y0 === -1e4) assert.deepEqual(b, a, `${id}: the side at ${x}`); else assert.equal(b, a, `${id}: hits at ${x}, ${y}`);
      assert.equal(space.way(x, y, y + h), W.way(x, y, y + h));
      assert.equal(space.ladderAt(x, y, y + h), W.ladderAt(x, y, y + h));
    }
  }
});

test('Tiles answer Lodestar\'s rockAt on both its tables, and a Space its bodyHits and bodyInRock', () => {
  for (const [seed, wn] of [[1, undefined], [2, 0.03], [3, 0.3]]) {
    const f = lodeFloor(seed, 40, 30, wn);
    f.solids = [{ x: 200, y: 150, rx: 9, ry: 6 }, { x: 90, y: 300, rx: 4, ry: 4 }];
    const { rock, space } = lodeSpace(f);
    for (let y = -20; y < f.h * TILE + 20; y += 0.75) for (let x = -20; x < f.w * TILE + 20; x += 0.75) {
      assert.equal(rock.at(x, y), LS.rockAt(f, x, y));
      assert.equal(rock.at(x, y, TILE_RISES), LS.rockAt(f, x, y, TILE_RISES));
    }
    const rng = new Rng(seed);
    for (let n = 0; n < 40000; n++) {
      const x = rng.f(-10, f.w * TILE + 10), y = rng.f(-10, f.h * TILE + 10), r = rng.pick([4, 6, 9, 12]);
      assert.equal(space.circleHits(x, y, r), LS.bodyHits(f, x, y, r));
      assert.equal(space.circleDepth(x, y, r), LS.bodyInRock(f, x, y, r));
      assert.equal(space.inTiles(x, y), LS.rockAt(f, x, y));
    }
  }
});

test('square tiles, boxes, ellipses and the sides: points, bodies and rays', () => {
  const g = new grid.Grid({ w: 20, h: 12, chunk: 8, layers: [{ name: 'tiles', edge: 1 }] });
  const rng = new Rng(9);
  for (let n = 0; n < 50; n++) g.set(0, rng.i(0, 19), rng.i(0, 11), 1);
  const tiles = new collide.Tiles(g, 0, { size: 10, solid: [false, true] });
  const boxes = [{ x0: 35, y0: 22, x1: 61, y1: 40 }], ells = [{ x: 150, y: 60, rx: 12, ry: 7 }];
  const space = new collide.Space().boxes(boxes).tiles(tiles).ellipses(ells).bounds(0, 200);
  // the first solid tile under a box, as a box
  const t = (x, y) => g.get(0, Math.floor(x / 10), Math.floor(y / 10)) === 1;
  for (let n = 0; n < 3000; n++) {
    const x = rng.f(1, 180), y = rng.f(-15, 120), w = rng.f(1, 25), h = rng.f(1, 25);
    const hit = space.hits(x, y, x + w, y + h);
    let any = x + w > boxes[0].x0 && x < boxes[0].x1 && y + h > boxes[0].y0 && y < boxes[0].y1;
    for (let ty = Math.floor(y / 10); ty < Math.ceil((y + h) / 10); ty++) for (let tx = Math.floor(x / 10); tx < Math.ceil((x + w) / 10); tx++) if (g.get(0, tx, ty) === 1) any = true;
    assert.equal(!!hit, any || x + w > 200);
    if (hit && hit !== boxes[0] && hit.y0 !== -1e4) { assert.equal(hit.x1 - hit.x0, 10); assert.ok(t(hit.x0 + 5, hit.y0 + 5)); }
    const px = rng.f(-5, 205), py = rng.f(-5, 125);
    const inE = ((px - 150) / 12) ** 2 + ((py - 60) / 7) ** 2 < 1, inB = px >= 35 && px < 61 && py >= 22 && py < 40;
    assert.equal(space.solidAt(px, py), t(px, py) || inE || inB || px < 0 || px > 200);
  }
  // a ray stops where a fine walk along it first finds something solid
  for (let n = 0; n < 600; n++) {
    const x0 = rng.f(2, 198), y0 = rng.f(2, 118), x1 = rng.f(-20, 220), y1 = rng.f(-20, 140);
    const h = space.ray(x0, y0, x1, y1);
    const N = 4000; let ts = null;
    for (let k = 0; k <= N; k++) { const q = k / N; if (space.solidAt(x0 + (x1 - x0) * q, y0 + (y1 - y0) * q)) { ts = q; break; } }
    if (ts === null) { if (h) assert.ok(h.t <= 1); continue; }
    assert.ok(h, `a ray from ${x0},${y0} to ${x1},${y1} hit nothing, but the walk found something at ${ts}`);
    assert.ok(h.t <= ts + 1e-9 && h.t >= ts - 1.5 / N, `a ray hit at ${h.t}, the walk at ${ts}`);
  }
  // a smooth layer's ray is felt along the line
  const f = lodeFloor(4, 30, 20);
  const { space: ls } = lodeSpace(f);
  for (let n = 0; n < 200; n++) {
    const x0 = rng.f(16, 460), y0 = rng.f(16, 300), x1 = rng.f(16, 460), y1 = rng.f(16, 300);
    const h = ls.ray(x0, y0, x1, y1, 2);
    if (h) { assert.ok(LS.rockAt(f, h.x, h.y)); assert.equal(h.tile.v, LS.floorTile(f, Math.floor(h.x / 16), Math.floor(h.y / 16))); }
    else for (let k = 0; k <= 200; k++) { const q = k / 200, x = x0 + (x1 - x0) * q, y = y0 + (y1 - y0) * q; if (Math.hypot(x1 - x0, y1 - y0) / 200 >= 2) break; assert.ok(!LS.rockAt(f, x, y)); }
  }
});

// ---- move --------------------------------------------------------------------------
// a stretch of seeded random input: the stick and the jump changed every few
// frames, and now and then busy at something (the hold, which slows the pace)
function wdInput(rng, n) {
  const AX = [-1, -1, -0.75, -0.62, -0.5, -0.3, 0, 0, 0.3, 0.5, 0.62, 0.75, 0.9, 1, 1], AY = [-1, -1, -0.4, 0, 0, 0, 0.2, 0.6, 1, 1];
  const out = [];
  while (out.length < n) {
    const k = rng.i(3, 40), ax = rng.pick(AX), ay = rng.pick(AY), jump = rng.chance(0.5), busy = rng.chance(0.1);
    for (let i = 0; i < k; i++) out.push({ ax, ay, jump, jumpHit: i === 0 ? rng.chance(0.4) : rng.chance(0.02), busy });
  }
  return out;
}
function racePlatform(L, props, starts, frames, seed) {
  const rng = new Rng(seed), P = WD.player;
  const W = wdWorld(L, props);
  const space = new collide.Space().boxes(L.solids).boxes(() => props, (p) => p.block && !p.done ? p.block : null).bounds(0, L.w).ways(L.ways).ladders(L.ladders);
  const runner = new move.Platform(P);
  let n = 0;
  for (const [x, y] of starts) {
    const a = { x, y, vx: 0, vy: 0, face: 1, ground: true, coyote: 0, drop: 0, ladder: null, walked: 0, hold: null };
    const b = Object.assign({}, a);
    for (const c of wdInput(rng, frames)) {
      if (c.busy && !a.hold) a.hold = b.hold = {};
      else if (!c.busy) a.hold = b.hold = null;
      const was = wdStep(a, W, P, c, 1, 1 / 60);
      const r = runner.step(space, b, { ax: c.ax, ay: c.ay, jump: c.jump, jumpHit: c.jumpHit, scale: 1, busy: b.hold ? 0.15 : 1 }, 1 / 60);
      if (r.grabbed) b.hold = null;
      assert.equal(r.climbing, was === 'climb');
      for (const k of ['x', 'y', 'vx', 'vy', 'face', 'ground', 'coyote', 'drop', 'ladder', 'walked', 'hold']) assert.equal(b[k], a[k], `${L.id || 'level'} frame ${n}: ${k} is ${b[k]}, was ${a[k]}`);
      n++;
      // (fallen off the world: put back, as the game does)
      if (a.y > L.h + 40) { a.x = b.x = x; a.y = b.y = y; a.vx = a.vy = b.vx = b.vy = 0; a.ladder = b.ladder = null; a.ground = b.ground = true; }
    }
  }
  return n;
}

test('a Platform runner moves as the White Dragon\'s did, frame by frame, bit for bit', () => {
  let n = 0;
  for (const [id, L] of Object.entries(WD.levels)) {
    L.id = id;
    // from the ground every so far along, and from each walkway and ladder
    const G = L.solids[0].y0, starts = [];
    for (let x = 60; x < L.w - 60; x += Math.max(150, L.w / 12)) starts.push([x, G]);
    for (const w of L.ways) starts.push([(w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2]);
    for (const l of L.ladders) starts.push([l.x, l.y1]);
    n += racePlatform(L, [], starts, 360, id.length * 7 + 1);
  }
  assert.ok(n > 30000);
});

test('a Platform runner meets ceilings, steps up ledges and stops at props as the White Dragon\'s did', () => {
  // a level made to have what the game's don't yet: low ceilings, ledges
  // from 2 to 9 px, a wall hanging down, blocks from props (one done), stairs
  // both ways and a ladder up through a walkway
  const L = {
    id: 'made', w: 640, h: 300,
    solids: [{ x0: 0, y0: 250, x1: 640, y1: 300 }, { x0: 100, y0: 200, x1: 180, y1: 214 }, { x0: 200, y0: 246, x1: 230, y1: 250 }, { x0: 230, y0: 243, x1: 260, y1: 250 }, { x0: 260, y0: 236, x1: 290, y1: 250 }, { x0: 300, y0: 241, x1: 330, y1: 250 }, { x0: 380, y0: 150, x1: 396, y1: 236 }, { x0: 560, y0: 170, x1: 600, y1: 190 }],
    ways: [{ x0: 420, y0: 200, x1: 540, y1: 200 }, { x0: 400, y0: 250, x1: 420, y1: 200 }, { x0: 540, y0: 200, x1: 560, y1: 250 }, { x0: 560, y0: 214, x1: 620, y1: 214 }],
    ladders: [{ x: 470, y0: 150, y1: 250 }, { x: 610, y0: 190, y1: 250 }],
  };
  const props = [{ block: { x0: 480, y0: 226, x1: 500, y1: 250 } }, { block: { x0: 340, y0: 220, x1: 360, y1: 250 }, done: true }];
  const starts = [];
  for (let x = 40; x < 620; x += 30) starts.push([x, 250]);
  starts.push([470, 200], [590, 214], [140, 200]);
  const n = racePlatform(L, props, starts, 500, 99);
  assert.ok(n > 10000);
});

test('the topdown mover slides as Lodestar\'s moveBody did, bit for bit', () => {
  for (const [seed, wn] of [[11, undefined], [12, 0.03], [13, 0.25]]) {
    const f = lodeFloor(seed, 64, 48, wn);
    f.solids = [{ x: 400, y: 300, rx: 10, ry: 7 }];
    const { space } = lodeSpace(f);
    const rng = new Rng(seed * 3);
    // from open ground, wandering (and dashing), every radius the game has
    const open = [];
    for (let i = 0; i < f.w * f.h; i++) if (f.tiles[i] === 0) open.push(i);
    for (let k = 0; k < 24; k++) {
      const i = rng.pick(open), r = rng.pick([4, 4, 6, 9, 12]);
      const a = { x: (i % f.w + 0.5) * TILE + rng.f(-4, 4), y: (Math.floor(i / f.w) + 0.5) * TILE + rng.f(-4, 4) }, b = Object.assign({}, a);
      let ang = rng.f(Math.PI * 2), sp = 56;
      for (let n = 0; n < 400; n++) {
        if (n % 37 === 0) { ang = rng.f(Math.PI * 2); sp = rng.chance(0.15) ? 230 : rng.pick([36, 56, 90]); }
        ang += rng.f(-0.08, 0.08);
        const dx = n % 97 === 50 ? 0 : (Math.cos(ang) * sp) / 60, dy = (Math.sin(ang) * sp) / 60;
        LS.moveBody(f, a, dx, dy, r);
        move.topdown(space, b, dx, dy, r);
        assert.equal(b.x, a.x, `seed ${seed} body ${k} frame ${n}: x`);
        assert.equal(b.y, a.y, `seed ${seed} body ${k} frame ${n}: y`);
      }
    }
  }
});

// ---- path ----------------------------------------------------------------------------
test('distances are Lodestar\'s floorDistances, with and without ground to avoid', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const f = lodeFloor(seed, 70, 50), rng = new Rng(seed);
    const avoid = new Uint8Array(f.w * f.h);
    for (let i = 0; i < avoid.length; i++) if (rng.chance(0.05)) avoid[i] = 1;
    for (let k = 0; k < 6; k++) {
      const x = rng.i(1, f.w - 2), y = rng.i(1, f.h - 2);
      assert.deepEqual(path.distances(f.tiles, f.w, f.h, x, y, TILE_SOLID), LS.floorDistances(f.tiles, f.w, f.h, x, y));
      assert.deepEqual(path.distances(f.tiles, f.w, f.h, x, y, TILE_SOLID, avoid), LS.floorDistances(f.tiles, f.w, f.h, x, y, avoid));
    }
    // into a buffer of the caller's, 32 bits a tile
    const out = new Int32Array(f.w * f.h);
    assert.equal(path.distances(f.tiles, f.w, f.h, 5, 5, TILE_SOLID, null, out), out);
    assert.deepEqual([...out], [...LS.floorDistances(f.tiles, f.w, f.h, 5, 5)]);
  }
});

// Merryfolk's A*, as it was, over a map of its own
function merryfolk(MAP_W, MAP_H, tiles, block, level) {
  const TILE_COST = [2.4, 1, 0, 1, 3.5, 0, 1.8, 1, 3, 3], WATER = 2, HILL = 5, RAMP_COST = 2, BANK_COST = 6;
  const tIdx = (x, y) => y * MAP_W + x, inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const walkable = (x, y) => { if (!inMap(x, y)) return false; const t = tiles[tIdx(x, y)]; return t !== WATER && t !== HILL && !block[tIdx(x, y)]; };
  const isRoad = (t) => t === 3;
  const PF = { g: new Float32Array(MAP_W * MAP_H), f: new Float32Array(MAP_W * MAP_H), from: new Int32Array(MAP_W * MAP_H), stamp: new Uint32Array(MAP_W * MAP_H), closed: new Uint32Array(MAP_W * MAP_H), gen: 0, cap: Math.round((30000 * MAP_W * MAP_H) / (128 * 96)) };
  function nearestWalkable(tx, ty) {
    if (walkable(tx, ty)) return [tx, ty];
    for (let r = 1; r < 8; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      if (walkable(tx + i, ty + j)) return [tx + i, ty + j];
    }
    return null;
  }
  // the cost of a step, as findPath works it out
  const stepCost = (ni, cur) => {
    let c = TILE_COST[tiles[ni]];
    const lv = level;
    if (lv && lv[ni] !== lv[cur]) c += isRoad(tiles[ni]) || isRoad(tiles[cur]) ? RAMP_COST : BANK_COST * Math.abs(lv[ni] - lv[cur]);
    return c;
  };
  function findPath(sx, sy, tx, ty) {
    const s = nearestWalkable(sx, sy), t = nearestWalkable(tx, ty);
    if (!s || !t) return null;
    [sx, sy] = s; [tx, ty] = t;
    if (sx === tx && sy === ty) return [[tx, ty]];
    PF.gen++;
    const gen = PF.gen;
    const heap = [];
    const push = (n) => {
      heap.push(n); let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (PF.f[heap[p]] <= PF.f[heap[i]]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0]; const last = heap.pop();
      if (heap.length) {
        heap[0] = last; let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1; let m = i;
          if (l < heap.length && PF.f[heap[l]] < PF.f[heap[m]]) m = l;
          if (r < heap.length && PF.f[heap[r]] < PF.f[heap[m]]) m = r;
          if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    const hfn = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (dx + dy + (1.414 - 2) * Math.min(dx, dy)) * 1.0; };
    const si = tIdx(sx, sy), ti = tIdx(tx, ty);
    PF.g[si] = 0; PF.f[si] = hfn(sx, sy); PF.stamp[si] = gen; PF.from[si] = -1;
    push(si);
    let found = false, iter = 0;
    while (heap.length && iter++ < PF.cap) {
      const cur = pop();
      if (PF.closed[cur] === gen) continue;
      PF.closed[cur] = gen;
      if (cur === ti) { found = true; break; }
      const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!walkable(nx, ny)) continue;
        if (dx && dy && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
        const ni = tIdx(nx, ny);
        if (PF.closed[ni] === gen) continue;
        let c = stepCost(ni, cur);
        c *= dx && dy ? 1.414 : 1;
        const g = PF.g[cur] + c;
        if (PF.stamp[ni] !== gen || g < PF.g[ni]) {
          PF.stamp[ni] = gen; PF.g[ni] = g; PF.f[ni] = g + hfn(nx, ny); PF.from[ni] = cur; push(ni);
        }
      }
    }
    if (!found) return null;
    const out = [];
    for (let n = ti; n !== si && n !== -1; n = PF.from[n]) out.push([n % MAP_W, (n / MAP_W) | 0]);
    out.reverse();
    return out;
  }
  return { findPath, walkable, stepCost, cap: PF.cap };
}

test('AStar finds Merryfolk\'s paths, step for step, the game giving the costs', () => {
  for (const seed of [1, 2, 3]) {
    const W = 96, H = 72, rng = new Rng(seed);
    const tiles = new Uint8Array(W * H), block = new Uint8Array(W * H), level = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { tiles[i] = rng.weighted([[5, 0], [6, 1], [1.5, 2], [2, 3], [1, 4], [1, 5], [1, 6], [1, 7], [0.5, 8], [0.5, 9]]); block[i] = rng.chance(0.04) ? 1 : 0; level[i] = Math.floor((i % W) / 24 + Math.floor(i / W) / 30); }
    const M = merryfolk(W, H, tiles, block, level);
    const astar = new path.AStar(W, H, { cap: M.cap });
    let found = 0;
    for (let n = 0; n < 300; n++) {
      const sx = rng.i(-2, W + 1), sy = rng.i(-2, H + 1), tx = rng.i(0, W - 1), ty = rng.i(0, H - 1);
      const want = M.findPath(sx, sy, tx, ty);
      const got = astar.find(sx, sy, tx, ty, { walkable: M.walkable, cost: (x, y, fx, fy) => M.stepCost(y * W + x, fy * W + fx) });
      assert.deepEqual(got, want, `seed ${seed}: from ${sx},${sy} to ${tx},${ty}`);
      if (want && want.length > 3) found++;
    }
    assert.ok(found > 100);
    // a cap that runs out finds nothing
    const tight = new path.AStar(W, H, { cap: 5 });
    assert.equal(tight.find(1, 1, W - 2, H - 2, { walkable: () => true }), null);
  }
});

test('Routes find the cheapest way over places, with their legs in order', () => {
  // the White Dragon's walk-or-ride as a graph: two streets in a row (A
  // and B, a street's crossing between them off screen) and one in the band
  // below (C), each with a stand where a ride is had, in the band or down
  const R = new path.Routes();
  for (const [id, stand, len] of [['A', 500, 1000], ['B', 600, 1200], ['C', 450, 900]]) R.link(id + '.west', id + '.stand', stand, { walk: id + ' west' }).link(id + '.stand', id + '.east', len - stand, { walk: id + ' east' });
  R.link('A.east', 'B.west', 390, { gap: 'A-B' });
  R.link('A.stand', 'B.stand', 325, { ride: 'A-B' }).link('A.stand', 'C.stand', 455, { ride: 'A-C' }).link('B.stand', 'C.stand', 455, { ride: 'B-C' });
  // next door: across on foot
  const r1 = R.route('A.east', 'B.west');
  assert.deepEqual(r1, { cost: 390, places: ['A.east', 'B.west'], legs: [{ gap: 'A-B' }] });
  // end to end: a ride is quicker than walking both streets
  const r2 = R.route('A.west', 'B.east');
  assert.equal(r2.cost, 500 + 325 + 600);
  assert.deepEqual(r2.legs, [{ walk: 'A west' }, { ride: 'A-B' }, { walk: 'B east' }]);
  // the band below: only by a ride
  const r3 = R.route('A.east', 'C.east');
  assert.equal(r3.cost, 500 + 455 + 450);
  assert.deepEqual(r3.places, ['A.east', 'A.stand', 'C.stand', 'C.east']);
  // ties go to the links added first; nowhere joined, no route; one place, no legs
  const T2 = new path.Routes().link('x', 'y', 5, 'first').link('x', 'z', 2, 'xz').link('z', 'y', 3, 'zy');
  assert.deepEqual(T2.route('x', 'y').legs, ['first']);
  assert.equal(new path.Routes().link('p', 'q', 1).link('r', 's', 1).route('p', 's'), null);
  assert.equal(R.route('A.west', 'nowhere'), null);
  assert.deepEqual(R.route('B.west', 'B.west'), { cost: 0, places: ['B.west'], legs: [] });
  // one way only
  const O = new path.Routes().link('up', 'down', 1, 'fall', true);
  assert.equal(O.route('down', 'up'), null);
  assert.equal(O.route('up', 'down').cost, 1);
  assert.throws(() => new path.Routes().link('a', 'b', -1));
});

test('a Platform runner with a sprint walks, runs and sprints by how far the stick is pushed; without one it runs as before', () => {
  const space = new collide.Space().boxes([{ x0: -1000, y0: 100, x1: 100000, y1: 140 }]).bounds(-1000, 100000);
  const top = (runner, ax) => {
    const b = { x: 0, y: 100, vx: 0, vy: 0, face: 1, ground: true, coyote: 0, drop: 0, ladder: null, walked: 0 };
    for (let i = 0; i < 240; i++) runner.step(space, b, { ax, ay: 0, jump: false, jumpHit: false }, 1 / 60);
    return Math.round(b.vx);
  };
  const P = Object.assign({}, WD.player, { walk: 56, sprint: 196 });
  const tiers = new move.Platform(P, { walkUnder: 0.45, runSpan: 0.1, sprintFrom: 0.78, sprintSpan: 0.12 });
  assert.equal(top(tiers, 0.3), 56);       // a walk
  assert.equal(top(tiers, 0.5), 77);       // on the way to a run
  assert.equal(top(tiers, 0.66), 98);      // a run
  assert.equal(top(tiers, 0.84), 147);     // on the way to a sprint
  assert.equal(top(tiers, 1), 196);        // a sprint
  assert.equal(top(tiers, -1), -196);
  const plain = new move.Platform(WD.player);
  assert.equal(top(plain, 0.3), WD.player.walk);
  assert.equal(top(plain, 1), WD.player.speed);
});
