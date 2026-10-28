// Wormtongue (witnesses, heat, gossip, lies, secrets, favors), Cityspeak
// (lines, practices, social acts, barks, ink), Gaff (the director), Ceres
// (money and goods), Cradle (lives), Joi (the voice), the inspector, the log
// and Voight-Kampff.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tyrell, rocinante, tiny, until, HOUR, DAY } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Wormtongue
// ---------------------------------------------------------------------------

test('a witness who knows you recognizes you, believes it, and may report it: heat', () => {
  const w = rocinante({ start: 10 * HOUR });
  w.wormtongue.crime({ kind: 'strip', severity: 0.6, reportTo: 'watch', report: 1 });
  w.did('player', 'fixed', { for: 'dev' }); // Dev knows the player now
  const reports = [];
  w.on('report', (r) => reports.push(r));
  w.sense({ kind: 'strip', actor: 'player', what: 'till', place: 'market', seenBy: ['dev'] });
  assert.equal(w.reverie.belief('dev', 'did:player:strip'), 'till');
  assert.ok(until(w, () => reports.length > 0, 3 * HOUR, 5));
  assert.ok(w.wormtongue.heat('player') > 0);
  assert.ok(w.fellowship.standing('watch', 'player').infamy > 0);
  assert.ok(w.wormtongue.witnesses('player').includes('dev'));
  assert.ok(w.reverie.belief('vance', 'did:player:strip') !== undefined, 'the Watch knows');
});

test('a good disguise means nobody knows who it was', () => {
  const w = rocinante({ start: 10 * HOUR });
  w.sense({ kind: 'strip', actor: 'player', place: 'market', seenBy: ['dev', 'ruth', 'kofi'], disguise: 1 });
  for (const id of ['dev', 'ruth', 'kofi']) {
    assert.equal(w.reverie.belief(id, 'did:player:strip'), undefined);
    assert.equal(w.reverie.belief(id, 'did:someone:strip'), true);
  }
});

test('heat fades by the day', () => {
  const w = rocinante();
  w.wormtongue.addHeat('player', 10);
  w.advance(3 * DAY);
  assert.ok(w.wormtongue.heat('player') < 10 * 0.9);
});

test('people commit crimes the world can see: theft at the market is witnessed', () => {
  const w = rocinante({ start: 10 * HOUR });
  w.setVar('sam', 'money', 0);
  w.mind.setLevel(w.get('sam'), 'hunger', 0.95);
  const seen = [];
  w.on('witnessed', (e) => seen.push(e));
  assert.ok(until(w, () => w.westmarch.find({ k: 'started', who: 'sam' }).some((e) => e.d.action === 'steal_food'), DAY));
  // whoever was at the market saw something
  const there = w.westmarch.find({ k: 'witnessed' });
  assert.ok(there.every((e) => e.d.kind === 'theft'));
});

test('gossip travels a hop at a time, weaker each time, no further than the limit', () => {
  const w = rocinante({ start: 9 * HOUR });
  const told = [];
  w.on('told', (e) => told.push(e));
  w.reverie.believe('ruth', 'did:sam:theft', true, 'saw');
  w.advance(3 * DAY);
  const heard = w.people().filter((p) => p.id !== 'ruth' && w.reverie.belief(p.id, 'did:sam:theft') !== undefined);
  assert.ok(heard.length >= 1, 'somebody heard');
  for (const p of heard) {
    const b = w.reverie.beliefRecord(p.id, 'did:sam:theft');
    assert.ok(b.hops <= w.wormtongue.config.maxHops);
    if (b.src === 'told') assert.ok(b.str < 1);
  }
  assert.ok(told.some((e) => e.key === 'did:sam:theft'));
});

