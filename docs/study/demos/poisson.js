// poisson.js: Scattering: random, jittered grid, Poisson disk. A study demo, using worlds-shared.js.
(() => {
  const { textW, textPix, sprite } = StudyShared.worlds;
  // =====================================================================================
  // 6. poisson: the same number of things scattered three ways.
  // =====================================================================================
  Kit.register('poisson', { title: 'Scattering: random, jittered grid, Poisson disk', fit: 'prebake' }, host => {
    const PWD = 52, PH = 64, GAP = 2, W = PWD * 3 + GAP * 2, H = PH + 9;
    const cv = Kit.canvas(host, W, H);
    let seed = 3, rad = 7, show = false;
    function bridson(r, w, h, rd, k = 30) {
      const cell = rd / Math.SQRT2, gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
      const grid = new Int32Array(gw * gh).fill(-1), pts = [], active = [];
      const add = (x, y) => { pts.push([x, y]); active.push(pts.length - 1); grid[((y / cell) | 0) * gw + ((x / cell) | 0)] = pts.length - 1; };
      add(r.range(0, w), r.range(0, h));
      while (active.length) {
        const ai = r.int(0, active.length - 1), [px, py] = pts[active[ai]];
        let found = false;
        for (let t = 0; t < k && !found; t++) {
          const a = r() * Math.PI * 2, d = rd * (1 + r());
          const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const gx = (x / cell) | 0, gy = (y / cell) | 0;
          let ok = true;
          for (let j = Math.max(0, gy - 2); j <= Math.min(gh - 1, gy + 2) && ok; j++) for (let i = Math.max(0, gx - 2); i <= Math.min(gw - 1, gx + 2); i++) {
            const q = grid[j * gw + i];
            if (q >= 0 && (pts[q][0] - x) ** 2 + (pts[q][1] - y) ** 2 < rd * rd) { ok = false; break; }
          }
          if (ok) { add(x, y); found = true; }
        }
        if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
      }
      return pts;
    }
    const SPR = [
      [['.kkk.', 'kfhfk', 'kfffk', 'kdffk', '.kdk.', '..t..', '..t..'], 2, 6], // tree, anchored at its trunk
      [['.kk.', 'kffk', 'kkkk'], 2, 2], // bush
      [['.kk.', 'kllk', 'kmmk', '.kk.'], 2, 3], // rock
      [['.a.', 'aya', '.g.'], 1, 2], // flower
    ];
    const KEY = { k: 14, f: 16, h: 18, d: 15, t: 27, l: 6, m: 5, a: 31, y: 13, g: 16 };
    const KEYS = [KEY, Object.assign({}, KEY, { f: 17 }), Object.assign({}, KEY, { k: 1 }), KEY];
    let noteEl;
    function draw() {
      const r = Kit.rng(seed);
      const poisson = bridson(Kit.rng(seed + 1), PWD, PH, rad), n = poisson.length;
      const random = [];
      for (let i = 0; i < n; i++) random.push([r.range(0, PWD), r.range(0, PH)]);
      const s = Math.sqrt(PWD * PH / n), cols = Math.max(1, Math.round(PWD / s)), rows = Math.max(1, Math.round(PH / s));
      const jitter = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) jitter.push([(i + r()) * PWD / cols, (j + r()) * PH / rows]);
      const pix = new Kit.Pix(W, H).fill(1);
      const close = [];
      [random, jitter, poisson].forEach((pts, p) => {
        const ox = p * (PWD + GAP), clip = [ox, 0, ox + PWD, PH];
        pix.rect(ox, 0, PWD, PH, 17);
        // too close: nearer than 70% of the Poisson spacing to another point
        const bad = pts.map((a, i) => pts.some((b, j) => j !== i && (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 < (rad * 0.7) ** 2));
        close.push(bad.filter(Boolean).length);
        const order = pts.map((q, i) => i).sort((a, b) => pts[a][1] - pts[b][1]);
        for (const i of order) {
          const [x, y] = pts[i], kind = Math.floor(Kit.hash2(i, p === 2 ? 0 : 0, seed + 7) * 100);
          const t = kind < 40 ? 0 : kind < 65 ? 1 : kind < 85 ? 2 : 3;
          const [rows_, ax, ay] = SPR[t], X = Math.round(ox + x), Y = Math.round(y);
          if (show && bad[i]) for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { // a red ring
            const d2 = dx * dx + dy * dy;
            if (d2 >= 13 && d2 <= 22 && X + dx >= clip[0] && X + dx < clip[2] && Y - 2 + dy < PH) pix.set(X + dx, Y - 2 + dy, 11);
          }
          if (t === 0) for (let k = 0; k < 3; k++) if (X + k < clip[2]) pix.set(X + k, Y, 15); // a short shadow
          sprite(pix, rows_, KEYS[t], X - ax, Y - ay, clip);
        }
        const label = ['RANDOM', 'JITTERED', 'POISSON'][p];
        textPix(pix, label, ox + ((PWD - textW(label)) >> 1), PH + 2, 6);
      });
      cv.put(pix);
      noteEl.textContent = `${n} objects in each panel. Too close (under 70% of the spacing): random ${close[0]}, jittered ${close[1]}, Poisson ${close[2]}.`;
    }
    const bar = Kit.bar(host);
    bar.seed(seed, v => { seed = v; draw(); });
    bar.slider('Spacing', 5, 10, 1, rad, v => { rad = v; draw(); });
    bar.check('Mark crowding', show, v => { show = v; draw(); });
    noteEl = Kit.bar(host).note('');
    draw();
  });
})();
