// worlds-shared.js: the helpers the worlds demos share (terrain, wfc, dungeons, autotile, town, poisson), loaded before any of them.
// Each helper is exported on StudyShared, and a demo takes the ones it uses. Every random choice comes from
// Kit.rng, Kit.hash2 or Kit.noise2, so a seed always rebuilds the same picture.
(() => {
  const PAL = Kit.PAL;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
  const D8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

  // Gradient noise like Kit.noise2, but picking one of eight gradients from Kit.hash2 instead of calling cos and sin,
  // which makes it about twice as fast. The terrain and the chunks call it hundreds of thousands of times.
  const GX = [1, -1, 0, 0, 0.7071, -0.7071, 0.7071, -0.7071], GY = [0, 0, 1, -1, 0.7071, 0.7071, -0.7071, -0.7071];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function gnoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    let k = (Kit.hash2(x0, y0, seed) * 8) | 0; const a = GX[k] * fx + GY[k] * fy;
    k = (Kit.hash2(x0 + 1, y0, seed) * 8) | 0; const b = GX[k] * (fx - 1) + GY[k] * fy;
    k = (Kit.hash2(x0, y0 + 1, seed) * 8) | 0; const c = GX[k] * fx + GY[k] * (fy - 1);
    k = (Kit.hash2(x0 + 1, y0 + 1, seed) * 8) | 0; const d = GX[k] * (fx - 1) + GY[k] * (fy - 1);
    const sx = fade(fx), sy = fade(fy), ab = a + (b - a) * sx, cd = c + (d - c) * sx;
    return (ab + (cd - ab) * sy) * 1.41;
  }
  function fbm(x, y, seed, oct) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += amp * gnoise(x * f, y * f, seed + i * 101); norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  }

  // A Pix painted once into an offscreen canvas, so a frame can drawImage it.
  function bake(pix) {
    const c = document.createElement('canvas');
    c.width = pix.w; c.height = pix.h;
    c.getContext('2d').putImageData(pix.toImage(), 0, 0);
    return c;
  }

  // A 3x5 pixel font for labels inside the art. Each glyph is five rows of three bits.
  const GLYPH = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
    G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
    S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2], 9: [2, 5, 3, 1, 6],
    '-': [0, 0, 7, 0, 0], ',': [0, 0, 0, 2, 4], '.': [0, 0, 0, 0, 2], ' ': [0, 0, 0, 0, 0],
  };
  function glyphs(s, x, y, put) {
    for (let i = 0; i < s.length; i++) {
      const g = GLYPH[s[i].toUpperCase()] || GLYPH[' '];
      for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (g[r] & (4 >> b)) put(x + i * 4 + b, y + r);
    }
  }
  const textW = s => s.length * 4 - 1;
  function textPix(pix, s, x, y, c, sh = -1) {
    if (sh >= 0) glyphs(s, x + 1, y + 1, (a, b) => pix.set(a, b, sh));
    glyphs(s, x, y, (a, b) => pix.set(a, b, c));
  }
  function textG(g, s, x, y, c, sh = -1) {
    if (sh >= 0) { g.fillStyle = PAL[sh]; glyphs(s, x + 1, y + 1, (a, b) => g.fillRect(a, b, 1, 1)); }
    g.fillStyle = PAL[c]; glyphs(s, x, y, (a, b) => g.fillRect(a, b, 1, 1));
  }

  // Sprites from strings: each character names a palette index through a key; '.' is clear.
  function sprite(pix, rows, key, x, y, clip) {
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
      const k = rows[j][i];
      if (k === '.' || key[k] === undefined) continue;
      const px = x + i, py = y + j;
      if (clip && (px < clip[0] || py < clip[1] || px >= clip[2] || py >= clip[3])) continue;
      pix.set(px, py, key[k]);
    }
  }

  // Breadth-first distances over passable cells (4-connected); -1 where unreachable.
  function bfs(w, h, pass, starts) {
    const d = new Int32Array(w * h).fill(-1), q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    for (const s of starts) { if (d[s] < 0) { d[s] = 0; q[qt++] = s; } }
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (d[j] >= 0 || !pass[j]) continue;
        d[j] = d[i] + 1; q[qt++] = j;
      }
    }
    return d;
  }
  const farthest = d => { let b = 0; for (let i = 1; i < d.length; i++) if (d[i] > d[b]) b = i; return b; };
  // Walk back down a distance field from `end` to its source.
  function route(w, d, end) {
    const out = [end];
    let i = end;
    while (d[i] > 0) {
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of D4) {
        const j = (y + dy) * w + x + dx;
        if (x + dx >= 0 && x + dx < w && j >= 0 && j < d.length && d[j] === d[i] - 1) { i = j; break; }
      }
      out.push(i);
    }
    return out;
  }

  // A row of color swatches with names, under a canvas.
  function legend(host) {
    const row = Kit.el('div', { class: 'ctl' });
    host.append(row);
    return items => {
      row.textContent = '';
      for (const [name, c] of items) {
        row.append(Kit.el('span', { class: 'note', style: 'display:inline-flex;align-items:center;gap:4px;opacity:.9;flex-basis:auto' },
          Kit.el('span', { style: `display:inline-block;width:10px;height:10px;background:${PAL[c]};box-shadow:0 0 0 1px ${PAL[0]}` }), name));
      }
    };
  }

  // A seed shown in the bar that code can also advance (the kit's seed control can't be set from outside).
  function seedCtl(bar, start, fn) {
    let s = start;
    const show = Kit.el('code', {}, String(s));
    const next = () => { s = ((Math.imul(s, 1103515245) + 12345) >>> 0) % 100000; show.textContent = String(s); fn(s); };
    bar.button('New seed', next);
    bar.row.append(Kit.el('span', { class: 'seed' }, 'seed ', show));
    return { next, get: () => s };
  }

  window.StudyShared = window.StudyShared || {};
  StudyShared.worlds = { PAL, clamp, D4, D8, GX, GY, fade, gnoise, fbm, bake, GLYPH, glyphs, textW, textPix, textG, sprite, bfs, farthest, route, legend, seedCtl };
})();