test('a dishonest teller who dislikes the subject may lie: the blame goes to someone else', () => {
  const w = rocinante();
  w.wormtongue.config.lieChance = 1;
  w.wormtongue.config.gossipChance = 1;
  const sam = w.get('sam'), kofi = w.get('kofi');
  w.fellowship.adjust('sam', 'ruth', -0.9);
  w.fellowship.adjust('sam', 'dev', -0.5);
  w.reverie.believe('sam', 'did:ruth:theft', true, 'saw');
  w.wormtongue.met(sam, kofi); // make them meet
  const told = w.westmarch.find({ k: 'told' }).filter((e) => e.who === 'sam');
  assert.equal(told.length, 1);
  assert.equal(told[0].d.lie, true);
  assert.equal(told[0].d.key, 'did:dev:theft');
  assert.equal(w.reverie.belief('kofi', 'did:dev:theft'), true, 'Dev gets the blame');
  assert.equal(w.reverie.belief('kofi', 'did:ruth:theft'), undefined, 'Ruth is neither blamed nor cleared');
});

test('a liar with nobody else to blame passes on the truth, and it isn\'t called a lie', () => {
  const w = rocinante();
  w.wormtongue.config.lieChance = 1;
  w.wormtongue.config.gossipChance = 1;
  w.fellowship.adjust('sam', 'ruth', -0.9);
  w.reverie.believe('sam', 'did:ruth:theft', true, 'saw');
  const told = [];
  w.on('told', (e) => told.push(e));
  w.wormtongue.met(w.get('sam'), w.get('kofi'));
  const fromSam = told.filter((e) => e.from === 'sam');
  assert.equal(fromSam.length, 1);
  assert.equal(fromSam[0].key, 'did:ruth:theft');
  assert.equal(fromSam[0].lie, false);
  assert.equal(w.reverie.belief('kofi', 'did:ruth:theft'), true, 'never "Ruth didn\'t do it"');
});

test('a report that comes through gossip carries what was done', () => {
  const w = rocinante({ start: 10 * HOUR });
  w.wormtongue.config.gossipChance = 1;
  const reports = [];
  w.on('report', (r) => reports.push(r));
  w.reverie.believe('kofi', 'did:sam:theft', 'bread', 'saw');
  w.wormtongue.met(w.get('kofi'), w.get('vance')); // Vance is the Watch
  const r = reports.find((x) => x.actor === 'sam');
  assert.ok(r, 'the Watch took it as a report');
  assert.equal(r.what, 'bread');
  assert.equal(w.wormtongue.reports('sam')[0].what, 'bread');
});

test('a witness can be paid off (if they will) or scared off', () => {
  const w = rocinante({ start: 10 * HOUR });
  w.sense({ kind: 'strip', actor: 'player', place: 'market', seenBy: ['sam', 'lena'] });
  const results = [];
  w.on('silenced', (e) => results.push(e));
  w.wormtongue.silence('sam', 'player', 'pay', 50);
  w.wormtongue.silence('lena', 'player', 'pay', 50);
  assert.equal(results.length, 2);
  const sam = results.find((r) => r.witness === 'sam');
  if (sam.ok) assert.ok(!w.wormtongue.witnesses('player').includes('sam'));
  w.wormtongue.silence('kofi', 'player', 'scare');
  assert.ok(w.reverie.feelings('kofi').some((f) => f.id === 'scared'));
});

test('secrets: held by a few, passed on reluctantly; favors owed and settled', () => {
  const w = rocinante();
  w.wormtongue.secret('affair', { about: 'tomas', key: 'affair:tomas', value: true, knownBy: ['ines'] });
  assert.equal(w.reverie.belief('ines', 'affair:tomas'), true);
  w.wormtongue.owe('kofi', 'dev', 2);
  assert.equal(w.wormtongue.owes('kofi', 'dev'), 2);
  assert.ok(w.lang.test('owes:dev>=2', w.ctx(w.get('kofi'))));
  w.wormtongue.owe('kofi', 'dev', -2);
  assert.equal(w.wormtongue.owes('kofi', 'dev'), 0);
});

// ---------------------------------------------------------------------------
// Cityspeak
// ---------------------------------------------------------------------------

