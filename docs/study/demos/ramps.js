// ramps.js: OKLCH ramp generator. A study demo, using looks-shared.js.
(() => {
  const { RGB, Pix, text, ellipse, hueRamp, naiveRamp, sphere, rampTree } = StudyShared.looks;
  Kit.register('ramps', { title: 'OKLCH ramp generator', fit: 'prebake' }, host => {
    const W = 192, H = 96;
    const c = Kit.canvas(host, W, H);
    const st = { hue: 145, n: 6, shift: 40, chroma: 0.14 };
    const draw = () => {
      const { hue, n, shift, chroma } = st;
      const pal = [...hueRamp(hue, n, shift, chroma), ...naiveRamp(hue, n, chroma), RGB[1], RGB[5], RGB[2]];
      const BG = 2 * n, TX = 2 * n + 1, LN = 2 * n + 2;
      const p = new Pix(W, H).fill(BG);
      for (let y = 0; y < H; y++) p.set(96, y, LN);
      [['OKLCH + HUE SHIFT', 0], ['MIX BLACK / WHITE', n]].forEach(([label, base], k) => {
        const x0 = k * 96;
        text(p, label, x0 + 48 - label.length * 2, 3, TX);
        const sw = Math.floor(84 / n), sx = x0 + 48 - (sw * n) / 2;
        for (let i = 0; i < n; i++) p.rect(sx + i * sw, 11, sw, 10, base + i);
        ellipse(p, x0 + 32, 79, 15, 3, base);
        ellipse(p, x0 + 72, 80, 11, 2.5, base);
        sphere(p, x0 + 28, 55, 18, base, n);
        rampTree(p, x0 + 72, 55, base, n);
      });
      c.put(p, pal);
    };
    const b = Kit.bar(host);
    b.slider('Hue', 0, 359, 1, st.hue, v => { st.hue = v; draw(); });
    b.slider('Steps', 3, 9, 1, st.n, v => { st.n = v; draw(); });
    b.slider('Hue shift', 0, 60, 1, st.shift, v => { st.shift = v; draw(); });
    b.slider('Chroma', 0.04, 0.24, 0.01, st.chroma, v => { st.chroma = v; draw(); });
    b.note('Left: lightness in even OKLab steps, chroma peaking mid-ramp, shadows turned toward blue-violet and highlights toward yellow, kept in sRGB by lowering chroma. Right: the middle color mixed with black and white, as a brightness slider does.');
    draw();
  });
})();
