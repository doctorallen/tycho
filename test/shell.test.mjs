// The shell's parts that run without a browser page: the save store, dev
// flags and the loader's tasks, against a stand-in for localStorage and the
// frame clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Tycho from '../dist/tycho.mjs';

function fakeStorage(full = false) {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (full) throw new Error('QuotaExceeded'); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

test('a store loads over a fresh save, renames old ids, clears old keys and starts over', () => {
  globalThis.localStorage = fakeStorage();
  localStorage.setItem('old.save', '1');
  localStorage.setItem('g.save', JSON.stringify({ v: 1, level: 'd_flats', cr: 5 }));
  const st = new Tycho.save.Store({ key: 'g.save', fresh: () => ({ v: 1, level: 'start', cr: 0, notes: { a: 1 } }), old: ['old.save'], renamed: [[/\bd_flats\b/g, 'd_apartments']], accept: (d, f) => d.v === f.v });
  const d = st.load();
  assert.equal(st.loaded, true);
  assert.deepEqual(d, { v: 1, level: 'd_apartments', cr: 5, notes: { a: 1 } });
  assert.equal(localStorage.getItem('old.save'), null);
  d.cr = 9; st.write();
  assert.equal(JSON.parse(localStorage.getItem('g.save')).cr, 9);
  // one field at once, the rest as stored
  d.cr = 11; d.level = 'x'; st.writeField('cr');
  assert.deepEqual(JSON.parse(localStorage.getItem('g.save')), { v: 1, level: 'd_apartments', cr: 11, notes: { a: 1 } });
  // a save of another version starts fresh
  localStorage.setItem('g.save', JSON.stringify({ v: 0, cr: 99 }));
  const st2 = new Tycho.save.Store({ key: 'g.save', fresh: () => ({ v: 1, cr: 0 }), accept: (s, f) => s.v === f.v });
  assert.deepEqual(st2.load(), { v: 1, cr: 0 }); assert.equal(st2.loaded, false);
  // starting over clears the game's keys and keeps what's given
  localStorage.setItem('g.other', '1');
  st.startOver('g.', { v: 1, settings: { s: 1 } });
  assert.equal(localStorage.getItem('g.other'), null);
  assert.deepEqual(JSON.parse(localStorage.getItem('g.save')), { v: 1, settings: { s: 1 } });
  assert.equal(st.write(), false); // wiped: nothing more is written
});

test('a save that can\'t be read is kept aside, and a refused write is said once', () => {
  globalThis.localStorage = fakeStorage();
  localStorage.setItem('g.save', '{broken');
  const st = new Tycho.save.Store({ key: 'g.save', fresh: () => ({ n: 1 }), keepUnread: true, clean: (d) => { d.cleaned = true; } });
  assert.deepEqual(st.load(), { n: 1, cleaned: true });
  assert.equal(st.unread, true);
  assert.equal(localStorage.getItem('g.save.unread'), '{broken');
  globalThis.localStorage = fakeStorage(true);
  let said = 0;
  const full = new Tycho.save.Store({ key: 'k', fresh: () => ({}), onRefused: () => said++ });
  full.load(); full.write(); full.write();
  assert.equal(said, 1);
  assert.equal(Tycho.save.set('k', 1), false);
  assert.equal(Tycho.save.get('nope', 'dflt'), 'dflt');
});

test('dev flags', () => {
  globalThis.localStorage = fakeStorage();
  globalThis.location = { search: '?dev&nogl' };
  const f = new Tycho.dev.Flags('g.dev', { speed: 1 }).load();
  assert.equal(f.shown(), true); assert.equal(f.s.shown, true);
  f.s.speed = 3; f.save();
  globalThis.location = { search: '' };
  const g = new Tycho.dev.Flags('g.dev', { speed: 1 }).load();
  assert.equal(g.s.speed, 3); assert.equal(g.shown(), true);
  assert.equal(Tycho.dev.query('nogl', '?dev&nogl'), true); assert.equal(Tycho.dev.query('no', '?dev&nogl'), false);
  delete globalThis.location;
});

test('the loader runs tasks in slices, skips one that throws, and counts by weight', async () => {
  const seen = [], errors = [];
  const T = new Tycho.loader.Tasks({ slice: 5, onError: (e, j) => errors.push(j.label) });
  let n = 0;
  await T.run([
    { label: 'at once', weight: 1, fn: () => seen.push('a') },
    { label: 'steps', weight: 2, fn: (job) => () => { n++; job.at(n, 3); return n >= 3; } },
    { label: 'broken', weight: 1, fn: () => { throw new Error('no'); } },
    { label: 'async', weight: 1, fn: async (job) => { await job.yield(); seen.push('c'); } },
    { label: 'side', weight: 1, side: true, fn: async () => { seen.push('s'); } },
  ]);
  assert.deepEqual(errors, ['broken']);
  assert.equal(n, 3);
  assert.ok(seen.includes('a') && seen.includes('c') && seen.includes('s'));
  assert.equal(T.progress(), 1); assert.equal(T.mainDone, true);
  assert.deepEqual(T.jobs.map((j) => j.state), ['ok', 'ok', 'skip', 'ok', 'ok']);
  const list = [1, 2, 3, 4], got = [];
  const job = T.jobFor(T.jobs[0]);
  const step = T.each(job, list, (x) => got.push(x));
  while (!step()) { /* slices */ }
  assert.deepEqual(got, list);
});

test('an install offer that comes before the app starts is kept for it, and installedElsewhere asks the browser', async () => {
  // a stand-in page: listeners, a file address (so no worker), no app window
  const on = {}, g = globalThis, keep = { addEventListener: g.addEventListener, location: g.location, matchMedia: g.matchMedia, navigator: Object.getOwnPropertyDescriptor(g, 'navigator') };
  g.addEventListener = (type, fn) => { (on[type] = on[type] || []).push(fn); };
  g.location = { protocol: 'file:' };
  g.matchMedia = () => ({ matches: false });
  Object.defineProperty(g, 'navigator', { value: { userAgent: 'test', platform: 'Linux', maxTouchPoints: 0, getInstalledRelatedApps: async () => [{ platform: 'webapp' }] }, configurable: true });
  try {
    const T = await import('../dist/tycho.mjs?early');
    const offer = { type: 'beforeinstallprompt', prompt: async () => {}, userChoice: Promise.resolve({}) };
    for (const fn of on.beforeinstallprompt) fn(offer); // (before the game starts its app)
    let told = 0;
    const app = T.pwa.start({ build: 'x', onInstallable: () => told++ });
    assert.equal(app.prompt, offer, 'the early offer is taken up');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(told, 1, 'and the game is told, once it is done starting');
    assert.equal(await app.installedElsewhere(), true);
    g.navigator.getInstalledRelatedApps = undefined;
    assert.equal(await app.installedElsewhere(), false, "where the browser can't tell, false");
  } finally {
    g.addEventListener = keep.addEventListener; g.location = keep.location; g.matchMedia = keep.matchMedia;
    if (keep.navigator) Object.defineProperty(g, 'navigator', keep.navigator); else delete g.navigator;
  }
});
