// perspectives.js: One world, eight projections. A study demo, using views-shared.js.
(() => {
  const { Pix, stamp, toCanvas, W, H, topDown, oblique, iso, side, hex, mode7Assets, rayAssets, stackAssets, NOTES, drawMode7, drawRay, drawStack } = StudyShared.views;
  Kit.register('perspectives', { title: 'One world, eight projections', fit: 'prebake' }, host => {
    const c = Kit.canvas(host, W, H);
    const g = c.g;
    let view = 'Isometric', still = null, m7 = null, ray = null, stack = null;
    const STILL = { 'Top-down': () => { const p = new Pix(W, H).fill(21); const t = topDown(10); stamp(p, t, null, (W - t.w) / 2, (H - t.h) / 2 + 4); return p; },
      '3/4 oblique': oblique, 'Isometric': iso, 'Side view': side, 'Hex': hex };
    const show = v => {
      view = v; note.textContent = NOTES[v];
      if (STILL[v]) { still = toCanvas(STILL[v]()); }
      else if (v === 'Mode 7' && !m7) m7 = mode7Assets();
      else if (v === 'Raycaster' && !ray) ray = rayAssets();
      else if (v === 'Sprite stack' && !stack) stack = stackAssets();
      draw(tick);
    };
    let tick = 0;
    const draw = t => {
      tick = t;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      if (STILL[view]) { g.drawImage(still, 0, 0); return; }
      if (view === 'Mode 7') drawMode7(g, m7, t);
      else if (view === 'Raycaster') drawRay(g, ray, t);
      else drawStack(g, stack, t);
    };
    const b = Kit.bar(host);
    b.tabs(Object.keys(NOTES), show, view);
    const note = b.note('');
    show(view);
    Kit.loop(host, () => {}, draw, 30);
  });
})();
