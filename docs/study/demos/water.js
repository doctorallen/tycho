// water.js: Water reflection. A study demo, using fx-shared.js.
(() => {
  const { RGB, PAL, Pix, W, H, stamp, poly, disc, toCanvas, bands } = StudyShared.fx;
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
})();