test('lines: the most specific that matches wins', () => {
  const w = rocinante({ start: 7 * HOUR });
  const cs = w.cityspeak;
  assert.equal(cs.choose('kofi', { topic: 'greet' }).key, 'greet');
  w.mind.setLevel(w.get('kofi'), 'energy', 0.9);
  assert.equal(cs.choose('kofi', { topic: 'greet' }).key, 'greet_tired');
  w.did('player', 'fixed', { for: 'kofi' });
  w.mind.setLevel(w.get('kofi'), 'energy', 0.1);
  assert.equal(cs.choose('kofi', { topic: 'greet', to: 'player' }).key, 'greet_player_fixed');
});

test('saying something on purpose: remembered, with cooldowns and replies', () => {
  const w = rocinante({ start: 7 * HOUR });
  w.advanceTo(8 * HOUR); // Mara is at the cafe
  const said = w.cityspeak.say('mara', { topic: 'greet' });
  assert.equal(said.key, 'mara_bread');
  assert.equal(said.text, 'Bread\'s fresh this morning.');
  assert.notEqual(w.cityspeak.say('mara', { topic: 'greet' })?.key, 'mara_bread', 'not again so soon');
  const chat = w.cityspeak.choose('kofi', { topic: 'chat' });
  const reply = w.cityspeak.answer(chat, 'ruth');
  assert.ok(reply && reply.who === 'ruth');
});

test('said:<key> remembers lines by their key; older saves keep what was said', () => {
  const w = rocinante({ start: 7 * HOUR });
  w.advanceTo(8 * HOUR); // Mara is at the cafe
  const ctx = () => w.ctx(w.get('mara'));
  assert.equal(w.lang.test('said:mara_bread', ctx()), false);
  assert.equal(w.cityspeak.say('mara', { topic: 'greet' }).key, 'mara_bread');
  assert.equal(w.lang.test('said:mara_bread', ctx()), true);
  const i = w.cityspeak.lines.findIndex((l) => l.key === 'mara_bread');
  assert.equal(w.lang.test('said:' + i, ctx()), true, 'by index too, as before');
  // a save from before 1.1: what was said is kept by line index
  const old = w.save();
  old.v = 1;
  old.s.mod.cityspeak.said = { mara: { [String(i)]: w.now } };
  const x = rocinante({ start: 7 * HOUR });
  x.load(old);
  assert.equal(x.lang.test('said:mara_bread', x.ctx(x.get('mara'))), true);
  assert.notEqual(x.cityspeak.say('mara', { topic: 'greet' })?.key, 'mara_bread', 'its cooldown carried over');
  // and a save with history: its snapshots are migrated too
  const hist = w.save(true);
  hist.v = 1;
  const y = rocinante({ start: 7 * HOUR });
  y.load(hist);
  y.rewind(30);
  assert.equal(y.lang.test('said:mara_bread', y.ctx(y.get('mara'))), false);
  y.advance(30);
  assert.equal(y.lang.test('said:mara_bread', y.ctx(y.get('mara'))), true);
});

test('an action with says says a line on that topic when it starts', () => {
  const w = tiny({ start: 10 * HOUR });
  w.cityspeak.line({ key: 'order_up', topic: 'ordering', text: 'Noodles, please.' });
  w.action({ id: 'order', at: 'cafe', minutes: 5, says: 'ordering', rank: -1 });
  const p = w.person('ana', { home: 'home_a', place: 'cafe' });
  const said = [];
  w.on('say', (s) => said.push(s));
  w.direct('ana', { do: 'order' });
  assert.equal(p.doing?.action, 'order');
  assert.deepEqual(said.map((s) => s.key), ['order_up']);
  assert.ok(w.lang.test('said:order_up', w.ctx(p)));
});

test('practices make role actions more appealing to those who fill the role', () => {
  const w = rocinante({ start: 18 * HOUR });
  w.advance(1);
  const p = w.get('kofi');
  w.mind.setLevel(p, 'hunger', 0.6);
  const at = w.mind.explain(p, 'eat_cafe').find((c) => c.place === 'cafe');
  assert.ok(at.parts.some(([n]) => n === 'dinner: diner'), JSON.stringify(at.parts));
  assert.ok(w.lang.test('practice:dinner', w.ctx({ ...p, place: 'cafe' })));
});

