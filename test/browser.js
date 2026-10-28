// The pixels' parts that need a real canvas, in a page (Chromium, through the
// test kit), against the games' own copies: canvases, letter-row sprites,
// outlines, tinted, flipped and enlarged copies and flipped sprites must come
// out pixel for pixel as each game made them, and the shape painter's and
// the pixel buffer's pictures must hold exactly the pixels they painted.
// test/pixels.test.mjs holds the painting itself to the originals without a
// browser; this holds the canvas work.
//
//   node test/browser.js     (npm run test:browser; needs Playwright, or
//                             puppeteer-core with $CHROME, as the games' tests do)
'use strict';
const path = require('path');
const tk = require('../dist/testkit.cjs');
const ROOT = path.join(__dirname, '..');

// the games' originals, as they were, under names of their own
const ORIGINALS = `
// Lodestar (js/util.js, js/art.js)
function lsMakeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = false; return [c, x]; }
function lsSpriteFrom(rows, pal) { const h = rows.length, w = Math.max(...rows.map((r) => r.length)); const [c, x] = lsMakeCanvas(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.' || ch === ' ' || !pal[ch]) continue; x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); } return c; }
function lsOutlined(src, ink = '#000000') {
  const w = src.width + 2, h = src.height + 2; const [c, x] = lsMakeCanvas(w, h); x.drawImage(src, 1, 1);
  const img = x.getImageData(0, 0, w, h), d = img.data; const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 100; const mark = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!solid(i, j) && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) mark.push(j * w + i);
  const [r, g, b] = Tycho.color.hexToRgb(ink); for (const k of mark) { d[k * 4] = r; d[k * 4 + 1] = g; d[k * 4 + 2] = b; d[k * 4 + 3] = 255; } x.putImageData(img, 0, 0); return c;
}
function lsTinted(src, col) { const [c, x] = lsMakeCanvas(src.width, src.height); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; }
function lsFlipped(src) { const [c, x] = lsMakeCanvas(src.width, src.height); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }
function lsFlippedSprite(s) { return Object.assign({}, s, { c: lsFlipped(s.c), ec: lsFlipped(s.ec), ax: s.w - s.ax }); }
function lsArtFineCanvas(c, k) { const [o, x] = lsMakeCanvas(c.width * k, c.height * k); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, c.width * k, c.height * k); return o; }
// the White Dragon (js/util.js, js/spr.js)
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
function flipSprite(s) { const f = (src) => { if (!src) return null; const [c, g] = canvasOf(src.width, src.height); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c; }; return Object.assign({}, s, { c: f(s.c), e: f(s.e), ax: s.w - s.ax }); }
// Merryfolk (js/util.js, js/sprites.js)
function mfMakeCanvas(w, h, draw = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', draw ? undefined : { willReadFrequently: true }); x.imageSmoothingEnabled = false; return [c, x]; }
function mfSpriteFrom(rows, pal) { const h = rows.length, w = rows[0].length; const [c, x] = mfMakeCanvas(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = rows[j][i]; if (ch === '.' || ch === ' ' || !pal[ch]) continue; x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); } return c; }
function mfOutline(c, col = '#2a1c12', alpha = 255) {
  { const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data; let edge = false;
    for (let x = 0; x < w && !edge; x++) edge = d[x * 4 + 3] > 100 || d[((h - 1) * w + x) * 4 + 3] > 100;
    for (let y = 0; y < h && !edge; y++) edge = d[y * w * 4 + 3] > 100 || d[(y * w + w - 1) * 4 + 3] > 100;
    if (edge) { const [p, px] = mfMakeCanvas(w + 2, h + 2); px.drawImage(c, 1, 1); c = p; } }
  const ctx = c.getContext('2d'), img = ctx.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width, h = c.height;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 100; const mark = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (d[(y * w + x) * 4 + 3] > 100) continue; let r = 0, g = 0, b = 0, n = 0; for (const [i, j] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (solid(i, j)) { const k = (j * w + i) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; } if (n) mark.push(y * w + x, r / n, g / n, b / n); }
  for (let m = 0; m < mark.length; m += 4) { const i = mark[m] * 4; d[i] = mark[m + 1] * 0.42; d[i + 1] = mark[m + 2] * 0.42; d[i + 2] = mark[m + 3] * 0.42; d[i + 3] = alpha; }
  ctx.putImageData(img, 0, 0); return c;
}
function mfScale2x(src) { const [c, x] = mfMakeCanvas(src.width * 2, src.height * 2); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, src.width * 2, src.height * 2); return c; }
true`;

