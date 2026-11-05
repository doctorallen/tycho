// doom-fire.js: Doom fire. A study demo, using fx-shared.js.
(() => {
  const { Pix, stamp, poly, BAYER4 } = StudyShared.fx;
  // =====================================================================
  // 7. doom-fire: Fabien Sanglard's write-up of the PSX Doom fire, on the page's red ramp
  // =====================================================================
  Kit.register('doom-fire', { title: 'Doom fire', fit: 'shader' }, host => {
    const FW = 160, FH = 90;
    const c = Kit.canvas(host, FW, FH);
    const fire = new Uint8Array(FW * FH), rng = Kit.rng(1993);
    const RAMP = [-1, 8, 9, 10, 11, 12, 13, 7];
    let burning = true, wind = 0, dither = false, cool = 1;
    const light = on => { for (let x = 0; x < FW; x++) fire[(FH - 1) * FW + x] = on ? 36 : 0; };
    light(true);
    // logs over the source row, painted once
    const logs = new Pix(FW, FH);
    const LG = new Pix(FW, FH);
    poly(LG, [[44, 88], [112, 80], [116, 85], [48, 93]], 27);
    poly(LG, [[50, 80], [118, 89], [114, 93], [46, 85]], 28);
    for (let x = 52; x < 112; x += 9) LG.set(x, 84, 26);
    stamp(logs, LG, 0);
    for (let x = 0; x < FW; x++) for (let y = FH - 3; y < FH; y++) if (logs.get(x, y) < 0) logs.set(x, y, 1);
    const step = () => {
      for (let x = 0; x < FW; x++) for (let y = 1; y < FH; y++) {
        const src = y * FW + x, v = fire[src];
        if (v === 0) { fire[src - FW] = 0; continue; }
        const r = Math.round(rng() * 3) & 3;           // the original: 0..3, decay on odd
        const dst = src - r + 1 + wind - FW;
        if (dst >= 0) fire[dst] = Math.max(0, v - (r & 1) - (cool && rng() < cool * 0.12 ? 1 : 0));
      }
    };
    for (let i = 0; i < 80; i++) step();
    const pix = new Pix(FW, FH);
    const draw = () => {
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
        const i = y * FW + x, v = fire[i], lg = logs.d[i];
        if (lg >= 0) { pix.d[i] = lg; continue; }
        let k = v === 0 ? 0 : dither ? Math.round(0.5 + (v - 1) / 35 * 6.5 + (BAYER4[(y & 3) * 4 + (x & 3)] - 0.5) * 0.9) : 1 + Math.floor((v - 1) / 35 * 6.99);
        k = Math.max(0, Math.min(7, k));
        pix.d[i] = k === 0 ? (y < 30 && Kit.hash2(x, y, 3) < 0.004 ? 4 : 0) : RAMP[k];
      }
      c.put(pix);
    };
    const b = Kit.bar(host);
    const btn = b.button('Douse', () => { burning = !burning; light(burning); btn.textContent = burning ? 'Douse' : 'Light'; });
    b.slider('Wind', -1, 1, 1, 0, v => { wind = v; });
    b.slider('Cooling', 0, 3, 1, cool, v => { cool = v; });
    b.check('Dither bands', dither, v => { dither = v; draw(); });
    b.note('37 heat levels in a byte buffer; each step every cell copies the cell below it, minus 0 or 1, nudged sideways at random (Cooling 0 is the original; above it adds a little extra decay). Heat maps onto 7 reds by index. Per-pixel CPU every frame (a drawPixels upload in Tycho, or a tiny shader); it cannot be prebaked as a seamless loop cheaply.');
    Kit.loop(host, () => step(), draw, 30);
  });
})();
