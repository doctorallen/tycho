// buildings-shared.js: what the buildings demos (house, occlusion) share, loaded before either.
// A small z-buffered rasterizer for isometric 2:1 pictures in palette indexes, with the frogs' outline as a pass after;
// a house generator (footprint by climate, rooms by squarified treemap inside zones, doors by a room graph, furniture
// by rules checked with a flood fill, and a hip, gable or flat roof); the house cut into boxes that paint themselves;
// and the two depth sorts the occlusion demo compares. Every random choice comes from Kit.rng, so a seed rebuilds a house.
(() => {
  // A tile is 16 x 8 px and a unit of height is 8 px: sx = (x - y) * 8, sy = (x + y) * 4 - z * 8.
  // Along a view ray (1, 1, 1) the picture doesn't change, so x + y + z is the depth: larger is nearer.
  const T = 0.125, H = 2.5, STUB = 0.45, DOOR_H = 2.0; // wall thickness, wall height, cut-wall height, door height
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  class Raster {
    constructor(w, h, ox, oy) {
      Object.assign(this, { w, h, ox, oy, id: 0, isFlat: false });
      const n = w * h;
      this.col = new Int16Array(n).fill(-1); this.dep = new Float32Array(n).fill(-1e9);
      this.obj = new Int16Array(n).fill(-1); this.flat = new Uint8Array(n);
    }
    P(x, y, z) { return [this.ox + (x - y) * 8, this.oy + (x + y) * 4 - z * 8, x + y + z]; }
    // a triangle of projected points, depth interpolated, sampled at pixel centers; equal depth lets the later one win
    tri(a, b, c, col, bias = 0) {
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-9) return;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(this.w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(this.h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const wa = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
        const wb = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
        const wc = 1 - wa - wb;
        if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
        const d = wa * a[2] + wb * b[2] + wc * c[2] + bias, i = y * this.w + x;
        if (d < this.dep[i]) continue;
        this.dep[i] = d; this.col[i] = col; this.obj[i] = this.id; this.flat[i] = this.isFlat ? 1 : 0;
      }
    }
    poly(pts, col, bias = 0) { const p = pts.map(q => this.P(...q)); for (let i = 1; i + 1 < p.length; i++) this.tri(p[0], p[i], p[i + 1], col, bias); }
    line(a, b, col, bias = 0.06) {
      const p = this.P(...a), q = this.P(...b), n = Math.max(1, Math.ceil(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]))));
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = Math.floor(p[0] + (q[0] - p[0]) * t), y = Math.floor(p[1] + (q[1] - p[1]) * t);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const i = y * this.w + x, d = p[2] + (q[2] - p[2]) * t + bias;
        if (d < this.dep[i]) continue;
        this.dep[i] = d; this.col[i] = col; this.obj[i] = this.id; this.flat[i] = this.isFlat ? 1 : 0;
      }
    }
    // faces of a box: the top, the face looking down-left (normal +y) and the face looking down-right (normal +x)
    top(z, xa, xb, ya, yb, c, bias = 0) { this.poly([[xa, ya, z], [xb, ya, z], [xb, yb, z], [xa, yb, z]], c, bias); }
    faceY(y, xa, xb, za, zb, c, bias = 0) { this.poly([[xa, y, za], [xb, y, za], [xb, y, zb], [xa, y, zb]], c, bias); }
    faceX(x, ya, yb, za, zb, c, bias = 0) { this.poly([[x, ya, za], [x, yb, za], [x, yb, zb], [x, ya, zb]], c, bias); }
    box(b, [ct, cl, cr]) {
      this.faceY(b.y1, b.x0, b.x1, b.z0, b.z1, cl); this.faceX(b.x1, b.y0, b.y1, b.z0, b.z1, cr); this.top(b.z1, b.x0, b.x1, b.y0, b.y1, ct);
    }
    // the frogs' rule: a dark line round everything. A pixel becomes outline where its neighbor is empty, flat ground,
    // or a different object further away. Flat things (ground, floors, rugs) are never outlined themselves.
    // same(a, b) says two object ids are one thing (the two pieces of a cut wall), so no line runs between them.
    outline(ink = 0, same = (a, b) => a === b) {
      const { w, h, col, dep, obj, flat } = this, mark = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (col[i] < 0 || flat[i]) continue;
        const behind = j => col[j] < 0 || flat[j] || (!same(obj[j], obj[i]) && dep[j] < dep[i] - 0.05);
        if ((x > 0 && behind(i - 1)) || (x < w - 1 && behind(i + 1)) || (y > 0 && behind(i - w)) || (y < h - 1 && behind(i + w))) mark.push(i);
      }
      for (const i of mark) col[i] = ink;
    }
    // to a canvas; keep(i) picks pixels, and level 0..4 keeps a Bayer share of them at screen position (gx, gy) + (x, y)
    canvas(keep = null, level = 4, gx = 0, gy = 0) {
      const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
      const img = new ImageData(this.w, this.h), o = img.data;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x, c = this.col[i];
        if (c < 0 || (keep && !keep(i))) continue;
        if (level < 4 && BAYER[((gy + y) & 3) * 4 + ((gx + x) & 3)] >= level * 4) continue;
        const p = Kit.RGB[c]; o[i * 4] = p[0]; o[i * 4 + 1] = p[1]; o[i * 4 + 2] = p[2]; o[i * 4 + 3] = 255;
      }
      cv.getContext('2d').putImageData(img, 0, 0); return cv;
    }
  }
  // screen bounds of a world box, for sizing a sprite
  const bounds = (b, m = 2) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
      const sx = (x - y) * 8, sy = (x + y) * 4 - z * 8;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return { x: Math.floor(x0) - m, y: Math.floor(y0) - m, w: Math.ceil(x1 - x0) + 2 * m + 1, h: Math.ceil(y1 - y0) + 2 * m + 1 };
  };

  // ---- climates: footprint, roof, pitch and materials. Colors are Kit.PAL indexes: faces are [top, left (lit), right (shade)] ----
  const CLIMATES = {
    Snowy: { roofs: ['gable'], pitch: 52, w: [5, 7], d: [4, 6], wall: [29, 28, 27], wmark: 26, kind: 'timber', roof: [7, 6, 5], ridge: 7, rmark: 5,
      ground: 6, gmarks: [7, 5], win: 0.35, winH: [1.0, 1.6], chimney: true },
    Temperate: { roofs: ['hip', 'gable'], pitch: 38, w: [6, 10], d: [4, 7], wall: [6, 7, 5], wmark: 4, kind: 'plaster', roof: [12, 11, 10], ridge: 13, rmark: 9,
      ground: 17, gmarks: [18, 16], win: 0.55, winH: [0.95, 1.75], chimney: true },
    Arid: { roofs: ['flat'], pitch: 0, w: [6, 9], d: [4, 5], wall: [13, 12, 11], wmark: 27, kind: 'adobe', roof: [29, 28, 27],
      ground: 13, gmarks: [29, 12], win: 0.3, winH: [1.15, 1.6], L: true },
    Wetland: { roofs: ['hip'], pitch: 47, w: [5, 8], d: [4, 5], wall: [29, 13, 28], wmark: 28, kind: 'bamboo', roof: [13, 29, 28], ridge: 13, rmark: 28,
      ground: 22, gmarks: [23, 21], win: 0.5, winH: [0.95, 1.7], stilts: 1.1, veranda: 1.5 },
  };
  const INNER = [7, 6, 4];                  // interior plaster: top, lit face, shaded face
  const FLOOR = { living: [29, 28], dining: [29, 28], bed: [29, 28], kitchen: [6, 5], bath: [25, 24] };
  const ZONE = { living: 'social', dining: 'social', kitchen: 'service', bed: 'private', bath: 'private' };

  // ---- squarified treemap (Bruls, Huizing & van Wijk 2000): rows along the shorter side while the worst aspect improves ----
  function squarify(items, rect) {
    const total = items.reduce((s, i) => s + i.a, 0), k = rect.w * rect.d / total;
    const list = items.map(it => ({ it, a: it.a * k }));
    let { x, y, w, d } = rect, row = [];
    const worst = (rw, side) => {
      const s = rw.reduce((t, i) => t + i.a, 0), th = s / side; let m = 0;
      for (const i of rw) { const len = i.a / th; m = Math.max(m, th / len, len / th); }
      return m;
    };
    const layout = rw => {
      const s = rw.reduce((t, i) => t + i.a, 0);
      if (w >= d) { const th = s / d; let yy = y; for (const i of rw) { const len = i.a / th; Object.assign(i.it, { x, y: yy, w: th, d: len }); yy += len; } x += th; w -= th; }
      else { const th = s / w; let xx = x; for (const i of rw) { const len = i.a / th; Object.assign(i.it, { x: xx, y, w: len, d: th }); xx += len; } y += th; d -= th; }
    };
    while (list.length) {
      const c = list[0], side = Math.min(w, d);
      if (!row.length || worst(row.concat([c]), side) <= worst(row, side)) { row.push(c); list.shift(); }
      else { layout(row); row = []; }
    }
    if (row.length) layout(row);
    for (const it of items) { // snap to whole tiles: shared edges round the same way, so the tiling stays exact
      const x0 = Math.round(it.x), y0 = Math.round(it.y), x1 = Math.round(it.x + it.w), y1 = Math.round(it.y + it.d);
      Object.assign(it, { x: x0, y: y0, w: x1 - x0, d: y1 - y0 });
    }
    return items;
  }

  // ---- the house ----
  // makeHouse(seed, climate, opt): opt.w, opt.d fix the footprint; opt.front forces the front door side ('S' or 'E').
  function makeHouse(seed, climate, opt = {}) {
    const C = CLIMATES[climate], r = Kit.rng(seed * 9973 + climate.length * 31 + 7);
    const t0 = performance.now();
    const w = opt.w || r.int(C.w[0], C.w[1]), d = opt.d || r.int(C.d[0], C.d[1]);
    const rects = [{ x: 0, y: 0, w, d }];
    if (C.L && !opt.w && r.chance(0.75)) rects.push({ x: 0, y: d, w: r.int(3, w - 3), d: r.int(3, 4) });
    const W = w; let D = d + (rects[1] ? rects[1].d : 0);
    const area = rects.reduce((s, q) => s + q.w * q.d, 0);
    const prog = [['living', 1.7], ['kitchen', 1.0], ['bed', 1.25]];
    if (area >= 26) prog.push(['bath', 0.6]);
    if (area >= 38) prog.push(['bed', 1.0]);
    if (area >= 54) prog.push(['dining', 1.0]);

    // rooms: the zones (social, service, private) share the footprint by area, then each zone shares its rect among its rooms.
    // Retry with new weights until every room is at least 2 x 2 tiles; drop the last room if that keeps failing.
    let rooms = null;
    for (let n = prog.length; n >= 3 && !rooms; n--) for (let tries = 0; tries < 40 && !rooms; tries++) {
      const rs = prog.slice(0, n).map(([type, a], i) => ({ type, zone: ZONE[type], a: a * r.range(0.8, 1.25), i }));
      const parts = rects.length === 1 ? [[rects[0], rs]] : [[rects[0], rs.filter(q => q.zone !== 'private')], [rects[1], rs.filter(q => q.zone === 'private')]];
      let ok = true;
      for (const [rect, list] of parts) {
        if (!list.length) { ok = false; break; }
        const zones = ['social', 'service', 'private'].map(z => ({ z, a: list.filter(q => q.zone === z).reduce((s, q) => s + q.a, 0), list: list.filter(q => q.zone === z) })).filter(z => z.a > 0);
        zones.sort((a, b) => b.a - a.a);
        squarify(zones, rect);
        for (const z of zones) {
          if (z.w < 2 || z.d < 2) { ok = false; break; }
          z.list.sort((a, b) => b.a - a.a); squarify(z.list, z);
          if (z.list.some(q => q.w < 2 || q.d < 2)) { ok = false; break; }
        }
        if (!ok) break;
      }
      if (ok) rooms = rs;
    }
    if (!rooms) { // fallback: living takes the larger half of the main rect, kitchen and bed split the rest
      const q = rects[0], alongX = q.w >= q.d, half = Math.ceil((alongX ? q.w : q.d) / 2), rest = (alongX ? q.w : q.d) - half;
      rooms = alongX
        ? [{ type: 'living', x: 0, y: 0, w: half, d: q.d }, { type: 'kitchen', x: half, y: 0, w: rest, d: q.d >> 1 }, { type: 'bed', x: half, y: q.d >> 1, w: rest, d: q.d - (q.d >> 1) }]
        : [{ type: 'living', x: 0, y: 0, w: q.w, d: half }, { type: 'kitchen', x: 0, y: half, w: q.w >> 1, d: rest }, { type: 'bed', x: q.w >> 1, y: half, w: q.w - (q.w >> 1), d: rest }];
      rooms.forEach(q => (q.zone = ZONE[q.type]));
      if (rects[1]) { rects.pop(); D = d; }
    }
    rooms.forEach((q, i) => (q.i = i));
    // turn a one-rect plan so the living room touches the front (south or east), where the door can be seen
    const front = (q) => (q.y + q.d === D) || (q.x + q.w === W);
    if (rects.length === 1) {
      const liv = rooms[0];
      for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const m = { x: fx ? W - liv.x - liv.w : liv.x, y: fy ? D - liv.y - liv.d : liv.y, w: liv.w, d: liv.d };
        if (front(m)) { for (const q of rooms) { if (fx) q.x = W - q.x - q.w; if (fy) q.y = D - q.y - q.d; } break; }
      }
    }
    const cell = (x, y) => { for (const q of rooms) if (x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.d) return q.i; return -1; };
    const grid = []; for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) grid.push(cell(x, y));
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= D) ? -1 : grid[y * W + x];

    // edges: 'h' runs along x at line y (between rows y-1 and y), 'v' runs along y at line x
    const edges = [];
    for (let y = 0; y <= D; y++) for (let x = 0; x < W; x++) { const a = at(x, y - 1), b = at(x, y); if (a !== b) edges.push({ o: 'h', x, y, a, b, ext: a < 0 || b < 0, kind: 'wall' }); }
    for (let x = 0; x <= W; x++) for (let y = 0; y < D; y++) { const a = at(x - 1, y), b = at(x, y); if (a !== b) edges.push({ o: 'v', x, y, a, b, ext: a < 0 || b < 0, kind: 'wall' }); }
    for (const e of edges) if (e.ext) e.side = e.o === 'h' ? (e.b < 0 ? 'S' : 'N') : (e.b < 0 ? 'E' : 'W');
    const mid = list => list[Math.floor(list.length / 2)];

    // the front door: an exterior south (or east) edge of the living room; failing that, of any social or service room
    const want = opt.front ? [opt.front] : ['S', 'E'];
    let doorE = null;
    for (const types of [['living'], ['dining', 'kitchen']]) for (const s of want) {
      if (doorE) break;
      const c = edges.filter(e => e.side === s && types.includes(rooms[e.a < 0 ? e.b : e.a].type));
      if (c.length) doorE = c[Math.floor((c.length - 1) / 2) + (c.length > 3 ? r.int(0, 1) : 0)];
    }
    if (!doorE) doorE = edges.find(e => e.side === 'S' || e.side === 'E');
    doorE.kind = 'door'; doorE.front = true;

    // the room graph (Marson & Musse 2010): every room reaches the living room; bedrooms never open into each other
    const linked = new Set([0]), shared = (a, b) => edges.filter(e => !e.ext && ((e.a === a && e.b === b) || (e.a === b && e.b === a)));
    for (let guard = 0; linked.size < rooms.length && guard < 20; guard++) {
      let best = null, bestScore = -1;
      for (const a of linked) for (const q of rooms) {
        if (linked.has(q.i)) continue;
        const s = shared(a, q.i); if (!s.length) continue;
        const ra = rooms[a].type, rb = q.type;
        let score = a === 0 ? 3 : ZONE[ra] !== 'private' ? 2 : 1;
        if (ra === 'bed' && rb === 'bed') score = 0.1;
        if (score > bestScore) { bestScore = score; best = [a, q.i, s]; }
      }
      if (!best) break;
      const s = best[2].slice().sort((p, q) => (p.x + p.y) - (q.x + q.y));
      mid(s).kind = 'door'; linked.add(best[1]);
    }
    // windows: on exterior walls, never in a bathroom, never beside a door, and with a gap after each
    for (const s of ['N', 'S', 'W', 'E']) {
      const line = edges.filter(e => e.side === s).sort((p, q) => (p.x + p.y) - (q.x + q.y));
      let skip = false;
      line.forEach((e, k) => {
        const room = rooms[e.a < 0 ? e.b : e.a];
        const nearDoor = [line[k - 1], line[k + 1]].some(n => n && n.kind === 'door');
        if (skip || e.kind !== 'wall' || room.type === 'bath' || nearDoor || k === 0 || k === line.length - 1) { skip = false; return; }
        if (r.chance(C.win)) { e.kind = 'window'; skip = true; }
      });
    }

    const furniture = placeFurniture(rooms, edges, at, r);
    const roof = C.roofs[r.int(0, C.roofs.length - 1)];
    const house = { seed, climate, C, W, D, rects, rooms, edges, furniture, roof, z0: C.stilts || 0, veranda: C.veranda || 0,
      chimney: C.chimney && r.chance(0.7) ? { u: r.range(0.2, 0.35), side: r.chance(0.5) } : null };
    house.ms = performance.now() - t0;
    return house;
  }

  // ---- furniture by rules (after Merrell et al. 2011, cut down to a grid): wall pieces with their backs to a wall,
  // a free cell in front of each (clearance), door cells kept clear, and a flood fill from the door after each piece
  // so every free cell, door and front stays reachable (circulation). ----
  const ITEMS = {
    bed: { len: 2, wall: true, h: 0.55 }, chest: { len: 1, wall: true, h: 0.5, front: true }, shelf: { len: 1, wall: true, h: 2.0, front: true, backOnly: true },
    stove: { len: 1, wall: true, h: 0.95, front: true }, counter: { len: 1, wall: true, h: 0.9, front: true }, tub: { len: 2, wall: true, h: 0.55, along: true },
    table: { len: 1, h: 0.75 }, chair: { len: 1, h: 0.45 },
  };
  const PROGRAM = { living: ['shelf', 'table', 'chair', 'chair'], dining: ['table', 'chair', 'chair', 'chair'], kitchen: ['stove', 'counter', 'table', 'chair'], bed: ['bed', 'chest', 'shelf'], bath: ['tub'] };
  const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  function placeFurniture(rooms, edges, at, r) {
    const out = [];
    const edgeAt = (o, x, y) => edges.find(e => e.o === o && e.x === x && e.y === y);
    // the edge on side s of cell (x, y)
    const side = (x, y, s) => s === 'N' ? edgeAt('h', x, y) : s === 'S' ? edgeAt('h', x, y + 1) : s === 'W' ? edgeAt('v', x, y) : edgeAt('v', x + 1, y);
    for (const room of rooms) {
      const used = new Set(), key = (x, y) => x + ',' + y, inRoom = (x, y) => at(x, y) === room.i;
      const doorCells = [];
      for (let y = room.y; y < room.y + room.d; y++) for (let x = room.x; x < room.x + room.w; x++)
        for (const s of 'NESW') { const e = side(x, y, s); if (e && e.kind === 'door') doorCells.push([x, y]); }
      const reserved = new Set(doorCells.map(([x, y]) => key(x, y)));
      const fronts = [];
      const reachable = (extra, extraFront) => {
        const block = new Set([...used, ...extra]);
        const start = doorCells.find(([x, y]) => !block.has(key(x, y)));
        if (!start) return false;
        const seen = new Set([key(...start)]), q = [start];
        while (q.length) {
          const [x, y] = q.pop();
          for (const s of 'NESW') {
            const [dx, dy] = DIRS[s], nx = x + dx, ny = y + dy, k = key(nx, ny);
            if (!inRoom(nx, ny) || block.has(k) || seen.has(k)) continue;
            const e = side(x, y, s); if (e && e.kind !== 'door' && e.kind !== 'open' && at(nx, ny) !== at(x, y)) continue;
            seen.add(k); q.push([nx, ny]);
          }
        }
        for (let y = room.y; y < room.y + room.d; y++) for (let x = room.x; x < room.x + room.w; x++) if (!block.has(key(x, y)) && !seen.has(key(x, y))) return false;
        return [...fronts, ...extraFront].every(k => seen.has(k));
      };
      let table = null;
      for (const type of PROGRAM[room.type]) {
        const it = ITEMS[type], cands = [];
        for (let y = room.y; y < room.y + room.d; y++) for (let x = room.x; x < room.x + room.w; x++) for (const s of 'NESW') {
          if (!it.wall && s !== 'N') continue; // free pieces have no facing; try each cell once
          const [dx, dy] = DIRS[s];
          // cells: the first is at (x, y); a bed runs away from its wall, a tub along it
          const cells = [[x, y]];
          if (it.len === 2) cells.push(it.along ? [x + (dx ? 0 : 1), y + (dx ? 1 : 0)] : [x - dx, y - dy]);
          if (!cells.every(([cx, cy]) => inRoom(cx, cy) && !used.has(key(cx, cy)) && !reserved.has(key(cx, cy)))) continue;
          let score = r();
          if (it.wall) {
            const backed = it.len === 2 && !it.along ? [cells[0]] : cells; // the cells whose side s must be a wall
            if (!backed.every(([cx, cy]) => { const e = side(cx, cy, s); return e && (e.kind === 'wall' || (e.kind === 'window' && type !== 'shelf')); })) continue;
            if (it.backOnly && s !== 'N' && s !== 'W') continue;
            if (s === 'N' || s === 'W') score += 0.5;
          }
          if (type === 'table') { const touch = 'NESW'.split('').some(q => { const e = side(x, y, q); return e && e.kind !== 'open'; }); if (touch && room.w > 2 && room.d > 2) score -= 0.8; }
          let front = [];
          if (type === 'chair') {
            if (!table) continue;
            const adj = Math.abs(x - table[0]) + Math.abs(y - table[1]) === 1; if (!adj) continue;
          } else if (it.wall) {
            const far = cells[cells.length - 1], fx = far[0] - dx, fy = far[1] - dy;
            if (!inRoom(fx, fy) || used.has(key(fx, fy))) continue;
            front = [key(fx, fy)];
          }
          cands.push({ x, y, s, cells, score, front });
        }
        cands.sort((a, b) => b.score - a.score);
        for (const c of cands) {
          if (!reachable(c.cells.map(([cx, cy]) => key(cx, cy)), c.front)) continue;
          c.cells.forEach(([cx, cy]) => used.add(key(cx, cy))); fronts.push(...c.front);
          if (type === 'table') table = [c.x, c.y];
          let face = c.s;
          if (type === 'chair') face = c.x < table[0] ? 'W' : c.x > table[0] ? 'E' : c.y < table[1] ? 'N' : 'S';
          out.push({ type, room: room.i, cells: c.cells, back: face, h: it.h, tint: r.pick([10, 22, 16, 30]) });
          break;
        }
      }
      if (room.type === 'living' && table) out.push({ type: 'rug', room: room.i, cells: [table], h: 0, tint: r.pick([9, 21, 30]) });
    }
    return out;
  }

  // ---- the house as parts: each a world box that paints itself into a Raster ----
  // groups: 'floor' (flat, drawn first), 'solid' (always shown), 'upper' (the cut part of walls), 'roof'.
  // opt.ox, opt.oy place the house in a bigger world; opt.leaf draws closed front doors.
  function houseParts(h, opt = {}) {
    const ox = opt.ox || 0, oy = opt.oy || 0, z0 = h.z0, C = h.C, parts = [];
    const add = (group, box, paint, extra = {}) => { const p = Object.assign({ group, box, paint, id: parts.length }, extra); parts.push(p); return p; };
    const tp = Math.tan(h.C.pitch * Math.PI / 180);
    // floors
    for (const q of h.rooms) {
      const [c, m] = FLOOR[q.type], x0 = ox + q.x, y0 = oy + q.y, x1 = x0 + q.w, y1 = y0 + q.d;
      add('floor', { x0, x1, y0, y1, z0, z1: z0 }, R => {
        R.top(z0, x0, x1, y0, y1, c);
        if (m === 28) for (let k = 1; k < q.d; k++) R.line([x0, y0 + k, z0], [x1, y0 + k, z0], m, 0.01);
        else for (let j = 0; j < q.d; j++) for (let i = 0; i < q.w; i++) if ((i + j) % 2) R.top(z0, x0 + i + 0.2, x0 + i + 0.8, y0 + j + 0.2, y0 + j + 0.8, m, 0.01);
      });
    }
    for (const f of h.furniture) if (f.type === 'rug') {
      const [cx, cy] = f.cells[0], q = h.rooms[f.room];
      const x0 = ox + Math.max(q.x, cx - 1) + 0.3, x1 = ox + Math.min(q.x + q.w, cx + 2) - 0.3, y0 = oy + Math.max(q.y, cy - 1) + 0.3, y1 = oy + Math.min(q.y + q.d, cy + 2) - 0.3;
      add('floor', { x0, x1, y0, y1, z0, z1: z0 }, R => { R.top(z0, x0, x1, y0, y1, f.tint, 0.02); R.top(z0, x0 + 0.2, x1 - 0.2, y0 + 0.2, y1 - 0.2, f.tint + 1, 0.03); });
    }
    // stilts: a slab under the floor, posts, a veranda in front and a ladder down
    if (z0 > 0) {
      const yv = h.D + h.veranda, s = { x0: ox, x1: ox + h.W, y0: oy, y1: oy + yv, z0: z0 - 0.25, z1: z0 };
      add('solid', s, R => { R.box(s, [28, 28, 27]); R.top(z0, ox, ox + h.W, oy + h.D, oy + yv, 29, 0.01); for (let k = 1; k < h.W; k++) R.line([ox + k, oy + h.D, z0], [ox + k, oy + yv, z0], 28, 0.02); });
      const np = Math.ceil(h.W / 2);
      for (let k = 0; k <= np; k++) for (const y of [0, h.D, yv]) {
        const x = h.W * k / np;
        const b = { x0: ox + x - 0.12, x1: ox + x + 0.12, y0: oy + y - 0.12, y1: oy + y + 0.12, z0: -0.3, z1: z0 - 0.25 };
        b.x0 = Math.max(b.x0, ox); b.x1 = Math.min(b.x1, ox + h.W); b.y0 = Math.max(b.y0, oy); b.y1 = Math.min(b.y1, oy + yv);
        add('solid', b, R => R.box(b, [28, 27, 26]));
        if (y === yv || y === h.D) { // veranda posts hold the roof
          if (y === h.D) continue;
          const pb = { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0, z1: z0 + H };
          add('upper', pb, R => R.box(pb, [28, 28, 27]));
        }
      }
      const lx = ox + Math.floor(h.W / 2) - 0.4, b = { x0: lx, x1: lx + 0.8, y0: oy + yv, y1: oy + yv + 1.1, z0: 0, z1: z0 };
      add('solid', b, R => {
        for (const x of [lx, lx + 0.8]) R.line([x, oy + yv, z0], [x, oy + yv + 1.1, 0], 27, 0);
        for (let k = 1; k < 4; k++) { const t = k / 4; R.line([lx, oy + yv + 1.1 * t, z0 * (1 - t)], [lx + 0.8, oy + yv + 1.1 * t, z0 * (1 - t)], 28, 0); }
      });
    }
    // walls: runs of whole-tile edges along one line, broken at doors. Exterior north and west walls are the back walls
    // and are never cut; every other wall splits into a stub (solid) and the part above it (upper), painted as one run.
    const runs = [];
    const lines = new Map();
    for (const e of h.edges) { const k = e.o + (e.o === 'h' ? e.y : e.x) + (e.ext ? 'x' : 'i'); if (!lines.has(k)) lines.set(k, []); lines.get(k).push(e); }
    for (const list of lines.values()) {
      list.sort((p, q) => (p.o === 'h' ? p.x - q.x : p.y - q.y));
      let cur = null;
      for (const e of list) {
        const pos = e.o === 'h' ? e.x : e.y;
        if (e.kind === 'door') { cur = null; runs.push({ door: true, e }); continue; }
        if (cur && cur.b === pos) { cur.b = pos + 1; cur.edges.push(e); continue; }
        cur = { o: e.o, line: e.o === 'h' ? e.y : e.x, a: pos, b: pos + 1, ext: e.ext, side: e.side, edges: [e] }; runs.push(cur);
      }
    }
    const top = z0 + H;
    // exterior runs along x own the corners; every other run stops half a wall short, so no two boxes intersect
    const wallBox = (o, line, a, b, za, zb, own = true) => o === 'h'
      ? { x0: ox + a + (own ? -T / 2 : T / 2), x1: ox + b + (own ? T / 2 : -T / 2), y0: oy + line - T / 2, y1: oy + line + T / 2, z0: za, z1: zb }
      : { x0: ox + line - T / 2, x1: ox + line + T / 2, y0: oy + a + T / 2, y1: oy + b - T / 2, z0: za, z1: zb };
    const outer = run => run.ext && (run.side === 'S' || run.side === 'E');
    const colorsOf = run => outer(run) ? C.wall : INNER;
    // paint one wall box and its marks: windows, and the material's few bold marks on outer faces
    const paintWall = (R, run, b) => {
      const cs = colorsOf(run); R.box(b, cs);
      const [za, zb] = [b.z0, b.z1], face = run.o === 'h' ? 'Y' : 'X', fpos = run.o === 'h' ? b.y1 : b.x1;
      const quad = (u0, u1, v0, v1, c, bias) => {
        const lo = Math.max(v0, za), hi = Math.min(v1, zb); if (hi <= lo) return;
        if (face === 'Y') R.faceY(fpos, ox + u0, ox + u1, lo, hi, c, bias); else R.faceX(fpos, oy + u0, oy + u1, lo, hi, c, bias);
      };
      const seg = (u0, u1, v, c) => { if (v < za || v > zb) return; if (face === 'Y') R.line([ox + u0, fpos, v], [ox + u1, fpos, v], c, 0.03); else R.line([fpos, oy + u0, v], [fpos, oy + u1, v], c, 0.03); };
      if (outer(run)) {
        const k = C.kind;
        if (k === 'timber') for (const v of [0.65, 1.3, 1.95]) seg(run.a, run.b, z0 + v, C.wmark);
        if (k === 'bamboo') for (let u = run.a + 0.5; u < run.b; u += 0.5) quad(u - 0.04, u + 0.04, z0 + 0.1, z0 + H - 0.15, C.wmark, 0.02);
        if (k === 'plaster') for (const e of run.edges) { const hv = Kit.hash2(e.x * 7 + 1, e.y * 13 + 2, 5); if (hv < 0.45) seg(e.o === 'h' ? e.x + 0.2 : e.y + 0.2, (e.o === 'h' ? e.x : e.y) + 0.55, z0 + 0.4 + hv * 2.5, C.wmark); }
        if (k === 'adobe') for (let u = run.a + 0.5; u < run.b; u += 1) quad(u - 0.08, u + 0.08, top - 0.32, top - 0.2, C.wmark, 0.02);
      }
      for (const e of run.edges) if (e.kind === 'window') {
        const u = e.o === 'h' ? e.x : e.y, [wa, wb] = C.winH, wide = C.kind === 'adobe' ? 0.3 : 0.2;
        quad(u + wide, u + 1 - wide, z0 + wa, z0 + wb, 0, 0.02);
        quad(u + wide + 0.1, u + 1 - wide - 0.1, z0 + wa + 0.1, z0 + wb - 0.08, 23, 0.03);
        quad(u + wide + 0.1, u + wide + 0.22, z0 + wb - 0.3, z0 + wb - 0.08, 25, 0.04);
      }
    };
    for (const run of runs) {
      if (run.door) {
        const e = run.e, pos = e.o === 'h' ? e.x : e.y, line = e.o === 'h' ? e.y : e.x, rr = { o: e.o, ext: e.ext, side: e.side, edges: [], a: pos, b: pos + 1 };
        const lb = wallBox(e.o, line, pos, pos + 1, z0 + DOOR_H, top, false);
        const back = e.ext && (e.side === 'N' || e.side === 'W');
        add(back ? 'solid' : 'upper', lb, R => paintWall(R, rr, lb), { run: run });
        if (e.front && opt.leaf) {
          const lf = e.o === 'h' ? { x0: ox + pos + 0.08, x1: ox + pos + 0.92, y0: oy + line - T / 4, y1: oy + line + T / 4, z0, z1: z0 + DOOR_H - 0.02 }
            : { x0: ox + line - T / 4, x1: ox + line + T / 4, y0: oy + pos + 0.08, y1: oy + pos + 0.92, z0, z1: z0 + DOOR_H - 0.02 };
          add('upper', lf, R => {
            R.box(lf, [27, 27, 26]);
            if (e.o === 'h') R.line([lf.x1 - 0.2, lf.y1, z0 + 1], [lf.x1 - 0.16, lf.y1, z0 + 1], 13, 0.03); else R.line([lf.x1, lf.y1 - 0.2, z0 + 1], [lf.x1, lf.y1 - 0.16, z0 + 1], 13, 0.03);
          });
        }
        continue;
      }
      const back = run.ext && (run.side === 'N' || run.side === 'W');
      if (back) { const b = wallBox(run.o, run.line, run.a, run.b, z0, top, run.ext); add('solid', b, R => paintWall(R, run, b)); continue; }
      const lo = wallBox(run.o, run.line, run.a, run.b, z0, z0 + STUB, run.ext), hi = wallBox(run.o, run.line, run.a, run.b, z0 + STUB, top, run.ext);
      // the two pieces of a cut wall paint separately; a sprite of one paints its sibling too, so no seam is outlined
      const pl = add('solid', lo, R => paintWall(R, run, lo)), ph = add('upper', hi, R => paintWall(R, run, hi));
      pl.sib = ph; ph.sib = pl;
    }
    // furniture
    for (const f of h.furniture) if (f.type !== 'rug') {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [cx, cy] of f.cells) { x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx + 1); y1 = Math.max(y1, cy + 1); }
      const m = f.type === 'chair' ? 0.28 : 0.1, b = { x0: ox + x0 + m, x1: ox + x1 - m, y0: oy + y0 + m, y1: oy + y1 - m, z0, z1: z0 + f.h };
      if (f.type === 'shelf' || f.type === 'stove' || f.type === 'counter' || f.type === 'chest') { // shallow, pushed to the wall
        if (f.back === 'N') b.y1 = b.y0 + 0.55; if (f.back === 'S') b.y0 = b.y1 - 0.55; if (f.back === 'W') b.x1 = b.x0 + 0.55; if (f.back === 'E') b.x0 = b.x1 - 0.55;
      }
      if (f.type === 'chest') { b.z1 = z0 + 0.5; }
      add('solid', b, R => paintItem(R, f, b));
    }
    // roof
    if (h.roof === 'flat') {
      // a roof's box starts at the wall tops, so the walls always sort under it; it takes in the overhang, because a
      // sort box must hold everything its sprite draws, or a neighbor can separate from it on the wrong axis
      const rb = { x0: ox - 0.1, x1: ox + h.W + 0.1, y0: oy - 0.1, y1: oy + h.D + 0.1, z0: top, z1: top + 0.45 };
      add('roof', rb, R => {
        for (const q of h.rects) R.top(top + 0.05, ox + q.x, ox + q.x + q.w, oy + q.y, oy + q.y + q.d, C.roof[0]);
        for (const run of runs) {
          const rr = run.door ? { o: run.e.o, line: run.e.o === 'h' ? run.e.y : run.e.x, a: run.e.o === 'h' ? run.e.x : run.e.y, ext: run.e.ext, side: run.e.side } : run;
          if (!rr.ext) continue;
          const b = wallBox(rr.o, rr.line, rr.a, rr.b || rr.a + 1, top, top + 0.42);
          R.box(b, outer(rr) ? C.wall : [C.wall[0], C.wall[1], C.wall[1]]);
          if (rr.side === 'S' && (rr.a + rr.line) % 3 === 1) { // a waterspout
            const s = { x0: ox + rr.a + 0.4, x1: ox + rr.a + 0.6, y0: oy + rr.line, y1: oy + rr.line + 0.5, z0: top + 0.05, z1: top + 0.18 };
            R.box(s, [28, 27, 26]);
          }
        }
      }, { size: { x0: ox - 0.3, x1: ox + h.W + 0.3, y0: oy - 0.3, y1: oy + h.D + 0.8, z0: top - 0.2, z1: top + 0.5 } });
    } else {
      const o = 0.35, eave = top + 0.12 - o * tp; // a little above the wall tops, so none poke through
      const rbAll = { x0: ox - o, x1: ox + h.W + o, y0: oy - o, y1: oy + h.D + h.veranda + o, z0: top, z1: top + (Math.min(h.W, h.D + h.veranda) / 2) * tp + 0.9 };
      add('roof', rbAll, R => {
        for (const q0 of h.rects) {
          const q = { x: q0.x, y: q0.y, w: q0.w, d: q0.d + (q0 === h.rects[0] ? h.veranda : 0) };
          paintRoof(R, h, ox + q.x - o, ox + q.x + q.w + o, oy + q.y - o, oy + q.y + q.d + o, eave, tp, { x0: ox + q.x, x1: ox + q.x + q.w, y0: oy + q.y, y1: oy + q.y + q.d, z: top });
        }
        if (h.chimney) {
          const q = h.rects[0], alongX = q.w >= q.d, u = h.chimney.u;
          const cx = alongX ? ox + q.x + q.w * (h.chimney.side ? u : 1 - u) : ox + q.x + q.w / 2 + 0.3;
          const cy = alongX ? oy + q.y + q.d / 2 + 0.3 : oy + q.y + q.d * (h.chimney.side ? u : 1 - u);
          const zr = top + 0.12 + (Math.min(q.w, q.d) / 2) * tp;
          const b = { x0: cx - 0.3, x1: cx + 0.3, y0: cy - 0.3, y1: cy + 0.3, z0: zr - 1.2, z1: zr + 0.6 };
          R.box(b, [3, 4, 2]); R.top(b.z1, b.x0 + 0.12, b.x1 - 0.12, b.y0 + 0.12, b.y1 - 0.12, 1, 0.02);
        }
      }, { size: { x0: ox - o - 0.1, x1: ox + h.W + o + 0.1, y0: oy - o - 0.1, y1: oy + h.D + h.veranda + o + 0.1, z0: eave - 0.2, z1: rbAll.z1 } });
    }
    return parts;
  }

  // light from the upper left of the picture: shade a plane by its normal into the roof's three inks
  const LIGHT = (() => { const v = [-0.4, 1, 1.2], n = Math.hypot(...v); return v.map(c => c / n); })();
  const shadeOf = (a, b, c, ramp) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[2] < 0) n = n.map(q => -q);
    const l = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / Math.hypot(...n);
    return l > 0.8 ? 0 : l > 0.4 ? 1 : 2;
  };
  // a hip or gable roof over the rectangle [X0, X1] x [Y0, Y1] (overhang included), ridge along the longer side
  function paintRoof(R, h, X0, X1, Y0, Y1, eave, tp, wall) {
    const C = h.C, ramp = C.roof, alongX = X1 - X0 >= Y1 - Y0, span = alongX ? Y1 - Y0 : X1 - X0, zr = eave + span / 2 * tp;
    const hip = h.roof === 'hip' ? span / 2 : 0;
    // planes as [eave edge a, eave edge b, top b, top a], in world points
    let planes, ridge;
    if (alongX) {
      const ym = (Y0 + Y1) / 2, ra = [X0 + hip, ym, zr], rb = [X1 - hip, ym, zr];
      ridge = [ra, rb];
      planes = [[[X0, Y1, eave], [X1, Y1, eave], rb, ra], [[X0, Y0, eave], [X1, Y0, eave], rb, ra]];
      if (hip) planes.push([[X0, Y0, eave], [X0, Y1, eave], ra, ra], [[X1, Y0, eave], [X1, Y1, eave], rb, rb]);
    } else {
      const xm = (X0 + X1) / 2, ra = [xm, Y0 + hip, zr], rb = [xm, Y1 - hip, zr];
      ridge = [ra, rb];
      planes = [[[X1, Y0, eave], [X1, Y1, eave], rb, ra], [[X0, Y0, eave], [X0, Y1, eave], rb, ra]];
      if (hip) planes.push([[X0, Y0, eave], [X1, Y0, eave], ra, ra], [[X0, Y1, eave], [X1, Y1, eave], rb, rb]);
    }
    if (!hip) { // gable ends: wall-colored triangles at the wall line
      const zt = wall.z + ((alongX ? wall.y1 - wall.y0 : wall.x1 - wall.x0) / 2) * tp;
      if (alongX) { const ym = (wall.y0 + wall.y1) / 2; R.poly([[wall.x1, wall.y0, wall.z], [wall.x1, wall.y1, wall.z], [wall.x1, ym, zt]], C.wall[2]); R.line([wall.x1, ym, zt - 0.9], [wall.x1, ym, zt - 0.6], 0, 0.03); }
      else { const xm = (wall.x0 + wall.x1) / 2; R.poly([[wall.x0, wall.y1, wall.z], [wall.x1, wall.y1, wall.z], [xm, wall.y1, zt]], C.wall[1]); R.line([xm, wall.y1, zt - 0.9], [xm, wall.y1, zt - 0.6], 0, 0.03); }
    }
    for (const p of planes) {
      const s = shadeOf(p[0], p[1], p[2][0] === p[3][0] && p[2][1] === p[3][1] ? p[2] : p[3], ramp);
      const c = ramp[s], mark = s === 0 ? ramp[1] : s === 1 ? ramp[2] : C.rmark;
      R.poly(p[2] === p[3] ? [p[0], p[1], p[2]] : p, c);
      // a dark fascia along the eave and, on a gable, the rakes: the overhang there is a sliver too thin to outline cleanly
      R.line(p[0], p[1], 0, 0.04);
      if (!hip) { R.line(p[0], p[3], 0, 0.04); R.line(p[1], p[2], 0, 0.04); }
      for (const f of [0.34, 0.67]) {
        const L = (q, t) => q.map((v, i) => v + (t[i] - v) * f);
        R.line(L(p[0], p[3]), L(p[1], p[2]), mark, 0.02);
      }
    }
    R.line(ridge[0], ridge[1], C.ridge, 0.05);
    if (hip) {
      const cs = alongX ? [[X0, Y0, 0], [X0, Y1, 0], [X1, Y0, 1], [X1, Y1, 1]] : [[X0, Y0, 0], [X1, Y0, 0], [X0, Y1, 1], [X1, Y1, 1]];
      for (const [x, y, k] of cs) R.line([x, y, eave], ridge[k], C.ridge, 0.05);
    }
  }

  function paintItem(R, f, b) {
    const t = f.type, zt = b.z1;
    if (t === 'bed') {
      R.box(b, [28, 28, 27]);
      const head = f.back, [x0, x1, y0, y1] = [b.x0 + 0.06, b.x1 - 0.06, b.y0 + 0.06, b.y1 - 0.06];
      R.top(zt, x0, x1, y0, y1, 7, 0.01);
      // blanket on the foot two thirds, pillow at the head
      const cut = (a0, a1, frac) => a0 + (a1 - a0) * frac;
      if (head === 'N') { R.top(zt, x0, x1, cut(y0, y1, 0.36), y1, f.tint, 0.02); R.top(zt, x0 + 0.1, x1 - 0.1, y0 + 0.08, y0 + 0.4, 6, 0.02); }
      if (head === 'S') { R.top(zt, x0, x1, y0, cut(y0, y1, 0.64), f.tint, 0.02); R.top(zt, x0 + 0.1, x1 - 0.1, y1 - 0.4, y1 - 0.08, 6, 0.02); }
      if (head === 'W') { R.top(zt, cut(x0, x1, 0.36), x1, y0, y1, f.tint, 0.02); R.top(zt, x0 + 0.08, x0 + 0.4, y0 + 0.1, y1 - 0.1, 6, 0.02); }
      if (head === 'E') { R.top(zt, x0, cut(x0, x1, 0.64), y0, y1, f.tint, 0.02); R.top(zt, x1 - 0.4, x1 - 0.08, y0 + 0.1, y1 - 0.1, 6, 0.02); }
      R.faceY(b.y1, b.x0, b.x1, zt - 0.12, zt, f.tint - 1, 0.01);
    } else if (t === 'table') { R.box(b, [29, 28, 27]); R.top(zt, b.x0 + 0.3, b.x0 + 0.42, b.y0 + 0.3, b.y0 + 0.42, 13, 0.02); }
    else if (t === 'chair') R.box(b, [28, 27, 26]);
    else if (t === 'stove') { R.box(b, [3, 2, 1]); R.top(zt, b.x0 + 0.15, b.x0 + 0.35, b.y0 + 0.15, b.y0 + 0.35, 12, 0.02); R.faceY(b.y1, b.x0 + 0.2, b.x1 - 0.2, b.z0 + 0.15, b.z0 + 0.45, 11, 0.02); }
    else if (t === 'counter') { R.box(b, [6, 28, 27]); R.top(zt, b.x0 + 0.1, b.x0 + 0.3, b.y0 + 0.1, b.y0 + 0.25, 22, 0.02); }
    else if (t === 'chest') { R.box(b, [28, 28, 27]); R.faceY(b.y1, b.x0, b.x1, zt - 0.2, zt - 0.12, 13, 0.02); R.faceX(b.x1, b.y0, b.y1, zt - 0.2, zt - 0.12, 29, 0.02); }
    else if (t === 'tub') { R.box(b, [7, 6, 5]); R.top(zt, b.x0 + 0.12, b.x1 - 0.12, b.y0 + 0.12, b.y1 - 0.12, 24, 0.02); }
    else if (t === 'shelf') {
      R.box(b, [28, 28, 27]);
      const books = [10, 22, 16, 30, 13];
      for (const v of [0.45, 1.05, 1.6]) {
        if (f.back === 'N') for (let k = 0; k < 4; k++) R.faceY(b.y1, b.x0 + 0.12 + k * 0.19, b.x0 + 0.27 + k * 0.19, b.z0 + v, b.z0 + v + 0.32, books[(k + v * 10) % 5 | 0], 0.02);
        else if (f.back === 'W') for (let k = 0; k < 4; k++) R.faceX(b.x1, b.y0 + 0.12 + k * 0.19, b.y0 + 0.27 + k * 0.19, b.z0 + v, b.z0 + v + 0.32, books[(k + v * 10) % 5 | 0], 0.02);
      }
    }
  }

  // ---- depth sorts ----
  // Lebron's test for two boxes: any axis on which they separate decides, because the viewer looks down every axis.
  function behind(a, b) {
    if (a.x1 <= b.x0) return true; if (b.x1 <= a.x0) return false;
    if (a.y1 <= b.y0) return true; if (b.y1 <= a.y0) return false;
    if (a.z1 <= b.z0) return true; if (b.z1 <= a.z0) return false;
    return a.x0 + a.x1 + a.y0 + a.y1 + a.z0 + a.z1 < b.x0 + b.x1 + b.y0 + b.y1 + b.z0 + b.z1;
  }
  const overlap = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
  // A box's picture is a hexagon whose sides run along the three drawn axes, so two pictures overlap exactly when
  // their ranges of x - y, x - z and y - z all overlap (Lebron). Testing sprite rectangles instead is not enough:
  // two boxes can then "overlap" while separating on two axes in opposite directions, and the sort can pick the wrong one.
  const hexOverlap = (a, b) => a.x0 - a.y1 < b.x1 - b.y0 && b.x0 - b.y1 < a.x1 - a.y0 &&
    a.x0 - a.z1 < b.x1 - b.z0 && b.x0 - b.z1 < a.x1 - a.z0 && a.y0 - a.z1 < b.y1 - b.z0 && b.y0 - b.z1 < a.y1 - a.z0;
  // items: {box}. Edges only between items whose pictures overlap; then a depth-first topological sort.
  // Every sprite must lie inside its box's hexagon for this to hold.
  function topoSort(items) {
    const n = items.length, deps = items.map(() => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!hexOverlap(items[i].box, items[j].box)) continue;
      if (behind(items[i].box, items[j].box)) deps[j].push(i); else deps[i].push(j);
    }
    const state = new Uint8Array(n), out = [];
    const visit = i => { if (state[i]) return; state[i] = 1; for (const j of deps[i]) visit(j); out.push(items[i]); };
    for (let i = 0; i < n; i++) visit(i);
    return out;
  }
  // the naive sort: one point per item, the middle of its footprint, as a y-sort does
  const ySort = items => items.map((it, i) => [it, (it.box.x0 + it.box.x1 + it.box.y0 + it.box.y1) / 2, i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(a => a[0]);

  // ---- the walker: a small traveler, two frames, and a silhouette of each for the x-ray ----
  const FIG = [
    ['..kkk..', '.khhhk.', '.khsSk.', '.kssSk.', '..kkk..', '.krrrk.', 'kcccCck', 'kcckCck', 'kccccck', 'kscccsk', '.kcCck.', '.kl.lk.', '.kl.lk.', '.kk.kk.'],
    ['..kkk..', '.khhhk.', '.khsSk.', '.kssSk.', '..kkk..', '.krrrk.', 'kcccCck', 'kcckCck', 'kccccck', 'kscccsk', '.kcCck.', 'kl..lk.', 'kl...lk', 'kk...kk'],
  ];
  const FIGC = { k: 0, h: 11, s: 13, S: 12, r: 10, c: 22, C: 23, l: 2 };
  function figureSprites() {
    const make = (rows, flip, sil) => {
      const w = rows[0].length, hh = rows.length, cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
      const img = new ImageData(w, hh), o = img.data;
      const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= hh) ? '.' : rows[y][flip ? w - 1 - x : x];
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const ch = at(x, y); if (ch === '.') continue;
        let c = FIGC[ch];
        if (sil) { const edge = ch === 'k'; if (!edge && (x + y) % 2) continue; c = edge ? 25 : 24; }
        const p = Kit.RGB[c], i = (y * w + x) * 4; o[i] = p[0]; o[i + 1] = p[1]; o[i + 2] = p[2]; o[i + 3] = 255;
      }
      cv.getContext('2d').putImageData(img, 0, 0); return cv;
    };
    return FIG.map(rows => ({ r: make(rows, false, false), l: make(rows, true, false), sr: make(rows, false, true), sl: make(rows, true, true), w: rows[0].length, h: rows.length }));
  }

  window.StudyShared = window.StudyShared || {};
  StudyShared.buildings = { T, H, STUB, BAYER, Raster, bounds, CLIMATES, makeHouse, houseParts, behind, hexOverlap, topoSort, ySort, figureSprites, overlap };
})();
