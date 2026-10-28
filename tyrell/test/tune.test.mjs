// Tuning: every number that shapes the minds is a setting, the headline
// knobs scale whole behaviors, a person can have their own pace, and
// world.tune changes settings during play as a recorded input (so time walk
// and saves keep it). With every setting at its default, nothing changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Tyrell, rocinante, HOUR, DAY } from './helpers.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));
const events = (w, kind, keep = () => true) => { const out = []; w.on(kind, (e) => { if (keep(e)) out.push(e); }); return out; };
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const regardSum = (w, field = 'r') => sum(Object.values(w.s.mod.fellowship.rel).map((r) => Math.abs(r[field])));

// Rocinante after a week, as the build before the settings were parameters made it
const WEEK = 'f75c69f9';

// ---------------------------------------------------------------------------
// Defaults change nothing
// ---------------------------------------------------------------------------

test('with every setting at its default, a week of Rocinante is what it was before they were settings', () => {
  const w = rocinante();
  w.advance(7 * DAY);
  assert.equal(w.hash(), WEEK);
});

test('every setting given its default explicitly changes nothing', () => {
  const ref = rocinante();
  const moduleConfig = {};
  for (const n of Tyrell.MODULES) {
    const m = ref.module(n);
    assert.deepEqual(Object.keys(m.config).sort(), Object.keys(Tyrell.MODULE_DEFAULTS[n]).sort(), `${n} has every setting`);
    moduleConfig[n] = clone(m.config);
  }
  assert.deepEqual(Object.keys(ref.config).sort(), Object.keys(Tyrell.DEFAULT_CONFIG).sort());
  const w = rocinante({ config: clone(ref.config), moduleConfig });
  w.advance(7 * DAY);
  assert.equal(w.hash(), WEEK);
});

test('tuning.md lists every setting of the core and of every module, and nothing else', () => {
  const doc = readFileSync(new URL('../docs/tuning.md', import.meta.url), 'utf8');
  const sections = {};
  let cur = null;
  for (const line of doc.split('\n')) {
    const h = /^### (\w+)/.exec(line);
    if (h) { cur = h[1].toLowerCase(); sections[cur] ||= new Set(); continue; }
    if (line.startsWith('## ')) cur = null;
    const row = /^\| `(\w+)` \|/.exec(line);
    if (cur && row) sections[cur].add(row[1]);
  }
  const want = { core: Tyrell.DEFAULT_CONFIG, ...Tyrell.MODULE_DEFAULTS };
  for (const n of Object.keys(want)) {
    assert.ok(sections[n], `a section for ${n}`);
    assert.deepEqual([...sections[n]].sort(), Object.keys(want[n]).sort(), `${n}'s settings in tuning.md`);
  }
});

// ---------------------------------------------------------------------------
// The headline knobs move what they say
// ---------------------------------------------------------------------------

test('fellowship: friendship scales the regard time together makes, romance the attraction', () => {
  const run = (cfg) => { const w = rocinante({ moduleConfig: { fellowship: cfg } }); w.advance(DAY); return w; };
  const half = run({ friendship: 0.5 }), one = run({}), two = run({ friendship: 2 });
  assert.ok(regardSum(half) < regardSum(one) && regardSum(one) < regardSum(two), `${regardSum(half)} < ${regardSum(one)} < ${regardSum(two)}`);
  const none = run({ romance: 0 }), three = run({ romance: 3 });
  assert.equal(regardSum(none, 'a'), 0, 'no romance, no attraction');
  assert.ok(regardSum(three, 'a') > regardSum(one, 'a'));
});

/** Two people who never meet, with regard set between them: only the days move it. */
function apart(cfg, tuneA) {
  const w = Tyrell.create({ seed: 'apart', start: 8 * HOUR, modules: ['fellowship'], moduleConfig: { fellowship: cfg } });
  w.place({ id: 'x' }); w.place({ id: 'y' });
  w.person('a', { home: 'x', ...(tuneA ? { tune: { fellowship: tuneA } } : {}) });
  w.person('b', { home: 'y' });
  w.fellowship.adjust('a', 'b', 0.5);
  w.fellowship.adjust('b', 'a', -0.5);
  w.advance(3 * DAY);
  return w;
}

