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

// ---------------------------------------------------------------------------
// Exchanges and their outcomes, by degrees
// ---------------------------------------------------------------------------

/**
 * Two (or more) people at a cafe table all day, with Reverie, Fellowship and
 * Bree: the kinds are the test's. Options: bree (settings), people's defs.
 */
function table(opts = {}) {
  const w = Tyrell.create({ seed: opts.seed || 'table', start: 8 * HOUR, modules: opts.modules || ['reverie', 'fellowship', 'wormtongue', 'cityspeak', 'bree'],
    moduleConfig: { bree: { spread: 0, strike: 0, ...(opts.bree || {}) }, fellowship: { meetGain: 0, ...(opts.fellowship || {}) } } });
  w.need({ id: 'company', rise: 0.05, start: 0.5, urgent: 1.1 });
  w.place({ id: 'cafe', slots: { seat: 6 } });
  w.place({ id: 'yard' });
  w.link('cafe', 'yard', 5);
  w.action({ id: 'sit', at: 'cafe', slot: 'seat', minutes: 120, base: 0.5, pose: 'sit' });
  w.action({ id: 'wait_about', at: 'yard', minutes: 60, rank: -1 });
  for (const id of opts.people || ['a', 'b']) w.person(id, { home: 'cafe', ...((opts.defs || {})[id] || {}) });
  return w;
}

test('how words land: by degrees, from the listener\'s side, and the scale says where it falls', () => {
  const w = table({ people: ['a', 'b', 'grump', 'fan'], defs: { grump: { traits: { temper: 0.9 } }, fan: { traits: { humor: 0.9 } } } });
  w.bree.kind({ id: 'joke', base: 0.25, traits: { humor: 1.5, temper: -1 } });
  const joke = (to) => w.bree.weigh('joke', 'a', to);
  const fan = joke('fan'), b = joke('b'), grump = joke('grump');
  assert.ok(fan.score > b.score && b.score > grump.score, `${fan.score} > ${b.score} > ${grump.score}`);
  assert.deepEqual(fan.parts.find((p) => p[0] === 'nature'), ['nature', 1.2]);
  w.fellowship.adjust('b', 'a', 0.5);
  assert.equal(Math.round((joke('b').score - b.score) * 1e4) / 1e4, 1, 'regard: twice a point');
  assert.equal(w.bree.outcome(2), 'warm');
  assert.equal(w.bree.outcome(1), 'good');
  assert.equal(w.bree.outcome(0), 'fine');
  assert.equal(w.bree.outcome(-1), 'awkward');
  assert.equal(w.bree.outcome(-2), 'sour');
  assert.equal(w.bree.outcome(-3.1), 'row');
  w.tune('bree', { scale: [1, 0, -1, -2, -3] });
  assert.equal(w.bree.outcome(0), 'good', 'a kinder scale');
  // a grudge against the speaker, and their mood, color it too
  const before = joke('b').score;
  w.bree.grudgeAgainst('b', 'a', 0.5);
  assert.equal(Math.round((before - joke('b').score) * 100) / 100, 1.5);
  w.reverie.feel('b', 'wronged');
  assert.ok(joke('b').parts.find((p) => p[0] === 'mood')[1] < 0);
});

test('an exchange\'s outcome moves regard by degrees, both ways', () => {
  const run = (base, bree) => {
    // (only the kind's own base counts here)
    const w = table({ bree: { compatWeight: 0, moodWeight: 0, roomWeight: 0, ...bree } });
    w.bree.kind({ id: 'say', base });
    w.advance(10);
    w.bree.start('say', 'a', 'b');
    w.advance(HOUR);
    return [w.fellowship.regard('a', 'b'), w.fellowship.regard('b', 'a'), w];
  };
  const [warmA, warmB] = run(3), [good] = run(1), [fine] = run(0), [awkward] = run(-1), [sour] = run(-2.5), [row] = run(-4);
  assert.equal(warmA, 0.04);
  assert.equal(warmB, 0.04, 'both ways');
  assert.deepEqual([good, fine, awkward, sour, row], [0.02, 0.005, -0.01, -0.03, -0.08]);
  assert.equal(run(3, { warmth: 0 })[0], 0, 'warmth 0: nothing warms');
  assert.equal(run(-4, { quarrels: 0 })[0], 0, 'quarrels 0: nothing sours');
  assert.equal(run(3, { warmth: 2 })[0], 0.08);
  const w = run(-4)[2];
  const end = w.bree.history('a', 'b').at(-1);
  assert.equal(end.outcome, 'row');
  assert.deepEqual(end.outcomes, { a: 'row', b: 'row' });
});