test('social acts: the target may say yes or no, with feelings and regard', () => {
  const w = rocinante();
  w.fellowship.adjust('kofi', 'ruth', 1);
  const ok = w.cityspeak.resolve('chat', 'ruth', 'kofi');
  assert.equal(typeof ok, 'boolean');
  assert.equal(w.westmarch.find({ k: 'social' }).length, 1);
});

test('barks: people near the player answer each other, and the world doesn\'t change', () => {
  const w = rocinante({ start: 7 * HOUR });
  w.focus(['main', 'blocks', 'river']);
  const barks = [];
  w.on('bark', (b) => barks.push(b));
  w.advance(DAY);
  assert.ok(barks.length > 0);
  assert.ok(barks[0].lines.length >= 1);
  // the same day unwatched is the same world
  const quiet = rocinante({ start: 7 * HOUR });
  quiet.advance(DAY);
  assert.equal(quiet.hash(), w.hash());
});

test('ink: a story can ask Tyrell about the world', () => {
  const w = rocinante();
  const fns = {};
  w.cityspeak.bindInk({ BindExternalFunction: (name, fn) => { fns[name] = fn; } });
  w.fact('raining', true);
  assert.equal(fns.tyrell_fact('raining'), true);
  assert.equal(typeof fns.tyrell_mood('ruth'), 'number');
  assert.equal(fns.tyrell_test('ruth', 'money>=0'), true);
});

// ---------------------------------------------------------------------------
// Gaff
// ---------------------------------------------------------------------------

test('storylets fire on a mean time between events, with cooldowns', () => {
  const w = tiny();
  let fired = 0;
  w.gaff.storylet({ id: 'knock', mtb: 3 * HOUR, cooldown: 6 * HOUR, fire: () => { fired++; } });
  w.advance(5 * DAY);
  assert.ok(fired >= 5 && fired <= 20, `fired ${fired} times`);
  const times = w.gaff.history().map((h) => h.t);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 6 * HOUR);
});

test('decks: shuffled, no card twice in a row', () => {
  const w = tiny();
  w.gaff.deck('bosses', ['tank', 'witch', 'none']);
  const draws = [];
  for (let i = 0; i < 30; i++) draws.push(w.gaff.draw('bosses'));
  for (let i = 1; i < draws.length; i++) assert.notEqual(draws[i], draws[i - 1]);
  assert.deepEqual([...new Set(draws)].sort(), ['none', 'tank', 'witch']);
});

test('a cooldown on a deck\'s trigger counts from the last card it fired', () => {
  const w = tiny();
  const fired = [];
  w.gaff.storylet({ id: 'season', mtb: 60, cooldown: DAY, deck: 'events', fire: () => {} });
  w.gaff.deck('events', ['a', 'b']);
  for (const id of ['a', 'b']) w.gaff.storylet({ id, mtb: Infinity, fire: () => fired.push(w.now) });
  w.advance(3 * DAY);
  assert.ok(fired.length >= 2 && fired.length <= 4, `${fired.length} cards in three days`);
  for (let i = 1; i < fired.length; i++) assert.ok(fired[i] - fired[i - 1] >= DAY);
});

test('intensity: build up, peak, fade, relax; storylets can wait for a phase', () => {
  const w = tiny();
  assert.equal(w.gaff.phase(), 'build');
  w.gaff.bump('world', 0.9);
  w.advance(HOUR + 1);
  assert.equal(w.gaff.phase(), 'peak');
  w.advance(5 * HOUR);
  assert.equal(w.gaff.phase(), 'fade');
});

test('a storylet\'s changes replay exactly after a rewind (and aren\'t recorded twice)', () => {
  const w = rocinante();
  w.gaff.storylet({ id: 'flood', mtb: 2 * HOUR, cooldown: DAY, fire: (world) => world.fact('flooded', world.now) });
  w.advance(DAY);
  const h = w.hash();
  w.rewind(12 * HOUR);
  w.advance(12 * HOUR);
  assert.equal(w.hash(), h);
});

