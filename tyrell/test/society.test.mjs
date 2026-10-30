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

test('a witness who knows you well is slower to report you: familiarReport, with Voice\'s familiarity', () => {
  const run = (wormtongue) => {
    const w = rocinante({ start: 10 * HOUR, moduleConfig: { wormtongue } });
    w.wormtongue.crime({ kind: 'strip', severity: 0.6, reportTo: 'watch', report: 1 });
    w.voice.start('dev'); w.voice.end(); // a talk: half a point of familiarity
    const reports = [];
    w.on('report', (r) => { if (r.actor === 'player') reports.push(r); });
    w.sense({ kind: 'strip', actor: 'player', what: 'till', place: 'market', seenBy: ['dev'] });
    until(w, () => reports.length > 0, 3 * HOUR, 5);
    return { w, reports };
  };
  const plain = run({});
  assert.equal(plain.w.voice.familiarity('dev'), 0.5);
  assert.equal(plain.reports.length, 1, 'by default familiarity changes nothing');
  const known = run({ familiarReport: 2, familiarReportMax: 1 });
  assert.equal(known.reports.length, 0, 'half a point at 2 a point: no chance at all');
  assert.equal(known.w.reverie.belief('dev', 'did:player:strip'), 'till', 'he still saw it');
  const capped = run({ familiarReport: 2, familiarReportMax: 0 });
  assert.equal(capped.reports.length, 1, 'a cap of 0 takes nothing off');
});

test('repeats: a witness counts the times they see you do it and warn you, the count lapses, and it rewinds', () => {
  const w = rocinante({ start: 10 * HOUR, moduleConfig: { wormtongue: { repeatDays: 2 } } });
  w.wormtongue.crime({ kind: 'strip', severity: 0.6, reportTo: 'watch', report: 0 });
  w.did('player', 'fixed', { for: 'dev' }); // (Dev knows the player: he always recognizes them)
  const W = w.wormtongue, seen = [], ctx = () => ({ world: w, person: w.get('dev') });
  w.on('witnessed', (e) => { if (e.id === 'dev') seen.push(e.times); });
  const strip = () => w.sense({ kind: 'strip', actor: 'player', what: 'till', place: 'market', seenBy: ['dev'] });
  assert.equal(W.seenTimes('dev', 'player', 'strip'), 0);
  strip();
  assert.equal(W.seenTimes('dev', 'player', 'strip'), 1);
  W.warn('dev', 'player', 'strip');
  w.advance(HOUR); strip();
  assert.equal(W.seenTimes('dev', 'player', 'strip'), 2);
  assert.equal(W.warnedTimes('dev', 'player', 'strip'), 1);
  assert.deepEqual(seen, [1, 2]);
  // the terms: lines and choices read it
  assert.ok(w.lang.test('witnessed:player.strip>=2', ctx()));
  assert.ok(w.lang.test('warned:player.strip>=1', ctx()));
  assert.ok(!w.lang.test('witnessed:player.theft>=1', ctx()), 'kept by kind');
  assert.ok(!w.lang.test('witnessed:player.strip>=1', { world: w, person: w.get('ruth') }), 'kept by witness');
  // told as it is: the log, and the story
  assert.ok(w.westmarch.find({ k: 'warn' }).some((e) => e.who === 'dev'));
  assert.match(w.irulan.tell(0, { who: 'dev' }).join(' '), /warned the player about their strip|warned [^.]* about their strip/);
  // rewound to before the second time, it's one again; replayed, two
  const h = w.hash(); w.rewind(30); assert.equal(W.seenTimes('dev', 'player', 'strip'), 1); w.advance(30); assert.equal(w.hash(), h);
  // two days without and it lapses: the next time is the first again, warnings and all
  w.advance(2 * DAY + HOUR);
  assert.equal(W.seenTimes('dev', 'player', 'strip'), 0);
  w.advance(DAY);
  assert.equal(((w.s.mod.wormtongue.seen || {}).dev || {})['player:strip'], undefined, 'let go at the midnight after');
  strip();
  assert.equal(W.seenTimes('dev', 'player', 'strip'), 1);
  assert.equal(W.warnedTimes('dev', 'player', 'strip'), 0);
  // warning about what isn't counted does nothing
  W.warn('ruth', 'player', 'strip');
  assert.equal(W.warnedTimes('ruth', 'player', 'strip'), 0);
});

test('repeats are off by default: nothing counted, nothing kept', () => {
  const w = rocinante({ start: 10 * HOUR });
  w.wormtongue.crime({ kind: 'strip', severity: 0.6, reportTo: 'watch', report: 0 });
  w.did('player', 'fixed', { for: 'dev' });
  for (let i = 0; i < 3; i++) w.sense({ kind: 'strip', actor: 'player', place: 'market', seenBy: ['dev'] });
  assert.equal(w.wormtongue.seenTimes('dev', 'player', 'strip'), 0);
  assert.equal(w.s.mod.wormtongue.seen, undefined);
  assert.ok(!w.westmarch.find({ k: 'witnessed' }).some((e) => e.d.times), 'no times in the log');
});

