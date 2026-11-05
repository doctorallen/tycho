// sprite-masks.js: Mask sprites. A study demo, using sprites-shared.js.
(() => {
  const { Pix, outline, blit, maskGrid, spratorGrid, paintGrid } = StudyShared.sprites;
  Kit.register('sprite-masks', { title: 'Mask sprites', fit: 'prebake' }, host => {
    const COLS = 8, ROWS = 5, CELL = 20;
    const c = Kit.canvas(host, COLS * CELL, ROWS * CELL);
    const st = { kind: 'Creatures', seed: 1234, mirror: true, outline: true, shade: true };
    const draw = () => {
      const p = new Pix(c.w, c.h).fill(2);
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        if ((i + j) & 1) p.rect(i * CELL, j * CELL, CELL, CELL, 1);
        const s = st.seed * 64 + j * COLS + i;
        const grid = st.kind === 'Sprator' ? spratorGrid(s, st.mirror) : maskGrid(st.kind, s, st.mirror);
        const spr = paintGrid(grid, s, st);
        blit(p, spr, i * CELL + ((CELL - spr.w) >> 1), j * CELL + ((CELL - spr.h + 1) >> 1));
      }
      c.put(p);
    };
    const b = Kit.bar(host);
    b.tabs(['Creatures', 'Ships', 'Robots', 'Sprator'], k => { st.kind = k; draw(); });
    const b2 = Kit.bar(host);
    b2.check('Mirror', true, v => { st.mirror = v; draw(); });
    b2.check('Outline', true, v => { st.outline = v; draw(); });
    b2.check('Shade', true, v => { st.shade = v; draw(); });
    b2.seed(st.seed, s => { st.seed = s; draw(); });
    draw();
  });
})();
