// dither.js: Dithering to N inks. A study demo, using looks-shared.js.
(() => {
  const { Pix, text, KLAB, lambert, BAYER4 } = StudyShared.looks;
  // Void-and-cluster (Ulichney 1993) on a 32x32 torus: a true blue-noise threshold map, about 20 ms to build.
  function voidCluster(N, seed) {
    const sz = N * N, sig2 = 2 * 1.5 * 1.5;
    const K = new Float32Array(sz);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = Math.min(x, N - x), dy = Math.min(y, N - y);
      K[y * N + x] = Math.exp(-(dx * dx + dy * dy) / sig2);
    }
    const E = new Float32Array(sz), B = new Uint8Array(sz);
    const add = (p, s) => {
      const px = p % N, py = (p / N) | 0;
      for (let y = 0; y < N; y++) { const ky = ((y - py + N) % N) * N; for (let x = 0; x < N; x++) E[y * N + x] += s * K[ky + (x - px + N) % N]; }
    };
    const pick = (want, sign) => { let best = -1, bv = Infinity; for (let i = 0; i < sz; i++) if (B[i] === want && sign * E[i] < bv) { bv = sign * E[i]; best = i; } return best; };
    const tightest = () => pick(1, -1), voidest = () => pick(0, 1);
    const r = Kit.rng(seed), ones = Math.floor(sz * 0.1);
    for (let k = 0; k < ones;) { const p = r.int(0, sz - 1); if (!B[p]) { B[p] = 1; add(p, 1); k++; } }
    for (let it = 0; it < sz * 2; it++) {
      const t = tightest(); B[t] = 0; add(t, -1);
      const v = voidest(); if (v === t) { B[t] = 1; add(t, 1); break; }
      B[v] = 1; add(v, 1);
    }
    const proto = B.slice(), protoE = E.slice(), rank = new Int32Array(sz);
    for (let n = ones; n > 0;) { const t = tightest(); B[t] = 0; add(t, -1); rank[t] = --n; }
    B.set(proto); E.set(protoE);
    for (let n = ones; n < sz; n++) { const v = voidest(); B[v] = 1; add(v, 1); rank[v] = n; }
    return Float32Array.from(rank, v => (v + 0.5) / sz);
  }
  let BLUE = null;

  Kit.register('dither', { title: 'Dithering to N inks', fit: 'prebake' }, host => {
    const W = 192, H = 94, CW = 48;
    const c = Kit.canvas(host, W, H);
    if (!BLUE) BLUE = voidCluster(32, 7);
    const PALS = { 2: [0, 7], 4: [0, 21, 23, 25], 8: [0, 20, 21, 22, 23, 24, 25, 7] };
    // the source, in column coordinates: a horizontal gradient strip and a lit sphere on a soft floor
    const field = (x, y) => {
      if (y >= 10 && y < 26 && x >= 2 && x < CW - 2) return (x - 2) / (CW - 5);
      if (y >= 30 && y < 84 && x >= 2 && x < CW - 2) {
        const dx = (x + 0.5 - 24) / 17, dy = (y + 0.5 - 54) / 17, d2 = dx * dx + dy * dy;
        if (d2 <= 1) return 0.08 + 0.92 * lambert(dx, dy, Math.sqrt(1 - d2));
        const sh = ((x + 0.5 - 27) / 17) ** 2 + ((y + 0.5 - 74) / 4) ** 2;
        return (0.18 + 0.32 * (y - 30) / 54) * (sh < 1 ? 0.45 : 1);
      }
      return null;
    };
    const draw = n => {
      const set = PALS[n], Ls = set.map(i => KLAB[i][0]);
      const L0 = Ls[0], L1 = Ls[Ls.length - 1];
      const p = new Pix(W, H).fill(1);
      // quantize a target lightness with threshold t in [0,1): pick the upper neighbor when the fraction passes t
      const q = (L, t) => {
        if (L <= Ls[0]) return set[0];
        for (let k = 0; k < Ls.length - 1; k++) if (L < Ls[k + 1]) return (L - Ls[k]) / (Ls[k + 1] - Ls[k]) > t ? set[k + 1] : set[k];
        return set[set.length - 1];
      };
      const nearest = L => { let b = 0; for (let k = 1; k < Ls.length; k++) if (Math.abs(Ls[k] - L) < Math.abs(Ls[b] - L)) b = k; return b; };
      const names = ['NEAREST', 'BAYER 4X4', 'BLUE NOISE', 'FLOYD-STEIN'];
      for (let m = 0; m < 4; m++) {
        const x0 = m * CW;
        text(p, names[m], x0 + 24 - names[m].length * 2, 2, 5);
        const err = new Float32Array((CW + 2) * 2);
        for (let y = 0; y < H; y++) {
          // Floyd–Steinberg: serpentine rows, error carried in a two-row buffer
          const rev = m === 3 && (y & 1);
          if (m === 3) { err.copyWithin(0, CW + 2); err.fill(0, CW + 2); }
          for (let k = 0; k < CW; k++) {
            const x = rev ? CW - 1 - k : k;
            const v = field(x, y); if (v == null) continue;
            const L = L0 + v * (L1 - L0);
            let out;
            if (m === 0) out = set[nearest(L)];
            else if (m === 1) out = q(L, BAYER4[(y & 3) * 4 + (x & 3)]);
            else if (m === 2) out = q(L, BLUE[(y & 31) * 32 + ((x + m * 11) & 31)]);
            else {
              const want = L + err[x + 1], j = nearest(want), e = want - Ls[j], d = rev ? -1 : 1;
              out = set[j];
              err[x + 1 + d] += e * 7 / 16;
              err[CW + 2 + x + 1 - d] += e * 3 / 16; err[CW + 2 + x + 1] += e * 5 / 16; err[CW + 2 + x + 1 + d] += e * 1 / 16;
            }
            p.set(x0 + x, y, out);
          }
        }
      }
      // the inks in use, along the bottom
      const sw = Math.floor((W - 8) / n);
      for (let i = 0; i < n; i++) p.rect(4 + i * sw, H - 7, sw - 1, 5, set[i]);
      c.put(p);
    };
    const b = Kit.bar(host);
    b.tabs(['2 inks', '4 inks', '8 inks'], v => draw(parseInt(v, 10)), '4 inks');
    b.note('Each method picks between the two inks either side of the wanted lightness (in OKLab). Blue noise is a 32×32 void-and-cluster map built at load. Floyd–Steinberg runs serpentine. Ordered patterns stay put when things move; error diffusion shimmers.');
    draw(4);
  });
})();