test('fellowship: fading scales how fast regard drifts back to nothing (and a person can have their own)', () => {
  assert.equal(apart({}).fellowship.regard('a', 'b'), 0.488);   // 0.004 a day for three days
  assert.equal(apart({ fading: 2 }).fellowship.regard('a', 'b'), 0.476);
  assert.equal(apart({ fading: 0 }).fellowship.regard('a', 'b'), 0.5);
  const own = apart({}, { fading: 0 });
  assert.equal(own.fellowship.regard('a', 'b'), 0.5, 'a never lets go');
  assert.equal(own.fellowship.regard('b', 'a'), -0.488, 'b does as everyone does');
});

/** Two people who sit together at a cafe, hour after hour. */
function together(opts = {}) {
  const w = Tyrell.create({ seed: 'together', start: 8 * HOUR, modules: ['fellowship'], ...opts });
  w.place({ id: 'cafe', slots: { seat: 4 } });
  w.action({ id: 'sit', at: 'cafe', slot: 'seat', minutes: 60, base: 0.5 });
  w.person('a', { home: 'cafe', ...(opts.tuneA ? { tune: opts.tuneA } : {}) });
  w.person('b', { home: 'cafe' });
  return w;
}

test('a person befriends at their own pace: their tune multiplies the world\'s', () => {
  const w = together({ tuneA: { fellowship: { friendship: 3 } } });
  w.advance(3 * HOUR);
  const ab = w.fellowship.regard('a', 'b'), ba = w.fellowship.regard('b', 'a');
  assert.ok(ba > 0 && ab < 1, `${ab}, ${ba}`);
  assert.ok(Math.abs(ab - 3 * ba) < 1e-3, `a warms three times as fast: ${ab} against ${ba}`);
  assert.deepEqual(w.tuning('fellowship', 'a'), { friendship: 3, romance: 1, fading: 1 });
});

/** Three people whose mood is under the minor threshold all the time, with breaks every hour or so on average. */
function gloomy(cfg, tunes = {}) {
  const w = Tyrell.create({ seed: 'gloom', start: 8 * HOUR, modules: ['reverie'], moduleConfig: { reverie: { minor: [0.9, 0.05], ...cfg } } });
  w.place({ id: 'flat' });
  w.action({ id: 'mope', at: 'flat', minutes: 30, base: 0.1 });
  w.action({ id: 'sulk', at: 'flat', minutes: 30, rank: -1 });
  w.reverie.breakdown({ id: 'sulk', level: 'minor', do: 'sulk' });
  for (const id of ['a', 'b', 'c']) w.person(id, { home: 'flat', ...(tunes[id] ? { tune: { reverie: tunes[id] } } : {}) });
  const broke = events(w, 'broke');
  w.advance(DAY);
  return broke;
}

test('reverie: breaks scales how often breaks come; 0 means none (and a person can have their own)', () => {
  const none = gloomy({ breaks: 0 }), one = gloomy({}), more = gloomy({ breaks: 4 });
  assert.equal(none.length, 0);
  assert.ok(one.length > 0 && more.length > one.length, `${one.length} < ${more.length}`);
  const own = gloomy({}, { a: { breaks: 0 } });
  assert.equal(own.filter((e) => e.id === 'a').length, 0, 'a keeps it together');
  assert.ok(own.filter((e) => e.id === 'b').length > 0);
  assert.equal(rocinante({ moduleConfig: { reverie: { breaks: 0 } } }).reverie.config.breaks, 0);
});

/** One person, alone, who remembers something and hears and sees things, a day ago. */
function rememberer(cfg, own) {
  const w = Tyrell.create({ seed: 'memory', start: 8 * HOUR, modules: ['reverie'], moduleConfig: { reverie: cfg } });
  w.place({ id: 'flat' });
  w.person('a', { home: 'flat', ...(own ? { tune: { reverie: own } } : {}) });
  w.reverie.remember('a', { k: 'party', imp: 8 });
  w.reverie.believe('a', 'heard', true, 'told');
  w.reverie.believe('a', 'seen', true, 'saw');
  w.advance(DAY);
  const rv = w.reverie;
  return { strength: rv.strength(rv.memories('a')[0], 'a'), told: rv.beliefRecord('a', 'heard').str, saw: rv.beliefRecord('a', 'seen').str };
}

