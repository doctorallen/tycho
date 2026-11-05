// gi-3d.js: the dungeon corner from lights.js rebuilt as a voxel room and lit with global illumination that stays smooth.
// gi-3d: direct light is evaluated exactly per pixel on the GPU every frame (falloff, N.L, soft shadows marched through a
// distance field of the voxels), so a moving lamp is clean on its first frame. Bounced light comes from a coarse grid of
// irradiance probes (after DDGI): each gathers a fixed set of rays through the voxel grid (DDA), stores an ambient cube
// per bounce level, and blends new results into its history, so indirect light glides instead of flickering. The probes
// are read per vertex with visibility weights and voxel corner occlusion, and the GPU interpolates across each face.
// Drawn at 192x112, nearest pixels, optionally printed into palette ramps (the 2D card's bands) with a world-anchored dither.
'use strict';
(() => {
  const { RGB } = Kit;
  const W = 192, H = 112, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const fall = t => t >= 1 ? 0 : (1 - t * t) * (1 - t * t) / (1 + 6 * t * t);   // lights.js's windowed falloff

  // ---- the floor of the 2D room, pixel for pixel (lights.js): flagstones, the rug, the lava crack ----
  // One voxel is 4x4 of these pixels, so each voxel face carries a 4x4 tile of the 2D room's inks.
  const slab = (x, y) => {
    const tx = x >> 3, ty = y >> 3, wide = Kit.hash2(tx >> 1, ty, 11) < 0.5, s0 = wide ? tx >> 1 << 1 : tx;
    const su = x - s0 * 8, sw = wide ? 16 : 8, v = y & 7;
    const h = v === 7 || su === sw - 1 ? 0 : v === 0 || v === 6 || su === 0 || su === sw - 2 ? 1 : 2;
    return h === 0 ? 3 : (v === 0 && su < 3) || (su === 0 && v < 2) ? 5 : 4;
  };
  const FW = 192, FH = 112, FLOOR = new Int8Array(FW * FH), FEMIT = new Uint8Array(FW * FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) FLOOR[y * FW + x] = slab(x, y);
  for (let y = 66; y < 82; y++) for (let x = 52; x < 84; x++) {
    const e = y === 66 || y === 81 || x === 52 || x === 83, s = y === 68 || y === 79 || x === 54 || x === 81;
    const dm = Math.abs(x - 67.5) + Math.abs(y - 73.5) * 1.4;
    FLOOR[y * FW + x] = e ? 9 : s || (dm > 4 && dm < 5.5) ? 11 : 10;
  }
  const lr = Kit.rng('lava'), LAVA_Y = {}, LX0 = 134, LX1 = 176;
  for (let x = LX0, y = 93; x <= LX1; x++) { if (x % 2 === 0) y = clamp(y + lr.int(-1, 1), 89, 96); LAVA_Y[x] = y; }
  const fink = (x, y, v, e = 0) => { FLOOR[y * FW + x] = v; FEMIT[y * FW + x] = e; };
  for (let x = LX0; x <= LX1; x++) {
    const y = LAVA_Y[x], yp = LAVA_Y[Math.max(LX0, x - 1)];
    for (let v = Math.min(y, yp) - 2; v <= Math.max(y, yp) + 2; v++) for (const u of [-1, 0, 1]) fink(x + u, v, 9);
  }
  for (let x = LX0; x <= LX1; x++) {
    const y = LAVA_Y[x], yp = LAVA_Y[Math.max(LX0, x - 1)], end = x < LX0 + 4 || x > LX1 - 4;
    for (let v = Math.min(y, yp); v <= Math.max(y, yp); v++) fink(x, v, end ? 12 : 13, 1);
    if (!end && Kit.hash2(x, 0, 5) < .55) fink(x, y - 1, 11, 1);
    if (!end && Kit.hash2(x, 1, 5) < .35) fink(x, y + 1, 11, 1);
  }
  // brick courses, the crate and the window from lights.js
  const brick = (u, r) => r <= 0 ? 1 : r % 4 === 0 ? 0 : (u + ((r >> 2) & 1) * 4) % 8 === 0 ? 0 : 1;
  const crateFace = (u, z, w, h) => {
    const side = u === 0 || u === w - 1, band = z === 1 || z === h - 2, brace = Math.abs(u - z * (w - 1) / (h - 1)) < .7;
    return side || z === 0 || z === h - 1 ? 0 : band ? 26 : brace ? 28 : 27;
  };
  const glass = (u, r) => {
    if (u < 0 || u > 15 || r < 0 || r > 10) return 0;
    if (!(r >= 3 || (u - 7.5) ** 2 + (3 - r) ** 2 * 2.4 <= 56)) return 0;
    const edge = u === 0 || u === 15 || r === 10 || (r < 3 && ((u - 7.5) ** 2 + (2 - r) ** 2 * 2.4 > 56 || r === 0));
    return edge ? 1 : (u === 7 || u === 8 || r === 6) ? 2 : 3;   // 1 frame, 2 mullion, 3 glass
  };
  const CHAR = ['..ooo..', '.oCCco.', 'oCcccdo', 'ocsssdo', 'ocesedo', 'oosssoo', 'oCcccdo', 'oCcccdo',
    'obbbbbo', 'oCcccdo', 'oCcccdo', '.ol.lo.', '.ff.ff.'];
  const CKEY = { o: 0, C: 17, c: 16, d: 15, s: 29, e: 0, b: 27, l: 2, f: 26, '.': 0 };

  // ---- the voxel room: 48 x 28 cells of 4 px, walls 8 high, pillars 11, x east, y south, z up ----
  // For the light the room is closed: a ceiling at z 12 and the outer walls carried up to it, which the camera cuts away
  // (never drawn), as a cutaway view of any interior does. Without them half of every ray would leave through the top.
  const X = 48, Y = 28, Z = 13, NV = X * Y * Z;
  const M = { FLOOR: 1, WALL: 2, PILLAR: 3, CRATE: 4, PLINTH: 5, GLASS: 6, CRYS: 7, FLAME: 8, BRACKET: 9, CHAR: 10, CEIL: 11 };
  const MAT = new Uint8Array(NV), vi = (x, y, z) => (z * Y + y) * X + x;
  const box = (x0, y0, z0, x1, y1, z1, m) => { for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) MAT[vi(x, y, z)] = m; };
  box(0, 0, 0, X, Y, 1, M.FLOOR);
  box(0, 0, 1, X, 6, 9, M.WALL); box(0, 0, 1, 2, Y, 9, M.WALL); box(46, 0, 1, X, Y, 9, M.WALL); box(0, 26, 1, X, Y, 3, M.WALL);
  box(18, 12, 1, 28, 14, 9, M.WALL);
  box(33, 5, 4, 37, 6, 8, M.GLASS);   // the window, flush with the wall's face as in the 2D room; behind it is sky
  box(10, 10, 1, 12, 12, 12, M.PILLAR); box(34, 17, 1, 36, 19, 12, M.PILLAR);
  box(6, 20, 1, 8, 22, 5, M.CRATE); box(8, 20, 1, 10, 22, 5, M.CRATE); box(38, 8, 1, 40, 10, 5, M.CRATE);
  box(40, 14, 1, 42, 16, 4, M.PLINTH); box(40, 14, 4, 42, 16, 6, M.CRYS); box(41, 15, 6, 42, 16, 7, M.CRYS);
  box(14, 6, 5, 15, 7, 6, M.BRACKET); box(14, 6, 6, 15, 7, 7, M.FLAME);
  box(23, 20, 1, 25, 21, 7, M.CHAR);
  box(0, 0, 12, X, Y, 13, M.CEIL);
  for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) if (x < 2 || x >= 46 || y < 6 || y >= 26) for (let z = 1; z < 12; z++) if (!MAT[vi(x, y, z)]) MAT[vi(x, y, z)] = M.CEIL;
  // rays pass through the flame and the crystal: they are drawn glowing, and their light is cast as point lights
  const SOLID = new Uint8Array(NV);
  for (let i = 0; i < NV; i++) SOLID[i] = MAT[i] && MAT[i] !== M.FLAME && MAT[i] !== M.CRYS ? 1 : 0;
  const wallTop = (x, y) => { let z = Z - 1; while (z > 0 && MAT[vi(x, y, z)] !== M.WALL) z--; return z + 1; };

  // ---- lights (lights.js's, at voxel scale) ----
  const TORCH = { x: 14.5, y: 6.6, z: 6.6, r: 22, s: 1.8, c: [1, .62, .32] };
  const CRYS = { x: 41, y: 15, z: 5.5, r: 14, s: .9, c: [.5, .84, .9] };
  const LAN = { x: 28.1, y: 23.6, z: 3.5, r: 26, s: 2.2, c: [1, .8, .56] };
  // the lava's surface lies flat in the floor, so it can't light the floor it lies in; three low glows above the crack
  // stand in for its heat and smoke, as the 2D card's lava lights do. Its surface still lights walls as an area light.
  const GLOW = [140, 155, 170].map(x => ({ x: (x + .5) / 4, y: (LAVA_Y[x] + .5) / 4, z: 1.5, r: 10, s: 1, c: [1, .45, .16] }));
  // the window glows into the room as a soft sky light, as the 2D card's window emits; the moon beam comes through it too
  const WINL = { x: 35, y: 6.9, z: 6, r: 26, s: 1.5, c: [.58, .7, 1] };
  const MOON = [.58, .7, 1], MOON_S = 1.1, MDIR = (() => { const v = [.3, -1, .45], l = Math.hypot(...v); return v.map(a => a / l); })();
  const LAVA_E = [7, 3.1, 1.1], GLASS_E = MOON.map(v => v * 2.2), AMB = [.07, .07, .12];
  const EXPO = 1.3, LAMB = 1.5;


  // ---- faces: every voxel face drawn by the camera or open to a cell light can cross, each with a 4x4 ink tile ----
  const TILE = 4, ROW = 128;
  const faces = [], faceOf = new Int32Array(NV * 6).fill(-1);
  for (let z = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) {
    const v = vi(x, y, z); if (!MAT[v]) continue;
    for (let ax = 0; ax < 3; ax++) for (const dir of [1, -1]) {
      const n = [x, y, z]; n[ax] += dir;
      if (n[2] < 0) continue;
      const out = n[0] < 0 || n[1] < 0 || n[0] >= X || n[1] >= Y || n[2] >= Z, nv = out ? -1 : vi(n[0], n[1], n[2]);
      // drawn: a visible voxel's face onto air or the cut-away shell; lit: a face onto a cell light can cross
      const drawn = MAT[v] !== M.CEIL && (out || !MAT[nv] || MAT[nv] === M.CEIL), lit = !out && !SOLID[nv];
      if (!drawn && !lit) continue;
      if (lit) faceOf[v * 6 + ax * 2 + (dir > 0 ? 0 : 1)] = faces.length;
      faces.push({ x, y, z, ax, dir, m: MAT[v], lit, drawn, nI: ax * 2 + (dir > 0 ? 0 : 1) });
    }
  }
  const F = faces.length, LANF = F;   // one extra tile for the lantern's little lamp

  // the ink of one 4x4 sub-cell of a face, and whether it glows: [ink, emit]
  function faceInk(f, su, sv) {
    const { x, y, z, ax, dir, m } = f, u = (ax + 1) % 3, v = (ax + 2) % 3;
    const P = [x, y, z]; P[ax] += dir > 0 ? 1 : 0; P[u] += (su + .5) / 4; P[v] += (sv + .5) / 4;
    const px = Math.floor(P[0] * 4), py = Math.floor(P[1] * 4), pz = Math.floor(P[2] * 4);
    const top = ax === 2 && dir > 0, hu = ax === 1 ? px : py, lx = px & 3, ly = py & 3;
    switch (m) {
      case M.FLOOR: { if (!top) return [3, 0]; const i = clamp(py, 0, FH - 1) * FW + clamp(px, 0, FW - 1); return [FLOOR[i], FEMIT[i]]; }
      case M.WALL: {
        if (top) {
          const open = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < X && ny < Y && !MAT[vi(nx, ny, z)]; };
          if (ly === 3 && open(0, 1)) return [3, 0];
          if ((ly === 0 && open(0, -1)) || (lx === 0 && open(-1, 0)) || (lx === 3 && open(1, 0))) return [0, 0];
          return [1, 0];
        }
        const r = wallTop(x, y) * 4 - 1 - pz;
        return [r === 0 ? 5 : pz === 4 ? 2 : brick(hu, r) ? 3 : 2, 0];
      }
      case M.PILLAR: {
        if (top) return [lx + ly === 0 || (ax === 2 && (px & 7) === 0) ? 0 : 5, 0];
        const r = 47 - pz, edge = (hu & 7) === 0 || (hu & 7) === 7;
        return [edge ? 1 : r <= 1 ? (r === 0 ? 5 : 4) : pz <= 5 ? 3 : 4, 0];
      }
      case M.CRATE: {
        if (top) { const cu = px & 7, cv = py & 7; return [cu === 0 || cu === 7 || cv === 0 ? 0 : cv === 7 ? 29 : cu === 4 ? 27 : 28, 0]; }
        return [crateFace(hu & 7, pz - 4, 8, 16), 0];
      }
      case M.PLINTH: {
        if (top) return [(px & 7) === 0 || (px & 7) === 7 || (py & 7) === 0 ? 0 : 5, 0];
        const zl = pz - 4;
        return [(hu & 7) === 0 || (hu & 7) === 7 || zl === 0 ? 1 : zl === 11 ? 4 : 3, 0];
      }
      case M.GLASS: {
        if (ax !== 1) return [1, 0];
        const k = glass(px - 132, Math.floor((32 - pz) * 11 / 16));
        return k === 3 ? [pz >= 25 ? 25 : 24, 1] : [k === 1 ? 0 : k === 2 ? 1 : 2, 0];
      }
      case M.CRYS: return [top ? 25 : (su + sv) % 5 === 0 ? 7 : pz > 21 ? 24 : 23, 1];
      case M.FLAME: return [top || sv > 1 ? 13 : 12, 1];
      case M.BRACKET: return [su === 0 || su === 3 ? 0 : 27, 0];
      case M.CEIL: return [3, 0];
      case M.CHAR: {
        if (top) return [lx === 0 || lx === 3 && px > 95 ? 0 : 26, 0];
        const j = clamp(Math.floor((28 - pz) * 13 / 24), 0, 12);
        const i = ax === 1 ? clamp(Math.floor((px - 92) * 7 / 8), 0, 6) : 3;
        return [CKEY[CHAR[j][i]], 0];
      }
    }
    return [3, 0];
  }

  // the ink atlas, and each face's average albedo and glow (what a bounce sees of it)
  const ALB_IMG = new Uint8Array(ROW * TILE * Math.ceil((F + 1) / ROW) * TILE * 4), AW = ROW * TILE;
  const FALB = new Float32Array(F * 3), FEMI = new Float32Array(F * 3);
  faces.forEach((f, fi) => {
    const tx = fi % ROW, ty = fi / ROW | 0;
    for (let sv = 0; sv < TILE; sv++) for (let su = 0; su < TILE; su++) {
      const [k, e] = faceInk(f, su, sv), o = ((ty * TILE + sv) * AW + tx * TILE + su) * 4;
      ALB_IMG[o] = k; ALB_IMG[o + 1] = e ? 255 : 0; ALB_IMG[o + 3] = 255;
      const E = e ? (f.m === M.GLASS ? GLASS_E : f.m === M.FLOOR ? LAVA_E : null) : null;
      for (let c = 0; c < 3; c++) { if (E) FEMI[fi * 3 + c] += E[c] / 16; else if (!e) FALB[fi * 3 + c] += RGB[k][c] / 255 / 16; }
    }
  });
  { // the lantern's lamp: a frame of ink 0 around a glowing amber pane
    const tx = LANF % ROW, ty = LANF / ROW | 0;
    for (let sv = 0; sv < TILE; sv++) for (let su = 0; su < TILE; su++) {
      const o = ((ty * TILE + sv) * AW + tx * TILE + su) * 4, edge = su === 0 || su === 3 || sv === 0 || sv === 3;
      ALB_IMG[o] = edge ? 0 : sv === 1 ? 7 : 13; ALB_IMG[o + 1] = edge ? 0 : 255; ALB_IMG[o + 3] = 255;
    }
  }

  // ---- the voxel DDA: march from o along d; returns the solid cell hit, -1 if the ray leaves the grid, -2 past tmax ----
  const hit = { t: 0, ax: 0, step: 0 };
  function march(ox, oy, oz, dx, dy, dz, tmax) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const ix = dx ? Math.abs(1 / dx) : Infinity, iy = dy ? Math.abs(1 / dy) : Infinity, iz = dz ? Math.abs(1 / dz) : Infinity;
    let tx = dx ? (dx > 0 ? x + 1 - ox : ox - x) * ix : Infinity;
    let ty = dy ? (dy > 0 ? y + 1 - oy : oy - y) * iy : Infinity;
    let tz = dz ? (dz > 0 ? z + 1 - oz : oz - z) * iz : Infinity;
    for (let k = 0; k < 200; k++) {
      let t, ax;
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += ix; ax = 0; }
      else if (ty < tz) { y += sy; t = ty; ty += iy; ax = 1; }
      else { z += sz; t = tz; tz += iz; ax = 2; }
      if (t > tmax) return -2;
      if (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z) return -1;
      const v = (z * Y + y) * X + x;
      if (SOLID[v]) { hit.t = t; hit.ax = ax; hit.step = ax === 0 ? sx : ax === 1 ? sy : sz; return v; }
    }
    return -1;
  }

  // ---- direct light on the CPU, for what the probes' rays see: face centers, hard shadows, cached ----
  // (on screen, direct light is computed per pixel on the GPU instead, with soft shadows; see the shader)
  const center = f => { const P = [f.x + .5, f.y + .5, f.z + .5]; P[f.ax] += f.dir * (.5 + 1e-3); return P; };
  function pointAt(L, f, out) {
    const [ox, oy, oz] = center(f), dx = L.x - ox, dy = L.y - oy, dz = L.z - oz, d = Math.hypot(dx, dy, dz);
    const nd = [dx, dy, dz][f.ax] * f.dir / d;
    if (nd <= 0 || d >= L.r) return;
    const k = fall(d / L.r) * L.s * nd * LAMB;
    if (march(ox, oy, oz, dx / d, dy / d, dz / d, d) >= 0) return;
    for (let c = 0; c < 3; c++) out[c] += k * L.c[c];
  }
  function moonAt(f, out) {
    const [ox, oy, oz] = center(f), nd = MDIR[f.ax] * f.dir;
    if (nd <= 0) return;
    const v = march(ox, oy, oz, MDIR[0], MDIR[1], MDIR[2], 1e9);
    if (v < 0 || MAT[v] !== M.GLASS) return;
    const px = Math.floor((ox + MDIR[0] * hit.t) * 4), pz = Math.floor((oz + MDIR[2] * hit.t) * 4);
    if (glass(px - 132, Math.floor((32 - pz) * 11 / 16)) !== 3) return;
    for (let c = 0; c < 3; c++) out[c] += MOON_S * nd * LAMB * MOON[c];
  }
  const DST = new Float32Array(F * 3), DSTV = new Uint8Array(F), DLA = new Float32Array(F * 3), DLAV = new Int32Array(F).fill(-1);
  let lanVer = 0;
  const tmp3 = new Float32Array(3);
  function directAt(f, c) {   // static lights once, the lamp again whenever it has moved
    if (!DSTV[f]) { tmp3.fill(0); for (const L of [TORCH, CRYS, WINL, ...GLOW]) pointAt(L, faces[f], tmp3); moonAt(faces[f], tmp3); DST.set(tmp3, f * 3); DSTV[f] = 1; }
    if (DLAV[f] !== lanVer) { tmp3.fill(0); pointAt(LAN, faces[f], tmp3); DLA.set(tmp3, f * 3); DLAV[f] = lanVer; }
    return DST[f * 3 + c] + DLA[f * 3 + c];
  }

  // ---- irradiance probes (after DDGI): a grid every 3 cells, each an ambient cube per light level ----
  // Levels: 0 is glow from lava and window glass (area lights); k = 1..3 is the k-th bounce. Each probe gathers
  // 48 spherical-Fibonacci rays, turned by a fixed sequence of rotations, and blends them into what it had.
  const PS = 3, PI = 16, PJ = 10, PK = 4, NP = PI * PJ * PK, K = 48, LEV = 4, PSTR = LEV * 18;
  const PPOS = new Float32Array(NP * 3), PVALID = new Uint8Array(NP), PR = new Float32Array(NP * PSTR);
  const PM = new Uint16Array(NP), PN = new Uint32Array(NP), PINIT = new Uint8Array(NP);
  const solidAt = (x, y, z) => { const a = Math.floor(x), b = Math.floor(y), c = Math.floor(z); return a < 0 || b < 0 || c < 0 || a >= X || b >= Y || c >= Z || SOLID[vi(a, b, c)]; };
  for (let k = 0; k < PK; k++) for (let j = 0; j < PJ; j++) for (let i = 0; i < PI; i++) {
    const p = (k * PJ + j) * PI + i, P = [1.5 + PS * i, 1.5 + PS * j, 1.5 + PS * k];
    // a probe buried in a wall moves to the nearest open cell next to it, if there is one
    let best = solidAt(...P) ? null : P;
    for (let r = 1; !best && r <= 1; r++) for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (!best && !solidAt(P[0] + a, P[1] + b, P[2] + c)) best = [P[0] + a, P[1] + b, P[2] + c];
    if (best) { PPOS.set(best, p * 3); PVALID[p] = 1; }
  }
  const NVALID = PVALID.reduce((a, b) => a + b, 0);
  const FIB = [];
  for (let k = 0; k < K; k++) { const z = 1 - (2 * k + 1) / K, r = Math.sqrt(1 - z * z), a = k * 2.399963229728653; FIB.push([r * Math.cos(a), r * Math.sin(a), z]); }
  // the probes that light a point: the 8 around it, weighted by distance, by facing, and by a clear line of sight
  function probeWeights(P, n) {
    const fi = clamp((P[0] - 1.5) / PS, 0, PI - 1.001), fj = clamp((P[1] - 1.5) / PS, 0, PJ - 1.001), fk = clamp((P[2] - 1.5) / PS, 0, PK - 1.001);
    const i0 = fi | 0, j0 = fj | 0, k0 = fk | 0, ids = [], ws = [];
    let sum = 0;
    for (let c = 0; c < 8; c++) {
      const i = i0 + (c & 1), j = j0 + (c >> 1 & 1), k = k0 + (c >> 2 & 1), p = (k * PJ + j) * PI + i;
      if (!PVALID[p]) continue;
      const tri = (c & 1 ? fi - i0 : 1 - fi + i0) * (c >> 1 & 1 ? fj - j0 : 1 - fj + j0) * (c >> 2 & 1 ? fk - k0 : 1 - fk + k0);
      const dx = PPOS[p * 3] - P[0], dy = PPOS[p * 3 + 1] - P[1], dz = PPOS[p * 3 + 2] - P[2], d = Math.hypot(dx, dy, dz) || 1e-3;
      if (march(P[0], P[1], P[2], dx / d, dy / d, dz / d, d) >= 0) continue;
      const face = ((dx * n[0] + dy * n[1] + dz * n[2]) / d + 1) / 2;
      const w = (tri + 1e-3) * (face * face + .05);
      ids.push(p); ws.push(w); sum += w;
    }
    return { ids, ws: ws.map(w => sum ? w / sum : 0) };
  }
  const NRM = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const FPW = faces.map(f => f.lit ? probeWeights(center(f).map((v, a) => v + NRM[f.nI][a] * .5), NRM[f.nI]) : null);
  const probeAt = (pw, nI, lev, c) => { let s = 0; for (let q = 0; q < pw.ids.length; q++) s += pw.ws[q] * PR[pw.ids[q] * PSTR + lev * 18 + nI * 3 + c]; return s; };

  const fresh = new Float32Array(PSTR);
  function updateProbe(p) {
    const n = PN[p]++, h1 = Kit.hash2(p, n, 23), h2 = Kit.hash2(p, n, 29), h3 = Kit.hash2(p, n, 31);
    // a rotation from three numbers (Shoemake's uniform quaternion)
    const s1 = Math.sqrt(1 - h1), s2 = Math.sqrt(h1), qa = 2 * Math.PI * h2, qb = 2 * Math.PI * h3;
    const qx = s1 * Math.sin(qa), qy = s1 * Math.cos(qa), qz = s2 * Math.sin(qb), qw = s2 * Math.cos(qb);
    const R = [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw), 2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw), 2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)];
    fresh.fill(0);
    const ox = PPOS[p * 3], oy = PPOS[p * 3 + 1], oz = PPOS[p * 3 + 2];
    for (const [a, b, c] of FIB) {
      const d = [R[0] * a + R[1] * b + R[2] * c, R[3] * a + R[4] * b + R[5] * c, R[6] * a + R[7] * b + R[8] * c];
      const v = march(ox, oy, oz, d[0], d[1], d[2], 1e9);
      if (v < 0) continue;
      const f = faceOf[v * 6 + hit.ax * 2 + (hit.step > 0 ? 1 : 0)];
      if (f < 0) continue;
      const pw = FPW[f], nI = faces[f].nI;
      for (let ch = 0; ch < 3; ch++) {
        const al = FALB[f * 3 + ch];
        const L = [FEMI[f * 3 + ch], al * (directAt(f, ch) + probeAt(pw, nI, 0, ch)), al * probeAt(pw, nI, 1, ch), al * probeAt(pw, nI, 2, ch)];
        for (let ax = 0; ax < 3; ax++) {
          const w = d[ax], idx = (ax * 2 + (w > 0 ? 0 : 1)) * 3 + ch, aw = Math.abs(w);
          for (let l = 0; l < LEV; l++) fresh[l * 18 + idx] += L[l] * aw;
        }
      }
    }
    // hysteresis: an average that leans on its history, so light glides to a new state instead of flickering
    const m = PM[p], alpha = !PINIT[p] ? 1 : m < 12 ? .12 : 1 / (m + 1), o = p * PSTR;
    for (let i = 0; i < PSTR; i++) PR[o + i] += (fresh[i] * 4 / K - PR[o + i]) * alpha;
    PINIT[p] = 1; PM[p] = Math.min(m + 1, 1000);
  }

  // ---- the vertices: four per drawn face, each with its probe weights and a corner occlusion term ----
  const drawnFaces = faces.map((f, i) => i).filter(i => faces[i].drawn);
  const NVX = drawnFaces.length * 4, VPW = [], VNI = new Uint8Array(NVX), VAO_ = new Float32Array(NVX);
  const keyed = new Map(), occ = (x, y, z) => { if (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z) return 0; const m = MAT[vi(x, y, z)]; return m && m !== M.CEIL && SOLID[vi(x, y, z)] ? 1 : 0; };
  const CORN = [[0, 0], [1, 0], [1, 1], [0, 1]];
  drawnFaces.forEach((fi, q) => {
    const f = faces[fi], u = (f.ax + 1) % 3, v = (f.ax + 2) % 3, n = NRM[f.nI];
    CORN.forEach(([a, b], k) => {
      const P = [f.x, f.y, f.z]; P[f.ax] += f.dir > 0 ? 1 : 0; P[u] += a; P[v] += b;
      const key = P.join(',') + ',' + f.nI;
      if (!keyed.has(key)) keyed.set(key, f.lit ? probeWeights(P.map((c, i) => c + n[i] * .5), n) : { ids: [], ws: [] });
      const vx = q * 4 + k;
      VPW[vx] = keyed.get(key); VNI[vx] = f.nI;
      // smooth voxel occlusion: the two edge neighbors and the corner neighbor in front of this vertex
      const C = [f.x, f.y, f.z]; C[f.ax] += f.dir;
      const e1 = C.slice(), e2 = C.slice(), cc = C.slice(); e1[u] += a ? 1 : -1; e2[v] += b ? 1 : -1; cc[u] += a ? 1 : -1; cc[v] += b ? 1 : -1;
      const s1 = occ(...e1), s2 = occ(...e2), cr = occ(...cc), lv = s1 && s2 ? 0 : 3 - s1 - s2 - cr;
      VAO_[vx] = [.42, .62, .8, 1][lv];
    });
  });

  // ---- the band printer from lights.js: five light levels, each a reprint stepping every ink along its ramp ----
  const STEP = [-2, -1, 0, 1, 2];
  const RAMP = i => i <= 7 ? Kit.RAMPS.grey : i <= 13 ? Kit.RAMPS.red : i <= 19 ? Kit.RAMPS.green : i <= 25 ? Kit.RAMPS.blue : i <= 29 ? Kit.RAMPS.brown : Kit.RAMPS.violet;
  const WARM = [{}, {}, {}, { 5: 29, 6: 29 }, { 5: 29, 6: 13, 7: 13 }], COOL = [{}, {}, {}, { 6: 25 }, { 6: 25 }];
  const LUT = new Uint8Array(32 * 16 * 4);
  STEP.forEach((n, b) => [0, 1, 2].forEach(tone => RGB.forEach((_, i) => {
    let k = 0;
    if (i) { const r = RAMP(i), j = r.indexOf(i); k = r[clamp(j + n, 1, r.length - 1)]; if (r === Kit.RAMPS.grey && tone) k = (tone === 1 ? WARM : COOL)[b][k] ?? k; }
    LUT.set([...RGB[k], 255], ((b * 3 + tone) * 32 + i) * 4);
  })));
  RGB.forEach((c, i) => LUT.set([...c, 255], (15 * 32 + i) * 4));

  // ---- a distance field of the solid cells, for soft shadows on the GPU (two-pass chamfer, then to the surface) ----
  const SDF = new Float32Array(NV);
  {
    const D = new Float32Array(NV);
    for (let i = 0; i < NV; i++) D[i] = SOLID[i] ? 0 : 1e9;
    const NB = [];
    for (let c = -1; c <= 1; c++) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (c < 0 || (c === 0 && (b < 0 || (b === 0 && a < 0)))) NB.push([a, b, c, Math.hypot(a, b, c)]);
    for (let pass = 0; pass < 2; pass++) for (let s = 0; s < NV; s++) {
      const i = pass ? NV - 1 - s : s, x = i % X, y = (i / X | 0) % Y, z = i / (X * Y) | 0, g = pass ? -1 : 1;
      for (const [a, b, c, w] of NB) {
        const nx = x + a * g, ny = y + b * g, nz = z + c * g;
        if (nx < 0 || ny < 0 || nz < 0 || nx >= X || ny >= Y || nz >= Z) continue;
        const v = D[vi(nx, ny, nz)] + w; if (v < D[i]) D[i] = v;
      }
    }
    for (let i = 0; i < NV; i++) SDF[i] = SOLID[i] ? -.5 : D[i] - .5;
  }

  // ---- WebGL 2: indirect light per vertex (interpolated), direct light per pixel with soft shadows ----
  const LIGHTS = () => [LAN, TORCH, CRYS, WINL, ...GLOW];
  const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aUV; layout(location=2) in vec3 aNrm; layout(location=3) in vec3 aInd;
