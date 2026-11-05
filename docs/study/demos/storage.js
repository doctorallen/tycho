// storage.js: what this browser says about keeping a game's data, and a timed round trip of one generated chunk:
// make a 256×256 world (palette indexes, one byte a cell), compress it with CompressionStream, write it to
// IndexedDB, read it back, decompress, check every byte, and do the same through localStorage as base64.
// The map drawn is the copy read back from storage. Nothing here is sent anywhere; Clear removes it all.
(() => {
  const { worldJob, mapImage, text, textW, fmt } = StudyShared.phones;
  const PAL = Kit.PAL;
  const W = 320, H = 180, MAP = 160, N = 256, DB = 'tycho-study-phones', LS = 'tycho-study-phones-chunk';

  // IndexedDB with promises: open (making the store), put, get, and delete the whole database
  const idbOpen = () => new Promise((res, rej) => {
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore('chunks');
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); q.onblocked = () => rej(new Error('blocked'));
  });
  const idbDo = (db, mode, f) => new Promise((res, rej) => {
    const tx = db.transaction('chunks', mode), st = tx.objectStore('chunks'); let out;
    const q = f(st); q.onsuccess = () => { out = q.result; };
    tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  });
  const idbDrop = () => new Promise(res => { const q = indexedDB.deleteDatabase(DB); q.onsuccess = q.onerror = q.onblocked = () => res(); });

  // compression through the streams API; the format is deflate-raw where known, gzip otherwise
  const hasCS = typeof CompressionStream === 'function';
  let FORMAT = 'gzip';
  try { if (hasCS) { new CompressionStream('deflate-raw'); FORMAT = 'deflate-raw'; } } catch (e) { FORMAT = 'gzip'; }
  const squeeze = (bytes, Stream) => new Response(new Blob([bytes]).stream().pipeThrough(new Stream(FORMAT))).arrayBuffer().then(b => new Uint8Array(b));
  // bytes to base64 and back, in slices so a long string isn't built one char at a time
  const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = s => { const b = atob(s), u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i); return u8; };
  const size = n => n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' KB' : n + ' B';

  Kit.register('storage', { title: 'Keeping a chunk', fit: 'prebake' }, host => {
    const c = Kit.canvas(host, W, H), g = c.g;
    const J = worldJob();
    const mapC = document.createElement('canvas'); mapC.width = MAP; mapC.height = MAP;
    let hasMap = false, busy = false, seed = 21;
    const T = {}; // the last round trip's timings and sizes

    // ---- the card: the map read back on the left, sizes and times as bars on the right ----
    function draw() {
      g.fillStyle = PAL[0]; g.fillRect(0, 0, W, H);
      g.fillStyle = PAL[1]; g.fillRect(8, 10, MAP, MAP);
      if (hasMap) g.drawImage(mapC, 8, 10);
      else { const s = busy ? 'WORKING' : 'TAP ROUND TRIP'; text(g, s, 8 + MAP / 2 - textW(s) / 2, 10 + MAP / 2 - 2, 13); }
      const x0 = 176, bw = 140;
      text(g, 'SIZE', x0, 10, 7);
      const rows = [['RAW', T.raw, 4], [FORMAT === 'gzip' ? 'GZIP' : 'DEFLATE', T.packed, 12], ['BASE64', T.b64, 23]];
      rows.forEach(([l, v, ink], k) => {
        const y = 20 + k * 12;
        text(g, l, x0, y, 5);
        const s = v ? size(v) : '-'; text(g, s, x0 + bw - textW(s), y, v ? 13 : 4);
        g.fillStyle = PAL[2]; g.fillRect(x0, y + 7, bw, 3);
        if (v) { g.fillStyle = PAL[ink]; g.fillRect(x0, y + 7, Math.max(1, Math.round(v / T.raw * bw)), 3); }
      });
      text(g, 'TIME MS', x0, 62, 7);
      const steps = [['MAKE', 'gen'], ['SQUEEZE', 'zip'], ['IDB OPEN', 'open'], ['IDB WRITE', 'put'], ['IDB READ', 'get'], ['UNSQUEEZE', 'unzip'], ['LOCAL W/R', 'ls']];
      const top = Math.max(1, ...steps.map(s => T[s[1]] || 0));
      steps.forEach(([l, k], i) => {
        const y = 72 + i * 13, v = T[k];
        text(g, l, x0, y, 5);
        const s = v != null ? fmt(v) : '-'; text(g, s, x0 + bw - textW(s), y, v != null ? 13 : 4);
        g.fillStyle = PAL[2]; g.fillRect(x0, y + 7, bw, 3);
        if (v != null) { g.fillStyle = PAL[k === 'gen' ? 17 : 22]; g.fillRect(x0, y + 7, Math.max(1, Math.round(v / top * bw)), 3); }
      });
      if (T.ok != null) text(g, T.ok ? 'EVERY BYTE CAME BACK' : 'MISMATCH', 8, H - 7, T.ok ? 17 : 11);
    }

    // ---- what the browser reports ----
    const facts = Kit.el('div', { class: 'note', style: 'margin-top:6px;line-height:1.45;' });
    const said = {};
    function readout() {
      const rows = [
        ['Storage estimate', said.estimate || '...'],
        ['Persistent', said.persist || '...'],
        ['Installed (standalone)', ((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone) ? 'yes' : 'no, a browser tab'],
        ['CompressionStream', hasCS ? 'yes, ' + FORMAT : 'no (stored raw)'],
        ['IndexedDB', typeof indexedDB === 'object' && indexedDB ? 'yes' : 'no'],
        ['Last round trip', said.trip || 'not run'],
      ];
      facts.replaceChildren(...rows.map(([k, v]) => Kit.el('div', {}, Kit.el('b', {}, k + ': '), v)));
    }
    function look() {
      const S = navigator.storage;
      if (S && S.estimate) S.estimate().then(e => { said.estimate = size(e.usage || 0) + ' used of ' + size(e.quota || 0) + ' this site may use'; readout(); }, () => { said.estimate = 'refused'; readout(); });
      else said.estimate = 'not available';
      if (S && S.persisted) S.persisted().then(p => { said.persist = p ? 'yes, kept until the user clears it' : 'no, best effort (may be evicted)'; readout(); });
      else said.persist = 'not available';
      readout();
    }

    // ---- the round trip ----
    async function trip() {
      if (busy) return;
      busy = true; hasMap = false; for (const k in T) delete T[k]; draw(); setButtons(false);
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
      try {
        const now = () => performance.now();
        seed = (seed * 7 + 5) % 1000;
        let t = now(); const idx = J.run(N, seed).idx; T.gen = now() - t; T.raw = idx.length;
        t = now(); const packed = hasCS ? await squeeze(idx, CompressionStream) : idx.slice(); T.zip = now() - t; T.packed = packed.length;
        t = now(); const db = await idbOpen(); T.open = now() - t;
        t = now(); await idbDo(db, 'readwrite', st => st.put({ N, seed, format: hasCS ? FORMAT : 'raw', bytes: packed.buffer }, 'chunk')); T.put = now() - t;
        t = now(); const rec = await idbDo(db, 'readonly', st => st.get('chunk')); T.get = now() - t;
        db.close();
        t = now(); const back = hasCS ? await squeeze(new Uint8Array(rec.bytes), DecompressionStream) : new Uint8Array(rec.bytes); T.unzip = now() - t;
        let ok = back.length === idx.length; for (let i = 0; ok && i < idx.length; i++) if (back[i] !== idx[i]) ok = false;
        T.ok = ok;
        // localStorage: synchronous, strings only, about 5 MB a site
        t = now();
        const b64 = toB64(packed);
        try { localStorage.setItem(LS, b64); const got = fromB64(localStorage.getItem(LS)); T.ls = now() - t; T.b64 = b64.length; if (got.length !== packed.length) T.ok = false; }
        catch (e) { T.ls = null; said.ls = e.name; }
        mapC.getContext('2d').putImageData(mapImage(back, N, MAP), 0, 0); hasMap = true;
        said.trip = size(T.raw) + ' of indexes became ' + size(T.packed) + ' (' + Math.round(T.packed / T.raw * 100) + '%); compress ' + fmt(T.zip) + ' ms, IndexedDB write ' + fmt(T.put) + ' ms and read ' + fmt(T.get) + ' ms (first open ' + fmt(T.open) + ' ms), decompress ' + fmt(T.unzip) + ' ms' + (T.ls != null ? ', localStorage write and read as base64 ' + fmt(T.ls) + ' ms' : ', localStorage refused (' + said.ls + ')') + (T.ok ? '. Every byte matched.' : '. The bytes did not match.');
      } catch (e) {
        said.trip = 'failed: ' + (e && e.message || e);
      }
      busy = false; setButtons(true); draw(); look(); host.__done = Object.assign(host.__done || {}, { 'Round trip': true });
    }

    const b = Kit.bar(host);
    const btns = [
      b.button('Round trip', trip),
      b.button('Ask to persist', () => {
        const S = navigator.storage;
        if (!S || !S.persist) { said.persist = 'persist() not available'; readout(); return; }
        S.persist().then(p => { said.persist = p ? 'granted' : 'not granted (the browser decides by its own rules; installing helps on iOS)'; readout(); });
      }),
      b.button('Clear', async () => { await idbDrop(); try { localStorage.removeItem(LS); } catch (e) { /* private mode */ } for (const k in T) delete T[k]; hasMap = false; said.trip = 'cleared'; draw(); look(); }),
    ];
    const setButtons = on => btns.forEach(x => { x.disabled = !on; });
    host.appendChild(facts);
    draw(); look();
  });
})();
