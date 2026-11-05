// lights.js: one dungeon corner in 3/4 view, lit seven ways, for the research page.
// A smooth light map, palette bands, ordered dither, ray-cast shadows, a tile flood fill, normal maps and a small 2D GI,
// all over the same room so the models compare directly. Drag to carry the lantern. Every heavy field is cached per light
// and recast only when that light moves; each frame only sums cached fields and prints the room through them.
'use strict';
(() => {
  const { RGB, PAL } = Kit;
  const W = 192, H = 112, N = W * H;
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const PAL32 = RGB.map(([r, g, b]) => (255 << 24 | b << 16 | g << 8 | r) >>> 0);
  const pack = (r, g, b) => (255 << 24 | (b > 255 ? 255 : b) << 16 | (g > 255 ? 255 : g) << 8 | (r > 255 ? 255 : r)) >>> 0;
  // a windowed falloff: peaked like inverse square near the light, reaching zero smoothly at the radius
  const fall = t => t >= 1 ? 0 : (1 - t * t) * (1 - t * t) / (1 + 6 * t * t);
  // string art: one character per pixel, '.' clear
  const art = (rows, keys, fn) => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') fn(i, j, keys[ch]); }));

  Kit.register('lights', { title: 'Seven ways to light a room', fit: 'per-frame' }, host => {
    const c = Kit.canvas(host, W, H), g = c.g;
    c.cv.style.touchAction = 'none';

    // ---- the room, painted once into per-pixel buffers ----
    // Each pixel keeps its ink, what it is, where it sits in the world (x east, y south on the floor, z up),
    // its normal, the floor point it takes light from, which footprint it belongs to, and the y a light must be south of.
    const FLOOR = 0, FACE = 1, TOP = 2, SPRITE = 3, EMIT = 4;
    const AL = new Int16Array(N).fill(-1), KIND = new Uint8Array(N), OWN = new Int16Array(N).fill(-1);
    const WX = new Float32Array(N), WY = new Float32Array(N), WZ = new Float32Array(N);
    const NX = new Float32Array(N), NY = new Float32Array(N), NZ = new Float32Array(N);
    const SX = new Float32Array(N), SY = new Float32Array(N), REQ = new Float32Array(N);
    function put(x, y, ink, kind, wx, wy, wz, nx, ny, nz, own = -1, sx = wx, sy = wy, req = -1e9) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x, l = Math.hypot(nx, ny, nz) || 1;
      AL[i] = ink; KIND[i] = kind; WX[i] = wx; WY[i] = wy; WZ[i] = wz;
      NX[i] = nx / l; NY[i] = ny / l; NZ[i] = nz / l; OWN[i] = own; SX[i] = sx; SY[i] = sy; REQ[i] = req;
    }
    const ink = (x, y, v, kind) => { const i = y * W + x; AL[i] = v; if (kind != null) KIND[i] = kind; };

    // flagstones: slabs one or two tiles wide, a seam on the lower and right edges, a one-pixel bevel inside it
    const slab = (x, y) => {
      const tx = x >> 3, ty = y >> 3, wide = Kit.hash2(tx >> 1, ty, 11) < 0.5, s0 = wide ? tx >> 1 << 1 : tx;
      const su = x - s0 * 8, sw = wide ? 16 : 8, v = y & 7;
      const h = v === 7 || su === sw - 1 ? 0 : v === 0 || v === 6 || su === 0 || su === sw - 2 ? 1 : 2;
      return { h, ink: h === 0 ? 3 : (v === 0 && su < 3) || (su === 0 && v < 2) ? 5 : 4 };
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const hx = slab(x - 1, y).h - slab(x + 1, y).h, hy = slab(x, y - 1).h - slab(x, y + 1).h;
      put(x, y, slab(x, y).ink, FLOOR, x + .5, y + .5, 0, hx * .35, hy * .35, 1);
    }
    // a rug, flat
    for (let y = 66; y < 82; y++) for (let x = 52; x < 84; x++) {
      const e = y === 66 || y === 81 || x === 52 || x === 83, s = y === 68 || y === 79 || x === 54 || x === 81;
      const dm = Math.abs(x - 67.5) + Math.abs(y - 73.5) * 1.4;
      ink(x, y, e ? 9 : s || (dm > 4 && dm < 5.5) ? 11 : 10);
      const i = y * W + x; NX[i] = 0; NY[i] = 0; NZ[i] = 1;
    }
    // a lava crack: an amber core and orange lips that glow, a dark crust that doesn't
    const lr = Kit.rng('lava'), LAVA_Y = {}, LX0 = 134, LX1 = 176;
    for (let x = LX0, y = 93; x <= LX1; x++) { if (x % 2 === 0) y = clamp(y + lr.int(-1, 1), 89, 96); LAVA_Y[x] = y; }
    for (let x = LX0; x <= LX1; x++) {   // a dark crust first, then the glowing seam over it
      const y = LAVA_Y[x], yp = LAVA_Y[Math.max(LX0, x - 1)];
      for (let v = Math.min(y, yp) - 2; v <= Math.max(y, yp) + 2; v++) for (const u of [-1, 0, 1]) ink(x + u, v, 9);
    }
    for (let x = LX0; x <= LX1; x++) {
      const y = LAVA_Y[x], yp = LAVA_Y[Math.max(LX0, x - 1)], end = x < LX0 + 4 || x > LX1 - 4;
      for (let v = Math.min(y, yp); v <= Math.max(y, yp); v++) ink(x, v, end ? 12 : 13, EMIT);
      if (!end && Kit.hash2(x, 0, 5) < .55) ink(x, y - 1, 11, EMIT);
      if (!end && Kit.hash2(x, 1, 5) < .35) ink(x, y + 1, 11, EMIT);
    }

    // boxes: a footprint on the floor and a height; drawn as a top lifted by the height and a front face below it
    const OCC = [], items = [];
    const STONE = [.43, .42, .54], WOOD = [.56, .39, .25];
    const box = (x0, y0, x1, y1, h, style, alb, extra = {}) => {
      const id = OCC.push({ x0, y0, x1, y1, alb }) - 1;
      items.push(Object.assign({ x0, y0, x1, y1, h, style, id, y: y1 }, extra));
    };
    // brick courses: mortar 0, brick 1
    const brick = (u, r) => r <= 0 ? 1 : r % 4 === 0 ? 0 : (u + ((r >> 2) & 1) * 4) % 8 === 0 ? 0 : 1;
    const WALL = {
      top: (u, v, w, d, b) => {
        const rim = (v === d - 1 && b.rim.includes('f')) || (v === 0 && b.rim.includes('b')) || (u === 0 && b.rim.includes('l')) || (u === w - 1 && b.rim.includes('r'));
        if (rim) return [3, u === 0 ? -.5 : u === w - 1 ? .5 : 0, v === 0 ? -.5 : .5];
        return [u === 0 || u === w - 1 || v === 0 || v === d - 1 ? 0 : 1, 0, 0];
      },
      face: (u, z, w, h) => {
        const r = h - 1 - z, nx = (brick(u - 1, r) - brick(u + 1, r)) * .5, nz = (brick(u, r + 1) - brick(u, r - 1)) * .5;
        if (r === 0) return [5, 0, 1, .7];
        return [z === 0 ? 2 : brick(u, r) ? 3 : 2, nx, 1, nz];
      },
    };
    const PILLAR = {
      top: (u, v, w, d) => [u === 0 || u === w - 1 || v === 0 ? 0 : v === d - 1 ? 6 : 5, 0, v === d - 1 ? .5 : 0],
      face: (u, z, w, h) => {
        const r = h - 1 - z, t = (u + .5) / w * 2 - 1;
        if (r <= 1) return [u === 0 || u === w - 1 ? 1 : r === 0 ? 5 : 4, 0, 1, r === 0 ? .6 : 0];
        if (z <= 1) return [u === 0 || u === w - 1 ? 1 : 3, 0, 1, z === 1 ? .5 : 0];
        return [u === 0 || u === w - 1 ? 1 : 4, t * 1.2, Math.sqrt(Math.max(.05, 1 - t * t)), 0]; // a round shaft
      },
    };
    const CRATE = {
      top: (u, v, w, d) => [u === 0 || u === w - 1 || v === 0 ? 0 : v === d - 1 ? 29 : u === w >> 1 ? 27 : 28, 0, v === d - 1 ? .5 : 0],
      face: (u, z, w, h) => {
        const side = u === 0 || u === w - 1, band = z === 1 || z === h - 2, brace = Math.abs(u - z * (w - 1) / (h - 1)) < .7;
        return [side || z === 0 || z === h - 1 ? 0 : band ? 26 : brace ? 28 : 27, 0, 1, band ? .3 : 0];
      },
    };
    const PLINTH = {
      top: (u, v, w, d) => [u === 0 || u === w - 1 || v === 0 ? 0 : 5, 0, 0],
      face: (u, z, w, h) => [u === 0 || u === w - 1 || z === 0 ? 1 : z === h - 1 ? 4 : 3, 0, 1, z === h - 1 ? .6 : 0],
    };
    box(0, 0, W, 24, 16, WALL, STONE, { rim: 'f', after: paintBackWall });
    box(0, 0, 8, H, 16, WALL, STONE, { rim: 'r' });
    box(W - 8, 0, W, H, 16, WALL, STONE, { rim: 'l' });
    box(0, 104, W, H, 4, WALL, STONE, { rim: 'b' });
    box(72, 48, 112, 56, 16, WALL, STONE, { rim: 'f' });
    box(40, 40, 50, 48, 22, PILLAR, STONE);
    box(136, 70, 146, 78, 22, PILLAR, STONE);
    box(24, 80, 32, 88, 8, CRATE, WOOD); box(32, 80, 40, 88, 8, CRATE, WOOD); box(152, 32, 160, 40, 8, CRATE, WOOD);
    box(160, 56, 168, 64, 6, PLINTH, STONE, { after: paintCrystal });
    // the traveler: a sprite standing on the floor; its feet block light like a small footprint
    const CHAR = { x: 94, foot: 82 };
    const charOcc = OCC.push({ x0: CHAR.x - 3, y0: CHAR.foot - 2, x1: CHAR.x + 4, y1: CHAR.foot + 1, alb: [.18, .48, .23] }) - 1;
    items.push({ y: CHAR.foot, paint: paintChar });

    function paintBox(b) {
      const { x0, y0, x1, y1, h, style, id } = b, w = x1 - x0, d = y1 - y0;
      for (let wy = y0; wy < y1; wy++) for (let x = x0; x < x1; x++) {
        const [k, nx, ny] = style.top(x - x0, wy - y0, w, d, b);
        put(x, wy - h, k, TOP, x + .5, wy + .5, h, nx, ny, 1, id);
      }
      // the front face takes its light from the floor just in front of it, and only from lights south of it
      for (let z = 0; z < h; z++) for (let x = x0; x < x1; x++) {
        const [k, nx, ny, nz] = style.face(x - x0, z, w, h);
        put(x, y1 - 1 - z, k, FACE, x + .5, y1, z + .5, nx, ny, nz, id, x + .5, y1 + .5, y1);
      }
    }
    // the window and a torch bracket on the back wall's face (face rows are sy 8..23, z = 24 - sy)
    const WIN = { x: 132, y: 11 };
    const glass = (u, r) => {
      if (u < 0 || u > 15 || r < 0 || r > 10) return 0;
      const inside = r >= 3 || (u - 7.5) ** 2 + (3 - r) ** 2 * 2.4 <= 56;
      if (!inside) return 0;
      const edge = u === 0 || u === 15 || r === 10 || (r < 3 && ((u - 7.5) ** 2 + (2 - r) ** 2 * 2.4 > 56 || r === 0));
      return edge ? 1 : (u === 7 || u === 8 || r === 6) ? 2 : 3; // 1 frame, 2 mullion, 3 glass
    };
    function paintBackWall() {
      for (let r = 0; r < 11; r++) for (let u = 0; u < 16; u++) {
        const k = glass(u, r), x = WIN.x + u, y = WIN.y + r;
        if (k === 3) ink(x, y, r < 6 ? 25 : 24, EMIT);
        else if (k) { ink(x, y, k === 1 ? 0 : 1); NX[y * W + x] = 0; NY[y * W + x] = 1; NZ[y * W + x] = 0; }
      }
      for (let x = WIN.x - 1; x < WIN.x + 17; x++) ink(x, WIN.y + 11, 5);
      // torch bracket under the flame
      art(['ooo', '.t.', '.t.', '.o.'], { o: 0, t: 27 }, (i, j, v) => ink(TORCH.x - 1 + i, 16 + j, v));
    }
    function paintCrystal() {
      // on the plinth top (world y 60, z 6): screen bottom row at 53
      art(['..a..', '.aab.', '.aWb.', 'aaWbc', 'abbbc', 'abbbc', '.abc.', '..c..'],
        { a: 25, b: 24, c: 23, W: 7 }, (i, j, v) => put(162 + i, 46 + j, v, EMIT, 164, 60, 6, 0, 1, 0));
    }
    function paintChar() {
      const rows = ['..ooo..', '.oCCco.', 'oCcccdo', 'ocsssdo', 'ocesedo', 'oosssoo', 'oCcccdo', 'oCcccdo',
        'obbbbbo', 'oCcccdo', 'oCcccdo', '.ol.lo.', '.ff.ff.'];
      const keys = { o: 0, C: 17, c: 16, d: 15, s: 29, e: 0, b: 27, l: 2, f: 26 };
      const ox = CHAR.x - 3, oy = CHAR.foot - rows.length;
      // a dome of height from the distance to the silhouette's edge gives the sprite its normals
      const inside = (i, j) => j >= 0 && j < rows.length && i >= 0 && i < 7 && rows[j][i] !== '.';
      const hgt = (i, j) => {
        if (!inside(i, j)) return 0;
        let d = 9;
        for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) if (!inside(i + u, j + v)) d = Math.min(d, Math.hypot(u, v));
        return Math.sqrt(d);
      };
      for (let x = CHAR.x - 2; x <= CHAR.x + 2; x++) ink(x, CHAR.foot, 3);
      art(rows, keys, (i, j, v) => {
        const nx = -(hgt(i + 1, j) - hgt(i - 1, j)) * .8, nz = (hgt(i, j + 1) - hgt(i, j - 1)) * .8;
        put(ox + i, oy + j, v, SPRITE, ox + i + .5, CHAR.foot, rows.length - j - .5, nx, 1, nz, charOcc, ox + i + .5, CHAR.foot - .5);
      });
    }

    // ---- lights ----
    const LAN = { x: 112.5, y: 94.5, z: 8, r: 80, s: 1.55, c: [1, .8, .56] };
    const TORCH = { x: 56.5, y: 25, z: 10, r: 66, s: 1.2, c: [1, .62, .32] };
    const CRYS = { x: 164.5, y: 61, z: 12, r: 46, s: .55, c: [.5, .84, .9] };   // a small, soft teal: no blue flood
    const LAVA = [140, 155, 170].map(x => ({ x: x + .5, y: LAVA_Y[x] + .5, z: 2, r: 26, s: .55, c: [1, .45, .16] }));
    const MOON = [.58, .7, 1], MOON_S = .42, AMB = [.07, .07, .12], EXPO = 1.3;

    items.sort((a, b) => a.y - b.y);
    for (const it of items) { if (it.paint) it.paint(); else paintBox(it); if (it.after) it.after(); }
    const AR = new Float32Array(N), AG = new Float32Array(N), AB = new Float32Array(N);
    for (let i = 0; i < N; i++) if (AL[i] >= 0) { const p = RGB[AL[i]]; AR[i] = p[0]; AG[i] = p[1]; AB[i] = p[2]; }

    // is the segment from a light to a floor point cut by any footprint other than the receiver's own?
    function blocked(ax, ay, bx, by, own) {
      const dx = bx - ax, dy = by - ay;
      for (let k = 0; k < OCC.length; k++) {
        if (k === own) continue;
        const o = OCC[k];
        if (ax > o.x0 && ax < o.x1 && ay > o.y0 && ay < o.y1) continue;   // a light inside a footprint ignores it
        let t0 = 0, t1 = 1;
        if (dx === 0) { if (ax <= o.x0 || ax >= o.x1) continue; } else {
          let a = (o.x0 - ax) / dx, b = (o.x1 - ax) / dx; if (a > b) { const s = a; a = b; b = s; }
          if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 >= t1) continue;
        }
        if (dy === 0) { if (ay <= o.y0 || ay >= o.y1) continue; } else {
          let a = (o.y0 - ay) / dy, b = (o.y1 - ay) / dy; if (a > b) { const s = a; a = b; b = s; }
          if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 >= t1) continue;
        }
        return true;
      }
      return false;
    }
    // the moon through the window: a parallel beam falling south and down; mullions cut it
    const MD = [.35, -1, .5], ML = Math.hypot(...MD);
    const beam = (x, y, z) => {
      const t = y - 24; if (t < 0) return 0;
      const xw = x + .35 * t, zw = z + .5 * t;
      return glass(Math.floor(xw - WIN.x), Math.floor(24 - zw - WIN.y)) === 3 ? 1 : 0;
    };
    // nine points on the lamp for a penumbra
    const SOFT = [[0, 0]].concat([0, 1, 2, 3, 4, 5, 6, 7].map(k => [Math.cos(k * Math.PI / 4 + .3) * 3.5, Math.sin(k * Math.PI / 4 + .3) * 3.5]));
    // one light's field over the room: falloff, then 'plain' (a light map), 'hard'/'soft' shadows, or 'lam' (Lambert on the normals)
    function field(L, how) {
      const out = new Float32Array(N), lzN = L.z + 18;
      for (let i = 0; i < N; i++) {
        if (AL[i] < 0 || KIND[i] === EMIT) continue;
        const dx = L.x - WX[i], dy = L.y - WY[i], dz = L.z - WZ[i];
        let f = fall(Math.sqrt(dx * dx + dy * dy + dz * dz) / L.r) * L.s;
        if (f <= 0) continue;
        if (how === 'lam') {
          const ez = lzN - WZ[i];
          // Lambert with a little wrap, so a surface turned just past the light isn't black
          f *= 1.6 * Math.max(0, ((dx * NX[i] + dy * NY[i] + ez * NZ[i]) / Math.sqrt(dx * dx + dy * dy + ez * ez) + .25) / 1.25);
        } else if (how !== 'plain') {
          if (L.y <= REQ[i]) continue;
          if (how === 'hard') { if (blocked(L.x, L.y, SX[i], SY[i], OWN[i])) continue; } else {
            let v = 0;
            for (const [ox, oy] of SOFT) if (!blocked(L.x + ox, L.y + oy, SX[i], SY[i], OWN[i])) v++;
            f *= v / SOFT.length;
          }
        }
        out[i] = f;
      }
      return out;
    }
    function moonField(how) {
      const out = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        if (AL[i] < 0 || KIND[i] === EMIT || !beam(WX[i], WY[i], WZ[i])) continue;
        let f = MOON_S;
        if (how === 'lam') f *= 1.6 * Math.max(0, (MD[0] * NX[i] + MD[1] * NY[i] + MD[2] * NZ[i]) / ML);
        else if (how !== 'plain' && blocked(WX[i], WY[i], WX[i] + .35 * (WY[i] - 24), 24.5, OWN[i])) f = 0;
        out[i] = f;
      }
      return out;
    }
    // caches: the static lights once per variant, the lantern again only when it moves
    const cache = new Map();
    const get = (name, how) => {
      const key = name + ':' + how;
      if (!cache.has(key)) cache.set(key, field(name === 'lan' ? LAN : name === 'torch' ? TORCH : CRYS, how));
      return cache.get(key);
    };
    function stat(how) {   // crystal, lava and moon summed into one colored field
      const key = 'stat:' + how;
      if (cache.has(key)) return cache.get(key);
      const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
      const add = (f, col) => { for (let i = 0; i < N; i++) if (f[i]) { R[i] += f[i] * col[0]; G[i] += f[i] * col[1]; B[i] += f[i] * col[2]; } };
      const fh = how === 'gi' ? 'soft' : how;
      add(get('crys', fh), CRYS.c);
      add(moonField(fh), MOON);
      if (how !== 'gi') for (const L of LAVA) add(field(L, how), L.c);
      const s = { R, G, B }; cache.set(key, s); return s;
    }
    const dropLantern = () => { for (const k of [...cache.keys()]) if (k.startsWith('lan:') || k === 'gi:lan') cache.delete(k); };

    // ---- tile flood fill: 8-px tiles, light lost tile by tile, per color channel ----
    const TW = W / 8, TH = H / 8, TN = TW * TH, TSOL = new Uint8Array(TN);
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      let n = 0;
      for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
        const x = tx * 8 + u + .5, y = ty * 8 + v + .5;
        if (OCC.some((o, k) => k !== charOcc && x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1)) n++;
      }
      TSOL[ty * TW + tx] = n >= 32 ? 1 : 0;
    }
    const TV = new Float32Array(TN * 3), TSEED = new Uint8Array(TN), DECAY = .72;
    function flood(fl, ft) {
      TV.fill(0); TSEED.fill(0);
      const seed = (x, y, s, col) => {
        const t = clamp(Math.floor(y / 8), 0, TH - 1) * TW + clamp(Math.floor(x / 8), 0, TW - 1);
        TSEED[t] = 1;
        for (let ch = 0; ch < 3; ch++) TV[t * 3 + ch] = Math.max(TV[t * 3 + ch], s * col[ch]);
      };
      seed(LAN.x, LAN.y, 1.3 * fl, LAN.c); seed(TORCH.x, TORCH.y, 1.15 * ft, TORCH.c); seed(CRYS.x, CRYS.y + 4, .5, CRYS.c);
      for (const L of LAVA) seed(L.x, L.y, .55, L.c);
      for (let t = 0; t < TN; t++) if (!TSOL[t] && beam((t % TW) * 8 + 4, (t / TW | 0) * 8 + 4, 0)) seed((t % TW) * 8 + 4, (t / TW | 0) * 8 + 4, .45, MOON);
      // relax until nothing changes: a tile takes the brightest open neighbor times the decay; walls take light but don't pass it
      for (let it = 0, changed = true; changed && it < 40; it++) {
        changed = false;
        for (let k = 0; k < TN; k++) {
          const t = it & 1 ? TN - 1 - k : k, tx = t % TW, ty = t / TW | 0;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = tx + ox, ny = ty + oy;
            if (nx < 0 || ny < 0 || nx >= TW || ny >= TH) continue;
            const n = ny * TW + nx;
            if (TSOL[n] && !TSEED[n]) continue;
            for (let ch = 0; ch < 3; ch++) {
              const v = TV[n * 3 + ch] * DECAY;
              if (v > TV[t * 3 + ch] + 1e-4) { TV[t * 3 + ch] = v; changed = true; }
            }
          }
        }
      }
    }
    // per pixel: the tile its sample point is in, and bilinear weights over open tile centers
    const PT = new Int32Array(N), PI4 = new Int32Array(N * 4), PW4 = new Float32Array(N * 4);
    // the same for the GI grid (2-px cells)
    const GW = W / 2, GH = H / 2, GN = GW * GH;
    const GI4 = new Int32Array(N * 4), GW4 = new Float32Array(N * 4);
    const GHIT = new Uint8Array(GN), GSOL = new Uint8Array(GN), GALB = new Float32Array(GN * 3);
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
      const x = cx * 2 + 1, y = cy * 2 + 1, c0 = cy * GW + cx;
      OCC.forEach(o => { if (x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) { GHIT[c0] = GSOL[c0] = 1; GALB.set(o.alb, c0 * 3); } });
    }
    function weights(I4, W4, cell, gw, gh, open) {
      for (let i = 0; i < N; i++) {
        const gx = clamp(SX[i] / cell - .5, 0, gw - 1.001), gy = clamp(SY[i] / cell - .5, 0, gh - 1.001);
        const x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0;
        const ids = [y0 * gw + x0, y0 * gw + x0 + 1, (y0 + 1) * gw + x0, (y0 + 1) * gw + x0 + 1];
        const ws = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy].map((w, k) => open(ids[k]) ? w : 0);
        const s = ws[0] + ws[1] + ws[2] + ws[3];
        for (let k = 0; k < 4; k++) { I4[i * 4 + k] = ids[k]; W4[i * 4 + k] = s > 0 ? ws[k] / s : 0; }
      }
    }
    for (let i = 0; i < N; i++) PT[i] = clamp(Math.floor(SY[i] / 8), 0, TH - 1) * TW + clamp(Math.floor(SX[i] / 8), 0, TW - 1);
    weights(PI4, PW4, 8, TW, TH, t => !TSOL[t]);

    // ---- 2D GI: rays marched through a distance field at half resolution ----
    // Lava and the window emit; walls and crates bounce what reaches them, tinted by their own color.
    const E1 = new Float32Array(GN * 3);
    for (let i = 0; i < N; i++) if (KIND[i] === EMIT && AL[i] >= 11 && AL[i] <= 13 && WZ[i] === 0) {
      const cc = ((i / W | 0) >> 1) * GW + ((i % W) >> 1); GHIT[cc] = 1; E1.set([3.6, 1.6, .55], cc * 3);
    }
    for (let x = WIN.x + 1; x < WIN.x + 15; x++) { const cc = 11 * GW + (x >> 1); E1.set(MOON.map(v => v * 2.2), cc * 3); }
    weights(GI4, GW4, 2, GW, GH, q => !GHIT[q]);
    // chamfer distance (in cells) to the nearest thing a ray stops at
    const SDF = new Float32Array(GN);
    for (let q = 0; q < GN; q++) SDF[q] = GHIT[q] ? 0 : 1e6;
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < GN; k++) {
      const q = pass ? GN - 1 - k : k, cx = q % GW, cy = q / GW | 0, s = pass ? 1 : -1;
      for (const [ox, oy, d] of [[s, 0, 1], [0, s, 1], [s, s, 1.414], [-s, s, 1.414]]) {
        const nx = cx + ox, ny = cy + oy;
        if (nx >= 0 && ny >= 0 && nx < GW && ny < GH) SDF[q] = Math.min(SDF[q], SDF[ny * GW + nx] + d);
      }
    }
    function gather(E, rays) {
      const out = new Float32Array(GN * 3), da = Math.PI * 2 / rays;
      for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
        const q0 = cy * GW + cx; if (GHIT[q0]) continue;
        const rot = BAYER4[(cy & 3) * 4 + (cx & 3)] * da;   // each cell turns its rays a little, in an ordered pattern
        let r = 0, gg = 0, b = 0;
        for (let k = 0; k < rays; k++) {
          const a = k * da + rot, dx = Math.cos(a), dy = Math.sin(a);
          let px = cx + .5, py = cy + .5, st = Math.max(.6, SDF[q0] - .5);
          for (let s = 0; s < 80; s++) {
            px += dx * st; py += dy * st;
            if (px < 0 || py < 0 || px >= GW || py >= GH) break;
            const q = (py | 0) * GW + (px | 0), d = SDF[q];
            if (d === 0) { r += E[q * 3]; gg += E[q * 3 + 1]; b += E[q * 3 + 2]; break; }
            st = Math.max(.6, d - .5);
          }
        }
        out[q0 * 3] = r / rays; out[q0 * 3 + 1] = gg / rays; out[q0 * 3 + 2] = b / rays;
      }
      // two 3x3 blurs over open cells smooth away the ray pattern
      for (let pass = 0; pass < 2; pass++) {
        const src = out.slice();
        for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
          const q = cy * GW + cx; if (GHIT[q]) continue;
          let r = 0, gg = 0, b = 0, n = 0;
          for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
            const x = cx + u, y = cy + v; if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
            const p = y * GW + x; if (GHIT[p]) continue;
            r += src[p * 3]; gg += src[p * 3 + 1]; b += src[p * 3 + 2]; n++;
          }
          out[q * 3] = r / n; out[q * 3 + 1] = gg / n; out[q * 3 + 2] = b / n;
        }
      }
      return out;
    }
    // one bounce: light arriving next to each wall cell, times the wall's color, re-emitted and gathered again
    const BOUNCE = 1.1;
    function bounce(src, rays) {
      const inc = new Float32Array(GN * 3), E = new Float32Array(GN * 3);
      const pt = (L, x, y, q) => {
        const f = fall(Math.hypot(L.x - x, L.y - y, L.z - 4) / L.r) * L.s;
        if (f > 0 && !blocked(L.x, L.y, x, y, -1)) for (let ch = 0; ch < 3; ch++) inc[q * 3 + ch] += f * L.c[ch];
      };
      const near = q => { const cx = q % GW, cy = q / GW | 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) { const x = cx + u, y = cy + v; if (x >= 0 && y >= 0 && x < GW && y < GH && GSOL[y * GW + x]) return true; } return false; };
      for (let q = 0; q < GN; q++) {
        if (GHIT[q] || !near(q)) continue;
        const x = (q % GW) * 2 + 1, y = (q / GW | 0) * 2 + 1;
        if (src === 'lan') pt(LAN, x, y, q);
        else if (src === 'torch') pt(TORCH, x, y, q);
        else {
          pt(CRYS, x, y, q);
          const m = beam(x, y, 1) * MOON_S;
          for (let ch = 0; ch < 3; ch++) inc[q * 3 + ch] += m * MOON[ch] + G1()[q * 3 + ch];
        }
      }
      for (let q = 0; q < GN; q++) {
        if (!GSOL[q]) continue;
        const cx = q % GW, cy = q / GW | 0; let n = 0, r = 0, gg = 0, b = 0;
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
          const x = cx + u, y = cy + v; if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          const p = y * GW + x; if (GHIT[p]) continue;
          r += inc[p * 3]; gg += inc[p * 3 + 1]; b += inc[p * 3 + 2]; n++;
        }
        if (n) for (let ch = 0; ch < 3; ch++) E[q * 3 + ch] = [r, gg, b][ch] / n * GALB[q * 3 + ch] * BOUNCE;
      }
      return gather(E, rays);
    }
    let g1 = null;
    const G1 = () => g1 || (g1 = gather(E1, 32));
    const giPart = (name, draft) => {
      const key = 'gi:' + name;
      if (!cache.has(key) || (cache.get(key).draft && !draft)) { const v = bounce(name, draft ? 12 : 32); v.draft = draft; cache.set(key, v); }
      return cache.get(key);
    };

    // ---- glow: bloom from the emissive pixels and god rays from the window, both painted once ----
    const GLR = new Float32Array(N), GLG = new Float32Array(N), GLB = new Float32Array(N);
    {
      const src = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
      for (let i = 0; i < N; i++) if (KIND[i] === EMIT) { const k = AL[i] >= 22 ? .35 : .4; src[0][i] = AR[i] * k; src[1][i] = AG[i] * k; src[2][i] = AB[i] * k; }
      for (const a of src) for (let pass = 0; pass < 3; pass++) for (const [sx, sy] of [[1, 0], [0, W]]) {
        const s = a.slice();
        for (let i = 0; i < N; i++) {
          const x = i % W, y = i / W | 0; let v = 0, n = 0;
          for (let k = -2; k <= 2; k++) { const xx = x + (sx ? k : 0), yy = y + (sy ? k : 0); if (xx >= 0 && yy >= 0 && xx < W && yy < H) { v += s[yy * W + xx]; n++; } }
          a[i] = v / 5;
        }
      }
      for (let i = 0; i < N; i++) {
        const x = i % W + .5, sy = (i / W | 0) + .5;
        let d = 0;
        for (let z = .5; z < 30; z += 1) { const y = sy + z; if (beam(x, y, z)) d += Math.exp(-(y - 24) / 30); }
        GLR[i] = src[0][i] * 1.6 + d * MOON[0] * 9; GLG[i] = src[1][i] * 1.6 + d * MOON[1] * 9; GLB[i] = src[2][i] * 1.6 + d * MOON[2] * 9;
      }
    }

    // ---- palette bands: Smooth posterized. Five light levels, each a reprint in which every ink steps up or down its own ramp ----
    // Band centers sit about one ramp step apart; the lowest is a floor of ambient so the unlit room still reads.
    const LV = [.16, .34, .6, 1, 1.6], LLV = LV.map(Math.log), STEP = [-2, -1, 0, 1, 2];
    const RAMP = i => i <= 7 ? Kit.RAMPS.grey : i <= 13 ? Kit.RAMPS.red : i <= 19 ? Kit.RAMPS.green : i <= 25 ? Kit.RAMPS.blue : i <= 29 ? Kit.RAMPS.brown : Kit.RAMPS.violet;
    // a slight hue shift toward the light in the lit bands: stone's pale inks lean amber under warm light, mint under cool
    const WARM = [{}, {}, {}, { 5: 29, 6: 29 }, { 5: 29, 6: 13, 7: 13 }], COOL = [{}, {}, {}, { 6: 25 }, { 6: 25 }];
    const MAPS = STEP.map((n, b) => [0, 1, 2].map(t => RGB.map((_, i) => {
      if (i === 0) return 0;                                   // the outline stays the outline
      const r = RAMP(i), j = r.indexOf(i);
      let k = r[clamp(j + n, 1, r.length - 1)];
      if (r === Kit.RAMPS.grey && t) k = (t === 1 ? WARM : COOL)[b][k] ?? k;
      return k;
    })));
    function bandInk(i, R, G, B, x, y, dither) {
      // the tone comes from the lights alone, so a warm pool stays warm out to its edge
      const Y = .35 * R + .5 * G + .15 * B, r = R - AMB[0], b0 = B - AMB[2], w = (r - b0) / (r + G - AMB[1] + b0 + 1e-6);
      const tone = w > .14 ? 1 : w < -.06 ? 2 : 0;
      let b = 0;
      if (Y >= LV[LV.length - 1]) b = LV.length - 1;
      else if (Y > LV[0]) {
        const ly = Math.log(Y);
        let k = 0; while (LLV[k + 1] <= ly) k++;
        const f = (ly - LLV[k]) / (LLV[k + 1] - LLV[k]);
        // dither only in the middle half of each step, flat elsewhere
        b = k + (dither ? (clamp((f - .5) * 2 + .5, 0, 1) > BAYER4[(y & 3) * 4 + (x & 3)] ? 1 : 0) : f >= .5 ? 1 : 0);
      }
      return MAPS[b][b ? tone : 0][AL[i]];
    }

    // ---- per frame ----
    const LR = new Float32Array(N), LG = new Float32Array(N), LB = new Float32Array(N);
    const GR = new Float32Array(GN * 3);
    const img = new ImageData(W, H), U = new Uint32Array(img.data.buffer);
    function assemble(how, fl, ft, draft) {
      if (how === 'flood') {
        flood(fl, ft);
        const smooth = opt.smooth.checked;
        for (let i = 0; i < N; i++) for (let ch = 0; ch < 3; ch++) {
          let v;
          if (!smooth || TSOL[PT[i]]) v = TV[PT[i] * 3 + ch];
          else { v = 0; for (let k = 0; k < 4; k++) v += TV[PI4[i * 4 + k] * 3 + ch] * PW4[i * 4 + k]; }
          (ch === 0 ? LR : ch === 1 ? LG : LB)[i] = AMB[ch] + v;
        }
        return;
      }
      const lh = how === 'gi' ? (draft ? 'hard' : 'soft') : how;
      const S = stat(how), A = get('lan', lh), T = get('torch', how === 'gi' ? 'soft' : how);
      const a0 = LAN.c[0] * fl, a1 = LAN.c[1] * fl, a2 = LAN.c[2] * fl, t0 = TORCH.c[0] * ft, t1 = TORCH.c[1] * ft, t2 = TORCH.c[2] * ft;
      for (let i = 0; i < N; i++) {
        LR[i] = AMB[0] + S.R[i] + A[i] * a0 + T[i] * t0;
        LG[i] = AMB[1] + S.G[i] + A[i] * a1 + T[i] * t1;
        LB[i] = AMB[2] + S.B[i] + A[i] * a2 + T[i] * t2;
      }
      if (how !== 'gi') return;
      const e1 = G1(), bs = opt.bounce.checked;
      const s0 = bs && giPart('static'), s1 = bs && giPart('torch'), s2 = bs && giPart('lan', draft);
      for (let q = 0; q < GN * 3; q++) GR[q] = e1[q] + (bs ? s0[q] + s1[q] * ft + s2[q] * fl : 0);
      for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
        const w = GW4[i * 4 + k]; if (!w) continue;
        const q = GI4[i * 4 + k] * 3;
        LR[i] += GR[q] * w; LG[i] += GR[q + 1] * w; LB[i] += GR[q + 2] * w;
      }
    }
    function compose(view, glow, fl, ft) {
      const lx = LAN.x, ly = LAN.y - LAN.z, tx = TORCH.x, ty = 13;
      for (let i = 0; i < N; i++) {
        const k = AL[i]; if (k < 0) { U[i] = PAL32[0]; continue; }
        const x = i % W, y = i / W | 0;
        let r, gg, b;
        if (view === 'normals') { r = (NX[i] * .5 + .5) * 255; gg = (NY[i] * .5 + .5) * 255; b = (NZ[i] * .5 + .5) * 255; if (KIND[i] === EMIT) r = gg = b = 40; }
        else if (KIND[i] === EMIT) { r = AR[i]; gg = AG[i]; b = AB[i]; }
        else if (view === 'map') { r = LR[i] * 150; gg = LG[i] * 150; b = LB[i] * 150; }
        else if (view === 'band' || view === 'dither') { U[i] = PAL32[bandInk(i, LR[i], LG[i], LB[i], x, y, view === 'dither')]; continue; }
        else { r = AR[i] * LR[i] * EXPO; gg = AG[i] * LG[i] * EXPO; b = AB[i] * LB[i] * EXPO; }
        if (glow) {
          r += GLR[i]; gg += GLG[i]; b += GLB[i];
          // small halos around the two flames, which move and flicker
          const d1 = (x + .5 - lx) ** 2 + (y + .5 - ly) ** 2, d2 = (x + .5 - tx) ** 2 + (y + .5 - ty) ** 2;
          if (d1 < 100) { const h = (1 - Math.sqrt(d1) / 10) ** 2 * 70 * fl; r += h; gg += h * .8; b += h * .5; }
          if (d2 < 100) { const h = (1 - Math.sqrt(d2) / 10) ** 2 * 80 * ft; r += h; gg += h * .6; b += h * .3; }
        }
        U[i] = pack(r | 0, gg | 0, b | 0);
      }
    }
    // the flame and the lantern, drawn over everything at full brightness
    function sprites(t, flick) {
      const px = (x, y, k) => { if (x >= 0 && y >= 0 && x < W && y < H) U[y * W + x] = PAL32[k]; };
      const f = flick ? (t >> 2) & 1 : 0;
      art(f ? ['.a.', '.a.', '.ab', 'abb', 'bYb', 'bWb', '.b.'] : ['.a.', 'a..', 'ba.', 'bba', 'bYb', 'bWb', '.b.'], { a: 11, b: 12, Y: 13, W: 7 }, (i, j, k) => px(TORCH.x - 1.5 + i | 0, 9 + j, k));
      const x0 = Math.floor(LAN.x) - 2, y0 = Math.floor(LAN.y - LAN.z) - 4;
      art(['..o..', '.o.o.', 'ooooo', 'oyWyo', 'oyWyo', 'oyyyo', 'ooooo'], { o: 0, y: 13, W: 7 }, (i, j, k) => px(x0 + i, y0 + j, k));
    }

    // ---- modes and controls ----
    const MODES = [
      { id: 'smooth', label: 'Smooth', note: 'A light map: each light\'s falloff summed per pixel, in color, and multiplied over the room. No dither, no bands. In Tycho: lightMap and multiply, per frame.' },
      { id: 'band', label: 'Banded', note: 'Smooth posterized: the light picks one of five reprints, where every ink steps up or down its own ramp and pale stone leans amber under warm light. Clean steps, every pixel an ink. Per frame.' },
      { id: 'dither', label: 'Dither', note: 'The same five bands, with a 4x4 Bayer threshold in the middle of each step, indexed by world pixel so the pattern holds still as the light moves. Per frame.' },
      { id: 'hard', label: 'Shadows', note: 'One ray per pixel from each light against the footprints of walls, pillars, crates and the traveler, recast only when the light moves. Penumbra: nine rays to the lamp. A visibility-polygon mask makes it per frame.' },
      { id: 'flood', label: 'Tile flood', note: 'Light spreads tile to tile on a 24x14 grid, losing over a quarter each step, per color channel: Minecraft\'s diamonds, Terraria\'s colors. Blocky, or bilinear between open tile centers. Per frame.' },
      { id: 'lam', label: 'Normals', note: 'Normals from each shape: flagstone and brick bevels, a round shaft, a dome over the traveler. Lit by Lambert, then cut into the palette bands. A shader, or a prebake per light.' },
      { id: 'gi', label: 'GI', note: 'Lava and the window emit; walls and crates bounce what reaches them in their own color. 32 rays per 2-px cell march a distance field, blurred, cached until a light moves. Prebake (or a shader).' },
    ];
    let mode = MODES[0], flicker = true, glowOn = true, showMap = false, dirty = true, dragging = false, draftUsed = false;
    const b1 = Kit.bar(host);
    b1.tabs(MODES.map(m => m.label), v => { mode = MODES.find(m => m.label === v); refresh(); });
    const b2 = Kit.bar(host);
    b2.check('Flicker', true, v => { flicker = v; dirty = true; });
    b2.check('Glow', true, v => { glowOn = v; dirty = true; });
    b2.check('Light map', false, v => { showMap = v; dirty = true; });
    const opt = {
      soft: b2.check('Penumbra', false, () => { dirty = true; }),
      smooth: b2.check('Smooth tiles', false, () => { dirty = true; }),
      quant: b2.check('Quantize', true, () => { dirty = true; }),
      normals: b2.check('Show normals', false, () => { dirty = true; }),
      bounce: b2.check('Bounce', true, () => { dirty = true; }),
    };
    const OPTS = { hard: ['soft'], flood: ['smooth'], lam: ['quant', 'normals'], gi: ['bounce'] };
    const note = b2.note('');
    function refresh() {
      for (const k in opt) opt[k].parentElement.style.display = (OPTS[mode.id] || []).includes(k) ? '' : 'none';
      note.textContent = mode.note;
      dirty = true;
    }
    refresh();

    let lastT = -1;
    const draw = t => {
      if (!dirty && !flicker) return;
      if (!dirty && t === lastT) return;
      lastT = t; dirty = false;
      const fl = flicker ? 1 + .03 * Math.sin(t * .5 + 1) + .06 * (Kit.hash2(t >> 2, 1, 7) - .5) : 1;
      const ft = flicker ? 1 + .07 * Math.sin(t * .9) + .14 * (Kit.hash2(t >> 1, 0, 7) - .5) : 1;
      const m = mode.id;
      const how = m === 'smooth' || m === 'band' || m === 'dither' ? 'plain' : m === 'hard' ? (opt.soft.checked && !dragging ? 'soft' : 'hard') : m;
      const draft = dragging && (m === 'gi' || (m === 'hard' && opt.soft.checked));
      if (draft) draftUsed = true;
      if (!(m === 'lam' && opt.normals.checked)) assemble(how, fl, ft, draft);
      let view = m === 'band' || m === 'dither' ? m : m === 'lam' ? (opt.normals.checked ? 'normals' : opt.quant.checked ? 'band' : 'smooth') : 'smooth';
      if (showMap && view !== 'normals') view = 'map';
      compose(view, glowOn && view === 'smooth', fl, ft);
      sprites(t, flicker);
      g.putImageData(img, 0, 0);
    };

    // drag anywhere to carry the lantern
    const move = e => {
      const [x, y] = c.at(e);
      const nx = clamp(x, 10, W - 11) + .5, ny = clamp(y + LAN.z, 28, 102) + .5;
      if (nx === LAN.x && ny === LAN.y) return;
      LAN.x = nx; LAN.y = ny; dropLantern(); dirty = true;
    };
    c.cv.addEventListener('pointerdown', e => { dragging = true; c.cv.setPointerCapture(e.pointerId); move(e); });
    c.cv.addEventListener('pointermove', e => { if (dragging) move(e); });
    const end = () => { if (!dragging) return; dragging = false; if (draftUsed) { draftUsed = false; dropLantern(); } dirty = true; };
    c.cv.addEventListener('pointerup', end); c.cv.addEventListener('pointercancel', end);

    Kit.loop(host, () => {}, draw, 30);
  });
})();