uniform vec2 uRot; uniform vec2 uPit; uniform float uS; uniform vec3 uC; uniform vec3 uOff;
out vec2 vUV; flat out int vF; out vec3 vW; flat out vec3 vN; out vec3 vInd;
void main() {
  vec3 w = aPos + uOff, p = w - uC;
  float rx = uRot.x * p.x - uRot.y * p.y, ry = uRot.y * p.x + uRot.x * p.y;
  float sx = ${W / 2}.0 + uS * rx, sy = ${H / 2}.0 + uS * (uPit.x * ry - uPit.y * p.z), d = uPit.y * ry + uPit.x * p.z;
  gl_Position = vec4(sx / ${W}.0 * 2.0 - 1.0, 1.0 - sy / ${H}.0 * 2.0, -d / 80.0, 1.0);
  vUV = aUV.xy; vF = int(aUV.z + 0.5); vW = w; vN = aNrm; vInd = aInd;
}`;
  const FS = `#version 300 es
precision highp float;
in vec2 vUV; flat in int vF; in vec3 vW; flat in vec3 vN; in vec3 vInd;
uniform highp sampler2D uAlb; uniform highp sampler2D uLut; uniform highp sampler3D uSdf;
uniform int uShow; uniform int uFinish; uniform int uDither;
uniform vec4 uLP[7]; uniform vec3 uLC[7]; uniform vec3 uMoon; uniform vec3 uMoonC;
out vec4 o;
const float BAY[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
const float LV[5] = float[5](.16, .34, .6, 1., 1.6);
vec3 ink(int i, int row) { return texelFetch(uLut, ivec2(i, row), 0).rgb; }
float sdf(vec3 q) { return texture(uSdf, q / vec3(${X}.0, ${Y}.0, ${Z}.0)).r; }
// a soft shadow marched through the distance field (Quilez): the nearest miss along the way sets the penumbra
float shade(vec3 o, vec3 d, float far, float k) {
  float res = 1.0, t = 0.25;
  for (int i = 0; i < 48; i++) {
    if (t >= far) break;
    float h = sdf(o + d * t);
    res = min(res, k * h / t);
    if (res < 0.01) return 0.0;
    t += clamp(h, 0.2, 1.5);
  }
  return clamp(res, 0.0, 1.0);
}
int glassK(float u, float r) {
  if (u < 0. || u > 15. || r < 0. || r > 10.) return 0;
  if (!(r >= 3. || (u - 7.5) * (u - 7.5) + (3. - r) * (3. - r) * 2.4 <= 56.)) return 0;
  bool edge = u == 0. || u == 15. || r == 10. || (r < 3. && ((u - 7.5) * (u - 7.5) + (2. - r) * (2. - r) * 2.4 > 56. || r == 0.));
  return edge ? 1 : (u == 7. || u == 8. || r == 6.) ? 2 : 3;
}
vec3 direct(vec3 P, vec3 n) {
  vec3 o = P + n * 0.3, sum = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    vec3 d = uLP[i].xyz - o; float dist = length(d), r = uLP[i].w;
    if (dist >= r) continue;
    float nl = dot(n, d) / dist; if (nl <= 0.0) continue;
    float t = dist / r, f = (1.0 - t * t) * (1.0 - t * t) / (1.0 + 6.0 * t * t);
    sum += uLC[i] * f * nl * ${LAMB} * shade(o, d / dist, dist - 0.2, 6.0);
  }
  // the moon: only where the line toward it leaves through the window glass, cut by frame and mullions
  float nm = dot(n, uMoon);
  if (nm > 0.0 && o.y > 6.0) {
    float t = (6.0 - o.y) / uMoon.y; vec3 h = o + uMoon * t;
    if (glassK(floor(h.x * 4.0) - 132.0, floor((32.0 - floor(h.z * 4.0)) * 11.0 / 16.0)) == 3) sum += uMoonC * nm * ${LAMB} * shade(o, uMoon, t - 0.2, 12.0);
  }
  return sum;
}
void main() {
  ivec2 tile = ivec2(vF % ${ROW}, vF / ${ROW});
  vec2 f = clamp(vUV, 0.0, 0.999);
  vec4 a = texelFetch(uAlb, tile * ${TILE} + ivec2(f * ${TILE}.0), 0);
  int k = int(a.r * 255.0 + 0.5);
  if (uShow == 2 || a.g > 0.5) { o = vec4(ink(k, 15), 1.0); return; }
  vec3 L = vInd;
  if (uShow == 0) L += direct(vW, vN);
  if (uFinish == 0) { o = vec4(min(ink(k, 15) * L * ${EXPO}, vec3(1.0)), 1.0); return; }
  // print through the bands: tone from the light's warmth, level from its brightness, dither anchored to the world
  vec3 q = floor(vW * 4.0 + 0.001);
  ivec2 bq = abs(vN.x) > 0.5 ? ivec2(q.y, q.z) : abs(vN.y) > 0.5 ? ivec2(q.x, q.z) : ivec2(q.x, q.y);
  float th = (BAY[(bq.y & 3) * 4 + (bq.x & 3)] + 0.5) / 16.0;
  float Y = 0.35 * L.r + 0.5 * L.g + 0.15 * L.b;
  vec3 l = L - vec3(${AMB.join(', ')});
  float w = (l.r - l.b) / (l.r + l.g + l.b + 1e-6);
  int tone = w > 0.14 ? 1 : w < -0.06 ? 2 : 0, b = 0;
  if (Y >= LV[4]) b = 4;
  else if (Y > LV[0]) {
    float ly = log(Y); int j = 0;
    for (int i = 1; i < 4; i++) if (log(LV[i]) <= ly) j = i;
    float fr = (ly - log(LV[j])) / (log(LV[j + 1]) - log(LV[j]));
    b = j + (uDither == 1 ? (clamp((fr - 0.5) * 2.0 + 0.5, 0.0, 1.0) > th ? 1 : 0) : (fr >= 0.5 ? 1 : 0));
  }
  o = vec4(ink(k, b * 3 + (b > 0 ? tone : 0)), 1.0);
}`;

  function makeGL(cv) {
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = n => gl.getUniformLocation(p, n);
    const quad = (vs, ix, ax, dir, base, size, fid) => {
      const u = (ax + 1) % 3, v = (ax + 2) % 3, b = vs.length / 9, n = [0, 0, 0]; n[ax] = dir;
      for (const [a, c] of CORN) {
        const P = base.slice(); P[ax] += dir > 0 ? size[ax] : 0; P[u] += a * size[u]; P[v] += c * size[v];
        vs.push(P[0], P[1], P[2], a, c, fid, n[0], n[1], n[2]);
      }
      ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    const mk = (verts, idx, ind) => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      [[0, 0], [1, 12], [2, 24]].forEach(([l, off]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 36, off); });
      let ib = null;
      if (ind) { ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, ind, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0); }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      return { vao, n: idx.length, ib };
    };
    const vs = [], ix = [];
    drawnFaces.forEach(i => { const f = faces[i]; quad(vs, ix, f.ax, f.dir, [f.x, f.y, f.z], [1, 1, 1], i); });
    const IND = new Float32Array(NVX * 3);
    const room = mk(new Float32Array(vs), new Uint32Array(ix), IND);
    const lv = [], li = [];
    for (let ax = 0; ax < 3; ax++) for (const dir of [1, -1]) quad(lv, li, ax, dir, [-.35, -.35, -.5], [.7, .7, 1], LANF);
    const lamp = mk(new Float32Array(lv), new Uint32Array(li), null);
    const tex = (w, h, ifmt, fmt, type, data) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      return t;
    };
    const albT = tex(AW, Math.ceil((F + 1) / ROW) * TILE, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, ALB_IMG);
    const lutT = tex(32, 16, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, LUT);
    const sdfT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, sdfT);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F, X, Y, Z, 0, gl.RED, gl.FLOAT, SDF);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_3D, k, v);
    return {
      IND,
      upload() { gl.bindBuffer(gl.ARRAY_BUFFER, room.ib); gl.bufferSubData(gl.ARRAY_BUFFER, 0, IND); },
      draw(cam, opt) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
        gl.clearColor(...RGB[0].map(v => v / 255), 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST); gl.useProgram(p);
        gl.uniform2f(U('uRot'), cam.ca, cam.sa); gl.uniform2f(U('uPit'), cam.sp, cam.cp); gl.uniform1f(U('uS'), cam.s); gl.uniform3f(U('uC'), 24, 15, 3);
        gl.uniform1i(U('uShow'), opt.show); gl.uniform1i(U('uFinish'), opt.finish ? 1 : 0); gl.uniform1i(U('uDither'), opt.dither ? 1 : 0);
        const Ls = LIGHTS();
        gl.uniform4fv(U('uLP'), Ls.flatMap(L => [L.x, L.y, L.z, L.r])); gl.uniform3fv(U('uLC'), Ls.flatMap(L => L.c.map(v => v * L.s)));
        gl.uniform3fv(U('uMoon'), MDIR); gl.uniform3fv(U('uMoonC'), MOON.map(v => v * MOON_S));
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, albT); gl.uniform1i(U('uAlb'), 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lutT); gl.uniform1i(U('uLut'), 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, sdfT); gl.uniform1i(U('uSdf'), 2);
        gl.uniform3f(U('uOff'), 0, 0, 0); gl.bindVertexArray(room.vao); gl.drawElements(gl.TRIANGLES, room.n, gl.UNSIGNED_INT, 0);
        gl.uniform3f(U('uOff'), LAN.x, LAN.y, LAN.z); gl.bindVertexArray(lamp.vao); gl.drawElements(gl.TRIANGLES, lamp.n, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
      },
    };
  }

  // the camera: orthographic, turned by yaw and tilted by pitch about the room's middle, 4 px to a cell
  const camera = (yaw, pitch) => {
    const a = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
    return { ca: Math.cos(a), sa: Math.sin(a), sp: Math.sin(p), cp: Math.cos(p), s: 4 };
  };
  const project = (c, x, y, z) => {
    const px = x - 24, py = y - 15, pz = z - 3, rx = c.ca * px - c.sa * py, ry = c.sa * px + c.ca * py;
    return [W / 2 + c.s * rx, H / 2 + c.s * (c.sp * ry - c.cp * pz)];
  };
  // a screen pixel back to the horizontal plane at height z
  const unproject = (c, sx, sy, z) => {
    const rx = (sx - W / 2) / c.s, A = (sy - H / 2) / c.s, pz = z - 3, d = (pz + c.cp * A) / c.sp, ry = c.sp * A + c.cp * d;
    return [c.ca * rx + c.sa * ry + 24, -c.sa * rx + c.ca * ry + 15];
  };

  function fitCanvas(host, cv) {
    cv.width = W; cv.height = H; cv.className = 'px'; cv.style.margin = '0 auto';
    host.appendChild(cv);
    const fit = () => {
      const cs = getComputedStyle(host);
      const avail = Math.max(1, (host.clientWidth || W) - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0) - 2), dpr = window.devicePixelRatio || 1;
      const s = Math.max(1, Math.floor(avail * dpr / W));
      cv.style.width = (W * s / dpr) + 'px'; cv.style.height = (H * s / dpr) + 'px';
    };
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(host);
  }

  Kit.register('gi-3d', { title: 'Global illumination in a voxel room', fit: 'shader' }, host => {
    const cv = document.createElement('canvas');
    fitCanvas(host, cv);
    let r = null, fail = '';
    try { r = makeGL(cv); if (!r) fail = 'WebGL 2 is not available in this browser, so this 3D room cannot be drawn. The 2D GI mode in the lighting card shows the same room.'; }
    catch (e) { fail = 'The 3D view could not start: ' + e.message; console.error(e); }
    if (fail) { cv.replaceWith(Kit.el('div', { style: 'min-height:120px;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;border:1px dashed #45405c;border-radius:6px;font-size:13px' }, fail)); return; }
    cv.style.touchAction = 'none';

    let yaw = -18, pitch = 52, bounces = 2, show = 0, finish = true, dither = false;
    let drag = null, dirty = true, cursor = 0, ms = 0, lastRead = 0, updates = 0, rate = 0, rateT = 0;
    const SETTLE = 48, ORDER = [];
    for (let p = 0; p < NP; p++) if (PVALID[p]) ORDER.push(p);
    // probes nearest the lamp go first after it moves, so its bounce answers quickly
    const lampFirst = () => ORDER.sort((a, b) => {
      const da = (PPOS[a * 3] - LAN.x) ** 2 + (PPOS[a * 3 + 1] - LAN.y) ** 2, db = (PPOS[b * 3] - LAN.x) ** 2 + (PPOS[b * 3 + 1] - LAN.y) ** 2;
      return da - db || a - b;
    });
    lampFirst();
    // the indirect light at every vertex, from the probes, for the chosen bounces and view
    const SUMS = new Float32Array(NP * 18);
    function build() {
      for (let p = 0; p < NP; p++) for (let i = 0; i < 18; i++) {
        let s = 0;
        if (show === 0) s += PR[p * PSTR + i];
        for (let k = 1; k <= bounces; k++) s += PR[p * PSTR + k * 18 + i];
        SUMS[p * 18 + i] = show === 1 ? s * 3 : s;
      }
      const IND = r.IND;
      for (let v = 0; v < NVX; v++) {
        const pw = VPW[v], nI = VNI[v], ao = VAO_[v];
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let q = 0; q < pw.ids.length; q++) s += pw.ws[q] * SUMS[pw.ids[q] * 18 + nI * 3 + c];
          IND[v * 3 + c] = ao * (s + (show === 0 ? AMB[c] : 0));
        }
      }
      r.upload();
    }
    const settled = () => { let s = 0; for (const p of ORDER) s += Math.min(PM[p], SETTLE); return s / (ORDER.length * SETTLE); };
    function bake() {
      const t0 = performance.now(); let any = false;
      for (let n = 0; n < ORDER.length; n++) {
        const p = ORDER[cursor]; cursor = (cursor + 1) % ORDER.length;
        if (PM[p] >= SETTLE && PINIT[p]) continue;
        updateProbe(p); updates++; any = true;
        if (performance.now() - t0 > 6) break;
      }
      return any;
    }
    const draw = () => {
      const t0 = performance.now();
      if (bake() || dirty) build();
      const busy = performance.now() - t0;
      ms = ms ? ms * .8 + busy * .2 : busy;
      r.draw(camera(yaw, pitch), { show, finish, dither });
      dirty = false;
      if (t0 - rateT > 1000) { rate = updates * 1000 / (t0 - rateT || 1); updates = 0; rateT = t0; }
      if (t0 - lastRead > 250) {
        lastRead = t0;
        read.textContent = `${Math.round(rate)} probe updates/s (${NVALID} probes, ${K} rays each) · ${ms.toFixed(1)} ms per frame · ${Math.round(settled() * 100)}% settled`;
      }
    };

    // drag the lamp to carry it, drag anywhere else to turn the room, tap the floor to set the lamp down there
    const at = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * W, (e.clientY - b.top) / b.height * H]; };
    const place = (sx, sy) => {
      const [x, y] = unproject(camera(yaw, pitch), sx, sy, LAN.z);
      const nx = clamp(x, 2.6, 45.4), ny = clamp(y, 6.6, 25.4);
      if (SOLID[vi(Math.floor(nx), Math.floor(ny), Math.floor(LAN.z))] || SOLID[vi(Math.floor(nx), Math.floor(ny), 1)]) return;
      if (nx === LAN.x && ny === LAN.y) return;
      // the lamp's direct light is exact on the next frame (GPU); its bounce glides: the probes keep their history
      LAN.x = nx; LAN.y = ny; lanVer++;
      for (const p of ORDER) PM[p] = 0;
      lampFirst(); cursor = 0; dirty = true;
    };
    cv.addEventListener('pointerdown', e => {
      const [sx, sy] = at(e), [lx, ly] = project(camera(yaw, pitch), LAN.x, LAN.y, LAN.z);
      drag = { x: e.clientX, y: e.clientY, sx, sy, yaw, pitch, moved: false, lamp: Math.hypot(sx - lx, sy - ly) < 9 };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true;
      if (!drag.moved) return;
      if (drag.lamp) { const [sx, sy] = at(e); place(sx, sy); }
      else { yaw = clamp(drag.yaw - (e.clientX - drag.x) * .4, -50, 50); pitch = clamp(drag.pitch + (e.clientY - drag.y) * .3, 28, 80); }
    });
    const end = e => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.moved && !d.lamp && e.type === 'pointerup') place(d.sx, d.sy);
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

    const b = Kit.bar(host);
    b.tabs(['Direct only', '1 bounce', '2 bounces', '3 bounces'], v => { bounces = ['Direct only', '1 bounce', '2 bounces', '3 bounces'].indexOf(v); dirty = true; }, '2 bounces');
    b.tabs(['Lit', 'Bounce only', 'Albedo'], v => { show = ['Lit', 'Bounce only', 'Albedo'].indexOf(v); dirty = true; }, 'Lit');
    const b2 = Kit.bar(host);
    b2.check('Pixel finish', finish, v => { finish = v; });
    b2.check('Dither', dither, v => { dither = v; });
    const read = b2.note('');
    b2.note('Drag the lamp to carry it, or tap the floor to set it down; drag anywhere else to turn the room. Direct light is exact per pixel every frame, with soft shadows marched through a distance field. Bounced light comes from a grid of irradiance probes that gather fixed ray sets and blend each result into their history, so it glides when the lamp moves. Bounce only shows the indirect light alone, three times brighter.');
    Kit.loop(host, () => {}, draw, 30);
  });
})();