test('unseen places: somewhere nobody is and the game isn\'t showing', () => {
  const w = rocinante({ start: 3 * HOUR });
  w.focus(['main']);
  const place = w.gaff.unseenPlace('home');
  assert.ok(place === null || w.ring.region(place) !== 'main');
});

// ---------------------------------------------------------------------------
// Ceres
// ---------------------------------------------------------------------------

test('prices are paid to the owner; no money, no meal', () => {
  const w = rocinante({ start: 12 * HOUR });
  const kofi = w.get('kofi');
  w.setVar('kofi', 'money', 20);
  w.direct('kofi', { do: 'eat_cafe' });
  assert.ok(until(w, () => kofi.doing?.action === 'eat_cafe' && kofi.doing.kind === 'act', HOUR));
  assert.equal(kofi.vars.money, 14);
  assert.ok(w.ceres.ledger('mara').some((e) => e.why === 'eat_cafe'));
  w.setVar('kofi', 'money', 2);
  const c = w.mind.explain(kofi, 'eat_cafe')[0];
  assert.match(c.blocked, /afford/);
});

test('stock runs out and restocks; household goods go in the pantry', () => {
  const w = rocinante({ start: 9 * HOUR });
  w.ceres.restock('market', 'radio', -2);
  assert.equal(w.ceres.stock('market', 'radio'), 0);
  const c = w.mind.explain(w.get('lena'), 'buy_radio')[0];
  assert.match(c.blocked, /sold out/);
  const mara = w.get('mara');
  w.direct('mara', { do: 'buy_food' });
  assert.ok(until(w, () => w.ceres.pantryCount('mara', 'food') > 0, 6 * HOUR));
  assert.equal(w.ceres.pantryCount('pip', 'food'), w.ceres.pantryCount('mara', 'food'), 'Pip can eat it too');
  assert.ok(w.have(w.get('pip'), 'food') > 0);
  void mara;
});

test('goods: a kind that conditions can count, and a label the inspector shows', () => {
  const w = rocinante({ start: 9 * HOUR });
  w.ceres.good({ id: 'apple', kind: 'food', label: 'an apple' });
  w.give('kofi', 'apple', 2);
  w.give('kofi', 'food', 1);
  const ctx = w.ctx(w.get('kofi'));
  assert.equal(w.lang.value('goods:food', ctx), 3);
  assert.equal(w.lang.value('goods:gadget', ctx), 0);
  assert.match(w.describe('kofi'), /an apple x2/);
});

test('wages for work, rent and incomes on their days', () => {
  const w = rocinante({ start: 16 * HOUR });
  const ines = w.get('ines');
  const before = Number(ines.vars.money);
  w.advanceTo(DAY + 3 * HOUR);
  assert.ok(Number(ines.vars.money) > before, 'Ines got paid for her shift');
  w.ceres.rent('sam', 1000, 1, 'dev');
  const missed = [];
  w.on('rent-missed', (e) => missed.push(e));
  w.advance(2 * DAY);
  assert.ok(missed.some((m) => m.id === 'sam'));
  assert.equal(w.reverie.belief('dev', 'behind:sam'), true, 'the landlord knows');
});

// ---------------------------------------------------------------------------
// Cradle
// ---------------------------------------------------------------------------

test('ages and stages', () => {
  const w = rocinante();
  assert.equal(w.cradle.stage('pip'), 'child');
  assert.ok(Math.abs(w.cradle.age('pip') - 9) < 0.1);
  assert.ok(w.lang.test('stage:child', w.ctx(w.get('pip'))));
});

test('a birth: traits from both parents, a household, a sentiment', () => {
  const w = rocinante();
  const id = w.cradle.birth(['mara', 'tomas'], { name: 'Baby Okafor' });
  const baby = w.get(id);
  assert.equal(baby.name, 'Baby Okafor');
  assert.ok(baby.def.groups.includes('h_okafor'));
  assert.deepEqual(w.cradle.parents(id), ['mara', 'tomas']);
  const avg = (w.get('mara').def.traits.honesty + w.get('tomas').def.traits.honesty) / 2;
  assert.ok(Math.abs(baby.def.traits.honesty - avg) <= 0.12 + 1e-9);
  assert.equal(w.cradle.stage(id), 'baby');
});