test('a person warms at their own pace: their warmth multiplies the world\'s', () => {
  const w = table({ defs: { a: { tune: { bree: { warmth: 3 } } } } });
  w.bree.kind({ id: 'say', base: 3 });
  w.advance(10);
  w.bree.start('say', 'a', 'b');
  w.advance(HOUR);
  assert.equal(w.fellowship.regard('a', 'b'), 0.12);
  assert.equal(w.fellowship.regard('b', 'a'), 0.04);
  assert.deepEqual(w.tuning('bree', 'a'), { warmth: 3, quarrels: 1, escalation: 1, grudges: 1, forgiveness: 1, talk: 1 });
});

test('what an outcome does: feelings, memories, sentiments, effects, needs relieved, and what the kind does', () => {
  const w = table({ defs: { a: { inv: { flowers: 1 } } } });
  w.wormtongue.crime({ kind: 'nothing', severity: 0 });
  w.deed('helped', { regard: 0.1, sentiment: 'helped me out' });
  w.bree.kind({ id: 'kind_word', base: 3, relieves: { company: 0.4 }, deed: 'helped', gives: 'flowers', owes: 1,
    on: { warm: { feel: ['good_talk', 'comforted'], memory: 6, sentiment: { label: 'was kind to me', by: 0.1 }, then: ['var.kind+=1'] } } });
  w.advance(10);
  const company = w.needOf('b', 'company');
  w.bree.start('kind_word', 'a', 'b');
  w.advance(HOUR);
  assert.ok(w.reverie.feelings('a').some((f) => f.id === 'good_talk'));
  assert.ok(w.reverie.feelings('b').some((f) => f.id === 'comforted'));
  assert.ok(w.reverie.memories('b').some((m) => m.k === 'kind_word:warm' && m.about === 'a' && m.imp === 6));
  assert.ok(w.fellowship.sentiments('b', 'a').some((s) => s.label === 'was kind to me'));
  assert.ok(!w.fellowship.sentiments('a', 'b').some((s) => s.label === 'was kind to me'), 'the other\'s about the one who started it');
  assert.equal(w.get('a').vars.kind, 1);
  assert.ok(w.needOf('b', 'company') < company + 0.05 - 0.39, 'company: relieved');
  assert.equal(w.reverie.file('b', 'a').tally.helped, 1, 'the deed');
  assert.ok(w.fellowship.sentiments('b', 'a').some((s) => s.label === 'helped me out'));
  assert.equal(w.get('b').inv.flowers, 1, 'the gift');
  assert.equal(w.get('a').inv.flowers, undefined);
  assert.equal(w.wormtongue.owes('a', 'b'), 1, 'a favor owed');
});

test('people strike up exchanges when they meet, by the strike chance and both people\'s talk', () => {
  const run = (bree, defs) => {
    const w = table({ bree: { strike: 0.3, ...bree }, defs, people: ['a', 'b', 'c'] });
    w.bree.kind({ id: 'chat' });
    const ends = [];
    w.on('bree:end', (e) => ends.push(e));
    w.advance(DAY);
    return ends;
  };
  const one = run({});
  assert.ok(one.length > 0 && one.every((e) => e.why === 'done' || e.why === 'parted'));
  assert.equal(run({ talk: 0 }).length, 0, 'talk 0: nobody strikes one up');
  assert.equal(run({}, { a: { tune: { bree: { talk: 0 } } } }).filter((e) => e.who.includes('a')).length, 0, 'a keeps to themselves');
  assert.ok(run({ strike: 1 }).length > one.length);
});