test('repeats: each time seen before makes a report likelier (repeatReport)', () => {
  const run = (repeatReport) => {
    const w = rocinante({ start: 10 * HOUR, moduleConfig: { wormtongue: { repeatDays: 2, repeatReport, gossip: 0 } } }); // (no reports by way of gossip)
    w.wormtongue.crime({ kind: 'strip', severity: 0.6, reportTo: 'watch', report: 0.0005 });
    w.did('player', 'fixed', { for: 'dev' });
    const reports = [];
    w.on('report', (r) => { if (r.actor === 'player') reports.push(r); });
    for (let i = 0; i < 3; i++) { w.sense({ kind: 'strip', actor: 'player', place: 'market', seenBy: ['dev'] }); w.advance(2 * HOUR); }
    return reports.length;
  };
  assert.equal(run(0), 0, 'a tiny chance, three times over');
  assert.equal(run(1e5), 2, 'the second and third time, certain');
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

test('lines: a topic is answered by its own lines and those with none, in the order declared, and lines added later count', () => {
  const w = rocinante({ start: 7 * HOUR });
  const cs = w.cityspeak;
  cs.addLines([{ key: 'odd', text: 'Hm.', pri: 5 }, { key: 'odd_topic', topic: 'odd', text: 'Odd.' }]);
  assert.equal(cs.choose('kofi', { topic: 'greet' }).key, 'odd', 'a line with no topic can win a topic, if it\'s specific enough');
  assert.equal(cs.choose('kofi', { topic: 'greet', exact: true }).key, 'greet', 'but not an exact one');
  assert.equal(cs.choose('kofi', { topic: 'odd', exact: true }).key, 'odd_topic');
  assert.equal(cs.choose('kofi', { topic: 'later', exact: true }), null);
  cs.line({ key: 'later', topic: 'later', text: 'Later.' });
  assert.equal(cs.choose('kofi', { topic: 'later', exact: true }).key, 'later', 'a line declared after a choice is seen');
  // ties keep the order lines were declared in: the same draw as before
  cs.addLines([{ key: 'tie_a', topic: 'tie', text: 'A' }, { key: 'tie_none', text: 'N', pri: 1 }, { key: 'tie_b', topic: 'tie', text: 'B' }]);
  const picks = new Set();
  for (let i = 0; i < 40; i++) picks.add(cs.choose('kofi', { topic: 'tie', exact: true, salt: [i] }).key);
  assert.deepEqual([...picks].sort(), ['tie_a', 'tie_b']);
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

test('unseen storylets pick the same place whatever the game is showing, and on a replay', () => {
  const build = () => {
    const w = rocinante({ start: 3 * HOUR });
    w.gaff.storylet({ id: 'break_in', mtb: 2 * HOUR, cooldown: 6 * HOUR, unseen: 'home', fire: (x, { place }) => { if (place) x.fact('broken_into:' + place, x.now); } });
    return w;
  };
  const a = build(), b = build();
  a.focus(['blocks']); // the player is looking at the apartments
  a.advance(DAY); b.advance(DAY);
  assert.ok(Object.keys(a.s.facts).some((k) => k.startsWith('broken_into:')));
  assert.equal(a.hash(), b.hash(), 'watching changes nothing');
  const h = a.hash();
  a.focus(['main']);
  a.rewind(12 * HOUR);
  a.advance(12 * HOUR);
  assert.equal(a.hash(), h, 'and a replay with another focus is the same');
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
  // places by their names, not their ids
  const named = lines.filter((l) => / (to|for|at) /.test(l));
  assert.ok(named.length && named.every((l) => !/ (for|to|at) (cafe|market|bar|park|workshop)\b/.test(l)), named.join('\n'));
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

test('Westmarch describes every kind Rocinante writes in a day, and changes nothing', () => {
  for (const opts of [{}, { bree: true, harm: true }]) {
    const w = rocinante(opts);
    const entries = [];
    w.on('log', (e) => entries.push(e));
    w.advance(DAY);
    const kinds = new Set(entries.map((e) => e.k));
    assert.ok(kinds.size > 20, [...kinds].join(' '));
    const before = w.hash();
    for (const e of entries) {
      const words = w.westmarch.describe(e);
      assert.equal(typeof words, 'string');
      // in words of its own, not the fallback's name and data
      assert.ok(words && !words.startsWith(e.k + ':') && !/undefined|\[object|NaN/.test(words), `${e.k}: ${words} ${JSON.stringify(e.d)}`);
    }
    assert.equal(w.hash(), before);
  }
  const w = rocinante();
  assert.equal(w.westmarch.describe({ t: 0, k: 'party', who: 'ruth', d: { size: 3, host: 'mara' } }), 'party: size 3, host mara');
  assert.equal(w.westmarch.describe({ t: 0, k: 'party' }), 'party');
  assert.equal(w.westmarch.describe({ t: 0, k: 'arrived', who: 'ruth', d: { place: 'market' } }), 'got to The Market');
});

test('a chronicle from the entries a game kept reaches past the log', () => {
  const w = rocinante({ config: { logSize: 300 } });
  const kept = [];
  w.on('log', (e) => kept.push(e));
  w.advance(DAY);
  const all = w.westmarch.chronicle('ruth', kept);
  const tail = w.westmarch.chronicle('ruth', 0);
  assert.ok(tail.length && all.length > tail.length);
  assert.deepEqual(all.slice(-tail.length), tail);
});

test('Irulan tells a day of Rocinante as a story, and changes nothing', () => {
  for (const opts of [{}, { bree: true, harm: true }]) {
    const w = rocinante(opts);
    const kept = [];
    w.on('log', (e) => kept.push(e));
    w.advance(DAY);
    const before = w.hash();
    const beats = w.irulan.beats(kept);
    // folded: far fewer beats than entries, each a sentence in words of its own
    assert.ok(beats.length > 20 && beats.length < kept.length / 2, `${beats.length} beats of ${kept.length}`);
    for (const b of beats) {
      assert.match(b.text, /^[A-Z].*\.$/, b.text);
      assert.ok(!/undefined|NaN|\[object|\{|apt_\d|did:/.test(b.text), b.text);
      assert.ok(b.score >= 0 && b.score <= 1 && b.entries.length, b.text);
    }
    assert.deepEqual(beats.map((b) => b.t), beats.map((b) => b.t).slice().sort((a, b) => a - b));
    // paragraphs by the time of day
    const story = w.irulan.tell(kept);
    assert.match(story[0], /^Day 0, early morning\. /);
    assert.equal(w.hash(), before);
  }
});

test('Irulan folds a walk, an action, its company, its feeling and a shift into one sentence each', () => {
  const w = rocinante();
  const kept = [];
  w.on('log', (e) => kept.push(e));
  w.advance(DAY);
  const text = w.irulan.beats(kept, { vary: false }).map((b) => b.text);
  const has = (re) => assert.ok(text.some((t) => re.test(t)), `${re}\n${text.join('\n')}`);
  // the walk there and the hour-long bakes one after another: one shift
  has(/^Mara went to Mara's Cafe and baked bread for eight hours/);
  // the company kept, and the feeling that came of it
  has(/^Lena showered at home for half an hour, with Kofi home too, and felt fresh\.$/);
  // the same beat for several people at once, told once
  has(/^Mara, Ruth and Kofi wished for some fresh air\.$/);
  // a plan that fell through, and how they felt, in the same minute
  has(/^Kofi gave up on dinner at home \(no way to get food\) and was frustrated\.$/);
  // gossip by what it's about
  has(/^Dev told Ines about Sam's theft\.$/);
  // and nobody felt "A good meal": the feeling went with the meal
  assert.ok(!text.some((t) => /felt A good meal/.test(t)));
});

test('Irulan leaves out what matters little, and tells one person\'s day', () => {
  const w = rocinante();
  const kept = [];
  w.on('log', (e) => kept.push(e));
  w.advance(DAY);
  const all = w.irulan.beats(kept), some = w.irulan.beats(kept, { min: 0.5 });
  assert.ok(some.length && some.length < all.length / 3, `${some.length} of ${all.length}`);
  assert.ok(some.every((b) => b.score >= 0.5));
  assert.ok(!some.some((b) => /slept/.test(b.text)));
  // a kind weighed to nothing is left out
  assert.ok(!w.irulan.beats(kept, { weights: { told: 0 } }).some((b) => /told/.test(b.text)));
  const ruth = w.irulan.beats(kept, { who: 'ruth' });
  assert.ok(ruth.length && ruth.every((b) => b.who.includes('ruth') || b.with.includes('ruth') || b.entries.some((e) => w.westmarch.about(e, 'ruth'))));
  const day = w.irulan.day('ruth', kept);
  assert.match(day, /^Ruth /);
  assert.ok(day.split('. ').length >= 3, day);
  // from the log itself, by a time
  assert.deepEqual(w.irulan.beats(w.now - 6 * HOUR).map((b) => b.t).filter((t) => t < w.now - 6 * HOUR), []);
});

test('Irulan takes the game\'s words, and falls back to the label and describe', () => {
  const w = rocinante();
  w.action({ id: 'juggle', label: 'juggling', at: 'home', minutes: 45 });
  w.action({ id: 'kip', label: 'a kip', at: 'home', minutes: 20 });
  const at = (t, k, d) => ({ t, k, who: 'ruth', d });
  const said = (entries) => w.irulan.beats(entries, { vary: false }).map((b) => b.text);
  // Rocinante's words for the rain, and the words a game gives that leave an entry out
  assert.deepEqual(said([{ t: 0, k: 'fact', d: { key: 'raining', value: true } }]), ['Rain set in.']);
  assert.deepEqual(said([{ t: 0, k: 'fact', d: { key: 'other', value: 1 } }]), ['Other became 1.']);
  w.irulan.words('fact', () => null);
  assert.deepEqual(said([{ t: 0, k: 'fact', d: { key: 'raining', value: true } }]), []);
  // an action with no tell, by its label; one still going at the end
  assert.deepEqual(said([at(0, 'started', { action: 'juggle', place: 'apt_4' }), at(45, 'finished', { action: 'juggle', place: 'apt_4', frac: 1 })]), ['Ruth spent 45 minutes juggling at home.']);
  assert.deepEqual(said([at(0, 'started', { action: 'kip', place: 'apt_4' }), at(20, 'finished', { action: 'kip', place: 'apt_4', frac: 1 })]), ['Ruth had a kip at home.']);
  assert.deepEqual(said([at(0, 'started', { action: 'read', place: 'apt_1' })]), ['Ruth was reading at Mara\'s place.']);
  // an illness by its tell, coming on and over; one without, by its label
  assert.deepEqual(said([at(0, 'afflicted', { course: 'cold', from: 'kofi' }), at(5, 'afflicted', { course: 'ale', again: true }), at(10, 'recovered', { course: 'cold' })]),
    ['Ruth caught a cold from Kofi.', 'Ruth had a few drinks too many again.', 'Ruth shook off the cold.']);
  w.athelas.course({ id: 'gout', label: 'A touch of gout', phases: [{ id: 'sore', minutes: 60 }] });
  assert.deepEqual(said([at(0, 'afflicted', { course: 'gout' }), at(90, 'recovered', { course: 'gout' })]), ['Ruth came down with a touch of gout.', 'Ruth got over a touch of gout.']);
  // company is being about, not doing it together: at home, home too (or there too, visiting); elsewhere, there
  const shower = (place, company) => [at(0, 'started', { action: 'shower', place }), ...company.map((id) => at(0, 'met', { target: id, minutes: 15 })), at(15, 'finished', { action: 'shower', place, frac: 1 })];
  assert.deepEqual(said(shower('apt_4', ['kofi'])), ['Ruth showered at home, with Kofi there too.']);
  assert.deepEqual(said(shower('apt_1', ['pip', 'tomas'])), ['Ruth showered at Mara\'s place, with Pip and Tomas home too.']);
  assert.deepEqual(w.irulan.beats(shower('apt_1', ['tomas', 'pip']).map((e) => ({ ...e, who: 'mara' })), { as: 'tomas', voice: 'first', vary: false }).map((b) => b.text), ['Mara showered at home, with Pip and me home too.']);
  assert.deepEqual(said([at(0, 'started', { action: 'sit_park', place: 'park' }), at(0, 'met', { target: 'kofi', minutes: 40 }), at(40, 'finished', { action: 'sit_park', place: 'park', frac: 1 })]), ['Ruth sat in Ring Park for 40 minutes, with Kofi there.']);
  // one thing two modules write in the same minute is said once
  const hurt = rocinante({ harm: true });
  assert.deepEqual(hurt.irulan.beats([at(0, 'recovered', { course: 'nightshade' }), at(0, 'healed', { course: 'nightshade' })], { vary: false }).map((b) => b.text), ['Ruth pulled through the poisoning.']);
  // a kind Irulan has no words of its own for, in describe's
  assert.deepEqual(said([at(0, 'arrived', { place: 'market' }), at(5, 'rent', { paid: 25 })]), ['Ruth went to The Market.', 'Ruth paid the rent (25).']);
  // and its own for what describe says tersely
  assert.deepEqual(said([at(0, 'skill', { skill: 'lore', level: 'skilled' }), at(0, 'grudge', { against: 'dev', strength: 0.7, why: 'fight' })]), ['Ruth became skilled at lore and bore Dev a deep grudge over fight.']);
});

test('Irulan tells a talk from its first word to its last (Bree)', () => {
  const w = rocinante({ bree: true });
  const by = (who, t, k, d) => ({ t, k, who, d });
  const text = w.irulan.beats([
    by('dev', 0, 'arrived', { place: 'cafe' }),
    by('dev', 10, 'exchange', { id: 7, kind: 'argue', with: ['lena'], why: 'meet' }),
    by('dev', 14, 'escalated', { id: 7, from: 'argue', to: 'fight', against: 'lena' }),
    by('dev', 16, 'exchanged', { id: 7, kind: 'fight', with: ['lena'], outcome: 'row', turns: 6, why: 'done' }),
  ], { vary: false }).map((b) => b.text);
  assert.deepEqual(text, ['Dev went to Mara\'s Cafe.', 'Dev argued with Lena at Mara\'s Cafe, which turned into a fight, and it ended in a row.']);
});

test('Irulan gives every sentence in parts, the people and places in it tagged', () => {
  const w = rocinante();
  const kept = [];
  w.on('log', (e) => kept.push(e));
  w.advance(DAY);
  for (const b of w.irulan.beats(kept)) {
    assert.equal(b.parts.map((p) => p.text).join(''), b.text);
    assert.ok(!/[\u0001-\u0003]/.test(b.text), b.text);
    for (const p of b.parts) {
      if (p.person) assert.equal(p.text, w.get(p.person).name);
      if (p.place) assert.ok(w.ring.get(p.place), p.place);
    }
    // everyone a beat is about is tagged in it
    for (const id of b.who) assert.ok(b.parts.some((p) => p.person === id), b.text);
  }
  const lena = w.irulan.beats(kept, { vary: false }).find((b) => /^Lena showered/.test(b.text));
  assert.deepEqual(lena.parts, [{ text: 'Lena', person: 'lena' }, { text: ' showered at ' }, { text: 'home', place: 'apt_5' }, { text: ' for half an hour, with ' }, { text: 'Kofi', person: 'kofi' }, { text: ' home too, and felt fresh.' }]);
});

test('Irulan finds the storylines: a theft and what came of it, a snare, a poisoning', () => {
  const w = rocinante({ seed: 'voight-kampff', harm: true });
  const kept = [];
  w.on('log', (e) => kept.push(e));
  w.advance(2 * DAY);
  const before = w.hash();
  const { threads, rest } = w.irulan.threads(kept, { vary: false });
  const titled = (t) => threads.find((th) => th.title === t);
  // the theft: done, seen, told and reported, with how the thief felt
  const theft = titled('Sam\'s theft');
  assert.ok(theft, threads.map((th) => th.title).join(', '));
  assert.match(theft.beats[0].text, /^Sam went to The Market and pocketed some food/);
  assert.ok(theft.beats.some((b) => /reported Sam's theft to the Watch/.test(b.text)));
  assert.ok(theft.beats.some((b) => /^Sam felt guilty/.test(b.text)));
  // a theft nobody saw the doer of is still the doer's
  const pip = titled('Pip\'s theft');
  assert.ok(pip && pip.beats.some((b) => /saw a theft without seeing who did it/.test(b.text)));
  // the snare, from setting it to the harm it did and the gossip
  const snare = titled('Pip\'s snare');
  assert.ok(snare && snare.keys.includes('trap:t1') && snare.beats.some((b) => /hurt in Pip's trap/.test(b.text)));
  // the poisoning, and whom it was blamed on
  const poison = titled('Sam\'s nightshade');
  assert.ok(poison && poison.beats.some((b) => /blamed Mara, who served it/.test(b.text)));
  assert.deepEqual(poison.people.slice(0, 2).sort(), ['sam', 'tomas']);
  // the most that matters first, every thread a story of two beats or more, nothing in both a thread and the rest
  assert.deepEqual(threads.map((th) => th.score), threads.map((th) => th.score).slice().sort((a, b) => b - a));
  assert.ok(threads.every((th) => th.beats.length >= 2 && th.parts.map((p) => p.text).join('') === th.title));
  const inThreads = new Set(threads.flatMap((th) => th.beats));
  assert.ok(rest.length && rest.every((b) => !inThreads.has(b) && b.score >= 0.4));
  // a chat that went fine is no story, and doesn't tie one to another
  assert.ok(!threads.some((th) => th.keys.some((k) => k.startsWith('pair:')) && th.keys.some((k) => !k.startsWith('pair:'))));
  // someone's own
  assert.ok(w.irulan.threads(kept, { who: 'pip' }).threads.every((th) => th.people.includes('pip')));
  // no two titles alike
  assert.equal(new Set(threads.map((th) => th.title)).size, threads.length);
  assert.equal(w.hash(), before);
});

test('Irulan varies its words, the same way every time, and still tells the same thing once', () => {
  const w = rocinante();
  const kept = [];
  w.on('log', (e) => kept.push(e));
  w.advance(DAY);
  const plain = w.irulan.beats(kept, { vary: false }), varied = w.irulan.beats(kept), again = w.irulan.beats(kept);
  assert.deepEqual(varied.map((b) => b.text), again.map((b) => b.text));
  assert.equal(varied.length, plain.length);
  const differ = varied.filter((b, i) => b.text !== plain[i].text);
  assert.ok(differ.length > 10, `${differ.length} differ`);
  // Irulan's own phrases and the town's variants both turn up
  const all = varied.map((b) => b.text).join('\n');
  assert.match(all, / (headed|made their way) /);
  assert.match(all, /curled up with a book|sat and read|had a meal at|grabbed a bite at/);
  assert.ok(varied.some((b) => b.who.length > 1));
  // another seed, other words
  const v = rocinante({ seed: 'another' });
  const k2 = [];
  v.on('log', (e) => k2.push(e));
  v.advance(DAY);
  assert.ok(v.irulan.beats(k2).some((b, i, bs) => b.text !== v.irulan.beats(k2, { vary: false })[i]?.text));
});

test('Irulan tells what someone knows, as they know it, in their own words', () => {
  const w = rocinante({ seed: 'voight-kampff', harm: true });
  const kept = [];
  w.on('log', (e) => kept.push(e));
  w.advance(2 * DAY);
  const before = w.hash();
  // Tomas: what he did, what was done to him or in front of him, what he was told; nobody else's inner life
  const tomas = w.irulan.beats(kept, { as: 'tomas', vary: false });
  assert.ok(tomas.length > 10);
  for (const b of tomas) {
    assert.ok(b.who.includes('tomas') || b.with.includes('tomas') || b.entries.some((e) => w.westmarch.about(e, 'tomas')), b.text);
    assert.ok(b.who.includes('tomas') || !b.kinds.some((k) => ['felt', 'wished', 'grudge', 'suspect', 'sentiment'].includes(k)), b.text);
  }
  // poisoned without seeing it done, he doesn't know by whom; Sam does
  assert.ok(tomas.some((b) => /^Tomas was poisoned.* hurt by tainted food\.$/.test(b.text)), tomas.map((b) => b.text).join('\n'));
  assert.ok(!tomas.some((b) => /Sam's tainted food|slipped nightshade/.test(b.text)));
  const sam = w.irulan.beats(kept, { as: 'sam', voice: 'first', vary: false }).map((b) => b.text);
  assert.ok(sam.some((t) => t.startsWith('I slipped nightshade into the stew at Mara\'s Cafe')), sam.join('\n'));
  assert.ok(sam.includes('Tomas was hurt by my tainted food.'), sam.join('\n'));
  // a crime done in front of someone is theirs to tell only if they caught it
  const ruth = w.irulan.beats(kept, { as: 'ruth', vary: false }).map((b) => b.text);
  assert.ok(!ruth.some((t) => /pocketed some food/.test(t)));
  const dev = w.irulan.beats(kept, { as: 'dev', voice: 'first', vary: false }).map((b) => b.text);
  assert.ok(dev.some((t) => /^Sam went to The Market and pocketed some food, with me there\.$/.test(t)), dev.join('\n'));
  // their own words: I, me, my, and "they" become theirs
  const mine = w.irulan.beats(kept, { as: 'tomas', voice: 'first', vary: false });
  assert.ok(mine.every((b) => !b.parts.some((p) => p.person === 'tomas' && p.text === 'Tomas')));
  assert.ok(mine.some((b) => /^I broke down and walked out to clear my head/.test(b.text)), mine.map((b) => b.text).join('\n'));
  assert.ok(mine.some((b) => / me[ .,]/.test(b.text) && !b.text.startsWith('I ')));
  for (const b of mine) assert.equal(b.parts.map((p) => p.text).join(''), b.text);
  // what they'd say, with when
  const said = w.irulan.recount('tomas', kept, { limit: 3, vary: false });
  assert.equal(said.length, 3);
  for (const b of said) assert.match(b.text, /^(Last night|Early this morning|This morning|This afternoon|This evening|Tonight|The night before last|Early yesterday|Yesterday \w+|Last night|\w+ days ago|A while back), /);
  assert.equal(w.irulan.ago(2 * DAY + 9 * HOUR, 2 * DAY + 12 * HOUR), 'this morning');
  assert.equal(w.irulan.ago(DAY + 19 * HOUR, 2 * DAY + 12 * HOUR), 'yesterday evening');
  assert.equal(w.irulan.ago(DAY + 22 * HOUR, 2 * DAY + 1 * HOUR), 'last night');
  assert.equal(w.irulan.ago(9 * HOUR, 3 * DAY), 'three days ago');
  assert.equal(w.hash(), before);
});

test('Irulan keeps the story beyond the log, so storylines last the week, and it saves and rewinds', () => {
  // off by default: no story, the world as it was
  const plain = rocinante({ harm: true });
  plain.advance(DAY);
  assert.equal(plain.s.story, undefined);
  assert.deepEqual(plain.irulan.book(), []);
  const w = rocinante({ harm: true, config: { logSize: 200, storySize: 400 } });
  w.advance(DAY);
  // the same people living the same day, story or not
  assert.equal(JSON.stringify(w.s.people), JSON.stringify(plain.s.people));
  const day1 = w.irulan.threads();
  w.advance(4 * DAY);
  const book = w.irulan.book();
  assert.ok(book.length <= 400 && book.length > 200);
  assert.ok(book[0].t < w.s.log[0].t, 'the story reaches back further than the log');
  // what's kept matters: no walks, no company, no routine action
  assert.ok(!book.some((e) => ['set-out', 'arrived', 'met'].includes(e.k)));
  assert.ok(book.every((e) => e.k !== 'started' || w.actions.get(e.d.action).crime || w.actions.get(e.d.action).deed));
  // told without entries, from the story; a storyline keeps its id from one telling to the next
  const day5 = w.irulan.threads();
  assert.ok(day5.threads.some((th) => th.end - th.t > 2 * DAY), 'a storyline over days');
  const again = day1.threads.filter((th) => day5.threads.some((x) => x.id === th.id));
  assert.ok(again.length, day1.threads.map((th) => th.id).join(' ') + ' / ' + day5.threads.map((th) => th.id).join(' '));
  assert.ok(day5.threads.some((th) => th.active) && day5.threads.every((th) => th.active === w.now - th.end <= DAY));
  // it saves, loads and rewinds with the world
  const copy = rocinante({ harm: true, config: { logSize: 200, storySize: 400 } });
  copy.load(JSON.stringify(w.save()));
  assert.deepEqual(copy.irulan.book(), book);
  assert.equal(copy.hash(), w.hash());
  const t = w.now, n = book.length, last = book[book.length - 1];
  w.advance(12 * HOUR);
  w.seek(t);
  assert.equal(w.irulan.book().length, n);
  assert.deepEqual(w.irulan.book()[n - 1], last);
});

test('Irulan tells the story as it happens: each beat once, complete, in order, and again after a rewind', () => {
  const quiet = rocinante({ seed: 'voight-kampff', harm: true });
  quiet.advance(2 * DAY);
  const w = rocinante({ seed: 'voight-kampff', harm: true });
  const got = [];
  const stop = w.irulan.feed((b) => got.push({ b, now: w.now }), { min: 0.6, vary: false });
  w.advance(2 * DAY);
  // listening changes nothing
  assert.equal(w.hash(), quiet.hash());
  assert.ok(got.length > 20, `${got.length}`);
  const seen = new Set();
  for (const { b, now } of got) {
    assert.ok(b.score >= 0.6, b.text);
    // told once it's over and its minute has gone by
    assert.ok(b.entries[b.entries.length - 1].t < Math.floor(now), b.text);
    assert.ok(!b.kinds.includes('started') || b.kinds.includes('finished') || b.kinds.includes('stopped'), b.text);
    for (const e of b.entries) { const id = `${e.t}|${e.k}|${e.who}|${JSON.stringify(e.d)}`; assert.ok(!seen.has(id), b.text); seen.add(id); }
  }
  // each telling has what was done since the one before, in the order it began
  const done = (b) => b.entries[b.entries.length - 1].t;
  const groups = [...new Set(got.map((x) => x.now))].map((now) => got.filter((x) => x.now === now).map((x) => x.b));
  for (const g of groups) assert.deepEqual(g.map((b) => b.t), g.map((b) => b.t).slice().sort((a, b) => a - b));
  for (let i = 1; i < groups.length; i++) assert.ok(Math.max(...groups[i - 1].map(done)) < Math.min(...groups[i].map(done)) + 1);
  assert.ok(got.some(({ b }) => b.text.startsWith('Sam slipped nightshade into the stew')));
  // a rewind: what comes after the time gone back to is told again, as it happens anew
  const back = w.now - 6 * HOUR, before = got.length;
  const after = got.filter(({ b }) => b.entries[b.entries.length - 1].t > back + 10).length;
  w.seek(back);
  w.advance(6 * HOUR);
  assert.ok(got.length - before >= after - 2 && after > 0, `${got.length - before} again of ${after}`);
  // stopped, it tells nothing more
  stop();
  const n = got.length;
  w.advance(6 * HOUR);
  assert.equal(got.length, n);
});

test('Irulan gives the headlines, and more of the people who matter to the game', () => {
  const w = rocinante({ bree: true });
  const kept = [];
  w.on('log', (e) => kept.push(e));
  w.advance(DAY);
  const top = w.irulan.recap(kept, { limit: 4 });
  assert.equal(top.length, 4);
  assert.deepEqual(top.map((b) => b.t), top.map((b) => b.t).slice().sort((a, b) => a - b));
  const least = Math.min(...top.map((b) => b.score));
  assert.ok(w.irulan.beats(kept).filter((b) => b.score > least).length <= 4);
  // focus: Ruth's beats count for more, nobody else's change
  const plain = w.irulan.beats(kept), focused = w.irulan.beats(kept, { focus: { ruth: 2 } });
  assert.equal(plain.length, focused.length);
  plain.forEach((b, i) => {
    if (b.who.includes('ruth') || b.with.includes('ruth') || b.around.includes('ruth')) assert.ok(focused[i].score >= b.score);
    else assert.equal(focused[i].score, b.score);
  });
  assert.ok(focused.some((b, i) => b.score > plain[i].score));
  assert.equal(w.irulan.when(DAY + 9 * HOUR), 'Day 1, morning');
});

test('an action done together: the target joins in for its length, in a slot beside them; others there are only about', () => {
  const w = rocinante({ together: true });
  const kept = [];
  w.on('log', (e) => kept.push(e));
  w.advance(7 * DAY);
  const joins = kept.filter((e) => e.k === 'started' && e.d.layer === 'together');
  assert.ok(joins.length >= 1, 'someone joined in');
  for (const j of joins) {
    // begun by their partner that minute, with them as its target
    const lead = kept.find((e) => e.k === 'started' && e.who === j.d.with && e.t === j.t && e.d.action === j.d.action);
    assert.ok(lead && lead.d.target === j.who, JSON.stringify(j));
    // and over for both at once
    const end = (who) => kept.find((e) => (e.k === 'finished' || e.k === 'stopped') && e.who === who && e.t > j.t && e.d.action === j.d.action);
    assert.equal(end(j.who).t, end(j.d.with).t);
  }
  // alone is still the usual way, with the others only about
  assert.ok(kept.filter((e) => e.k === 'started' && e.d.action === 'shower' && e.d.place === 'apt_1').length > joins.length * 3);
  // nobody in Rocinante without the option does anything together
  const plain = rocinante();
  const k2 = [];
  plain.on('log', (e) => k2.push(e));
  plain.advance(2 * DAY);
  assert.ok(!k2.some((e) => e.d?.layer === 'together'));
  // and it holds up: the same seed, the same world; going back and forth, the same
  const report = Tyrell.VoightKampff.run({ build: (seed) => rocinante({ seed, together: true }), days: 3 });
  assert.ok(report.passed, report.failures.join('\n'));
});

test('Irulan tells doing something together apart from others being about', () => {
  const w = rocinante({ together: true });
  const by = (who, t, k, d) => ({ t, k, who, d });
  const beats = (entries) => w.irulan.beats(entries, { vary: false });
  // Mara showers; Tomas and Pip are only home
  const alone = beats([
    by('mara', 0, 'started', { action: 'shower', place: 'apt_1' }), by('mara', 0, 'met', { target: 'tomas', minutes: 15 }), by('mara', 0, 'met', { target: 'pip', minutes: 15 }),
    by('mara', 15, 'finished', { action: 'shower', place: 'apt_1', frac: 1 }),
  ]);
  assert.equal(alone.length, 1);
  assert.equal(alone[0].text, 'Mara showered at home, with Tomas and Pip home too.');
  assert.deepEqual([alone[0].with, alone[0].around], [[], ['tomas', 'pip']]);
  // Mara and Tomas shower together; Pip is only home
  const both = beats([
    by('mara', 0, 'started', { action: 'shower_together', place: 'apt_1', target: 'tomas' }),
    by('tomas', 0, 'started', { action: 'shower_together', place: 'apt_1', layer: 'together', target: 'mara', with: 'mara' }),
    by('mara', 0, 'met', { target: 'tomas', minutes: 20 }), by('mara', 0, 'met', { target: 'pip', minutes: 20 }),
    by('mara', 20, 'finished', { action: 'shower_together', place: 'apt_1', frac: 1 }), by('tomas', 20, 'finished', { action: 'shower_together', place: 'apt_1', frac: 1 }),
  ]);
  assert.equal(both.length, 1);
  assert.equal(both[0].text, 'Mara showered with Tomas at home, with Pip home too.');
  assert.deepEqual([both[0].with, both[0].around], [['tomas'], ['pip']]);
  // told once, with everyone's entries
  assert.equal(both[0].entries.filter((e) => e.k === 'finished').length, 2);
  // an action done together with no words of its own says with whom
  w.action({ id: 'dance', label: 'dancing', at: 'home', minutes: 30, target: 'person', together: true });
  assert.equal(beats([by('mara', 0, 'started', { action: 'dance', place: 'apt_1', target: 'tomas' }), by('mara', 30, 'finished', { action: 'dance', place: 'apt_1', frac: 1 })])[0].text,
    'Mara spent half an hour dancing with Tomas at home.');
});

test('Voight-Kampff: Rocinante behaves like people for a week', () => {
  const report = Tyrell.VoightKampff.run({ build: (seed) => rocinante({ seed }), days: 7 });
  assert.deepEqual(report.failures, []);
  assert.ok(report.passed);
  assert.ok(report.stats.actions.sleep > 0);
  const again = Tyrell.VoightKampff.run({ build: (seed) => rocinante({ seed }), days: 7, checks: ['capacity'] });
  assert.deepEqual(Tyrell.VoightKampff.compare(again, report, 0.001), []);
});
