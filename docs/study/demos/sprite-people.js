// sprite-people.js: Paper-doll villagers. A study demo, using sprites-shared.js.
(() => {
  const { Pix, rng, blit, RAMP, SKIN, HAIR, TOP, BOT, SHOE, ACC, MET, WOOD, INK, WHITE, BLUSH, TOP2, GEM, AUTO, dollParams, Mats, renderMats, dollRamps, basket, dollFront } = StudyShared.sprites;
  // side view, facing right: same parameters, different geometry
  function dollSide(P) {
    const M = new Mats(20, 32);
    const child = P.age === 'child';
    const tl = child ? 4 : 6, ll = child ? 3 : 4 + P.tall;
    const feet = 29, L0 = feet - ll - 1, B0 = L0 - tl, T = B0 - 7;
    const longBody = P.outfit === 'robe' || P.outfit === 'dress';
    if (P.held === 'cape') for (let y = B0; y <= feet - 2; y++) M.row(y, 5 - ((y - B0) >> 3), 9, ACC, y > feet - 4 ? 0 : AUTO);
    const hairBack = { long: 7, pony: 2, curly: 3, bob: 2 }[P.hairStyle];
    if (hairBack) for (let y = T + 2; y < B0 + hairBack; y++) M.row(y, 5 + (y > B0 + 2 ? 1 : 0), 8, HAIR, y >= B0 + hairBack - 1 ? 0 : AUTO);
    if (P.hairStyle === 'pony') for (let y = T + 1; y < B0 + 3; y++) M.row(y, 4, 5, HAIR, y > B0 ? 0 : AUTO);
    // legs: back leg darker
    if (!longBody) {
      if (P.skirt) {
        for (let y = L0; y < L0 + 3; y++) M.row(y, 7 - (y > L0 ? 1 : 0), 12 + (y > L0 ? 1 : 0), BOT);
        for (let y = L0 + 3; y < feet; y++) M.row(y, 9, 10, SKIN);
      } else {
        M.row(L0, 8, 12, BOT);
        for (let y = L0 + 1; y < feet; y++) { M.row(y, 8, 9, BOT, 0); M.row(y, 10, 11, BOT); }
      }
      M.row(feet, 8, 12, SHOE);
    } else M.row(feet, 9, 12, SHOE);
    for (let y = B0; y < L0; y++) M.row(y, 8, 12, TOP);
    if (longBody) {
      const flare = P.outfit === 'dress' ? 2 : 1;
      for (let y = B0 + 3; y < feet; y++) { const e = Math.min(flare + 1, Math.floor((y - B0 - 3) * flare / 3)); M.row(y, 8 - e, 12 + e, TOP, y === feet - 1 ? 0 : AUTO); }
    }
    if (P.outfit === 'vest') for (let y = B0; y < L0; y++) M.row(y, 8, 9, TOP2);
    if (P.outfit === 'apron') for (let y = B0 + 2; y < (longBody ? feet - 1 : L0 + 2); y++) M.set(12, y, WHITE);
    if (P.belt && !longBody && P.outfit !== 'apron') { M.row(L0 - 1, 8, 12, WOOD, 0); M.set(12, L0 - 1, MET, 2); }
    if (P.belt && P.outfit === 'robe') M.row(B0 + 3, 8, 12, ACC, 0);
    // the near arm: a lighter strip with an ink line behind it, so it reads in front of the torso
    const armEnd = B0 + tl - 2;
    for (let y = B0 + 1; y <= armEnd; y++) { const sk = P.sleeves === 'short' && y > B0 + 1; M.set(9, y, INK); M.set(10, y, sk ? SKIN : TOP, sk ? 1 : 2); M.set(11, y, sk ? SKIN : TOP, sk ? 0 : 1); }
    M.row(armEnd + 1, 10, 11, SKIN, 1); M.set(9, armEnd + 1, INK);
    // head: 7 wide, face to the right, a nose bump
    [3, 4, 4, 4, 4, 4, 3].forEach((hw, j) => M.row(T + j, 10 - hw + 1, 10 + hw - 1 + (j === 0 || j === 6 ? 0 : 0), SKIN));
    M.set(14, T + 4, SKIN, 1);
    const ey = T + 3;
    M.set(12, ey, INK); if (P.bigEyes) M.set(12, ey + 1, INK);
    if (P.blush) M.set(11, ey + 2, BLUSH);
    if (P.beard) { M.row(T + 5, 9, 13, HAIR); M.row(T + 6, 8, 12, HAIR); M.row(T + 7, 10, 12, HAIR, 0); M.set(13, T + 5, SKIN); }
    const hs = P.hairStyle;
    if (hs !== 'bald') {
      M.row(T - 1, 8, 12, HAIR); M.row(T, 7, 13, HAIR); M.row(T + 1, 7, 12, HAIR); M.row(T + 2, 7, 9, HAIR); M.row(T + 3, 7, 8, HAIR); M.set(7, T + 4, HAIR);
      if (hs === 'bangs' || hs === 'bob') M.row(T + 2, 7, 13, HAIR);
      if (hs === 'long' || hs === 'curly' || hs === 'bob') for (let y = T + 4; y < T + 7; y++) M.row(y, 7, 9, HAIR);
      if (hs === 'curly') { for (let y = T; y < T + 6; y++) M.set(6, y, HAIR); M.row(T - 2, 9, 11, HAIR); }
      if (hs === 'spiky') { for (let x = 8; x < 14; x += 2) M.set(x, T - 2, HAIR); M.set(6, T, HAIR); }
      if (hs === 'bun') { M.row(T - 2, 7, 8, HAIR); M.row(T - 1, 6, 8, HAIR); }
    } else { M.row(T + 2, 7, 8, HAIR); M.row(T + 3, 7, 8, HAIR); }
    const h = P.hat;
    if (h === 'brim') { M.row(T + 1, 5, 15, ACC, 0); M.row(T, 7, 13, ACC); M.row(T - 1, 7, 13, ACC); M.row(T - 2, 8, 12, ACC); M.row(T, 7, 13, ACC, 0); }
    if (h === 'pointy') {
      M.row(T + 1, 5, 15, ACC, 0); M.row(T, 7, 13, TOP2, 1); M.row(T - 1, 7, 12, ACC); M.row(T - 2, 7, 12, ACC); M.row(T - 3, 7, 11, ACC);
      M.row(T - 4, 6, 10, ACC); M.row(T - 5, 5, 8, ACC); M.row(T - 6, 4, 5, ACC); M.set(3, T - 6, GEM, 2);
    }
    if (h === 'cap') { M.row(T - 1, 8, 12, ACC); M.row(T, 7, 13, ACC); M.row(T + 1, 7, 16, ACC, 0); }
    if (h === 'hood') {
      for (let y = T - 1; y < B0 + 1; y++) M.row(y, 6, y === T - 1 ? 12 : 13, ACC);
      [4, 4, 4, 4, 3].forEach((w, j) => M.row(T + 1 + j, 14 - w, 13, SKIN));
      M.set(14, T + 4, SKIN, 1); M.set(12, ey + 1, INK); M.set(12, ey, SKIN);
    }
    if (h === 'band') M.row(T + 1, 7, 13, ACC, 1);
    if (h === 'flower') { M.set(9, T, WHITE); M.set(10, T + 1, WHITE); M.set(8, T + 1, WHITE); M.set(9, T + 2, WHITE); M.set(9, T + 1, ACC, 2); }
    if (P.held === 'staff') { for (let y = T - 2; y <= feet; y++) M.set(13, y, WOOD, y < T ? 2 : 1); M.set(13, T - 3, GEM, 2); M.set(12, T - 2, GEM, 1); M.set(14, T - 2, GEM, 0); M.set(12, armEnd + 1, SKIN, 1); M.set(11, armEnd + 1, INK); }
    if (P.held === 'satchel') { for (let k = 0; k < tl - 1; k++) M.set(8 + (k >> 1), B0 + k, ACC, 0); M.row(L0 - 2, 6, 8, ACC, 0); M.row(L0 - 1, 6, 8, ACC); M.row(L0, 6, 8, ACC); }
    if (P.held === 'basket') basket(M, 11, armEnd + 2);
    if (P.held === 'scarf') { M.row(B0, 8, 13, ACC); M.set(7, B0 + 1, ACC); M.set(6, B0 + 2, ACC, 0); }
    return M;
  }

  Kit.register('sprite-people', { title: 'Paper-doll villagers', fit: 'prebake' }, host => {
    const COLS = 8, ROWS = 2, CW = 20, CH = 32;
    const c = Kit.canvas(host, COLS * CW, ROWS * CH);
    const st = { view: 'Front', seed: 2024 };
    const draw = () => {
      const p = new Pix(c.w, c.h).fill(2);
      const base = dollParams(st.seed * 100);
      const swaps = rng(st.seed + 99);
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        const n = j * COLS + i, x0 = i * CW, y0 = j * CH;
        if ((i + j) & 1) p.rect(x0, y0, CW, CH, 3);
        let P;
        if (st.view === 'Recolor') {
          // one doll, sixteen ramp tables: the parts never change, only the lookup
          P = Object.assign({}, base, n ? { skin: swaps.pick(RAMP.skin), hair: swaps.pick(RAMP.hair), top: swaps.pick(RAMP.cloth),
            top2: swaps.pick(RAMP.cloth), bot: swaps.pick(RAMP.cloth), acc: swaps.pick(RAMP.cloth) } : {});
        } else P = dollParams(st.seed * 100 + n + 1);
        const M = st.view === 'Side' ? dollSide(P) : dollFront(P);
        // a soft ground shadow under the feet
        p.rect(x0 + 5, y0 + 30, 10, 1, 1); p.rect(x0 + 6, y0 + 31, 8, 1, 1);
        blit(p, renderMats(M, dollRamps(P)), x0, y0);
      }
      c.put(p);
    };
    const b = Kit.bar(host);
    b.tabs(['Front', 'Side', 'Recolor'], v => { st.view = v; draw(); });
    b.seed(st.seed, s => { st.seed = s; draw(); });
    draw();
  });
})();