test('reverie: forgetting scales how fast memories and beliefs fade', () => {
  const one = rememberer({}), two = rememberer({ forgetting: 2 }), none = rememberer({ forgetting: 0 });
  assert.ok(Math.abs(one.strength - 8 * 0.995 ** 24) < 1e-9);
  assert.ok(Math.abs(two.strength - 8 * 0.995 ** 48) < 1e-9);
  assert.equal(none.strength, 8);
  assert.deepEqual([one.told, one.saw], [0.97, 0.9849]);
  assert.deepEqual([two.told, two.saw], [0.9409, 0.97]);
  assert.deepEqual([none.told, none.saw], [1, 1]);
  assert.deepEqual(rememberer({}, { forgetting: 2 }), two, 'a person\'s own');
});

test('reverie: feelings scales how much feelings move the mood; stress how much stress builds', () => {
  const mood = (cfg) => {
    const w = Tyrell.create({ seed: 'mood', modules: ['reverie'], moduleConfig: { reverie: cfg } });
    w.place({ id: 'flat' });
    w.person('a', { home: 'flat' });
    w.reverie.feel('a', 'helped');
    w.reverie.feel('a', 'wronged');
    return { mood: w.reverie.mood('a'), stress: w.reverie.stress('a') };
  };
  assert.equal(mood({}).mood, 0.58);                  // 0.6 + 0.1 - 0.12
  assert.equal(mood({ feelings: 2 }).mood, 0.56);
  assert.equal(mood({ feelings: 0 }).mood, 0.6);
  assert.equal(mood({}).stress, 0.0414);             // wronged: 0.06 short-term, 0.009 long
  assert.equal(mood({ stress: 2 }).stress, 0.0828);
  assert.equal(mood({ stress: 0 }).stress, 0);
});

test('wormtongue: gossip scales how readily people pass things on; 0 means nobody does', () => {
  const run = (k) => {
    const w = rocinante({ moduleConfig: { wormtongue: { gossip: k } } });
    const told = events(w, 'told');
    w.advance(2 * HOUR);
    w.sense({ kind: 'theft', actor: 'sam', place: 'market', seenBy: ['dev', 'mara', 'ruth'] });
    w.advance(DAY);
    return told.length;
  };
  const none = run(0), some = run(0.2), all = run(1);
  assert.equal(none, 0);
  assert.ok(some > 0 && some < all, `${some} < ${all}`);
});

test('wormtongue: reporting scales how readily witnesses report, heat how much each report adds', () => {
  const run = (cfg) => {
    const w = rocinante({ moduleConfig: { wormtongue: cfg } });
    const reports = events(w, 'report', (e) => e.actor === 'sam');
    w.advance(2 * HOUR);
    w.sense({ kind: 'theft', actor: 'sam', place: 'market', seenBy: ['dev', 'mara', 'ruth', 'kofi', 'lena'] });
    w.advance(3 * HOUR);
    return { n: reports.length, heat: w.wormtongue.heat('sam') };
  };
  assert.equal(run({ reporting: 0 }).n, 0);
  const one = run({}), keen = run({ reporting: 10 }), hot = run({ reporting: 10, heat: 2 });
  assert.ok(keen.n > one.n, `${one.n} < ${keen.n}`);
  assert.equal(keen.heat, keen.n * 4);                // theft: severity 0.4, 10 heat a point
  assert.equal(hot.heat, hot.n * 8);
});

test('wormtongue: cooling scales how fast heat fades (and someone\'s own)', () => {
  const run = (cfg, own) => {
    const w = Tyrell.create({ seed: 'heat', start: 8 * HOUR, modules: ['wormtongue'], moduleConfig: { wormtongue: cfg } });
    w.place({ id: 'flat' });
    w.person('sam', { home: 'flat', ...(own ? { tune: { wormtongue: own } } : {}) });
    w.wormtongue.addHeat('sam', 4);
    w.wormtongue.addHeat('player', 4);
    w.advance(DAY);
    return [w.wormtongue.heat('sam'), w.wormtongue.heat('player')];
  };
  assert.deepEqual(run({}), [3.4, 3.4]);
  assert.deepEqual(run({ cooling: 2 }), [2.89, 2.89]);
  assert.deepEqual(run({ cooling: 0 }), [4, 4]);
  assert.deepEqual(run({}, { cooling: 0 }), [4, 3.4], 'only on Sam');
});

