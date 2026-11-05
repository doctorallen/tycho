// views.js: perspective demos for the research page.
// perspectives (one 12x12 world through eight projections) and parallax (layered side view with palette haze).
'use strict';
(() => {
  const { RGB, Pix } = Kit;

  // ---- painting helpers ----
  function stamp(dst, layer, oc, ox = 0, oy = 0) {
    const { w, h } = layer;
    if (oc != null) for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (layer.get(x, y) >= 0) continue;
      if (layer.get(x - 1, y) >= 0 || layer.get(x + 1, y) >= 0 || layer.get(x, y - 1) >= 0 || layer.get(x, y + 1) >= 0) dst.set(ox + x, oy + y, oc);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = layer.d[y * w + x]; if (v >= 0) dst.set(ox + x, oy + y, v); }
  }
  // convex or simple polygon fill, sampling pixel centers
  function poly(p, pts, c) {
    let y0 = Infinity, y1 = -Infinity;
    for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) p.set(x, y, c);
    }
  }
  const disc = (p, cx, cy, r, c) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) p.set(x, y, c); };
  const ell = (p, cx, cy, rx, ry, c) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) p.set(x, y, c); };
  function toCanvas(pix, pal) {
    const cv = document.createElement('canvas'); cv.width = pix.w; cv.height = pix.h;
    cv.getContext('2d').putImageData(pix.toImage(pal), 0, 0); return cv;
  }
  // index -> nearest index of a tinted version of that color: how a palette reprint darkens or hazes without new art
  function remap(fn) { return RGB.map(c => Kit.nearest(...fn(c))); }
  function reprint(pix, map) { const q = new Pix(pix.w, pix.h); for (let i = 0; i < pix.d.length; i++) q.d[i] = pix.d[i] < 0 ? -1 : map[pix.d[i]]; return q; }
  const fromRows = (rows, key) => { const p = new Pix(rows[0].length, rows.length); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (key[ch] != null) p.set(x, y, key[ch]); })); return p; };

  // ---- the world: 12x12 tiles, heights in steps; house, tree and hero placed on it ----
  const MAP = [
    'hhhGGGGGGGGG',
    'hHhGGGGGGGGG',
    'hhGGGG###GGG',
    'GGGGGG###GGG',
    'GGGGGGGPGGGG',
    'GGGGGGGPGGGG',
    'GGGtGGGPGGGG',
    'GGGGGPPPGGWG',
    'GGGGGPGGWWWW',
    'GGGGGPGWWWWW',
    'GGGGPPGWWWWW',
    'GGGGPGGGWWWW',
  ];
  const N = 12;
  const kind = (x, y) => (x < 0 || y < 0 || x >= N || y >= N) ? 'X' : MAP[y][x];
  const Z = (x, y) => ({ h: 2, H: 3, W: 0, X: 0 }[kind(x, y)] ?? 1);
  const HOUSE = { x: 6, y: 2, w: 3, d: 2, wall: 2, roof: 1.5 };   // footprint x 6..9, y 2..4, on ground z=1
  const TREE = { x: 3.5, y: 6.5 }, HERO = { x: 6.5, y: 6.5 };
  const isHouse = (x, y) => x >= HOUSE.x && x < HOUSE.x + HOUSE.w && y >= HOUSE.y && y < HOUSE.y + HOUSE.d;
  const TOP = { G: 17, h: 18, H: 18, P: 29, W: 22, t: 17, '#': 17 };
  // per-tile surface detail, the same in every view that shows tops
  function topColor(k, x, y, u, v) {
    const r = Kit.hash2(x * 16 + u, y * 16 + v, 3);
    if (k === 'W') return (v % 4 === 1 && r < 0.18) ? 24 : 22;
    if (k === 'P') return r < 0.05 ? 28 : 29;
    if (k === 'h' || k === 'H') return r < 0.03 ? 19 : 18;
    return r < 0.022 ? 18 : r < 0.045 ? 16 : 17;
  }

  // sprites shared by every view
  const HERO_PIX = fromRows(['.HHH.', 'HFFFH', '.FFF.', 'SSSSS', 'FSSSF', '.SSS.', '.P.P.', '.B.B.'],
    { H: 27, F: 13, S: 23, P: 3, B: 26 });
  function treePix(size) {
    const w = size * 2 + 2, h = Math.round(size * 2.6) + 2, p = new Pix(w, h);
    const cx = w / 2, cy = size + 1;
    const tw = Math.max(2, Math.round(size / 3));
    p.rect(Math.round(cx - tw / 2), Math.round(cy), tw, h - Math.round(cy) - 1, 27);
    p.set(Math.round(cx - tw / 2) + tw - 1, h - 2, 26);
    const clumps = [[0, -0.25, 0.8], [-0.45, 0.2, 0.55], [0.45, 0.2, 0.55], [0, 0.35, 0.6]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let hit = null;
      for (const c of clumps) if ((x + 0.5 - cx - c[0] * size) ** 2 + (y + 0.5 - cy - c[1] * size) ** 2 <= (c[2] * size) ** 2) hit = c;
      if (!hit) continue;
      const dx = (x + 0.5 - cx - hit[0] * size) / (hit[2] * size), dy = (y + 0.5 - cy - hit[1] * size) / (hit[2] * size);
      const l = -0.5 * dx - 0.6 * dy + 0.6 * Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      p.set(x, y, l > 0.62 ? 18 : l > 0.2 ? 17 : 16);
    }
    const out = new Pix(w + 2, h + 2); stamp(out, p, 0, 1, 1); return out;
  }
  const outlined = pix => { const o = new Pix(pix.w + 2, pix.h + 2); stamp(o, pix, 0, 1, 1); return o; };
  const HERO_O = outlined(HERO_PIX);
  const sprite = (dst, s, x, y) => { for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) { const v = s.d[j * s.w + i]; if (v >= 0) dst.set(x + i, y + j, v); } };

  const W = 192, H = 128;
  function sky(p, top = 0, bottom = H) {
    const bands = [23, 24, 25], bh = Math.ceil((bottom - top) / 3);
    for (let y = top; y < bottom; y++) {
      const k = Math.floor((y - top) / bh), inb = (y - top) - k * bh;
      for (let x = 0; x < W; x++) p.set(x, y, bands[Math.min(2, k + (inb >= bh - 2 && (x + y) % 2 ? 1 : 0))]);
    }
  }

  // ---------- top-down: sx = x*t, sy = y*t ----------
  function topDown(t = 10, withObjects = true) {
    const p = new Pix(N * t, N * t);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const k = kind(x, y);
      for (let v = 0; v < t; v++) for (let u = 0; u < t; u++) p.set(x * t + u, y * t + v, topColor(k, x, y, u, v));
      // height shows only as a lip: a dark edge where the land steps down to the south or east
      const z = Z(x, y);
      if (Z(x, y + 1) < z && y < N - 1) for (let u = 0; u < t; u++) { p.set(x * t + u, y * t + t - 1, 27); p.set(x * t + u, y * t + t - 2, k === 'W' ? 22 : 16); }
      if (Z(x + 1, y) < z && x < N - 1) for (let v = 0; v < t; v++) p.set(x * t + t - 1, y * t + v, 16);
    }
    if (!withObjects) return p;
    // house roof from above: ridge along x, the south half lit
    const hx = HOUSE.x * t, hy = HOUSE.y * t, hw = HOUSE.w * t, hd = HOUSE.d * t;
    const roof = new Pix(hw, hd);
    for (let y = 0; y < hd; y++) for (let x = 0; x < hw; x++) roof.set(x, y, y < hd / 2 ? 9 : (y - hd / 2) % 3 === 2 ? 10 : 11);
    for (let x = 0; x < hw; x++) roof.set(x, hd / 2 - 1, 12);
    roof.rect(hw - t + 2, 2, 3, 3, 4);
    ell(p, hx + hw / 2 + 2, hy + hd + 1, hw / 2, 2, 16);
    stamp(p, roof, 0, hx, hy);
    const tx = TREE.x * t, ty = TREE.y * t;
    ell(p, tx + 2, ty + 2, t * 0.75, t * 0.5, 16);
    const can = new Pix(2 * t, 2 * t);
    for (let y = 0; y < 2 * t; y++) for (let x = 0; x < 2 * t; x++) {
      const dx = (x + 0.5 - t) / (t * 0.8), dy = (y + 0.5 - t) / (t * 0.8);
      if (dx * dx + dy * dy > 1) continue;
      const l = -dx * 0.6 - dy * 0.6;
      can.set(x, y, l > 0.35 ? 18 : l > -0.3 ? 17 : 16);
    }
    stamp(p, can, 0, Math.round(tx - t), Math.round(ty - t));
    const hero = fromRows(['.HH.', 'SHHS', 'FSSF', '.SS.'], { H: 27, S: 23, F: 13 });
    stamp(p, hero, 0, Math.round(HERO.x * t - 2), Math.round(HERO.y * t - 2));
    return p;
  }

  // ---------- 3/4 oblique: sx = x*10, sy = y*8 - z*8 ----------
  function oblique() {
    const tx = 10, ty = 8, tz = 8, p = new Pix(W, H);
    sky(p, 0, H);
    const ox = (W - N * tx) / 2, oy = 34;
    const S = (x, y, z) => [ox + x * tx, oy + y * ty - z * tz];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const z = Z(x, y), k = kind(x, y);
        const [sx, sy] = S(x, y, z);
        // front face first (visible only where the next row is lower), then the top
        for (let v = 0; v < z * tz + 8; v++) for (let u = 0; u < tx; u++) p.set(sx + u, sy + ty + v, v === 0 ? 16 : v < z * tz ? ((u + v) % 7 === 0 ? 26 : 27) : 26);
        for (let v = 0; v < ty; v++) for (let u = 0; u < tx; u++) p.set(sx + u, sy + v, topColor(k, x, y, u, v));
      }
      if (y === HOUSE.y + HOUSE.d - 1) obliqueHouse(p, S);
      if (y === Math.floor(TREE.y)) { const tp = treePix(8), [sx, sy] = S(TREE.x, TREE.y, 1); sprite(p, tp, Math.round(sx - tp.w / 2), Math.round(sy - tp.h + 2)); }
      if (y === Math.floor(HERO.y)) { const [sx, sy] = S(HERO.x, HERO.y, 1); sprite(p, HERO_O, Math.round(sx - 3), Math.round(sy - 9)); }
    }
    return p;
  }
  function obliqueHouse(p, S) {
    const L = new Pix(W, H), { x, y, w, d, wall, roof } = HOUSE;
    const [ax, ay] = S(x, y + d, 1 + wall), [, by] = S(x, y + d, 1);
    // front wall
    L.rect(ax, ay, w * 10, by - ay, 6);
    L.rect(ax, ay, w * 10, 2, 5);
    L.rect(ax + 12, ay + 6, 6, by - ay - 6, 27); L.set(ax + 16, ay + 11, 13);
    L.rect(ax + 21, ay + 4, 6, 5, 24); L.set(ax + 22, ay + 5, 25);
    // roof: the north slope from the ridge back, then the south slope down to the eave
    const [, ry] = S(x, y + d / 2, 1 + wall + roof), [, ny] = S(x, y, 1 + wall);
    poly(L, [[ax - 1, ny], [ax + w * 10 + 1, ny], [ax + w * 10 + 1, ry], [ax - 1, ry]], 9);
    for (let yy = Math.round(ry); yy < ay + 1; yy++) for (let xx = ax - 2; xx < ax + w * 10 + 2; xx++) L.set(xx, yy, yy === Math.round(ry) ? 12 : (yy - ry) % 4 === 3 ? 10 : 11);
    L.rect(ax + w * 10 - 8, ry - 6, 4, 6, 4);
    stamp(p, L, 0);
  }

  // ---------- isometric 2:1: sx = (x - y)*8, sy = (x + y)*4 - z*6 ----------
  const IZ = 6;
  function isoBlock(p, px, py, hpx, top, left, right, k, x, y) {
    // exact 2:1 diamond (rows 4, 8, 12, 16, 16, 12, 8, 4 wide) and the two faces under it
    for (let i = 0; i < 16; i++) {
      const bottom = i < 8 ? 4 + (i >> 1) : 7 - ((i - 8) >> 1);
      for (let v = 1; v <= hpx; v++) p.set(px + i, py + bottom + v, v === 1 ? 16 : i < 8 ? left : right);
    }
    for (let r = 0; r < 8; r++) {
      const hw = r < 4 ? 2 * (r + 1) : 2 * (8 - r);
      for (let i = 8 - hw; i < 8 + hw; i++) p.set(px + i, py + r, top ? top(i, r) : 17);
    }
  }
  function iso() {
    const p = new Pix(W, H);
    sky(p);
    const ox = W / 2, oy = 34;
    const P = (x, y, z) => [ox + (x - y) * 8, oy + (x + y) * 4 - z * IZ];
    const order = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) order.push([x, y]);
    order.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [x, y] of order) {
      const z = Z(x, y), k = kind(x, y), [sx, sy] = P(x, y, z);
      isoBlock(p, sx - 8, sy, z * IZ + 10, (i, r) => topColor(k, x, y, i, r * 2), 27, 26);
    }
    const objs = [
      [HOUSE.x + HOUSE.w + HOUSE.y + HOUSE.d - 2, () => isoHouse(p, P)],
      [TREE.x + TREE.y, () => { const tp = treePix(8), [sx, sy] = P(TREE.x, TREE.y, 1); ell(p, sx + 2, sy, 8, 3, 16); sprite(p, tp, Math.round(sx - tp.w / 2), Math.round(sy - tp.h + 2)); }],
      [HERO.x + HERO.y, () => { const [sx, sy] = P(HERO.x, HERO.y, 1); ell(p, sx, sy, 3, 1, 16); sprite(p, HERO_O, Math.round(sx - 3), Math.round(sy - 9)); }],
    ].sort((a, b) => a[0] - b[0]);
    objs.forEach(o => o[1]());
    return p;
  }
  function isoHouse(p, P) {
    const L = new Pix(W, H), { x, y, w, d, wall, roof } = HOUSE;
    const z0 = 1, z1 = 1 + wall, zr = z1 + roof, ym = y + d / 2;
    // south wall (faces lower left) and east wall (faces lower right)
    poly(L, [P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x, y + d, z1)], 6);
    poly(L, [P(x + w, y + d, z0), P(x + w, y, z0), P(x + w, y, z1), P(x + w, y + d, z1)], 5);
    // door and window on the south wall
    poly(L, [P(x + 1.2, y + d, z0), P(x + 1.8, y + d, z0), P(x + 1.8, y + d, z0 + 1.3), P(x + 1.2, y + d, z0 + 1.3)], 27);
    poly(L, [P(x + 2.2, y + d, z0 + 0.8), P(x + 2.7, y + d, z0 + 0.8), P(x + 2.7, y + d, z0 + 1.5), P(x + 2.2, y + d, z0 + 1.5)], 24);
    // gable on the east end, then the south roof slope with a little overhang
    poly(L, [P(x + w, y, z1), P(x + w, y + d, z1), P(x + w, ym, zr)], 5);
    poly(L, [P(x - 0.15, y + d + 0.2, z1 - 0.15), P(x + w + 0.15, y + d + 0.2, z1 - 0.15), P(x + w + 0.15, ym, zr), P(x - 0.15, ym, zr)], 10);
    // tile rows on the slope
    for (let s = 1; s < 4; s++) {
      const f = s / 4, a = P(x - 0.15, ym + (d / 2 + 0.2) * f, zr - (roof + 0.15) * f), b = P(x + w + 0.15, ym + (d / 2 + 0.2) * f, zr - (roof + 0.15) * f);
      for (let i = 0; i <= 64; i++) L.set(Math.round(a[0] + (b[0] - a[0]) * i / 64), Math.round(a[1] + (b[1] - a[1]) * i / 64), 9);
    }
    const ra = P(x - 0.15, ym, zr), rb = P(x + w + 0.15, ym, zr);
    for (let i = 0; i <= 64; i++) L.set(Math.round(ra[0] + (rb[0] - ra[0]) * i / 64), Math.round(ra[1] + (rb[1] - ra[1]) * i / 64), 12);
    const c = P(x + 2.4, ym - 0.4, zr + 0.2);
    L.rect(Math.round(c[0]), Math.round(c[1]) - 2, 3, 6, 4);
    stamp(p, L, 0);
  }

  // ---------- side view, one slice: sx = x*16, sy = ground - z*8 ----------
  function side() {
    const T = 16, p = new Pix(W, H), base = 104;
    sky(p);
    const sy = z => Math.round(base - z * 10);
    // backdrop: the tallest land in the rows behind, hazed by palette
    for (let x = 0; x < W; x++) {
      const tx = Math.floor(x / T);
      let zb = 0; for (let y = 0; y < 6; y++) zb = Math.max(zb, Z(tx, y));
      const top = Math.round(sy(zb) - 8 + 3 * Math.sin(x * 0.2));
      for (let y = top; y < base; y++) p.set(x, y, y === top ? 24 : 22);
    }
    // the house stands behind the slice: drawn darker, one ramp step down
    const L = new Pix(W, H), hx = HOUSE.x * T, hw = HOUSE.w * T, wtop = sy(1 + HOUSE.wall), rtop = sy(1 + HOUSE.wall + HOUSE.roof);
    L.rect(hx, wtop, hw, sy(1) - wtop, 5);
    poly(L, [[hx - 3, wtop + 1], [hx + hw + 3, wtop + 1], [hx + hw - 6, rtop], [hx + 6, rtop]], 9);
    L.rect(hx + 20, wtop + 6, 8, sy(1) - wtop - 6, 26);
    L.rect(hx + 34, wtop + 5, 7, 6, 21);
    L.rect(hx + hw - 14, rtop - 6, 4, 6, 3);
    stamp(p, L, 1);
    // the slice itself: row 8 of the map, ground as a cross-section
    const row = 8;
    for (let tx = 0; tx < N; tx++) {
      const z = Z(tx, row), k = kind(tx, row);
      for (let u = 0; u < T; u++) {
        const x = tx * T + u;
        if (k === 'W') {
          const bed = sy(-0.6) + Math.round(3 * Math.sin((x - 128) / 64 * Math.PI));
          for (let y = sy(0.75); y < H; y++) p.set(x, y, y === sy(0.75) ? 24 : y < bed ? (y < sy(0.75) + 4 ? 23 : 22) : (Kit.hash2(x, y, 5) < 0.1 ? 26 : 27));
          continue;
        }
        for (let y = sy(z); y < H; y++) {
          const d = y - sy(z), r = Kit.hash2(x, y, 9);
          p.set(x, y, d < 1 ? (k === 'P' ? 29 : 18) : d < 3 ? (k === 'P' ? 28 : 17) : d < 4 ? 16 : r < 0.06 ? 28 : r < 0.12 ? 26 : 27);
        }
      }
    }
    // things standing on the slice (and the rows just behind it)
    const tp = treePix(10); sprite(p, tp, Math.round(TREE.x * T - tp.w / 2), sy(1) - tp.h + 2);
    sprite(p, HERO_O, Math.round(HERO.x * T - 3), sy(1) - 10);
    return p;
  }

  // ---------- hex (odd rows shifted): x = (q + (r&1)/2)*w, y = r*h*3/4 ----------
  const HEXROW = [[5, 2], [3, 6], [1, 10], [0, 12], [0, 12], [0, 12], [0, 12], [0, 12], [0, 12], [1, 10], [3, 6], [5, 2]];
  function hex() {
    const p = new Pix(W, H);
    p.fill(21);
    const ox = Math.floor((W - (N * 12 + 6)) / 2), oy = 8;
    for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
      const k = kind(q, r), z = Z(q, r);
      const x0 = ox + q * 12 + (r & 1) * 6, lift = (z - 1) * 3, y0 = oy + r * 9 - lift;
      // skirt for raised hexes, then the face; the lower-right rim is a ramp step darker
      for (let s = 1; s <= Math.max(0, lift) + 1; s++) for (let j = 6; j < 12; j++) { const [a, wd] = HEXROW[j]; for (let i = a; i < a + wd; i++) p.set(x0 + i, y0 + j + s, s === 1 && z > 0 ? 16 : 27); }
      for (let j = 0; j < 12; j++) { const [a, wd] = HEXROW[j]; for (let i = a; i < a + wd; i++) {
        const edge = j === 0 || j === 11 || i === a || i === a + wd - 1 || (j < 3 && i < a + 2) || (j > 8 && i > a + wd - 3);
        p.set(x0 + i, y0 + j, edge ? (k === 'W' ? 21 : k === 'P' ? 28 : 16) : topColor(k, q, r, i, j));
      } }
    }
    const at = (x, y) => [ox + x * 12 + ((Math.floor(y) & 1) ? 6 : 0), oy + y * 9];
    // the house over its six hexes, the tree and the hero on theirs
    const L = new Pix(W, H), [hx, hy] = at(HOUSE.x, HOUSE.y);
    L.rect(hx + 2, hy + 8, 34, 12, 6); L.rect(hx + 26, hy + 8, 10, 12, 5);
    poly(L, [[hx - 1, hy + 9], [hx + 39, hy + 9], [hx + 33, hy - 1], [hx + 5, hy - 1]], 10);
    for (let x = hx + 5; x < hx + 33; x++) L.set(x, hy - 1, 12);
    L.rect(hx + 10, hy + 12, 5, 8, 27); L.rect(hx + 20, hy + 12, 5, 4, 24);
    stamp(p, L, 0);
    const tp = treePix(6), [tx, ty] = at(TREE.x - 0.5, TREE.y - 0.5);
    sprite(p, tp, tx + 6 - tp.w / 2, ty + 8 - tp.h + 2);
    const [ex, ey] = at(HERO.x - 0.5, HERO.y - 0.5);
    sprite(p, HERO_O, ex + 3, ey - 1);
    return p;
  }

  // ---------- mode 7 texture and billboards ----------
  const MT = 8;
  function mode7Assets() {
    const tex = toCanvas(topDown(MT, false));
    const g = tex.getContext('2d');
    // the roof is flat on the ground plane, as Mode 7 games draw buildings
    const r = new Pix(HOUSE.w * MT, HOUSE.d * MT);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) r.set(x, y, y === 0 || x === 0 || y === r.h - 1 || x === r.w - 1 ? 0 : y < r.h / 2 ? 9 : 11);
    g.drawImage(toCanvas(r), HOUSE.x * MT, HOUSE.y * MT);
    const mt = new Pix(256, 24);
    const rr = Kit.rng(17);
    let h = 14;
    for (let x = 0; x < 256; x++) {
      h = Math.max(4, Math.min(22, h + rr.int(-1, 1) + (x % 64 < 32 ? -0.15 : 0.15)));
      const top = Math.round(24 - h - 4 * Math.sin(x / 256 * Math.PI * 6));
      for (let y = Math.max(0, top); y < 24; y++) mt.set(x, y, y === top ? 5 : y < top + 3 ? 4 : 3);
    }
    return { tex, mtn: toCanvas(mt), tree: toCanvas(treePix(8)), hero: toCanvas(HERO_O) };
  }

  // ---------- raycaster textures ----------
  function rayAssets() {
    const T = 16, mk = f => { const p = new Pix(T, T); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) p.set(x, y, f(x, y)); return p; };
    const plaster = mk((x, y) => y < 2 ? 5 : y === 15 ? 4 : (Kit.hash2(x, y, 4) < 0.06 ? 5 : 6));
    const window = mk((x, y) => (x >= 4 && x < 12 && y >= 4 && y < 11) ? ((x === 4 || x === 11 || y === 4 || y === 10 || x === 8 || y === 7) ? 27 : (x < 7 && y < 7 ? 25 : 24)) : y < 2 ? 5 : y === 15 ? 4 : 6);
    const door = mk((x, y) => (x >= 4 && x < 12 && y >= 3) ? (x === 4 || x === 11 || y === 3 ? 26 : x === 8 ? 26 : (x === 10 && y === 9) ? 13 : 27) : y < 2 ? 5 : 6);
    const hedge = mk((x, y) => { const r = Kit.hash2(x, y, 8); return y < 1 ? 18 : r < 0.18 ? 18 : r < 0.5 ? 16 : r < 0.6 ? 15 : 17; });
    const cliff = mk((x, y) => y < 3 ? (y === 2 ? 16 : 18) : (Kit.hash2(x >> 1, y >> 1, 2) < 0.15 ? 26 : y % 5 === 0 && x % 6 < 3 ? 28 : 27));
    // three distance shades for each, by palette reprint (no per-pixel light): near, mid, far
    const dim1 = remap(c => c.map((v, i) => v * [0.72, 0.74, 0.86][i]));
    const dim2 = remap(c => c.map((v, i) => v * [0.45, 0.48, 0.66][i]));
    const pack = p => [p, reprint(p, dim1), reprint(p, dim2)].map(q => toCanvas(q));
    return { floor: toCanvas(topDown(MT, false)), plaster: pack(plaster), window: pack(window), door: pack(door), hedge: pack(hedge), cliff: pack(cliff),
      tree: toCanvas(treePix(9)), hero: toCanvas(HERO_O) };
  }

  // ---------- sprite stacking: one canvas per height slice across the whole map ----------
  function stackAssets() {
    const t = MT, S = N * t, layers = [];
    const L = k => (layers[k] = layers[k] || new Pix(S, S));
    const g0 = topDown(t, false);
    for (let i = 0; i < g0.d.length; i++) L(0).d[i] = g0.d[i];
    // hills: 4 slices per step, dirt sides, grass on the top slice
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const steps = (Z(x, y) - 1) * 4;
      for (let k = 1; k <= steps; k++) for (let v = 0; v < t; v++) for (let u = 0; u < t; u++) L(k).set(x * t + u, y * t + v, k === steps ? topColor(kind(x, y), x, y, u, v) : (u === 0 || v === t - 1 || u === t - 1 || v === 0) ? (k % 3 ? 27 : 26) : 27);
    }
    // house: solid slices, so the squashed, rotated draw can drop a pixel of wall without showing the grass;
    // windows in the middle slices, then the roof narrowing to the ridge
    const hx = HOUSE.x * t, hy = HOUSE.y * t, hw = HOUSE.w * t, hd = HOUSE.d * t;
    for (let k = 1; k <= 8; k++) for (let y = 0; y < hd; y++) for (let x = 0; x < hw; x++) {
      const ring = x === 0 || y === 0 || x === hw - 1 || y === hd - 1;
      if (!ring) { L(k).set(hx + x, hy + y, k === 1 ? 4 : 6); continue; }
      const door = y === hd - 1 && x >= 10 && x < 14 && k <= 5, win = k >= 4 && k <= 6 && ((x % 8 === 3 || x % 8 === 4) && (y === 0 || y === hd - 1) && !(x >= 10 && x < 14) || ((y % 8 === 3 || y % 8 === 4) && (x === 0 || x === hw - 1)));
      L(k).set(hx + x, hy + y, door ? 27 : win ? 24 : k === 1 ? 4 : 6);
    }
    for (let k = 0; k < 9; k++) for (let y = k; y < hd - k; y++) for (let x = -1; x <= hw; x++) {
      const north = y < hd / 2;
      const rim = y === k || y === hd - k - 1;
      L(9 + k).set(hx + x, hy + y, k === 8 ? 12 : (x === -1 || x === hw) && !rim ? 5 : y === k ? 9 : rim ? 10 : north ? 10 : 11);
    }
    for (let k = 10; k <= 15; k++) for (let y = 3; y < 6; y++) for (let x = hw - 7; x < hw - 4; x++) L(k).set(hx + x, hy + y, k === 15 ? 3 : 4);
    // tree: trunk, then a sphere of leaves sliced by height
    const cx = TREE.x * t, cy = TREE.y * t;
    for (let k = 1; k <= 7; k++) for (let y = -1; y < 1; y++) for (let x = -1; x < 1; x++) L(k).set(cx + x, cy + y, 27);
    for (let k = 5; k <= 19; k++) {
      const r = Math.sqrt(Math.max(0, 7.5 * 7.5 - (k - 12) * (k - 12)));
      for (let y = -8; y < 8; y++) for (let x = -8; x < 8; x++) {
        const d = Math.hypot(x + 0.5, y + 0.5);
        if (d > r) continue;
        L(k).set(cx + x, cy + y, d > r - 1 ? (k > 12 ? 16 : 15) : k > 15 ? 18 : k > 10 ? 17 : 16);
      }
    }
    // hero: boots, legs, shirt, head
    const ex = Math.round(HERO.x * t), ey = Math.round(HERO.y * t);
    [[1, 26, 1], [2, 3, 1], [3, 3, 1], [4, 23, 2], [5, 23, 2], [6, 23, 2], [7, 13, 1], [8, 13, 1], [9, 27, 1]].forEach(([k, c, r]) => {
      for (let y = -r; y < r; y++) for (let x = -r; x < r; x++) L(k).set(ex + x, ey + y, c);
    });
    return layers.map(l => toCanvas(l || new Pix(S, S)));
  }

  const NOTES = {
    'Top-down': 'Top-down: sx = x·t, sy = y·t. Height can only be hinted (the dark lips). Cheapest to author and to generate. Prebake the ground; sprites per frame.',
    '3/4 oblique': '3/4 oblique (Zelda, Stardew): sx = x·t, sy = y·t·0.8 − z·t·0.8. Tops and south faces show; draw rows back to front. Fits drawImage per frame.',
    'Isometric': 'Isometric 2:1: sx = (x − y)·tw/2, sy = (x + y)·th/2 − z·zh (here tw 16, th 8, zh 6). Sort by x + y. Fits drawImage per frame.',
    'Side view': 'Side view, one slice (row 8): sx = x·t, sy = ground − z·t. Rows behind become backdrop layers, reprinted a step darker. Fits per frame.',
    'Mode 7': 'Mode 7: per scanline, depth d = h·f/(sy − horizon); the row is an affine map of the ground texture. Drawn here as one clipped drawImage per row with setTransform: per frame, no per-pixel work.',
    'Raycaster': 'Raycaster (Wolfenstein): one DDA ray per column, wall height = h/(perpendicular distance), a 1-px drawImage strip per column, distance shades by palette reprint. The floor reuses the Mode 7 row trick; true per-pixel floor casting would be a shader.',
    'Sprite stack': 'Sprite stacking: every height slice is a top-down picture; draw them bottom up, each rotated by the camera and lifted one pixel: sx, sy = R(θ)·(x, y), sy −= k. Per frame (one transformed drawImage per slice).',
    'Hex': 'Hex (odd rows shifted): sx = (q + (r & 1)/2)·w, sy = r·h·3/4, with w 12 and row step 9 so pixel hexes tile exactly. Prebake.',
  };

  Kit.register('perspectives', { title: 'One world, eight projections', fit: 'prebake' }, host => {
    const c = Kit.canvas(host, W, H);
    const g = c.g;
    let view = 'Isometric', still = null, m7 = null, ray = null, stack = null;
    const STILL = { 'Top-down': () => { const p = new Pix(W, H).fill(21); const t = topDown(10); stamp(p, t, null, (W - t.w) / 2, (H - t.h) / 2 + 4); return p; },
      '3/4 oblique': oblique, 'Isometric': iso, 'Side view': side, 'Hex': hex };
    const show = v => {
      view = v; note.textContent = NOTES[v];
      if (STILL[v]) { still = toCanvas(STILL[v]()); }
      else if (v === 'Mode 7' && !m7) m7 = mode7Assets();
      else if (v === 'Raycaster' && !ray) ray = rayAssets();
      else if (v === 'Sprite stack' && !stack) stack = stackAssets();
      draw(tick);
    };
    let tick = 0;
    const draw = t => {
      tick = t;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      if (STILL[view]) { g.drawImage(still, 0, 0); return; }
      if (view === 'Mode 7') drawMode7(g, m7, t);
      else if (view === 'Raycaster') drawRay(g, ray, t);
      else drawStack(g, stack, t);
    };
    const b = Kit.bar(host);
    b.tabs(Object.keys(NOTES), show, view);
    const note = b.note('');
    show(view);
    Kit.loop(host, () => {}, draw, 30);
  });

  const hexc = i => Kit.PAL[i];
  function drawMode7(g, a, t) {
    const hor = 30, f = 90, camH = 22, cxs = W / 2;
    const ang = t * 0.008 + 0.6, cen = N * MT / 2;
    const cam = [cen + Math.cos(ang) * 58, cen + Math.sin(ang) * 58];
    const fw = [-Math.cos(ang), -Math.sin(ang)], rt = [-fw[1], fw[0]];
    // sky bands and a mountain strip that slides with the heading
    const bands = [23, 23, 24, 24, 25];
    bands.forEach((ci, k) => { g.fillStyle = hexc(ci); g.fillRect(0, k * 6, W, 6); });
    const mo = Math.round(((ang / (Math.PI * 2)) * 512) % 256 + 256) % 256;
    g.drawImage(a.mtn, -mo, hor - 24); g.drawImage(a.mtn, 256 - mo, hor - 24);
    for (let sy = hor + 1; sy < H; sy++) {
      const d = camH * f / (sy - hor), s = d / f;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = hexc(sy < hor + 8 ? 21 : 22); g.fillRect(0, sy, W, 1);
      g.save();
      g.beginPath(); g.rect(0, sy, W, 1); g.clip();
      const ex = cxs - (rt[0] * cam[0] + rt[1] * cam[1]) / s, ey = sy - d / s - (fw[0] * cam[0] + fw[1] * cam[1]) / s;
      g.setTransform(rt[0] / s, fw[0] / s, rt[1] / s, fw[1] / s, ex, ey);
      g.drawImage(a.tex, 0, 0);
      g.restore();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // billboards, far to near, scaled by f/depth
    const things = [[TREE.x * MT, TREE.y * MT, a.tree], [HERO.x * MT, HERO.y * MT, a.hero]].map(([x, y, img]) => {
      const rx = x - cam[0], ry = y - cam[1];
      return { dep: rx * fw[0] + ry * fw[1], lat: rx * rt[0] + ry * rt[1], img };
    }).filter(o => o.dep > 4).sort((p, q) => q.dep - p.dep);
    for (const o of things) {
      const sc = f / o.dep, w = o.img.width * sc * 0.9, h = o.img.height * sc * 0.9;
      const sx = cxs + o.lat * sc, gy = hor + camH * f / o.dep;
      g.drawImage(o.img, Math.round(sx - w / 2), Math.round(gy - h + sc), Math.round(w), Math.round(h));
    }
  }

  function drawRay(g, a, t) {
    const pos = [4.6, 9.4], ang = -Math.PI / 2 + Math.sin(t * 0.01) * 1.6, fov = 0.66;
    const dir = [Math.cos(ang), Math.sin(ang)], plane = [-dir[1] * fov, dir[0] * fov];
    const hor = H / 2;
    [[0, 22, 23], [22, 26, 24], [48, hor - 48, 25]].forEach(([y, h, ci]) => { g.fillStyle = hexc(ci); g.fillRect(0, y, W, h); });
    // the floor is the same per-row affine trick as Mode 7: the map texture under the camera, one strip per row
    const fw = dir, rt = [-dir[1], dir[0]], cam = [pos[0] * MT, pos[1] * MT];
    for (let sy = hor + 1; sy < H; sy++) {
      const d = H * 0.45 / (sy - hor) * MT, s = 2 * fov * d / W;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = hexc(15); g.fillRect(0, sy, W, 1);
      g.save(); g.beginPath(); g.rect(0, sy, W, 1); g.clip();
      g.setTransform(rt[0] / s, fw[0] / s, rt[1] / s, fw[1] / s,
        W / 2 - (rt[0] * cam[0] + rt[1] * cam[1]) / s, sy - d / s - (fw[0] * cam[0] + fw[1] * cam[1]) / s);
      g.drawImage(a.floor, 0, 0);
      g.restore();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const zbuf = new Float32Array(W);
    const solid = (x, y) => kind(x, y) === 'X' || isHouse(x, y) || Z(x, y) >= 2;
    for (let col = 0; col < W; col++) {
      const cam = 2 * col / W - 1, rd = [dir[0] + plane[0] * cam, dir[1] + plane[1] * cam];
      let mx = Math.floor(pos[0]), my = Math.floor(pos[1]);
      const dd = [Math.abs(1 / rd[0]), Math.abs(1 / rd[1])], st = [rd[0] < 0 ? -1 : 1, rd[1] < 0 ? -1 : 1];
      let sd = [(rd[0] < 0 ? pos[0] - mx : mx + 1 - pos[0]) * dd[0], (rd[1] < 0 ? pos[1] - my : my + 1 - pos[1]) * dd[1]];
      let side = 0;
      for (let i = 0; i < 40; i++) {
        if (sd[0] < sd[1]) { sd[0] += dd[0]; mx += st[0]; side = 0; } else { sd[1] += dd[1]; my += st[1]; side = 1; }
        if (solid(mx, my)) break;
      }
      const dist = side === 0 ? sd[0] - dd[0] : sd[1] - dd[1];
      zbuf[col] = dist;
      let wx = side === 0 ? pos[1] + dist * rd[1] : pos[0] + dist * rd[0]; wx -= Math.floor(wx);
      let tx = Math.floor(wx * 16); if ((side === 0 && rd[0] > 0) || (side === 1 && rd[1] < 0)) tx = 15 - tx;
      let tex = a.hedge;
      if (isHouse(mx, my)) tex = side === 1 && rd[1] < 0 && mx === 7 ? a.door : (mx + my) % 2 ? a.window : a.plaster;
      else if (Z(mx, my) >= 2) tex = a.cliff;
      const shade = Math.min(2, (side ? 1 : 0) + (dist > 7 ? 1 : 0));
      const lh = Math.round(H / dist * 0.9), top = Math.round(hor - lh / 2);
      g.drawImage(tex[shade], tx, 0, 1, 16, col, top, 1, lh);
    }
    // billboard sprites, clipped column by column against the wall depths
    const inv = 1 / (plane[0] * dir[1] - dir[0] * plane[1]);
    [[TREE.x, TREE.y, a.tree, 1.1], [HERO.x, HERO.y, a.hero, 0.45]].map(([x, y, img, sz]) => {
      const rx = x - pos[0], ry = y - pos[1];
      return { tx: inv * (dir[1] * rx - dir[0] * ry), ty: inv * (-plane[1] * rx + plane[0] * ry), img, sz };
    }).filter(s => s.ty > 0.2).sort((p, q) => q.ty - p.ty).forEach(s => {
      const sx = Math.round(W / 2 * (1 + s.tx / s.ty)), hgt = Math.round(H / s.ty * 0.9 * s.sz), wid = Math.round(hgt * s.img.width / s.img.height);
      const bottom = Math.round(hor + H / s.ty * 0.45);
      for (let col = Math.max(0, sx - (wid >> 1)); col < Math.min(W, sx + (wid >> 1)); col++) {
        if (s.ty >= zbuf[col]) continue;
        const u = Math.floor((col - (sx - (wid >> 1))) / wid * s.img.width);
        g.drawImage(s.img, u, 0, 1, s.img.height, col, bottom - hgt, 1, hgt);
      }
    });
  }

  function drawStack(g, layers, t) {
    g.fillStyle = hexc(21); g.fillRect(0, 0, W, H);
    const ang = t * 0.012, S = N * MT, sq = 0.6, sc = 1.15;
    layers.forEach((cv, k) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.translate(W / 2, H / 2 + 14 - k);
      g.scale(sc, sc * sq);
      g.rotate(ang);
      g.drawImage(cv, -S / 2, -S / 2);
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // =====================================================================
  // parallax: five generated layers at five speeds, hazed toward the sky by palette
  // =====================================================================
  function mpd(len, rng, base, amp, rough) {
    const h = new Float32Array(len + 1); h[0] = h[len] = base;
    for (let step = len; step > 1; step >>= 1, amp *= rough)
      for (let i = 0; i < len; i += step) h[i + step / 2] = (h[i] + h[i + step]) / 2 + rng.range(-amp, amp);
    return h;
  }
  Kit.register('parallax', { title: 'Parallax layers with palette haze', fit: 'per-frame' }, host => {
    const PW = 192, PH = 108, LW = 256;
    const c = Kit.canvas(host, PW, PH);
    const g = c.g;
    const SKY = RGB[25];
    let seed = 11, haze = true, speed = 1, layers = null;
    const build = () => {
      const r = Kit.rng(seed);
      const L = [];
      // sky: bands with a dithered seam, a pale sun
      const sky = new Pix(PW, PH);
      const sb = [22, 23, 24, 25];
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
        const k = Math.min(3, Math.floor(y / 18)), inb = y - k * 18;
        sky.set(x, y, sb[Math.min(3, k + (inb >= 16 && (x + y) % 2 ? 1 : 0))]);
      }
      for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { const d = Math.hypot(x - 8.5, y - 8.5); if (d < 8) sky.set(140 + x, 14 + y, d < 6.5 ? 7 : 13); }
      const clouds = new Pix(LW, 40);
      for (let k = 0; k < 5; k++) {
        const cx = r.int(0, LW), cy = r.int(8, 30), n = r.int(3, 5);
        for (let j = 0; j < n; j++) { const rr = r.int(3, 6); for (let dx = -2; dx <= 2; dx++) disc(clouds, (cx + j * 6 + dx * LW) % LW, cy - (j % 2) * 3, rr, 7); }
        for (let x = cx - 6; x < cx + n * 6 + 6; x++) clouds.set(((x % LW) + LW) % LW, cy + 3, -1);
      }
      // a mountain range by midpoint displacement; the face turned to the light is a step lighter
      const range = (base, amp, rough, cols, snow) => {
        const h = mpd(LW, r, base, amp, rough), p = new Pix(LW, PH);
        const sm = x => (h[(x + LW - 3) % LW] - h[(x + 3) % LW]);
        for (let x = 0; x < LW; x++) {
          const top = Math.round(h[x]), lit = sm(x) < -0.5;
          for (let y = Math.max(0, top); y < PH; y++) {
            const d = y - top;
            p.set(x, y, snow && y < snow && d < 6 ? (lit ? 7 : 6) : d < 1 ? cols[2] : lit && d < 10 ? cols[1] : cols[0]);
          }
        }
        return p;
      };
      // peaks: each a wedge with a lit west face and a shaded east face, snow on the tall ones
      const peaks = (base, count, hmin, hmax, cols, snowAbove) => {
        const pk = []; for (let i = 0; i < count; i++) pk.push([r.range(0, LW), r.range(hmin, hmax), r.range(0.55, 1.0)]);
        const p = new Pix(LW, PH);
        for (let x = 0; x < LW; x++) {
          let best = -1e9, dx = 0, tall = 0;
          for (const [c, ht, sl] of pk) {
            let d = x - c; d -= Math.round(d / LW) * LW;
            const v = ht - Math.abs(d) * sl + Kit.noise2(x / 9, base, seed) * 2;
            if (v > best) { best = v; dx = d; tall = ht; }
          }
          const top = Math.round(base - best), lit = dx < 0;
          const snow = tall > snowAbove ? Math.round(3 + (tall - snowAbove) * 0.5 + Kit.hash2(x >> 1, 7, seed) * 3) : 0;
          for (let y = Math.max(0, top); y < PH; y++) {
            const d = y - top;
            p.set(x, y, d < snow ? (lit ? 7 : 6) : d < 1 ? cols[2] : lit ? cols[1] : cols[0]);
          }
        }
        return p;
      };
      const far = peaks(72, 7, 22, 46, [4, 5, 5], 34);
      const mid = peaks(80, 9, 10, 28, [30, 31, 31], 99);
      const hills = range(76, 10, 0.45, [15, 16, 17], 0);
      // conifers on the hills and a near row of big ones
      const conifer = (p, x, base, hgt, cols) => {
        const L = new Pix(LW, PH);
        for (let j = 0; j < hgt; j++) {
          const hw = Math.floor((j % Math.max(3, hgt >> 2)) * 0.6 + j * 0.25) + 1;
          for (let i = -hw; i <= hw; i++) L.set(((x + i) % LW + LW) % LW, base - hgt + j, i < 0 ? cols[1] : cols[0]);
        }
        L.set(x, base, 26); L.set(x, base + 1, 26);
        stamp(p, L, 14);
      };
      const hh = [];
      for (let x = 0; x < LW; x++) { let y = 0; while (y < PH && hills.get(x, y) < 0) y++; hh.push(y); }
      for (let k = 0; k < 14; k++) { const x = r.int(0, LW - 1); conifer(hills, x, hh[x] + 3, r.int(8, 13), [15, 16]); }
      const near = new Pix(LW, PH);
      const nh = mpd(LW, r, 92, 5, 0.5);
      for (let x = 0; x < LW; x++) for (let y = Math.round(nh[x]); y < PH; y++) near.set(x, y, y - Math.round(nh[x]) < 1 ? 17 : 16);
      for (let k = 0; k < 6; k++) { const x = r.int(0, LW - 1); conifer(near, x, Math.round(nh[x]) + 2, r.int(22, 34), [15, 16]); }
      const fg = new Pix(LW, PH);
      for (let x = 0; x < LW; x++) {
        const top = 101 + Math.round(2 * Math.sin(x * 0.09) + Kit.hash2(x, 0, seed) * 2);
        for (let y = top; y < PH; y++) fg.set(x, y, 14);
        if (Kit.hash2(x, 1, seed) < 0.35) { const bl = 2 + Math.floor(Kit.hash2(x, 2, seed) * 5); for (let j = 0; j < bl; j++) fg.set(x, top - j, j === bl - 1 ? 15 : 14); }
        if (Kit.hash2(x, 3, seed) < 0.03) { fg.set(x, top - 4, 31); fg.set(x, top - 3, 15); }
      }
      // haze: each layer reprinted toward the sky color, more for farther layers (indexes only)
      const amounts = [0.2, 0.55, 0.35, 0.2, 0.08, 0];
      const set = [clouds, far, mid, hills, near, fg];
      const speeds = [0.06, 0.12, 0.28, 0.55, 1.0, 1.9];
      L.push(...set.map((p, k) => {
        const map = remap(cl => cl.map((v, i) => v + (SKY[i] - v) * amounts[k]));
        return { plain: toCanvas(p), hazy: toCanvas(reprint(p, map)), sp: speeds[k], y: 0 };
      }));
      layers = { sky: toCanvas(sky), L };
    };
    let x = 0;
    const draw = () => {
      g.drawImage(layers.sky, 0, 0);
      for (const l of layers.L) {
        const o = Math.floor(x * l.sp) % LW, img = haze ? l.hazy : l.plain;
        g.drawImage(img, -o, l.y); g.drawImage(img, LW - o, l.y);
      }
    };
    const b = Kit.bar(host);
    b.check('Depth haze', haze, v => { haze = v; draw(); });
    b.slider('Speed', 0, 3, 0.5, speed, v => { speed = v; });
    b.seed(seed, s => { seed = s; build(); draw(); });
    b.note('Six prebaked strips (clouds, far range, near range, hills, trees, grass) drawn twice each per frame at their own speed, snapped to whole pixels. Haze is a palette reprint per layer: each ink moved to the nearest ink toward the sky.');
    build();
    Kit.loop(host, () => { x += speed; }, draw, 30);
  });
})();