async function main() {
  const kit = await tk.launch();
  const server = await tk.serve(ROOT, { '/pixels.html': '<!doctype html><meta charset="utf-8"><body><script src="/dist/tycho.js"></script>' });
  const failures = [];
  try {
    const { page, errors } = await tk.open(kit, { url: server.url + 'pixels.html', ready: 'typeof Tycho !== "undefined"' });
    await page.evaluate(tk.PAGE);
    await page.evaluate(ORIGINALS);
    const out = await page.evaluate(() => {
      const fails = [], S = Tycho.sprite, P = Tycho.paint, r = new Tycho.seed.Rng(4), LS = { read: true, min: 1 };
      const same = (what, a, b) => { const x = TK.canvas(a), y = TK.canvas(b); if (x !== y) fails.push(`${what}: ${y} where the original made ${x}`); };
      const pal = { a: '#ff0000', b: '#00ff80', c: '#123456', E: '#ffffffc0', d: 'rgba(40, 90, 200, 0.5)' };
      for (let k = 0; k < 60; k++) {
        const h = r.i(1, 14), w = r.i(1, 14), ragged = k % 4 === 0;
        const rows = Array.from({ length: h }, () => Array.from({ length: ragged ? r.i(0, w + 2) : w }, () => r.pick('..abcdE ')).join(''));
        const a = lsSpriteFrom(rows, pal), b = S.spriteFrom(rows, pal, LS);
        same(`Lodestar's sprite ${k}`, a, b);
        same(`Lodestar's outline ${k}`, lsOutlined(a), S.outline(b));
        same(`Lodestar's outline ${k} in ink`, lsOutlined(a, '#40a0ff'), S.outline(b, { ink: '#40a0ff' }));
        same(`Lodestar's tint ${k}`, lsTinted(a, '#ffeedd'), S.tinted(b, '#ffeedd', LS));
        same(`Lodestar's tint ${k} (translucent)`, lsTinted(a, 'rgba(255,0,0,0.5)'), S.tinted(b, 'rgba(255,0,0,0.5)', LS));
        same(`Lodestar's flip ${k}`, lsFlipped(a), S.flipped(b, LS));
        for (const f of [2, 3, 1.5]) same(`Lodestar's enlarging ${k} by ${f}`, lsArtFineCanvas(a, f), S.enlarged(b, f, LS));
        const ls = lsFlippedSprite({ c: a, ec: lsTinted(a, '#fff'), w: a.width, h: a.height, ax: 3 }), ts = S.flipSprite({ c: b, ec: S.tinted(b, '#fff', LS), w: b.width, h: b.height, ax: 3 }, ['c', 'ec'], LS);
        same(`Lodestar's flipped sprite ${k}`, ls.c, ts.c); same(`Lodestar's flipped sprite ${k}, its glow`, ls.ec, ts.ec);
        if (ls.ax !== ts.ax || Object.keys(ls).join() !== Object.keys(ts).join()) fails.push(`Lodestar's flipped sprite ${k}: ${JSON.stringify([ts.ax, Object.keys(ts)])}`);
        const ws = flipSprite({ c: a, e: k % 2 ? null : lsTinted(a, '#0f0'), w: a.width, h: a.height, ax: 2.5, ay: 4 }), wt = S.flipSprite({ c: b, e: k % 2 ? null : S.tinted(b, '#0f0'), w: b.width, h: b.height, ax: 2.5, ay: 4 });
        same(`the White Dragon's flipped sprite ${k}`, ws.c, wt.c);
        if ((ws.e === null) !== (wt.e === null) || ws.ax !== wt.ax || Object.keys(ws).join() !== Object.keys(wt).join()) fails.push(`the White Dragon's flipped sprite ${k}: ${JSON.stringify([wt.ax, Object.keys(wt), !!wt.e])}`);
        else if (ws.e) same(`the White Dragon's flipped sprite ${k}, its glow`, ws.e, wt.e);
        if (rows[0].length) {
          const m = mfSpriteFrom(rows, pal), t = S.spriteFrom(rows, pal, { read: true, w: rows[0].length });
          same(`Merryfolk's sprite ${k}`, m, t);
          same(`Merryfolk's doubling ${k}`, mfScale2x(m), S.enlarged(t, 2, { read: true }));
          const mo = mfOutline(m, '#2a1c12', k % 3 ? 255 : 180), to = S.outline(t, { own: 0.42, alpha: k % 3 ? 255 : 180, grow: 'edge' });
          same(`Merryfolk's outline ${k}`, mo, to);
          if ((mo === m) !== (to === t)) fails.push(`Merryfolk's outline ${k}: grew where the original didn't, or the other way`);
        }
      }
      // the canvases: sizes, smoothing and how they're kept
      const [c0] = S.canvas(0, 3, LS), [c1, g1] = S.canvas(7, 5);
      if (c0.width !== 1 || c0.height !== 3 || c1.width !== 7 || g1.imageSmoothingEnabled !== false) fails.push('canvas sizes or smoothing');
      // the shape painter's and the buffer's pictures hold their pixels exactly
      for (let k = 0; k < 20; k++) {
        const sp = new S.Shapes(30, 40, k), R = Tycho.color.rampOf(['#3a6aa8', '#e8b48a'], 6);
        sp.ell(15, 12, 8, 7, R); sp.part(); sp.cap(6, 30, 24, 33, 3, 2, R, { glow: k % 2 === 0 }); sp.part(false); sp.box(3, 3, 9, 9, R, { bias: 0.1 }); sp.px(15, 39, '#ff0000', true);
        const s = sp.done(), d = s.c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, 30, 40).data;
        for (let i = 0; i < sp.c.length; i++) { const col = sp.c[i]; if (col ? d[i * 4 + 3] !== 255 || d[i * 4] !== Math.round(col[0]) && Math.abs(d[i * 4] - col[0]) > 0.5 : d[i * 4 + 3] !== 0) { fails.push(`shape sprite ${k}: pixel ${i}`); break; } }
        if (!!s.e !== sp.g.some((q) => q)) fails.push(`shape sprite ${k}: glow picture`);
        const B = new P.Pix(64, 48, 10 * k, 5, { flat: k % 2 === 0 });
        B.block(10 * k, 5, 10 * k + 40, 30, R, { drips: 0.2 }); B.area(10 * k + 5, 20, 10 * k + 60, 52, R, (x, y) => (x + y) % 9 / 9, { glow: 0.5 });
        const cv = B.canvases(), dc = cv.c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, 64, 48).data, de = cv.e && cv.e.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, 64, 48).data;
        for (let i = 0; i < B.c.length; i++) if (dc[i] !== B.c[i] || (de && de[i] !== B.g[i])) { fails.push(`buffer ${k}: byte ${i}`); break; }
      }
      return fails;
    });
    failures.push(...out);
    for (const e of errors) failures.push('page error: ' + e);
  } finally {
    await kit.close(); await server.close();
  }
  tk.finish('browser', failures);
}
main().catch((e) => { console.error(e); process.exit(1); });