test('friends talk longer than strangers; the talkative longer still; talk scales it', () => {
  const turns = (setup, bree) => {
    const w = table({ bree: { turnsJitter: 0, ...bree } });
    w.bree.kind({ id: 'chat', topics: ['*'] });
    if (setup) setup(w);
    w.advance(10);
    return w.bree.start('chat', 'a', 'b').turns;
  };
  assert.equal(turns(), 2, 'strangers');
  assert.equal(turns((w) => w.fellowship.adjust('a', 'b', 0.4)), 5, 'friends');
  assert.equal(turns((w) => w.fellowship.adjust('a', 'b', 0.7)), 8, 'close');
  assert.equal(turns((w) => w.fellowship.setPartner('a', 'b')), 8, 'partners');
  assert.equal(turns((w) => w.fellowship.adjust('a', 'b', 0.4), { talk: 2 }), 10);
  const talky = table({ bree: { turnsJitter: 0 }, defs: { a: { traits: { talkative: 1 } }, b: { traits: { talkative: 1 } } } });
  talky.bree.kind({ id: 'chat', topics: ['*'] });
  talky.fellowship.adjust('a', 'b', 0.4);
  talky.advance(10);
  assert.equal(talky.bree.start('chat', 'a', 'b').turns, 7);
});

test('an action that interacts begins its exchange with its target, and the turns run over its length', () => {
  const w = table();
  w.bree.kind({ id: 'chat', topics: ['*'] });
  w.action({ id: 'natter', target: 'person', at: 'here', minutes: 20, rank: -1, interact: 'chat' });
  w.advance(10);
  const turns = [];
  w.on('bree:turn', (t) => turns.push(t));
  w.direct('a', { do: 'natter', target: 'b' });
  const ex = w.bree.exchange('a');
  assert.equal(ex.kind, 'chat');
  assert.equal(ex.why, 'action');
  assert.deepEqual(ex.who, ['a', 'b']);
  w.advance(30);
  assert.ok(turns.length >= 2 && turns.every((t) => t.id === ex.id));
  assert.equal(turns[0].who, 'a');
  assert.equal(turns[1].who, 'b');
  assert.equal(turns[1].step, 'reply');
  assert.ok(turns.at(-1).end);
  assert.equal(w.bree.exchange('a'), null, 'over');
});

test('the game starts and ends exchanges: inputs, the first turn at once', () => {
  const w = table();
  w.bree.kind({ id: 'chat', topics: ['*'], turns: 6 });
  w.advance(10);
  const seen = [];
  w.on('bree:turn', (t) => seen.push(t));
  const view = w.bree.start('chat', 'b', 'a');
  assert.equal(view.turn, 1);
  assert.equal(seen.length, 1);
  assert.equal(w.lang.value('exchange', w.ctx(w.get('a'))), 'chat');
  assert.equal(w.bree.start('nonsense', 'a', 'b'), null);
  w.advance(5);
  w.bree.end('a');
  assert.equal(w.bree.exchange('b'), null);
  assert.equal(w.bree.history().at(-1).why, 'ended');
  // a pair that isn't together can't keep one going
  w.direct('b', { do: 'wait_about', at: 'yard' });
  w.advance(30);
  const v = w.bree.start('chat', 'a', 'b');
  assert.equal(v.turn, 0);
  assert.equal(w.bree.history().at(-1).why, 'parted');
});

test('time walk across an exchange gives the same world; so does saving mid-way', () => {
  const run = () => { const w = table({ bree: { spread: 1.5 } }); w.bree.starter({ company: 'company' }); w.advance(HOUR); return w; };
  const w = run();
  w.bree.start('chat', 'a', 'b', { turns: 8 });
  w.advance(7);
  assert.ok(w.bree.exchange('a'), 'mid-way');
  const saved = JSON.stringify(w.save());
  w.advance(HOUR);
  const h = w.hash();
  w.rewind(HOUR + 6);
  w.advance(HOUR + 6);
  assert.equal(w.hash(), h, 'back across it and forward again');
  const v = run();
  v.load(saved);
  v.advance(HOUR);
  assert.equal(v.hash(), h, 'loaded mid-way, it runs on the same');
  const u = run();
  u.bree.start('chat', 'a', 'b', { turns: 8 });
  u.advance(HOUR + 7);
  assert.equal(u.hash(), h, 'the same seed and inputs');
});
