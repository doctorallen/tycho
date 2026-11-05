// fx.js: effect demos for the research page.
// palette-cycle, doom-fire, falling-sand, lights, water, weather, day-night. Each says how it would run in Tycho.
'use strict';
(() => {
  const { RGB, PAL, Pix } = Kit;
  const W = 192, H = 108;

  // ---- painting helpers ----
  function stamp(dst, layer, oc, ox = 0, oy = 0) {
    const { w, h } = layer;
    if (oc != null) for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (layer.get(x, y) >= 0) continue;
      if (layer.get(x - 1, y) >= 0 || layer.get(x + 1, y) >= 0 || layer.get(x, y - 1) >= 0 || layer.get(x, y + 1) >= 0) dst.set(ox + x, oy + y, oc);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = layer.d[y * w + x]; if (v >= 0) dst.set(ox + x, oy + y, v); }
  }
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
  const clamp255 = v => Math.max(0, Math.min(255, v));
  // a palette remap: every ink to the nearest ink of a tinted copy of it
  const remap = fn => RGB.map(c => Kit.nearest(...fn(c).map(clamp255)));
  const tint = (mul, add = [0, 0, 0]) => remap(c => c.map((v, i) => v * mul[i] + add[i]));
  // the same, but an ink pays a penalty for leaving its own ramp, so greens darken as greens instead of turning brown
  const FAMILY = RGB.map((_, i) => Object.values(Kit.RAMPS).filter(r => r.includes(i)));
  function tintInRamp(mul, add, penalty) {
    return RGB.map((c, i) => {
      const want = c.map((v, k) => clamp255(v * mul[k] + add[k]));
      let best = 0, bd = Infinity;
      RGB.forEach((q, j) => {
        const dr = want[0] - q[0], dg = want[1] - q[1], db = want[2] - q[2];
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db + (FAMILY[i].some(r => r.includes(j)) ? 0 : penalty);
        if (d < bd) { bd = d; best = j; }
      });
      return best;
    });
  }
  function reprint(pix, map) { const q = new Pix(pix.w, pix.h); for (let i = 0; i < pix.d.length; i++) q.d[i] = pix.d[i] < 0 ? -1 : map[pix.d[i]]; return q; }
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bands = (p, cols, top, bot, x0 = 0, x1 = p.w) => {
    const bh = (bot - top) / cols.length;
    for (let y = top; y < bot; y++) {
      const f = (y - top) / bh, k = Math.floor(f), inb = y - top - k * bh;
      for (let x = x0; x < x1; x++) p.set(x, y, cols[Math.min(cols.length - 1, k + (inb >= bh - 2 && (x + y) % 2 ? 1 : 0))]);
    }
  };
  // a round tree: clumps shaded from the upper left in three tones, a dark outline
  function tree(dst, cx, base, size, seed) {
    const L = new Pix(dst.w, dst.h), r = Kit.rng(seed);
    const tw = Math.max(2, Math.round(size / 4)), top = base - Math.round(size * 1.1);
    for (let y = top; y < base; y++) for (let x = 0; x < tw; x++) L.set(cx - (tw >> 1) + x, y, x < tw / 2 ? 28 : 27);
    const cy = base - Math.round(size * 1.55);
    const clumps = [[0, -0.3, 0.75], [-0.55, 0.15, 0.55], [0.55, 0.15, 0.55], [0, 0.3, 0.62], [r.range(-0.3, 0.3), -0.6, 0.45]];
    for (let y = -size * 2; y < size * 2; y++) for (let x = -size * 2; x < size * 2; x++) {
      let hit = null;
      for (const c of clumps) if ((x + 0.5 - c[0] * size) ** 2 + (y + 0.5 - c[1] * size) ** 2 <= (c[2] * size) ** 2) hit = c;
      if (!hit) continue;
      const dx = (x + 0.5 - hit[0] * size) / (hit[2] * size), dy = (y + 0.5 - hit[1] * size) / (hit[2] * size);
      const l = -0.5 * dx - 0.6 * dy + 0.6 * Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      L.set(cx + x, cy + y, l > 0.68 ? 18 : l > 0.18 ? 17 : 16);
    }
    stamp(dst, L, 0);
  }

  // ---- the cottage scene shared by weather and day-night ----
  function cottage() {
    const p = new Pix(W, H);
    bands(p, [22, 23, 24], 0, 64);
    const cloud = (cx, cy, n) => { for (let i = 0; i < n; i++) disc(p, cx + i * 7, cy - (i % 2 ? 3 : 0), 5 + (i % 2), 7); for (let x = cx - 6; x < cx + n * 7 + 6; x++) { p.set(x, cy + 3, p.get(x, cy + 2) === 7 ? 6 : p.get(x, cy + 3)); for (let y = cy + 4; y < cy + 8; y++) if (p.get(x, y) === 7) p.set(x, y, 24); } };
    // ink 25 is kept for window glass alone, so a palette map can light the windows at night
    cloud(24, 16, 4); cloud(118, 10, 3);
    for (let x = 0; x < W; x++) {
      const t1 = Math.round(52 + 4 * Math.sin(x * 0.045) + 2 * Math.sin(x * 0.13 + 1));
      for (let y = t1; y < 66; y++) p.set(x, y, y === t1 ? 23 : 22);
      const t2 = Math.round(60 + 2 * Math.sin(x * 0.07 + 2));
      for (let y = t2; y < H; y++) p.set(x, y, y === t2 ? 18 : y > 98 ? 16 : 17);
    }
    // path from the door, widening toward us
    for (let y = 82; y < H; y++) {
      const cx = 126 - (y - 82) * 1.2, hw = 4 + (y - 82) * 0.25;
      for (let x = Math.round(cx - hw); x < cx + hw; x++) p.set(x, y, x < cx - hw + 1 || x > cx + hw - 2 ? 28 : 29);
    }
    const r = Kit.rng(21);
    for (let k = 0; k < 40; k++) {
      const x = r.int(2, W - 4), y = r.int(66, H - 2);
      if (p.get(x, y) !== 17 && p.get(x, y) !== 16) continue;
      if (k % 4 === 0) { p.set(x, y, [31, 13, 7][k % 3]); continue; }
      const c = p.get(x, y) === 16 ? 15 : 16; p.set(x, y, c); p.set(x + 2, y, c); p.set(x + 1, y + 1, c);
    }
    // cottage
    const L = new Pix(W, H);
    for (let y = 58; y < 83; y++) for (let x = 108; x <= 146; x++) L.set(x, y, y < 60 ? 5 : y === 82 ? 4 : x > 139 ? 5 : 6);
    for (let y = 40; y < 59; y++) {
      const l = Math.round(113 - (y - 40) * 0.5), rr = Math.round(141 + (y - 40) * 0.5);
      for (let x = l; x <= rr; x++) L.set(x, y, y === 40 ? 12 : (y - 40) % 4 === 3 ? 9 : x < l + 6 ? 11 : 10);
    }
    for (let y = 32; y < 41; y++) for (let x = 134; x < 140; x++) L.set(x, y, y === 32 ? 5 : x > 137 ? 3 : 4);
    for (let y = 68; y < 82; y++) for (let x = 122; x < 131; x++) L.set(x, y, x === 122 || x === 130 || y === 68 ? 26 : x === 126 ? 26 : 27);
    L.set(128, 75, 13);
    for (const wx of [112, 134]) for (let y = 63; y < 72; y++) for (let x = wx; x < wx + 8; x++)
      L.set(x, y, y === 71 ? 28 : (x === wx || x === wx + 7 || y === 63 || y === 70 || x === wx + 3 || y === 66) ? 27 : 25);
    stamp(p, L, 0);
    tree(p, 42, 74, 16, 3);
    tree(p, 174, 70, 10, 8);
    const B = new Pix(W, H); ell(B, 92, 76, 8, 5, 16); ell(B, 91, 75, 6, 3, 17); ell(B, 89, 74, 3, 1.5, 18); stamp(p, B, 0);
    // fence
    const F = new Pix(W, H);
    for (let x = 60; x <= 100; x += 8) for (let y = 76; y < 86; y++) F.set(x, y, 28), F.set(x + 1, y, 27);
    for (let x = 60; x < 102; x++) { F.set(x, 79, 28); F.set(x, 83, 28); }
    stamp(p, F, 0);
    return p;
  }

  // =====================================================================
  // 6. palette-cycle: water and fire animated only by rotating palette entries
  // =====================================================================
  Kit.register('palette-cycle', { title: 'Palette cycling', fit: 'per-frame' }, host => {
    const c = Kit.canvas(host, W, H), g = c.g;
    // cycle ranges live above the 32 page inks; each lists the inks it rotates through
    const R = {
      fall: { base: 32, inks: [21, 22, 22, 23, 24, 25, 23, 22], every: 2, dir: -1 },
      lake: { base: 40, inks: [21, 21, 22, 23, 22, 21], every: 5, dir: 1 },
      foam: { base: 46, inks: [7, 6, 24, 25], every: 3, dir: 1 },
      fire: { base: 50, inks: [11, 12, 13, 7, 13, 12], every: 2, dir: 1 },
      glow: { base: 56, inks: [10, 9, 9, 8, 9, 9], every: 3, dir: 1 },
      star: { base: 62, inks: [2, 4, 7, 5], every: 9, dir: 1 },
    };
    const p = new Pix(W, H);
    // sky and stars
    bands(p, [0, 1, 1, 2, 30], 0, 72);
    for (let k = 0; k < 40; k++) { const x = Math.floor(Kit.hash2(k, 1, 4) * W), y = Math.floor(Kit.hash2(k, 2, 4) * 50); p.set(x, y, R.star.base + (k % 4)); }
    disc(p, 150, 18, 7, 6); disc(p, 152, 16, 6, 7); disc(p, 147, 20, 1.2, 5);
    // cliffs: left mass with a notch the water pours from, right mass behind the torch
    const C = new Pix(W, H);
    for (let x = 0; x < W; x++) {
      const left = x < 96 ? Math.round(20 + Math.abs(x - 46) * 0.35 + 6 * Math.sin(x * 0.2)) : 999;
      const right = x > 120 ? Math.round(48 + (180 - Math.min(x, 180)) * 0.25 + 3 * Math.sin(x * 0.3)) : 999;
      const top = Math.min(left, right);
      for (let y = top; y < 82; y++) {
        const lit = Kit.noise2(x / 16, y / 11, 2) > 0.12, crack = Kit.hash2(x, y >> 2, 6) < 0.025;
        C.set(x, y, y - top < 2 ? 5 : crack ? 2 : lit ? 4 : 3);
      }
    }
    for (let y = 0; y < 40; y++) for (let x = 64; x < 86; x++) if (C.get(x, y) >= 0 && y < 30) C.set(x, y, -1);
    stamp(p, C, 1);
    // lake
    for (let y = 72; y < 100; y++) for (let x = 0; x < W; x++) p.set(x, y, y < 74 ? 22 : 21);
    for (let k = 0; k < 70; k++) {
      const y = 74 + Math.floor(Kit.hash2(k, 7, 1) * 25), x = Math.floor(Kit.hash2(k, 8, 1) * W), len = 2 + Math.floor(Kit.hash2(k, 9, 1) * 6);
      for (let i = 0; i < len; i++) p.set(x + i, y, R.lake.base + ((x + i + y) >> 1) % 6);
    }
    // moon and torch reflections as shimmering dashes
    for (let y = 75; y < 99; y += 2) for (let i = -3; i <= 3; i++) if (Kit.hash2(i, y, 3) < 0.6) p.set(150 + i + (y % 4 ? 1 : 0), y, R.foam.base + ((y >> 1) + i) % 4);
    for (let y = 76; y < 99; y += 2) for (let i = -2; i <= 2; i++) if (Kit.hash2(i, y, 5) < 0.55) p.set(170 + i, y, R.fire.base + ((y >> 1) + i + 6) % 6);
    // waterfall: streaky columns, each with its own offset, so rotation reads as falling water
    for (let x = 66; x < 84; x++) {
      const off = Math.floor(Kit.hash2(x, 0, 9) * 8), st = Kit.hash2(x, 1, 9) < 0.5 ? 1 : 2;
      let top = 0; while (top < H && p.get(x, top) !== 1 && C.get(x, top) < 0 && top < 31) top++;
      for (let y = 27; y < 74; y++) p.set(x, y, x === 66 || x === 83 ? 21 : R.fall.base + Math.floor((y + off) / st) % 8);
    }
    for (let y = 68; y < 80; y++) for (let x = 58; x < 92; x++)
      if (((x + 0.5 - 75) / 17) ** 2 + ((y + 0.5 - 74) / 5) ** 2 <= 1 && Kit.hash2(x, y, 2) < 0.85) p.set(x, y, R.foam.base + ((x + y * 3 + Math.floor(Kit.hash2(x, y, 4) * 4)) % 4));
    // near shore
    for (let x = 0; x < W; x++) { const t = 100 + Math.round(Math.sin(x * 0.11) * 1.5); for (let y = t; y < H; y++) p.set(x, y, y === t ? 16 : 15); if (Kit.hash2(x, 3, 3) < 0.3) { p.set(x, t - 1, 15); if (Kit.hash2(x, 4, 3) < 0.5) p.set(x, t - 2, 15); } }
    // torch: post, bowl, flame shaped like a teardrop, a dithered glow around it
    for (let y = 58; y < 72; y++) for (let x = 164; x < 178; x++) {
      const d = Math.hypot(x + 0.5 - 171, (y + 0.5 - 64) * 1.2);
      if (d < 8 && d > 2 && (x + y) % 2 === 0 && p.get(x, y) < 32) p.set(x, y, R.glow.base + Math.min(5, Math.floor(d - 2)));
    }
    const T = new Pix(W, H);
    for (let y = 66; y < 100; y++) T.set(170, y, 27), T.set(171, y, 26);
    for (let x = 167; x < 175; x++) T.set(x, 66, 26), T.set(x, 67, 27);
    for (let y = 53; y < 66; y++) for (let x = 166; x < 176; x++) {
      const dy = (y - 53) / 13, hw = 3.2 * Math.sin(Math.PI * 0.62 * Math.pow(dy, 0.6)) + 0.4, dx = Math.abs(x + 0.5 - 171);
      if (dx > hw) continue;
      // the core is the bright end of the range, the rim the dark end; rotation makes it lick upward
      const ring = dx < hw * 0.45 && dy > 0.35 ? 2 : 0;
      T.set(x, y, R.fire.base + ((65 - y) + ring + Math.floor(Kit.hash2(x, y, 1) * 2)) % 6);
    }
    stamp(p, T, 0);

    // prebake: one static layer, one transparent layer per phase of each range
    const isCyc = v => v >= 32;
    const staticP = new Pix(W, H); for (let i = 0; i < p.d.length; i++) staticP.d[i] = isCyc(p.d[i]) ? 0 : p.d[i];
    const base = toCanvas(staticP), dimmed = toCanvas(reprint(staticP, tint([0.25, 0.25, 0.3])));
    const phases = {};
    for (const k in R) {
      const { base: b0, inks } = R[k], n = inks.length;
      phases[k] = inks.map((_, f) => {
        const q = new Pix(W, H);
        for (let i = 0; i < p.d.length; i++) { const v = p.d[i]; if (v >= b0 && v < b0 + n) q.d[i] = inks[((v - b0 - f) % n + n) % n]; }
        return toCanvas(q);
      });
    }
    let show = false;
    const draw = t => {
      g.drawImage(show ? dimmed : base, 0, 0);
      let sx = 4;
      for (const k in R) {
        const r = R[k], n = r.inks.length, f = ((Math.floor(t / r.every) * r.dir) % n + n) % n;
        g.drawImage(phases[k][f], 0, 0);
        if (show) {
          // the range as the palette sees it: the same entries, rotated
          for (let i = 0; i < n; i++) { g.fillStyle = PAL[0]; g.fillRect(sx + i * 4 - 1, 101, 5, 6); }
          for (let i = 0; i < n; i++) { g.fillStyle = PAL[r.inks[((i - f) % n + n) % n]]; g.fillRect(sx + i * 4, 102, 3, 4); }
          sx += n * 4 + 4;
        }
      }
    };
    const b = Kit.bar(host);
    b.check('Show cycling colors', false, v => { show = v; draw(tick); });
    b.note('One flat picture. Six ranges of palette entries (falls, lake, foam, fire, glow, stars) rotate at their own rates; no pixel is ever redrawn. Fits per frame only because each range is prebaked as its own few phase layers (4 to 8 each, transparent elsewhere), so a frame is seven drawImage calls; true per-frame palette rotation would need a per-pixel lookup (a shader).');
    let tick = 0;
    Kit.loop(host, () => {}, t => { tick = t; draw(t); }, 30);
  });

  // =====================================================================
  // 7. doom-fire: Fabien Sanglard's write-up of the PSX Doom fire, on the page's red ramp
  // =====================================================================
  Kit.register('doom-fire', { title: 'Doom fire', fit: 'shader' }, host => {
    const FW = 160, FH = 90;
    const c = Kit.canvas(host, FW, FH);
    const fire = new Uint8Array(FW * FH), rng = Kit.rng(1993);
    const RAMP = [-1, 8, 9, 10, 11, 12, 13, 7];
    let burning = true, wind = 0, dither = false, cool = 1;
    const light = on => { for (let x = 0; x < FW; x++) fire[(FH - 1) * FW + x] = on ? 36 : 0; };
    light(true);
    // logs over the source row, painted once
    const logs = new Pix(FW, FH);
    const LG = new Pix(FW, FH);
    poly(LG, [[44, 88], [112, 80], [116, 85], [48, 93]], 27);
    poly(LG, [[50, 80], [118, 89], [114, 93], [46, 85]], 28);
    for (let x = 52; x < 112; x += 9) LG.set(x, 84, 26);
    stamp(logs, LG, 0);
    for (let x = 0; x < FW; x++) for (let y = FH - 3; y < FH; y++) if (logs.get(x, y) < 0) logs.set(x, y, 1);
    const step = () => {
      for (let x = 0; x < FW; x++) for (let y = 1; y < FH; y++) {
        const src = y * FW + x, v = fire[src];
        if (v === 0) { fire[src - FW] = 0; continue; }
        const r = Math.round(rng() * 3) & 3;           // the original: 0..3, decay on odd
        const dst = src - r + 1 + wind - FW;
        if (dst >= 0) fire[dst] = Math.max(0, v - (r & 1) - (cool && rng() < cool * 0.12 ? 1 : 0));
      }
    };
    for (let i = 0; i < 80; i++) step();
    const pix = new Pix(FW, FH);
    const draw = () => {
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
        const i = y * FW + x, v = fire[i], lg = logs.d[i];
        if (lg >= 0) { pix.d[i] = lg; continue; }
        let k = v === 0 ? 0 : dither ? Math.round(0.5 + (v - 1) / 35 * 6.5 + (BAYER4[(y & 3) * 4 + (x & 3)] - 0.5) * 0.9) : 1 + Math.floor((v - 1) / 35 * 6.99);
        k = Math.max(0, Math.min(7, k));
        pix.d[i] = k === 0 ? (y < 30 && Kit.hash2(x, y, 3) < 0.004 ? 4 : 0) : RAMP[k];
      }
      c.put(pix);
    };
    const b = Kit.bar(host);
    const btn = b.button('Douse', () => { burning = !burning; light(burning); btn.textContent = burning ? 'Douse' : 'Light'; });
    b.slider('Wind', -1, 1, 1, 0, v => { wind = v; });
    b.slider('Cooling', 0, 3, 1, cool, v => { cool = v; });
    b.check('Dither bands', dither, v => { dither = v; draw(); });
    b.note('37 heat levels in a byte buffer; each step every cell copies the cell below it, minus 0 or 1, nudged sideways at random (Cooling 0 is the original; above it adds a little extra decay). Heat maps onto 7 reds by index. Per-pixel CPU every frame (a drawPixels upload in Tycho, or a tiny shader); it cannot be prebaked as a seamless loop cheaply.');
    Kit.loop(host, () => step(), draw, 30);
  });


  // =====================================================================
  // 10. water: a reflection displaced per row, foam and glints
  // =====================================================================
  Kit.register('water', { title: 'Water reflection', fit: 'per-frame' }, host => {
    const c = Kit.canvas(host, W, H), g = c.g;
    const HZ = 58, BANK = 100;
    const p = new Pix(W, H);
    bands(p, [21, 30, 31, 11, 12, 13], 0, HZ);
    disc(p, 124, 50, 10, 13); disc(p, 124, 50, 8, 7);
    for (let x = 0; x < W; x++) {
      const t = Math.round(38 + 7 * Math.sin(x * 0.028 + 2) + 3 * Math.sin(x * 0.11));
      for (let y = t; y < HZ; y++) p.set(x, y, y === t ? 31 : 30);
      const t2 = Math.round(48 + 3 * Math.sin(x * 0.06) + 2 * Math.sin(x * 0.17 + 1));
      for (let y = t2; y < HZ; y++) p.set(x, y, y === t2 ? 3 : 2);
    }
    // far shore: dark firs and a cabin with a lit window
    const S = new Pix(W, H);
    for (let x = 0; x < W; x++) for (let y = 55; y < HZ; y++) S.set(x, y, 14);
    const r = Kit.rng(31);
    for (let k = 0; k < 22; k++) {
      const x = r.int(0, W - 1), h = r.int(5, 12);
      if (x > 36 && x < 66) continue;
      for (let j = 0; j < h; j++) { const hw = Math.floor(j * 0.35) + (j % 3 === 2 ? 1 : 0); for (let i = -hw; i <= hw; i++) S.set(x + i, 55 - h + j, 14); }
    }
    for (let y = 47; y < 56; y++) for (let x = 42; x < 58; x++) S.set(x, y, 27);
    poly(S, [[39, 48], [61, 48], [55, 42], [45, 42]], 9);
    S.rect(46, 50, 3, 3, 13); S.rect(52, 50, 3, 3, 13);
    stamp(p, S, 0);
    for (let y = HZ; y < BANK; y++) for (let x = 0; x < W; x++) p.set(x, y, 21);
    for (let x = 0; x < W; x++) {
      const t = BANK + Math.round(Math.sin(x * 0.09) * 1.5 + Kit.hash2(x >> 2, 0, 2));
      for (let y = t; y < H; y++) p.set(x, y, y === t ? 16 : 15);
      if (Kit.hash2(x, 1, 7) < 0.22) { const h = 3 + Math.floor(Kit.hash2(x, 2, 7) * 7); for (let j = 1; j <= h; j++) p.set(x, t - j, j === h && Kit.hash2(x, 3, 7) < 0.4 ? 28 : 14); }
    }
    const scene = toCanvas(p);
    // the reflection: rows above the horizon flipped, reprinted darker and bluer, padded at the sides
    const PADX = 6, refl = new Pix(W + PADX * 2, HZ);
    const wl = RGB.map((_, i) => i);
    const done = new Set();
    for (const k of ['grey', 'red', 'green', 'blue', 'violet', 'brown']) Kit.RAMPS[k].forEach((v, j) => { if (j && !done.has(v)) { wl[v] = Kit.RAMPS[k][j - 1]; done.add(v); } });
    for (let j = 0; j < HZ; j++) for (let x = -PADX; x < W + PADX; x++) refl.set(x + PADX, j, wl[p.get(Math.max(0, Math.min(W - 1, x)), HZ - 1 - j)]);
    const rc = toCanvas(refl);
    const draw = t => {
      g.drawImage(scene, 0, 0);
      for (let y = HZ; y < BANK + 2; y++) {
        const j = y - HZ;
        // deeper rows (nearer us) swing wider; some rows break up into plain water, which reads as wave troughs
        const A = 0.4 + j * 0.06;
        const dx = Math.round(A * Math.sin(j * 0.55 - t * 0.12) + 0.7 * Math.sin(j * 1.7 + t * 0.21));
        g.drawImage(rc, 0, Math.min(HZ - 1, j), W + PADX * 2, 1, -PADX + dx, y, W + PADX * 2, 1);
        // ripple dashes: more and longer toward us, drifting sideways at a speed set by the row
        if (j < 3) continue;
        g.fillStyle = PAL[j < 16 ? 21 : 22];
        const n = 2 + (j >> 3), sp = 0.2 + Kit.hash2(j, 0, 4) * 0.4;
        for (let k = 0; k < n; k++) {
          const len = 2 + Math.floor(Kit.hash2(j, k, 5) * (2 + j / 4));
          const x = Math.floor((Kit.hash2(j, k, 6) * W + t * sp * (k % 2 ? 1 : -1)) % W + W) % W;
          g.fillRect(x, y, len, 1);
        }
      }
      g.drawImage(scene, 0, BANK - 3, W, H - BANK + 3, 0, BANK - 3, W, H - BANK + 3);
      // glints in the sun's path: short dashes that come and go
      const slot = t >> 2;
      for (let k = 0; k < 14; k++) {
        const gy = HZ + 1 + Math.floor(Kit.hash2(k, slot, 1) * (BANK - HZ - 4));
        const spread = 6 + (gy - HZ) * 0.5;
        const gx = Math.round(124 + (Kit.hash2(k, slot, 2) - 0.5) * 2 * spread);
        g.fillStyle = PAL[Kit.hash2(k, slot, 3) < 0.5 ? 7 : 13];
        g.fillRect(gx, gy, 1 + Math.floor(Kit.hash2(k, slot, 4) * 3), 1);
      }
      // foam along the near bank and a glimmer on the far shore
      const fs = t >> 3;
      for (let x = 0; x < W; x++) {
        const bank = BANK + Math.round(Math.sin(x * 0.09) * 1.5 + Kit.hash2(x >> 2, 0, 2));
        const wv = Math.round(Math.sin(x * 0.2 + t * 0.1));
        if (Kit.hash2(x >> 1, fs, 5) < 0.5) { g.fillStyle = PAL[Kit.hash2(x, fs, 6) < 0.5 ? 6 : 7]; g.fillRect(x, bank - 1 + Math.min(0, wv), 1, 1); }
        if (Kit.hash2(x, fs, 8) < 0.12) { g.fillStyle = PAL[24]; g.fillRect(x, HZ, 1, 1); }
      }
    };
    const b = Kit.bar(host);
    b.note('Above the line is one prebaked picture. Each water row is one drawImage strip of a flipped reprint (every ink one step down its ramp), shifted by a sum of sines that grows toward us, with drifting ripple dashes. Foam and glints are a few hashed fillRects. All of it fits the stand-in.');
    Kit.loop(host, () => {}, draw, 30);
  });

  // =====================================================================
  // 11. weather: rain, snow, fog and fireflies over one scene
  // =====================================================================
  Kit.register('weather', { title: 'Weather', fit: 'per-frame' }, host => {
    const c = Kit.canvas(host, W, H), g = c.g;
    const base = cottage();
    const night = tint([0.22, 0.25, 0.48], [3, 3, 12]); night[25] = 13; night[7] = 5;
    const S = {
      Rain: toCanvas(reprint(base, tint([0.62, 0.66, 0.74], [8, 10, 18]))),
      Snow: toCanvas(reprint(base, tint([0.85, 0.92, 1.05], [30, 34, 44]))),
      Fog: toCanvas(reprint(base, tint([0.62, 0.64, 0.68], [64, 66, 72]))),
      Fireflies: toCanvas(reprint(base, night)),
    };
    // snow settling: five prebaked stages; tops of things whiten first, then the meadow fills in
    const snowy = (() => {
      const lit = new Set([10, 11, 12, 17, 18, 19, 28, 29]), any = new Set([9, 10, 11, 12, 15, 16, 17, 18, 19, 26, 27, 28, 29]);
      const sp = reprint(base, tint([0.85, 0.92, 1.05], [30, 34, 44]));
      return [0, 1, 2, 3, 4].map(s => {
        const q = new Pix(W, H);
        for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
          const v = base.get(x, y); if (!any.has(v)) continue;
          let depth = 0; while (depth < 4 && any.has(base.get(x, y - depth - 1))) depth++;
          const onTop = depth < s, fill = y > 64 && v >= 15 && v <= 18 && BAYER4[(y & 3) * 4 + (x & 3)] < s * 0.2 - 0.05;
          if (onTop || fill) q.set(x, y, lit.has(v) ? 7 : 6);
        }
        return toCanvas(q);
      });
    })();
    // fog: two tiling layers of wavy horizontal banks, as pattern dither (checker core, sparse grid rim), not a blend
    const fogLayer = (seed, ink, mid, thick) => {
      const q = new Pix(256, H);
      for (let x = 0; x < 256; x++) {
        const a = x / 256 * Math.PI * 2;
        const yc = mid + 3 * Math.sin(a * 2 + seed) + 2 * Math.sin(a * 5 + seed * 3);
        const hh = thick * (0.7 + 0.5 * (Kit.noise2(Math.cos(a) * 1.5, Math.sin(a) * 1.5, seed) + 0.5));
        for (let y = 0; y < H; y++) {
          const cover = Math.exp(-(((y - yc) / hh) ** 2));
          const on = cover > 0.55 ? (x + y) % 2 === 0 : cover > 0.25 ? (x % 2 === 0 && y % 2 === 0) : false;
          if (on) q.set(x, y, ink);
        }
      }
      return toCanvas(q);
    };
    const fogs = [fogLayer(3, 6, 66, 7), fogLayer(8, 7, 92, 9)];
    let mode = 'Rain', t0 = 0;
    const px = (x, y, ci) => { g.fillStyle = PAL[ci]; g.fillRect(x, y, 1, 1); };
    const draw = t => {
      const tt = t - t0;
      g.drawImage(S[mode], 0, 0);
      if (mode === 'Rain') {
        for (let i = 0; i < 110; i++) {
          const gy = 62 + Math.floor(Kit.hash2(i, 1, 4) * 46), v = 4 + Kit.hash2(i, 2, 4) * 2;
          const period = gy + 30, s = (tt * v + Kit.hash2(i, 3, 4) * period) % period, y = Math.floor(s - 16);
          const x0 = Math.floor(Kit.hash2(i, 4, 4) * (W + 30)) - 10, x = x0 - Math.floor(y * 0.3);
          if (y < gy) { g.fillStyle = PAL[i % 3 ? 5 : 6]; g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y - 2, 1, 2); g.fillRect(x + 2, y - 4, 1, 1); }
          else if (y < gy + 8) {
            const k = (y - gy) >> 2, sx = x0 - Math.floor(gy * 0.3);
            if (k === 0) { px(sx - 1, gy - 1, 6); px(sx + 1, gy - 1, 6); }
            else { px(sx - 2, gy - 2, 5); px(sx + 2, gy - 2, 5); px(sx, gy, 5); }
          }
        }
      } else if (mode === 'Snow') {
        g.drawImage(snowy[Math.min(4, Math.floor(tt / 70))], 0, 0);
        for (let i = 0; i < 90; i++) {
          const near = Kit.hash2(i, 1, 6) < 0.3, v = near ? 0.7 : 0.35 + Kit.hash2(i, 2, 6) * 0.2;
          const y = Math.floor((tt * v + Kit.hash2(i, 3, 6) * (H + 10)) % (H + 10)) - 5;
          const x = Math.floor(((Kit.hash2(i, 4, 6) * (W + 20) + Math.sin(tt * 0.05 + i) * (near ? 3 : 1.5) + tt * 0.15) % (W + 20) + W + 20) % (W + 20)) - 10;
          g.fillStyle = PAL[7]; g.fillRect(x, y, near ? 2 : 1, near ? 2 : 1);
        }
      } else if (mode === 'Fog') {
        for (const [k, f] of fogs.entries()) { const o = Math.floor(tt * (k ? 0.5 : 0.22)) % 256; g.drawImage(f, -o, 0); g.drawImage(f, 256 - o, 0); }
      } else {
        for (let i = 0; i < 18; i++) {
          const bx = 20 + Kit.hash2(i, 1, 2) * 160, by = 60 + Kit.hash2(i, 2, 2) * 40;
          const x = Math.round(bx + 12 * Math.sin(tt * (0.013 + Kit.hash2(i, 3, 2) * 0.02) + i) + 4 * Math.sin(tt * 0.05 + i * 2));
          const y = Math.round(by + 6 * Math.sin(tt * (0.017 + Kit.hash2(i, 4, 2) * 0.02) + i * 3));
          const ph = (tt * (0.012 + Kit.hash2(i, 5, 2) * 0.01) + Kit.hash2(i, 6, 2)) % 1;
          if (ph > 0.55) continue;
          const bright = ph < 0.4;
          if (bright) { px(x - 1, y, 16); px(x + 1, y, 16); px(x, y - 1, 16); px(x, y + 1, 16); }
          px(x, y, bright ? 19 : 17);
        }
      }
    };
    const b = Kit.bar(host);
    b.tabs(['Rain', 'Snow', 'Fog', 'Fireflies'], v => { mode = v; t0 = tick; draw(tick); });
    b.note('Each mood is a palette reprint of the same scene, made once. Particles are hashed from their index and the tick (no state, no Math.random), snapped to whole pixels: rain streaks with splashes where each drop lands, snow with sway and five prebaked settling stages, fog as two drifting wavy banks of pattern dither (checker core, sparse rim), fireflies blinking on Lissajous paths.');
    let tick = 0;
    Kit.loop(host, () => {}, t => { tick = t; draw(t); }, 30);
  });

})();