test('wormtongue: lies scales how readily a liar shifts the blame', () => {
  const run = (k) => {
    const w = Tyrell.create({ seed: 'liar', start: 8 * HOUR, modules: ['reverie', 'fellowship', 'wormtongue'], moduleConfig: { wormtongue: { lies: k } } });
    w.place({ id: 'cafe', slots: { seat: 4 } }); w.place({ id: 'yard' });
    w.action({ id: 'sit', at: 'cafe', slot: 'seat', minutes: 60, base: 0.5 });
    w.action({ id: 'rest', at: 'yard', minutes: 60, rank: -1 });
    w.wormtongue.crime({ kind: 'theft', severity: 0.4 });
    w.person('liar', { home: 'cafe', traits: { honesty: 0.1, talkative: 1 } });
    w.person('ear', { home: 'cafe' });
    for (const id of ['c', 'd']) w.person(id, { home: 'yard', routine: [[0, 'yard', 'rest']] });
    w.reverie.believe('liar', 'did:c:theft', true, 'saw');
    w.fellowship.adjust('liar', 'c', -0.8);
    w.fellowship.adjust('liar', 'd', -0.5);
    const told = events(w, 'told');
    w.advance(DAY);
    return { told: told.length, lies: told.filter((e) => e.lie).length };
  };
  const honest = run(0), liar = run(4);
  assert.ok(honest.told > 0 && honest.lies === 0, JSON.stringify(honest));
  assert.ok(liar.lies > 0, JSON.stringify(liar));
});

test('cityspeak: chatter scales how readily people in view bark at each other, and barks still change nothing', () => {
  const run = (k) => {
    const w = rocinante({ moduleConfig: { cityspeak: { chatter: k } } });
    w.focus(['main']);
    const barks = events(w, 'bark');
    for (let i = 0; i < 12 * 12; i++) w.advanceTo(w.now + 5);
    return { n: barks.length, hash: w.hash() };
  };
  const mute = run(0), quiet = run(0.4), one = run(1);
  assert.equal(mute.n, 0);
  assert.ok(quiet.n > 0 && quiet.n < one.n, `${quiet.n} < ${one.n}`);
  assert.equal(mute.hash, one.hash);
  assert.equal(quiet.hash, one.hash);
});

test('voice: chatter scales how long they talk (and someone\'s own)', () => {
  assert.equal(rocinante().voice.start('ruth').patience, 8);
  assert.equal(rocinante({ moduleConfig: { voice: { chatter: 2 } } }).voice.start('ruth').patience, 16);
  const w = rocinante();
  w.tune('voice', { chatter: 0.5 }, 'ruth');
  assert.equal(w.voice.start('ruth').patience, 4);
  assert.equal(w.voice.start('kofi').patience, 8);
});

test('mentat: scruples scales what illegal ways and ways against their values cost', () => {
  const cost = (k) => { const w = rocinante({ moduleConfig: { mentat: { scruples: k } } }); return w.mentat.cost(w.get('sam'), w.actions.get('steal_food')); };
  assert.equal(cost(1), 119);                           // 4 minutes, 60 + 0.15 × 300 risk, 0.05 × 200 against honesty
  assert.equal(cost(0.5), 61.5);
  assert.equal(cost(0), 4);
});

test('mentat: persistence scales the replans before someone gives up', () => {
  const replans = (k) => {
    const w = Tyrell.create({ seed: 'errand', start: 8 * HOUR, modules: ['mentat'], moduleConfig: { mentat: { persistence: k } } });
    w.place({ id: 'home' }); w.place({ id: 'shop', hours: [2, 3] });
    w.link('home', 'shop', 5);
    w.action({ id: 'buy', at: 'shop', minutes: 10, rank: -1 });
    w.task({ id: 'errand', methods: Array.from({ length: 10 }, (_, i) => ({ name: 'way ' + i, do: ['buy'] })) });
    w.person('a', { home: 'home' });
    w.direct('a', { do: 'errand' });
    w.advance(10);
    return w.westmarch.find({ k: 'replanned' }).length;
  };
  assert.deepEqual([replans(0), replans(1), replans(2)], [0, 3, 6]);
});