test('a departure: grief for those who cared, the money passed on', () => {
  const w = rocinante();
  w.fellowship.adjust('mara', 'tomas', 0.8);
  const money = Number(w.get('tomas').vars.money);
  const maraBefore = Number(w.get('mara').vars.money);
  w.cradle.depart('tomas', 'died');
  assert.equal(w.get('tomas').status, 'gone');
  assert.ok(w.reverie.feelings('mara').some((f) => f.id === 'grief'));
  assert.equal(Number(w.get('mara').vars.money), maraBefore + money, 'his partner inherits');
  assert.equal(w.cradle.departed().tomas.why, 'died');
});

test('couples form on their own when the game lets them', () => {
  const w = Tyrell.create({ seed: 'pair', moduleConfig: { cradle: { autoPair: { regard: 0.5, attraction: 0.4 } } } });
  w.place({ id: 'h' });
  w.person('a', { home: 'h', born: -30 * 365 * DAY }); w.person('b', { home: 'h', born: -30 * 365 * DAY });
  w.fellowship.adjust('a', 'b', 0.8); w.fellowship.adjust('b', 'a', 0.8);
  w.fellowship.attract('a', 'b', 0.6); w.fellowship.attract('b', 'a', 0.6);
  w.advance(DAY + 1);
  assert.equal(w.fellowship.partner('a'), 'b');
});

// ---------------------------------------------------------------------------
// Joi
// ---------------------------------------------------------------------------

test('Joi: the written line without a provider; the model when there is one; never a change', async () => {
  const w = rocinante({ start: 8 * HOUR });
  const before = w.hash();
  const plain = await w.joi.speak('ruth', { topic: 'greet' });
  assert.equal(plain.fromModel, false);
  assert.ok(plain.text.length > 0);
  w.joi.allow(['offers_job']);
  w.joi.setProvider(async (req) => {
    assert.match(req.prompt, /You are Ruth/);
    return { text: 'Morning, love.', flags: ['offers_job', 'burns_house'] };
  });
  const spoken = await w.joi.speak('ruth', { topic: 'greet', to: 'player' });
  assert.equal(spoken.text, 'Morning, love.');
  assert.deepEqual(spoken.flags, ['offers_job']);
  assert.equal(w.hash(), before, 'nothing changed');
});

test('looking never draws: chance: in lines and inspected conditions changes nothing', async () => {
  const w = rocinante({ start: 8 * HOUR });
  w.cityspeak.line({ key: 'maybe', topic: 'greet', when: ['chance:0.5'], text: 'Maybe.' });
  w.cityspeak.line({ key: 'chancer', topic: 'chat', when: ['chance:0.5'], text: 'Feeling lucky.' });
  w.action({ id: 'gamble', at: 'bar', minutes: 30, base: 0.1, if: ['chance:0.5'] });
  w.gaff.storylet({ id: 'coin', mtb: Infinity, when: ['chance:0.5'], fire: () => {} });
  const h = w.hash();
  for (let i = 0; i < 5; i++) {
    w.cityspeak.choose('ruth', { topic: 'greet' });
    w.cityspeak.converse('ruth', 'kofi');
    w.whyNot('ruth', 'gamble');
    w.describe('ruth');
    w.mind.explain(w.get('ruth'), 'gamble');
    w.gaff.eligible(w.gaff.storylets.get('coin'));
    w.mentat.acquire(w.get('ruth'), 'food', 3, new Set());
    w.peek(() => w.lang.test('chance:0.5', w.ctx(w.get('ruth'))));
    await w.joi.speak('ruth', { topic: 'greet' });
  }
  assert.equal(w.hash(), h, 'nobody\'s stream moved');
});

