// flora.js: a plant library (window.Flora) and the `plants` demo that shows it.
// Every species is a small generator: a branching skeleton with tropism for broadleaf trees, tiers for conifers,
// fronds for palms and ferns, stems and heads for flowers, ribbed bodies for cacti. They all paint into one buffer
// with light from the top left (shaded clumps, cylinder-shaded wood, bark textures along each limb), then the
// finishing passes run: snow, despeckle, a selective outline, a crop to a transparent canvas with a foot anchor.
//   Flora.species, Flora.paint(id, seed, {season, size}) -> {canvas, w, h, ax, ay}, Flora.color(id, season)
'use strict';
(() => {
  const { rng, hash2, hashStr } = Kit;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---- color: colors are 0xRRGGBB ints; ramps run dark to light with the hue shifting warm toward the light ----
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255); };
    return (f(0) << 16) | (f(8) << 8) | f(4);
  }
  // move a hue toward yellow (amt > 0) or toward blue (amt < 0), by at most |amt| degrees
  function toward(h, amt) {
    const t = amt > 0 ? 58 : 245, d = ((t - h) % 360 + 540) % 360 - 180;
    return h + Math.sign(d) * Math.min(Math.abs(d), Math.abs(amt));
  }
  // ramp(h, s, l): n steps around lightness l; dl is the lightness step, sh the hue shift per step
  function ramp(h, s, l, n = 4, dl = 0.11, sh = 9) {
    const o = [];
    for (let i = 0; i < n; i++) { const t = i - (n - 1) / 2; o.push(hsl(toward(h, t * sh), s * (1 - t * 0.07), l + t * dl)); }
    return o;
  }
  const hexC = s => parseInt(s.slice(1), 16);
  const mix = (a, b, t) => {
    const r = Math.round(lerp(a >> 16, b >> 16, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
    return (r << 16) | (g << 8) | bl;
  };
  const INK = 0x160e1c;
  const SNOW = [0x8fa0bf, 0xc9d6e8, 0xf6f8fc];

  // light from the top left, a little toward the viewer
  const LX = -0.6, LY = -0.5, LZ = 0.62;
  // brightness to a ramp step: thresholds tuned so a sphere gets a clean lit cap, a mid band and a dark crescent
  function lev(b, n) {
    if (n === 2) return b < 0.4 ? 0 : 1;
    if (n === 3) return b < 0.2 ? 0 : b < 0.62 ? 1 : 2;
    if (n === 4) return b < 0.1 ? 0 : b < 0.45 ? 1 : b < 0.78 ? 2 : 3;
    return b < -0.05 ? 0 : b < 0.3 ? 1 : b < 0.6 ? 2 : b < 0.85 ? 3 : 4;
  }

  // ---- the paint buffer ----
  // Colors plus a flag byte per pixel. Builders draw with the foot at (0,0) and y going up negative.
  const OL = 1, LEAF = 2, SNOWY = 4, WOOD = 8, EDGE = 128;
  class Buf {
    constructor(w, h, ox, oy) { this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.c = new Int32Array(w * h).fill(-1); this.f = new Uint8Array(w * h); }
    i(x, y) { x = Math.floor(x) + this.ox; y = Math.floor(y) + this.oy; return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : y * this.w + x; }
    set(x, y, c, f = OL) { const i = this.i(x, y); if (i >= 0) { this.c[i] = c; this.f[i] = f; } }
    get(x, y) { const i = this.i(x, y); return i < 0 ? -1 : this.c[i]; }
    fl(x, y) { const i = this.i(x, y); return i < 0 ? 0 : this.f[i]; }
  }

  // a 1-pixel line stepped along its major axis, so it never makes L-shaped corners
  function line(b, x0, y0, x1, y1, c, f = 0) {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k++) b.set(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, c, f);
  }
  // a polyline through points [[x,y],...], one color or a color per point index
  function path(b, pts, c, f = 0) {
    for (let k = 1; k < pts.length; k++) line(b, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], typeof c === 'function' ? c(k) : c, f);
  }

  // wood: a capsule from (x0,y0) to (x1,y1), radius r0 to r1, shaded as a cylinder lit from the top left.
  // bark = {ramp or rampAt(t), tex(t, w, r, o, step) -> a step delta or {c: color}, twig}; t runs along the limb, w across it.
  function cap(b, x0, y0, x1, y1, r0, r1, bark, t0 = 0, f = OL | WOOD) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1e-6, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const rm = Math.max(r0, r1), rp = bark.rampAt ? null : bark.ramp;
    if (rm < 0.75) { line(b, x0, y0, x1, y1, bark.twig || (rp || bark.rampAt(t0))[0], f & ~OL); return t0 + L; }
    const ln = nx * LX + ny * LY;
    for (let j = Math.floor(Math.min(y0, y1) - rm); j <= Math.ceil(Math.max(y0, y1) + rm); j++) {
      for (let i = Math.floor(Math.min(x0, x1) - rm); i <= Math.ceil(Math.max(x0, x1) + rm); i++) {
        const px = i + 0.5, py = j + 0.5;
        const u = clamp(((px - x0) * ux + (py - y0) * uy) / L, 0, 1);
        const cx = x0 + dx * u, cy = y0 + dy * u, r = r0 + (r1 - r0) * u;
        if ((px - cx) ** 2 + (py - cy) ** 2 > r * r) continue;
        const w = (px - cx) * nx + (py - cy) * ny, o = clamp(w / r, -1, 1);
        const br = o * ln + Math.sqrt(1 - o * o) * LZ;
        const t = t0 + u * L, R = rp || bark.rampAt(t);
        let s = lev(br, R.length);
        if (bark.tex) {
          const m = bark.tex(t, w, r, o, s);
          if (typeof m === 'object') { b.set(i, j, m.c, f); continue; }
          s = clamp(s + m, 0, R.length - 1);
        }
        b.set(i, j, R[s], f);
      }
    }
    return t0 + L;
  }
  // a profile body: rows from y=0 up to y=-h with half-width wf(t) (t 0 at the foot, 1 at the top), shaded as a cylinder
  function body(b, h, wf, R, f = OL | WOOD, tex = null, xf = () => 0) {
    for (let j = 0; j < h; j++) {
      const t = (j + 0.5) / h, hw = wf(t), cx = xf(t);
      if (hw <= 0) continue;
      for (let i = Math.floor(cx - hw); i <= Math.ceil(cx + hw); i++) {
        const w = i + 0.5 - cx;
        if (Math.abs(w) > hw) continue;
        const o = clamp(w / hw, -1, 1), br = o * LX + Math.sqrt(1 - o * o) * LZ + 0.08;
        let s = lev(br, R.length);
        if (tex) { const m = tex(j, w, hw, o, s); if (typeof m === 'object') { b.set(i, -1 - j, m.c, f); continue; } s = clamp(s + m, 0, R.length - 1); }
        b.set(i, -1 - j, R[s], f);
      }
    }
  }

  // a foliage clump: a lumpy disc shaded as a sphere. o.g = [gx, gy, grx, gry] blends in a whole-crown sphere so
  // the crown has one lit side; o.rim darkens the lower-right edge where the clump overlaps foliage behind it.
  function ball(b, cx, cy, r, R, o = {}) {
    const sq = o.sq || 1, lump = r < 2.5 ? 0 : (o.lump ?? 0.16), k = o.k || 5, ph = o.ph || 0, g = o.g, gw = o.gw ?? 0.45;
    const f = o.f ?? (OL | LEAF | SNOWY), ry = r * sq, rr = r * (1 + lump);
    for (let j = Math.floor(cy - ry * (1 + lump)); j <= Math.ceil(cy + ry * (1 + lump)); j++) {
      for (let i = Math.floor(cx - rr); i <= Math.ceil(cx + rr); i++) {
        const dx = (i + 0.5 - cx) / r, dy = (j + 0.5 - cy) / ry, d = Math.hypot(dx, dy);
        const th = Math.atan2(dy, dx), e = 1 + lump * (0.6 * Math.sin(k * th + ph) + 0.4 * Math.sin((k + 3) * th + ph * 1.7));
        if (d > e) continue;
        const nx = dx / e, ny = dy / e, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        let br = nx * LX + ny * LY + nz * LZ;
        if (g) {
          const gx = (i + 0.5 - g[0]) / g[2], gy = (j + 0.5 - g[1]) / g[3], gl = Math.hypot(gx, gy), q = gl > 1 ? 1 / gl : 1;
          const Nx = gx * q, Ny = gy * q, Nz = Math.sqrt(Math.max(0, 1 - Nx * Nx - Ny * Ny));
          br = br * (1 - gw) + (Nx * LX + Ny * LY + Nz * LZ) * gw;
        }
        let s = lev(br + (o.lift || 0), R.length);
        // leaf-cluster stamps: a 2-pixel dash one band darker on a jittered 3-pixel lattice, in the lit bands only
        if (o.tex && r >= 3.5 && s >= 2) {
          const gx = Math.floor(i / 3), gy = Math.floor(j / 3), hv = hash2(gx, gy, o.tex);
          const ax = gx * 3 + (hv < 0.5 ? 0 : 1), ay = gy * 3 + Math.floor(hash2(gy, gx, o.tex) * 3);
          if (j === ay && (i === ax || i === ax + 1) && hv < 0.8) s--;
        }
        if (o.rim && d / e > 1 - 1.3 / r && nx * 0.5 + ny > 0.25 && (b.fl(i, j) & LEAF)) s = 0;
        b.set(i, j, R[s], f);
      }
    }
  }
  // fill a region given by inside(x, y) over a box, with color(x, y) (or -1 to skip)
  function region(b, x0, y0, x1, y1, col, f = OL) {
    for (let j = Math.floor(y0); j <= Math.ceil(y1); j++) for (let i = Math.floor(x0); i <= Math.ceil(x1); i++) {
      const c = col(i + 0.5, j + 0.5); if (c >= 0) b.set(i, j, c, f);
    }
  }
  // a leaf or petal: a lens from (x0,y0) to (x1,y1) of half-width w, lit along its upper-left half
  function lens(b, x0, y0, x1, y1, w, R, f = OL | LEAF, mid = true) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1e-6, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const lit = nx * LX + ny * LY > 0 ? 1 : -1, m = w + 1;
    region(b, Math.min(x0, x1) - m, Math.min(y0, y1) - m, Math.max(x0, x1) + m, Math.max(y0, y1) + m, (px, py) => {
      const u = ((px - x0) * ux + (py - y0) * uy) / L, v = (px - x0) * nx + (py - y0) * ny;
      if (u < 0 || u > 1) return -1;
      const hw = w * Math.sin(PI * Math.min(1, u * 1.15)) + 0.35;
      if (Math.abs(v) > hw) return -1;
      if (mid && R.length > 2 && Math.abs(v) < 0.5 && L > 4 && w >= 1.5) return R[R.length - 1];
      return R[v * lit > 0 ? R.length - 2 : Math.max(0, R.length - 3)];
    }, f);
  }

  // ---- finishing passes ----
  // snow lies on any snowy pixel open to the sky, two deep where the top is flat
  function snow(b) {
    const { w, h, c, f } = b, o = Int32Array.from(c);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!(f[i] & SNOWY) || c[i] < 0 || c[i - w] >= 0) continue;
      o[i] = SNOW[2];
      if (c[i + w] >= 0 && (f[i + w] & SNOWY) && c[i - w - 1] < 0 && c[i - w + 1] < 0) o[i + w] = SNOW[1];
    }
    b.c = o;
  }
  // a leaf pixel unlike all four neighbors, three of which agree, takes their color
  function despeckle(b) {
    const { w, h, c, f } = b, o = Int32Array.from(c);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!(f[i] & LEAF) || c[i] < 0) continue;
      const n = [c[i - 1], c[i + 1], c[i - w], c[i + w]];
      if (n.includes(c[i])) continue;
      for (const v of n) if (v >= 0 && n.filter(q => q === v).length >= 3) { o[i] = v; break; }
    }
    b.c = o;
  }
  // selective outline: a clear pixel touching an outlined one takes a darkened copy of that color,
  // less dark on the lit (top and left) side
  function outline(b) {
    const { w, h, c, f } = b, o = Int32Array.from(c), of = Uint8Array.from(f);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (c[i] >= 0) continue;
      let src = -1, lit = false;
      if (y + 1 < h && c[i + w] >= 0 && f[i + w] & OL) { src = c[i + w]; lit = true; }
      else if (x + 1 < w && c[i + 1] >= 0 && f[i + 1] & OL) { src = c[i + 1]; lit = true; }
      else if (y > 0 && c[i - w] >= 0 && f[i - w] & OL) src = c[i - w];
      else if (x > 0 && c[i - 1] >= 0 && f[i - 1] & OL) src = c[i - 1];
      if (src < 0) continue;
      o[i] = mix(src, INK, lit ? 0.6 : 0.78); of[i] = EDGE;
    }
    b.c = o; b.f = of;
  }
  function crop(b) {
    const { w, h, c } = b;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (c[y * w + x] >= 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const img = new ImageData(cw, ch), d = img.data;
    let sr = 0, sg = 0, sb = 0, sn = 0;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const v = c[(y + y0) * w + x + x0]; if (v < 0) continue;
      const k = (y * cw + x) * 4; d[k] = v >> 16; d[k + 1] = (v >> 8) & 255; d[k + 2] = v & 255; d[k + 3] = 255;
      if (b.f[(y + y0) * w + x + x0] !== EDGE) { sr += d[k]; sg += d[k + 1]; sb += d[k + 2]; sn++; }
    }
    cv.getContext('2d').putImageData(img, 0, 0);
    const avg = sn ? (Math.round(sr / sn) << 16) | (Math.round(sg / sn) << 8) | Math.round(sb / sn) : 0x808080;
    return { canvas: cv, w: cw, h: ch, ax: b.ox - x0, ay: b.oy - y0, avg };
  }

  // ---- bark: a ramp and a texture along the limb (t along, w across in pixels) ----
  // furrows: dark lines that run along the limb and wander a little
  const furrow = (sp, wav = 0.7) => (t, w, r) => {
    if (r < 1.8) return 0;
    const ph = wav * Math.sin(t * 0.22), q = w - ph, k = Math.floor(q / sp);
    return ((q % sp) + sp) % sp < 0.85 + 0.25 * Math.sin(t * 0.3 + k * 2.1) ? -1 : 0;
  };
  const BARK = {
    oak: { ramp: ramp(28, 0.2, 0.3), tex: furrow(2.3), twig: 0x3a2a26 },
    maple: { ramp: ramp(25, 0.14, 0.34), tex: furrow(3, 0.4), twig: 0x3d302c },
    birch: { ramp: [0x8a8592, 0xbcb7be, 0xe3dfdb, 0xfaf8f2], twig: 0x4a2c34, tex: (t, w, r, o, s) => {
      if (r < 1.1) return { c: 0x4a2c34 };
      if (t < r * 2.2 && Math.abs(o + 0.2) < 0.7 && hash2(Math.floor(t / 2), Math.floor(w), 5) < 0.5) return { c: 0x2b2630 };
      const row = Math.floor(t), hv = hash2(row, 1, 9);
      if (hv < 0.3 && hash2(row - 1, 1, 9) >= 0.3) { const a = hash2(row, 2, 9) * 1.2 - 0.6, wd = 0.25 + hash2(row, 4, 9) * 0.4; if (Math.abs(o - a) < wd) return { c: 0x2b2630 }; }
      return 0;
    } },
    aspen: { ramp: [0x6f7a6c, 0xa9b3a2, 0xd0d6c4, 0xe9ecdc], twig: 0x4d4a3e, tex: (t, w, r, o) => {
      if (r < 1.1) return { c: 0x55524a };
      const row = Math.floor(t / 2), hv = hash2(row, 1, 19);
      if (hv < 0.22 && hash2(row - 1, 1, 19) >= 0.22 && Math.abs(o - (hash2(row, 2, 19) - 0.5)) < 0.32) return { c: 0x34332e };
      return 0;
    } },
    conifer: { ramp: ramp(18, 0.32, 0.3), tex: furrow(1.8, 0.3), twig: 0x3e2620 },
    cherry: { ramp: ramp(352, 0.24, 0.27), twig: 0x3a1f26, tex: (t, w, r, o) => r > 1.6 && Math.floor(t) % 4 === 0 && Math.abs(o) < 0.65 ? 1 : 0 },
    baobab: { ramp: ramp(20, 0.12, 0.5, 4, 0.1), tex: furrow(4.5, 1.2) },
    acacia: { ramp: ramp(25, 0.2, 0.28), tex: furrow(2, 0.5), twig: 0x3b2a22 },
    palm: { ramp: ramp(32, 0.22, 0.42), tex: (t, w, r) => Math.floor(t) % 3 === 0 ? -1 : 0 },
    snag: { ramp: [0x4f4a46, 0x7d766e, 0xa59d92, 0xcbc4b8], tex: furrow(2.2, 0.4), twig: 0x5f5952 },
    mangrove: { ramp: ramp(30, 0.12, 0.33), tex: furrow(3, 0.5), twig: 0x3d3330 },
    banyan: { ramp: ramp(35, 0.1, 0.4), tex: furrow(2.2, 1), twig: 0x50463c },
    willow: { ramp: ramp(30, 0.18, 0.3), tex: furrow(2, 0.8), twig: 0x4a3a20 },
    fern: { ramp: [0x241510, 0x3a2418, 0x5a3a24, 0x72502e], tex: (t, w, r, o) => hash2(Math.floor(t / 2), Math.floor(w + 9), 3) < 0.35 ? -1 : 0 },
  };
  // Scots pine: grey-brown plates low on the trunk, orange high up
  const PINE_LOW = ramp(22, 0.16, 0.32), PINE_HIGH = ramp(20, 0.55, 0.45, 4, 0.11, 12);

  // ---- leaves by season ----
  // deciduous: spring and summer greens, a list of autumn colors (one per clump, chosen by hash), bare in winter
  function decid(ctx, sp, k = 0) {
    if (ctx.season === 'winter') return null;
    const v = hash2(ctx.seed, k, 31);
    const c = ctx.season === 'autumn' ? sp.autumn[Math.floor(hash2(ctx.seed, sp.mixed ? k : 0, 7) * sp.autumn.length)] : sp[ctx.season];
    return ramp(c[0] + (v - 0.5) * 8, c[1], c[2] + (v - 0.5) * 0.03, 4, c[3] || 0.11);
  }
  const GREENS = {
    oak: { spring: [88, 0.5, 0.46], summer: [100, 0.42, 0.34], autumn: [[30, 0.6, 0.38], [24, 0.5, 0.32], [40, 0.55, 0.4]], mixed: true },
    maple: { spring: [84, 0.55, 0.48], summer: [108, 0.45, 0.36], autumn: [[6, 0.72, 0.44], [18, 0.8, 0.5], [356, 0.65, 0.4], [32, 0.85, 0.52]], mixed: true },
    birch: { spring: [76, 0.58, 0.55], summer: [90, 0.48, 0.44], autumn: [[48, 0.8, 0.55], [44, 0.75, 0.5]] },
    aspen: { spring: [78, 0.55, 0.52], summer: [96, 0.4, 0.42], autumn: [[46, 0.88, 0.55], [40, 0.85, 0.52], [52, 0.85, 0.58]], mixed: true },
    willow: { spring: [74, 0.55, 0.55], summer: [84, 0.42, 0.45], autumn: [[56, 0.6, 0.52]] },
    cherry: { spring: [340, 0.65, 0.8, 0.07], summer: [104, 0.4, 0.34], autumn: [[14, 0.7, 0.42], [28, 0.75, 0.46], [2, 0.6, 0.38]], mixed: true },
    acacia: { spring: [76, 0.32, 0.44], summer: [80, 0.32, 0.38], autumn: [[62, 0.32, 0.42]] },
    baobab: { spring: [92, 0.4, 0.42], summer: [100, 0.42, 0.36], autumn: [[60, 0.4, 0.42]] },
    banyan: { spring: [110, 0.4, 0.38], summer: [120, 0.4, 0.3], autumn: [[96, 0.38, 0.32]] },
    mangrove: { spring: [120, 0.35, 0.34], summer: [128, 0.36, 0.28], autumn: [[110, 0.32, 0.3]] },
    kapok: { spring: [100, 0.45, 0.4], summer: [112, 0.45, 0.32], autumn: [[96, 0.4, 0.34]] },
  };
  // an evergreen ramp, a little yellower in spring, a little duller in winter
  function ever(ctx, h, s, l, dl = 0.1) {
    const d = { spring: [-6, 0.04, 0.03], summer: [0, 0, 0], autumn: [4, -0.03, -0.01], winter: [8, -0.08, -0.03] }[ctx.season];
    const v = hash2(ctx.seed, 5, 13) - 0.5;
    return ramp(h + d[0] + v * 6, s + d[1], l + d[2] + v * 0.02, 4, dl);
  }

  // ---- broadleaf trees: a skeleton of limbs with wobble and tropism, scaled to the height, with clumps at the tips ----
  // P: trunk length and radius (units), lean, depth, kids [min,max], spread, lr (length ratio), taper, rr (kid radius ratio),
  // trop (gravity bend, + droops), tp (how fast it grows with depth), up (bend toward the sky), wob, jit
  function skel(r, P) {
    const segs = [], tips = [];
    const grow = (x, y, a, len, rad, d, t) => {
      const n = Math.max(2, Math.round(len * 5)), step = len / n, end = rad * (d === 0 && P.taper0 ? P.taper0 : P.taper);
      let dx = Math.cos(a), dy = Math.sin(a);
      const g = (P.trop || 0) * Math.pow((d + 1) / (P.depth + 1), P.tp || 1.5), up = (P.up || 0) * (d === 0 ? 2 : 1);
      for (let s = 1; s <= n; s++) {
        const aa = Math.atan2(dy, dx) + r.range(-P.wob, P.wob);
        dx = Math.cos(aa); dy = Math.sin(aa) + (g - up) * step;
        const l = Math.hypot(dx, dy); dx /= l; dy /= l;
        const nx = x + dx * step, ny = y + dy * step;
        segs.push({ x0: x, y0: y, x1: nx, y1: ny, r0: lerp(rad, end, (s - 1) / n), r1: lerp(rad, end, s / n), t0: t, d });
        x = nx; y = ny; t += step;
      }
      const ea = Math.atan2(dy, dx);
      if (d >= P.depth || len < 0.05) { tips.push({ x, y, a: ea, d }); return; }
      const k = r.int(P.kids[0], P.kids[1]);
      for (let i = 0; i < k; i++) {
        const fr = k === 1 ? r.range(-0.6, 0.6) : i / (k - 1) * 2 - 1;
        const apex = P.apex && i === (k >> 1);
        const ca = apex ? ea + r.range(-0.1, 0.1) : ea + fr * P.spread + r.range(-P.jit, P.jit);
        grow(x, y, ca, len * (apex ? P.apex : P.lr) * r.range(0.8, 1.15), end * (k === 1 || apex ? 1 : P.rr), d + 1, t);
      }
    };
    grow(0, 0, -PI / 2 + (P.lean || 0) * r.range(-1, 1), P.trunk, P.r0, 0, 0);
    return { segs, tips };
  }
  function broadleaf(b, ctx, P) {
    const { r, H } = ctx;
    // grow a few and keep the one whose crown sits best over its trunk (curation, automated)
    let S = null, best = 1e9;
    for (let k = 0; k < (P.tries || 4); k++) {
      const s = skel(r, P);
      let sx = 0, x0 = 1e9, x1 = -1e9;
      for (const t of s.tips) { sx += t.x; x0 = Math.min(x0, t.x); x1 = Math.max(x1, t.x); }
      const score = Math.abs(sx / s.tips.length) / Math.max(0.1, x1 - x0) - (P.wide ? (x1 - x0) * 0.05 : 0);
      if (score < best) { best = score; S = s; }
    }
    let top = 0;
    for (const s of S.segs) top = Math.min(top, s.y1);
    const k = H / (-top + P.leafR * 0.9), R = P.leafR * k, bark = P.bark;
    // wood
    for (const s of S.segs) {
      const r0 = Math.max(s.r0 * k, s.d === 0 ? 1.1 : 0), r1 = Math.max(s.r1 * k, s.d === 0 ? 1 : 0);
      cap(b, s.x0 * k, s.y0 * k, s.x1 * k, s.y1 * k, r0, r1, bark, s.t0 * k, (r1 >= 1.3 ? OL : 0) | WOOD);
    }
    const leaves = P.leaves(ctx, 0);
    const pts = [];
    for (const t of S.tips) pts.push([t.x * k, t.y * k, t.a]);
    if (P.fill) S.segs.forEach((s, i) => { if (s.d >= P.depth - P.fill && i % 2 === 0) pts.push([s.x1 * k, s.y1 * k, -PI / 2]); });
    if (!leaves) {
      // bare: fine twigs off every tip
      const tw = P.twigs || { n: 1, len: 0.5, droop: 0 };
      for (const [x, y, a] of S.tips.map(t => [t.x * k, t.y * k, t.a])) for (let i = 0; i < tw.n; i++) {
        if (r() < (tw.skip ?? 0.4)) continue;
        const aa = a + r.range(-0.6, 0.6), l = R * tw.len * r.range(0.5, 1.1);
        const mx = x + Math.cos(aa) * l * 0.5, my = y + Math.sin(aa) * l * 0.5;
        path(b, [[x, y], [mx, my], [mx + Math.cos(aa) * l * 0.5, my + Math.sin(aa) * l * 0.5 + tw.droop * l]], bark.twig);
      }
      return S;
    }
    const kept = [];
    for (const p of pts) if (!kept.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < R * (P.merge || 0.75))) kept.push(p);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of kept) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const g = [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + R, (y1 - y0) / 2 + R];
    const drop = (P.drop || {})[ctx.season] || 0;
    kept.sort((p, q) => p[1] - q[1]);
    const live = kept.filter((p, i) => !(drop && hash2(i, ctx.seed, 77) < drop));
    // a back layer of foliage in the dark inks, up and right of the front clumps, so the crown has depth
    if (R >= 3) live.forEach((p, i) => {
      const L = P.mixed ? P.leaves(ctx, kept.indexOf(p)) : leaves;
      ball(b, p[0] + R * 0.3, p[1] - R * 0.25, R * 0.95, [L[0], L[0], L[1], L[1]], { sq: P.sq || 1, lump: P.lump ?? 0.16, ph: i * 2.3, k: 5 });
    });
    live.forEach(p => {
      const L = P.mixed ? P.leaves(ctx, kept.indexOf(p)) : leaves;
      ball(b, p[0], p[1], R * r.range(0.85, 1.15), L, { g, sq: P.sq || 1, rim: true, lump: P.lump ?? 0.16, ph: r.range(0, TAU), k: r.int(4, 6), tex: (ctx.seed & 255) + 1 });
    });
    return S;
  }

  // ---- conifers: stacked skirts drawn from the bottom up, so each tier's ragged hem hangs over the one below ----
  // P: top (y), bot (y of the lowest hem), n tiers, wf(t) half width (t 0 top to 1 bottom), droop, cur (skirt curve),
  // teeth [amp, spacing], xf(y) center line, R ramp, gap (fraction of each tier that is open below it)
  function tiers(b, ctx, P) {
    const { r } = ctx, n = P.n, th = (P.bot - P.top) / n;
    for (let k = n - 1; k >= 0; k--) {
      const t = (k + 1) / n, yb = P.top + th * (k + 1), yt = yb - th * (P.over || 1.8);
      const wb = P.wf(t) * r.range(0.88, 1.1), cx = P.xf ? P.xf(yb) : 0, ph = r.range(0, 9);
      const [amp, sp] = P.teeth, side = r.range(0.9, 1.1);
      region(b, cx - wb - 2, yt - 1, cx + wb + 2, yb + P.droop + amp + 1, (px, py) => {
        const dx = px - cx, a = Math.abs(dx) / (wb * (dx < 0 ? 1 : side));
        if (a > 1) return -1;
        const yU = yt + (yb - yt) * Math.pow(a, P.cur || 1);
        const tri = Math.abs(((dx / sp + ph) % 1 + 1) % 1 - 0.5) * 2;
        const yL = yb + P.droop * a * a + amp * (1 - tri) * (0.4 + a * 0.6);
        if (py < yU || py > yL) return -1;
        const v = (py - yU) / Math.max(1, yL - yU);
        // in winter each skirt carries a band of snow along its upper face, showing where it reaches past the one above
        if (ctx.season === 'winter' && py < yU + 1.6 && a > 0.12) return py < yU + 0.8 ? SNOW[2] : SNOW[1];
        let br = -dx / wb * 0.5 + (0.75 - v) * 0.6 + 0.1;
        if (py > yL - 1.1 && a < 0.92) br -= 0.5;
        return P.R[lev(br, P.R.length)];
      }, OL | LEAF | SNOWY);
    }
  }

  // ---- the species ----
  const SPECIES = [];
  const def = (id, name, kind, biomes, h, draw, extra = {}) => SPECIES.push(Object.assign({ id, name, kind, biomes, h, draw }, extra));

  // == trees ==
  def('oak', 'Oak', 'tree', ['forest', 'meadow'], [56, 84], (b, c) => broadleaf(b, c, {
    trunk: 0.8, r0: 0.2, taper0: 0.75, lean: 0.06, depth: 4, kids: [2, 3], spread: 0.9, lr: 0.74, taper: 0.62, rr: 0.8,
    up: 0.06, trop: 0.3, wob: 0.2, jit: 0.25, leafR: 0.46, fill: 1, bark: BARK.oak, mixed: c.season === 'autumn', wide: true,
    leaves: (ctx, i) => decid(ctx, GREENS.oak, i), drop: { autumn: 0.15 }, sq: 0.85,
  }));
  def('maple', 'Maple', 'tree', ['forest'], [52, 80], (b, c) => broadleaf(b, c, {
    trunk: 1.1, r0: 0.17, taper0: 0.8, lean: 0.05, depth: 4, kids: [2, 3], spread: 0.55, lr: 0.74, taper: 0.66, rr: 0.8,
    up: 0.35, wob: 0.12, jit: 0.15, leafR: 0.42, fill: 1, bark: BARK.maple, mixed: true, merge: 0.65,
    leaves: (ctx, i) => decid(ctx, GREENS.maple, i),
  }));
  const birchP = {
    trunk: 2, r0: 0.16, taper0: 0.8, lean: 0.1, depth: 4, kids: [2, 3], spread: 0.5, lr: 0.6, taper: 0.7, rr: 0.7, apex: 0.78,
    up: 0.12, trop: 1.2, tp: 3, wob: 0.09, jit: 0.2, leafR: 0.3, fill: 1, merge: 0.85, bark: BARK.birch,
    leaves: (ctx, i) => decid(ctx, GREENS.birch, i), drop: { spring: 0.2, autumn: 0.25, summer: 0.08 }, twigs: { n: 2, len: 0.9, droop: 0.8, skip: 0.3 },
  };
  def('birch', 'Birch', 'tree', ['forest', 'taiga', 'tundra'], [50, 76], (b, c) => {
    if (c.r.chance(0.4)) { // a pair from one root, the second shorter
      b.ox += 3; broadleaf(b, Object.assign({}, c, { H: Math.round(c.H * 0.82) }), Object.assign({}, birchP, { lean: 0.25 })); b.ox -= 5;
      broadleaf(b, c, birchP); b.ox += 2;
    } else broadleaf(b, c, birchP);
  });
  def('aspen', 'Aspen', 'tree', ['taiga', 'forest'], [48, 72], (b, c) => broadleaf(b, c, {
    trunk: 1.4, r0: 0.15, taper0: 0.85, lean: 0.03, depth: 3, kids: [3, 4], spread: 0.7, lr: 0.6, taper: 0.75, rr: 0.7, apex: 0.95,
    up: 0.5, wob: 0.07, jit: 0.2, leafR: 0.26, fill: 2, merge: 0.7, bark: BARK.aspen, mixed: true, sq: 1.1,
    leaves: (ctx, i) => decid(ctx, GREENS.aspen, i),
  }));

  // weeping willow: a fountain. A short leaning trunk forks into a few limbs that arch up and over; strands fall
  // from every arch nearly to the ground, drifting outward, back curtains darker, front curtains lit on the left.
  def('willow', 'Weeping willow', 'tree', ['swamp', 'meadow'], [48, 72], (b, c) => {
    const { r, H } = c;
    const L = decid(c, GREENS.willow), bark = BARK.willow, W = H * r.range(0.62, 0.75);
    const lean = r.range(-1, 1) * H * 0.06, fy = -H * r.range(0.26, 0.34), tr = Math.max(1.6, H * 0.055);
    cap(b, 0, 0, lean, fy, tr * 1.15, tr * 0.85, bark);
    // the limbs: quadratic arches from the fork, out over the dome and down
    const n = r.int(5, 7), arches = [];
    for (let i = 0; i < n; i++) {
      // limbs lean out to both sides; none goes straight up the middle
      const s = i % 2 ? 1 : -1, f = s * lerp(0.3, 1, Math.floor(i / 2) / Math.max(1, Math.ceil(n / 2) - 1)) * r.range(0.9, 1.05);
      // central limbs climb highest; outer ones arch out and come down lower, so the dome is round
      const ex = lean + f * W * r.range(0.85, 1.05), ey = -H * (r.range(0.6, 0.68) - Math.abs(f) * 0.2);
      const cx = lean + f * W * 0.4, cy = -H * (r.range(1.06, 1.14) - Math.abs(f) * 0.18);
      const pts = [];
      for (let k = 0; k <= 16; k++) { const t = k / 16, a = (1 - t) * (1 - t), m = 2 * t * (1 - t), q = t * t; pts.push([a * (lean + s * tr * 0.4) + m * cx + q * ex, a * fy + m * cy + q * ey]); }
      arches.push({ pts, back: Math.floor(i / 2) % 2 === 1, f });
    }
    arches.sort((p, q) => (q.back ? 1 : 0) - (p.back ? 1 : 0));
    for (const a of arches) {
      let t = 0;
      for (let k = 1; k < a.pts.length; k++) { const rr = lerp(tr * 0.6, 0.5, k / a.pts.length); t = cap(b, a.pts[k - 1][0], a.pts[k - 1][1], a.pts[k][0], a.pts[k][1], rr, rr, bark, t, (rr >= 1.3 ? OL : 0) | WOOD); }
    }
    const twig = [0x6b5e2c, 0x8e7d3a, 0xa8964a];
    const R = L || twig;
    // strands: one per column along each arch, back arches first in the dark inks
    for (const a of arches) {
      const seen = new Set();
      for (let k = 2; k < a.pts.length; k++) {
        const [px, py] = a.pts[k], x0 = Math.round(px);
        for (let x = x0 - 1; x <= x0 + 1; x++) {
          if (seen.has(x)) continue; seen.add(x);
          const hv = hash2(x, a.f * 99 | 0, c.seed);
          if (hv < (L ? 0.22 : 0.55)) continue; // gaps between strands
          const out = Math.sign(x - lean) || 1, len = (-py) * lerp(0.7, 0.97, hash2(x >> 1, 7, c.seed)) * (L ? 1 : 0.75);
          const lit = -(x - lean) / W * 0.45 + 0.35 + (hash2(x, 11, c.seed) - 0.5) * 0.5 - (a.back ? 0.45 : 0);
          const s0 = clamp(lev(lit, 4), 0, 3), y1 = Math.min(-1, py + len);
          let lx = x;
          for (let y = Math.round(py) + 1; y <= y1; y++) {
            lx = x + out * Math.pow((y - py) / len, 2) * H * 0.05; // drift outward as they fall
            const s = (y + (x & 3)) % 5 < 2 ? Math.max(0, s0 - 1) : s0; // leafy runs along each strand
            b.set(lx, y, R[y === y1 ? Math.min(3, s0 + 1) : s], LEAF);
          }
        }
      }
    }
    // a thin dome of leaves over the arches
    if (L) for (const a of arches) for (let k = 3; k < a.pts.length - 2; k += 3) {
      const [px, py] = a.pts[k];
      ball(b, px, py, H * 0.035 + 0.8, a.back ? [L[0], L[0], L[1], L[1]] : [L[0], L[1], L[2], L[2]], { sq: 0.7, lump: 0.2, f: LEAF | SNOWY, ph: k });
    }
  });

  // Scots pine: a tall bare trunk, orange high up, and a flat, broken crown of pads
  def('scotspine', 'Scots pine', 'tree', ['taiga', 'forest'], [60, 90], (b, c) => {
    const { r, H } = c;
    const R = ever(c, 162, 0.28, 0.33), bark = { rampAt: t => t > H * 0.42 ? PINE_HIGH : PINE_LOW, tex: furrow(2, 0.3), twig: 0x6a3a26 };
    const bend = r.range(-1, 1) * H * 0.08, top = -H * 0.88;
    const tx = t => bend * Math.sin(t * PI * 0.9), r0 = Math.max(1.4, H * 0.032);
    let t = 0;
    for (let k = 0; k < 10; k++) t = cap(b, tx(k / 10), top * k / 10, tx((k + 1) / 10), top * (k + 1) / 10, lerp(r0, r0 * 0.5, k / 10), lerp(r0, r0 * 0.5, (k + 1) / 10), bark, t);
    for (let k = 0; k < 3; k++) { // dead stubs low on the trunk
      const y = -H * r.range(0.3, 0.6), s = r.chance(0.5) ? 1 : -1, x = tx(-y / -top);
      line(b, x + s, y, x + s * r.range(3, 6), y + r.range(-1, 2), 0x4a3024, 0);
    }
    const pads = [];
    const n = r.int(3, 5);
    for (let k = 0; k < n; k++) {
      const u = lerp(0.62, 0.97, k / (n - 1)), y = top * u - (k === n - 1 ? H * 0.05 : 0), x = tx(u);
      const s = k % 2 ? 1 : -1, len = (k === n - 1 ? 0.02 : r.range(0.14, 0.26)) * H, a = -PI / 2 + s * r.range(0.7, 1.2);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      cap(b, x, y, ex, ey, Math.max(0.8, r0 * 0.45), 0.6, bark, H * u);
      pads.push([ex, ey, H * r.range(0.1, 0.13)]);
    }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y, rr] of pads) { x0 = Math.min(x0, x - rr); x1 = Math.max(x1, x + rr); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const g = [(x0 + x1) / 2, (y0 + y1) / 2 - 2, (x1 - x0) / 2, (y1 - y0) / 2 + H * 0.06];
    pads.sort((p, q) => p[1] - q[1]).forEach(([x, y, rr]) => {
      for (let k = -1; k <= 1; k++) ball(b, x + k * rr * 0.7, y + Math.abs(k) * 1.5 - 1, rr * (k ? 0.75 : 1), R, { sq: 0.5, g, gw: 0.3, rim: true, lump: 0.22, k: 7, ph: r.range(0, 9) });
    });
  });

  // eastern white pine: a straight trunk with open, level tiers of soft tufts
  def('whitepine', 'White pine', 'tree', ['forest', 'taiga'], [60, 90], (b, c) => {
    const { r, H } = c;
    const R = ever(c, 152, 0.24, 0.4), r0 = Math.max(1.2, H * 0.026);
    cap(b, 0, 0, 0, -H * 0.97, r0, 0.6, BARK.conifer);
    const n = Math.max(4, Math.round(H / 12));
    const tufts = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), y = -H * lerp(0.32, 0.9, u) + r.range(-1.5, 1.5), reach = H * (0.36 * Math.pow(1 - u, 0.8) + 0.06);
      for (const s of [-1, 1]) {
        if (r.chance(0.12) && i < n - 1) continue;
        const len = reach * r.range(0.65, 1.1), ex = s * len, ey = y - len * r.range(0.05, 0.22);
        cap(b, 0, y, ex, ey, Math.max(0.6, r0 * 0.4 * (1 - u)), 0.5, BARK.conifer);
        const m = Math.max(1, Math.round(len / (H * 0.09)));
        for (let k = 0; k < m; k++) { const f = 1 - k / (m + 0.5); tufts.push([ex * f, lerp(y, ey, f) - 1, H * r.range(0.055, 0.075) * (1 - u * 0.3)]); }
      }
    }
    tufts.push([0, -H * 0.95, H * 0.05]);
    tufts.sort((p, q) => p[1] - q[1]).forEach(([x, y, rr]) => ball(b, x, y, rr * 1.15, R, { sq: 0.5, rim: true, lump: 0.3, k: 8, ph: r.range(0, 9) }));
  });

  // spruce: a narrow dark cone of drooping skirts
  def('spruce', 'Spruce', 'tree', ['taiga', 'tundra'], [56, 90], (b, c) => {
    const { r, H } = c;
    cap(b, 0, 0, 0, -H * 0.2, Math.max(1, H * 0.025), Math.max(1, H * 0.02), BARK.conifer);
    tiers(b, c, { top: -H, bot: -H * 0.1, n: Math.round(H / 7.5), wf: t => H * 0.25 * Math.pow(t, 0.95) + 1.5, droop: H * 0.05, cur: 1.1, teeth: [2.6, 3.4], R: ever(c, 158, 0.32, 0.25, 0.09) });
    line(b, 0, -H, 0, -H - 2, ever(c, 158, 0.32, 0.25)[1], OL | LEAF);
  });
  // hemlock: flat feathery sprays in uneven layers, tips drooping, foliage lacy with sky between, and the leader
  // nodding over to one side at the very top
  def('hemlock', 'Hemlock', 'tree', ['forest', 'taiga'], [56, 86], (b, c) => {
    const { r, H } = c;
    const s = r.chance(0.5) ? 1 : -1, R = ever(c, 112, 0.34, 0.36, 0.1), tipC = c.season === 'spring' ? hsl(78, 0.6, 0.62) : R[3];
    cap(b, 0, 0, 0, -H * 0.92, Math.max(1.2, H * 0.024), 0.6, BARK.conifer);
    const levels = [];
    for (let y = -H * 0.08; y > -H * 0.93; y -= H * r.range(0.055, 0.075)) levels.push(y);
    const Wm = H * 0.42;
    for (let li = 0; li < levels.length; li++) {
      const y = levels[li], t = (-y - H * 0.08) / (H * 0.86); // 0 at the bottom, 1 at the top
      for (const side of [-1, 1]) {
        if (t > 0.2 && r.chance(0.12)) continue; // a missing spray now and then, for an uneven outline
        const L = Wm * Math.pow(1 - t, 0.7) * r.range(0.6, 1.15) + 2, th = Math.max(1.5, H * 0.065 * (1 - t * 0.5)), y0 = y + r.range(-1.5, 1.5);
        const rise = r.range(0, 0.08) * L, droop = r.range(0.25, 0.4) * L;
        const yAt = u => y0 - rise * Math.sin(u * PI) + droop * u * u * u; // out flat, a little up, then the tip droops
        line(b, 0, y0, side * L * 0.6, yAt(0.6), BARK.conifer.twig, 0);
        for (let x = side > 0 ? 0 : 1; x <= L; x++) {
          const u = x / L, cy = yAt(u), hv = hash2(x * side, li, c.seed);
          const w = th * Math.sin(PI * Math.min(1, u * 1.3 + 0.08)) * (0.7 + 0.5 * hv);
          if (w < 0.6 || hv < 0.1) continue; // lacy: a gap in the spray here and there
          const hd = hash2(x, li * 7, c.seed), top = Math.round(cy - w * 0.4), bot = Math.round(cy + w * 0.6 + (hd < 0.3 ? 2 : hd < 0.55 ? 1 : 0)); // pendant tips under each spray
          for (let yy = top; yy <= bot; yy++) {
            const v = (yy - top) / Math.max(1, bot - top);
            let br = 0.85 - v * 0.9 - side * 0.12 - (u > 0.85 ? 0 : 0.05);
            if ((x + yy) % 4 === 0 && v > 0.3) br -= 0.35; // fine needle texture
            b.set(side * x, yy, u > 0.88 && v < 0.5 ? tipC : R[lev(br, 4)], OL | LEAF | SNOWY);
          }
        }
      }
    }
    // the leader: a soft whip that nods over and hangs
    const q = Math.max(1, H / 45), lp = [[0, -H * 0.9], [s * 0.5 * q, -H * 0.96], [s * 1.5 * q, -H], [s * 2.5 * q, -H + q], [s * 3.2 * q, -H + 3 * q]];
    path(b, lp, R[1], OL | LEAF);
    lp.forEach(([x, y], k) => { if (k > 0 && k < 3) b.set(x - s, y + 1, R[2], OL | LEAF); });
  });
  // Italian cypress: a tall dark flame
  def('cypress', 'Italian cypress', 'tree', ['meadow'], [56, 90], (b, c) => {
    const { r, H } = c;
    const R = ever(c, 140, 0.3, 0.26, 0.1), W = H * r.range(0.09, 0.11);
    cap(b, 0, 0, 0, -H * 0.08, Math.max(1, H * 0.018), 1, BARK.conifer);
    const g = [-0.5, -H * 0.52, W * 1.3, H * 0.5];
    const hw = t => W * Math.pow(Math.sin(PI * clamp(t, 0, 1)), 0.55) * (t < 0.5 ? 1 : 1 - (t - 0.5) * 0.5);
    const pts = [];
    for (let y = -H * 0.06; y > -H * 0.97; y -= W * 0.55) {
      const t = (-y - H * 0.05) / (H * 0.95), w = hw(t);
      pts.push([r.range(-0.4, 0.4) * w, y, Math.max(1.2, w * 0.8)]);
      if (w > 2.5) pts.push([(r.chance(0.5) ? 1 : -1) * w * 0.45, y - 1, w * 0.6]);
    }
    pts.sort((p, q) => p[1] - q[1]).forEach(([x, y, rr]) => ball(b, x, y, rr, R, { sq: 1.9, g, gw: 0.6, rim: true, lump: 0.12, k: 4, ph: r.range(0, 9) }));
    line(b, 0, -H * 0.97, 0, -H, R[1], OL | LEAF);
  });
  // cedar of Lebanon: a thick trunk and wide flat plates, like stacked tables
  def('cedar', 'Cedar', 'tree', ['forest'], [56, 80], (b, c) => {
    const { r, H } = c;
    const R = ever(c, 168, 0.26, 0.3, 0.1), r0 = Math.max(1.5, H * 0.045), lean = r.range(-0.08, 0.08) * H;
    cap(b, 0, 0, lean, -H * 0.86, r0, r0 * 0.4, BARK.conifer);
    const n = r.int(3, 5), plates = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), y = -H * lerp(0.36, 0.92, u), x0 = lean * (-y / (H * 0.86));
      for (const s of [-1, 1]) {
        const len = H * lerp(0.5, 0.18, u) * r.range(0.75, 1.1);
        if (i === n - 1 && s > 0) continue;
        const ex = x0 + s * len, ey = y - r.range(1, 4);
        cap(b, x0, y + 2, ex * 0.8 + x0 * 0.2, ey + 1, Math.max(0.7, r0 * 0.35), 0.6, BARK.conifer);
        plates.push([x0 + s * len * 0.5 - (i === n - 1 ? s * len * 0.4 : 0), ey, len * 0.62, u]);
      }
    }
    plates.sort((p, q) => p[1] - q[1]).forEach(([x, y, w, u]) => {
      const m = Math.max(2, Math.round(w / 3.5)), g = [x, y, w + 2, H * 0.08];
      for (let k = 0; k < m; k++) ball(b, x + (k / (m - 1) - 0.5) * w * 1.3, y + r.range(-1, 1) + Math.abs(k / (m - 1) - 0.5) * 3, H * 0.1 * r.range(0.8, 1.15), R, { sq: 0.48, g, gw: 0.55, rim: true, lump: 0.25, k: 7, ph: r.range(0, 9) });
    });
  });

  // cherry: a low vase of spreading limbs; pink blossom in spring
  def('cherry', 'Cherry blossom', 'tree', ['meadow', 'forest'], [44, 64], (b, c) => {
    const pink = [ramp(342, 0.7, 0.8, 4, 0.07), ramp(330, 0.55, 0.84, 4, 0.06), ramp(350, 0.25, 0.9, 4, 0.05)];
    broadleaf(b, c, {
      trunk: 0.6, r0: 0.12, taper0: 0.8, lean: 0.1, depth: 4, kids: [2, 3], spread: 0.85, lr: 0.78, taper: 0.64, rr: 0.8,
      up: 0.04, trop: 0.35, wob: 0.18, jit: 0.2, leafR: 0.34, fill: 1, sq: 0.78, merge: 0.7, bark: BARK.cherry, mixed: true, wide: true,
      leaves: (ctx, i) => ctx.season === 'spring' ? pink[Math.floor(hash2(i, ctx.seed, 3) * 2.6)] : decid(ctx, GREENS.cherry, i),
      drop: { spring: 0.08, autumn: 0.2 },
    });
  });
  // baobab: a bottle trunk with a little crown of root-like limbs
  def('baobab', 'Baobab', 'tree', ['desert'], [56, 80], (b, c) => {
    const { r, H } = c;
    const Ht = H * r.range(0.6, 0.7), W = H * r.range(0.14, 0.18);
    const wf = t => W * (1.05 - 0.55 * t * t + 0.12 * Math.sin(t * PI)) * (t < 0.06 ? 1.08 : 1);
    body(b, Math.round(Ht), wf, BARK.baobab.ramp, OL | WOOD, (j, w, hw, o) => (((w + Math.sin(j * 0.2) * 1.2) % 4.5 + 4.5) % 4.5 < 0.8 && hw > 3 ? -1 : 0));
    const L = c.season === 'summer' || c.season === 'spring' ? decid(c, GREENS.baobab) : c.season === 'autumn' ? decid(c, GREENS.baobab) : null;
    const tw = wf(1), n = r.int(5, 7), tips = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1) * 2 - 1, x = f * tw * 0.7, a = -PI / 2 + f * r.range(0.6, 1.1), len = H * r.range(0.16, 0.26);
      const ex = x + Math.cos(a) * len, ey = -Ht + Math.sin(a) * len + 1;
      cap(b, x, -Ht + 2, ex, ey, Math.max(1, tw * 0.35), 0.7, BARK.baobab);
      for (const s of [-1, 1]) { const aa = a + s * 0.5, l = len * 0.4; cap(b, ex, ey, ex + Math.cos(aa) * l, ey + Math.sin(aa) * l, 0.7, 0.5, BARK.baobab); tips.push([ex + Math.cos(aa) * l, ey + Math.sin(aa) * l]); }
    }
    if (L && c.season !== 'autumn') tips.forEach(([x, y], i) => { if (hash2(i, 4, c.seed) < (c.season === 'spring' ? 0.4 : 0.8)) ball(b, x, y - 1, H * 0.06, L, { sq: 0.6, lump: 0.2 }); });
    if (c.season === 'autumn') tips.forEach(([x, y], i) => { if (hash2(i, 4, c.seed) < 0.3) ball(b, x, y - 1, H * 0.045, L, { sq: 0.6 }); });
  });
  // acacia: a thin crooked trunk under a flat umbrella
  def('acacia', 'Acacia', 'tree', ['desert'], [44, 64], (b, c) => {
    const { r, H } = c;
    const L = ever(c, 78, 0.32, 0.38), r0 = Math.max(1.2, H * 0.03), ty = -H * r.range(0.3, 0.4), tx = r.range(-1, 1) * H * 0.06;
    cap(b, 0, 0, tx, ty, r0, r0 * 0.8, BARK.acacia);
    const n = r.int(2, 3), W = H * r.range(0.55, 0.68), cy = -H * 0.86, tips = [];
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0 : i / (n - 1) * 2 - 1;
      let x = tx, y = ty, t = 0;
      const ex = f * W * 0.55, steps = 3;
      for (let k = 1; k <= steps; k++) {
        const nx = lerp(tx, ex, k / steps) + r.range(-2, 2), ny = lerp(ty, cy + 2, k / steps);
        t = cap(b, x, y, nx, ny, r0 * lerp(0.75, 0.35, (k - 1) / steps), r0 * lerp(0.75, 0.35, k / steps), BARK.acacia, t); x = nx; y = ny;
      }
      for (const s of [-1, 1]) { const l = W * r.range(0.25, 0.4); line(b, x, y, x + s * l, y - r.range(1, 3), BARK.acacia.twig, 0); tips.push(x + s * l * 0.6); }
      tips.push(x);
    }
    const m = Math.round(W / (H * 0.08)) + 2, g = [0, cy, W + 4, H * 0.08];
    for (let k = 0; k < m; k++) {
      const x = (k / (m - 1) * 2 - 1) * W;
      ball(b, x, cy + Math.abs(x / W) * 3 + r.range(-1, 1), H * r.range(0.1, 0.13), L, { sq: 0.48, g, gw: 0.6, rim: true, lump: 0.25, k: 8, ph: r.range(0, 9) });
    }
    if (r.chance(0.5)) for (let k = 0; k < 3; k++) ball(b, r.range(-0.5, 0.5) * W, cy - H * 0.06, H * 0.08, L, { sq: 0.35, g, gw: 0.6, lump: 0.25, k: 8 });
  });

  // a frond: a rachis that bends under gravity with leaflets down both sides (palms, tree ferns, ferns)
  // o: leaf (leaflet length), droop (how much leaflets hang), every (leaflet spacing), stem (rachis color), R ramp
  function frond(b, x, y, a, len, grav, R, o) {
    const n = Math.max(2, Math.ceil(len)), pts = [];
    let dx = Math.cos(a), dy = Math.sin(a);
    for (let s = 0; s <= n; s++) {
      pts.push([x, y, dx, dy]);
      dy += grav / n * 2; const l = Math.hypot(dx, dy); dx /= l; dy /= l; x += dx; y += dy;
    }
    const lit = -dx * LY > 0;
    for (let k = o.start || 2; k < n; k += o.every || 1) {
      const [px, py, tx, ty] = pts[k], u = k / n, Lf = o.leaf * Math.pow(Math.sin(PI * Math.min(1, u * (o.full || 1.1))), 0.6);
      if (Lf < 0.8) continue;
      for (const s of [-1, 1]) {
        let lx = -ty * s + tx * (o.fwd || 0.4), ly = tx * s + ty * (o.fwd || 0.4) + (o.droop || 0);
        const l = Math.hypot(lx, ly); lx /= l; ly /= l;
        const up = lx * LX + ly * LY > 0;
        line(b, px, py, px + lx * Lf, py + ly * Lf, R[up ? (o.hi ?? 2) : 1], o.f ?? LEAF);
      }
    }
    path(b, pts.slice(0, n), o.stem ?? R[0], o.f ?? LEAF);
    return pts;
  }

  // coconut palm: a curved ringed trunk and a burst of arching fronds
  def('palm', 'Coconut palm', 'tree', ['beach', 'jungle'], [56, 90], (b, c) => {
    const { r, H } = c;
    const s = r.chance(0.5) ? 1 : -1, bend = s * H * r.range(0.15, 0.3), Ht = H * 0.78;
    const R = ever(c, 96, 0.45, 0.36, 0.11), r0 = Math.max(1.3, H * 0.026);
    let t = 0;
    const px = u => bend * u * u, py = u => -Ht * u;
    for (let k = 0; k < 12; k++) t = cap(b, px(k / 12), py(k / 12), px((k + 1) / 12), py((k + 1) / 12), r0 * lerp(1.15, 0.8, k / 12), r0 * lerp(1.15, 0.8, (k + 1) / 12), BARK.palm, t);
    const cx = px(1), cy = py(1), n = r.int(8, 10), fr = [];
    for (let i = 0; i < n; i++) fr.push(-PI + (i + 0.5) / n * PI + r.range(-0.15, 0.15));
    fr.push(PI * 0.35 + r.range(0, 0.2), PI * 0.65 - r.range(0, 0.2)); // two hang down
    const back = fr.map((a, i) => [a, i]).sort((p, q) => Math.abs(Math.cos(q[0])) - Math.abs(Math.cos(p[0])));
    for (const [a] of back) {
      const len = H * r.range(0.38, 0.48) * (Math.sin(a) > 0.5 ? 0.7 : 1);
      frond(b, cx, cy, a, len, H * 0.015 + 0.7, R, { leaf: H * 0.09, droop: 1.3, every: 2, fwd: 0.35, stem: R[1], full: 1 });
    }
    for (let k = 0; k < r.int(3, 4); k++) ball(b, cx + r.range(-2.5, 2.5), cy + 2 + r.range(0, 2), 1.6, k % 2 ? [0x3b2b1a, 0x6a4a28, 0x8f6a3a] : [0x3e4a1c, 0x67782c, 0x8fa040], { f: OL });
  });
  // mangrove: a round crown on arching stilt roots
  def('mangrove', 'Mangrove', 'tree', ['swamp', 'beach'], [40, 60], (b, c) => {
    const { r, H } = c;
    const hr = H * 0.28, n = r.int(5, 8);
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1) * 2 - 1, ex = f * H * r.range(0.3, 0.45), sy = -hr + r.range(0, hr * 0.4), sx = f * 1.5;
      const pts = [];
      for (let k = 0; k <= 8; k++) { const u = k / 8; pts.push([lerp(sx, ex, Math.sin(u * PI / 2)), lerp(sy, 0, u * u)]); }
      let t = 0;
      for (let k = 1; k < pts.length; k++) t = cap(b, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 0.9, 0.9, BARK.mangrove, t);
    }
    b.oy -= Math.round(hr);
    broadleaf(b, Object.assign({}, c, { H: Math.round(H - hr) }), {
      trunk: 0.5, r0: 0.16, taper0: 0.8, depth: 3, kids: [3, 4], spread: 1.0, lr: 0.8, taper: 0.6, rr: 0.8, up: 0.1, trop: 0.3,
      wob: 0.15, jit: 0.2, leafR: 0.42, fill: 1, sq: 0.8, bark: BARK.mangrove, wide: true, leaves: ctx => ever(ctx, 128, 0.36, 0.28),
    });
    b.oy += Math.round(hr);
  });
  // banyan: a wide crown on a fluted trunk, with aerial roots dropping to the ground
  def('banyan', 'Banyan', 'tree', ['jungle'], [48, 70], (b, c) => {
    const { r, H } = c;
    broadleaf(b, c, {
      trunk: 1.3, r0: 0.22, taper0: 0.8, depth: 4, kids: [2, 3], spread: 1.25, lr: 0.68, taper: 0.62, rr: 0.8, up: 0.05, trop: 0.25,
      wob: 0.1, jit: 0.2, leafR: 0.3, fill: 1, sq: 0.6, bark: BARK.banyan, wide: true, leaves: ctx => ever(ctx, 116, 0.38, 0.3),
    });
    const W = H * 1.2;
    for (let x = -W; x <= W; x++) {
      if (Math.abs(x) < H * 0.08 || hash2(x, 1, c.seed) > 0.4) continue;
      let y0 = null;
      for (let y = -2; y > -H; y--) if (b.fl(x, y) & LEAF) { y0 = y; break; }
      if (y0 === null) continue;
      const thick = hash2(x, 2, c.seed) < 0.25 && Math.abs(x) < H * 0.5;
      const yb = thick || hash2(x, 3, c.seed) < 0.6 ? 0 : Math.round(y0 * r.range(0.1, 0.5));
      if (thick) cap(b, x, y0 + 1, x, yb, 0.8, 1, BARK.banyan, 0, OL | WOOD);
      else line(b, x, y0 + 1, x, yb, hash2(x, 4, c.seed) < 0.5 ? 0x6a5a48 : 0x8a7a64, 0);
    }
  });
  // kapok: a tall emergent with plank buttresses and a high, flat crown
  def('kapok', 'Kapok', 'tree', ['jungle'], [64, 96], (b, c) => {
    const { r, H } = c;
    broadleaf(b, c, {
      trunk: 2.6, r0: 0.16, taper0: 0.8, depth: 3, kids: [3, 3], spread: 1.1, lr: 0.48, taper: 0.6, rr: 0.75, up: 0.25, trop: 0, tries: 8,
      wob: 0.08, jit: 0.2, leafR: 0.34, fill: 1, sq: 0.55, merge: 0.7, bark: BARK.banyan, wide: true, leaves: ctx => decid(ctx, GREENS.kapok),
    });
    const tr = Math.max(1.5, H * 0.03);
    for (const s of [-1, 1, -0.4, 0.5]) { // buttresses: thin fins flaring to the ground
      const w = H * 0.12 * Math.abs(s) + 2, h = H * 0.2 * r.range(0.8, 1.2);
      region(b, Math.min(0, s * w) - 1, -h, Math.max(0, s * w) + 1, 0, (px, py) => {
        const d = (px * Math.sign(s)), q = 1 - (-py) / h;
        if (d < 0 || d > w * q * q + tr * 0.5) return -1;
        return BARK.banyan.ramp[Math.abs(s) < 0.6 ? 1 : s < 0 ? 2 : 1];
      }, OL | WOOD);
    }
  });
  // dead snag: a bleached broken trunk with a few snapped limbs
  def('snag', 'Dead snag', 'tree', ['forest', 'taiga', 'swamp', 'tundra'], [40, 70], (b, c) => {
    const { r, H } = c;
    const lean = r.range(-0.1, 0.1) * H, top = -H * 0.92, r0 = Math.max(2, H * 0.06), bk = BARK.snag;
    let t = 0;
    for (let k = 0; k < 6; k++) t = cap(b, lean * k / 6 * k / 6, top * k / 6, lean * (k + 1) / 6 * (k + 1) / 6, top * (k + 1) / 6, lerp(r0, r0 * 0.6, k / 6), lerp(r0, r0 * 0.6, (k + 1) / 6), bk, t);
    // the break: a few jagged splinters at the top
    const tw = r0 * 0.6;
    for (let k = -1; k <= 1; k++) { const x = lean + k * tw * 0.6, h = r.range(1, 5); line(b, x, top, x + r.range(-1, 1), top - h, bk.ramp[k < 0 ? 3 : k ? 1 : 2], OL | WOOD); }
    const n = r.int(3, 5);
    for (let i = 0; i < n; i++) {
      const u = lerp(0.3, 0.85, i / (n - 1)) + r.range(-0.05, 0.05), s = i % 2 ? 1 : -1, x = lean * u * u, y = top * u, a = -PI / 2 + s * r.range(0.5, 1.3), len = H * r.range(0.16, 0.32) * (1.1 - u * 0.5);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      cap(b, x, y, ex, ey, Math.max(0.8, r0 * 0.4), 0.6, bk, 0, OL | WOOD);
      if (r.chance(0.5)) { const aa = a - s * 0.6, l = len * 0.4, mx = lerp(x, ex, 0.6), my = lerp(y, ey, 0.6); line(b, mx, my, mx + Math.cos(aa) * l, my + Math.sin(aa) * l, bk.ramp[1], OL | WOOD); }
    }
    // a woodpecker hole and a bracket fungus
    const hy = top * r.range(0.45, 0.65), hx = lean * 0.3;
    b.set(hx, hy, 0x1a1414); b.set(hx, hy + 1, 0x1a1414);
    if (r.chance(0.7)) { const fy = top * r.range(0.2, 0.35), s = r.chance(0.5) ? 1 : -1; ball(b, s * (r0 + 1), fy, 2.2, [0x7a5a34, 0xb08850, 0xd8b878], { sq: 0.45, f: OL | SNOWY }); }
  });
  // bamboo: a clump of segmented culms with sprays of narrow leaves
  def('bamboo', 'Bamboo', 'tree', ['jungle'], [48, 80], (b, c) => {
    const { r, H } = c;
    const C = ramp(88, 0.42, 0.44, 4, 0.1), L = ever(c, 100, 0.48, 0.38), n = r.int(4, 6), gap = Math.max(4, Math.round(H / 12));
    const culms = [];
    for (let i = 0; i < n; i++) culms.push({ x: (i - (n - 1) / 2) * r.range(2.6, 3.6) + r.range(-0.5, 0.5), h: H * r.range(0.72, 1), lean: (i - (n - 1) / 2) * r.range(0.3, 0.7), ph: r.int(0, gap) });
    culms.sort((p, q) => p.h - q.h);
    for (const cu of culms) {
      const xs = y => cu.x + cu.lean * Math.pow(-y / H, 2) * H * 0.12;
      for (let y = 0; y > -cu.h; y--) {
        const x = Math.floor(xs(y)), node = (-y + cu.ph) % gap === 0;
        b.set(x, y - 1, node ? C[3] : C[2], OL | WOOD); b.set(x + 1, y - 1, node ? C[2] : C[1], OL | WOOD);
        if ((-y + cu.ph) % gap === 1) { b.set(x, y - 1, C[1], OL | WOOD); b.set(x + 1, y - 1, C[0], OL | WOOD); }
        if (node && -y > cu.h * 0.4 && r.chance(0.7)) {
          for (let k = 0; k < r.int(2, 4); k++) {
            const s = r.chance(0.5) ? 1 : -1, a = s > 0 ? r.range(-0.3, 0.9) : PI - r.range(-0.3, 0.9), l = r.range(4, 7) * Math.min(1, H / 50);
            lens(b, x + 0.5, y - 1, x + 0.5 + Math.cos(a) * l, y - 1 + Math.sin(a) * l + 1, 0.9, L, LEAF | SNOWY, false);
          }
        }
      }
      const tx = xs(-cu.h);
      for (let k = 0; k < 3; k++) { const a = -PI / 2 + (k - 1) * 0.7, l = r.range(4, 6); lens(b, tx, -cu.h, tx + Math.cos(a) * l, -cu.h + Math.sin(a) * l, 0.9, L, LEAF | SNOWY, false); }
    }
  });
  // tree fern: a shaggy trunk under a crown of feathery fronds, fiddleheads uncurling at the top
  def('treefern', 'Tree fern', 'tree', ['jungle'], [36, 56], (b, c) => {
    const { r, H } = c;
    const R = ever(c, 104, 0.5, 0.4, 0.1), Ht = Math.round(H * r.range(0.62, 0.72)), bend = r.range(-1, 1) * H * 0.08;
    const W = Math.max(2, H * 0.05);
    body(b, Ht, t => W * (1.15 - t * 0.3), BARK.fern.ramp, OL | WOOD, (j, w) => hash2(j >> 1, Math.floor(w + 9), c.seed) < 0.3 ? -1 : 0, t => bend * t * t);
    const cx = bend, cy = -Ht, n = r.int(13, 16), fr = [];
    for (let i = 0; i < n; i++) fr.push(-PI * 0.99 + (i + 0.5) / n * PI * 0.98 + r.range(-0.08, 0.08));
    fr.sort((p, q) => Math.abs(Math.cos(q)) - Math.abs(Math.cos(p)));
    for (const a of fr) frond(b, cx, cy, a, H * r.range(0.44, 0.54) * lerp(0.55, 1, Math.abs(Math.cos(a))), H * 0.006 + 0.45, R, { leaf: Math.max(1.5, H * 0.045), droop: 0.15, every: 1, fwd: 0.25, stem: 0x5a4a28, full: 1, hi: 3 });
    for (const s of [-1, 1]) { // two fiddleheads
      const x = cx + s * 1.5, y = cy - 3;
      line(b, cx, cy, x, y, R[1], LEAF); b.set(x + s, y - 1, R[2], LEAF); b.set(x, y - 2, R[2], LEAF); b.set(x - s, y - 1, R[1], LEAF);
    }
  });

  // ---- small plants: stems, blades, herbs by season ----
  const DRY = [0x4e3c2a, 0x7a6244, 0xa48a62, 0xc8b486];
  // herbage: the green of stems and leaves, yellowing in autumn and straw-dry in winter
  function herb(ctx, h = 100, s = 0.45, l = 0.38) {
    if (ctx.season === 'winter') return DRY;
    const v = hash2(ctx.seed, 9, 3) - 0.5;
    if (ctx.season === 'autumn') return ramp(h - 45 + v * 10, s * 0.9, l + 0.04, 4, 0.1);
    return ramp(h + v * 8 - (ctx.season === 'spring' ? 12 : 0), s + (ctx.season === 'spring' ? 0.08 : 0), l + (ctx.season === 'spring' ? 0.06 : 0), 4, 0.1);
  }
  // points along a quadratic curve from (x0,y0) to (x1,y1), bowed sideways by `bow`
  function curve(x0, y0, x1, y1, bow, n = 0) {
    n = n || Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    const mx = (x0 + x1) / 2 + bow, my = (y0 + y1) / 2, o = [];
    for (let k = 0; k <= n; k++) { const t = k / n, a = (1 - t) * (1 - t), m = 2 * t * (1 - t), c = t * t; o.push([a * x0 + m * mx + c * x1, a * y0 + m * my + c * y1]); }
    return o;
  }
  // a tuft of blades fanning from the foot; blades lit on the left, darker on the right and toward the back
  function blades(b, ctx, n, H, W, R, o = {}) {
    const { r } = ctx, list = [];
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0 : i / (n - 1) * 2 - 1, h = H * r.range(0.55, 1) * (1 - Math.abs(f) * 0.3);
      list.push({ x0: f * W * 0.3 + r.range(-0.5, 0.5), x1: f * W + (o.lean || 0) * h + r.range(-1, 1), h, bow: f * h * 0.15 + (o.lean || 0) * h * 0.4, back: r(), f });
    }
    list.sort((p, q) => q.back - p.back);
    for (const bl of list) {
      const pts = curve(bl.x0, 0, bl.x1, -bl.h, bl.bow);
      const s = bl.back > 0.6 ? 0 : bl.f < -0.2 ? 2 : 1;
      path(b, pts, k => k > pts.length * 0.7 && s > 0 ? R[Math.min(R.length - 1, s + 1)] : R[s], o.f ?? 0);
      bl.tip = pts[pts.length - 1];
    }
    return list;
  }

  // == shrubs and ground cover ==
  def('grass', 'Grass', 'ground', ['meadow', 'forest', 'swamp', 'jungle'], [6, 10], (b, c) => {
    blades(b, c, c.r.int(6, 9), c.H, c.H * 0.5, herb(c, 98, 0.5, 0.4));
  });
  def('tallgrass', 'Tall grass', 'ground', ['meadow', 'tundra', 'desert'], [14, 24], (b, c) => {
    const { r, H } = c, R = herb(c, 88, 0.42, 0.42), seed = c.season === 'winter' ? DRY : c.season === 'autumn' ? [0x7a5a30, 0xb08850, 0xdcc080] : [0x7a6a40, 0xb0a060, 0xd8cc8c];
    const bl = blades(b, c, r.int(7, 11), H, H * 0.35, R, { lean: r.range(-0.15, 0.15) });
    bl.filter((x, i) => i % 2 === 0).forEach(x => { const [tx, ty] = x.tip, l = Math.max(2, Math.round(H * 0.15)); for (let k = 0; k < l; k++) b.set(tx + (k > l / 2 ? (x.f < 0 ? -1 : 1) : 0), ty - k, seed[k === l - 1 ? 2 : k & 1 ? 1 : 2], OL); });
  });
  def('dunegrass', 'Dune grass', 'ground', ['beach'], [10, 16], (b, c) => {
    const lean = c.r.chance(0.5) ? 0.35 : -0.35;
    blades(b, c, c.r.int(8, 11), c.H, c.H * 0.35, c.season === 'winter' ? DRY : ramp(66, 0.32, 0.5, 4, 0.1), { lean, f: OL });
  });
  def('cottongrass', 'Cotton grass', 'ground', ['tundra', 'swamp'], [8, 14], (b, c) => {
    const { r, H } = c;
    blades(b, c, r.int(5, 7), H * 0.6, H * 0.3, herb(c, 80, 0.35, 0.4));
    const n = r.int(3, 5), R = herb(c, 80, 0.3, 0.42);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) * 2 - 1) * H * 0.3, pts = curve(x * 0.4, 0, x, -H * r.range(0.75, 1), x * 0.2);
      path(b, pts, R[1]);
      if (c.season === 'summer' || c.season === 'autumn') { const [tx, ty] = pts[pts.length - 1]; ball(b, tx, ty - 1, 1.8, [0xb8bcc8, 0xe8eaf0, 0xffffff], { f: OL }); }
    }
  });
  def('reeds', 'Reeds and cattails', 'ground', ['swamp'], [18, 30], (b, c) => {
    const { r, H } = c, R = herb(c, 90, 0.4, 0.38);
    blades(b, c, r.int(7, 10), H, H * 0.22, R, { lean: r.range(-0.08, 0.08) });
    const n = r.int(2, 3);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 2.5 + r.range(-0.5, 0.5), h = H * r.range(0.8, 1.05), hx = x + r.range(-1, 1);
      line(b, x, 0, hx, -h, R[1]);
      if (c.season !== 'spring') {
        const L = Math.max(3, Math.round(H * 0.18)), y1 = -h + 2 + Math.round(H * 0.06);
        const C = c.season === 'winter' ? [0x3a2418, 0x5e3a24, 0x7a5236] : [0x3a2016, 0x6a3a22, 0x8e5434];
        for (let y = y1; y < y1 + L; y++) { b.set(hx, y, C[1]); b.set(hx + 1, y, C[0]); b.set(hx - 1, y, y === y1 || y === y1 + L - 1 ? -1 : C[2]); }
        if (c.season === 'winter') { b.set(hx - 1, y1 + 1, 0xd8d0c0, 0); b.set(hx - 1, y1 + 2, 0xd8d0c0, 0); }
      }
    }
  });
  def('fern', 'Fern', 'ground', ['forest', 'jungle', 'swamp'], [10, 18], (b, c) => {
    const { r, H } = c, R = c.season === 'autumn' ? ramp(28, 0.55, 0.4, 4, 0.1) : herb(c, 104, 0.52, 0.38);
    const n = r.int(5, 7), fr = [];
    for (let i = 0; i < n; i++) fr.push(-PI / 2 + (i / (n - 1) * 2 - 1) * r.range(0.9, 1.25));
    fr.sort((p, q) => Math.abs(Math.cos(q)) - Math.abs(Math.cos(p)));
    for (const a of fr) frond(b, 0, 0, a, H * r.range(0.9, 1.2) * (1 - Math.abs(Math.cos(a)) * 0.2), H * 0.05 + 0.4, R, { leaf: Math.max(1.4, H * 0.14), droop: 0.4, every: 1, fwd: 0.7, stem: R[0], start: 1, f: OL | LEAF });
  });
  def('clover', 'Clover', 'ground', ['meadow'], [4, 7], (b, c) => {
    const { r, H } = c, R = herb(c, 112, 0.42, 0.4);
    const n = r.int(4, 7), W = H * 1.4, leaves = [];
    for (let i = 0; i < n; i++) leaves.push([r.range(-W, W), -r.range(1.5, H), r()]);
    leaves.sort((p, q) => p[1] - q[1]);
    for (const [x, y] of leaves) {
      line(b, x * 0.5, 0, x, y, R[1]);
      for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, -1.3]]) ball(b, x + dx, y + dy, 1.1, R, { f: OL | LEAF | SNOWY });
      b.set(x, y, R[3], LEAF);
    }
    if (c.season === 'summer' || c.season === 'spring') for (let k = 0; k < r.int(1, 2); k++) {
      const x = r.range(-W * 0.6, W * 0.6), y = -H - 1.5;
      line(b, x * 0.5, 0, x, y, R[1]);
      ball(b, x, y - 1, 1.7, r.chance(0.6) ? [0xb0a8b8, 0xe4e0e8, 0xffffff] : [0x9a4870, 0xd07aa0, 0xf0b0c8], { f: OL });
    }
  });
  def('moss', 'Moss', 'ground', ['forest', 'taiga', 'swamp', 'tundra'], [3, 6], (b, c) => {
    const { r, H } = c, R = c.season === 'winter' ? ramp(90, 0.3, 0.32, 4, 0.1) : ramp(84 + (c.season === 'autumn' ? -10 : 0), 0.5, 0.4, 4, 0.1);
    const W = H * 2.2, n = Math.round(W * 0.9);
    const pts = [];
    for (let i = 0; i < n; i++) { const x = r.range(-W, W), y = -r.range(0, H * (1 - Math.abs(x / W) * 0.7)) - 1; pts.push([x, y]); }
    pts.sort((p, q) => p[1] - q[1]).forEach(([x, y]) => ball(b, x, y, r.range(1.3, 2.1), R, { f: OL | LEAF | SNOWY }));
    if (c.season === 'spring') for (let k = 0; k < r.int(2, 4); k++) { const x = r.range(-W * 0.6, W * 0.6); line(b, x, -H, x, -H - 3, 0x8a5a2a); b.set(x, -H - 4, 0xb04a2a, 0); }
  });
  def('berrybush', 'Berry bush', 'shrub', ['forest', 'taiga'], [12, 20], (b, c) => {
    const { r, H, season } = c, W = H * 0.75;
    const L = season === 'winter' ? null : season === 'autumn' ? ramp(12, 0.5, 0.38) : herb(c, 118, 0.38, 0.33);
    const berry = r.chance(0.5) ? [0x5a0e1a, 0xb02030, 0xf06060] : [0x1a1a4a, 0x3a3a8a, 0x8a8ad0];
    for (let k = 0; k < 7; k++) { const a = -PI / 2 + (k / 6 * 2 - 1) * 1.1; line(b, 0, 0, Math.cos(a) * W * 0.9, -H * 0.15 + Math.sin(a) * H * 0.8, 0x4a3426); }
    if (L) {
      const pts = [];
      for (let k = 0; k < 9; k++) { const t = r.range(-1, 1); pts.push([t * W, -H * 0.35 - r() * H * 0.4 * (1 - Math.abs(t) * 0.5), H * r.range(0.22, 0.3)]); }
      const g = [0, -H * 0.5, W + 2, H * 0.5];
      pts.sort((p, q) => p[1] - q[1]).forEach(([x, y, rr]) => ball(b, x, y, rr, L, { g, rim: true, lump: 0.2, ph: r.range(0, 9) }));
    }
    if (season === 'summer' || season === 'autumn' || season === 'winter') for (let k = 0; k < (season === 'winter' ? 3 : 7); k++) {
      const x = r.range(-W * 0.8, W * 0.8), y = -H * r.range(0.25, 0.8);
      b.set(x, y, berry[1]); b.set(x + 1, y, berry[0]); b.set(x, y - 1, berry[2]); b.set(x + 1, y - 1, berry[1]);
    }
  });
  def('shrub', 'Round shrub', 'shrub', ['meadow', 'forest', 'jungle'], [10, 18], (b, c) => {
    const { r, H } = c, W = H * 0.7, L = ever(c, 125, 0.4, 0.3);
    line(b, 0, 0, 0, -2, 0x4a3426, OL);
    const g = [0, -H * 0.5, W, H * 0.5], pts = [];
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; pts.push([Math.cos(a) * W * 0.45, -H * 0.5 + Math.sin(a) * H * 0.3, H * 0.3]); }
    pts.push([0, -H * 0.55, H * 0.35]);
    pts.sort((p, q) => p[1] - q[1]).forEach(([x, y, rr]) => ball(b, x, y, rr, L, { g, gw: 0.7, lump: 0.22, k: 6, ph: r.range(0, 9) }));
  });
  def('heather', 'Heather', 'shrub', ['tundra', 'meadow'], [6, 10], (b, c) => {
    const { r, H } = c, W = H * 1.2, L = c.season === 'winter' ? ramp(20, 0.25, 0.3) : ramp(110, 0.3, 0.3);
    const bloom = c.season === 'summer' || c.season === 'autumn';
    const P = c.season === 'autumn' ? [0x5a2a50, 0x8a4a7a, 0xb070a0] : [0x6a2a6a, 0xa850a0, 0xd88ad0];
    const n = Math.round(W * 1.6);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) * 2 - 1) * W, h = H * (1 - Math.pow(x / W, 2) * 0.6) * r.range(0.7, 1);
      line(b, x * 0.6, 0, x, -h + 2, L[hash2(i, 1, c.seed) < 0.5 ? 1 : 2], OL | LEAF);
      if (bloom) for (let y = -h; y < -h + Math.min(4, h * 0.5); y++) b.set(x, y, P[(y + i) & 1 ? 1 : 2], OL | LEAF);
      else b.set(x, -h + 1, L[2], OL | LEAF);
    }
  });
  def('sagebrush', 'Sagebrush', 'shrub', ['desert'], [10, 16], (b, c) => {
    const { r, H } = c, W = H * 0.8, L = c.season === 'winter' ? ramp(60, 0.12, 0.45) : ramp(80, 0.16, 0.52, 4, 0.1);
    for (let k = 0; k < 9; k++) { const a = -PI / 2 + (k / 8 * 2 - 1) * 1.2; path(b, curve(0, 0, Math.cos(a) * W, -H * 0.2 + Math.sin(a) * H * 0.8, a * 2), 0x5a4a3a, OL); }
    const g = [0, -H * 0.5, W + 1, H * 0.5];
    for (let k = 0; k < 9; k++) { const t = r.range(-1, 1); ball(b, t * W * 0.85, -H * 0.4 - r() * H * 0.35 * (1 - Math.abs(t) * 0.5), H * 0.16, L, { g, lump: 0.3, k: 7, ph: r.range(0, 9) }); }
  });
  def('toadstool', 'Fly agaric', 'ground', ['forest', 'taiga'], [8, 14], (b, c) => {
    const { r, H } = c, n = r.chance(0.5) ? 2 : 1;
    for (let i = n - 1; i >= 0; i--) {
      const x = i ? r.range(4, 6) * (r.chance(0.5) ? 1 : -1) : 0, h = H * (i ? 0.6 : 1), cw = Math.max(2.5, h * 0.55);
      cap(b, x, 0, x, -h * 0.7, Math.max(0.8, h * 0.1), Math.max(0.7, h * 0.08), { ramp: [0xa89c94, 0xd8d0c8, 0xf2ece4, 0xffffff] });
      b.set(x - Math.max(1, h * 0.12), -h * 0.45, 0xe0d8d0); b.set(x + Math.max(1, h * 0.12), -h * 0.45, 0xb8b0a8);
      region(b, x - cw - 1, -h - 1, x + cw + 1, -h * 0.55, (px, py) => {
        const dx = (px - x) / cw, dy = (py + h * 0.62) / (h * 0.42);
        if (dy > 0 || dx * dx + dy * dy > 1) return -1;
        const br = -dx * 0.5 - dy * 0.3 - 0.1, R = [0x7a1a1a, 0xc02a24, 0xe8503a, 0xf88060];
        const sx = Math.floor(px), sy = Math.floor(py);
        if (h > 7 && (((sx * 3 + sy * 5) % 7 + 7) % 7 === 0) && dy < -0.2 && Math.abs(dx) < 0.85) return 0xf4ece0;
        return R[lev(br + 0.4, 4)];
      }, OL | SNOWY);
    }
  });
  def('mushrooms', 'Mushrooms', 'ground', ['forest', 'swamp', 'jungle'], [6, 12], (b, c) => {
    const { r, H } = c, n = r.int(2, 4);
    const list = [];
    for (let i = 0; i < n; i++) list.push({ x: (i - (n - 1) / 2) * r.range(2.5, 4) + r.range(-1, 1), h: H * r.range(0.5, 1), kind: r.pick(['bell', 'flat', 'bun', 'bun', 'flat']), z: r() });
    list.sort((p, q) => p.z - q.z);
    for (const m of list) {
      const { x, h } = m, sw = m.kind === 'bun' ? Math.max(1, h * 0.16) : Math.max(0.7, h * 0.08);
      cap(b, x, 0, x, -h * 0.75, sw * (m.kind === 'bun' ? 1.3 : 1), sw, { ramp: [0x8a7a68, 0xc8b8a0, 0xe8dcc4, 0xf8f0e0] });
      const cw = m.kind === 'bell' ? Math.max(1.5, h * 0.25) : m.kind === 'flat' ? Math.max(2, h * 0.5) : Math.max(2, h * 0.42);
      const ch = m.kind === 'bell' ? h * 0.5 : m.kind === 'flat' ? h * 0.22 : h * 0.36;
      const R = m.kind === 'bell' ? [0x5a5048, 0x9a9088, 0xccc4ba, 0xeee8e0] : m.kind === 'flat' ? [0x6a4a2a, 0xa87a48, 0xd0a868, 0xe8c890] : [0x4a2414, 0x7a4024, 0xa86034, 0xc8844c];
      region(b, x - cw - 1, -h - 1, x + cw + 1, -h * 0.6, (px, py) => {
        const dx = (px - x) / cw, dy = (py + h * 0.72) / ch;
        if (dy > 0.15 || dx * dx + dy * dy > 1) return -1;
        if (m.kind === 'bell' && dy > -0.15 && Math.abs(dx) > 0.6) return R[0];
        return R[lev(-dx * 0.5 - dy * 0.35 + 0.25, 4)];
      }, OL | SNOWY);
    }
  });
  def('ivy', 'Ivy on a stump', 'ground', ['forest', 'jungle'], [12, 22], (b, c) => {
    const { r, H } = c, W = H * 0.42, L = ever(c, 120, 0.42, 0.3);
    cap(b, 0, 0, 0, -H * 0.62, W, W * 0.95, BARK.oak, 0, OL | WOOD);
    region(b, -W - 1, -H * 0.62 - W * 0.4, W + 1, -H * 0.62 + W * 0.4, (px, py) => {
      const dx = px / W, dy = (py + H * 0.62) / (W * 0.4);
      if (dx * dx + dy * dy > 1) return -1;
      const rr = Math.hypot(dx, dy);
      return rr > 0.82 ? 0x6a4a30 : Math.floor(rr * 4) % 2 ? 0xc49a64 : 0xa87e4e;
    }, OL | SNOWY);
    const n = r.int(3, 4);
    for (let i = 0; i < n; i++) {
      let x = r.range(-W, W), y = 0;
      const pts = [];
      while (y > -H * r.range(0.6, 1)) { pts.push([x, y]); y -= 2; x = clamp(x + r.range(-1.5, 1.5), -W - 1, W + 1); }
      path(b, pts, 0x3a4a20, 0);
      pts.forEach(([px, py], k) => { if (k % 2 === 1) { const s = k % 4 === 1 ? -1 : 1; ball(b, px + s * 1.2, py, 1.6, L, { lump: 0, f: OL | LEAF | SNOWY }); b.set(px + s * 1.2, py, L[2], LEAF); } });
    }
  });
  def('lilypad', 'Lily pads', 'ground', ['swamp'], [3, 6], (b, c) => {
    const { r, H } = c, n = r.int(2, 4), L = c.season === 'winter' ? ramp(60, 0.25, 0.3) : c.season === 'autumn' ? ramp(70, 0.4, 0.36) : ramp(115, 0.42, 0.36);
    const pads = [];
    for (let i = 0; i < n; i++) pads.push([(i - (n - 1) / 2) * H * 2.6 + r.range(-2, 2), (i % 2) * -H * 0.9 + r.range(-1, 1), H * r.range(1.1, 1.7), r.range(0, TAU)]);
    pads.sort((p, q) => p[1] - q[1]);
    for (const [x, y, rr, nt] of pads) {
      region(b, x - rr - 1, y - rr * 0.45 - 1, x + rr + 1, y + rr * 0.45 + 1, (px, py) => {
        const dx = (px - x) / rr, dy = (py - y) / (rr * 0.45), d = Math.hypot(dx, dy);
        if (d > 1) return -1;
        let a = Math.atan2(dy, dx) - nt; a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) < 0.3 && d > 0.15) return -1;
        return L[d > 0.78 && dy > -0.2 ? 0 : Math.abs(Math.sin(a * 3)) < 0.12 && d > 0.3 ? 1 : dy < -0.3 && dx < 0.3 ? 3 : 2];
      }, OL | LEAF);
    }
    if (c.season === 'summer') { const [x, y] = pads[pads.length - 1], P = r.chance(0.5) ? [0xc898b0, 0xf0c8d8, 0xffffff] : [0xc0c0c8, 0xeeeef4, 0xffffff];
      for (const [dx, dy, s] of [[-1, 0, 1], [1, 0, 0], [0, -1, 2], [-1, -1, 2], [1, -1, 1], [0, 0, 1]]) b.set(x + dx, y - 1 + dy, P[s]);
      b.set(x, y - 1, 0xf0c040); }
  });
  def('monstera', 'Monstera', 'shrub', ['jungle'], [14, 22], (b, c) => {
    const { r, H } = c, L = ever(c, 128, 0.5, 0.3, 0.11), n = r.int(3, 5);
    const lv = [];
    for (let i = 0; i < n; i++) { const a = -PI / 2 + (i / (n - 1) * 2 - 1) * 1.15 + r.range(-0.12, 0.12); lv.push([a, H * r.range(0.55, 0.8), r()]); }
    lv.sort((p, q) => p[2] - q[2]);
    for (const [a, h, z] of lv) {
      const ex = Math.cos(a) * h * 0.9, ey = Math.sin(a) * h * 0.8;
      path(b, curve(0, 0, ex, ey, Math.cos(a) * 2), L[1], OL);
      // a heart-shaped leaf hanging from the stalk's end, with slits cut in from the edge on both sides of the midrib
      const rr = H * 0.32, la = a + (Math.cos(a) > 0 ? 0.9 : -0.9), cx = ex + Math.cos(la) * rr * 0.75, cy = ey + Math.sin(la) * rr * 0.75;
      const ux = Math.cos(la), uy = Math.sin(la), back = z < 0.4 ? -1 : 0;
      region(b, cx - rr - 1, cy - rr - 1, cx + rr + 1, cy + rr + 1, (px, py) => {
        const dx = px - cx, dy = py - cy, u = (dx * ux + dy * uy) / rr, v = (-dx * uy + dy * ux) / rr;
        const w = 0.75 * Math.sqrt(Math.max(0, 1 - u * u)) * (u < -0.6 ? 1 - (u + 0.6) * -1.2 : 1);
        if (u < -1 || u > 1 || Math.abs(v) > w + 0.05) return -1;
        if (u < -0.7 && Math.abs(v) < 0.25) return -1; // the notch at the stalk
        const k = (u + 1) * 3.2;
        if (Math.abs(v) > 0.3 && Math.abs(k - Math.round(k)) < 0.17 && Math.abs(v) > w * 0.35) return -1; // the slits
        if (Math.abs(v) < 0.09 && rr > 4) return L[3]; // the midrib
        return L[clamp(lev(-dx / rr * 0.5 - dy / rr * 0.4 + 0.35 + (v * (uy > 0 ? -1 : 1)) * 0.2, 4) + back, 0, 3)];
      }, OL | LEAF | SNOWY);
    }
  });

  // == flowers ==
  // which stage a flower is at: in bloom, a bud in spring, gone to seed in autumn, a dry stalk in winter
  function stage(ctx, bloom) {
    const s = ctx.season;
    if (s === 'winter') return 'dry';
    if (bloom.includes(s)) return 'bloom';
    return s === 'spring' ? 'bud' : 'seed';
  }
  const PETAL = {
    white: [0xa8acba, 0xdcdee8, 0xffffff], yellow: [0xc08418, 0xf0c030, 0xfff080], red: [0x7a1018, 0xc8202a, 0xf05a4a],
    pink: [0xa83a70, 0xe070a8, 0xffb0d0], purple: [0x4a2070, 0x8040b0, 0xb880e0], blue: [0x203a90, 0x3a6ad0, 0x80b0f8],
    orange: [0xa04010, 0xe87a20, 0xffb050], magenta: [0x7a1050, 0xc02a80, 0xf070b8], lilac: [0x6a50a0, 0xa088d8, 0xd0c0f8],
  };
  // a cluster of stems for a flower: returns the head positions; leaves along each stem with `leaf`
  function stems(b, ctx, n, H, W, R, o = {}) {
    const { r } = ctx, heads = [];
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0 : i / (n - 1) * 2 - 1, h = H * (i === (n >> 1) ? 1 : r.range(0.7, 0.95));
      const x1 = f * W + r.range(-0.6, 0.6), pts = curve(f * W * 0.3, 0, x1, -h, (o.bow ?? 0.12) * f * h + r.range(-0.6, 0.6));
      path(b, pts, R[o.sc ?? 1], o.f ?? 0);
      if (o.leaf) for (let k = Math.round(pts.length * 0.25); k < pts.length * 0.7; k += o.leafGap || 4) {
        const [px, py] = pts[k], s = (k / (o.leafGap || 4)) & 1 ? 1 : -1;
        lens(b, px, py, px + s * o.leaf, py - o.leaf * 0.6, Math.max(0.6, o.leaf * 0.28), R, LEAF, false);
      }
      heads.push(pts[pts.length - 1]);
    }
    return heads;
  }
  // basal leaves: a rosette of lens leaves from the foot
  function rosette(b, ctx, n, len, R, up = 0.5, w = 0.3) {
    const { r } = ctx;
    for (let i = 0; i < n; i++) {
      const a = -PI / 2 + (i / Math.max(1, n - 1) * 2 - 1) * (PI / 2 - up * 0.6) + r.range(-0.15, 0.15), l = len * r.range(0.7, 1);
      lens(b, 0, 0, Math.cos(a) * l, Math.sin(a) * l * (0.4 + up * 0.6), Math.max(0.7, l * w), R, LEAF | OL, l > 5);
    }
  }
  // a radial flower head: n petals around a center, drawn as a polar shape
  function radial(b, x, y, rad, P, C, n = 8, o = {}) {
    const rp = rad, ph = o.ph || 0, rc = o.rc ?? Math.max(0.6, rad * 0.35);
    region(b, x - rp - 1, y - rp - 1, x + rp + 1, y + rp + 1, (px, py) => {
      const dx = px - x, dy = (py - y) / (o.tilt || 1), d = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
      const e = rp * (o.round ?? 0.55 + (1 - (o.round ?? 0.55)) * Math.abs(Math.cos(n * (th + ph) / 2)));
      if (d > e + 0.3) return -1;
      if (d <= rc) return C[d < rc * 0.5 && rc > 1 ? 1 : (dx + dy < 0 ? 1 : 0)] ?? C[0];
      return P[dx + dy < -rad * 0.4 ? 2 : dx + dy > rad * 0.5 ? 0 : 1];
    }, OL);
  }
  const dryHead = (b, x, y, s = 1) => { b.set(x, y, 0x5a4030, OL); if (s > 1) { b.set(x + 1, y, 0x4a3426, OL); b.set(x, y - 1, 0x7a5a40, OL); } };

  def('daisy', 'Daisy', 'flower', ['meadow'], [8, 14], (b, c) => {
    const { r, H } = c, R = herb(c, 105), st = stage(c, ['spring', 'summer', 'autumn']);
    rosette(b, c, 4, H * 0.35, R, 0.2);
    const heads = stems(b, c, r.int(2, 4), H, H * 0.3, R);
    for (const [x, y] of heads) {
      if (st === 'bloom') radial(b, x, y, Math.max(1.8, H * 0.2), PETAL.white, [0xc89010, 0xf8d040], 12, { round: 0.85, rc: Math.max(0.8, H * 0.07) });
      else if (st === 'bud') { b.set(x, y, 0x88a040, OL); b.set(x, y - 1, 0xe8e8f0, OL); }
      else dryHead(b, x, y);
    }
  });
  def('sunflower', 'Sunflower', 'flower', ['meadow'], [28, 44], (b, c) => {
    const { r, H } = c, R = herb(c, 98, 0.5, 0.36), st = stage(c, ['summer', 'autumn']);
    const lean = r.range(-1, 1) * H * 0.06, pts = curve(0, 0, lean, -H * 0.82, lean * 0.5);
    for (let k = 1; k < pts.length; k++) cap(b, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 1, 0.9, { ramp: R }, 0, OL);
    for (let k = Math.round(pts.length * 0.2); k < pts.length * 0.75; k += Math.round(H * 0.12)) {
      const [px, py] = pts[k], s = (k & 1) ? 1 : -1, l = H * 0.2;
      lens(b, px, py, px + s * l, py + l * 0.2, l * 0.38, R, LEAF | OL);
    }
    const [hx, hy] = pts[pts.length - 1], D = Math.max(3, H * 0.12);
    if (st === 'dry' || st === 'seed') { // the head bows, its back to us, petals gone
      const C = st === 'dry' ? DRY : R;
      ball(b, hx + D * 0.5, hy + D * 0.4, D * 0.95, [C[0], C[1], C[2]], { sq: 0.7 });
      ball(b, hx + D * 0.7, hy + D * 0.9, D * 0.7, [0x2a1a10, 0x4a2a18, 0x6a4024], { sq: 0.5, f: OL });
      return;
    }
    if (st === 'bud') { ball(b, hx, hy - 1, D * 0.7, R); return; }
    radial(b, hx, hy, D * 1.75, [0xc07a10, 0xf0b820, 0xffe060], [0x3a2010], 21, { round: 0.6, rc: D });
    // the seed disc: florets on the golden angle (Vogel's model), each a dot of a lighter brown
    region(b, hx - D, hy - D, hx + D, hy + D, (px, py) => Math.hypot(px - hx, py - hy) <= D ? 0x3a2010 : -1, OL);
    const N = Math.round(D * D * 0.9), GA = PI * (3 - Math.sqrt(5));
    for (let i = 1; i < N; i++) {
      const rr = D * 0.95 * Math.sqrt(i / N), th = i * GA;
      b.set(hx + rr * Math.cos(th), hy + rr * Math.sin(th), rr < D * 0.35 ? 0x6a8030 : i % 2 ? 0x6a3a18 : 0x8a5224, OL);
    }
  });
  def('tulip', 'Tulip', 'flower', ['meadow'], [10, 16], (b, c) => {
    const { r, H } = c, R = herb(c, 110, 0.35, 0.42), st = stage(c, ['spring', 'summer']);
    const P = PETAL[r.pick(['red', 'red', 'yellow', 'pink', 'purple', 'orange', 'white'])];
    if (st !== 'dry') for (const s of [-1, 1]) lens(b, 0, 0, s * H * 0.25, -H * 0.55, H * 0.12, R, LEAF | OL);
    const heads = stems(b, c, r.int(1, 3), H, H * 0.25, R, { bow: 0.05 });
    for (const [x, y] of heads) {
      if (st === 'dry' || st === 'seed') { dryHead(b, x, y, 2); continue; }
      const w = Math.max(1.5, H * 0.13), h = Math.max(3, H * 0.28), y0 = y + 1;
      region(b, x - w - 1, y0 - h - 1, x + w + 1, y0, (px, py) => {
        const u = (y0 - py) / h, dx = (px - x) / w; if (u < 0 || u > 1) return -1;
        const hw = u < 0.75 ? 0.75 + 0.25 * Math.sin(u / 0.75 * PI / 2) : 1;
        if (Math.abs(dx) > hw) return -1;
        if (u > 0.82 && Math.abs(dx) < 0.3 && st === 'bloom') return -1; // the notch between the petal tips
        if (st === 'bud' && Math.abs(dx) > 0.6) return -1;
        return P[dx < -0.3 ? 2 : dx > 0.4 ? 0 : 1];
      }, OL);
    }
  });
  def('rose', 'Rose', 'flower', ['meadow', 'forest'], [12, 20], (b, c) => {
    const { r, H } = c, R = herb(c, 120, 0.4, 0.3), st = stage(c, ['summer']);
    const P = PETAL[r.pick(['red', 'red', 'pink', 'white', 'yellow'])];
    const heads = stems(b, c, r.int(3, 5), H, H * 0.4, R, { bow: 0.2, sc: 0 });
    if (st !== 'dry') for (let k = 0; k < 8; k++) { const x = r.range(-H * 0.4, H * 0.4), y = -r.range(H * 0.2, H * 0.75); ball(b, x, y, 1.4, R, { f: OL | LEAF }); }
    for (const [x, y] of heads) {
      if (st === 'dry') { b.set(x, y, 0x3a2418, OL); continue; }
      if (st === 'seed') { ball(b, x, y, 1.2, [0x8a2010, 0xd04a20, 0xf08040], { f: OL }); continue; }
      if (st === 'bud') { b.set(x, y, P[1], OL); b.set(x, y + 1, R[1], OL); continue; }
      const rr = Math.max(1.6, H * 0.12);
      ball(b, x, y - 0.5, rr, P, { f: OL });
      b.set(x, y - 1, P[0], OL); b.set(x + 1, y - 1, P[0], OL); b.set(x - 1, y, P[0], OL); // the swirl of folded petals
    }
  });
  def('poppy', 'Poppy', 'flower', ['meadow', 'tundra'], [10, 16], (b, c) => {
    const { r, H } = c, R = herb(c, 100, 0.35, 0.4), st = stage(c, ['spring', 'summer']);
    const P = c.sp.id === 'poppy' && hash2(c.seed, 1, 1) < 0.2 ? PETAL.orange : PETAL.red;
    rosette(b, c, 3, H * 0.3, R, 0.3, 0.25);
    const heads = stems(b, c, r.int(2, 3), H, H * 0.35, R, { bow: 0.3 });
    heads.forEach(([x, y], i) => {
      if (st === 'dry' || st === 'seed') { ball(b, x, y, 1.3, st === 'dry' ? DRY : [0x506048, 0x7a8a68, 0xa0b090], { f: OL }); b.set(x, y - 2, 0x3a3020, OL); return; }
      if (st === 'bud' || (i === 0 && heads.length > 2)) { b.set(x, y, R[2], OL); b.set(x + 1, y + 1, R[1], OL); return; } // a nodding bud
      const w = Math.max(2, H * 0.17);
      region(b, x - w - 1, y - w, x + w + 1, y + 1, (px, py) => {
        const dx = (px - x) / w, dy = (py - y) / (w * 0.75);
        if (dy > 0.5 || dx * dx + (dy + 0.1) * (dy + 0.1) > 1) return -1;
        if (Math.abs(dx) < 0.25 && dy > -0.2 && dy < 0.4) return 0x1a1010;
        return P[dx < -0.2 && dy < 0 ? 2 : dx > 0.45 || dy > 0.25 ? 0 : 1];
      }, OL);
    });
  });
  def('lavender', 'Lavender', 'flower', ['meadow'], [12, 18], (b, c) => {
    const { r, H } = c, G = c.season === 'winter' ? ramp(70, 0.1, 0.42) : ramp(100, 0.14, 0.5, 4, 0.1), st = stage(c, ['summer', 'autumn']);
    // a low silver-green mound, then a fan of bare stems, each ending in a narrow purple spike
    const W = H * 0.45, g = [0, -H * 0.15, W, H * 0.2];
    for (let k = 0; k < 5; k++) { const t = (k / 4) * 2 - 1; ball(b, t * W * 0.7, -H * 0.12 - (1 - Math.abs(t)) * 1.5, H * 0.15 + 0.5, G, { g, lump: 0.25, ph: k * 2.1, f: OL | LEAF }); }
    const n = Math.min(9, Math.floor(H * 0.7)) | 1;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1) * 2 - 1, x = Math.round(f * H * 0.65), top = -H * (1 - f * f * 0.3) * (i % 2 ? 0.86 : 1);
      const sl = Math.max(3, Math.round(H * 0.28));
      line(b, f * W * 0.3, -H * 0.22, x, top + sl, G[1]);
      if (st === 'bloom' || st === 'bud') {
        const P = st === 'bud' ? [0x4a4a6a, 0x6a6a8a, 0x8a8aa8] : c.season === 'autumn' ? [0x4a3870, 0x6a5a98, 0x8a7ab8] : [0x45237a, 0x7448b8, 0xa47ee0];
        for (let k = 0; k < sl; k++) { const y = Math.round(top) + k; b.set(x, y, P[k === 0 ? 2 : k % 3 === 2 ? 0 : 1], 0); } // no outline, so the sky shows between spikes
      } else b.set(x, top + sl - 1, 0x6a5a48, OL);
    }
  });
  def('bluebell', 'Bluebell', 'flower', ['forest'], [10, 16], (b, c) => {
    const { r, H } = c, R = herb(c, 120, 0.4, 0.36), st = stage(c, ['spring', 'summer']);
    for (let k = 0; k < 4; k++) { const s = k % 2 ? 1 : -1; lens(b, 0, 0, s * H * r.range(0.3, 0.5), -H * r.range(0.3, 0.6), H * 0.07 + 0.5, R, LEAF | OL, false); }
    const n = r.int(1, 2);
    for (let i = 0; i < n; i++) {
      const s = i ? -1 : 1, x0 = i ? -1 : 1, pts = curve(x0, 0, x0 + s * H * 0.35, -H * 0.9, s * H * 0.35);
      path(b, pts, R[1]);
      if (st !== 'bloom' && st !== 'bud') continue;
      const m = r.int(4, 6), P = st === 'bud' ? [0x3a4a8a, 0x5a6aa8, 0x6a7ab8] : PETAL.lilac.map((v, j) => mix(v, PETAL.blue[j], 0.55));
      for (let k = 0; k < m; k++) { // bells hang along one side of the arching stem
        const [px, py] = pts[Math.min(pts.length - 1, Math.round(pts.length * (0.45 + 0.55 * k / m)))];
        const bx = Math.floor(px) + s, by = Math.floor(py) + 1;
        b.set(bx, by, P[2], OL); b.set(bx + s, by, P[1], OL); b.set(bx, by + 1, P[1], OL); b.set(bx + s, by + 1, P[0], OL);
        if (st === 'bloom') b.set(bx + s * 2, by + 2, P[1], OL);
      }
    }
  });
  def('foxglove', 'Foxglove', 'flower', ['forest', 'meadow'], [18, 30], (b, c) => {
    const { r, H } = c, R = herb(c, 105, 0.35, 0.36), st = stage(c, ['spring', 'summer']);
    rosette(b, c, 5, H * 0.3, R, 0.15, 0.32);
    const P = r.chance(0.75) ? [0x7a2060, 0xc04a98, 0xf08ac8] : PETAL.white;
    const lean = r.range(-1, 1) * 2, pts = curve(0, 0, lean, -H, lean * 0.4);
    path(b, pts, R[1], OL);
    if (st === 'dry') { for (let k = Math.round(pts.length * 0.5); k < pts.length; k += 2) b.set(pts[k][0] + 1, pts[k][1], 0x5a4030, OL); return; }
    for (let k = Math.round(pts.length * 0.45); k < pts.length - 1; k += 2) {
      const [px, py] = pts[k], u = k / pts.length, s = (k >> 1) & 1 ? 1 : -1, big = u < 0.8;
      if (st === 'seed') { b.set(px + s, py + 1, R[0], OL); continue; }
      if (st === 'bud' || u > 0.88) { b.set(px + s, py, R[2], OL); continue; }
      b.set(px + s, py, P[1], OL); b.set(px + s, py + 1, P[0], OL); b.set(px + s * 2, py + 1, P[2], OL);
      if (big) { b.set(px + s * 2, py + 2, P[1], OL); b.set(px + s, py + 2, 0x4a1030, OL); }
    }
  });
  def('dandelion', 'Dandelion', 'flower', ['meadow', 'tundra'], [7, 12], (b, c) => {
    const { r, H } = c, R = herb(c, 100, 0.48, 0.38), st = stage(c, ['spring', 'summer']);
    for (let k = 0; k < 6; k++) { // jagged leaves, flat to the ground
      const s = k % 2 ? 1 : -1, l = H * r.range(0.5, 0.8), pts = curve(0, 0, s * l, -r.range(0, 2), 0);
      path(b, pts, R[1], LEAF | OL);
      pts.forEach(([x, y], j) => { if (j % 2 && j < pts.length - 1) b.set(x, y - 1, R[2], LEAF | OL); });
    }
    const n = r.int(1, 3);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 3, h = H * r.range(0.7, 1), pts = curve(0, 0, x, -h, x * 0.3);
      path(b, pts, R[2]);
      const [hx, hy] = pts[pts.length - 1];
      const puff = st === 'seed' || (st === 'bloom' && hash2(i, c.seed, 5) < 0.35);
      if (st === 'dry') continue;
      if (puff) { // the seed clock: a pale sphere of parachutes
        const pr = Math.max(2.6, H * 0.3);
        region(b, hx - pr - 1, hy - pr - 1, hx + pr + 1, hy + pr + 1, (px, py) => {
          const d = Math.hypot(px - hx, py - hy); if (d > pr) return -1;
          return d > pr - 1 ? (px < hx || py < hy ? 0xffffff : 0xc8ccd8) : d < 1 ? 0x9a9078 : 0xe4e6ee;
        }, OL);
      } else if (st === 'bud') { b.set(hx, hy, R[1], OL); b.set(hx, hy - 1, 0xf0c030, OL); }
      else { const w = Math.max(1.8, H * 0.2); region(b, hx - w - 1, hy - w, hx + w + 1, hy + 1, (px, py) => { const dx = (px - hx) / w, dy = (py - hy) / (w * 0.7); return dx * dx + dy * dy > 1.1 ? -1 : PETAL.yellow[dy < -0.2 || dx < -0.3 ? 2 : dy > 0.3 ? 0 : 1]; }, OL); }
    }
  });
  def('iris', 'Iris', 'flower', ['meadow', 'swamp'], [14, 22], (b, c) => {
    const { r, H } = c, R = herb(c, 125, 0.32, 0.38), st = stage(c, ['spring', 'summer']);
    const P = PETAL[r.pick(['purple', 'purple', 'blue', 'yellow'])];
    for (let k = 0; k < 5; k++) { const f = k / 4 * 2 - 1; lens(b, f * 1.5, 0, f * H * 0.38, -H * (0.8 - Math.abs(f) * 0.3), 0.85, R, LEAF | OL, false); }
    const heads = stems(b, c, r.int(1, 2), H, H * 0.15, R, { bow: 0.05 });
    for (const [x, y] of heads) {
      if (st === 'dry' || st === 'seed') { b.set(x, y, st === 'dry' ? 0x5a4030 : R[0], OL); b.set(x, y + 1, st === 'dry' ? 0x5a4030 : R[0], OL); continue; }
      if (st === 'bud') { b.set(x, y, P[1], OL); b.set(x, y - 1, P[2], OL); continue; }
      // standards up, falls hanging out and down, a yellow beard on each fall
      const px = [[0, -3, 2], [-1, -2, 2], [0, -2, 1], [1, -2, 1], [0, -1, 1], [-1, 0, 2], [1, 0, 1], [-2, 0, 2], [2, 0, 0], [-2, 1, 1], [2, 1, 0], [-2, 2, 0], [2, 2, 0], [0, 0, 0]];
      for (const [dx, dy, s] of px) b.set(x + dx, y + dy, P[s], OL);
      b.set(x - 1, y + 1, 0xf0c030, OL); b.set(x + 1, y + 1, 0xd8a020, OL);
    }
  });
  def('lupine', 'Lupine', 'flower', ['meadow', 'tundra'], [14, 24], (b, c) => {
    const { r, H } = c, R = herb(c, 110, 0.4, 0.38), st = stage(c, ['spring', 'summer']);
    for (let k = 0; k < 5; k++) { // palmate leaves: little stars on stalks
      const x = r.range(-H * 0.35, H * 0.35), y = -r.range(H * 0.08, H * 0.3);
      line(b, 0, 0, x, y, R[1]);
      for (let a = 0; a < 6; a++) { const th = a / 6 * TAU; line(b, x, y, x + Math.cos(th) * 1.6, y + Math.sin(th) * 1.1, R[a < 3 ? 1 : 2], LEAF | OL); }
    }
    const n = r.int(1, 3);
    for (let i = 0; i < n; i++) {
      const P = PETAL[r.pick(['purple', 'blue', 'pink', 'lilac', 'white'])], x = (i - (n - 1) / 2) * 3.5, h = H * (i === (n >> 1) ? 1 : r.range(0.75, 0.9));
      line(b, x * 0.5, 0, x, -h, R[1]);
      if (st === 'dry') continue;
      const L = Math.round(h * 0.55);
      for (let k = 0; k < L; k++) {
        const y = -h + k, w = Math.round(lerp(0, Math.max(1, h * 0.1), Math.min(1, k / L * 1.5))), cc = st === 'bloom' ? (k / L < 0.15 ? [R[2], R[2], R[3]] : P) : st === 'bud' ? [R[1], R[2], R[3]] : [R[0], R[1], R[1]];
        for (let dx = -w; dx <= w; dx++) b.set(x + dx, y, cc[(k & 1) ? (dx < 0 ? 2 : 1) : dx > 0 ? 0 : 1], OL);
      }
    }
  });
  def('hydrangea', 'Hydrangea', 'flower', ['forest', 'meadow'], [14, 22], (b, c) => {
    const { r, H } = c, W = H * 0.75, L = herb(c, 120, 0.38, 0.32), st = stage(c, ['summer', 'autumn']);
    const P = r.pick([[0x3a4aa0, 0x6a8ae0, 0xa8c4ff, 0xd8e4ff], [0xa04a8a, 0xe080c0, 0xf8b0e0, 0xffe0f0], [0x6a4aa0, 0x9a7ad8, 0xc8b0f8, 0xece0ff]]);
    for (let k = 0; k < 7; k++) { const a = -PI / 2 + (k / 6 * 2 - 1) * 1; line(b, 0, 0, Math.cos(a) * W * 0.8, -H * 0.1 + Math.sin(a) * H * 0.6, 0x4a3a28); }
    if (st !== 'dry') { const g = [0, -H * 0.4, W, H * 0.4]; for (let k = 0; k < 8; k++) { const t = r.range(-1, 1); ball(b, t * W, -H * 0.3 - r() * H * 0.3 * (1 - Math.abs(t) * 0.4), H * 0.2, L, { g, rim: true, lump: 0.25, ph: r.range(0, 9) }); } }
    const heads = [];
    for (let k = 0; k < r.int(3, 5); k++) heads.push([r.range(-W * 0.75, W * 0.75), -H * r.range(0.55, 0.85)]);
    heads.sort((p, q) => p[1] - q[1]).forEach(([x, y]) => {
      const C = st === 'bloom' ? (c.season === 'autumn' ? P.map(v => mix(v, 0x8a6a50, 0.4)) : P) : st === 'bud' ? [L[1], L[2], L[3], L[3]] : DRY;
      ball(b, x, y, Math.max(2, H * 0.16), C, { lump: 0.2, k: 7, ph: x });
      if (H > 15 && st === 'bloom') for (let k = 0; k < 3; k++) { const dx = Math.round(r.range(-1.5, 1)), dy = Math.round(r.range(-1.5, 1)); b.set(x + dx, y + dy, C[3]); b.set(x + dx + 1, y + dy, C[2]); }
    });
  });
  def('cosmos', 'Cosmos', 'flower', ['meadow'], [14, 24], (b, c) => {
    const { r, H } = c, R = herb(c, 100, 0.45, 0.42), st = stage(c, ['summer', 'autumn']);
    const heads = stems(b, c, r.int(3, 5), H, H * 0.45, R, { bow: 0.3 });
    for (let k = 0; k < 10; k++) { // feathery threadlike leaves
      const x = r.range(-H * 0.3, H * 0.3), y = -r.range(H * 0.15, H * 0.6), a = r.range(-PI, 0);
      line(b, x, y, x + Math.cos(a) * 2.5, y + Math.sin(a) * 2, R[r.chance(0.5) ? 1 : 2], LEAF);
    }
    heads.forEach(([x, y], i) => {
      const P = PETAL[['pink', 'magenta', 'white', 'pink'][Math.floor(hash2(i, c.seed, 2) * 4)]];
      if (st === 'dry' || st === 'seed') { b.set(x, y, 0x5a4030, OL); b.set(x, y - 1, 0x3a2a20, OL); return; }
      if (st === 'bud') { b.set(x, y, R[1], OL); b.set(x, y - 1, P[1], OL); return; }
      radial(b, x, y, Math.max(2, H * 0.13), P, [0xc89010, 0xf8d040], 8, { round: 0.4, rc: 0.7, ph: hash2(i, c.seed, 4) });
    });
  });
  def('forgetmenot', 'Forget-me-not', 'flower', ['forest', 'swamp'], [6, 10], (b, c) => {
    const { r, H } = c, R = herb(c, 110, 0.4, 0.4), st = stage(c, ['spring', 'summer']);
    rosette(b, c, 4, H * 0.4, R, 0.3, 0.35);
    const heads = stems(b, c, r.int(3, 4), H, H * 0.5, R, { bow: 0.3 });
    for (const [x, y] of heads) {
      if (st !== 'bloom') { b.set(x, y, st === 'dry' ? 0x5a4030 : R[2], OL); continue; }
      for (const [dx, dy] of [[0, 0], [-2, 1], [2, 1], [-1, -1], [1, 2]]) { b.set(x + dx, y + dy, 0x5a8ae0, OL); b.set(x + dx + 1, y + dy, 0x3a5ab0, OL); }
      b.set(x, y, 0xf8e070, OL);
    }
  });
  def('crocus', 'Crocus', 'flower', ['meadow', 'forest', 'tundra'], [6, 9], (b, c) => {
    const { r, H } = c, R = herb(c, 110, 0.38, 0.38), st = stage(c, ['spring', 'summer']);
    const n = r.int(2, 4);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 3 + r.range(-0.5, 0.5), P = PETAL[r.pick(['purple', 'lilac', 'yellow', 'white'])];
      line(b, x - 1, 0, x - 2, -H * 0.7, R[2], LEAF | OL); line(b, x + 1, 0, x + 2, -H * 0.6, R[1], LEAF | OL);
      line(b, x, 0, x, -H * 0.4, R[2], OL);
      if (st !== 'bloom') continue;
      const y0 = Math.round(-H), x0 = Math.round(x); // a goblet: two petal tips, a full cup, a narrow base
      for (let y = y0; y <= y0 + 3; y++) for (let dx = -1; dx <= 1; dx++) {
        if ((y === y0 && dx === 0) || (y === y0 + 3 && dx !== 0)) continue;
        b.set(x0 + dx, y, P[dx < 0 ? 2 : dx > 0 ? 0 : 1], OL);
      }
      if (P === PETAL.purple || P === PETAL.lilac) b.set(x0, y0 + 1, 0xf0a020, OL);
    }
  });

  // == cacti and succulents ==
  const CACTUS = ctx => ramp(118 + (ctx.season === 'winter' ? 10 : 0), 0.32, 0.36, 4, 0.1);
  // ribs: alternate dark lines on a cylinder at fixed angles, so they bunch toward the edges like real ribs
  const ribs = (n, ph = 0) => (j, w, hw, o) => { const a = Math.asin(clamp(o, -1, 1)) / PI * n + ph; return Math.abs(a - Math.round(a)) < 0.16 && hw > 1.6 ? -1 : 0; };
  def('saguaro', 'Saguaro', 'succulent', ['desert'], [36, 64], (b, c) => {
    const { r, H } = c, R = CACTUS(c), W = Math.max(2.5, H * 0.07);
    const n = r.int(1, 4), arms = [];
    for (let i = 0; i < n; i++) arms.push({ s: i % 2 ? 1 : -1, y: H * r.range(0.3, 0.55), up: H * r.range(0.18, 0.35), out: W * r.range(2.2, 3.2) });
    for (const a of arms) { // each arm: out from the trunk through a round elbow, then straight up
      const w = W * 0.72, x1 = a.s * a.out, yb = -a.y, er = a.out - W * 0.3;
      let px = a.s * W * 0.3, py = yb;
      for (let k = 1; k <= 8; k++) {
        const ang = PI / 2 * k / 8, nx = a.s * (W * 0.3 + er * Math.sin(ang)), ny = yb - er * (1 - Math.cos(ang)) * 0.8;
        cap(b, px, py, nx, ny, w, w, { ramp: R }); px = nx; py = ny;
      }
      b.ox += Math.round(x1); b.oy += Math.round(py);
      body(b, Math.round(a.up), t => w * (t > 0.85 ? Math.sqrt(Math.max(0, 1 - ((t - 0.85) / 0.15) ** 2)) : 1), R, OL, ribs(3));
      b.ox -= Math.round(x1); b.oy -= Math.round(py);
      a.top = py - a.up;
    }
    body(b, Math.round(H), t => W * (t > 0.9 ? Math.sqrt(Math.max(0, 1 - ((t - 0.9) / 0.1) ** 2)) : 1), R, OL, ribs(4));
    const tops = [[0, -H], ...arms.map(a => [a.s * a.out, a.top])];
    if (c.season === 'spring') for (const [x, y] of tops) for (const dx of [-1, 1]) { b.set(x + dx, y, 0xf4f0e0); b.set(x + dx, y - 1, 0xffffff); b.set(x, y - 1, 0xf0c040); }
    if (c.season === 'summer') for (const [x, y] of tops) { b.set(x - 1, y, 0xc02040); b.set(x + 1, y - 1, 0xa01830); }
  });
  def('pricklypear', 'Prickly pear', 'succulent', ['desert', 'beach'], [10, 20], (b, c) => {
    const { r, H } = c, R = ramp(95, 0.35, 0.42, 4, 0.1), pads = [];
    const pw = H * 0.24, ph = H * 0.32;
    const add = (x, y, a, d) => {
      pads.push([x, y, a]);
      if (d >= 2) return;
      const k = d === 0 ? r.int(2, 3) : r.int(0, 2);
      for (let i = 0; i < k; i++) { const aa = a + (i / Math.max(1, k - 1) * 2 - 1) * 0.7 + r.range(-0.2, 0.2); add(x + Math.sin(aa) * ph * 1.6, y - Math.cos(aa) * ph * 1.6, aa, d + 1); }
    };
    add(0, -ph, r.range(-0.15, 0.15), 0);
    pads.sort((p, q) => q[1] - p[1]);
    for (const [x, y, a] of pads) {
      region(b, x - ph - 1, y - ph - 1, x + ph + 1, y + ph + 1, (px, py) => {
        const dx = px - x, dy = py - y, u = (dx * Math.cos(a) + dy * Math.sin(a)) / pw, v = (-dx * Math.sin(a) + dy * Math.cos(a)) / ph;
        const d = u * u + v * v; if (d > 1) return -1;
        if (((Math.floor(px) + Math.floor(py) * 2) % 5 === 0) && d < 0.7) return 0xe8e0a0; // areoles in a lattice
        return R[lev(-u * 0.5 - v * 0.35 + 0.3 - d * 0.2, 4)];
      }, OL | SNOWY);
    }
    const tops = pads.filter((p, i) => i > 0).map(([x, y, a]) => [x + Math.sin(a) * ph, y - Math.cos(a) * ph]);
    if (c.season === 'spring') tops.forEach(([x, y]) => { ball(b, x, y - 1, 1.6, PETAL.yellow, { f: OL }); b.set(x, y - 1, 0xc08418); });
    if (c.season === 'summer' || c.season === 'autumn') tops.forEach(([x, y], i) => { if (i % 2 === 0) ball(b, x, y - 0.5, 1.3, [0x5a0a30, 0xa01850, 0xe04880], { sq: 1.3, f: OL }); });
  });
  def('barrel', 'Barrel cactus', 'succulent', ['desert'], [8, 16], (b, c) => {
    const { r, H } = c, R = ramp(110, 0.34, 0.38, 4, 0.1), W = H * r.range(0.45, 0.55);
    body(b, Math.round(H), t => W * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.42) / 0.58, 2))) * 1.02 + (t < 0.3 ? 0.5 : 0), R, OL | SNOWY, (j, w, hw, o) => {
      const a = Math.asin(clamp(o, -1, 1)) / PI * 7;
      if (Math.abs(a - Math.round(a)) < 0.17 && hw > 1.5) return (j % 3 === 0) ? { c: 0xd8a040 } : -1;
      return 0;
    });
    if (c.season === 'spring' || c.season === 'summer') { const y = -H, P = PETAL.yellow; for (let dx = -2; dx <= 2; dx++) b.set(dx, y + Math.abs(dx) * 0.5, P[(dx + 2) % 3]); b.set(0, y - 1, P[2]); }
  });
  def('agave', 'Agave', 'succulent', ['desert'], [10, 18], (b, c) => {
    const { r, H } = c, R = [0x3a5a64, 0x5a8088, 0x88aab0, 0xb8d0d0], n = r.int(9, 13), lv = [];
    for (let i = 0; i < n; i++) { const f = i / (n - 1) * 2 - 1; lv.push([-PI / 2 + f * 1.45 + r.range(-0.08, 0.08), H * (1 - Math.abs(f) * 0.45) * r.range(0.8, 1), r()]); }
    lv.sort((p, q) => p[2] - q[2]);
    for (const [a, l] of lv) {
      const ex = Math.cos(a) * l * 1.1, ey = Math.sin(a) * l;
      lens(b, 0, 0, ex, ey, Math.max(1, l * 0.14), R, OL | SNOWY, true);
      b.set(ex, ey, 0x2a1a14, OL);
    }
    if (c.r.chance(0.15) && c.season === 'summer') { line(b, 0, -H, 0, -H * 2, 0x6a7a40, OL); for (let k = 0; k < 4; k++) ball(b, (k % 2 ? 2 : -2), -H * (1.4 + k * 0.15), 1.4, PETAL.yellow, { f: OL }); }
  });
  def('aloe', 'Aloe', 'succulent', ['desert', 'beach'], [12, 20], (b, c) => {
    const { r, H } = c, R = ramp(128, 0.24, 0.42, 4, 0.1), n = r.int(6, 8), lv = [];
    for (let i = 0; i < n; i++) { const f = i / (n - 1) * 2 - 1; lv.push([-PI / 2 + f * 1.25 + r.range(-0.1, 0.1), H * 0.62 * (1 - Math.abs(f) * 0.3) * r.range(0.85, 1.05), Math.abs(f) + r() * 0.3]); }
    lv.sort((p, q) => q[2] - p[2]); // outer leaves first, the upright ones in front
    for (const [a, l] of lv) {
      // a fat tapering wedge that arches outward, lit on its upper side, with pale spots and toothed edges
      const w0 = Math.max(1.6, l * 0.2), ex = Math.cos(a) * l, ey = Math.sin(a) * l, bend = Math.cos(a) * l * 0.25;
      const n2 = Math.ceil(l);
      for (let k = 0; k <= n2; k++) {
        const u = k / n2, x = ex * u + bend * u * u * 0.6, y = ey * u + Math.abs(bend) * u * u * 0.5, w = w0 * (1 - u) + 0.4;
        const nx = -Math.sin(a), ny = Math.cos(a);
        for (let v = -w; v <= w; v += 0.5) {
          const lit = v * (nx * LX + ny * LY) > 0, s = Math.abs(v) > w - 0.6 ? (lit ? 2 : 0) : lit ? 2 : 1;
          b.set(x + nx * v, y + ny * v, R[s], OL | SNOWY);
        }
        if (k % 3 === 2 && u < 0.8 && w > 1.2) b.set(x + nx * w * 0.3, y + ny * w * 0.3, R[3], OL | SNOWY);
        if (k % 3 === 0 && u > 0.1 && u < 0.85) b.set(x + nx * (w + 0.7), y + ny * (w + 0.7), R[3], OL);
      }
      b.set(ex + bend * 0.6, ey + Math.abs(bend) * 0.5, 0x8a4a3a, OL);
    }
    if (c.season === 'winter' || c.season === 'spring') { // the flower spike: a torch of hanging tubes
      const x = r.range(-1, 1);
      line(b, 0, -2, x, -H, 0x6a7a50, OL);
      for (let k = 0; k < Math.round(H * 0.25); k++) { const y = -H + k; b.set(x - 1, y, k < 2 ? 0xf0c040 : 0xe86a20, OL); b.set(x + 1, y, k < 2 ? 0xd8a020 : 0xc04a18, OL); }
    }
  });
  def('organpipe', 'Organ pipe', 'succulent', ['desert'], [28, 48], (b, c) => {
    const { r, H } = c, R = CACTUS(c), n = r.int(5, 8), cols = [];
    for (let i = 0; i < n; i++) { const f = i / (n - 1) * 2 - 1; cols.push({ f, h: H * (1 - Math.abs(f) * 0.4) * r.range(0.75, 1), z: 1 - Math.abs(f) + r() * 0.3 }); }
    cols.sort((p, q) => p.z - q.z);
    const W = Math.max(1.6, H * 0.05);
    for (const cl of cols) {
      const x0 = cl.f * 2, x1 = cl.f * H * 0.32, k = Math.round(x1);
      b.ox += Math.round(x0);
      body(b, Math.round(cl.h), t => W * (t > 0.92 ? 0.7 : 1), R, OL | SNOWY, ribs(3), t => (x1 - x0) * Math.sin(Math.min(1, t * 2.2) * PI / 2));
      b.ox -= Math.round(x0);
    }
  });
  def('echeveria', 'Echeveria', 'succulent', ['desert', 'beach'], [4, 8], (b, c) => {
    const { r, H } = c, R = [0x4a6a74, 0x7aa0a4, 0xa8c8c4, 0xd0e4dc], tip = 0xd07a90, W = H * 1.3;
    for (let ring = 2; ring >= 0; ring--) {
      const m = 5 + ring * 2, rr = W * (0.4 + ring * 0.3);
      for (let i = 0; i < m; i++) {
        const a = -PI + (i + 0.5) / m * PI, ex = Math.cos(a) * rr, ey = -H * 0.4 + Math.sin(a) * rr * 0.6 - (2 - ring) * H * 0.15;
        lens(b, 0, -H * 0.2, ex, ey, Math.max(0.9, rr * 0.3), R, OL | SNOWY, false);
        if (ring > 0) b.set(ex, ey, tip, OL);
      }
    }
  });
  // ==== end of species ====

  // ---- the library ----
  const BY = {};
  // plants of only warm biomes never see snow
  SPECIES.forEach(s => { BY[s.id] = s; s.warm = !s.biomes.some(b => ['forest', 'taiga', 'meadow', 'tundra'].includes(b)); });
  const cache = new Map();
  function paint(id, seed = 1, opts = {}) {
    const sp = BY[id];
    if (!sp) throw new Error('Flora: no species ' + id);
    const season = opts.season || 'summer', size = opts.size ? Math.round(opts.size) : 0;
    const key = id + '|' + seed + '|' + season + '|' + size;
    if (cache.has(key)) return cache.get(key);
    const base = hashStr(id) ^ Math.imul((seed | 0) + 1, 2654435761);
    const H = size || Math.round(lerp(sp.h[0], sp.h[1], rng(base ^ 0x51ed)()));
    const w = Math.ceil(H * 2.4) + 24, h = Math.ceil(H * 1.3) + 16;
    const b = new Buf(w, h, w >> 1, h - 8);
    const ctx = { r: rng(base), H, season, seed: base >>> 0, sp };
    sp.draw(b, ctx);
    if (season === 'winter' && !sp.warm) snow(b);
    despeckle(b);
    outline(b);
    const out = crop(b);
    cache.set(key, out);
    if (cache.size > 900) cache.delete(cache.keys().next().value); // forget the oldest
    return out;
  }
  const colors = new Map();
  function color(id, season = 'summer') {
    const key = id + '|' + season;
    if (!colors.has(key)) {
      const p = paint(id, 1, { season, size: Math.round((BY[id].h[0] + BY[id].h[1]) / 2) });
      colors.set(key, '#' + (BY[id].key ? BY[id].key(season) : p.avg).toString(16).padStart(6, '0'));
    }
    return colors.get(key);
  }
  window.Flora = {
    species: SPECIES.map(({ id, name, kind, biomes, h }) => ({ id, name, kind, biomes, h })),
    paint: (id, seed, opts) => { const p = paint(id, seed, opts); return { canvas: p.canvas, w: p.w, h: p.h, ax: p.ax, ay: p.ay }; },
    color,
  };

  // =====================================================================================
  // the demo: a gallery by kind, a season and a seed, a large view with variants, and biome scenes
  // =====================================================================================
  // a tiny 3x5 font for labels drawn inside the art
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', '-': '000000111000000', '.': '000000000000010', ' ': '000000000000000',
  };
  function text(g, s, x, y, col) {
    g.fillStyle = col;
    for (const ch of s.toUpperCase()) { const f = FONT[ch] || FONT[' ']; for (let i = 0; i < 15; i++) if (f[i] === '1') g.fillRect(x + i % 3, y + (i / 3 | 0), 1, 1); x += 4; }
  }
  const textW = s => s.length * 4 - 1;
  const LABEL = { willow: 'Willow', cypress: 'Cypress', reeds: 'Cattails', ivy: 'Ivy', toadstool: 'Fly agaric', pricklypear: 'Prickly pear', barrel: 'Barrel', snag: 'Snag', cherry: 'Cherry' };
  const SKY = { spring: '#a3c6cf', summer: '#8db6d3', autumn: '#c4ae94', winter: '#b2bfd0' };
  const TURF = { spring: ['#6a9e48', '#4f7d38'], summer: ['#5b8c3c', '#41692e'], autumn: ['#8c7c42', '#6a5c32'], winter: ['#eef3fa', '#b9c6d8'] };
  const SOIL = '#2a2030';
  const TABS = { Trees: ['tree'], 'Shrubs & ground': ['shrub', 'ground'], Flowers: ['flower'], 'Cacti & succulents': ['succulent'] };
  const BIOMES = ['forest', 'taiga', 'meadow', 'desert', 'swamp', 'jungle', 'tundra', 'beach'];

  Kit.register('plants', { title: 'A plant library: species, seasons, scenes', fit: 'prebake' }, host => {
    const st = { tab: 'Trees', season: 'summer', seed: 7, sel: null, biome: 'forest' };
    const wrap = Kit.el('div');
    host.appendChild(wrap);
    let c = null, items = [], key = '';
    // the art is sized from the host's width so each tab gets a whole-number scale that reads on a phone
    // the canvas is always at 2x; small plants are drawn 2x again inside it, so labels stay small
    const scaleFor = () => 2;
    const zoomFor = () => st.tab === 'Trees' || st.tab === 'Scene' ? 1 : 2;
    const ensure = (W, H) => {
      if (c && c.w === W && c.h === H) return;
      wrap.textContent = '';
      c = Kit.canvas(wrap, W, H);
      c.cv.style.cursor = 'pointer';
      c.cv.addEventListener('click', tap);
    };
    const artW = () => Math.floor(((wrap.clientWidth || 640) - 2) / scaleFor());

    function shelf(list, W, top) {
      // pack plants into rows along shelves: a turf line, then a soil band with each name and its far-zoom color
      let x = 4, rows = [], row = [];
      const z = zoomFor();
      for (const it of list) {
        const sw = Math.max(it.p.w * z, textW(it.label) + 6) + 6;
        if (x + sw > W - 2 && row.length) { rows.push(row); row = []; x = 4; }
        row.push(Object.assign(it, { x, sw })); x += sw;
      }
      if (row.length) rows.push(row);
      let y = top;
      for (const rw of rows) {
        const up = Math.max(...rw.map(it => it.p.ay * z)) + 4, base = y + up;
        for (const it of rw) {
          const cx = it.x + (it.sw - 6) / 2, px = Math.round(cx - it.p.ax * z);
          it.rect = [it.x, y, it.sw, up + 10];
          it.px = px; it.py = base - it.p.ay * z; it.z = z;
          it.lx = Math.round(cx - (textW(it.label) + 5) / 2); it.ly = base + 4;
        }
        rw.base = base; rw.y = y;
        y = base + 12;
      }
      return { rows, h: y };
    }

    function gallery() {
      const W = artW(), size = W >= 300 ? 60 : 46, kinds = TABS[st.tab];
      const list = SPECIES.filter(s => kinds.includes(s.kind)).map(s => ({
        s, label: LABEL[s.id] || s.name, p: paint(s.id, st.seed, { season: st.season, size: s.kind === 'tree' ? Math.min(size, s.h[1]) : 0 }),
      }));
      // lay out first, then size the canvas to fit
      const lay = shelf(list, W, 4);
      ensure(W, lay.h + 2);
      const g = c.g;
      g.fillStyle = SKY[st.season]; g.fillRect(0, 0, c.w, c.h);
      for (const rw of lay.rows) {
        g.fillStyle = TURF[st.season][0]; g.fillRect(0, rw.base, c.w, 1);
        g.fillStyle = TURF[st.season][1]; g.fillRect(0, rw.base + 1, c.w, 1);
        g.fillStyle = SOIL; g.fillRect(0, rw.base + 2, c.w, 9);
        for (const it of rw) {
          g.drawImage(it.p.canvas, it.px, it.py, it.p.w * it.z, it.p.h * it.z);
          g.fillStyle = color(it.s.id, st.season); g.fillRect(it.lx, it.ly, 3, 5);
          text(g, it.label, it.lx + 5, it.ly, '#e9e4d8');
        }
      }
      items = list;
    }

    function detail() {
      const s = BY[st.sel], W = artW();
      const big = paint(s.id, st.seed, { season: st.season, size: s.h[1] });
      const vars = [1, 2, 3, 4].map(k => ({ p: paint(s.id, st.seed + k * 101, { season: st.season }) }));
      const seas = ['spring', 'summer', 'autumn', 'winter'].map(se => ({ p: paint(s.id, st.seed, { season: se, size: Math.round((s.h[0] + s.h[1]) / 2) }), se }));
      const k = clamp(Math.floor(Math.min((W * 0.5) / big.w, 190 / big.h)), 1, 6);
      const zs = clamp(Math.floor(Math.min(60 / Math.max(...vars.map(v => v.p.h)), (W - 12) / 4 / Math.max(...vars.concat(seas).map(v => v.p.w + 3)))), 1, 3);
      const wide = W >= big.w * k + 120;
      const bw = big.w * k + 12, bh = big.ay * k + 18;
      const rowH = list => Math.max(...list.map(v => v.p.ay)) * zs + 6;
      const vx = wide ? bw + 4 : 4, vw = W - vx - 4;
      const h1 = rowH(vars), h2 = rowH(seas);
      const H = wide ? Math.max(bh + 14, 12 + h1 + 14 + h2 + 14) : bh + 14 + h1 + 14 + h2 + 14;
      ensure(W, Math.round(H));
      const g = c.g;
      g.fillStyle = SKY[st.season]; g.fillRect(0, 0, c.w, c.h);
      text(g, s.name, 4, 3, '#2a2030');
      const gy = 10 + big.ay * k;
      g.fillStyle = TURF[st.season][0]; g.fillRect(0, gy, wide ? bw : c.w, 1);
      g.fillStyle = SOIL; g.fillRect(0, gy + 1, wide ? bw : c.w, 3);
      g.drawImage(big.canvas, Math.round(bw / 2 - big.ax * k), gy - big.ay * k, big.w * k, big.h * k);
      // seed variants, then the same plant through the year
      const strip = (list, y0, title, labels) => {
        text(g, title, vx, y0, '#2a2030');
        const base = y0 + 8 + Math.max(...list.map(v => v.p.ay)) * zs;
        g.fillStyle = TURF[st.season][0]; g.fillRect(vx - 4, base, c.w - vx + 4, 1);
        g.fillStyle = SOIL; g.fillRect(vx - 4, base + 1, c.w - vx + 4, 3);
        const step = vw / list.length;
        list.forEach((v, i) => {
          const cx = vx + step * (i + 0.5);
          g.drawImage(v.p.canvas, Math.round(cx - v.p.ax * zs), base - v.p.ay * zs, v.p.w * zs, v.p.h * zs);
          if (labels) text(g, labels[i], Math.round(cx - textW(labels[i]) / 2), base + 6, '#2a2030');
        });
        return base + (labels ? 12 : 6);
      };
      const y1 = wide ? 3 : bh + 8;
      const y2 = strip(vars, y1, 'seeds', null) + 4;
      strip(seas, y2, 'seasons', ['SPR', 'SUM', 'AUT', 'WIN']);
      note.textContent = s.name + ': ' + s.kind + ', ' + s.biomes.join(', ') + ', ' + s.h[0] + ' to ' + s.h[1] + ' px tall. Tap the picture to go back.';
    }

    // a biome scene: plants scattered in depth rows, far ones smaller and tinted toward the sky
    const SCENE_GROUND = {
      forest: ['#3f6a30', '#33572a'], taiga: ['#3c5a3e', '#2f4a34'], meadow: ['#6a9a44', '#5a8a3a'], desert: ['#d8b878', '#c8a468'],
      swamp: ['#4a5a30', '#3c4a28'], jungle: ['#2f6a30', '#245a28'], tundra: ['#8a9a7a', '#7a8a6c'], beach: ['#e4cf98', '#d8c088'],
    };
    function scene() {
      const W = artW(), H = clamp(Math.round(W * 0.55), 110, 200), b = st.biome, se = st.season;
      ensure(W, H);
      const g = c.g, r = rng(hashStr(b) ^ Math.imul(st.seed + 3, 2654435761));
      const sky = { spring: ['#a8d0e0', '#c8e4ec'], summer: ['#7ab4dc', '#a8d4ec'], autumn: ['#d8b890', '#ecd4b0'], winter: ['#a8b8cc', '#d0dae6'] }[se];
      const hz = Math.round(H * 0.42);
      for (let k = 0; k < 4; k++) { g.fillStyle = mixHex(sky[0], sky[1], k / 3); g.fillRect(0, Math.round(hz * k / 4), W, Math.ceil(hz / 4) + 1); }
      // far hills, then the sea for a beach
      const hill = mixHex(sky[0], '#4a6a5a', b === 'desert' || b === 'beach' ? 0.25 : 0.45);
      g.fillStyle = hill;
      for (let x = 0; x < W; x++) { const h = Math.round(6 + 5 * Math.sin(x * 0.03 + st.seed) + 3 * Math.sin(x * 0.081 + st.seed * 2)); g.fillRect(x, hz - h, 1, h); }
      const snowy = se === 'winter' && b !== 'desert' && b !== 'jungle' && b !== 'beach';
      const gr = snowy ? ['#e8eef6', '#d4deea'] : se === 'autumn' && (b === 'meadow' || b === 'forest') ? ['#8a7a40', '#7a6a38'] : SCENE_GROUND[b];
      for (let y = hz; y < H; y++) { g.fillStyle = Math.floor(Math.sqrt((y - hz) / (H - hz)) * 9) % 2 ? gr[1] : gr[0]; g.fillRect(0, y, W, 1); } // bands that widen toward us
      if (b === 'beach') { g.fillStyle = '#2f8ac0'; g.fillRect(0, hz, W, 6); g.fillStyle = '#6fc8de'; g.fillRect(0, hz + 6, W, 1); g.fillStyle = '#f4f1ea'; for (let x = 0; x < W; x += 9) g.fillRect(x + (st.seed % 5), hz + 7, 4, 1); }
      const pools = [];
      if (b === 'swamp') for (let k = 0; k < 3; k++) {
        const px = r.range(0.1, 0.9) * W, py = r.range(hz + 12, H - 12), rx = r.range(18, 34), ry = rx * 0.28;
        pools.push([px, py, rx, ry]);
        for (let y = -ry; y <= ry; y++) { const hw = rx * Math.sqrt(1 - (y / ry) ** 2); g.fillStyle = se === 'winter' ? '#c8d8e8' : y < -ry + 2 ? '#3a5a50' : '#2d4a40'; g.fillRect(Math.round(px - hw), Math.round(py + y), Math.round(hw * 2), 1); }
      }
      // what grows here, weighted by kind
      const here = SPECIES.filter(s => s.biomes.includes(b));
      // trees by a density per biome; the rest picks a kind first, then a species of that kind
      const trees = here.filter(s => s.kind === 'tree'), small = here.filter(s => s.kind !== 'tree');
      const nt = Math.round(W / 40 * { forest: 3, taiga: 3, jungle: 3.4, meadow: 0.5, desert: 0.3, swamp: 1, tundra: 0.4, beach: 0.5 }[b]);
      const wt = { shrub: 0.2, ground: 0.35, flower: 0.35, succulent: 0.4 };
      const kinds = [...new Set(small.map(s => s.kind))], tot = kinds.reduce((a, k) => a + wt[k], 0);
      const pick = i => {
        if (i < nt && trees.length) return r.pick(trees);
        let t = r() * tot, k = kinds[0]; for (const q of kinds) { t -= wt[q]; if (t <= 0) { k = q; break; } }
        return r.pick(small.filter(s => s.kind === k));
      };
      const n = nt + Math.round(W * (H - hz) / 480), list = [];
      for (let i = 0; i < n; i++) {
        let s = pick(i), x = r.range(-10, W + 10), y = r.range(hz + 6, H + 4);
        if (s.id === 'lilypad') { if (!pools.length) continue; const p = r.pick(pools); x = p[0] + r.range(-0.6, 0.6) * p[2]; y = p[1] + r.range(-0.4, 0.4) * p[3]; }
        else if (pools.some(p => ((x - p[0]) / p[2]) ** 2 + ((y - p[1]) / p[3]) ** 2 < 1.2)) continue;
        const z = (y - hz) / (H - hz), sc = lerp(0.45, 1.05, z);
        if (s.kind !== 'tree' && s.h[1] < 16 && z < 0.35) continue; // small things vanish in the distance
        const base = lerp(s.h[0], s.h[1], r()), size = Math.max(4, Math.round(Math.min(base * sc * (s.kind === 'tree' ? W / 380 : 1), H * 0.8)));
        list.push({ s, x, y: Math.round(y), z, size, seed: st.seed * 31 + i });
      }
      list.sort((p, q) => p.y - q.y);
      const tint = document.createElement('canvas'), tg = tint.getContext('2d');
      for (const it of list) {
        const p = paint(it.s.id, it.seed, { season: se, size: it.size });
        const fade = (1 - it.z) * 0.4;
        if (fade > 0.05) {
          tint.width = p.w; tint.height = p.h;
          tg.globalCompositeOperation = 'source-over'; tg.drawImage(p.canvas, 0, 0);
          tg.globalCompositeOperation = 'source-atop'; tg.globalAlpha = fade; tg.fillStyle = sky[1]; tg.fillRect(0, 0, p.w, p.h); tg.globalAlpha = 1;
          g.drawImage(tint, Math.round(it.x - p.ax), it.y - p.ay);
        } else g.drawImage(p.canvas, Math.round(it.x - p.ax), it.y - p.ay);
      }
      note.textContent = here.length + ' species grow in the ' + b + ': ' + here.map(s => s.name.toLowerCase()).join(', ') + '.';
    }
    const mixHex = (a, b, t) => '#' + mix(hexC(a), hexC(b), t).toString(16).padStart(6, '0');

    function draw() {
      if (st.tab === 'Scene') scene();
      else if (st.sel) detail();
      else { gallery(); note.textContent = 'Tap a plant to see it large, with seed variants and its four seasons. The swatch by each name is Flora.color, its color from far away.'; }
      biomeBar.row.style.display = st.tab === 'Scene' ? '' : 'none';
    }
    function tap(e) {
      if (st.tab === 'Scene') return;
      if (st.sel) { st.sel = null; draw(); return; }
      const [x, y] = c.at(e);
      const it = items.find(it => it.rect && x >= it.rect[0] && x < it.rect[0] + it.rect[2] && y >= it.rect[1] && y < it.rect[1] + it.rect[3]);
      if (it) { st.sel = it.s.id; draw(); }
    }

    const b1 = Kit.bar(host);
    b1.tabs([...Object.keys(TABS), 'Scene'], v => { st.tab = v; st.sel = null; draw(); }, st.tab);
    const b2 = Kit.bar(host);
    b2.tabs(['spring', 'summer', 'autumn', 'winter'], v => { st.season = v; draw(); }, st.season);
    b2.seed(st.seed, s => { st.seed = s; draw(); });
    const biomeBar = Kit.bar(host);
    biomeBar.tabs(BIOMES, v => { st.biome = v; draw(); }, st.biome);
    const note = Kit.bar(host).note('');
    let lastW = 0;
    if (window.ResizeObserver) new ResizeObserver(() => { const w = wrap.clientWidth; if (Math.abs(w - lastW) > 8) { lastW = w; draw(); } }).observe(wrap);
    lastW = wrap.clientWidth;
    draw();
  });
})();
