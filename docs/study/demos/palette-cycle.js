// palette-cycle.js: Palette cycling. A study demo, using fx-shared.js.
(() => {
  const { PAL, Pix, W, H, stamp, disc, toCanvas, tint, reprint, bands } = StudyShared.fx;
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
})();
