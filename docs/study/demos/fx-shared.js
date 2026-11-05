// fx-shared.js: the helpers the fx demos share (palette-cycle, doom-fire, water, weather), loaded before any of them.
// Each helper is exported on StudyShared, and a demo takes the ones it uses. Every random choice comes from
// Kit.rng, Kit.hash2 or Kit.noise2, so a seed always rebuilds the same picture.
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

  window.StudyShared = window.StudyShared || {};
  StudyShared.fx = { RGB, PAL, Pix, W, H, stamp, poly, disc, ell, toCanvas, clamp255, remap, tint, FAMILY, tintInRamp, reprint, BAYER4, bands, tree, cottage };
})();
