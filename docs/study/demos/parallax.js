// parallax.js: Parallax layers with palette haze. A study demo, using views-shared.js.
(() => {
  const { RGB, Pix, stamp, disc, toCanvas, remap, reprint, sky } = StudyShared.views;
  // =====================================================================
  // parallax: five generated layers at five speeds, hazed toward the sky by palette
  // =====================================================================
  function mpd(len, rng, base, amp, rough) {
    const h = new Float32Array(len + 1); h[0] = h[len] = base;
    for (let step = len; step > 1; step >>= 1, amp *= rough)
      for (let i = 0; i < len; i += step) h[i + step / 2] = (h[i] + h[i + step]) / 2 + rng.range(-amp, amp);
    return h;
  }
  Kit.register('parallax', { title: 'Parallax layers with palette haze', fit: 'per-frame' }, host => {
    const PW = 192, PH = 108, LW = 256;
    const c = Kit.canvas(host, PW, PH);
    const g = c.g;
    const SKY = RGB[25];
    let seed = 11, haze = true, speed = 1, layers = null;
    const build = () => {
      const r = Kit.rng(seed);
      const L = [];
      // sky: bands with a dithered seam, a pale sun
      const sky = new Pix(PW, PH);
      const sb = [22, 23, 24, 25];
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
        const k = Math.min(3, Math.floor(y / 18)), inb = y - k * 18;
        sky.set(x, y, sb[Math.min(3, k + (inb >= 16 && (x + y) % 2 ? 1 : 0))]);
      }
      for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { const d = Math.hypot(x - 8.5, y - 8.5); if (d < 8) sky.set(140 + x, 14 + y, d < 6.5 ? 7 : 13); }
      const clouds = new Pix(LW, 40);
      for (let k = 0; k < 5; k++) {
        const cx = r.int(0, LW), cy = r.int(8, 30), n = r.int(3, 5);
        for (let j = 0; j < n; j++) { const rr = r.int(3, 6); for (let dx = -2; dx <= 2; dx++) disc(clouds, (cx + j * 6 + dx * LW) % LW, cy - (j % 2) * 3, rr, 7); }
        for (let x = cx - 6; x < cx + n * 6 + 6; x++) clouds.set(((x % LW) + LW) % LW, cy + 3, -1);
      }
      // a mountain range by midpoint displacement; the face turned to the light is a step lighter
      const range = (base, amp, rough, cols, snow) => {
        const h = mpd(LW, r, base, amp, rough), p = new Pix(LW, PH);
        const sm = x => (h[(x + LW - 3) % LW] - h[(x + 3) % LW]);
        for (let x = 0; x < LW; x++) {
          const top = Math.round(h[x]), lit = sm(x) < -0.5;
          for (let y = Math.max(0, top); y < PH; y++) {
            const d = y - top;
            p.set(x, y, snow && y < snow && d < 6 ? (lit ? 7 : 6) : d < 1 ? cols[2] : lit && d < 10 ? cols[1] : cols[0]);
          }
        }
        return p;
      };
      // peaks: each a wedge with a lit west face and a shaded east face, snow on the tall ones
      const peaks = (base, count, hmin, hmax, cols, snowAbove) => {
        const pk = []; for (let i = 0; i < count; i++) pk.push([r.range(0, LW), r.range(hmin, hmax), r.range(0.55, 1.0)]);
        const p = new Pix(LW, PH);
        for (let x = 0; x < LW; x++) {
          let best = -1e9, dx = 0, tall = 0;
          for (const [c, ht, sl] of pk) {
            let d = x - c; d -= Math.round(d / LW) * LW;
            const v = ht - Math.abs(d) * sl + Kit.noise2(x / 9, base, seed) * 2;
            if (v > best) { best = v; dx = d; tall = ht; }
          }
          const top = Math.round(base - best), lit = dx < 0;
          const snow = tall > snowAbove ? Math.round(3 + (tall - snowAbove) * 0.5 + Kit.hash2(x >> 1, 7, seed) * 3) : 0;
          for (let y = Math.max(0, top); y < PH; y++) {
            const d = y - top;
            p.set(x, y, d < snow ? (lit ? 7 : 6) : d < 1 ? cols[2] : lit ? cols[1] : cols[0]);
          }
        }
        return p;
      };
      const far = peaks(72, 7, 22, 46, [4, 5, 5], 34);
      const mid = peaks(80, 9, 10, 28, [30, 31, 31], 99);
      const hills = range(76, 10, 0.45, [15, 16, 17], 0);
      // conifers on the hills and a near row of big ones
      const conifer = (p, x, base, hgt, cols) => {
        const L = new Pix(LW, PH);
        for (let j = 0; j < hgt; j++) {
          const hw = Math.floor((j % Math.max(3, hgt >> 2)) * 0.6 + j * 0.25) + 1;
          for (let i = -hw; i <= hw; i++) L.set(((x + i) % LW + LW) % LW, base - hgt + j, i < 0 ? cols[1] : cols[0]);
        }
        L.set(x, base, 26); L.set(x, base + 1, 26);
        stamp(p, L, 14);
      };
      const hh = [];
      for (let x = 0; x < LW; x++) { let y = 0; while (y < PH && hills.get(x, y) < 0) y++; hh.push(y); }
      for (let k = 0; k < 14; k++) { const x = r.int(0, LW - 1); conifer(hills, x, hh[x] + 3, r.int(8, 13), [15, 16]); }
      const near = new Pix(LW, PH);
      const nh = mpd(LW, r, 92, 5, 0.5);
      for (let x = 0; x < LW; x++) for (let y = Math.round(nh[x]); y < PH; y++) near.set(x, y, y - Math.round(nh[x]) < 1 ? 17 : 16);
      for (let k = 0; k < 6; k++) { const x = r.int(0, LW - 1); conifer(near, x, Math.round(nh[x]) + 2, r.int(22, 34), [15, 16]); }
      const fg = new Pix(LW, PH);
      for (let x = 0; x < LW; x++) {
        const top = 101 + Math.round(2 * Math.sin(x * 0.09) + Kit.hash2(x, 0, seed) * 2);
        for (let y = top; y < PH; y++) fg.set(x, y, 14);
        if (Kit.hash2(x, 1, seed) < 0.35) { const bl = 2 + Math.floor(Kit.hash2(x, 2, seed) * 5); for (let j = 0; j < bl; j++) fg.set(x, top - j, j === bl - 1 ? 15 : 14); }
        if (Kit.hash2(x, 3, seed) < 0.03) { fg.set(x, top - 4, 31); fg.set(x, top - 3, 15); }
      }
      // haze: each layer reprinted toward the sky color, more for farther layers (indexes only)
      const amounts = [0.2, 0.55, 0.35, 0.2, 0.08, 0];
      const set = [clouds, far, mid, hills, near, fg];
      const speeds = [0.06, 0.12, 0.28, 0.55, 1.0, 1.9];
      L.push(...set.map((p, k) => {
        const map = remap(cl => cl.map((v, i) => v + (SKY[i] - v) * amounts[k]));
        return { plain: toCanvas(p), hazy: toCanvas(reprint(p, map)), sp: speeds[k], y: 0 };
      }));
      layers = { sky: toCanvas(sky), L };
    };
    let x = 0;
    const draw = () => {
      g.drawImage(layers.sky, 0, 0);
      for (const l of layers.L) {
        const o = Math.floor(x * l.sp) % LW, img = haze ? l.hazy : l.plain;
        g.drawImage(img, -o, l.y); g.drawImage(img, LW - o, l.y);
      }
    };
    const b = Kit.bar(host);
    b.check('Depth haze', haze, v => { haze = v; draw(); });
    b.slider('Speed', 0, 3, 0.5, speed, v => { speed = v; });
    b.seed(seed, s => { seed = s; build(); draw(); });
    b.note('Six prebaked strips (clouds, far range, near range, hills, trees, grass) drawn twice each per frame at their own speed, snapped to whole pixels. Haze is a palette reprint per layer: each ink moved to the nearest ink toward the sky.');
    build();
    Kit.loop(host, () => { x += speed; }, draw, 30);
  });
})();