test('gaff: events scales how often storylets fire, intensity how much a firing raises', () => {
  const run = (cfg) => {
    const w = Tyrell.create({ seed: 'gaff', modules: ['gaff'], moduleConfig: { gaff: cfg } });
    w.gaff.storylet({ id: 'news', mtb: DAY, fire: () => {} });
    const fired = events(w, 'director');
    w.advance(20 * DAY);
    return fired.length;
  };
  const none = run({ events: 0 }), one = run({}), three = run({ events: 3 });
  assert.equal(none, 0);
  assert.ok(one > 5 && three > 2 * one, `${one}, ${three}`);
  const bump = (k) => { const w = Tyrell.create({ seed: 'gaff', modules: ['gaff'], moduleConfig: { gaff: { intensity: k } } }); w.gaff.storylet({ id: 'news', mtb: DAY, fire: () => {} }); w.gaff.trigger('news'); return w.gaff.intensity(); };
  assert.deepEqual([bump(1), bump(2), bump(0)], [0.2, 0.4, 0]);
});

test('ceres: prices scales how much a price puts someone off', () => {
  const factor = (k) => {
    const w = rocinante({ moduleConfig: { ceres: { prices: k } } });
    return w.mind.explain(w.get('kofi'), 'eat_cafe')[0].parts.find((x) => x[0] === 'price')?.[1];
  };
  assert.equal(factor(0), undefined, 'price is no object');
  assert.ok(factor(2) < factor(1) && factor(1) < 1, `${factor(2)} < ${factor(1)}`);
});

test('cradle: courtship, births and deaths scale couples forming, children and dying of old age', () => {
  const life = (knobs) => {
    // a ten-day year: Pip (nine, in real years) is old, and past it; Mara and Tomas are a couple; Dev and Lena are sweet on each other
    const w = rocinante({ seed: 'life', moduleConfig: { cradle: { year: 10 * DAY, autoPair: { regard: 0.05, attraction: 0.02 }, fertility: 3, lifespan: [60, 80], pastLifespan: 0.9, ...knobs } } });
    for (const [a, b] of [['dev', 'lena'], ['lena', 'dev']]) { w.fellowship.adjust(a, b, 0.4); w.fellowship.attract(a, b, 0.3); }
    const out = { born: events(w, 'born'), died: events(w, 'gone', (e) => e.why === 'died'), paired: events(w, 'paired') };
    w.advance(6 * DAY);
    return { born: out.born.length, died: out.died.length, paired: out.paired.length };
  };
  const one = life({});
  assert.ok(one.born > 0 && one.died > 0 && one.paired > 0, JSON.stringify(one));
  assert.equal(life({ births: 0 }).born, 0);
  assert.equal(life({ deaths: 0 }).died, 0);
  assert.equal(life({ courtship: 0 }).paired, 0);
});

test('athelas: contagion scales how catching courses are, duration how long they last', () => {
  const caught = (k) => {
    const w = rocinante({ moduleConfig: { athelas: { contagion: k } } });
    const got = events(w, 'afflicted', (e) => e.course === 'cold' && e.from);
    w.advance(3 * DAY);
    return got.length;
  };
  assert.equal(caught(0), 0);
  assert.ok(caught(30) > caught(1));
  const phase = (k) => { const c = rocinante({ moduleConfig: { athelas: { duration: k } } }).athelas.of('kofi')[0]; return c.until - c.since; };
  assert.ok(Math.abs(phase(2) - 2 * phase(1)) < 1e-3, `${phase(1)}, ${phase(2)}`);
});

