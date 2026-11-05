// weather.js: Weather. A study demo, using fx-shared.js.
(() => {
  const { PAL, Pix, W, H, toCanvas, tint, reprint, BAYER4, cottage } = StudyShared.fx;
  // =====================================================================
  // 11. weather: rain, snow, fog and fireflies over one scene
  // =====================================================================
  Kit.register('weather', { title: 'Weather', fit: 'per-frame' }, host => {
    const c = Kit.canvas(host, W, H), g = c.g;
    const base = cottage();
    const night = tint([0.22, 0.25, 0.48], [3, 3, 12]); night[25] = 13; night[7] = 5;
    const S = {
      Rain: toCanvas(reprint(base, tint([0.62, 0.66, 0.74], [8, 10, 18]))),
      Snow: toCanvas(reprint(base, tint([0.85, 0.92, 1.05], [30, 34, 44]))),
      Fog: toCanvas(reprint(base, tint([0.62, 0.64, 0.68], [64, 66, 72]))),
      Fireflies: toCanvas(reprint(base, night)),
    };
    // snow settling: five prebaked stages; tops of things whiten first, then the meadow fills in
    const snowy = (() => {
      const lit = new Set([10, 11, 12, 17, 18, 19, 28, 29]), any = new Set([9, 10, 11, 12, 15, 16, 17, 18, 19, 26, 27, 28, 29]);
      const sp = reprint(base, tint([0.85, 0.92, 1.05], [30, 34, 44]));
      return [0, 1, 2, 3, 4].map(s => {
        const q = new Pix(W, H);
        for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
          const v = base.get(x, y); if (!any.has(v)) continue;
          let depth = 0; while (depth < 4 && any.has(base.get(x, y - depth - 1))) depth++;
          const onTop = depth < s, fill = y > 64 && v >= 15 && v <= 18 && BAYER4[(y & 3) * 4 + (x & 3)] < s * 0.2 - 0.05;
          if (onTop || fill) q.set(x, y, lit.has(v) ? 7 : 6);
        }
        return toCanvas(q);
      });
    })();
    // fog: two tiling layers of wavy horizontal banks, as pattern dither (checker core, sparse grid rim), not a blend
    const fogLayer = (seed, ink, mid, thick) => {
      const q = new Pix(256, H);
      for (let x = 0; x < 256; x++) {
        const a = x / 256 * Math.PI * 2;
        const yc = mid + 3 * Math.sin(a * 2 + seed) + 2 * Math.sin(a * 5 + seed * 3);
        const hh = thick * (0.7 + 0.5 * (Kit.noise2(Math.cos(a) * 1.5, Math.sin(a) * 1.5, seed) + 0.5));
        for (let y = 0; y < H; y++) {
          const cover = Math.exp(-(((y - yc) / hh) ** 2));
          const on = cover > 0.55 ? (x + y) % 2 === 0 : cover > 0.25 ? (x % 2 === 0 && y % 2 === 0) : false;
          if (on) q.set(x, y, ink);
        }
      }
      return toCanvas(q);
    };
    const fogs = [fogLayer(3, 6, 66, 7), fogLayer(8, 7, 92, 9)];
    let mode = 'Rain', t0 = 0;
    const px = (x, y, ci) => { g.fillStyle = PAL[ci]; g.fillRect(x, y, 1, 1); };
    const draw = t => {
      const tt = t - t0;
      g.drawImage(S[mode], 0, 0);
      if (mode === 'Rain') {
        for (let i = 0; i < 110; i++) {
          const gy = 62 + Math.floor(Kit.hash2(i, 1, 4) * 46), v = 4 + Kit.hash2(i, 2, 4) * 2;
          const period = gy + 30, s = (tt * v + Kit.hash2(i, 3, 4) * period) % period, y = Math.floor(s - 16);
          const x0 = Math.floor(Kit.hash2(i, 4, 4) * (W + 30)) - 10, x = x0 - Math.floor(y * 0.3);
          if (y < gy) { g.fillStyle = PAL[i % 3 ? 5 : 6]; g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y - 2, 1, 2); g.fillRect(x + 2, y - 4, 1, 1); }
          else if (y < gy + 8) {
            const k = (y - gy) >> 2, sx = x0 - Math.floor(gy * 0.3);
            if (k === 0) { px(sx - 1, gy - 1, 6); px(sx + 1, gy - 1, 6); }
            else { px(sx - 2, gy - 2, 5); px(sx + 2, gy - 2, 5); px(sx, gy, 5); }
          }
        }
      } else if (mode === 'Snow') {
        g.drawImage(snowy[Math.min(4, Math.floor(tt / 70))], 0, 0);
        for (let i = 0; i < 90; i++) {
          const near = Kit.hash2(i, 1, 6) < 0.3, v = near ? 0.7 : 0.35 + Kit.hash2(i, 2, 6) * 0.2;
          const y = Math.floor((tt * v + Kit.hash2(i, 3, 6) * (H + 10)) % (H + 10)) - 5;
          const x = Math.floor(((Kit.hash2(i, 4, 6) * (W + 20) + Math.sin(tt * 0.05 + i) * (near ? 3 : 1.5) + tt * 0.15) % (W + 20) + W + 20) % (W + 20)) - 10;
          g.fillStyle = PAL[7]; g.fillRect(x, y, near ? 2 : 1, near ? 2 : 1);
        }
      } else if (mode === 'Fog') {
        for (const [k, f] of fogs.entries()) { const o = Math.floor(tt * (k ? 0.5 : 0.22)) % 256; g.drawImage(f, -o, 0); g.drawImage(f, 256 - o, 0); }
      } else {
        for (let i = 0; i < 18; i++) {
          const bx = 20 + Kit.hash2(i, 1, 2) * 160, by = 60 + Kit.hash2(i, 2, 2) * 40;
          const x = Math.round(bx + 12 * Math.sin(tt * (0.013 + Kit.hash2(i, 3, 2) * 0.02) + i) + 4 * Math.sin(tt * 0.05 + i * 2));
          const y = Math.round(by + 6 * Math.sin(tt * (0.017 + Kit.hash2(i, 4, 2) * 0.02) + i * 3));
          const ph = (tt * (0.012 + Kit.hash2(i, 5, 2) * 0.01) + Kit.hash2(i, 6, 2)) % 1;
          if (ph > 0.55) continue;
          const bright = ph < 0.4;
          if (bright) { px(x - 1, y, 16); px(x + 1, y, 16); px(x, y - 1, 16); px(x, y + 1, 16); }
          px(x, y, bright ? 19 : 17);
        }
      }
    };
    const b = Kit.bar(host);
    b.tabs(['Rain', 'Snow', 'Fog', 'Fireflies'], v => { mode = v; t0 = tick; draw(tick); });
    b.note('Each mood is a palette reprint of the same scene, made once. Particles are hashed from their index and the tick (no state, no Math.random), snapped to whole pixels: rain streaks with splashes where each drop lands, snow with sway and five prebaked settling stages, fog as two drifting wavy banks of pattern dither (checker core, sparse rim), fireflies blinking on Lissajous paths.');
    let tick = 0;
    Kit.loop(host, () => {}, t => { tick = t; draw(t); }, 30);
  });
})();
