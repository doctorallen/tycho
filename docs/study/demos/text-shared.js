// text-shared.js: the helpers the text demos share (pixel-font, talk-box, colorblind), loaded before any of them.
// Three pixel fonts drawn for the study (a 3x5 caps face, a 5x7 monospace face with descenders, and a
// proportional face squeezed from it), layout (measure, kerning, word wrap), drawing into a Kit.Pix of
// palette indexes with an outline, shadow or plate, a busy seeded background to test text over, and the
// color math the colorblind demo needs (OKLab, WCAG contrast, Brettel 1997 dichromat simulation).
(() => {
  const { Pix } = Kit;

  // ---- glyphs ----
  // Each glyph is its rows, top to bottom, '#' set and '.' clear, joined by '/'. Row 0 is the top of a capital;
  // the baseline sits under row 6; rows 7 and 8 are descenders. Lowercase letters start at row 2 (x-height 5).
  const G57 = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
    C: '.###./#...#/#..../#..../#..../#...#/.###.', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
    E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '.###./..#../..#../..#../..#../..#../.###.', J: '..###/...#./...#./...#./#..#./#..#./.##..',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/#...#/##..#/#.#.#/#..##/#...#/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    W: '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
    a: '...../...../.###./....#/.####/#...#/.####', b: '#..../#..../####./#...#/#...#/#...#/####.',
    c: '...../...../.###./#..../#..../#..../.###.', d: '....#/....#/.####/#...#/#...#/#...#/.####',
    e: '...../...../.###./#...#/#####/#..../.###.', f: '..##./.#.../###../.#.../.#.../.#.../.#...',
    g: '...../...../.####/#...#/#...#/#...#/.####/....#/.###.', h: '#..../#..../####./#...#/#...#/#...#/#...#',
    i: '..#../...../.##../..#../..#../..#../.###.', j: '...#./...../..##./...#./...#./...#./...#./#..#./.##..',
    k: '#..../#..../#..#./#.#../##.../#.#../#..#.', l: '.##../..#../..#../..#../..#../..#../.###.',
    m: '...../...../##.#./#.#.#/#.#.#/#.#.#/#...#', n: '...../...../####./#...#/#...#/#...#/#...#',
    o: '...../...../.###./#...#/#...#/#...#/.###.', p: '...../...../####./#...#/#...#/#...#/####./#..../#....',
    q: '...../...../.####/#...#/#...#/#...#/.####/....#/....#', r: '...../...../#.##./##..#/#..../#..../#....',
    s: '...../...../.####/#..../.###./....#/####.', t: '.#.../.#.../####./.#.../.#.../.#.../..##.',
    u: '...../...../#...#/#...#/#...#/#...#/.####', v: '...../...../#...#/#...#/#...#/.#.#./..#..',
    w: '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.', x: '...../...../#...#/.#.#./..#../.#.#./#...#',
    y: '...../...../#...#/#...#/#...#/#...#/.####/....#/.###.', z: '...../...../#####/...#./..#../.#.../#####',
    0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.',
    2: '.###./#...#/....#/...#./..#../.#.../#####', 3: '.###./#...#/....#/..##./....#/#...#/.###.',
    4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '..##./.#.../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...',
    8: '.###./#...#/#...#/.###./#...#/#...#/.###.', 9: '.###./#...#/#...#/.####/....#/...#./.##..',
    '.': '...../...../...../...../...../...../..#..', ',': '...../...../...../...../...../...../..#../.#...',
    '!': '..#../..#../..#../..#../..#../...../..#..', '?': '.###./#...#/....#/...#./..#../...../..#..',
    "'": '..#../..#..', '"': '.#.#./.#.#.', '-': '...../...../...../.###.', ':': '...../...../...../..#../...../...../..#..',
    ';': '...../...../...../..#../...../...../..#../.#...', '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
    ')': '.#.../..#../...#./...#./...#./..#../.#...', '/': '....#/....#/...#./..#../.#.../#..../#....',
    '+': '...../...../..#../..#../#####/..#../..#..', '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
    '*': '...../#.#.#/.###./#.#.#', '=': '...../...../...../#####/...../#####', '_': '...../...../...../...../...../...../...../#####',
    '—': '...../...../...../#####', '…': '...../...../...../...../...../...../#.#.#',
  };
  // accents, as marks placed over (or, for the cedilla, under) a base letter; Unicode NFD splits é into e + U+0301
  const MARKS = {
    '́': '..#/.#.', '̀': '#../.#.', '̂': '.#./#.#', '̈': '#.#', '̃': '.#.#/#.#.', '̊': '.#./#.#/.#.',
    '̧': '.#./##.', // cedilla (below)
  };
  // the 3x5 face: capitals, figures and a little punctuation; lowercase prints as capitals, accents are dropped
  const G35 = {
    A: '.#./#.#/###/#.#/#.#', B: '##./#.#/##./#.#/##.', C: '.##/#../#../#../.##', D: '##./#.#/#.#/#.#/##.', E: '###/#../##./#../###',
    F: '###/#../##./#../#..', G: '.##/#../#.#/#.#/.##', H: '#.#/#.#/###/#.#/#.#', I: '###/.#./.#./.#./###', J: '..#/..#/..#/#.#/.#.',
    K: '#.#/#.#/##./#.#/#.#', L: '#../#../#../#../###', M: '#.#/###/###/#.#/#.#', N: '##./#.#/#.#/#.#/#.#', O: '.#./#.#/#.#/#.#/.#.',
    P: '##./#.#/##./#../#..', Q: '.#./#.#/#.#/##./.##', R: '##./#.#/##./#.#/#.#', S: '.##/#../.#./..#/##.', T: '###/.#./.#./.#./.#.',
    U: '#.#/#.#/#.#/#.#/###', V: '#.#/#.#/#.#/#.#/.#.', W: '#.#/#.#/###/###/#.#', X: '#.#/#.#/.#./#.#/#.#', Y: '#.#/#.#/.#./.#./.#.',
    Z: '###/..#/.#./#../###', 0: '###/#.#/#.#/#.#/###', 1: '.#./##./.#./.#./###', 2: '##./..#/.#./#../###', 3: '##./..#/.#./..#/##.',
    4: '#.#/#.#/###/..#/..#', 5: '###/#../##./..#/##.', 6: '.##/#../###/#.#/###', 7: '###/..#/..#/.#./.#.', 8: '###/#.#/###/#.#/###',
    9: '###/#.#/###/..#/##.', '.': '.../.../.../.../.#.', ',': '.../.../.../.#./#..', '!': '.#./.#./.#./.../.#.', '?': '##./..#/.#./.../.#.',
    "'": '.#./.#.', '"': '#.#/#.#', '-': '.../.../###', ':': '.../.#./.../.#./...', ';': '.../.#./.../.#./#..', '(': '..#/.#./.#./.#./..#',
    ')': '#../.#./.#./.#./#..', '/': '..#/..#/.#./#../#..', '+': '.../.#./###/.#./...', '%': '#.#/..#/.#./#../#.#', '=': '.../###/.../###/...',
    '*': '#.#/.#./#.#', '—': '.../.../###', '…': '.../.../.../.../#.#',
  };

  const rowsOf = s => s.split('/');
  // trim empty columns from both sides; returns {rows, w, x0}
  function trim(rows) {
    const W = Math.max(...rows.map(r => r.length));
    let a = W, b = -1;
    for (const r of rows) for (let i = 0; i < r.length; i++) if (r[i] === '#') { a = Math.min(a, i); b = Math.max(b, i); }
    if (b < 0) return { rows: rows.map(() => ''), w: 0, x0: 0 };
    return { rows: rows.map(r => r.padEnd(W, '.').slice(a, b + 1)), w: b - a + 1, x0: a };
  }
  // the squeeze: drop the middle column where it only repeats a neighbor in every row (O, A, e, s go 4 wide; M, T, x stay 5)
  function squeeze(rows) {
    const W = Math.max(...rows.map(r => r.length));
    if (W !== 5) return rows;
    const col = c => rows.map(r => r[c] || '.').join('');
    if (col(2) === col(1) || col(2) === col(3)) return rows.map(r => r.padEnd(5, '.').slice(0, 2) + r.padEnd(5, '.').slice(3));
    return rows;
  }
  // a glyph: {rows, w, top, bottom, L[], R[]} with left and right profiles per row (first and last set column, or null)
  function glyph(rows, w) {
    const L = [], R = [];
    let top = 99, bottom = -1;
    rows.forEach((r, y) => {
      const a = r.indexOf('#'), b = r.lastIndexOf('#');
      L.push(a < 0 ? null : a); R.push(b < 0 ? null : b);
      if (a >= 0) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    });
    return { rows, w, top, bottom, L, R };
  }

  // makeFont(spec): {name, short, line, asc, space, mono, cell, kern, accents, get(ch) -> {g, marks}}
  function makeFont({ name, short, table, mono, cell, line, space, prop, accents, caps }) {
    const cache = new Map();
    const base = ch => {
      if (cache.has(ch)) return cache.get(ch);
      let s = table[ch];
      if (s === undefined && caps) s = table[ch.toUpperCase()];
      let g = null;
      if (s !== undefined) {
        let rows = rowsOf(s);
        if (prop) { const t = trim(squeeze(rows)); g = glyph(t.rows, t.w); }
        else g = glyph(rows.map(r => r.padEnd(cell, '.')), cell);
      }
      cache.set(ch, g);
      return g;
    };
    const font = { name, short, mono, cell, line, space, accents, prop: !!prop, kern: false, asc: caps ? 5 : 7 };
    // the glyph for one character, decomposed: base glyph plus accent marks (or null for no glyph)
    font.get = ch => {
      const parts = ch.normalize('NFD');
      let b = parts[0], marks = [...parts.slice(1)].filter(m => MARKS[m]);
      if (!accents) marks = [];
      let g = base(b);
      if (g && marks.length && (b === 'i' || b === 'j')) {
        // a dotless i or j under an accent
        const rows = g.rows.map((r, y) => (y < 2 ? '.'.repeat(r.length) : r));
        g = glyph(rows, g.w);
      }
      return g ? { g, marks } : null;
    };
    return font;
  }

  const FONTS = {
    tiny: makeFont({ name: 'Tiny 3×5', short: '3×5', table: G35, mono: true, cell: 3, line: 6, space: 4, caps: true, accents: false, asc: 5 }),
    mono: makeFont({ name: 'Mono 5×7', short: '5×7', table: G57, mono: true, cell: 5, line: 10, space: 6, accents: true, asc: 7 }),
    prop: makeFont({ name: 'Proportional', short: 'prop', table: G57, mono: false, cell: 5, line: 10, space: 3, prop: true, accents: true, asc: 7 }),
  };
  // the proportional face with automatic kerning on (the same glyphs; layout reads font.kern)
  FONTS.kerned = Object.assign(Object.create(FONTS.prop), { name: 'Proportional, kerned', short: 'kern', kern: true });

  // ---- layout ----
  // advance of one glyph (mono: the cell plus a gap; proportional: its width plus a gap)
  const adv = (font, ch, info) => (ch === ' ' ? font.space : !info ? font.space : font.mono ? font.cell + 1 : info.g.w + 1);
  // automatic kerning for the proportional face: close up a pair by one pixel where, row by row (and against the
  // rows above and below, so diagonals never touch), at least two clear columns would otherwise sit between them
  function kernPair(font, a, b) {
    if (!font.kern || font.mono || !a || !b) return 0;
    const A = a.g, B = b.g;
    let gap = 99;
    for (let y = 0; y < A.rows.length; y++) {
      if (A.R[y] === null) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const l = B.L[y + dy];
        if (l === null || l === undefined) continue;
        gap = Math.min(gap, (A.w - 1 - A.R[y]) + 1 + l);
      }
    }
    return gap >= 3 ? -1 : 0;
  }
  // the width of a run of text in pixels (no trailing gap)
  function measure(font, s) {
    let x = 0, prev = null;
    for (const ch of s) {
      const info = ch === ' ' ? null : font.get(ch);
      x += kernPair(font, prev, info) + adv(font, ch, info);
      prev = info;
    }
    return Math.max(0, x - (s.length && s[s.length - 1] !== ' ' ? 1 : 0));
  }
  // greedy word wrap by measured width; '\n' breaks a line
  function wrap(font, text, width) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const next = line ? line + ' ' + word : word;
        if (measure(font, next) <= width || !line) line = next;
        else { out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  }

  // ---- drawing into a Pix of indexes ----
  // each set pixel of the text (glyphs and accent marks), as fn(x, y), with the top of a capital at y
  function pixels(font, s, x, y, fn, upto = Infinity) {
    let prev = null, n = 0;
    for (const ch of s) {
      if (n++ >= upto) break;
      const info = ch === ' ' ? null : font.get(ch);
      x += kernPair(font, prev, info);
      if (info) {
        const { g, marks } = info;
        g.rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') fn(x + i, y + j); });
        for (const m of marks) {
          const mr = rowsOf(MARKS[m]), mw = mr[0].length, mx = x + Math.floor((g.w - mw) / 2);
          // marks above sit one clear row over the letter's top; the cedilla hangs under the baseline
          const my = m === '̧' ? y + 7 : y + g.top - 1 - mr.length;
          mr.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') fn(mx + i, my + j); });
        }
      }
      x += adv(font, ch, info);
      prev = info;
    }
    return x;
  }
  // drawText(pix, font, s, x, y, ink, o): o.outline (ink: a one-pixel ring all round), o.shadow (ink: one pixel down
  // and right), o.upto (characters to show, for a typewriter). Returns the x after the text.
  function drawText(pix, font, s, x, y, ink, o = {}) {
    const up = o.upto === undefined ? Infinity : o.upto;
    if (o.outline !== undefined) pixels(font, s, x, y, (px, py) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) pix.set(px + dx, py + dy, o.outline); }, up);
    if (o.shadow !== undefined) pixels(font, s, x, y, (px, py) => { pix.set(px + 1, py + 1, o.shadow); pix.set(px, py + 1, o.shadow); }, up);
    return pixels(font, s, x, y, (px, py) => pix.set(px, py, ink), up);
  }

  // ---- a busy background, to test text over: stone wall, a meadow with flowers, and water with glints ----
  // inks: {dark, deep, moss, grass, sand, rust, blue, paper}
  function busy(pix, seed, I, x0 = 0, y0 = 0, w = pix.w, h = pix.h) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const n = Kit.fbm(x / 70, y / 50, seed, 3), m = Kit.hash2(x, y, seed);
      let c;
      if (n < -0.12) { // water, with dashes
        c = ((y >> 1) + (x >> 3)) % 5 === 0 && Kit.hash2(x >> 2, y, seed + 1) < 0.5 ? I.paper : (y % 3 === 0 ? I.deep : I.blue);
      } else if (n < 0.14) { // meadow: tufts and flowers
        c = m < 0.18 ? I.moss : I.grass;
        const fx = x - (x % 7), fy = y - (y % 6), fh = Kit.hash2(fx, fy, seed + 2);
        if (fh < 0.35 && x % 7 === 3 && y % 6 === 2) c = fh < 0.15 ? I.rust : I.paper;
        if (fh < 0.35 && (x % 7 === 2 || x % 7 === 4) && y % 6 === 2) c = I.sand;
      } else { // a stone wall in offset courses, outlined
        const row = Math.floor(y / 7), off = row % 2 ? 6 : 0, col = Math.floor((x + off) / 12);
        const ex = (x + off) % 12, ey = y % 7, sh = Kit.hash2(col, row, seed + 3);
        c = ex === 0 || ey === 0 ? I.dark : ey === 1 || ex === 1 ? I.paper : sh < 0.3 ? I.rust : sh < 0.7 ? I.sand : I.deep;
        if (ey === 1 && sh >= 0.7) c = I.sand;
      }
      pix.set(x, y, c);
    }
  }

  // ---- color: sRGB, OKLab, contrast, and dichromat simulation ----
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const enc = x => { x = Math.max(0, Math.min(1, x)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)); };
  function linToLab([r, g, b]) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function labToLin([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  const lab = rgb => linToLab(rgb.map(lin));
  const inGamut = v => v.every(c => c >= -1e-4 && c <= 1.0001);
  // OKLab to sRGB bytes, keeping lightness and hue and lowering chroma until it fits
  function fromLab([L, a, b]) {
    let v = labToLin([L, a, b]);
    if (!inGamut(v)) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 20; i++) { const k = (lo + hi) / 2; if (inGamut(labToLin([L, a * k, b * k]))) lo = k; else hi = k; }
      v = labToLin([L, a * lo, b * lo]);
    }
    return v.map(enc);
  }
  const dE = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  // WCAG 2 relative luminance and contrast ratio
  const lum = rgb => { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (p, q) => { const a = lum(p), b = lum(q); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  // Brettel, Viénot & Mollon 1997, as precomputed in linear RGB by libDaltonLens (public domain, Nicolas Burrus):
  // two projection matrices and the normal of the plane that picks between them
  const BRETTEL = {
    protan: [[0.14980, 1.19548, -0.34528, 0.10764, 0.84864, 0.04372, 0.00384, -0.00540, 1.00156],
      [0.14570, 1.16172, -0.30742, 0.10816, 0.85291, 0.03892, 0.00386, -0.00524, 1.00139], [0.00048, 0.00393, -0.00441]],
    deutan: [[0.36477, 0.86381, -0.22858, 0.26294, 0.64245, 0.09462, -0.02006, 0.02728, 0.99278],
      [0.37298, 0.88166, -0.25464, 0.25954, 0.63506, 0.10540, -0.01980, 0.02784, 0.99196], [-0.00281, -0.00611, 0.00892]],
    tritan: [[1.01277, 0.13548, -0.14826, -0.01243, 0.86812, 0.14431, 0.07589, 0.80500, 0.11911],
      [0.93678, 0.18979, -0.12657, 0.06154, 0.81526, 0.12320, -0.37562, 1.12767, 0.24796], [0.03901, -0.02788, -0.01113]],
  };
  // simulate(rgb, kind): kind is 'normal', 'protan', 'deutan', 'tritan' or 'grey' (OKLab lightness alone)
  function simulate(rgb, kind) {
    if (kind === 'normal') return rgb.slice();
    if (kind === 'grey') { const L = lab(rgb)[0]; return fromLab([L, 0, 0]); }
    const [M1, M2, n] = BRETTEL[kind], v = rgb.map(lin);
    const M = v[0] * n[0] + v[1] * n[1] + v[2] * n[2] >= 0 ? M1 : M2;
    return [0, 1, 2].map(i => enc(M[i * 3] * v[0] + M[i * 3 + 1] * v[1] + M[i * 3 + 2] * v[2]));
  }

  // a 2D ellipse fill, for portraits and marks
  function ellipse(pix, cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const a = (x + 0.5 - cx) / rx, b = (y + 0.5 - cy) / ry;
      if (a * a + b * b <= 1) pix.set(x, y, c);
    }
  }

  window.StudyShared = window.StudyShared || {};
  StudyShared.text = { FONTS, MARKS, measure, wrap, drawText, busy, ellipse, hex, toHex, lab, fromLab, dE, contrast, simulate, Pix };
})();