test('delos: mutation scales how often genomes mutate, variation how far children stray', () => {
  const kids = (cfg) => {
    const w = rocinante({ moduleConfig: { delos: cfg } });
    const mutated = events(w, 'mutated');
    for (let i = 0; i < 30; i++) w.cradle.birth(['mara', 'tomas'], {}, 'kid' + i);
    return { w, mutated: mutated.length };
  };
  assert.ok(kids({}).mutated > 0);
  const exact = kids({ mutation: 0, variation: 0, traitBlend: { cross: 0 } });
  assert.equal(exact.mutated, 0);
  for (let i = 0; i < 30; i++) assert.equal(exact.w.delos.genome('kid' + i).traits.thrift, 0.5, 'the average of 0.6 and 0.4, exactly');
});

/** One person alone, hungry at a set pace. */
function hungry(opts = {}, own) {
  const w = Tyrell.create({ seed: 'hungry', start: 8 * HOUR, modules: [], ...opts });
  w.need({ id: 'hunger', rise: 0.1, start: 0.2 });
  w.place({ id: 'flat' });
  w.person('a', { home: 'flat', ...(own ? { tune: { core: own } } : {}) });
  return w;
}

test('core: needs scales how fast every need rises (and someone\'s own)', () => {
  const level = (opts, own) => { const w = hungry(opts, own); w.advance(2 * HOUR); return Math.round(w.needOf('a', 'hunger') * 1e6) / 1e6; };
  assert.equal(level(), 0.4);
  assert.equal(level({ config: { needs: 2 } }), 0.6);
  assert.equal(level({}, { needs: 0.5 }), 0.3);
  assert.equal(level({ config: { needs: 2 } }, { needs: 0.5 }), 0.4, 'the world\'s times their own');
});

test('core: habits, learning and wishes scale habits forming, skills and wishes coming', () => {
  const habits = (k) => { const w = rocinante({ modules: [], config: { habits: k } }); w.advance(DAY); return Object.values(w.s.people).flatMap((p) => Object.values(p.habits).flat()); };
  assert.ok(habits(0).every((v) => v === 1), 'frozen');
  assert.ok(habits(1).some((v) => v !== 1));
  const skill = (k) => { const w = rocinante({ config: { learning: k } }); w.advance(DAY); return w.skillOf('mara', 'baking'); };
  assert.equal(skill(0), 0.62, 'where she started');
  assert.ok(skill(1) > 0.62 && skill(3) > skill(1));
  const wishes = (k) => { const w = rocinante({ config: { wishes: k } }); const got = events(w, 'wished'); w.advance(2 * DAY); return got.length; };
  assert.equal(wishes(0), 0);
  assert.ok(wishes(2) > wishes(1));
});

test('core: crowds scales how many strangers pass', () => {
  const seen = (k) => { const w = rocinante({ config: { crowds: k } }); let n = 0; for (let t = 6 * HOUR; t < 30 * HOUR; t += 10) n += w.strangers.at('main', t).length; return n; };
  assert.equal(seen(0), 0);
  assert.ok(seen(2) > seen(1) && seen(1) > 0);
});

// ---------------------------------------------------------------------------
// Tuning during play: an input, kept in the state
// ---------------------------------------------------------------------------

/** Rocinante, tuned twice during play (the world's knobs and one person's). */
function tunedRun() {
  const w = rocinante();
  w.advance(6 * HOUR);
  w.tune('fellowship', { friendship: 3 });
  w.tune('core', { needs: 1.5, wishChance: 0.9 });
  w.tune('reverie', { breaks: 2 }, 'sam');
  w.advance(6 * HOUR);
  w.tune('core', { needs: null });
  w.tune('wormtongue', { reportDelay: [5, 20] });
  w.advance(6 * HOUR);
  return w;
}

test('a tune is recorded: rewound past, it\'s undone; played forward, it comes again at its moment', () => {
  const w = tunedRun();
  const h = w.hash();
  assert.notEqual(h, (() => { const u = rocinante(); u.advance(18 * HOUR); return u.hash(); })(), 'tuning changed the town');
  assert.equal(tunedRun().hash(), h, 'the same tunes at the same moments give the same world');
  w.rewind(15 * HOUR);
  assert.equal(w.s.tune, undefined, 'before any tune');
  assert.equal(w.tuning('fellowship').friendship, 1);
  assert.equal(w.get('sam').def.tune, undefined);
  w.advance(8 * HOUR);
  assert.equal(w.tuning('fellowship').friendship, 3);
  assert.equal(w.tuning('core').needs, 1.5);
  w.advance(7 * HOUR);
  assert.equal(w.tuning('core').needs, 1, 'and the later one');
  assert.equal(w.hash(), h, 'the same present');
  assert.deepEqual(w.tuning('wormtongue').reportDelay, [5, 20]);
});

