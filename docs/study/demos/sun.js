// sun.js: one small voxel world lit by a sun you control, seen through eight projections.
// The scene is built once as a voxel grid. Each view casts a ray per pixel to find which voxel face it sees (baked
// once per view). Each face is lit once per sun step in world space: the angle to the sun picks a ramp step, a ray
// marched toward the sun decides shadow, and the sky sets the ambient color. So a shadow lands on the same faces in
// every projection. Replaces day-night (fx.js), which only remapped palettes.
'use strict';
(() => {
  const { RGB, Pix } = Kit;
  const W = 160, H = 120;                       // the view, in art pixels
  const X = 80, Y = 60, Z = 30, XY = X * Y, V = XY * Z; // the world: x east, y south, z up
  const G = 5;                                  // top of the plain
  const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1]; // faces +x -x +y -y +z -z
  const vi = (x, y, z) => z * XY + y * X + x;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  // ---- palette families: each material snaps to the nearest ink, paying a penalty to leave its own ramp ----
  // ink 0 is kept for outlines, so nothing lit ever turns into a line
  const FAM = {
    grey: [1, 2, 3, 4, 5, 6, 7], warm: [1, 2, 3, 4, 5, 6, 7, 13, 29, 12, 31],
    red: [1, 8, 9, 10, 11, 12, 13, 30, 31], green: [1, 14, 15, 16, 17, 18, 19, 20],
    blue: [1, 20, 21, 22, 23, 24, 25], brown: [1, 8, 26, 27, 28, 29, 13], skin: [26, 27, 28, 29, 11, 12, 13, 7],
  };
  const PEN = 2600;
  function snap(c, fam, pen = PEN) {
    const r = clamp(c[0], 0, 255), g = clamp(c[1], 0, 255), b = clamp(c[2], 0, 255);
    let best = 0, bd = Infinity;
    for (let j = 0; j < 32; j++) {
      const q = RGB[j], dr = r - q[0], dg = g - q[1], db = b - q[2];
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db + (fam && !fam.includes(j) ? pen : 0);
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  }

  // ---- materials: an ink for the albedo, a family, and flags for water and things that glow at night ----
  const M = {}, MATS = [null];
  const mat = (name, c, fam, extra = {}) => { M[name] = MATS.length; MATS.push({ name, c, fam: FAM[fam], ...extra }); };
  mat('grass', 17, 'green'); mat('grassHi', 18, 'green'); mat('grassLo', 16, 'green');
  mat('flower', 31, 'red'); mat('flower2', 13, 'red');
  mat('earth', 27, 'brown'); mat('earthLo', 26, 'brown'); mat('path', 28, 'brown'); mat('sand', 29, 'brown');
  mat('water', 22, 'blue', { water: 1 }); mat('waterHi', 23, 'blue', { water: 1 });
  mat('plaster', 6, 'warm'); mat('roof', 10, 'red'); mat('roofLo', 9, 'red');
  mat('slate', 4, 'grey'); mat('slateLo', 3, 'grey');
  mat('wood', 28, 'brown'); mat('woodLo', 27, 'brown'); mat('plank', 29, 'brown');
  mat('glass', 23, 'blue', { glow: 1 }); mat('stone', 5, 'grey'); mat('stoneLo', 4, 'grey'); mat('brick', 9, 'red');
  mat('leaf', 17, 'green'); mat('leafLo', 16, 'green'); mat('pine', 15, 'green'); mat('trunk', 27, 'brown');
  mat('skin', 13, 'skin'); mat('shirt', 23, 'blue'); mat('shirt2', 11, 'red'); mat('pants', 3, 'grey'); mat('hair', 26, 'brown');
  mat('iron', 2, 'grey'); mat('lantern', 6, 'grey', { glow: 2 });

  // ---- the ground ----
  const PATHS = [[[38, 22], [37, 27], [34, 33], [30, 41], [27, 50], [25, 61]], [[34, 33], [42, 36], [48, 38]]];
  function onPath(x, y) {
    const px = x + 0.5, py = y + 0.5;
    for (const line of PATHS) for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1], vx = bx - ax, vy = by - ay;
      const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1);
      if (Math.hypot(px - ax - vx * t, py - ay - vy * t) < 1.7) return true;
    }
    return false;
  }
  // [top, material]: top is the height of the column's top face
  function terrain(x, y) {
    const dx = x + 0.5 - 62, dy = (y + 0.5 - 45) * 1.15, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
    const pr = 10.5 + 1.5 * Math.sin(a * 3 + 1) + 0.8 * Math.sin(a * 5 + 2);
    if (r < pr) return [4, Kit.hash2(x, y, 12) < 0.04 ? M.waterHi : M.water];
    const h = Kit.hash2(x, y, 11);
    if ((x < 20 && y < 16) || x + y * 1.25 + Kit.noise2(x * 0.13, y * 0.13, 7) * 5 < 36)
      return [10, h > 0.975 ? M.flower : h > 0.955 ? M.flower2 : h < 0.04 ? M.grassHi : M.grass];
    if (r < pr + 2.2) return [5, M.sand];
    if (onPath(x, y)) return [5, M.path];
    return [5, h < 0.035 ? M.grassHi : h < 0.07 ? M.grassLo : M.grass];
  }
  // hex mode: every column takes the height and surface at its cell's center; cells get a one-voxel rim
  const HX = 8, HY = 7;
  function hexCell(x, y) {
    const r0 = Math.round((y + 0.5) / HY);
    let best = 1e9, id = 0;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      const off = (r & 1) * HX / 2, q0 = Math.round((x + 0.5 - off) / HX);
      for (let q = q0 - 1; q <= q0 + 1; q++) {
        const d = (x + 0.5 - q * HX - off) ** 2 + (y + 0.5 - r * HY) ** 2;
        if (d < best) { best = d; id = (r + 4) * 64 + q + 4; }
      }
    }
    return id;
  }
  const PLAIN = { [M.grassHi]: M.grass, [M.grassLo]: M.grass, [M.flower]: M.grass, [M.flower2]: M.grass, [M.waterHi]: M.water };
  const RIM = { [M.grass]: M.grassLo, [M.path]: M.earth, [M.sand]: M.path, [M.water]: M.waterHi };
  function hexTerrain(x, y) {
    const id = hexCell(x, y), r = Math.floor(id / 64) - 4, q = id % 64 - 4;
    const cx = clamp(Math.floor(q * HX + (r & 1) * HX / 2), 0, X - 1), cy = clamp(r * HY, 0, Y - 1);
    let [top, m] = terrain(cx, cy);
    m = PLAIN[m] || m;
    if (m !== M.water && Kit.hash2(q, r, 41) < 0.3) top++;
    if (hexCell(x + 1, y) !== id || hexCell(x, y + 1) !== id) m = RIM[m] || m;
    return [top, m];
  }

  // ---- building the world ----
  function buildWorld(hexed) {
    const w = { name: hexed ? 'hex' : 'main', mat: new Uint8Array(V), obj: new Uint8Array(V), nrm: new Int8Array(V * 3), lights: [], boards: [], maxZ: 0 };
    const put = (x, y, z, m, o, n) => {
      if (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z) return;
      const i = vi(x, y, z); w.mat[i] = m; w.obj[i] = o;
      w.nrm[i * 3] = n ? Math.round(n[0] * 127) : 0; w.nrm[i * 3 + 1] = n ? Math.round(n[1] * 127) : 0; w.nrm[i * 3 + 2] = n ? Math.round(n[2] * 127) : 0;
    };
    const paint = (x, y, z, m) => { const i = vi(x, y, z); if (w.mat[i]) w.mat[i] = m; };
    const top = new Uint8Array(XY);
    for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) {
      const [t, m] = hexed ? hexTerrain(x, y) : terrain(x, y);
      top[y * X + x] = t;
      for (let z = 0; z < t; z++) {
        const water = (m === M.water || m === M.waterHi) && z >= t - 2;
        put(x, y, z, z === t - 1 ? m : water ? M.water : (z % 3 === 1 && Kit.hash2(x * 7 + z, y, 5) < 0.35) ? M.earthLo : M.earth, 0);
      }
    }
    const topAt = (x, y) => top[clamp(Math.round(y), 0, Y - 1) * X + clamp(Math.round(x), 0, X - 1)];
    const light = (x, y, z, r, occ = false) => w.lights.push({ x, y, z, r, occ });

    // a gabled house: walls fill the footprint, the roof overhangs by one and rises one per step, ridge along x or y
    function house(o, x0, y0, x1, y1, base, wallH, alongX, wallM, roofM, roofLo) {
      const zw = base + wallH, span = (alongX ? y1 - y0 : x1 - x0) + 2;
      for (let y = y0 - 1; y <= y1; y++) for (let x = x0 - 1; x <= x1; x++) {
        const across = alongX ? y - y0 + 1 : x - x0 + 1, dist = Math.min(across, span - 1 - across);
        const zr = zw - 1 + dist, s = across < span / 2 ? -1 : 1;
        if (x >= x0 && x < x1 && y >= y0 && y < y1) for (let z = base; z < zr; z++) put(x, y, z, wallM, o);
        put(x, y, zr, dist % 3 === 2 ? roofLo : roofM, o, alongX ? [0, s * 0.7071, 0.7071] : [s * 0.7071, 0, 0.7071]);
      }
    }
    // a two-by-two window on a wall face, with a little light thrown out in front of it
    function win(x, y, z, face) {
      const ax = face === 2 || face === 3, ox = DX[face] * 0.5 + 0.5, oy = DY[face] * 0.5 + 0.5;
      for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) paint(ax ? x + k : x, ax ? y : y + k, z + j, M.glass);
      light(x + ox + DX[face] * 1.5 + (ax ? 1 : 0), y + oy + DY[face] * 1.5 + (ax ? 0 : 1), z + 1, 5.5);
    }

    // the cottage: white walls, red roof, ridge along x, a door and windows all round, a chimney
    house(1, 30, 11, 46, 21, G, 7, true, M.plaster, M.roof, M.roofLo);
    for (let x = 37; x < 40; x++) for (let z = G; z < G + 5; z++) paint(x, 20, z, M.woodLo);
    win(32, 20, 8, 2); win(42, 20, 8, 2); win(34, 11, 8, 3); win(40, 11, 8, 3);
    win(45, 14, 8, 0); win(45, 17, 8, 0); win(30, 15, 8, 1);
    for (let z = 12; z < 20; z++) for (let y = 13; y < 15; y++) for (let x = 41; x < 43; x++) put(x, y, z, z === 19 ? M.iron : M.brick, 1);
    // the barn on the hill: plank walls, slate roof, ridge along y so its slopes face east and west
    house(2, 5, 3, 17, 13, 10, 7, false, M.wood, M.slate, M.slateLo);
    for (let z = 10; z < 17; z++) for (let y = 3; y < 13; y++) for (let x = 5; x < 17; x++) if (w.mat[vi(x, y, z)] === M.wood && (x + y) % 3 === 0) paint(x, y, z, M.woodLo);
    for (let x = 9; x < 13; x++) for (let z = 10; z < 16; z++) paint(x, 12, z, (x - 9 === z - 10 || 12 - x === z - 10) ? M.plank : M.woodLo);
    win(16, 6, 13, 0); win(5, 8, 13, 1);
    // the shed by the pond
    house(3, 55, 23, 62, 28, G, 5, true, M.plank, M.wood, M.woodLo);
    for (let x = 57; x < 59; x++) for (let z = G; z < G + 4; z++) paint(x, 27, z, M.woodLo);
    // a dry-stone wall with a gap for the path
    for (let x = 24; x < 51; x++) if (x < 34 || x > 39) for (let y = 27; y < 29; y++) for (let z = G; z < G + 4; z++)
      put(x, y, z, z < G + 3 && (x + (z % 2) * 2) % 4 === 0 ? M.stoneLo : M.stone, 4);
    // a fence around two sides of the pond: posts every third voxel, two rails
    const fence = (x, y, post) => {
      if (topAt(x, y) !== G || onPath(x, y)) return;
      if (post) for (let z = G; z < G + 5; z++) put(x, y, z, M.wood, 5);
      put(x, y, G + 1, M.plank, 5); put(x, y, G + 3, M.plank, 5);
    };
    for (let x = 49; x < 74; x++) fence(x, 33, x % 3 === 0);
    // the lamp by the path
    for (let z = G; z < G + 9; z++) put(33, 31, z, M.iron, 6);
    for (let y = 30; y < 33; y++) for (let x = 32; x < 35; x++) { put(x, y, G + 9, M.lantern, 6); put(x, y, G + 10, M.lantern, 6); put(x, y, G + 11, M.iron, 6); }
    put(33, 31, G + 12, M.iron, 6);
    light(33.5, 31.5, G + 9.5, 13, true);
    w.boards.push({ o: 6, cx: 33.5, cy: 31.5, base: G, h: 13, hw: 2 });
    // round trees: a trunk and a few overlapping spheres, each leaf voxel keeping its sphere's normal
    let oid = 7;
    function tree(cx, cy, s = 1) {
      const o = oid++, base = topAt(cx, cy);
      const balls = [[0, 0, 11, 5.5], [-2.8, 1.2, 9, 4], [2.6, -1, 9.5, 4.2], [0.5, 0.6, 14, 3.6]].map(([a, b, c, r]) => [cx + a * s, cy + b * s, base + c * s, r * s]);
      for (let z = base; z < base + 8 * s; z++) for (let y = cy - 1; y <= cy; y++) for (let x = cx - 1; x <= cx; x++) put(x, y, z, M.trunk, o);
      for (let z = base + 3; z < base + 19 * s; z++) for (let y = cy - 8; y < cy + 8; y++) for (let x = cx - 8; x < cx + 8; x++) {
        let best = null, bf = 0;
        for (const b of balls) { const d = Math.hypot(x + 0.5 - b[0], y + 0.5 - b[1], z + 0.5 - b[2]) / b[3]; if (d <= 1 && d > bf) { bf = d; best = b; } }
        if (!best) continue;
        const n = [x + 0.5 - best[0], y + 0.5 - best[1], z + 0.5 - best[2]], l = Math.hypot(...n) || 1;
        put(x, y, z, Kit.hash2(x * 3 + z, y, o) < 0.1 ? M.leafLo : M.leaf, o, n.map(v => v / l));
      }
      w.boards.push({ o, cx: cx, cy: cy, base, h: 19 * s, hw: 7.5 * s });
    }
    // pines: stacked tiers, cone normals
    function pine(cx, cy) {
      const o = oid++, base = topAt(cx, cy);
      for (let z = base; z < base + 4; z++) put(cx, cy, z, M.trunk, o);
      for (let z = base + 3; z < base + 18; z++) {
        const k = z - base - 3, r = 4.6 * (1 - k / 15) + 0.6 - (k % 4) * 0.45;
        for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) {
          const dx = x + 0.5 - cx - 0.5, dy = y + 0.5 - cy - 0.5, d = Math.hypot(dx, dy);
          if (d > r) continue;
          put(x, y, z, M.pine, o, d < 0.01 ? [0, 0, 1] : [dx / d * 0.8, dy / d * 0.8, 0.6]);
        }
      }
      w.boards.push({ o, cx: cx + 0.5, cy: cy + 0.5, base, h: 18, hw: 5.5 });
    }
    // a bush: half a sphere
    function bush(cx, cy, r) {
      const o = oid++, base = topAt(cx, cy);
      for (let z = base; z < base + r; z++) for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const n = [x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - base], d = Math.hypot(...n);
        if (d <= r) put(x, y, z, Kit.hash2(x, y * 5 + z, o) < 0.12 ? M.leafLo : M.leaf, o, n.map(v => v / (d || 1)));
      }
    }
    // a person: legs, shirt, face, hair; three wide, two deep, eight tall, facing south
    function person(fx, fy, shirt) {
      const o = oid++, base = topAt(fx + 1, fy);
      for (let y = fy; y < fy + 2; y++) for (let x = fx; x < fx + 3; x++) {
        if (x !== fx + 1) { put(x, y, base, M.pants, o); put(x, y, base + 1, M.pants, o); }
        for (let z = base + 2; z < base + 5; z++) put(x, y, z, shirt, o);
        put(x, y, base + 5, y === fy ? M.hair : M.skin, o); put(x, y, base + 6, y === fy ? M.hair : M.skin, o); put(x, y, base + 7, M.hair, o);
      }
      w.boards.push({ o, cx: fx + 1.5, cy: fy + 1, base, h: 8, hw: 2 });
    }
    tree(20, 37); tree(9, 45); tree(71, 16); tree(27, 4, 0.85);
    pine(77, 38); pine(4, 30); pine(66, 4);
    bush(28.5, 23.5, 2.6); bush(48.5, 12.5, 2.4); bush(52, 30, 2.2);
    person(40, 31, M.shirt); person(43, 41, M.shirt2);
    // a rowing boat on the pond
    const bo = oid++;
    for (let y = 45; y < 48; y++) for (let x = 60; x < 66; x++) {
      const rim = y === 45 || y === 47 || x === 60 || x === 65;
      put(x, y, 3, M.plank, bo);
      if (rim && !((x === 60 || x === 65) && y !== 46)) put(x, y, 4, M.wood, bo);
    }
    for (let i = 0; i < V; i++) if (w.mat[i]) w.maxZ = Math.max(w.maxZ, Math.floor(i / XY) + 1);
    w.top = top;
    return w;
  }

  // ---- the ray caster: Amanatides and Woo through the grid ----
  // Returns true on a hit and fills HIT: voxel index, face entered (-1 when it starts inside a solid), distance.
  // allow: null for every voxel, or a table by object id of the ones that count.
  const HIT = { v: 0, f: 0, t: 0 };
  function cast(w, ox, oy, oz, dx, dy, dz, t0, t1, allow) {
    let tmin = t0, tmax = t1, ef = -1;
    if (dx !== 0) { let a = -ox / dx, b = (X - ox) / dx; if (a > b) { const s = a; a = b; b = s; } if (a > tmin) { tmin = a; ef = dx > 0 ? 1 : 0; } if (b < tmax) tmax = b; } else if (ox < 0 || ox >= X) return false;
    if (dy !== 0) { let a = -oy / dy, b = (Y - oy) / dy; if (a > b) { const s = a; a = b; b = s; } if (a > tmin) { tmin = a; ef = dy > 0 ? 3 : 2; } if (b < tmax) tmax = b; } else if (oy < 0 || oy >= Y) return false;
    if (dz !== 0) { let a = -oz / dz, b = (Z - oz) / dz; if (a > b) { const s = a; a = b; b = s; } if (a > tmin) { tmin = a; ef = dz > 0 ? 5 : 4; } if (b < tmax) tmax = b; } else if (oz < 0 || oz >= Z) return false;
    if (tmin >= tmax) return false;
    const te = tmin + 1e-5;
    let x = clamp(Math.floor(ox + dx * te), 0, X - 1), y = clamp(Math.floor(oy + dy * te), 0, Y - 1), z = clamp(Math.floor(oz + dz * te), 0, Z - 1);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const ddx = dx !== 0 ? Math.abs(1 / dx) : Infinity, ddy = dy !== 0 ? Math.abs(1 / dy) : Infinity, ddz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tx = dx > 0 ? (x + 1 - ox) / dx : dx < 0 ? (x - ox) / dx : Infinity;
    let ty = dy > 0 ? (y + 1 - oy) / dy : dy < 0 ? (y - oy) / dy : Infinity;
    let tz = dz > 0 ? (z + 1 - oz) / dz : dz < 0 ? (z - oz) / dz : Infinity;
    let f = ef, tc = tmin;
    const mat = w.mat, obj = w.obj;
    for (;;) {
      const i = z * XY + y * X + x;
      if (mat[i] && (!allow || allow[obj[i]])) { HIT.v = i; HIT.f = f; HIT.t = tc; return true; }
      if (tx < ty && tx < tz) { x += sx; tc = tx; tx += ddx; f = sx > 0 ? 1 : 0; if (x < 0 || x >= X) return false; }
      else if (ty < tz) { y += sy; tc = ty; ty += ddy; f = sy > 0 ? 3 : 2; if (y < 0 || y >= Y) return false; }
      else { z += sz; tc = tz; tz += ddz; f = sz > 0 ? 5 : 4; if (z < 0 || z >= Z) return false; }
      if (tc > tmax) return false;
    }
  }

  // ---- faces: every voxel face open to the air, with what lighting needs and never changes ----
  function faceList(w) {
    const map = new Int32Array(V * 6).fill(-1), fv = [], fd = [];
    for (let i = 0; i < V; i++) {
      if (!w.mat[i]) continue;
      const x = i % X, y = Math.floor(i / X) % Y, z = Math.floor(i / XY);
      for (let f = 0; f < 6; f++) {
        const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f];
        let open;
        if (nz < 0) open = false;
        else if (nx < 0 || ny < 0 || nx >= X || ny >= Y || nz >= Z) open = true;
        else { const j = vi(nx, ny, nz); open = !w.mat[j] || w.obj[j] !== w.obj[i]; }
        if (open) { map[i * 6 + f] = fv.length; fv.push(i); fd.push(f); }
      }
    }
    const n = fv.length;
    const F = { n, map, fv: Int32Array.from(fv), fd: Uint8Array.from(fd), fm: new Uint8Array(n), fn: new Float32Array(n * 3), so: new Float32Array(n * 3), ao: new Uint8Array(n), lamp: new Uint8Array(n) };
    const solid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < X && y < Y && z < Z && w.mat[vi(x, y, z)] > 0;
    for (let k = 0; k < n; k++) {
      const i = F.fv[k], f = F.fd[k], x = i % X, y = Math.floor(i / X) % Y, z = Math.floor(i / XY);
      const fn = [DX[f], DY[f], DZ[f]], sn = [w.nrm[i * 3] / 127, w.nrm[i * 3 + 1] / 127, w.nrm[i * 3 + 2] / 127];
      const has = sn[0] || sn[1] || sn[2];
      const ln = has && dot(sn, fn) > -0.2 ? sn : fn;
      F.fm[k] = w.mat[i];
      F.fn[k * 3] = ln[0]; F.fn[k * 3 + 1] = ln[1]; F.fn[k * 3 + 2] = ln[2];
      // shadow rays start just outside the face, or for curved voxels just outside along their normal
      let o = [x + 0.5 + fn[0] * 0.52, y + 0.5 + fn[1] * 0.52, z + 0.5 + fn[2] * 0.52];
      if (has) { const p = [x + 0.5 + sn[0] * 0.87, y + 0.5 + sn[1] * 0.87, z + 0.5 + sn[2] * 0.87]; if (!solid(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]))) o = p; }
      F.so[k * 3] = o[0]; F.so[k * 3 + 1] = o[1]; F.so[k * 3 + 2] = o[2];
      // a little ambient occlusion where the air in front of a flat face touches something
      if (!has) {
        const cx = x + fn[0], cy = y + fn[1], cz = z + fn[2];
        let c = 0;
        for (let g = 0; g < 6; g++) if (g >> 1 !== f >> 1 && solid(cx + DX[g], cy + DY[g], cz + DZ[g])) c++;
        F.ao[k] = c > 0 ? 1 : 0;
      }
      // warm light from the lamp and the windows, for the night
      const fx = x + 0.5 + fn[0] * 0.5, fy = y + 0.5 + fn[1] * 0.5, fz = z + 0.5 + fn[2] * 0.5;
      let s = 0;
      for (const l of w.lights) {
        const ex = l.x - fx, ey = l.y - fy, ez = l.z - fz, d = Math.hypot(ex, ey, ez);
        if (d >= l.r || ex * fn[0] + ey * fn[1] + ez * fn[2] <= 0) continue;
        if (l.occ && d > 1.5 && cast(w, o[0], o[1], o[2], ex / d, ey / d, ez / d, 0, d - 2, null)) continue;
        s += 1 - d / l.r;
      }
      F.lamp[k] = s > 0.5 ? 2 : s > 0.14 ? 1 : 0;
    }
    return F;
  }
  // the face a ray entered, or failing that any open face of the voxel
  function faceOf(F, v, f) {
    let k = f >= 0 ? F.map[v * 6 + f] : -1;
    if (k < 0) for (const g of [4, 2, 0, 3, 1, 5]) if ((k = F.map[v * 6 + g]) >= 0) break;
    return k;
  }

  // ---- the sun: a real solar path at latitude 40, turned by the compass ----
  const LAT = 40 * Math.PI / 180, DECL = [-23.4, 0, 23.4], SEASONS = ['Winter', 'Equinox', 'Summer'];
  function sunAt(season, hour, comp) {
    const d = DECL[season] * Math.PI / 180, h = (hour - 12) * 15 * Math.PI / 180;
    const el = Math.asin(Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(h));
    const azT = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(LAT) - Math.tan(d) * Math.cos(LAT)) + Math.PI;
    const az = azT + comp * Math.PI / 180;
    return { el: el * 180 / Math.PI, azT, az, L: [Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)] };
  }
  // the sky by sun elevation: direct light, ambient light, sky top, middle, horizon, how much it is night
  const SKY = [
    [-90, [0, 0, 0], [0.12, 0.14, 0.28], [10, 10, 26], [16, 22, 52], [26, 38, 80], 1],
    [-12, [0, 0, 0], [0.12, 0.14, 0.28], [10, 10, 26], [16, 22, 52], [26, 38, 80], 1],
    [-6, [0, 0, 0], [0.16, 0.18, 0.34], [16, 20, 54], [36, 50, 108], [92, 70, 130], 0.85],
    [-2, [0, 0, 0], [0.26, 0.24, 0.38], [28, 38, 92], [100, 82, 146], [232, 126, 92], 0.5],
    [0.5, [0.82, 0.42, 0.26], [0.30, 0.28, 0.40], [42, 70, 138], [168, 112, 140], [250, 156, 88], 0.2],
    [6, [1.0, 0.68, 0.42], [0.32, 0.32, 0.44], [54, 110, 178], [150, 158, 180], [250, 196, 118], 0],
    [16, [1.0, 0.86, 0.66], [0.34, 0.37, 0.48], [40, 126, 194], [100, 176, 214], [200, 226, 220], 0],
    [40, [0.92, 0.92, 0.86], [0.38, 0.42, 0.52], [32, 140, 200], [104, 200, 222], [190, 240, 234], 0],
    [91, [0.92, 0.92, 0.86], [0.38, 0.42, 0.52], [32, 140, 200], [104, 200, 222], [190, 240, 234], 0],
  ];
  function skyAt(el) {
    let k = 0; while (k < SKY.length - 2 && SKY[k + 1][0] <= el) k++;
    const a = SKY[k], b = SKY[k + 1], f = clamp((el - a[0]) / (b[0] - a[0]), 0, 1);
    return { sun: lerp3(a[1], b[1], f), amb: lerp3(a[2], b[2], f), top: lerp3(a[3], b[3], f), mid: lerp3(a[4], b[4], f), hor: lerp3(a[5], b[5], f), night: a[6] + (b[6] - a[6]) * f };
  }
  // the sky in five bands; it prefers colored inks to the greys
  const SKYINK = [1, 2, 7, 8, 9, 10, 11, 12, 13, 20, 21, 22, 23, 24, 25, 30, 31];
  const skyBands = k => [k.top, lerp3(k.top, k.mid, 0.5), k.mid, lerp3(k.mid, k.hor, 0.5), k.hor].map(c => snap(c, SKYINK, 1e9));
  const LV = [0, 0.3, 0.56, 0.82, 1.04], AOK = [1, 0.58], LPK = [0, 0.5, 1], WARM = [1, 0.6, 0.28], KA = 0.82;
  const level = d => d < 0.26 ? 1 : d < 0.52 ? 2 : d < 0.8 ? 3 : 4;
  // everything that depends on the sun alone: lookup tables from (material, light step, occlusion, lamp) to ink
  function sunState(season, step, comp) {
    const s = sunAt(season, step / 4, comp), k = skyAt(s.el);
    let L = s.L, dir = k.sun, src = s.el > -0.5 && L[2] > 0.005 ? 'sun' : 'none';
    if (s.el <= -0.5) {
      const m = clamp((-s.el - 3) / 7, 0, 1);
      if (m > 0) { L = L.map(v => -v); dir = [0.26 * m, 0.32 * m, 0.56 * m]; src = 'moon'; }
    }
    const S = { s, k, L, dir, src, el: s.el, night: k.night, bands: skyBands(k), lit: {} };
    const lightOf = (mt, lv, ao, lp, cut) => {
      const base = RGB[mt.c];
      let c = [0, 1, 2].map(i => base[i] * KA * (k.amb[i] * (cut ? 0.8 : AOK[ao]) + dir[i] * (cut ? 0.25 : LV[lv]) + WARM[i] * LPK[lp] * k.night));
      if (mt.water) c = c.map((v, i) => v * 0.68 + k.mid[i] * (lv ? 0.34 : 0.22));
      if (mt.glow === 1) c = k.night > 0.55 ? [250, 196, 108] : k.night > 0.25 ? [240, 140, 80] : c.map((v, i) => v * 0.7 + k.mid[i] * 0.3);
      if (mt.glow === 2 && k.night > 0.2) c = [255, 244, 222];
      return snap(c, mt.fam);
    };
    S.lut = new Uint8Array(MATS.length * 30);
    S.cut = new Uint8Array(MATS.length);
    for (let m = 1; m < MATS.length; m++) {
      for (let lv = 0; lv < 5; lv++) for (let ao = 0; ao < 2; ao++) for (let lp = 0; lp < 3; lp++) S.lut[((m * 5 + lv) * 2 + ao) * 3 + lp] = lightOf(MATS[m], lv, ao, lp);
      S.cut[m] = lightOf(MATS[m], 0, 0, 0, true);
    }
    S.far = lightOf(MATS[M.grass], src === 'none' ? 0 : level(L[2]), 0, 0);
    const hz = lerp3(k.mid, k.hor, 0.6);
    // haze pulls an ink toward the horizon, but a colored ink may not go grey
    const NOGREY = [1, 2, 7, ...Array.from({ length: 24 }, (_, i) => i + 8)];
    S.haze = [null, 0.24, 0.42].map(a => a && RGB.map((c, i) => snap(lerp3(c, hz, a), i < 8 ? null : NOGREY, 1e9)));
    const mt = lerp3(k.mid, k.top, 0.4);
    const COOL = [1, 2, 3, 4, 20, 21, 22, 23, 24, 30];
    S.mtn = [snap(lerp3(mt, hz, 0.25).map(v => v * 0.86), COOL, 1e9), snap(mt.map(v => v * 0.66), COOL, 1e9)];
    return S;
  }
  function lightFaces(w, F, S) {
    const lit = new Uint8Array(F.n), lx = S.L[0], ly = S.L[1], lz = S.L[2], on = S.src !== 'none', lut = S.lut;
    for (let f = 0; f < F.n; f++) {
      let lv = 0;
      if (on) {
        const d = F.fn[f * 3] * lx + F.fn[f * 3 + 1] * ly + F.fn[f * 3 + 2] * lz;
        if (d > 0.03) {
          lv = level(d);
          const oz = F.so[f * 3 + 2];
          if (cast(w, F.so[f * 3], F.so[f * 3 + 1], oz, lx, ly, lz, 0, (w.maxZ - oz) / lz, null)) lv = 0;
        }
      }
      lit[f] = lut[((F.fm[f] * 5 + lv) * 2 + F.ao[f]) * 3 + F.lamp[f]];
    }
    return lit;
  }

  // ---- G-buffers: per pixel, the face it sees (or a code), its object, its depth, haze and sky band ----
  const SKYC = -1, LINE = -2, FAR = -3, MTN = -4, MTN2 = -5, CUT = -16;
  function newGB() {
    const n = W * H;
    return { code: new Int32Array(n).fill(SKYC), obj: new Int16Array(n).fill(-1), dep: new Float32Array(n).fill(1e9), haze: new Uint8Array(n), el: new Float32Array(n), band: new Uint8Array(n), star: new Uint8Array(n) };
  }
  // outline: a pixel turns to ink where its neighbor is a nearer object, or much nearer anything
  function finish(gb, T, rel) {
    const { code, obj, dep } = gb, out = code.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, d = dep[i], o = obj[i];
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx, dq = dep[j];
        if (dq >= d) continue;
        if ((obj[j] > 0 && obj[j] !== o) || d - dq > Math.max(T, rel * dq)) { out[i] = LINE; break; }
      }
      const e = gb.el[i];
      const v = e >= 40 ? 0 : e >= 22 ? (40 - e) / 18 : e >= 11 ? 1 + (22 - e) / 11 : e >= 4 ? 2 + (11 - e) / 7 : e >= 0 ? 3 + (4 - e) / 4 : 4;
      let b = Math.floor(v); if (b < 4 && v - b > 0.78 && (x + y) % 2) b++;
      gb.band[i] = Math.min(4, b);
      gb.star[i] = e > 12 && Kit.hash2(x, y, 77) < 0.011 ? (Kit.hash2(x, y, 78) < 0.3 ? 2 : 1) : 0;
    }
    gb.code = out;
    return gb;
  }
  // a parallel projection given as screen = A·p + off: each pixel's ray runs along the null direction of A
  function bakeOrtho(w, F, v) {
    const gb = newGB(), [r0, r1] = v.A;
    let d = [r0[1] * r1[2] - r0[2] * r1[1], r0[2] * r1[0] - r0[0] * r1[2], r0[0] * r1[1] - r0[1] * r1[0]];
    const len = Math.hypot(...d); d = d.map(c => c / len);
    if (dot(d, v.hint) < 0) d = d.map(c => -c);
    const a = dot(r0, r0), b = dot(r0, r1), c = dot(r1, r1), det = a * c - b * b;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const i = py * W + px, sx = px + 0.5 - v.off[0], sy = py + 0.5 - v.off[1];
      const u = (c * sx - b * sy) / det, s = (-b * sx + a * sy) / det;
      const ox = r0[0] * u + r1[0] * s, oy = r0[1] * u + r1[1] * s, oz = r0[2] * u + r1[2] * s;
      gb.el[i] = 60 * (1 - (py + 0.5) / H);
      const t0 = v.cut != null ? (v.cut - oy) / d[1] : -1e4;
      if (!cast(w, ox, oy, oz, d[0], d[1], d[2], t0, 1e4, null)) continue;
      const vx = HIT.v, o = w.obj[vx];
      if (HIT.f < 0) {
        // the side view's cut: the top voxel of a column shows its lit top, the rest shows in section
        const x = vx % X, y = Math.floor(vx / X) % Y, z = Math.floor(vx / XY);
        const k = o === 0 && z === w.top[y * X + x] - 1 ? F.map[vx * 6 + 4] : -1;
        gb.code[i] = k >= 0 ? k : CUT - w.mat[vx];
      } else gb.code[i] = faceOf(F, vx, HIT.f);
      gb.obj[i] = o; gb.dep[i] = HIT.t;
      if (v.cut != null) { const gap = HIT.t - t0; gb.haze[i] = gap > 30 ? 1 : 0; }
    }
    return finish(gb, 4, 0);
  }
  // distant hills for the perspective views, by azimuth, in degrees of elevation
  const hills = az => [2.4 + 1.5 * Math.sin(az * 3 + 1) + 0.8 * Math.sin(az * 7) + 0.4 * Math.sin(az * 17 + 2), 0.9 + 0.8 * Math.sin(az * 5 + 2) + 0.3 * Math.sin(az * 11)];
  function skyPixel(gb, i, el, az) {
    const [far, near] = hills(az);
    gb.el[i] = el;
    if (el < near) gb.code[i] = MTN2; else if (el < far) gb.code[i] = MTN;
  }
  // the raycaster's camera
  function basis(h, pitch) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    return { fw: [h[0] * cp, h[1] * cp, sp], rt: [-h[1], h[0], 0], up: [-h[0] * sp, -h[1] * sp, cp] };
  }
  const unit2 = (x, y) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
  const RAYCAM = { pos: [33, 59.5, G + 6.5], h: unit2(37 - 33, 12 - 59.5), pitch: -0.1, tan: Math.tan(0.68) };
  RAYCAM.b = basis(RAYCAM.h, RAYCAM.pitch);
  function bakeRay(w, F) {
    const gb = newGB(), { pos, b, tan } = RAYCAM, ty = tan * H / W;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const i = py * W + px, a = (2 * (px + 0.5) / W - 1) * tan, c = (1 - 2 * (py + 0.5) / H) * ty;
      let dx = b.fw[0] + b.rt[0] * a + b.up[0] * c, dy = b.fw[1] + b.rt[1] * a + b.up[1] * c, dz = b.fw[2] + b.rt[2] * a + b.up[2] * c;
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      if (cast(w, pos[0], pos[1], pos[2], dx, dy, dz, 0, 400, null)) {
        gb.code[i] = faceOf(F, HIT.v, HIT.f); gb.obj[i] = w.obj[HIT.v]; gb.dep[i] = HIT.t;
        gb.haze[i] = HIT.t > 80 ? 2 : HIT.t > 46 ? 1 : 0;
      } else if (dz < 0) {
        const t = (G - pos[2]) / dz;
        gb.code[i] = FAR; gb.obj[i] = 0; gb.dep[i] = t; gb.haze[i] = 1;
      } else skyPixel(gb, i, Math.asin(dz) * 180 / Math.PI, Math.atan2(dx, -dy));
    }
    return finish(gb, 3, 0.18);
  }
  RAYCAM.project = L => {
    const { fw, rt, up } = RAYCAM.b, c = dot(L, fw);
    if (c <= 0.05) return null;
    return [W / 2 * (1 + dot(L, rt) / c / RAYCAM.tan), H / 2 * (1 - dot(L, up) / c / (RAYCAM.tan * H / W))];
  };
  // Mode 7: the top-down picture on a plane, with the tall things as upright billboards
  const M7 = { pos: [66, 75], h: unit2(34 - 66, 16 - 75), camH: 20, f: 110, hor: 34 };
  function bakeMode7(w, F) {
    const gb = newGB(), { pos, h, camH, f, hor } = M7, rt = [-h[1], h[0]];
    // the texture: per column, the top face of the highest voxel that isn't a billboard
    const isBoard = new Uint8Array(256); w.boards.forEach(bb => { isBoard[bb.o] = 1; });
    const tex = new Int32Array(XY).fill(-1), tobj = new Int16Array(XY);
    for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) for (let z = Z - 1; z >= 0; z--) {
      const v = vi(x, y, z);
      if (w.mat[v] && !isBoard[w.obj[v]]) { tex[y * X + x] = faceOf(F, v, 4); tobj[y * X + x] = w.obj[v]; break; }
    }
    const head = Math.atan2(h[0], -h[1]);
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const i = py * W + px;
      if (py + 0.5 <= hor) { skyPixel(gb, i, Math.atan((hor - py - 0.5) / f) * 180 / Math.PI, head + Math.atan((px + 0.5 - W / 2) / f)); continue; }
      const d = camH * f / (py + 0.5 - hor), lat = (px + 0.5 - W / 2) * d / f;
      const gx = Math.floor(pos[0] + h[0] * d + rt[0] * lat), gy = Math.floor(pos[1] + h[1] * d + rt[1] * lat);
      const inside = gx >= 0 && gy >= 0 && gx < X && gy < Y && tex[gy * X + gx] >= 0;
      gb.code[i] = inside ? tex[gy * X + gx] : FAR; gb.obj[i] = inside ? tobj[gy * X + gx] : 0; gb.dep[i] = d;
      gb.haze[i] = inside ? (d > 110 ? 2 : d > 64 ? 1 : 0) : 1;
    }
    // billboards, far to near: each pixel of the board casts a level ray through just that object
    const allow = new Uint8Array(256);
    const boards = w.boards.map(bb => {
      const rx = bb.cx - pos[0], ry = bb.cy - pos[1];
      return { ...bb, dep: rx * h[0] + ry * h[1], lat: rx * rt[0] + ry * rt[1] };
    }).filter(bb => bb.dep > 4).sort((p, q) => q.dep - p.dep);
    for (const bb of boards) {
      const sc = f / bb.dep, cx = W / 2 + bb.lat * sc, gy0 = hor + (camH - (bb.base - G)) * sc;
      allow.fill(0); allow[bb.o] = 1;
      for (let py = Math.max(0, Math.floor(gy0 - bb.h * sc)); py < Math.min(H, Math.ceil(gy0)); py++)
        for (let px = Math.max(0, Math.floor(cx - bb.hw * sc)); px < Math.min(W, Math.ceil(cx + bb.hw * sc)); px++) {
          const i = py * W + px;
          if (gb.dep[i] <= bb.dep) continue;
          const u = (px + 0.5 - cx) / sc, v = (gy0 - py - 0.5) / sc;
          const ox = bb.cx + rt[0] * u - h[0] * (bb.hw + 3), oy = bb.cy + rt[1] * u - h[1] * (bb.hw + 3);
          if (!cast(w, ox, oy, bb.base + v, h[0], h[1], 0, 0, 2 * bb.hw + 6, allow)) continue;
          const k = faceOf(F, HIT.v, HIT.f);
          if (k < 0) continue;
          gb.code[i] = k; gb.obj[i] = bb.o; gb.dep[i] = bb.dep; gb.haze[i] = bb.dep > 110 ? 2 : bb.dep > 64 ? 1 : 0;
        }
    }
    return finish(gb, 1e9, 0.3);
  }
  M7.project = L => {
    const { h, f, hor } = M7, fwd = L[0] * h[0] + L[1] * h[1], side = L[0] * -h[1] + L[1] * h[0];
    if (fwd <= 0.05) return null;
    return [W / 2 + side / fwd * f, hor - L[2] / fwd * f];
  };

  // ---- the eight views ----
  const VIEWS = {
    'Top-down': { A: [[2, 0, 0], [0, 2, 0]], off: [0, 0], hint: [0, 0, -1], look: null,
      note: 'Top-down: sx = 2x, sy = 2y. Only tops show, so the sun reads through cast shadows alone: length height / tan(elevation), pointing away from the sun.' },
    '3/4 oblique': { A: [[2, 0, 0], [0, 1.5, -1.5]], off: [0, 31], hint: [0, -1, -1], look: 0,
      note: '3/4 oblique: sx = 2x, sy = 1.5(y − z). Tops and south faces; every pixel is a ray along (0, −1, −1) into the voxels.' },
    'Isometric': { A: [[1, -1, 0], [0.5, 0.5, -1]], off: [70, 34], hint: [-1, -1, -1], look: 315,
      note: 'Isometric 2:1: sx = x − y, sy = (x + y)/2 − z. South and east faces show: swing the compass and watch the lit side swap.' },
    'Side view': { A: [[3, 0, 0], [0, 0, -3]], off: [-30, 121], hint: [0, -1, 0], cut: 44, look: 0,
      note: 'Side view: sx = 3x, sy = −3z, cut through the pond so the ground shows in section. Rows behind the cut are hazed one or two steps toward the sky.' },
    'Mode 7': { bake: bakeMode7, cam: M7, look: Math.atan2(M7.h[0], -M7.h[1]) * 180 / Math.PI,
      note: 'Mode 7: the top-down faces laid on a plane, depth = h·f/(sy − horizon), with trees, people and the lamp as upright billboards. Roofs lie flat, as Mode 7 draws them, but every shadow is the true one.' },
    'Raycaster': { bake: bakeRay, cam: RAYCAM, look: Math.atan2(RAYCAM.h[0], -RAYCAM.h[1]) * 180 / Math.PI,
      note: 'Raycaster: one perspective ray per pixel through the voxel grid (a voxel caster, not the Wolfenstein column trick), baked for this camera. Far rays fall onto a ground plane and into haze.' },
    'Sprite stack': { stack: true, look: 0,
      note: 'Sprite stack: each height is a slice whose voxels carry their lit ink; the slices turn every frame, one drawImage each. The light stays put on the world while the camera turns.' },
    'Hex': { world: 'hex', A: [[2, 0, 0], [0, 1.5, -1]], off: [0, 22], hint: [0, -1, -1], look: 0,
      note: 'Hex: the ground snapped to hex prisms (one height and one surface per cell, a rim on each), houses and trees kept as voxels, lit by the same sun.' },
  };
  const NAMES = Object.keys(VIEWS);

  // ---- painting a view for a sun state ----
  function paintGB(gb, S, lit, img, proj) {
    const o = img.data, { code, haze, band, star } = gb, bands = S.bands, night = S.night > 0.55;
    for (let i = 0, k = 0; i < code.length; i++, k += 4) {
      const c = code[i];
      let idx;
      if (c >= 0) idx = lit[c];
      else if (c === SKYC) idx = night && star[i] ? (star[i] === 2 ? 7 : 5) : bands[band[i]];
      else if (c === LINE) idx = 0;
      else if (c === FAR) idx = S.far;
      else if (c === MTN) idx = S.mtn[0];
      else if (c === MTN2) idx = S.mtn[1];
      else idx = S.cut[CUT - c];
      if (haze[i]) idx = S.haze[haze[i]][idx];
      const p = RGB[idx]; o[k] = p[0]; o[k + 1] = p[1]; o[k + 2] = p[2]; o[k + 3] = 255;
    }
    // the sun or the moon, where a perspective camera can see it, behind the hills
    if (proj && S.src !== 'none' && S.L[2] > -0.05) {
      const sp = proj(S.L), moon = S.src === 'moon';
      if (sp) {
        const r = moon ? 3.2 : 4.2, lo = S.el < 8;
        for (let y = Math.floor(sp[1] - r); y <= sp[1] + r; y++) for (let x = Math.floor(sp[0] - r); x <= sp[0] + r; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H || code[y * W + x] !== SKYC) continue;
          const d = Math.hypot(x + 0.5 - sp[0], y + 0.5 - sp[1]);
          if (d > r) continue;
          const idx = moon ? ((x + 0.5 - sp[0]) + (y + 0.5 - sp[1]) * 0.5 > 1.2 ? 5 : 6) : d > r - 1.3 ? (lo ? 11 : 13) : lo ? 12 : 7;
          const p = RGB[idx], k = (y * W + x) * 4; o[k] = p[0]; o[k + 1] = p[1]; o[k + 2] = p[2];
        }
      }
    }
  }

  Kit.register('sun', { title: 'Sun and shadow in every projection', fit: 'prebake' }, host => {
    const worlds = {}, faces = {}, gbs = {};
    const world = name => {
      if (!worlds[name]) { worlds[name] = buildWorld(name === 'hex'); faces[name] = faceList(worlds[name]); }
      return worlds[name];
    };
    world('main');
    const st = { season: 1, step: 30, comp: 0, view: 'Isometric', all: false, play: false };
    // sun states, cached by step: each holds its lit faces per world, so scrubbing back is a lookup
    const cache = new Map();
    const sunKey = () => st.season + '|' + st.step + '|' + st.comp;
    function sun() {
      const key = sunKey();
      let S = cache.get(key);
      if (!S) {
        S = sunState(st.season, st.step, st.comp);
        cache.set(key, S);
        if (cache.size > 240) cache.delete(cache.keys().next().value);
      }
      return S;
    }
    const litFor = (S, name) => S.lit[name] || (S.lit[name] = lightFaces(world(name), faces[name], S));
    function gbFor(name) {
      if (gbs[name]) return gbs[name];
      const v = VIEWS[name], wn = v.world || 'main', w = world(wn), F = faces[wn];
      return (gbs[name] = v.bake ? v.bake(w, F) : bakeOrtho(w, F, v));
    }
    // sprite stack: one canvas per height, rebuilt per sun state from the lit faces
    let voxFace = null;
    function slices(S) {
      if (S.slices) return S.slices;
      const w = world('main'), F = faces.main, lit = litFor(S, 'main');
      if (!voxFace) { voxFace = new Int32Array(V).fill(-1); for (let v = 0; v < V; v++) if (w.mat[v]) voxFace[v] = faceOf(F, v, -1); }
      S.slices = [];
      for (let z = 0; z < w.maxZ; z++) {
        const p = new Pix(X, Y);
        // buried voxels (inside walls, under the grass) have no open face: they take their material's shaded ink,
        // so every slice is solid and nothing shows through when it is squashed and turned
        for (let i = 0; i < XY; i++) { const v = z * XY + i, k = voxFace[v]; if (k >= 0) p.d[i] = lit[k]; else if (w.mat[v]) p.d[i] = S.cut[w.mat[v]]; }
        const cv = document.createElement('canvas'); cv.width = X; cv.height = Y;
        cv.getContext('2d').putImageData(p.toImage(), 0, 0); S.slices.push(cv);
      }
      const sky = new Pix(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const e = 60 * (1 - (y + 0.5) / H), v = e >= 40 ? 0 : e >= 22 ? (40 - e) / 18 : e >= 11 ? 1 + (22 - e) / 11 : e >= 4 ? 2 + (11 - e) / 7 : 3 + (4 - e) / 4;
        let b = Math.floor(v); if (b < 4 && v - b > 0.78 && (x + y) % 2) b++;
        sky.d[y * W + x] = S.bands[Math.min(4, b)];
      }
      S.skyCv = document.createElement('canvas'); S.skyCv.width = W; S.skyCv.height = H;
      S.skyCv.getContext('2d').putImageData(sky.toImage(), 0, 0);
      return S.slices;
    }
    let ang = 0.6;
    function drawStack(g, S) {
      const sl = slices(S);
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(S.skyCv, 0, 0);
      for (let k = 0; k < sl.length; k++) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.translate(W / 2, H / 2 + 16 - k);
        g.scale(1.3, 1.3 * 0.62);
        g.rotate(ang);
        g.drawImage(sl[k], -X / 2, -Y / 2);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    function paintView(name, target) {
      const S = sun(), v = VIEWS[name];
      if (v.stack) { drawStack(target.g, S); return; }
      const gb = gbFor(name);
      paintGB(gb, S, litFor(S, v.world || 'main'), target.img, v.cam && v.cam.project);
      target.g.putImageData(target.img, 0, 0);
    }

    // ---- layout: the big view, the grid of all eight, then the sun controls and the view tabs ----
    const mainBox = Kit.el('div', {});
    host.append(mainBox);
    const c = Kit.canvas(mainBox, W, H), main = { g: c.g, img: new ImageData(W, H) };
    c.cv.style.touchAction = 'pan-y';
    c.cv.style.cursor = 'ew-resize';
    const grid = Kit.el('div', { style: 'display:none;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px 8px' });
    host.append(grid);
    const cells = NAMES.map(name => {
      const cv = Kit.el('canvas', { class: 'px', width: W, height: H, style: 'cursor:pointer' });
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      const cap = Kit.el('div', { style: 'font-size:12px;color:#a29eb6;text-align:center;margin-top:3px' }, name);
      const box = Kit.el('div', { style: 'min-width:0' }, cv, cap);
      cv.addEventListener('click', () => pick(name));
      grid.append(box);
      return { name, cv, box, g, img: new ImageData(W, H) };
    });
    const fitCells = () => {
      const dpr = window.devicePixelRatio || 1;
      for (const cl of cells) {
        const cw = cl.box.clientWidth || W;
        let s = Math.floor(cw * dpr / W) / dpr;
        if (s <= 0) s = cw / W;
        cl.cv.style.width = W * s + 'px'; cl.cv.style.height = H * s + 'px';
      }
    };
    if (window.ResizeObserver) new ResizeObserver(fitCells).observe(grid);

    // the sun row: the compass (where the sun stands), the day strip (when), the readout and the buttons
    const sunRow = Kit.el('div', { class: 'ctl', style: 'flex-wrap:nowrap;align-items:flex-start;gap:12px' });
    host.append(sunRow);
    const compBox = Kit.el('div', { style: 'width:clamp(86px,18vw,128px);flex:none' });
    const right = Kit.el('div', { style: 'flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:6px' });
    sunRow.append(compBox, right);
    const cc = Kit.canvas(compBox, 41, 41, { max: 3 });
    cc.cv.style.touchAction = 'none'; cc.cv.style.cursor = 'grab';
    cc.cv.tabIndex = 0; cc.cv.setAttribute('aria-label', 'Compass: drag to turn north, arrow keys step it');
    const stripBox = Kit.el('div', { style: 'min-width:0' });
    right.append(stripBox);
    const sc = Kit.canvas(stripBox, 96, 12);
    sc.cv.style.touchAction = 'none'; sc.cv.style.cursor = 'ew-resize'; sc.cv.style.margin = '0';
    sc.cv.tabIndex = 0; sc.cv.setAttribute('aria-label', 'Time of day: drag, or arrow keys');
    const readout = Kit.el('div', { style: 'font-size:13px;font-variant-numeric:tabular-nums' });
    right.append(readout);
    const btnRow = Kit.el('div', { class: 'tabs', style: 'align-items:center;gap:6px' });
    right.append(btnRow);
    const playBtn = Kit.el('button', { type: 'button', 'aria-pressed': 'false' }, 'Play day');
    playBtn.addEventListener('click', () => { st.play = !st.play; playBtn.setAttribute('aria-pressed', String(st.play)); playBtn.textContent = st.play ? 'Pause' : 'Play day'; });
    btnRow.append(playBtn);
    const seasonBtns = SEASONS.map((name, i) => {
      const b = Kit.el('button', { type: 'button', 'aria-pressed': String(i === st.season) }, name);
      b.addEventListener('click', () => { st.season = i; seasonBtns.forEach((x, j) => x.setAttribute('aria-pressed', String(j === i))); strip = null; redraw(); });
      btnRow.append(b);
      return b;
    });

    const bar = Kit.bar(host);
    const viewTabs = bar.tabs([...NAMES, 'All eight'], v => pick(v), st.view);
    const note = bar.note('');
    const how = bar.note('Every view sees the same voxel faces. Each face is lit once per sun step: its angle to the sun picks one of four ramp steps, a ray marched toward the sun through the grid decides shadow, and the sky tints the ambient and the shadows. At night the full moon takes over and the windows and the lamp throw warm light. Drag the picture or the strip to move the sun; drag the compass to swing north.');
    how.style.marginTop = '-2px';

    function pick(v) {
      st.all = v === 'All eight';
      if (!st.all) st.view = v;
      [...viewTabs.children].forEach(b => b.setAttribute('aria-pressed', String(b.textContent === (st.all ? 'All eight' : st.view))));
      mainBox.style.display = st.all ? 'none' : '';
      grid.style.display = st.all ? 'grid' : 'none';
      note.textContent = st.all ? 'All eight at once, each from the same lit faces. Tap one to open it.' : VIEWS[st.view].note;
      if (st.all) fitCells();
      redraw();
    }

    // ---- the compass: zenith in the middle, horizon at the rim, the day's path, the sun or moon, north, the viewer ----
    const FONT = { N: ['1..1', '11.1', '1.11', '1..1', '1..1'], E: ['111', '1..', '11.', '1..', '111'], S: ['.11', '1..', '.1.', '..1', '11.'], W: ['1...1', '1...1', '1.1.1', '1.1.1', '.1.1.'] };
    function drawCompass(S) {
      const p = new Pix(41, 41), C = 20.5, R = 18.5;
      const at = (a, r) => [Math.floor(C + Math.sin(a) * r), Math.floor(C - Math.cos(a) * r)];
      for (let y = 0; y < 41; y++) for (let x = 0; x < 41; x++) {
        const d = Math.hypot(x + 0.5 - C, y + 0.5 - C);
        if (d <= R) p.set(x, y, d > R - 1.2 ? 3 : S.bands[d < 8 ? 0 : d < 14 ? 2 : 4]);
      }
      for (let a = 0; a < 64; a++) if (a % 2 === 0) { const [x, y] = at(a / 64 * Math.PI * 2, 9.5); p.set(x, y, S.night > 0.5 ? 2 : 6); }
      const cr = st.comp * Math.PI / 180;
      for (let k = 0; k < 4; k++) {
        const [x, y] = at(cr + k * Math.PI / 2, R - 2.2); p.set(x, y, 7);
        const g = FONT['NESW'[k]], [lx, ly] = at(cr + k * Math.PI / 2, R - 6.5);
        g.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '1') p.set(lx - (row.length >> 1) + i, ly - 2 + j, k ? 5 : 13); }));
      }
      // the viewer's side of the world, for the views that have one
      const look = st.view === 'Sprite stack' ? -ang * 180 / Math.PI : VIEWS[st.view].look;
      if (!st.all && look != null) {
        const a = (look + 180) * Math.PI / 180;
        for (let r = R - 0.6; r < R + 2.4; r += 0.5) { const [x, y] = at(a, r); p.set(x, y, 31); }
        const [x, y] = at(a, R + 1.4); p.set(x - 1, y, 31); p.set(x + 1, y, 31); p.set(x, y - 1, 31); p.set(x, y + 1, 31);
      }
      for (let s = 0; s < 96; s++) {
        const q = sunAt(st.season, s / 4, st.comp);
        if (q.el > 0 && s % 2 === 0) { const [x, y] = at(q.az, R * (1 - q.el / 90)); p.set(x, y, S.night > 0.5 ? 3 : 12); }
      }
      const moon = S.el < 0, a = S.s.az + (moon ? Math.PI : 0), el = Math.abs(S.el);
      const [sx, sy] = at(a, R * (1 - el / 90));
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
        const d = Math.hypot(x, y);
        if (d <= 2.3) p.set(sx + x, sy + y, d > 1.6 ? 0 : moon ? (x + y > 0 ? 5 : 6) : d < 0.9 ? 7 : 13);
      }
      cc.put(p);
    }
    // ---- the day strip: the sky for each quarter hour, the sun's height, the hours, and now ----
    let strip = null;
    function drawStrip() {
      if (!strip) {
        strip = new Pix(96, 12);
        for (let s = 0; s < 96; s++) {
          const q = sunAt(st.season, s / 4, 0), k = skyAt(q.el), b = skyBands(k);
          for (let y = 0; y < 10; y++) strip.set(s, y, b[Math.min(4, y >> 1)]);
          const light = q.el > 0 ? k.sun.map((v, i) => k.amb[i] + v * Math.max(0.3, Math.sin(q.el * Math.PI / 180))) : k.amb;
          strip.set(s, 10, snap(RGB[17].map((v, i) => v * KA * light[i]), FAM.green)); strip.set(s, 11, strip.get(s, 10));
          if (q.el > 0) strip.set(s, Math.round(9 - q.el / 75 * 9), q.el < 8 ? 12 : 13);
          else if (q.el < -4 && s % 2 === 0) strip.set(s, Math.round(9 - Math.min(75, -q.el) / 75 * 9), 6);
          if (s % 4 === 0) strip.set(s, 11, s % 24 === 0 ? 7 : 3);
        }
      }
      const p = new Pix(96, 12); p.d.set(strip.d);
      for (let y = 0; y < 12; y++) p.set(st.step, y, y === 0 || y === 11 ? 7 : p.get(st.step, y) === 7 ? 0 : 7);
      p.set(st.step - 1, 0, 7); p.set(st.step + 1, 0, 7); p.set(st.step - 1, 11, 7); p.set(st.step + 1, 11, 7);
      sc.put(p);
    }
    const WIND = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    function phase(el, hour) {
      const am = hour < 12;
      if (el < -12) return 'night';
      if (el < -4) return am ? 'pre-dawn' : 'dusk';
      if (el < 0) return am ? 'dawn' : 'twilight';
      if (el < 5) return am ? 'sunrise' : 'sunset';
      if (el < 13) return 'golden hour';
      if (Math.abs(hour - 12) <= 1) return 'noon';
      return am ? 'morning' : 'afternoon';
    }
    function drawReadout(S) {
      const hour = st.step / 4, hh = String(Math.floor(hour)).padStart(2, '0'), mm = String((st.step % 4) * 15).padStart(2, '0');
      const moon = S.el < 0, az = (S.s.azT * 180 / Math.PI + (moon ? 180 : 0)) % 360, e = Math.round(Math.abs(S.el));
      const body = moon ? (S.src === 'moon' ? 'moon ' + e + '° up in the ' + WIND[Math.round(az / 45) % 8] : 'sun just below the horizon')
        : 'sun ' + e + '° up in the ' + WIND[Math.round(az / 45) % 8];
      readout.textContent = hh + ':' + mm + ' · ' + phase(S.el, hour) + ' · ' + body + ' · north turned ' + st.comp + '°';
    }

    let dirty = true;
    function redraw() {
      const S = sun();
      if (st.all) cells.forEach(cl => paintView(cl.name, cl));
      else paintView(st.view, main);
      drawCompass(S); drawStrip(); drawReadout(S);
      dirty = false;
    }
    const setStep = s => { s = ((Math.round(s) % 96) + 96) % 96; if (s !== st.step) { st.step = s; redraw(); } };
    const setComp = a => { a = ((Math.round(a / 15) * 15) % 360 + 360) % 360; if (a !== st.comp) { st.comp = a; redraw(); } };

    // drag the picture sideways: a full width is twelve hours
    let drag = null;
    c.cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: st.step }; c.cv.setPointerCapture(e.pointerId); });
    c.cv.addEventListener('pointermove', e => { if (drag) setStep(drag.s + (e.clientX - drag.x) / c.cv.getBoundingClientRect().width * 48); });
    c.cv.addEventListener('pointerup', () => { drag = null; });
    c.cv.addEventListener('pointercancel', () => { drag = null; });
    // the strip: put the time where you touch
    let sdrag = false;
    const stripAt = e => { const r = sc.cv.getBoundingClientRect(); setStep(clamp(Math.floor((e.clientX - r.left) / r.width * 96), 0, 95)); };
    sc.cv.addEventListener('pointerdown', e => { sdrag = true; sc.cv.setPointerCapture(e.pointerId); stripAt(e); });
    sc.cv.addEventListener('pointermove', e => { if (sdrag) stripAt(e); });
    sc.cv.addEventListener('pointerup', () => { sdrag = false; });
    sc.cv.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { setStep(st.step + (e.key === 'ArrowRight' ? 1 : -1)); e.preventDefault(); } });
    // the compass: north goes where you point
    let cdrag = false;
    const compAt = e => { const r = cc.cv.getBoundingClientRect(); setComp(Math.atan2(e.clientX - r.left - r.width / 2, -(e.clientY - r.top - r.height / 2)) * 180 / Math.PI); };
    cc.cv.addEventListener('pointerdown', e => { cdrag = true; cc.cv.setPointerCapture(e.pointerId); compAt(e); });
    cc.cv.addEventListener('pointermove', e => { if (cdrag) compAt(e); });
    cc.cv.addEventListener('pointerup', () => { cdrag = false; });
    cc.cv.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { setComp(st.comp + (e.key === 'ArrowRight' ? 15 : -15)); e.preventDefault(); } });

    pick(st.view);
    host._sun = { st, pick, redraw: () => { strip = null; redraw(); } }; // for the bench's scripted screenshots
    let tick = 0;
    Kit.loop(host, () => {
      tick++;
      if (st.play && tick % 3 === 0) { st.step = (st.step + 1) % 96; dirty = true; }
      ang += 0.006;
    }, () => {
      const stack = st.all || st.view === 'Sprite stack';
      if (dirty) redraw();
      else if (stack) {
        const S = sun();
        if (st.all) drawStack(cells[NAMES.indexOf('Sprite stack')].g, S); else { drawStack(main.g, S); drawCompass(S); }
      }
    }, 30);
  });
})();
