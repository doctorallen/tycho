// styles.js: One scene, five style rule sets. A study demo, using looks-shared.js.
(() => {
  const { RGB, Pix, text, lab, KLAB, nearestLab, lambert, BAYER4 } = StudyShared.looks;
  // =====================================================================
  // 3. styles: one scene described once in full color, printed through five rule sets
  // =====================================================================
  const SW = 96, SH = 96;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ramp = (idx, t) => { t = Math.max(0, Math.min(1, t)) * (idx.length - 1); const i = Math.min(idx.length - 2, Math.floor(t)); return mix(RGB[idx[i]], RGB[idx[i + 1]], t - i); };
  const dark = (c, k) => c.map(v => v * k);
  // obj: 0 sky, 1 land, 2 tree, 3 house, 4 hero. Objects 2-4 are the ones a style outlines.
  function paintScene() {
    const col = new Array(SW * SH), obj = new Int8Array(SW * SH);
    const put = (x, y, c, o) => { if (x >= 0 && y >= 0 && x < SW && y < SH) { col[y * SW + x] = c; obj[y * SW + x] = o; } };
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      if (y < 58) put(x, y, ramp([22, 23, 24, 25], y / 60), 0);
      else put(x, y, ramp([18, 17, 16], (y - 58) / 40), 1);
    }
    for (let y = 4; y < 20; y++) for (let x = 50; x < 90; x++) {
      const inC = [[62, 14, 6], [70, 11, 7], [78, 14, 5], [56, 16, 3.5]].some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
      if (inC && y <= 17) put(x, y, y > 14 ? RGB[6] : RGB[7], 0);
    }
    for (let x = 0; x < SW; x++) {
      const top = Math.round(50 + 3 * Math.sin(x * 0.07 + 1) + 2 * Math.sin(x * 0.19));
      for (let y = top; y < 58; y++) put(x, y, mix(RGB[16], RGB[23], 0.45 + (y - top) * 0.02), 0);
    }
    // shadows and path on the land
    for (let y = 58; y < SH; y++) for (let x = 0; x < SW; x++) {
      const i = y * SW + x;
      if (((x - 21) / 13) ** 2 + ((y - 72) / 3) ** 2 <= 1 || ((x - 44.5) / 6) ** 2 + ((y - 79) / 1.6) ** 2 <= 1) col[i] = dark(col[i], 0.72);
      const cx = 67 - (y - 68) * 0.55, hw = 3 + (y - 68) * 0.22;
      if (y >= 68 && Math.abs(x + 0.5 - cx) <= hw) col[i] = Math.abs(x + 0.5 - cx) > hw - 1 ? RGB[28] : RGB[29];
    }
    const tr = Kit.rng(5);
    for (let k = 0; k < 16; k++) {
      const x = tr.int(2, 92), y = tr.int(61, 93);
      if (y >= 66 && Math.abs(x - (67 - (y - 68) * 0.55)) < 9) continue;
      const g = dark(col[y * SW + x], 0.7); put(x, y, g, 1); put(x + 2, y, g, 1); put(x + 1, y + 1, g, 1);
    }
    // house
    for (let y = 30; y < 46; y++) {
      const l = Math.round(56 - (y - 30) * 0.25), r = Math.round(88 + (y - 30) * 0.25);
      for (let x = l; x <= r; x++) put(x, y, y === 30 ? RGB[11] : (y - 30) % 4 === 3 ? RGB[9] : x < l + 7 ? mix(RGB[10], RGB[11], 0.5) : RGB[10], 3);
    }
    for (let y = 22; y < 30; y++) for (let x = 77; x < 83; x++) put(x, y, y === 22 ? RGB[5] : x > 80 ? RGB[3] : RGB[4], 3);
    for (let y = 46; y < 69; y++) for (let x = 56; x <= 88; x++) put(x, y, y < 48 ? RGB[5] : y === 68 ? RGB[4] : x > 82 ? mix(RGB[6], RGB[5], 0.6) : RGB[6], 3);
    for (let y = 54; y < 68; y++) for (let x = 62; x < 71; x++) put(x, y, x === 62 ? RGB[28] : x === 66 ? RGB[26] : RGB[27], 3);
    put(69, 61, RGB[13], 3);
    for (let y = 51; y < 60; y++) for (let x = 75; x < 84; x++) {
      const frame = y === 51 || y === 59 || x === 75 || x === 83 || x === 79 || y === 55;
      put(x, y, frame ? RGB[27] : (x === 76 && y === 52) ? RGB[25] : RGB[24], 3);
    }
    // tree
    for (let y = 46; y < 73; y++) for (let x = 17; x < 24; x++) put(x, y, x < 20 ? RGB[28] : x < 22 ? RGB[27] : RGB[26], 2);
    const clumps = [[20, 30, 12], [10, 39, 9], [30, 39, 9], [20, 44, 9]];
    for (let y = 14; y < 56; y++) for (let x = 0; x < 42; x++) {
      let hit = null;
      for (const cl of clumps) if ((x + 0.5 - cl[0]) ** 2 + (y + 0.5 - cl[1]) ** 2 <= cl[2] * cl[2]) hit = cl;
      if (!hit) continue;
      const dx = (x + 0.5 - hit[0]) / hit[2], dy = (y + 0.5 - hit[1]) / hit[2];
      put(x, y, ramp([15, 16, 17, 18, 19], lambert(dx, dy, Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy))) * 1.05), 2);
    }
    // hero, from a tiny map; the right side of each part is shaded
    const HERO = ['...HHH...', '..HHHHH..', '..HFFFH..', '..FEFEF..', '..FFFFF..', '...FFF...', '..SSSSS..', '.SSSSSSS.',
      '.FSSSSSF.', '.FSSSSSF.', '..SSSSS..', '..PPPPP..', '..PP.PP..', '..PP.PP..', '..PP.PP..', '..BB.BB..'];
    const skin = mix(RGB[13], RGB[12], 0.35);
    const parts = { H: RGB[27], F: skin, E: RGB[0], S: RGB[23], P: RGB[3], B: RGB[26] };
    HERO.forEach((row, j) => [...row].forEach((ch, i) => { if (parts[ch]) put(40 + i, 63 + j, i >= 6 && ch !== 'E' ? dark(parts[ch], 0.72) : parts[ch], 4); }));
    return { col, obj, lab: col.map(lab) };
  }

  const PICO = [0, 21, 30, 15, 28, 3, 5, 7, 10, 12, 19, 17, 23, 4, 31, 29];
  const NESG = [0, 1, 3, 5, 7, 9, 10, 12, 13, 15, 17, 18, 21, 23, 24, 26, 27, 28, 29, 30];
  const ALL = RGB.map((_, i) => i);
  const STYLES = {
    '1-bit': { lines: ['1-BIT', 'INKS 2', 'OUTLINE INK', '4 TONES AS PATTERNS', 'MAP BY LIGHTNESS'], lum: [0, 7], patterns: true, outline: 'ink' },
    'Game Boy': { lines: ['GAME BOY-LIKE', 'INKS 4, ONE HUE', 'OUTLINE DARKEST', 'DITHER AT BANDS', 'MAP BY LIGHTNESS'], lum: [14, 16, 18, 19], dither: 0.55, outline: 'ink' },
    'NES': { lines: ['NES-LIKE', '3 INKS PER OBJECT', 'FROM 20 FIXED', 'OUTLINE BLACK', 'NO DITHER'], perObject: NESG, outline: 'ink' },
    'PICO-8': { lines: ['PICO-8-LIKE', 'INKS 16 FIXED', 'OUTLINE BLACK', 'NO DITHER', '128X128 SCREEN'], set: PICO, outline: 'ink' },
    'Hi-bit': { lines: ['HI-BIT', 'INKS 32', 'COLORED OUTLINES', 'LIT EDGES LIGHTER', 'SOFT RAMPS'], set: ALL, outline: 'color' },
  };
  // best k inks from a set for a list of OKLab colors, by trying every combination (20 choose 3 is 1140)
  function pickInks(labs, cands, k, forced) {
    const free = cands.filter(c => !forced.includes(c)), need = k - forced.length;
    const D = free.map(c => labs.map(L => { const q = KLAB[c]; return (L[0] - q[0]) ** 2 + 3 * ((L[1] - q[1]) ** 2 + (L[2] - q[2]) ** 2); }));
    const F = labs.map(L => forced.reduce((b, c) => { const q = KLAB[c]; return Math.min(b, (L[0] - q[0]) ** 2 + (L[1] - q[1]) ** 2 + (L[2] - q[2]) ** 2); }, Infinity));
    let best = null, be = Infinity;
    const walk = (start, picked) => {
      if (picked.length === need) {
        let e = 0;
        for (let j = 0; j < labs.length && e < be; j++) { let m = F[j]; for (const a of picked) m = Math.min(m, D[a][j]); e += m; }
        if (e < be) { be = e; best = picked.slice(); }
        return;
      }
      for (let a = start; a < free.length; a++) { picked.push(a); walk(a + 1, picked); picked.pop(); }
    };
    walk(0, []);
    return [...forced, ...best.map(a => free[a])];
  }
  function printStyle(scene, st) {
    const p = new Pix(SW, SH), sub = {};
    const { col, obj, lab: labs } = scene;
    if (st.perObject) for (let o = 0; o < 5; o++) {
      const mine = []; for (let i = 0; i < labs.length; i += 1) if (obj[i] === o) mine.push(labs[i]);
      sub[o] = pickInks(mine.filter((_, i) => i % 3 === 0), st.perObject, 3, o >= 2 ? [0] : []);
    }
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const i = y * SW + x;
      let out;
      if (st.lum) {
        const n = st.lum.length, v = Math.max(0, Math.min(1, (labs[i][0] - 0.38) / 0.55));
        const t = BAYER4[(y & 3) * 4 + (x & 3)] - 0.5;
        // pattern rule: ink, 50% checker, 25% dots, paper; flat tone areas instead of a gradient of dither
        if (st.patterns) { const k = Math.min(3, Math.floor(v * 4)); out = st.lum[[0, (x + y) & 1, (x & 1) | (y & 1), 1][k]]; }
        else out = st.lum[Math.max(0, Math.min(n - 1, Math.round(v * (n - 1) + t * st.dither)))];
      } else out = nearestLab(labs[i], st.perObject ? sub[obj[i]] : st.set);
      p.d[i] = out;
    }
    // outline policy: silhouette pixels of tree, house and hero
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const i = y * SW + x, o = obj[i];
      if (o < 2) continue;
      const nb = [[x, y - 1, 1], [x - 1, y, 1], [x + 1, y, 0], [x, y + 1, 0]].find(([a, b]) => a >= 0 && b >= 0 && a < SW && b < SH && obj[b * SW + a] !== o);
      if (!nb) continue;
      if (st.outline === 'ink') p.d[i] = st.lum ? st.lum[0] : 0;
      else p.d[i] = nearestLab(lab(dark(col[i], nb[2] ? 0.62 : 0.38)), st.set); // lit side (top/left) gets a lighter line
    }
    return { p, sub };
  }

  Kit.register('styles', { title: 'One scene, five style rule sets', fit: 'prebake' }, host => {
    const W = 192, H = 104;
    const c = Kit.canvas(host, W, H);
    const scene = paintScene();
    const draw = name => {
      const st = STYLES[name];
      const { p: art, sub } = printStyle(scene, st);
      const p = new Pix(W, H).fill(1);
      p.rect(3, 3, SW + 2, SH + 2, 2);
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) p.set(4 + x, 4 + y, art.d[y * SW + x]);
      let y = 6;
      st.lines.forEach((l, k) => { text(p, l, 108, y, k ? 5 : 7); y += k ? 7 : 9; });
      const used = [...new Set(art.d)].sort((a, b) => KLAB[a][0] - KLAB[b][0]);
      y += 3;
      if (st.perObject) {
        ['SKY', 'LAND', 'TREE', 'HOUSE', 'HERO'].forEach((nm, o) => {
          text(p, nm, 108, y + 1, 4);
          sub[o].forEach((ci, k) => p.rect(136 + k * 9, y, 8, 7, ci));
          y += 9;
        });
      } else {
        text(p, 'USED ' + used.length, 108, y, 4); y += 8;
        used.forEach((ci, k) => p.rect(108 + (k % 8) * 10, y + Math.floor(k / 8) * 8, 9, 7, ci));
      }
      c.put(p);
    };
    const b = Kit.bar(host);
    b.tabs(Object.keys(STYLES), draw, 'Hi-bit');
    b.note('The scene is painted once in free color (left-lit shapes and object ids). Each style is just rules: a locked palette, how colors map onto it (by lightness, nearest in OKLab, or best 3 inks per object), an outline policy and a dither policy.');
    draw('Hi-bit');
  });
})();