test('a new tune in the past starts a new timeline', () => {
  const w = tunedRun();
  w.rewind(9 * HOUR);
  const branches = events(w, 'branch');
  w.tune('fellowship', { friendship: 0.5 });
  assert.equal(branches.length, 1);
  w.advance(9 * HOUR);
  assert.equal(w.tuning('fellowship').friendship, 0.5);
  assert.equal(w.tuning('core').needs, 1.5, 'the old future is gone: its tunes with it');
});

test('saves keep the tunes, the world\'s and a person\'s', () => {
  const w = tunedRun();
  const saved = JSON.stringify(w.save());
  const v = rocinante();
  v.load(saved);
  assert.equal(v.tuning('fellowship').friendship, 3);
  assert.deepEqual(v.tuning('reverie', 'sam'), { breaks: 2, forgetting: 1, feelings: 1, stress: 1 });
  v.advance(DAY); w.advance(DAY);
  assert.equal(v.hash(), w.hash());
});

test('a tune is over what was declared; null puts it back', () => {
  const w = rocinante({ moduleConfig: { fellowship: { friendship: 2 } } });
  assert.equal(w.tuning('fellowship').friendship, 2);
  w.tune('fellowship', { friendship: 3, decay: 0.01 });
  assert.equal(w.tuning('fellowship').friendship, 3);
  assert.equal(w.fellowship.config.friendship, 2, 'the config is what was declared');
  w.tune('fellowship', { friendship: null });
  assert.equal(w.tuning('fellowship').friendship, 2);
  assert.equal(w.tuning('fellowship').decay, 0.01);
  w.tune('fellowship', null);
  assert.equal(w.s.tune, undefined, 'nothing tuned: nothing kept');
  w.tune('reverie', { breaks: 2 }, 'sam');
  w.tune('reverie', null, 'sam');
  assert.equal(w.get('sam').def.tune, undefined);
});

test('tuning how fast needs rise keeps the rise so far, through a rewind too', () => {
  const w = hungry();
  w.advance(HOUR);
  w.tune('core', { needs: 2 });
  w.advance(HOUR);
  assert.ok(Math.abs(w.needOf('a', 'hunger') - 0.5) < 1e-9, `0.3 by the first hour, then twice as fast: ${w.needOf('a', 'hunger')}`);
  const h = w.hash();
  w.rewind(90);
  w.advance(90);
  assert.equal(w.hash(), h);
});

test('tune() refuses what it can\'t keep', () => {
  const w = rocinante({ modules: ['reverie', 'fellowship', 'gaff'] });
  assert.throws(() => w.tune('nonsense', { x: 1 }), /no module/);
  assert.throws(() => w.tune('ceres', { prices: 1 }), /no module/, 'switched off');
  assert.throws(() => w.tune('fellowship', { friendshp: 2 }), /no setting/);
  assert.throws(() => w.tune('fellowship', { friendship: 'lots' }), /number/);
  assert.throws(() => w.tune('reverie', { minor: 0.3 }), /list/);
  assert.throws(() => w.tune('core', { minutesPerSecond: 2 }), /directly/);
  assert.throws(() => w.tune('fellowship', { friendship: () => 2 }), /plain/);
  assert.throws(() => w.tune('gaff', { events: 2 }, 'sam'), /a person/);
  assert.throws(() => w.tune('fellowship', { friendship: -1 }, 'sam'), /0 or more/);
  assert.throws(() => w.tune('fellowship', { friendship: 2 }, 'nobody'), /nobody/);
  assert.throws(() => w.tune('fellowship', 2), /object/);
  assert.equal(w.s.tune, undefined, 'and keeps nothing');
  w.tune('core', { needCurve: [[0, 0], [1, 1]] });
  assert.deepEqual(w.tuning('core').needCurve, [[0, 0], [1, 1]], 'a curve can be a list of points');
});