test('Joi falls back when the model is slow or fails', async () => {
  const w = rocinante();
  w.joi.setProvider(() => new Promise((res) => setTimeout(() => res('too late'), 200)));
  const slow = await w.joi.speak('ruth', { topic: 'greet', timeoutMs: 20 });
  assert.equal(slow.fromModel, false);
  w.joi.setProvider(async () => { throw new Error('offline'); });
  const failed = await w.joi.speak('ruth', { topic: 'greet' });
  assert.equal(failed.fromModel, false);
});

// ---------------------------------------------------------------------------
// The inspector, the log, Voight-Kampff
// ---------------------------------------------------------------------------

test('Palantir: why, why not, and a readable account', () => {
  const w = rocinante();
  w.advance(4 * HOUR);
  const d = w.why('kofi');
  assert.ok(d.picked);
  assert.ok(d.candidates.length > 1);
  assert.match(w.whyNot('kofi', 'serve'), /job|bartender|declared/);
  const text = w.describe('kofi');
  assert.match(text, /Kofi \(kofi\)/);
  assert.match(text, /needs: hunger/);
  assert.match(text, /mood:/);
});

test('a listener for every event gets the real event name', () => {
  const w = rocinante({ start: 10 * HOUR });
  const seen = [];
  w.on('*', (e) => seen.push(e));
  w.sense({ kind: 'theft', actor: 'player', place: 'market', seenBy: ['dev'] });
  const witnessed = seen.find((e) => e.event === 'witnessed');
  assert.ok(witnessed, 'witnessed arrives as witnessed');
  assert.equal(witnessed.kind, 'theft', 'with its payload as before');
  assert.ok(seen.some((e) => e.event === 'log' && e.kind === 'log'));
});

test('a directive\'s label is logged and shown', () => {
  const w = rocinante({ start: 10 * HOUR });
  w.direct('kofi', { do: 'walk', at: 'park', label: 'meet the player at the park' });
  assert.match(w.describe('kofi'), /directed to: walk \(meet the player at the park\)/);
  assert.equal(w.westmarch.find({ k: 'directed', who: 'kofi' })[0].d.label, 'meet the player at the park');
});

test('Westmarch: the log and a chronicle of someone\'s day', () => {
  const w = rocinante();
  w.advance(DAY);
  assert.ok(w.westmarch.find({ k: 'started', who: 'ruth' }).length > 3);
  const lines = w.westmarch.chronicle('ruth', 0);
  assert.ok(lines.length > 3);
  assert.match(lines[0], /^\d\d:\d\d /);
});

test('a chronicle shows deeds done for someone, what they heard, at the right minute', () => {
  const w = rocinante({ start: 7 * HOUR });
  w.advance(20); // 7:20
  w.did('player', 'fixed', { for: 'ruth', what: 'radio' });
  w.did('kofi', 'helped', { to: 'ruth' });
  w.wormtongue.config.gossipChance = 1;
  w.reverie.believe('sam', 'did:dev:theft', 'bread', 'saw');
  w.wormtongue.met(w.get('sam'), w.get('ruth'));
  const lines = w.westmarch.chronicle('ruth', 7 * HOUR);
  assert.ok(lines.includes('07:20 player fixed them'), lines.join('\n'));
  assert.ok(lines.includes('07:20 Kofi helped them'), lines.join('\n'));
  assert.ok(lines.includes('07:20 heard about did:dev:theft from Sam'), lines.join('\n'));
  assert.match(w.describe('ruth'), /day 0 07:20/);
});

test('Voight-Kampff: Rocinante behaves like people for a week', () => {
  const report = Tyrell.VoightKampff.run({ build: (seed) => rocinante({ seed }), days: 7 });
  assert.deepEqual(report.failures, []);
  assert.ok(report.passed);
  assert.ok(report.stats.actions.sleep > 0);
  const again = Tyrell.VoightKampff.run({ build: (seed) => rocinante({ seed }), days: 7, checks: ['capacity'] });
  assert.deepEqual(Tyrell.VoightKampff.compare(again, report, 0.001), []);
});
