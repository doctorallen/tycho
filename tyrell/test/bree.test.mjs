// Bree: interactions between people. Kinds declared by the game (a starter
// set to take or replace), outcomes by degrees, escalation and its stopping,
// grudges that fade, feuds both ways, avoidance, making up, conversations
// over turns and round a table, witnesses and gossip, the knobs, and time
// walk and saving across an exchange.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tyrell, rocinante, HOUR, DAY } from './helpers.mjs';

/** Two people who never meet, and a third: only what's done to them moves anything. */
function apart(opts = {}) {
  const w = Tyrell.create({ seed: 'apart', start: 8 * HOUR, modules: ['reverie', 'fellowship', 'bree'], ...opts });
  for (const id of ['x', 'y', 'z']) w.place({ id });
  w.person('a', { home: 'x', ...(opts.a || {}) });
  w.person('b', { home: 'y', ...(opts.b || {}) });
  w.person('c', { home: 'z', ...(opts.c || {}) });
  return w;
}

// ---------------------------------------------------------------------------
// Definitions and state
// ---------------------------------------------------------------------------

test('the starter set: seventeen kinds, their topics and a few manners, to take or replace', () => {
  const w = apart();
  const b = w.bree;
  assert.equal(b.kinds.size, 0, 'nothing until the game declares it');
  b.starter();
  assert.deepEqual([...b.kinds.keys()], ['chat', 'deep_talk', 'joke', 'compliment', 'tease', 'flirt', 'comfort', 'favor', 'gift', 'help', 'teach', 'argue', 'insult', 'fight', 'apologize', 'make_up', 'avoid']);
  assert.ok(b.topics.has('news') && b.topics.get('news').from === 'beliefs');
  assert.ok(b.manners.has('ornery'));
  b.kind({ id: 'chat', base: 1 });
  assert.equal(b.kinds.get('chat').base, 1, 'a kind declared again replaces it');
  const some = apart();
  some.bree.starter({ kinds: ['chat', 'argue'], company: 'talk' });
  assert.deepEqual([...some.bree.kinds.keys()], ['chat', 'argue']);
  assert.deepEqual(some.bree.kinds.get('chat').relieves, { talk: 0.15, fun: 0.05 }, 'the game\'s own name for the need');
  assert.equal(typeof Tyrell.breeStarter, 'function');
  assert.deepEqual(Tyrell.OUTCOMES, ['warm', 'good', 'fine', 'awkward', 'sour', 'row']);
  assert.equal(w.s.mod.bree, undefined, 'declaring keeps nothing in the state');
});

test('nature: each trait role is read from the term the game maps it to', () => {
  const w = apart({ a: { traits: { wit: 0.9, temper: 0.2 } }, moduleConfig: { bree: { traits: { ...Tyrell.MODULE_DEFAULTS.bree.traits, humor: 'trait.wit' } } } });
  const ctx = w.ctx(w.get('a'));
  assert.equal(w.lang.value('nature.humor', ctx), 0.9);
  assert.equal(w.lang.value('nature.temper', ctx), 0.2);
  assert.equal(w.lang.value('nature.patience', ctx), 0.5, 'a trait they don\'t have is the default');
  w.term('calm', () => 0.8);
  w.tune('bree', { traits: { patience: 'calm' } });
  assert.equal(w.lang.value('nature.patience', ctx), 0.8, 'any term will do');
});

test('a grudge fades at a set pace, faster for the forgiving, never with forgiveness at 0', () => {
  const run = (opts, days = 5) => { const w = apart(opts); w.bree.grudgeAgainst('a', 'b', 0.5, 'the fence'); w.advance(days * DAY); return w; };
  const one = run({});
  assert.equal(one.bree.grudge('a', 'b'), 0.3, '0.04 a day for five days');
  assert.deepEqual(one.bree.grudges('a'), [{ id: 'b', strength: 0.3, why: 'the fence' }]);
  assert.equal(one.bree.grudge('b', 'a'), 0, 'one way');
  assert.equal(run({ a: { traits: { forgiveness: 1 } } }).bree.grudge('a', 'b'), 0.2, 'a forgiving nature lets go half as fast again');
  assert.equal(run({ a: { traits: { forgiveness: 0 } } }).bree.grudge('a', 'b'), 0.4);
  assert.equal(run({ moduleConfig: { bree: { forgiveness: 0 } } }).bree.grudge('a', 'b'), 0.5, 'nobody forgives');
  assert.equal(run({ a: { tune: { bree: { forgiveness: 2 } } } }).bree.grudge('a', 'b'), 0.1, 'their own pace');
  const gone = run({}, 20);
  assert.equal(gone.bree.grudge('a', 'b'), 0);
  assert.equal(gone.s.mod.bree.g.a, undefined, 'let go at midnight');
  const w = apart();
  assert.equal(w.lang.value('grudge', w.ctx(w.get('a'), { target: 'b' })), 0);
  w.bree.grudgeAgainst('a', 'b', 0.4);
  assert.equal(w.lang.value('grudge', w.ctx(w.get('a'), { target: 'b' })), 0.4);
  assert.equal(w.lang.value('grudged', w.ctx(w.get('b'), { target: 'a' })), 0.4, 'the one it\'s held against');
});

test('grudges both ways become a feud; feuds between groups run both ways, and fade', () => {
  const w = apart();
  const feuds = [];
  w.on('bree:feud', (e) => feuds.push(e));
  w.bree.grudgeAgainst('a', 'b', 0.6, 'the well');
  assert.equal(w.bree.feudBetween('a', 'b'), 0);
  w.bree.grudgeAgainst('b', 'a', 0.7, 'the well');
  assert.equal(feuds.length, 1);
  assert.equal(w.bree.feudBetween('a', 'b'), 0.6);
  assert.equal(w.bree.feudBetween('b', 'a'), 0.6, 'both ways');
  assert.equal(w.bree.bond('a', 'b'), 'rival');
  // two households, by the game: every member against every member, both ways
  const g = apart({ a: { groups: ['h1'] }, b: { groups: ['h2'] }, c: { groups: ['h2'] } });
  g.fellowship.group({ id: 'h1', kind: 'household' });
  g.fellowship.group({ id: 'h2', kind: 'household' });
  g.bree.feud('h1', 'h2', 0.8, 'the land');
  for (const [x, y] of [['a', 'b'], ['b', 'a'], ['a', 'c'], ['c', 'a']]) assert.equal(g.bree.feudBetween(x, y), 0.8, `${x} and ${y}`);
  assert.equal(g.bree.feudBetween('b', 'c'), 0, 'not within a household');
  assert.equal(g.bree.animosity('c', 'a'), 0.8);
  g.advance(10 * DAY);
  assert.equal(g.bree.feudBetween('a', 'b'), 0.7, 'a hundredth a day');
  g.bree.feud('h2', 'h1', null);
  assert.equal(g.bree.feudBetween('a', 'b'), 0, 'ended by the game');
});

test('grudges and feuds are state: they rewind and save', () => {
  const w = apart();
  w.advance(HOUR);
  w.bree.grudgeAgainst('a', 'b', 0.5);
  w.bree.feud('a', 'c', 0.4);
  w.advance(10 * HOUR);
  const h = w.hash();
  const v = apart();
  v.load(JSON.stringify(w.save()));
  assert.equal(v.hash(), h);
  assert.equal(v.bree.grudge('a', 'b'), w.bree.grudge('a', 'b'));
  w.rewind(10 * HOUR + 30);
  assert.equal(w.bree.grudge('a', 'b'), 0, 'before it was held');
  w.advance(10 * HOUR + 30);
  assert.equal(w.hash(), h);
});
