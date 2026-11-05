// rotation.js: Rotating pixel sprites. A study demo, using motion-shared.js.
(() => {
  const { Pix, outline, blit, text } = StudyShared.motion;
  // =====================================================================================
  // 3. rotation: nearest neighbor against RotSprite-style (Scale2x three times, rotate, most common color)
  // =====================================================================================
  const SPR = {
    Sword: () => {
      const p = new Pix(16, 16);
      for (let y = 1; y <= 9; y++) { p.set(7, y, 7); p.set(8, y, 5); }
      p.set(7, 0, 6); p.set(8, 0, -1);
      for (let x = 4; x <= 11; x++) p.set(x, 10, x < 8 ? 13 : 12);
      for (let y = 11; y <= 13; y++) { p.set(7, y, y & 1 ? 28 : 27); p.set(8, y, 27); }
      p.rect(6, 14, 4, 1, 12); p.set(6, 14, 13);
      return outline(p, 0);
    },
    Ship: () => {
      const rows = ['.......aa.......', '......abba......', '......abba......', '.....abccba.....', '.....abccba.....', '.....abbbba.....',
        '....aabbbbaa....', '...aaabbbbaaa...', '..aaaabbbbaaaa..', '.aaa.abbbba.aaa.', '.aa..abbbba..aa.', '.a...aaaaaa...a.', '.....dd..dd.....', '......d..d......'];
      const map = { a: 10, b: 6, c: 24, d: 12 };
      const p = new Pix(16, 16);
      rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') p.set(x, y + 1, map[ch]); }));
      return outline(p, 0);
    },
    Hero: () => {
      const rows = ['....hhhhh.....', '...hhhhhhh....', '...hssssshh...', '...hsesesh....', '...sssssss....', '....sssss.....', '...ttttttt....', '..tttttttTt...',
        '..stttttTTs...', '...tttttTt....', '...bbbbbbB....', '...bb...bB....', '...bb...bB....', '..fff..fff....'];
      const map = { h: 27, s: 29, e: 0, t: 22, T: 21, b: 28, B: 27, f: 2 };
      const p = new Pix(16, 16);
      rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') p.set(x + 1, y + 1, map[ch]); }));
      return outline(p, 0);
    },
  };
  // Scale2x (EPX), treating clear (-1) as just another color
  function scale2x(s) {
    const o = new Pix(s.w * 2, s.h * 2), g = (x, y) => s.get(Math.max(0, Math.min(s.w - 1, x)), Math.max(0, Math.min(s.h - 1, y)));
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const B = g(x, y - 1), D = g(x - 1, y), E = g(x, y), F = g(x + 1, y), Hh = g(x, y + 1);
      let e0 = E, e1 = E, e2 = E, e3 = E;
      if (B !== Hh && D !== F) { if (D === B) e0 = D; if (B === F) e1 = F; if (D === Hh) e2 = D; if (Hh === F) e3 = F; }
      o.set(2 * x, 2 * y, e0); o.set(2 * x + 1, 2 * y, e1); o.set(2 * x, 2 * y + 1, e2); o.set(2 * x + 1, 2 * y + 1, e3);
    }
    return o;
  }
  function rotNearest(src, deg, D) {
    const o = new Pix(D, D), a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const dx = x + 0.5 - D / 2, dy = y + 0.5 - D / 2;
      o.set(x, y, src.get(Math.floor(ca * dx + sa * dy + src.w / 2), Math.floor(-sa * dx + ca * dy + src.h / 2)));
    }
    return o;
  }
  function rotSprite(big, srcW, srcH, deg, D) {
    const o = new Pix(D, D), a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), K = 8;
    const count = new Map();
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      count.clear();
      for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) {
        const dx = x + (i + 0.5) / K - D / 2, dy = y + (j + 0.5) / K - D / 2;
        const c = big.get(Math.floor((ca * dx + sa * dy + srcW / 2) * K), Math.floor((-sa * dx + ca * dy + srcH / 2) * K));
        count.set(c, (count.get(c) || 0) + (c === 0 ? 1.35 : 1)); // a small nudge toward the outline keeps it closed
      }
      let best = -1, bn = -1;
      for (const [c, n] of count) if (n > bn) { bn = n; best = c; }
      o.set(x, y, best);
    }
    return o;
  }
  Kit.register('rotation', { title: 'Rotating pixel sprites', fit: 'prebake' }, host => {
    const W = 160, H = 136, D = 24, ANG = [0, 15, 30, 45, 60, 75];
    const c = Kit.canvas(host, W, H);
    const st = { spr: 'Sword', angle: 37, spin: false };
    let src, big;
    const prep = () => { src = SPR[st.spr](); big = scale2x(scale2x(scale2x(src))); };
    const cell = (p, x0, y0) => { for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) p.set(x0 + x, y0 + y, (x + y) & 1 ? 3 : 4); };
    const big2 = (p, s, x0, y0) => { for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const v = s.get(x, y); if (v >= 0) p.rect(x0 + x * 2, y0 + y * 2, 2, 2, v); } };
    const draw = () => {
      const p = new Pix(W, H).fill(1);
      ANG.forEach((a, k) => {
        const x0 = 2 + k * 26, s = String(a);
        text(p, s, x0 + 12 - s.length * 2, 1, 6);
        cell(p, x0, 15); blit(p, rotNearest(src, a, D), x0, 15);
        cell(p, x0, 49); blit(p, rotSprite(big, src.w, src.h, a, D), x0, 49);
      });
      text(p, 'NEAREST NEIGHBOR', 2, 8, 12);
      text(p, 'ROTSPRITE 8X', 2, 42, 24);
      const a = Math.round(st.angle) % 360;
      text(p, 'NEAREST', 8, 79, 12); text(p, 'ROTSPRITE', 96, 79, 24); text(p, a + ' DEG', 64, 104, 6);
      for (const [x0, f] of [[8, rotNearest], [96, null]]) {
        for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) p.set(x0 + x, 86 + y, ((x >> 1) + (y >> 1)) & 1 ? 3 : 4);
        big2(p, f ? f(src, a, D) : rotSprite(big, src.w, src.h, a, D), x0, 86);
      }
      c.put(p);
    };
    prep();
    const b = Kit.bar(host);
    b.tabs(['Sword', 'Ship', 'Hero'], v => { st.spr = v; prep(); draw(); });
    const sl = b.slider('Angle', 0, 359, 1, st.angle, v => { st.angle = v; draw(); });
    b.check('Spin', false, v => { st.spin = v; });
    // spinning steps 5 degrees at 10 Hz, enough to see nearest neighbor shimmer while RotSprite holds its lines
    Kit.loop(host, () => { if (st.spin) { st.angle = (st.angle + 5) % 360; sl.value = st.angle; sl.nextSibling.nextSibling.textContent = st.angle; } }, () => { if (st.spin) draw(); }, 10);
    draw();
  });
})();
