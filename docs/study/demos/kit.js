// kit.js: the shared kit every demo in the study uses (docs/study).
// Seeds, noise, a fixed palette, pixel canvases scaled by whole numbers, small controls,
// and a fixed-step loop that sleeps when its demo is off screen. No dependencies.
'use strict';
(() => {
  const Demos = window.Demos = window.Demos || {};

  // ---- seeds ----
  // mulberry32: a small fast seeded generator. rng() gives [0,1).
  function rng(seed) {
    let a = (typeof seed === 'string' ? hashStr(seed) : seed >>> 0) || 1;
    const r = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)); // inclusive
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.chance = p => r() < p;
    r.range = (lo, hi) => lo + r() * (hi - lo);
    return r;
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // hash2: a stateless integer hash of a lattice point, [0,1). Same inputs, same answer, any order.
  function hash2(x, y, seed = 0) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---- noise ----
  // 2D gradient (Perlin-style) noise on a hashed lattice, roughly [-1,1].
  function grad(ix, iy, seed, x, y) {
    const a = hash2(ix, iy, seed) * Math.PI * 2;
    return Math.cos(a) * (x - ix) + Math.sin(a) * (y - iy);
  }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function noise2(x, y, seed = 0) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const sx = fade(x - x0), sy = fade(y - y0);
    const n0 = grad(x0, y0, seed, x, y), n1 = grad(x0 + 1, y0, seed, x, y);
    const n2 = grad(x0, y0 + 1, seed, x, y), n3 = grad(x0 + 1, y0 + 1, seed, x, y);
    const a = n0 + (n1 - n0) * sx, b = n2 + (n3 - n2) * sx;
    return (a + (b - a) * sy) * 1.41;
  }
  // fractal Brownian motion: octaves of noise, each twice the frequency and `gain` the amplitude.
  function fbm(x, y, seed = 0, oct = 5, lac = 2, gain = 0.5) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += amp * noise2(x * f, y * f, seed + i * 101); norm += amp; amp *= gain; f *= lac; }
    return s / norm;
  }

  // ---- palette ----
  // One 32-color palette for the whole page, in ramps (dark to light) so demos can shade by index.
  // Hand-picked for this page; hue shifts warm toward the light and cool toward the dark.
  const PAL = [
    '#0e0b16', '#1d1a2f', '#2f2b4a', '#4a4566', '#6e6a8a', '#9b98b0', '#cdcbd9', '#f4f1ea', // 0-7 greys (ink to paper)
    '#3a1424', '#6e2132', '#a8333a', '#d9583f', '#f08d4f', '#f7c46c',                         // 8-13 reds to amber
    '#14301f', '#1f5131', '#2f7a3b', '#5aa546', '#9ccf5a', '#dbee8a',                         // 14-19 greens
    '#0f2340', '#163f6b', '#1f6aa0', '#2fa0c8', '#6fd0de', '#bff0ea',                         // 20-25 blues
    '#3b2318', '#62402a', '#8f6440', '#bd8f5e',                                               // 26-29 browns
    '#5b2f6e', '#b464b0',                                                                     // 30-31 violets
  ];
  const RAMPS = {
    grey: [0, 1, 2, 3, 4, 5, 6, 7], red: [0, 8, 9, 10, 11, 12, 13, 7], green: [0, 14, 15, 16, 17, 18, 19, 7],
    blue: [0, 20, 21, 22, 23, 24, 25, 7], brown: [0, 26, 27, 28, 29, 13, 7], violet: [0, 1, 30, 31, 12, 13, 7],
  };
  const RGB = PAL.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  // nearest palette index to an rgb triple (weighted distance, cheap and good enough here).
  function nearest(r, g, b, set = null) {
    let best = 0, bd = Infinity;
    const list = set || RGB.map((_, i) => i);
    for (const i of list) {
      const c = RGB[i], dr = r - c[0], dg = g - c[1], db = b - c[2];
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---- pixel canvases ----
  // A Pix is a w×h buffer of palette indexes (-1 is clear) that blits to a canvas scaled by a whole number.
  class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Int16Array(w * h).fill(-1); }
    get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.d[y * this.w + x]; }
    set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
    fill(c) { this.d.fill(c); return this; }
    rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); }
    // write to an ImageData (or a fresh one), honoring an optional palette override for swaps/cycling.
    toImage(pal = RGB, img = null) {
      img = img || new ImageData(this.w, this.h);
      const o = img.data;
      for (let i = 0; i < this.d.length; i++) {
        const c = this.d[i], k = i * 4;
        if (c < 0) { o[k + 3] = 0; continue; }
        const p = pal[c]; o[k] = p[0]; o[k + 1] = p[1]; o[k + 2] = p[2]; o[k + 3] = 255;
      }
      return img;
    }
  }

  // canvas(host, w, h, opts): a pixel canvas at w×h that shows at the largest whole-number scale fitting the host
  // (never below 1, at most opts.max). Returns {cv, g, w, h, scale, put(pix|ImageData)}.
  function canvas(host, w, h, opts = {}) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h; cv.className = 'px';
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    host.appendChild(cv);
    const out = { cv, g, w, h, scale: 1 };
    const fit = () => {
      const cs = getComputedStyle(host);
      const inner = (host.clientWidth || w) - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      const avail = Math.max(1, inner - 2);
      const dpr = window.devicePixelRatio || 1;
      // whole device pixels per art pixel, then back to CSS pixels
      let s = Math.max(1, Math.floor(avail * dpr / w));
      if (opts.max) s = Math.min(s, Math.round(opts.max * dpr));
      out.scale = s / dpr;
      cv.style.width = (w * s / dpr) + 'px';
      cv.style.height = (h * s / dpr) + 'px';
    };
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(host);
    out.put = (src, pal) => {
      if (src instanceof Pix) g.putImageData(src.toImage(pal), 0, 0);
      else g.putImageData(src, 0, 0);
    };
    // pointer position in art pixels
    out.at = e => {
      const r = cv.getBoundingClientRect();
      return [Math.floor((e.clientX - r.left) / r.width * w), Math.floor((e.clientY - r.top) / r.height * h)];
    };
    return out;
  }

  // ---- controls ----
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'on') for (const ev in attrs.on) n.addEventListener(ev, attrs.on[ev]);
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    for (const kid of kids) n.append(kid);
    return n;
  }
  let uid = 0;
  // bar(host): a row of controls under a demo. Each adder returns the control.
  function bar(host) {
    const row = el('div', { class: 'ctl' });
    host.appendChild(row);
    return {
      row,
      button(label, fn) { const b = el('button', { type: 'button', on: { click: fn } }, label); row.append(b); return b; },
      // tabs: one active of several; fn(value) on change
      tabs(options, fn, start = options[0]) {
        const grp = el('div', { class: 'tabs', role: 'group' });
        const btns = options.map(o => {
          const b = el('button', { type: 'button', 'aria-pressed': String(o === start), on: { click: () => {
            btns.forEach(x => x.setAttribute('aria-pressed', String(x === b))); fn(o);
          } } }, o);
          return b;
        });
        btns.forEach(b => grp.append(b)); row.append(grp); return grp;
      },
      slider(label, min, max, step, val, fn) {
        const id = 'c' + (++uid);
        const out = el('output', { for: id }, String(val));
        const s = el('input', { type: 'range', id, min, max, step, value: val, on: { input: () => { out.textContent = s.value; fn(+s.value); } } });
        row.append(el('label', { for: id }, label + ' ', s, ' ', out)); return s;
      },
      check(label, val, fn) {
        const id = 'c' + (++uid);
        const c = el('input', { type: 'checkbox', id, on: { change: () => fn(c.checked) } }); c.checked = val;
        row.append(el('label', { for: id }, c, ' ' + label)); return c;
      },
      // seed: shows the seed and a New seed button; fn(seed) on change
      seed(start, fn) {
        let s = start;
        const show = el('code', {}, String(s));
        const b = el('button', { type: 'button', on: { click: () => { s = ((Math.imul(s, 1103515245) + 12345) >>> 0) % 100000; show.textContent = String(s); fn(s); } } }, 'New seed');
        row.append(b, el('span', { class: 'seed' }, 'seed ', show)); return { get: () => s };
      },
      note(text) { const n = el('span', { class: 'note' }, text); row.append(n); return n; },
    };
  }

  // ---- loop ----
  // loop(host, step, draw, hz): fixed-step updates at hz, draw once per animation frame,
  // paused while the host is off screen. With reduced motion it draws one frame and waits for a click to step.
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop(host, step, draw, hz = 30) {
    let on = false, last = 0, acc = 0, raf = 0, t = 0;
    const dt = 1 / hz;
    const frame = now => {
      if (!on) return;
      acc += Math.min(0.25, (now - last) / 1000); last = now;
      while (acc >= dt) { step(dt, t++); acc -= dt; }
      draw(t);
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (on || reduced) return; on = true; last = performance.now(); raf = requestAnimationFrame(frame); };
    const stop = () => { on = false; cancelAnimationFrame(raf); };
    draw(t);
    if (reduced) host.addEventListener('click', () => { step(dt, t++); draw(t); });
    else if (window.IntersectionObserver) new IntersectionObserver(es => es[es.length - 1].isIntersecting ? start() : stop()).observe(host);
    else start();
    return { start, stop, reduced };
  }

  // register(name, meta, mount): meta = {title, fit} where fit says how it would run in Tycho:
  // 'per-frame' (fits the GPU stand-in), 'prebake' (paint once offscreen), 'shader' (needs real GPU work).
  const registry = [];
  function register(name, meta, mount) { Demos[name] = { meta, mount }; registry.push(name); }
  function mountAll() {
    document.querySelectorAll('[data-demo]').forEach(host => {
      const d = Demos[host.dataset.demo];
      if (!d) { host.textContent = 'Demo "' + host.dataset.demo + '" is missing.'; return; }
      try { d.mount(host); } catch (e) { host.textContent = 'This demo failed to start: ' + e.message; console.error(e); }
    });
  }

  window.Kit = { rng, hash2, hashStr, noise2, fbm, PAL, RGB, RAMPS, nearest, Pix, canvas, el, bar, loop, register, mountAll, reduced };
})();
