// The bridge (dist/tycho-minds): the clock, the save, seats, presence,
// travel times, witnesses and reports, against Tyrell's own sample town.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as M from '../dist/tycho-minds.mjs';
import * as Tyrell from '../dist/tyrell.mjs';

const require = createRequire(import.meta.url);
const town = (opts = {}) => require('../tyrell/examples/rocinante.js')(Tyrell, opts);
const HOUR = 60, DAY = 1440;

test('time: minutes, the hour of the day, progress', () => {
  assert.equal(M.minutes(2, 6.5), (2 * 24 + 6.5) * 60);
  assert.equal(M.hourOf(M.minutes(3, 13.25)), 13.25);
  assert.equal(M.hourOf(-60), 23);
  assert.equal(M.progress({ start: 10, end: 20 }, 15), 0.5);
  assert.equal(M.progress({ start: 10, end: 20 }, 5), 0);
  assert.equal(M.progress({ start: 10, end: 10 }, 11), 1);
});

test('the clock runs the minds forward, back through time walk, and remakes them past what Esper remembers', () => {
  let w = town(), t = w.now, made = 0;
  const c = M.clock({ world: () => w, minutes: () => t, remake: (at) => { made++; w = town({ start: at }); } });
  assert.equal(c.sync(), 'same');
  t += 6 * HOUR;
  assert.equal(c.sync(), 'ran');
  assert.equal(w.now, t);
  const ahead = w.hash();
  t -= 2 * HOUR;
  assert.equal(c.sync(), 'ran');
  assert.equal(w.now, t);
  t += 2 * HOUR;
  c.sync();
  assert.equal(w.hash(), ahead, 'back and forward again is the same world');
  t = w.esper.earliest() - 5 * HOUR;
  assert.equal(c.sync(), 'remade');
  assert.equal(made, 1);
  assert.equal(M.clock({ world: () => null, minutes: () => 0 }).sync(), 'off');
});

test('the minds go in the save and come back the same; a save the game will not take leaves a new world', () => {
  const a = town();
  a.advance(DAY);
  const saved = JSON.parse(JSON.stringify(M.stash(a, { pop: 3 })));
  assert.equal(saved.tyrell, 'world');
  assert.equal(saved.pop, 3);
  const b = town();
  assert.equal(M.restore(b, saved, { accept: (s) => s.pop === 3 }), true);
  assert.equal(b.hash(), a.hash());
  const c = town(), now = c.now + 2 * HOUR;
  assert.equal(M.restore(c, saved, { accept: (s) => s.pop === 4, now }), false);
  assert.equal(c.now, now);
  assert.equal(M.restore(town(), { tyrell: 'world', v: 1, s: { nonsense: true } }), false, 'an unreadable save is left');
  assert.equal(M.restore(town(), null), false);
});

test('seats: nobody sits in anybody, and a seat comes free when its sitter leaves', () => {
  const people = { a: { id: 'a', status: 'active', place: 'bar', doing: { kind: 'act', action: 'drink', place: 'bar', start: 0, end: 60 } }, b: { id: 'b', status: 'active', place: 'bar', doing: { kind: 'act', action: 'drink', place: 'bar', start: 5, end: 60 } }, c: { id: 'c', status: 'active', place: 'bar', doing: { kind: 'act', action: 'drink', place: 'bar', start: 9, end: 60 } } };
  const w = { get: (id) => people[id] }, s = new M.Seats(() => w);
  assert.equal(s.take('a', 'bar', 'drink', 0, 3, 1), 1);
  assert.equal(s.take('a', 'bar', 'drink', 0, 3, 2), 1, 'kept while they stay');
  assert.equal(s.take('b', 'bar', 'drink', 5, 3, 1), 2);
  assert.equal(s.take('c', 'bar', 'drink', 9, 3, 1), 0);
  people.a = { ...people.a, place: 'street', doing: { kind: 'travel', action: 'home', place: null, start: 60, end: 70 } };
  people.d = { id: 'd', status: 'active', place: 'bar', doing: { kind: 'act', action: 'drink', place: 'bar', start: 61, end: 90 } };
  assert.equal(s.take('d', 'bar', 'drink', 61, 3, 1), 1, "a's seat, now they've gone");
});

test('presence: worked out once a doing, and nobody who is away', () => {
  let p = { id: 'x', status: 'active', place: 'home', doing: null }, n = 0;
  const w = { get: (id) => (id === 'x' ? p : null) };
  const pr = new M.Presence(() => w, (q) => { n++; return q.doing && q.doing.kind === 'travel' ? ['street', 'market'] : [q.place]; });
  assert.equal(pr.may('x', 'home'), true);
  assert.equal(pr.may('x', 'street'), false);
  assert.equal(n, 1);
  p = { ...p, doing: { kind: 'travel', action: 'shop', place: null, start: 10, end: 30, from: 'home', to: 'market' } };
  assert.equal(pr.may('x', 'street'), true);
  assert.equal(pr.may('x', 'market'), true);
  assert.equal(n, 2);
  p = { ...p, status: 'away' };
  assert.equal(pr.may('x', 'street'), false);
  assert.equal(pr.may('nobody', 'street'), false);
});

test('travel times: once a pair, none to the same place', () => {
  let n = 0;
  const t = M.travelTimes((a, b) => { n++; return a.length + b.length; });
  assert.equal(t('ab', 'cde'), 5);
  assert.equal(t('ab', 'cde'), 5);
  assert.equal(t('ab', 'ab'), 0);
  assert.equal(n, 1);
  t.clear();
  t('ab', 'cde');
  assert.equal(n, 2);
});

test('witnesses: the room, or whoever is in reach, nearest first', () => {
  const at = { x: 100, y: 50 };
  const folk = [{ n: 'far', x: 400, y: 50 }, { n: 'near', x: 120, y: 50 }, { n: 'mid', x: 0, y: 60 }, { n: 'below', x: 100, y: 200 }, { n: 'hid', x: 101, y: 50, hidden: true }];
  const can = (f) => !f.hidden;
  assert.deepEqual(M.witnesses(at, folk, { can }).map((f) => f.n), ['near', 'mid']);
  assert.deepEqual(M.witnesses(at, folk, { can, room: true }).map((f) => f.n), ['below', 'near', 'mid', 'far']);
  assert.deepEqual(M.witnesses(at, folk, { reach: [1000, 1000], far: (f, p) => Math.hypot(f.x - p.x, f.y - p.y) }).map((f) => f.n), ['hid', 'near', 'mid', 'below', 'far']);
});

test('collect: what the world emits, kept for the game to take', () => {
  const fns = {}, w = { on: (k, f) => { fns[k] = f; } };
  const r = M.collect(w, 'report', (d) => d.actor === 'player');
  fns.report({ actor: 'player', n: 1 });
  fns.report({ actor: 'someone', n: 2 });
  fns.report({ actor: 'player', n: 3 });
  assert.deepEqual(r.take().map((d) => d.n), [1, 3]);
  assert.deepEqual(r.take(), []);
});
