// colorblind.js: An eight-ink palette as people with color vision deficiency see it. A study demo, using text-shared.js.
// A small scene in a palette's eight inks, side by side as simulated for protanopia, deuteranopia and tritanopia
// (Brettel 1997, libDaltonLens's matrices) and as lightness alone; a matrix of all 28 pairs, each ink on each other,
// flagging pairs whose OKLab distance falls under a threshold; and an auto-fix that pushes colliding inks apart in
// lightness, keeping their hue, until no pair is flagged. Palettes: four of Elsewhere's quests, Okabe and Ito's,
// and seeded random ones.
(() => {
  const { FONTS, drawText, hex, toHex, lab, fromLab, dE, contrast, simulate, Pix } = StudyShared.text;
  const W = 320, H = 180;
  const PALETTES = {
    'Frogs day': ['#0c2c34', '#1f7a6a', '#8cc84c', '#f0f4a8', '#d8483a', '#b87a3c', '#2a5aa0', '#f08a30'],
    'Pell sun': ['#3a1620', '#b0442c', '#f0a050', '#fff0c8', '#4a5478', '#f8c850', '#3f7a52', '#3a62b8'],
    'Road dusk': ['#1a1030', '#6a2a6a', '#a83c6a', '#e0683c', '#ffd890', '#3d7a52', '#8fbf6a', '#3f5fa8'],
    'Lighthouse lit': ['#060a24', '#1e3a78', '#7aa0c0', '#fff0a8', '#ffc84a', '#b0602c', '#e0642c', '#2c6ab0'],
    'Okabe–Ito': ['#000000', '#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7'],
  };
  const VIEWS = ['normal', 'protan', 'deutan', 'tritan', 'grey'];
  const LABEL = { normal: 'NORMAL', protan: 'PROTAN', deutan: 'DEUTAN', tritan: 'TRITAN', grey: 'GREY' };
  const NAME = { normal: 'normal vision', protan: 'protanopia', deutan: 'deuteranopia', tritan: 'tritanopia', grey: 'lightness alone' };
  const CVD = ['protan', 'deutan', 'tritan'];
  // the frame's own inks, after the 5 x 8 simulated inks: background, text, dim text, and the flag (black and white,
  // so it reads under any deficiency)
  const BG = 40, TX = 41, DIM = 42, FLAG = 43, UI = ['#16141c', '#ece8e0', '#8a8494', '#ffffff'];

  function randomPalette(seed) {
    const r = Kit.rng(seed);
    return Array.from({ length: 8 }, () => {
      const L = r.range(0.25, 0.93), C = r.range(0.03, 0.19), h = r.range(0, Math.PI * 2);
      return toHex(fromLab([L, C * Math.cos(h), C * Math.sin(h)]));
    });
  }
  // distances between every pair of inks, under each view: d[view][i][j]
  function distances(rgb) {
    const d = {};
    for (const v of VIEWS) {
      const L = rgb.map(c => lab(simulate(c, v)));
      d[v] = L.map(a => L.map(b => dE(a, b)));
    }
    return d;
  }
  // the worst distance of a pair across the three deficiencies
  const worst = (d, i, j) => Math.min(...CVD.map(v => d[v][i][j]));
  const pairs = (d, view, T) => {
    const out = [];
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const v = view === 'all' ? worst(d, i, j) : d[view][i][j];
      if (v < T) out.push([i, j, v]);
    }
    return out;
  };
  // the fix: push colliding inks apart in OKLab lightness, a little at a time, keeping hue (chroma drops only to stay in gamut)
  function autofix(rgb, T) {
    const labs = rgb.map(lab);
    let cur = rgb.slice();
    for (let it = 0; it < 300; it++) {
      const d = distances(cur), bad = pairs(d, 'all', T);
      if (!bad.length) break;
      for (const [i, j] of bad) {
        const [lo, hi] = labs[i][0] <= labs[j][0] ? [i, j] : [j, i];
        let a = 0.006, b = 0.006;
        if (labs[lo][0] - a < 0.06) { b += a; a = 0; }
        if (labs[hi][0] + b > 0.97) { a += b; b = 0; }
        labs[lo][0] = Math.max(0.06, labs[lo][0] - a); labs[hi][0] = Math.min(0.97, labs[hi][0] + b);
      }
      cur = labs.map(fromLab);
    }
    return cur;
  }

  // the test scene, 60 x 46, in roles by lightness: 0 outline ... 7 highlight; `ink(role)` gives the palette slot
  function scene(p, x0, y0, ink) {
    const set = (x, y, r) => { if (x >= 0 && y >= 0 && x < 60 && y < 46) p.set(x0 + x, y0 + y, ink(r)); };
    for (let y = 0; y < 46; y++) for (let x = 0; x < 60; x++) {
      const hill = 18 + Math.round(4 * Math.sin(x * 0.13) + 2 * Math.sin(x * 0.37));
      set(x, y, y < hill ? 6 : y < 30 ? 2 : 4);
      if (y === hill) set(x, y, 0);
    }
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 22) set(47 + x, 8 + y, 7);
    // a path
    for (let y = 30; y < 46; y++) for (let x = 0; x < 60; x++) if (Math.abs(x - 30 - (y - 30) * 0.9) < 2 + (y - 30) * 0.25) set(x, y, 5);
    // a house: walls, roof, door, outlined
    for (let y = 24; y < 36; y++) for (let x = 6; x < 22; x++) set(x, y, x === 6 || x === 21 || y === 35 ? 0 : 5);
    for (let y = 16; y < 24; y++) for (let x = 4 + (24 - y) - 8 + 8; x < 24 - (24 - y) + 8 - 8; x++) set(x, y, 1);
    for (let k = 0; k < 9; k++) { set(4 + k, 23 - k, 0); set(23 - k, 23 - k, 0); }
    for (let x = 4; x < 24; x++) set(x, 24, 0);
    for (let y = 29; y < 35; y++) for (let x = 12; x < 16; x++) set(x, y, y === 29 || x === 12 || x === 15 ? 0 : 1);
    set(9, 28, 7); set(18, 28, 7);
    // a tree
    for (let y = -7; y <= 7; y++) for (let x = -6; x <= 6; x++) { const q = x * x / 36 + y * y / 49; if (q <= 1) set(48 + x, 28 + y, q > 0.75 ? 0 : 3); }
    for (let y = 35; y < 41; y++) { set(47, y, 1); set(48, y, 1); set(46, y, 0); set(49, y, 0); }
    set(46, 25, 7); set(50, 29, 7);
    // a traveler: coat, scarf, hair
    for (let y = 33; y < 42; y++) for (let x = 33; x < 38; x++) set(x, y, x === 33 || x === 37 || y === 33 || y === 41 ? 0 : y < 36 ? 7 : y < 38 ? 3 : 6);
  }

  Kit.register('colorblind', { title: 'Eight inks under color vision deficiency', fit: 'prebake' }, host => {
    const c = Kit.canvas(host, W, H);
    const p = new Pix(W, H);
    const st = { name: 'Frogs day', seed: 1, view: 'all', T: 0.08, fix: false };
    let readout;
    const draw = () => {
      const base = st.name === 'Random' ? randomPalette(st.seed) : PALETTES[st.name];
      const orig = base.map(hex);
      const rgb = st.fix ? autofix(orig, st.T) : orig;
      const d = distances(rgb), d0 = distances(orig);
      const sims = VIEWS.map(v => rgb.map(cl => simulate(cl, v)));
      const pal = [].concat(...sims, UI.map(hex));
      // roles by lightness of the inks shown
      const order = rgb.map((cl, i) => [lab(cl)[0], i]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
      p.fill(BG);
      VIEWS.forEach((v, k) => {
        const x = 2 + k * 64;
        drawText(p, FONTS.tiny, LABEL[v], x + 30 - LABEL[v].length * 2, 2, TX);
        scene(p, x, 9, r => k * 8 + order[r]);
      });
      // the pair matrix: row ink as ground, column ink as the mark
      const view = st.view, mk = view === 'all' ? 1 : VIEWS.indexOf(view), cs = 12, mx = 12, my = 72;
      drawText(p, FONTS.tiny, 'PAIRS: ' + (view === 'all' ? 'WORST OF THREE' : LABEL[view]), 2, 58, TX);
      for (let i = 0; i < 8; i++) {
        drawText(p, FONTS.tiny, String(i), mx - 6, my + i * cs + 4, DIM);
        drawText(p, FONTS.tiny, String(i), mx + i * cs + 5, my - 7 + 1, DIM);
      }
      const bad = pairs(d, view, st.T), isBad = new Set(bad.map(([i, j]) => i * 8 + j));
      // under "worst of three", each cell shows the deficiency that does worst for that pair
      const showSlot = (i, j) => {
        if (view !== 'all') return mk * 8;
        let best = 1, bv = Infinity; CVD.forEach((v, q) => { if (d[v][i][j] < bv) { bv = d[v][i][j]; best = q + 1; } });
        return best * 8;
      };
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        const x = mx + j * cs, y = my + i * cs, s = showSlot(i, j);
        p.rect(x, y, cs - 1, cs - 1, s + i);
        if (i !== j) for (let yy = 3; yy < 8; yy++) for (let xx = 3; xx < 8; xx++) if (Math.abs(xx - 5) + Math.abs(yy - 5) <= 2) p.set(x + xx, y + yy, s + j);
        if (isBad.has(Math.min(i, j) * 8 + Math.max(i, j))) for (let q = 0; q < cs - 1; q++) {
          const col = q % 2 ? BG : FLAG;
          p.set(x + q, y, col); p.set(x + q, y + cs - 2, col); p.set(x, y + q, col); p.set(x + cs - 2, y + q, col);
        }
      }
      // swatch rows, one per view (and the palette before the fix)
      const rows = VIEWS.map((v, k) => [LABEL[v], k * 8]);
      let ry = 66;
      const sx = 140;
      drawText(p, FONTS.tiny, 'INKS AS SEEN', sx - 30, 58, TX);
      for (const [lbl, slot] of rows) {
        drawText(p, FONTS.tiny, lbl, sx - 30, ry + 2, DIM);
        for (let i = 0; i < 8; i++) p.rect(sx + i * 21, ry, 20, 9, slot + i);
        ry += 11;
      }
      // numbers
      const n0 = pairs(d0, 'all', st.T).length, n1 = pairs(d, 'all', st.T).length;
      let wi = 0, wj = 1, wv = Infinity, wk = 'protan';
      for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) for (const v of CVD) if (d[v][i][j] < wv) { wv = d[v][i][j]; wi = i; wj = j; wk = v; }
      const dark = order[0], light = order[7], cr = contrast(rgb[dark], rgb[light]);
      ry += 3;
      drawText(p, FONTS.tiny, `WORST PAIR ${wi}-${wj} ${LABEL[wk]} ${wv.toFixed(3)}`, sx - 30, ry, TX); ry += 8;
      drawText(p, FONTS.tiny, `FLAGGED PAIRS ${st.fix ? n0 + ' BEFORE, ' + n1 + ' AFTER' : n1} OF 28`, sx - 30, ry, n1 ? TX : DIM); ry += 8;
      drawText(p, FONTS.tiny, `TEXT ${dark} ON ${light}: ${cr.toFixed(1)}:1 ${cr >= 4.5 ? '(AA)' : '(UNDER 4.5)'}`, sx - 30, ry, TX); ry += 8;
      drawText(p, FONTS.tiny, `THRESHOLD ${st.T.toFixed(2)} (1 JND = 0.02)`, sx - 30, ry, DIM);
      c.put(p, pal);
      // the words
      const list = bad.slice().sort((a, b) => a[2] - b[2]).slice(0, 6).map(([i, j, v]) => {
        const where = view === 'all' ? CVD.reduce((m, q) => (d[q][i][j] < d[m][i][j] ? q : m), 'protan') : view;
        return `${i} and ${j} (${toHex(rgb[i])}, ${toHex(rgb[j])}): ${v.toFixed(3)} under ${NAME[where]}, ${d.normal[i][j].toFixed(2)} normally, lightness ${lab(rgb[i])[0].toFixed(2)} and ${lab(rgb[j])[0].toFixed(2)}`;
      });
      let words = bad.length ? `Flagged pairs (OKLab distance under ${st.T.toFixed(2)}): ${list.join('; ')}${bad.length > 6 ? `; and ${bad.length - 6} more` : ''}.` : `No pair falls under ${st.T.toFixed(2)} in this view.`;
      if (st.fix) {
        const moved = rgb.map((cl, i) => Math.abs(lab(cl)[0] - lab(orig[i])[0]));
        words += ` The fix moved ${moved.filter(m => m > 0.004).length} inks, the most by ${Math.max(...moved).toFixed(2)} in lightness: ${rgb.map(toHex).join(' ')}.`;
      }
      readout.textContent = words;
    };
    const b = Kit.bar(host);
    const tabs = b.tabs([...Object.keys(PALETTES), 'Random'], v => { st.name = v; draw(); }, st.name);
    b.button('New random', () => {
      st.name = 'Random'; st.seed = (Math.imul(st.seed, 1103515245) + 12345) >>> 0;
      tabs.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.textContent === 'Random')));
      draw();
    });
    const b2 = Kit.bar(host);
    b2.tabs(['Worst of three', 'Protan', 'Deutan', 'Tritan', 'Grey', 'Normal'], v => { st.view = v === 'Worst of three' ? 'all' : v.toLowerCase(); draw(); }, 'Worst of three');
    const b3 = Kit.bar(host);
    b3.slider('Threshold', 0.04, 0.16, 0.01, st.T, v => { st.T = v; draw(); });
    b3.check('Auto-fix lightness', false, v => { st.fix = v; draw(); });
    readout = Kit.bar(host).note('');
    draw();
  });
})();
