// start.js: the last script on a study page. Tags each demo card with how it would run in Tycho
// (from the demo's own meta: per frame, pre-bake or shader), then starts every demo on the page.
(() => {
  const LABEL = { 'per-frame': 'per frame', prebake: 'pre-bake', shader: 'shader' };
  document.querySelectorAll('figure.demo').forEach(fig => {
    const host = fig.querySelector('[data-demo]'), d = host && window.Demos && Demos[host.dataset.demo];
    const b = fig.querySelector('figcaption b');
    if (!d || !b) return;
    const chip = document.createElement('span');
    chip.className = 'fit ' + d.meta.fit; chip.textContent = LABEL[d.meta.fit] || d.meta.fit;
    b.after(chip);
  });
  Kit.mountAll();
})();
