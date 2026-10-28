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

test('an exchange needs people: one aimed at the player (or nobody) begins nothing; old pairs are let go', () => {
  const w = table();
  w.bree.kind({ id: 'chat', turns: 2 });
  w.advance(10);
  w.lang.apply('exchange:chat', w.ctx(w.get('a'), { target: 'player' }));
  assert.equal(w.bree.exchange('a'), null);
  assert.equal(w.bree.start('chat', 'a', 'nobody'), null);
  w.bree.start('chat', 'a', 'b');
  w.advance(HOUR);
  assert.equal(w.lang.value('exchanges', w.ctx(w.get('a'), { target: 'b' })), 1);
  w.advance(31 * DAY);
  assert.equal(w.lang.value('exchanges', w.ctx(w.get('a'), { target: 'b' })), 0, 'a month on, forgotten');
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
  // a pair that isn't together can't keep one going: the game's first word, and they've parted
  w.direct('b', { do: 'wait_about', at: 'yard' });
  w.advance(30);
  const v = w.bree.start('chat', 'a', 'b');
  assert.equal(v.turn, 1, 'the game says they meet, in passing');
  w.advance(10);
  assert.equal(w.bree.history().at(-1).why, 'parted');
  assert.equal(w.bree.history().at(-1).n, 1);
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

// ---------------------------------------------------------------------------
// Escalation, and what stops it
// ---------------------------------------------------------------------------

/** A table where talk goes badly: chat -> argument -> fight, with the chances set by the test. */
function hot(opts = {}) {
  const w = table({ ...opts, bree: { escalateBase: 1, escalateTemper: 0, escalateRegard: 0, calmBase: 0, calmPatience: 0, calmRegard: 0, stepInBase: 0, stepInRegard: 0, stepInCourage: 0, leaveBase: 0, leaveTemper: 0, leaveSour: 0, compatWeight: 0, moodWeight: 0, roomWeight: 0, ...(opts.bree || {}) } });
  w.bree.kind({ id: 'chat', base: -3, turns: 4, escalates: 'argue' });
  w.bree.kind({ id: 'argue', tags: ['hostile'], base: -3, turns: 3, escalates: 'fight', weight: 0 });
  w.bree.kind({ id: 'fight', tags: ['hostile'], base: -4, turns: 2, crime: 'fight', weight: 0, on: { row: { feel: 'fought' } } });
  w.advance(10);
  return w;
}
const record = (w, kind) => { const out = []; w.on(kind, (e) => out.push(e)); return out; };
/** To three places: grudges fade by the minute, so a few minutes on they're a hair under. */
const r3 = (x) => Math.round(x * 1000) / 1000;

test('a sour turn turns talk into an argument, and an argument into a fight; escalation 0 stops it', () => {
  const w = hot();
  const esc = record(w, 'bree:escalated'), turns = record(w, 'bree:turn');
  const ex = w.bree.start('chat', 'a', 'b');
  w.advance(HOUR);
  assert.deepEqual(esc.map((e) => [e.from, e.to, e.by]), [['chat', 'argue', 'b'], ['argue', 'fight', 'a']], 'each time, the one hurt answers back harder');
  const done = w.bree.history().at(-1);
  assert.equal(done.id, ex.id);
  assert.equal(done.first, 'chat');
  assert.equal(done.kind, 'fight');
  assert.equal(done.by, 'a', 'who threw the first punch');
  assert.equal(done.outcome, 'row');
  assert.equal(turns.find((t) => t.kind === 'argue').who, 'b', 'the one who escalated speaks first');
  assert.ok(w.reverie.feelings('a').some((f) => f.id === 'fought'));
  assert.ok(w.lang.value('rowed', w.ctx(w.get('a'), { target: 'b' })) < HOUR);
  const calm = hot({ bree: { escalation: 0 } });
  const none = record(calm, 'bree:escalated');
  calm.bree.start('chat', 'a', 'b');
  calm.advance(HOUR);
  assert.equal(none.length, 0);
  assert.equal(calm.bree.history().at(-1).kind, 'chat');
  const own = hot({ defs: { b: { tune: { bree: { escalation: 0 } } } } });
  const ownEsc = record(own, 'bree:escalated');
  own.bree.start('chat', 'a', 'b');
  own.advance(HOUR);
  assert.ok(ownEsc.every((e) => e.by !== 'b'), 'b never rises to it');
});

test('the other can keep their patience; someone there can step in', () => {
  const w = hot({ bree: { calmBase: 1 } });
  const turns = record(w, 'bree:turn'), esc = record(w, 'bree:escalated');
  w.bree.start('chat', 'a', 'b');
  w.advance(HOUR);
  assert.equal(esc.length, 0);
  assert.ok(turns.some((t) => t.step === 'calm' && t.who === 'a'), 'a keeps their patience');
  // a third at the table, fond of both, steps in
  const m = hot({ people: ['a', 'b', 'c'], bree: { stepInBase: 1 } });
  for (const x of ['a', 'b']) m.fellowship.adjust('c', x, 0.5);
  const mt = record(m, 'bree:turn');
  m.bree.start('chat', 'a', 'b');
  m.advance(HOUR);
  const step = mt.find((t) => t.step === 'step_in');
  assert.equal(step.who, 'c');
  assert.ok(step.end);
  const done = m.bree.history().at(-1);
  assert.equal(done.why, 'stepped in');
  assert.equal(done.mediator, 'c');
  assert.equal(done.kind, 'chat', 'it went no further');
  assert.equal(m.fellowship.regard('a', 'c'), 0.03, 'thanked for it');
  assert.equal(m.fellowship.regard('b', 'c'), 0.03);
  // nobody steps in for people they don't care for
  const cold = hot({ people: ['a', 'b', 'c'], bree: { stepInBase: 1 } });
  const ct = record(cold, 'bree:turn');
  cold.bree.start('chat', 'a', 'b');
  cold.advance(HOUR);
  assert.ok(!ct.some((t) => t.step === 'step_in'));
});

test('the one hurt may walk off instead: brushed off, and fonder of the other no more', () => {
  const w = hot({ bree: { escalation: 0, leaveBase: 1 } });
  const turns = record(w, 'bree:turn');
  w.bree.start('chat', 'a', 'b');
  w.advance(HOUR);
  const leave = turns.find((t) => t.step === 'leave');
  assert.equal(leave.who, 'b', 'a\'s words landed badly with b');
  assert.ok(leave.end);
  const done = w.bree.history().at(-1);
  assert.equal(done.why, 'left');
  assert.equal(done.left, 'b');
  assert.equal(done.n, 2);
  assert.ok(w.reverie.feelings('b').some((f) => f.id === 'snubbed'));
  assert.ok(w.fellowship.regard('b', 'a') < w.fellowship.regard('a', 'b'), 'the one who walked off thinks less of them');
});

test('people about see it: they believe it, remember it, feel it, think less of whoever started it, and gossip it', () => {
  const w = hot({ people: ['a', 'b', 'c', 'd'], bree: { escalateBase: 1 }, defs: { c: { traits: { talkative: 1 } } } });
  w.bree.kind({ id: 'argue', tags: ['hostile'], base: -3, turns: 3, weight: 0 });
  const seen = record(w, 'bree:witnessed');
  w.bree.start('chat', 'a', 'b');
  w.advance(HOUR);
  for (const id of ['c', 'd']) {
    assert.equal(w.reverie.belief(id, 'did:b:argue'), 'a', `${id} saw b start the argument with a`);
    assert.ok(w.reverie.memories(id).some((m) => m.k === 'saw:argue' && m.about === 'b'));
    assert.ok(w.reverie.feelings(id).some((f) => f.id === 'saw_row'));
    assert.ok(w.fellowship.regard(id, 'b') < 0);
  }
  assert.deepEqual(seen.map((e) => e.id).sort(), ['c', 'd']);
  assert.equal(w.reverie.belief('a', 'did:b:argue'), undefined, 'not the two in it');
  // what they saw goes round: someone who wasn't there hears of it
  w.tune('wormtongue', { gossipChance: 1 });
  w.person('e', { home: 'cafe', traits: { talkative: 1 } });
  w.advance(3 * HOUR);
  assert.equal(w.reverie.beliefRecord('e', 'did:b:argue')?.src, 'told');
  // the game can say who saw it, after the fact
  w.person('z', { home: 'yard', routine: [[0, 'yard', 'wait_about']] });
  w.bree.witnessed(w.bree.history().at(-1).id, ['z']);
  assert.equal(w.reverie.belief('z', 'did:b:argue'), 'a');
});

test('a fight the game calls a crime is Wormtongue\'s: witnesses, and reports; the game can say who sees', () => {
  const w = hot({ people: ['a', 'b', 'c', 'd'] });
  w.fellowship.group({ id: 'watch', kind: 'authority' });
  w.wormtongue.crime({ kind: 'fight', severity: 0.5, report: 1, reportTo: 'watch' });
  w.bree.witnesses = (ex) => ['c'];
  const reports = record(w, 'report');
  w.bree.start('chat', 'a', 'b');
  w.advance(3 * HOUR);
  assert.equal(w.reverie.belief('c', 'did:a:fight'), 'b', 'c saw a throw the first punch');
  assert.notEqual(w.reverie.beliefRecord('d', 'did:a:fight')?.src, 'saw', 'd, by the game\'s say, didn\'t (though c may have told them since)');
  assert.ok(reports.some((r) => r.actor === 'a' && r.kind === 'fight'));
  assert.ok(w.wormtongue.heat('a') > 0);
  assert.ok(w.wormtongue.witnesses('a').includes('b'), 'the one hit saw it too');
});

// ---------------------------------------------------------------------------
// Lasting conflict: grudges, feuds, avoidance, making up
// ---------------------------------------------------------------------------

test('a bad exchange leaves a grudge, by temper and forgiveness; it colors what comes after', () => {
  const run = (bree, defs) => {
    const w = hot({ bree: { escalation: 0, ...bree }, defs });
    w.bree.kind({ id: 'chat', base: -2.5, turns: 2 });
    w.bree.start('chat', 'a', 'b');
    w.advance(10);
    return w;
  };
  const w = run();
  assert.equal(w.bree.history().at(-1).outcome, 'sour');
  assert.equal(r3(w.bree.grudge('b', 'a')), 0.1);
  assert.equal(r3(w.bree.grudge('a', 'b')), 0.1, 'both heard it go sour');
  assert.equal(w.bree.grudges('b')[0].why, 'chat');
  assert.equal(r3(run({}, { b: { traits: { temper: 1 } } }).bree.grudge('b', 'a')), 0.15, 'a quick temper holds more');
  assert.equal(r3(run({}, { b: { traits: { forgiveness: 1 } } }).bree.grudge('b', 'a')), 0.05, 'a forgiving nature less');
  assert.equal(run({ grudges: 0 }).bree.grudge('b', 'a'), 0, 'grudges 0: none');
  assert.equal(r3(run({}, { b: { tune: { bree: { grudges: 2 } } } }).bree.grudge('b', 'a')), 0.2, 'their own');
  const next = w.bree.weigh('chat', 'a', 'b');
  assert.ok(next.parts.some(([k, v]) => k === 'grudge' && v < 0), 'the grudge colors the next');
});

test('avoidance: a grudge or a feud weighs places with them there lower, social actions aimed at them lower, a quarrel with them higher', () => {
  const w = table({ people: ['a', 'b', 'c'] });
  w.bree.kind({ id: 'argue', tags: ['hostile'], base: -1 });
  w.place({ id: 'park' });
  w.link('cafe', 'park', 3);
  w.action({ id: 'stroll', at: 'park', minutes: 30, base: 0.5 });
  w.action({ id: 'natter', target: 'person', at: 'here', minutes: 20, base: 0.5, tags: ['social'] });
  w.action({ id: 'have_it_out', target: 'person', at: 'here', minutes: 20, base: 0.5, interact: 'argue' });
  w.advance(10);
  const factor = (id, action, name, place) => {
    const opts = w.mind.options(w.get(id)).filter((o) => o.id === action && (!place || o.place === place));
    return opts.map((o) => o.parts.find((x) => x[0] === name)?.[1]);
  };
  assert.deepEqual(factor('a', 'sit', 'avoiding b'), [undefined], 'nothing yet');
  w.bree.grudgeAgainst('a', 'b', 0.5);
  assert.deepEqual(factor('a', 'sit', 'avoiding b'), [0.7], 'the cafe, with b in it');
  assert.deepEqual(factor('a', 'stroll', 'avoiding b'), [undefined], 'the park is clear');
  const aimed = w.mind.options(w.get('a')).filter((o) => o.target === 'b');
  assert.equal(aimed.find((o) => o.id === 'natter').parts.find((x) => x[0] === 'avoiding b')[1], 0.6);
  assert.equal(aimed.find((o) => o.id === 'have_it_out').parts.find((x) => x[0] === 'a grudge against b')[1], 1.5);
  assert.equal(w.mind.options(w.get('c')).find((o) => o.id === 'sit').parts.find((x) => x[0].startsWith('avoiding')), undefined, 'c holds nothing');
  // a feud between households: every member keeps clear of every member
  const f = table({ people: ['a', 'b', 'c'], defs: { a: { groups: ['h1'] }, b: { groups: ['h2'] }, c: { groups: ['h2'] } } });
  f.fellowship.group({ id: 'h1', kind: 'household' });
  f.fellowship.group({ id: 'h2', kind: 'household' });
  f.advance(10);
  f.bree.feud('h1', 'h2', 0.5);
  const sit = (id) => f.mind.options(f.get(id)).find((o) => o.id === 'sit').parts.filter((x) => x[0].startsWith('avoiding'));
  assert.equal(sit('a').length, 1);
  assert.equal(sit('b')[0][0], 'avoiding a', 'both ways');
  // and people do keep away: over a day, a spends less of it where b is
  const away = (g) => {
    const v = table({ people: ['a', 'b'], defs: { b: { routine: [[0, 'cafe', 'sit']] } } });
    v.place({ id: 'park' });
    v.link('cafe', 'park', 3);
    v.action({ id: 'stroll', at: 'park', minutes: 30, base: 0.5 });
    if (g) v.bree.grudgeAgainst('a', 'b', 0.9);
    let there = 0;
    for (let t = 0; t < 12 * 60; t += 15) { v.advance(15); if (v.get('a').place === 'cafe') there++; }
    return there;
  };
  assert.ok(away(true) < away(false), `${away(true)} < ${away(false)}`);
});

test('making up: an apology eases the grudge by the listener\'s forgiveness; reconciled, a sentiment remembers it', () => {
  const run = (bree, defs, kind = { id: 'sorry', base: 3.5, mends: 0.2 }) => {
    const w = table({ bree: { compatWeight: 0, moodWeight: 0, roomWeight: 0, ...bree }, defs });
    w.bree.kind(kind);
    w.advance(10);
    w.bree.grudgeAgainst('b', 'a', 0.4, 'the fence');
    w.bree.start(kind.id, 'a', 'b');
    w.advance(10);
    return w;
  };
  const w = run();
  assert.equal(w.bree.history().at(-1).outcomes.b, 'warm', 'a grudge against them colors even an apology, but this one lands');
  assert.equal(r3(w.bree.grudge('b', 'a')), 0.1, 'warm: one and a half times its mending');
  assert.equal(run({}, { b: { traits: { forgiveness: 1 } } }).bree.grudge('b', 'a'), 0, 'a forgiving nature: all of it');
  assert.equal(r3(run({}, { b: { traits: { forgiveness: 0 } } }).bree.grudge('b', 'a')), 0.25, 'an unforgiving one: a third as much');
  assert.equal(run({ forgiveness: 0 }).bree.grudge('b', 'a'), 0.4, 'nobody forgives');
  const made = run({}, { b: { traits: { forgiveness: 1 } } });
  assert.ok(made.fellowship.sentiments('b', 'a').some((s) => s.label === 'made it up'));
  assert.ok(made.reverie.feelings('b').some((f) => f.id === 'made_up'));
  assert.ok(made.reverie.memories('b').some((m) => m.k === 'made_up' && m.about === 'a'));
  // an apology turned down mends nothing (and sours it more)
  assert.ok(run({}, {}, { id: 'sorry', base: -1.5, mends: 0.2 }).bree.grudge('b', 'a') >= 0.4);
  // making up runs both ways
  const both = table({ bree: { compatWeight: 0, moodWeight: 0, roomWeight: 0 } });
  both.bree.kind({ id: 'make_up', base: 4.5, mends: 0.6, mutual: true });
  both.advance(10);
  both.bree.grudgeAgainst('a', 'b', 0.6);
  both.bree.grudgeAgainst('b', 'a', 0.6);
  assert.ok(both.bree.feudBetween('a', 'b') > 0, 'a feud');
  const mended = record(both, 'bree:mended');
  both.bree.start('make_up', 'a', 'b');
  both.advance(10);
  assert.equal(both.bree.grudge('a', 'b'), 0);
  assert.equal(both.bree.grudge('b', 'a'), 0);
  assert.equal(both.bree.feudBetween('a', 'b'), 0, 'and the feud with them');
  assert.deepEqual(mended.map((e) => e.id).sort(), ['a', 'b']);
  // the game, a go-between, or an effect can make it up too
  const g = apart();
  g.bree.grudgeAgainst('a', 'b', 0.9);
  g.bree.reconcile('a', 'b');
  assert.equal(g.bree.grudge('a', 'b'), 0);
  assert.ok(g.fellowship.sentiments('a', 'b').some((s) => s.label === 'made it up'));
  g.bree.grudgeAgainst('a', 'b', 0.9);
  g.lang.apply('grudge-=0.5', g.ctx(g.get('a'), { target: 'b' }));
  assert.equal(g.bree.grudge('a', 'b'), 0.4);
});

test('someone who steps in eases their grudges; time does too', () => {
  const m = hot({ people: ['a', 'b', 'c'], bree: { stepInBase: 1, mediateMends: 0.3 } });
  for (const x of ['a', 'b']) m.fellowship.adjust('c', x, 0.5);
  m.bree.grudgeAgainst('b', 'a', 0.5);
  m.bree.start('chat', 'a', 'b');
  m.advance(HOUR);
  assert.equal(m.bree.history().at(-1).why, 'stepped in');
  assert.ok(m.bree.grudge('b', 'a') < 0.5, `${m.bree.grudge('b', 'a')}`);
});

test('a fight between people of two households can set the households feuding', () => {
  const run = (spread) => {
    const w = hot({ people: ['a', 'b'], bree: { feudSpread: spread }, defs: { a: { groups: ['h1'] }, b: { groups: ['h2'] } } });
    w.fellowship.group({ id: 'h1', kind: 'household' });
    w.fellowship.group({ id: 'h2', kind: 'household' });
    w.bree.start('chat', 'a', 'b');
    w.advance(HOUR);
    return w.bree.feuds();
  };
  assert.deepEqual(run(0).filter((f) => f.a.startsWith('h')), [], 'off by default');
  const feuds = run(0.4).filter((f) => f.a.startsWith('h'));
  assert.equal(feuds.length, 1);
  assert.deepEqual([feuds[0].a, feuds[0].b, r3(feuds[0].strength), feuds[0].why], ['h1', 'h2', 0.4, 'fight']);
});

// ---------------------------------------------------------------------------
// Conversations over turns, on topics, in each one's manner, round a table
// ---------------------------------------------------------------------------

/** A table to talk at, with plain topics and a conversation kind. */
function talky(opts = {}) {
  const w = table({ ...opts, bree: { turnsJitter: 0, ...(opts.bree || {}) } });
  w.bree.topic({ id: 'weather' });
  w.bree.topic({ id: 'work' });
  w.bree.topic({ id: 'family' });
  w.bree.kind({ id: 'chat', topics: ['*'], group: true, turns: 8 });
  w.advance(10);
  return w;
}

test('a conversation goes topic by topic: it\'s opened, answered, followed up and capped, then another, and a goodbye', () => {
  const w = talky();
  const turns = record(w, 'bree:turn');
  w.bree.start('chat', 'a', 'b');
  w.advance(HOUR);
  assert.deepEqual(turns.map((t) => [t.who, t.step]), [
    ['a', 'open'], ['b', 'reply'], ['a', 'more'], ['b', 'back'],
    ['b', 'open'], ['a', 'reply'], ['b', 'more'], ['a', 'back'],
    ['a', 'bye'],
  ]);
  assert.equal(new Set(turns.slice(0, 4).map((t) => t.topic)).size, 1, 'one topic at a time');
  assert.notEqual(turns[0].topic, turns[4].topic, 'then another');
  assert.equal(turns[8].topic, null);
  assert.ok(turns[8].end);
  assert.equal(turns[1].line, `${turns[1].topic}.reply`, 'the words are the game\'s to look up');
  assert.equal(turns[8].line, 'chat.bye');
  // nothing left to say: they part
  const short = talky();
  const st = record(short, 'bree:turn');
  short.bree.kind({ id: 'chat', topics: ['*'], turns: 12 });
  short.bree.start('chat', 'a', 'b');
  short.advance(2 * HOUR);
  assert.equal(st.filter((t) => t.step === 'open').length, 3, 'three topics, each once');
  assert.equal(st.at(-1).step, 'bye');
});

test('topics come from what\'s true for both: news one has, a memory they share, what they love doing, what they\'re at, where they are', () => {
  const w = talky({ defs: { a: { instincts: { fish: 1.5 } } } });
  w.bree.topic({ id: 'news', from: 'beliefs' });
  w.bree.topic({ id: 'old_times', from: 'memories' });
  w.bree.topic({ id: 'pastimes', from: 'likes' });
  w.bree.topic({ id: 'the_moment', from: 'doing' });
  w.bree.topic({ id: 'here', from: 'place' });
  w.bree.topic({ id: 'grievance', from: 'grudge' });
  w.bree.topic({ id: 'doings', from: 'events' });
  const bree = w.bree;
  const subj = (id, s = 'a', l = 'b') => bree.subject(id, s, l);
  assert.equal(subj('news'), undefined, 'no news yet');
  w.reverie.believe('a', 'did:c:theft', true, 'saw');
  assert.equal(subj('news'), 'did:c:theft');
  w.reverie.believe('b', 'did:c:theft', true, 'told');
  assert.equal(subj('news'), undefined, 'b knows it already');
  w.reverie.believe('a', 'did:b:theft', true, 'saw');
  assert.equal(subj('news'), undefined, 'not to their face');
  w.reverie.remember('a', { k: 'flood' });
  assert.equal(subj('old_times'), undefined, 'only a\'s');
  w.reverie.remember('b', { k: 'flood' });
  assert.equal(subj('old_times'), 'flood', 'a memory they share');
  assert.equal(subj('doings'), 'flood', 'what\'s happened to them lately');
  w.advance(2 * DAY);
  assert.equal(subj('doings'), undefined, 'not so lately');
  assert.equal(subj('pastimes'), 'fish');
  assert.equal(subj('pastimes', 'b', 'a'), undefined, 'b has no passion to speak of');
  assert.equal(subj('the_moment'), 'sit');
  assert.equal(subj('here'), 'cafe');
  assert.equal(subj('grievance'), undefined);
  w.bree.grudgeAgainst('a', 'b', 0.3, 'the noise');
  assert.equal(subj('grievance'), 'the noise');
  // a topic they share is more to the listener's taste
  assert.ok(w.bree.weigh('chat', 'a', 'b', { topic: 'old_times', subject: 'flood' }).parts.some(([k, v]) => k === 'topic' && v === 0.5));
});

test('news told in talk passes on, heard out (through Wormtongue, or without it)', () => {
  for (const modules of [['reverie', 'fellowship', 'wormtongue', 'bree'], ['reverie', 'fellowship', 'bree']]) {
    const w = table({ modules, bree: { compatWeight: 0, moodWeight: 0 } });
    w.bree.topic({ id: 'news', from: 'beliefs' });
    w.bree.kind({ id: 'chat', topics: ['news'], turns: 2, base: 1 });
    w.advance(10);
    w.reverie.believe('a', 'did:c:theft', true, 'saw');
    w.bree.start('chat', 'a', 'b');
    const b = w.reverie.beliefRecord('b', 'did:c:theft');
    assert.equal(b?.src, 'told', modules.join());
    assert.equal(b.from, 'a');
    assert.ok(b.str < 1 && b.hops === 1);
  }
  // a teller who doesn't gossip tells nothing
  const q = table({ bree: { compatWeight: 0, moodWeight: 0 }, defs: { a: { tune: { wormtongue: { gossip: 0 } } } } });
  q.bree.topic({ id: 'news', from: 'beliefs' });
  q.bree.kind({ id: 'chat', topics: ['news'], turns: 2, base: 1 });
  q.advance(10);
  q.reverie.believe('a', 'did:c:theft', true, 'saw');
  q.bree.start('chat', 'a', 'b');
  assert.equal(q.reverie.belief('b', 'did:c:theft'), undefined);
});

test('each one talks in their manner: the best fit for their nature, and it colors how their words land', () => {
  const w = talky({ defs: { a: { traits: { temper: 0.95 } } } });
  for (const m of Tyrell.breeStarter().manners) w.bree.manner(m);
  assert.equal(w.bree.mannerOf('a'), 'ornery');
  assert.equal(w.bree.mannerOf('b'), 'plain');
  assert.equal(w.lang.value('manner', w.ctx(w.get('a'))), 'ornery');
  const turns = record(w, 'bree:turn');
  w.bree.start('chat', 'a', 'b');
  assert.equal(turns[0].manner, 'ornery');
  assert.deepEqual(w.bree.exchange('a').manners, { a: 'ornery', b: 'plain' });
  assert.ok(w.bree.weigh('chat', 'a', 'b').parts.some(([k, v]) => k === 'manner' && v === -0.75), 'an ornery word lands badly');
});

test('round a table, everyone takes a turn: each answers the opener; someone happening by joins in', () => {
  const w = talky({ people: ['a', 'b', 'c'], bree: { joinChance: 1 } });
  w.bree.kind({ id: 'chat', topics: ['*'], group: true, turns: 5 });
  const turns = record(w, 'bree:turn'), joined = record(w, 'bree:joined');
  w.bree.start('chat', 'a', 'b');
  assert.deepEqual(w.bree.exchange('a').who, ['a', 'b'], 'the game says who\'s in it');
  w.bree.end('a');
  // struck up at the table, the third joins in
  w.tune('bree', { strike: 1 });
  w.advance(3 * HOUR);
  const ex = w.bree.history().find((f) => f.who.length === 3);
  assert.ok(ex, 'a table of three');
  const steps = turns.filter((t) => t.id === ex.id).slice(0, 5).map((t) => t.step);
  assert.deepEqual(steps, ['open', 'reply', 'reply', 'more', 'back'], 'two answers to the opener');
  // regard runs between every pair, at a share
  const g = talky({ people: ['a', 'b', 'c'], bree: { compatWeight: 0, moodWeight: 0, roomWeight: 0 } });
  g.bree.kind({ id: 'chat', topics: ['*'], group: true, turns: 5, base: 3 });
  g.bree.start('chat', 'a', ['b', 'c']);
  g.advance(HOUR);
  assert.equal(g.fellowship.regard('b', 'c'), 0.02, 'half of warm\'s 0.04');
  assert.equal(g.fellowship.regard('c', 'a'), 0.02);
  // someone arriving where a group talks can join it as it goes on
  const late = talky({ people: ['a', 'b'], bree: { joinChance: 1 } });
  late.bree.kind({ id: 'chat', topics: ['*'], group: true, turns: 12 });
  late.bree.start('chat', 'a', 'b');
  late.person('c', { home: 'cafe' });
  late.advance(5);
  assert.deepEqual(late.bree.exchange('a').who, ['a', 'b', 'c']);
});

test('the words: Cityspeak\'s most specific line for the topic and the step, by manner and how the turn landed', () => {
  const w = talky({ defs: { b: { traits: { temper: 0.95 } } } });
  for (const m of Tyrell.breeStarter().manners) w.bree.manner(m);
  w.bree.kind({ id: 'chat', topics: ['weather'], turns: 2 });
  w.cityspeak.addLines([
    { key: 'w_open', topic: 'weather.open', text: 'Some weather we\'re having.' },
    { key: 'w_reply', topic: 'weather.reply', text: 'Isn\'t it.' },
    { key: 'w_reply_ornery', topic: 'weather.reply', when: ['manner:ornery'], text: 'It\'s weather. It happens.' },
    { key: 'bye_any', topic: 'bree.bye', text: 'Well, good day.' },
  ]);
  const turns = record(w, 'bree:turn');
  w.bree.start('chat', 'a', 'b');
  w.advance(HOUR);
  assert.deepEqual(turns.map((t) => [t.step, t.key, t.line]), [['open', 'w_open', 'weather.open'], ['reply', 'w_reply_ornery', 'weather.reply'], ['bye', 'bye_any', 'bree.bye']]);
  assert.equal(turns[1].text, 'It\'s weather. It happens.');
});

test('talk 0: an exchange begun by an action is a word and no more', () => {
  const w = talky({ bree: { talk: 0 } });
  w.action({ id: 'natter', target: 'person', at: 'here', minutes: 20, rank: -1, interact: 'chat' });
  w.direct('a', { do: 'natter', target: 'b' });
  w.advance(30);
  const done = w.bree.history().at(-1);
  assert.equal(done.why, 'done');
  assert.ok(done.n <= 2, 'a word, and goodbye');
});

// ---------------------------------------------------------------------------
// Rocinante, Voight-Kampff, tuning during play
// ---------------------------------------------------------------------------

test('Rocinante with the bree option: a town that talks, quarrels and makes up, and still behaves like people', () => {
  const plain = rocinante();
  assert.equal(plain.bree.kinds.size, 0, 'without the option, nothing');
  const report = Tyrell.VoightKampff.run({ build: (seed) => rocinante({ seed, bree: true }), days: 3, checks: ['nobody-starves', 'capacity', 'no-stuck', 'deterministic', 'esper', 'save-load', 'interactions'] });
  assert.ok(report.passed, report.failures.join('\n'));
  const ix = report.stats.interactions;
  assert.ok(ix.exchanges > 20 && ix.turns > ix.exchanges, JSON.stringify(ix));
  assert.ok(Object.keys(ix.kinds).length > 5);
  assert.ok(ix.outcomes.warm > 0 && ix.outcomes.fine > 0);
  assert.equal(Tyrell.VoightKampff.run({ build: (seed) => rocinante({ seed }), days: 1, checks: ['capacity'] }).stats.interactions, undefined, 'nothing to say without it');
});

test('tuning Bree during play is recorded: rewound past, undone; played again, the same', () => {
  const run = () => {
    const w = rocinante({ bree: true });
    w.advance(10 * HOUR);
    w.tune('bree', { talk: 3, escalation: 2 });
    w.tune('bree', { grudges: 0 }, 'sam');
    w.advance(8 * HOUR);
    return w;
  };
  const w = run();
  const h = w.hash();
  assert.equal(run().hash(), h);
  assert.equal(w.tuning('bree').talk, 3);
  assert.equal(w.tuning('bree', 'sam').grudges, 0);
  w.rewind(9 * HOUR);
  assert.equal(w.tuning('bree').talk, 1);
  w.advance(9 * HOUR);
  assert.equal(w.hash(), h);
  const saved = JSON.stringify(w.save());
  const v = rocinante({ bree: true });
  v.load(saved);
  v.advance(6 * HOUR); w.advance(6 * HOUR);
  assert.equal(v.hash(), w.hash(), 'and loaded, it runs the same');
});
