// Rocinante: the sample town that ships with Tyrell, named for the ship in
// The Expanse. Ten people, a cafe, a market, a bar, a workshop, a clinic and
// a park. It's used by the tests and the Voight-Kampff runner, and it's the
// worked example the docs point to: every part of the engine appears here at
// least once.
//
// Plain JavaScript that works three ways: in a browser after dist/tyrell.js
// (it defines buildRocinante), with require() in Node, and with import.
//
// Options: `tuned` (a town tuned to taste: docs/tuning.md), `bree` (Bree's
// interactions: people strike up chats, jokes, arguments and apologies, hold
// grudges and make up; Sam bears Dev a grudge from the start), `harm`
// (Morgul, with Bree: a brawl at the Belt comes out blow by blow, Pip sets a
// snare in the barn, Sam slips nightshade into the cafe's stew; wounds that
// heal or fester, grudges, fear, suspicion, revenge, and Lena's first aid),
// `seed`, `start`, `modules`, `config`, `esper` and `moduleConfig` (over its
// own). Without them, Rocinante runs as it always has.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.buildRocinante = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildRocinante(Tyrell, opts) {
  opts = opts || {};
  const HOUR = 60, DAY = 1440;
  // ---- settings: Rocinante's own, under any the caller gives (opts.moduleConfig) ----
  // With opts.tuned, a town tuned to taste (docs/tuning.md): the headline
  // knobs for everyone, and a few people's own (their `tune`, below). Without
  // it, Rocinante runs as it always has.
  const tuned = !!opts.tuned;
  // With opts.harm, harm between them (Morgul), which needs Bree's interactions too
  const harm = !!opts.harm;
  // With opts.bree, Bree's interactions between the townsfolk, and the natures they read
  const bree = !!opts.bree || harm;
  const own = { cradle: { autoPair: null }, voice: { onWell: ['regard+=0.02'], onBadly: ['regard-=0.02'], deed: 'talked' } };
  if (tuned) {
    own.fellowship = { friendship: 1.5, fading: 0.5 };   // friendships form half as fast again, and fade half as fast
    own.wormtongue = { gossip: 0.8, cooling: 2 };        // a discreet town, and the Watch forgets quickly
    own.reverie = { breaks: 0.5 };                       // people keep it together twice as long
  }
  if (harm) {
    // might in a fight: how strong, and nerve; the crimes harm is; first aid tends better
    own.morgul = {
      might: [{ name: 'strength', input: 'trait.strength', out: [0.6, 1.5] }, { name: 'nerve', input: 'trait.courage', out: [0.8, 1.2] }],
      crimes: { meant: 'assault', careless: 'negligence', killed: 'murder' },
    };
    own.athelas = { tendSkill: 'first_aid' };
    own.bree = { escalation: 1.6 };   // words come to blows a little sooner
  }
  const moduleConfig = {};
  for (const k of [...new Set([...Object.keys(own), ...Object.keys(opts.moduleConfig || {})])]) moduleConfig[k] = Object.assign({}, own[k], (opts.moduleConfig || {})[k]);
  const w = Tyrell.create({
    seed: opts.seed || 'rocinante',
    start: opts.start !== undefined ? opts.start : 6 * HOUR,
    modules: opts.modules,
    config: Object.assign({ minutesPerSecond: 1 }, tuned ? { needs: 1.1 } : {}, opts.config || {}),
    esper: opts.esper,
    moduleConfig,
  });
  // a person's own pace for the headline knobs, in the tuned town (none otherwise)
  const tune = (t) => (tuned ? { tune: t } : {});
  // a person's nature as Bree reads it (temper, warmth, humor, patience, forgiveness), with the bree option (none otherwise)
  const nature = (t) => (bree ? t : {});
  // with the harm option: how strong they are, what they carry, and their own pace (none otherwise)
  const body = (strength) => (harm ? { strength } : {});
  const kit = (o) => (harm ? o : {});
  const carry = (inv) => (harm ? { inv } : {});
  // a person's own knobs: the tuned town's, and the harm option's, together
  const knobsOf = (t, h) => {
    const out = {};
    for (const [on, k] of [[tuned, t], [harm, h]]) if (on && k) for (const m of Object.keys(k)) out[m] = Object.assign(out[m] || {}, k[m]);
    return Object.keys(out).length ? { tune: out } : {};
  };

  // ---- needs: 0 is fine, 1 is desperate; rise is per game hour --------------
  w.need({ id: 'hunger', rise: 0.065, start: 0.3, emotion: 'irritable' });
  w.need({ id: 'energy', rise: 0.06, start: 0.2, emotion: 'tired' });
  // fun, company and hygiene never break through a routine (urgent above 1)
  w.need({ id: 'fun', rise: 0.05, start: 0.3, urgent: 1.1, emotion: 'bored' });
  w.need({ id: 'company', rise: 0.04, start: 0.3, urgent: 1.1, emotion: 'lonely' });
  w.need({ id: 'hygiene', rise: 0.03, start: 0.2, urgent: 1.1 });

  // ---- places ---------------------------------------------------------------
  const apartments = ['apt_1', 'apt_2', 'apt_3', 'apt_4', 'apt_5'];
  for (const f of apartments) w.place({ id: f, tags: ['home'], region: 'blocks', slots: { bed: f === 'apt_1' ? 3 : 2, shower: 1 } });
  w.place({ id: 'cafe', name: 'Mara\'s Cafe', tags: ['food', 'social'], region: 'main', hours: [6, 21], slots: { seat: 8, counter: 1 }, owner: 'mara',
    stock: { bread: 30, flour: 12, ...kit({ stew: 16 }) }, restock: { flour: [8, 24], ...kit({ stew: [12, 24] }) } });
  w.place({ id: 'market', name: 'The Market', tags: ['shop'], region: 'main', hours: [8, 19], slots: { till: 1 }, owner: 'dev', stock: { food: 40, radio: 2 }, restock: { food: [20, 6], radio: [1, 48] } });
  w.place({ id: 'bar', name: 'The Belt', tags: ['social', 'drink'], region: 'main', hours: [17, 2], slots: { stool: 6, bar: 1 }, owner: 'ines' });
  w.place({ id: 'park', name: 'Ring Park', tags: ['outdoors', 'fun', 'social'], region: 'main', slots: { bench: 6 } });
  w.place({ id: 'workshop', name: 'Tomas\'s Workshop', tags: ['work', 'repairs'], region: 'river', hours: [8, 18], slots: { bench: 2 }, owner: 'tomas' });
  w.place({ id: 'clinic', name: 'The Clinic', tags: ['care'], region: 'river', hours: [9, 17], slots: { desk: 1, chair: 3 } });
  w.place({ id: 'station', name: 'Tram Station', tags: ['edge'], region: 'main' });
  // (with harm: the old barn by the river, where Tomas keeps his timber and Pip plays)
  if (harm) w.place({ id: 'barn', name: 'The Old Barn', tags: ['outdoors'], region: 'river' });
  for (const f of apartments) { w.link(f, 'park', 6); w.link(f, 'cafe', 8); }
  w.link('park', 'cafe', 3); w.link('cafe', 'market', 2); w.link('market', 'bar', 3); w.link('cafe', 'bar', 4);
  w.link('park', 'workshop', 9); w.link('workshop', 'clinic', 3); w.link('station', 'cafe', 5);
  if (harm) { w.link('barn', 'workshop', 4); w.link('barn', 'park', 7); }

  // ---- actions --------------------------------------------------------------
  const night = { name: 'night', input: 'hour', range: [0, 24], curve: [[0, 1], [6 / 24, 1], [8 / 24, 0.12], [20 / 24, 0.3], [22.5 / 24, 1], [1, 1]] };
  const daylight = { name: 'daylight', input: 'hour', range: [0, 24], curve: [[0, 0.05], [7 / 24, 0.05], [9 / 24, 1], [19 / 24, 1], [21 / 24, 0.1], [1, 0.05]] };
  w.action({ id: 'sleep', label: 'sleeping', tell: { did: 'slept', doing: 'was asleep' }, at: 'home', slot: 'bed', minutes: [420, 510], relieves: { energy: 0.95 }, rates: { hunger: 0.4, fun: 0.2, company: 0.2, hygiene: 0.5 }, tags: ['sleep'], pose: 'sleep', considerations: [night] });
  w.action({ id: 'nap', label: 'a nap', tell: { did: 'had a nap', doing: 'was napping' }, at: 'home', slot: 'bed', minutes: 60, relieves: { energy: 0.3 }, tags: ['sleep'], pose: 'sleep', cooldown: 6 * HOUR });
  w.action({ id: 'shower', tell: { did: 'showered', doing: 'was in the shower' }, at: 'home', slot: 'shower', minutes: 15, relieves: { hygiene: 0.85 }, pose: 'stand', feels: ['fresh'] });
  w.action({ id: 'read', label: 'reading', tell: { did: 'read', doing: 'was reading' }, at: 'home', minutes: 60, relieves: { fun: 0.2 }, base: 0.02, pose: 'sit', tags: ['comfort'], trains: { lore: 0.5 }, palls: true });
  w.action({ id: 'eat_cafe', label: 'eating at the cafe', tell: { did: 'ate at {place}', doing: 'was eating at {place}' }, at: 'tag:food', slot: 'seat', minutes: [30, 45], relieves: { hunger: [0.5, 0.7], company: 0.1 }, price: 6, pose: 'sit', tags: ['social', 'food'], feels: ['good_meal'], store: 'here', uses: { bread: 1 } });
  w.action({ id: 'eat_home', label: 'eating at home', tell: { did: 'ate', doing: 'was eating' }, at: 'home', minutes: 25, relieves: { hunger: 0.55 }, uses: { food: 1 }, pose: 'sit', tags: ['food'] });
  w.action({ id: 'buy_food', label: 'shopping', tell: { did: 'bought food at {place}', doing: 'was shopping at {place}' }, at: 'market', minutes: 10, buys: { food: 2 }, price: 8, pose: 'stand' });
  w.action({ id: 'steal_food', label: 'pocketing food', tell: { did: 'pocketed some food at {place}' }, at: 'market', minutes: 4, gives: { food: 1 }, tags: ['illegal'], against: ['honesty'], crime: 'theft', pose: 'stand' });
  w.action({ id: 'bar_snack', label: 'a bowl of noodles at the Belt', tell: { did: 'had a bowl of noodles at {place}' }, at: 'tag:drink', slot: 'stool', minutes: 20, relieves: { hunger: 0.45 }, price: 4, pose: 'sit', tags: ['food'] });
  w.action({ id: 'drink', label: 'drinking at the Belt', tell: { did: 'drank at {place}', doing: 'was drinking at {place}' }, at: 'tag:drink', slot: 'stool', minutes: [60, 120], relieves: { fun: 0.4, company: 0.35 }, price: 5, pose: 'sit', tags: ['social'], palls: 'drink', then: ['afflict:ale'] });
  w.action({ id: 'walk', label: 'a walk in the park', tell: { did: 'took a walk in {place}', doing: 'was walking in {place}' }, at: 'park', minutes: 45, relieves: { fun: 0.3 }, tags: ['outdoors'], pose: 'walk', considerations: [daylight], palls: 'park' });
  w.action({ id: 'sit_park', label: 'sitting in the park', tell: { did: 'sat in {place}', doing: 'was sitting in {place}' }, at: 'park', slot: 'bench', minutes: 40, relieves: { fun: 0.15, company: 0.15 }, tags: ['outdoors', 'social'], pose: 'sit', considerations: [daylight], palls: 'park' });
  w.action({ id: 'chat', label: 'chatting', tell: { did: 'chatted with {target}', doing: 'was chatting with {target}' }, target: 'person', at: 'here', minutes: 20, relieves: { company: 0.4, fun: 0.1 }, tags: ['social'], social: 'chat', pose: 'stand', cooldown: 30 });
  w.action({ id: 'help_out', label: 'helping out', tell: { did: 'helped {target} out', doing: 'was helping {target}' }, target: 'person', at: 'here', minutes: 30, base: 0.04, relieves: { company: 0.2 }, deed: 'helped', tags: ['social'], targetIf: ['regard>0.2'], cooldown: DAY });
  w.action({ id: 'sulk', label: 'sulking', tell: { did: 'sulked', doing: 'was sulking' }, at: 'home', minutes: 120, pose: 'sit', rank: -1 });
  w.action({ id: 'bender', label: 'a bender', tell: { did: 'went on a bender at {place}', doing: 'was on a bender at {place}' }, at: 'tag:drink', minutes: 240, relieves: { fun: 0.6 }, pose: 'sit', rank: -1 });
  // work: only done on shift (rank -1 means "only when required")
  // Mara bakes the cafe's bread from its flour, an hour at a time (fill: false), more of it the better she is
  w.action({ id: 'bake', label: 'baking', tell: { did: 'baked bread', doing: 'was baking' }, at: 'cafe', slot: 'counter', minutes: 60, fill: false, job: 'baker', rank: -1, pose: 'work', tags: ['work'], trains: { baking: 1 },
    store: 'here', uses: { flour: 1 }, makes: { bread: 2 }, yields: [{ input: 'skill.baking', out: [0.6, 1.4] }] });
  w.action({ id: 'fix', label: 'fixing things', tell: { did: 'fixed things at {place}', doing: 'was at the bench' }, at: 'workshop', slot: 'bench', minutes: 60, job: 'mechanic', rank: -1, pose: 'work', tags: ['work'], trains: { repair: 1 } });
  w.action({ id: 'serve', label: 'serving drinks', tell: { did: 'served drinks', doing: 'was behind the bar' }, at: 'bar', slot: 'bar', minutes: 60, job: 'bartender', rank: -1, pose: 'work', tags: ['work'], relieves: { company: 0.15 } });
  w.action({ id: 'sell', label: 'minding the till', tell: { did: 'minded the till', doing: 'was minding the till' }, at: 'market', slot: 'till', minutes: 60, job: 'grocer', rank: -1, pose: 'work', tags: ['work'] });
  w.action({ id: 'treat', label: 'seeing patients', tell: { did: 'saw patients', doing: 'was seeing patients' }, at: 'clinic', slot: 'desk', minutes: 60, job: 'doctor', rank: -1, pose: 'work', tags: ['work'] });
  w.action({ id: 'patrol', label: 'on patrol', tell: { did: 'patrolled {place}', doing: 'was on patrol' }, at: 'park', minutes: 60, job: 'officer', rank: -1, pose: 'walk', tags: ['work'] });
  // the radio repair: a service, a purchase, or nothing
  w.action({ id: 'repair_service', label: 'getting a radio fixed', tell: { did: 'had the radio fixed at {place}' }, at: 'tag:repairs', minutes: 20, price: 15, uses: { broken_radio: 1 }, gives: { radio: 1 }, pose: 'stand', deed: 'paid' });
  w.action({ id: 'buy_radio', label: 'buying a radio', tell: { did: 'bought a radio' }, at: 'market', minutes: 10, price: 40, buys: { radio: 1 }, pose: 'stand' });
  w.action({ id: 'listen', label: 'listening to the radio', tell: { did: 'listened to the radio', doing: 'was listening to the radio' }, at: 'home', minutes: 60, relieves: { fun: 0.35 }, if: ['has:radio'], pose: 'sit', tags: ['comfort'] });
  w.action({ id: 'shrug', label: 'giving up on the radio', tell: { did: 'gave up on the radio' }, minutes: 1, then: ['take:broken_radio'] });

  // ---- skills: levels that grow with practice, at each person's own pace -----
  w.skill({ id: 'baking', label: 'Baking', rate: 0.01, levels: [[0.5, 'skilled'], [0.8, 'expert']] });
  w.skill({ id: 'repair', label: 'Repair', rate: 0.01, levels: [[0.5, 'skilled'], [0.8, 'expert']], decay: 0.004, floor: 0.2 });
  w.skill({ id: 'lore', label: 'Lore', rate: 0.03, diminish: 2 });

  // ---- Delos: genomes, so the town's children take after their parents -------
  // (declared before anyone is added: founders get a genome when they join,
  // keeping the traits, talents and instincts their definitions give)
  const delos = w.delos;
  if (delos) {
    delos.gene({ id: 'eyes', alleles: ['brown', 'hazel', 'green', 'blue'], weights: [5, 2, 1.5, 2.5], mutate: 0.04 });
    delos.gene({ id: 'hair', alleles: ['black', 'brown', 'red', 'fair'], copies: 1, mutate: 0.05 });
    for (const t of ['thrift', 'honesty', 'talkative', 'courage']) delos.trait({ id: t });
    for (const k of ['baking', 'repair', 'lore']) delos.talent({ id: k });
    for (const a of ['walk', 'read', 'drink']) delos.instinct({ id: a });
  }

  // ---- pastimes that pall, and wishes and dreams ------------------------------
  w.pastime({ id: 'drink', label: 'the Belt' });
  w.pastime({ id: 'park', label: 'the park' });
  w.wish({ id: 'night_out', label: 'A night at the Belt', if: ['!is:child'], weight: [{ input: 'trait.talkative', out: [0.3, 1.2] }], toward: ['drink'], by: ['drink'] });
  w.wish({ id: 'fresh_air', label: 'Some fresh air', toward: ['tag:outdoors'], by: ['walk', 'sit_park'] });
  w.wish({
    id: 'catch_up', label: 'A good talk with a friend', minutes: 2 * DAY, toward: ['chat', 'help_out'], by: ['chat', 'help_out'],
    about: (ctx) => (ctx.world.fellowship ? ctx.world.fellowship.friends(ctx.person.id, 1)[0] : undefined),
  });
  w.wish({ id: 'master_baker', label: 'Become an expert baker', tell: 'dreamed of becoming an expert baker', dream: true, if: ['job:baker'], toward: ['bake'], progress: (ctx) => ctx.world.skillOf(ctx.person.id, 'baking') / 0.8 });
  w.wish({ id: 'master_mechanic', label: 'Become an expert mechanic', tell: 'dreamed of becoming an expert mechanic', dream: true, if: ['job:mechanic'], toward: ['fix'], progress: (ctx) => ctx.world.skillOf(ctx.person.id, 'repair') / 0.8 });

  // ---- tasks (Mentat) ------------------------------------------------------
  w.task({
    id: 'dinner_at_home', label: 'dinner at home', relieves: { hunger: 0.55 }, base: 0.02, tags: ['food'], cooldown: 3 * HOUR,
    methods: [
      { name: 'from the cupboard', if: ['has:food'], do: ['eat_home'] },
      { name: 'shop first', do: ['get:food', 'eat_home'] },
    ],
  });
  w.task({
    id: 'fix_radio', label: 'getting the radio working', relieves: { fun: 0.3 }, base: 0.05, if: ['has:broken_radio'], cooldown: 12 * HOUR,
    methods: [
      { name: 'take it to Tomas', if: ['thinks:open:workshop'], do: ['repair_service'] },
      { name: 'buy another', if: ['money>=150'], do: ['get:radio'] },
      { name: 'do without', do: ['shrug'] },
    ],
  });

  // ---- people ---------------------------------------------------------------
  // a routine names what's expected and when; [hour, null, '*'] is free time
  const sleepNight = [[7, null, '*'], [23, 'home', 'sleep']];
  w.person('mara', {
    name: 'Mara', home: 'apt_1', groups: ['h_okafor', 'regulars'], vars: { money: 120 },
    traits: { thrift: 0.6, honesty: 0.9, talkative: 0.7, courage: 0.6, ...nature({ warmth: 0.75, patience: 0.6 }), ...body(0.5) }, values: { honesty: 0.8, family: 0.9 },
    skills: { baking: 0.62 }, talents: { baking: 1.2 },
    job: { id: 'baker', place: 'cafe', action: 'bake', shifts: [[6, 14]], wage: 0 },
    routine: [[5.5, 'home', 'shower'], [6, null, '*'], [14.25, 'market', 'buy_food'], [14.5, null, '*'], [22, 'home', 'sleep']],
  });
  w.person('tomas', {
    name: 'Tomas', home: 'apt_1', groups: ['h_okafor'], vars: { money: 60 },
    traits: { thrift: 0.4, honesty: 0.8, talkative: 0.3, courage: 0.7, ...nature({ temper: 0.6, patience: 0.7 }), ...body(0.8) }, values: { honesty: 0.6, craft: 0.9 },
    skills: { repair: 0.74 }, talents: { repair: 1.3 },
    job: { id: 'mechanic', place: 'workshop', action: 'fix', shifts: [[8, 17]], days: [0, 1, 2, 3, 4, 5], wage: 0 },
    // (with harm: timber from the barn first thing)
    routine: [[7, null, '*'], ...(harm ? [[7.4, 'barn', 'fetch_timber'], [7.7, null, '*']] : []), [17, 'tag:food', 'eat_cafe'], [18, null, '*'], [23, 'home', 'sleep']],
  });
  w.person('pip', {
    name: 'Pip', home: 'apt_1', groups: ['h_okafor'], born: -9 * 365 * DAY, tags: ['child'],
    traits: { talkative: 0.8, courage: 0.4, honesty: 0.7, ...nature({ humor: 0.8, temper: 0.6 }), ...body(0.2) }, ...carry({ snare: 2 }),
    routine: [[7, 'home', '*'], [10, 'park', 'sit_park'], [11, null, '*'], [15, 'park', 'walk'], [16, null, '*'], [20.5, 'home', 'sleep']],
  });
  w.person('ines', {
    name: 'Ines', home: 'apt_2', groups: ['regulars'], vars: { money: 80 },
    traits: { thrift: 0.3, honesty: 0.6, talkative: 0.9, courage: 0.8, ...nature({ warmth: 0.8, humor: 0.7, patience: 0.6 }), ...body(0.45) }, values: { honesty: 0.4 },
    job: { id: 'bartender', place: 'bar', action: 'serve', shifts: [[17, 1]], wage: 9 },
    routine: [[2, 'home', 'sleep'], [10, null, '*']],
  });
  w.person('dev', {
    name: 'Dev', home: 'apt_3', vars: { money: 90 },
    traits: { thrift: 0.8, honesty: 0.7, talkative: 0.5, greed: 0.6, ...nature({ temper: 0.65, patience: 0.4 }), ...body(0.55) }, values: { honesty: 0.5 },
    job: { id: 'grocer', place: 'market', action: 'sell', shifts: [[8, 16]], days: [0, 1, 2, 3, 4, 5], wage: 0 },
    routine: sleepNight,
  });
  w.person('ruth', {
    name: 'Ruth', home: 'apt_4', vars: { money: 100 }, inv: { broken_radio: 1 },
    traits: { thrift: 0.7, honesty: 0.9, talkative: 0.8, memory: 0.5, ...nature({ warmth: 0.75, forgiveness: 0.8, temper: 0.3 }), ...body(0.3) }, values: { honesty: 0.9, faith: 0.7 },
    routine: [
      { days: [6], plan: [[8, null, '*'], [11, 'park', 'sit_park'], [12, null, '*'], [22, 'home', 'sleep']] },
      { when: ['fact:raining'], plan: [[8, 'home', '*'], [22, 'home', 'sleep']] },
      { plan: [[8, null, '*'], [9.5, 'market', 'buy_food'], [9.75, null, '*'], [14, 'park', 'sit_park'], [15, null, '*'], [18, 'tag:food', 'eat_cafe'], [19, null, '*'], [22, 'home', 'sleep']] },
    ],
    ...tune({ reverie: { forgetting: 0.5 } }), // (tuned: Ruth forgets nothing in a hurry)
  });
  w.person('kofi', {
    name: 'Kofi', home: 'apt_5', vars: { money: 25 },
    traits: { thrift: 0.5, honesty: 0.6, talkative: 0.6, courage: 0.5, ...nature({ humor: 0.75 }), ...body(0.55) }, values: { honesty: 0.5 },
    talents: { lore: 1.5 }, instincts: { walk: 1.25, read: 1.2 },   // a student who'd rather be outdoors
    ...tune({ fellowship: { friendship: 2 }, cityspeak: { chatter: 1.5 } }), // (tuned: he makes friends fast, and talks)
  });
  w.person('lena', {
    name: 'Lena', home: 'apt_5', vars: { money: 150 }, groups: ['regulars'],
    traits: { thrift: 0.5, honesty: 0.9, talkative: 0.4, courage: 0.6, ...nature({ patience: 0.75, warmth: 0.6 }), ...body(0.4) }, values: { honesty: 0.8 },
    ...(harm ? { skills: { first_aid: 0.8 } } : {}),
    job: { id: 'doctor', place: 'clinic', action: 'treat', shifts: [[9, 17]], days: [0, 1, 2, 3, 4], wage: 20 },
    routine: [[7, 'home', 'shower'], [7.5, null, '*'], [23, 'home', 'sleep']],
  });
  w.person('sam', {
    name: 'Sam', home: 'apt_3', vars: { money: 4 },
    traits: { thrift: 0.2, honesty: 0.15, talkative: 0.7, courage: 0.7, greed: 0.8, ...nature({ temper: 0.85, forgiveness: 0.2, humor: 0.6 }), ...body(0.6) }, values: { honesty: 0.05 },
    // (with harm: a knife, a stash of nightshade, and a short fuse)
    ...carry({ knife: 1, nightshade: 3 }),
    // (tuned: a gossip and a liar, quick to snap)
    ...knobsOf({ wormtongue: { gossip: 1.5, lies: 2 }, reverie: { breaks: 2 } }, { bree: { escalation: 1.5, quarrels: 1.5 } }),
  });
  w.person('vance', {
    name: 'Officer Vance', home: 'apt_2', groups: ['watch'], vars: { money: 100 },
    traits: { thrift: 0.5, honesty: 0.8, talkative: 0.5, courage: 0.9, lawful: 0.9, ...nature({ patience: 0.8, temper: 0.3 }), ...body(0.75) }, values: { honesty: 0.7, law: 0.9 }, ...carry({ baton: 1 }),
    job: { id: 'officer', place: 'park', action: 'patrol', shifts: [[10, 18]], wage: 15 },
    routine: [[7, null, '*'], [18, 'tag:food', 'eat_cafe'], [19, null, '*'], [23, 'home', 'sleep']],
  });
  // Kofi and Sam have no routine at all: their needs run their days

  // ---- Reverie: feelings, breaks, memories ----------------------------------
  const rv = w.reverie;
  if (rv) {
    rv.feeling({ id: 'good_meal', label: 'A good meal', tell: 'enjoyed a good meal', weight: 0.08, minutes: 4 * HOUR, emotion: 'happy' });
    rv.feeling({ id: 'fresh', label: 'Freshly showered', tell: 'felt fresh', weight: 0.05, minutes: 3 * HOUR, emotion: 'happy' });
    rv.feeling({ id: 'lonely', label: 'Lonely', tell: 'felt lonely', weight: -0.1, minutes: 12 * HOUR, emotion: 'sad', boost: { social: 1.5 } });
    rv.breakdown({ id: 'sulk', level: 'minor', do: 'sulk', label: 'sulking at home', tell: 'broke down and sulked at home' });
    rv.breakdown({ id: 'bender', level: 'major', do: 'bender', label: 'a bender', tell: 'broke down and went on a bender', weight: [{ input: 'trait.courage', out: [0.3, 1.5] }] });
    rv.breakdown({ id: 'walkout', level: 'extreme', do: 'walk', label: 'walking it off', tell: 'broke down and walked out to clear their head' });
    rv.memoryKind({ id: 'saw:theft', importance: 6, shifts: { honesty: 0.05 } });
    rv.memoryKind({ id: 'helped', importance: 6, shifts: { talkative: 0.03 } });
  }

  // ---- deeds: what doing something for (or to) someone means -----------------
  w.deed('helped', { feeling: 'helped', regard: 0.15, memory: 6, sentiment: 'helped me out' });
  w.deed('fixed', { feeling: 'helped', regard: 0.2, memory: 6, fame: 0.05 });
  w.deed('cheated', { feeling: 'wronged', regard: -0.3, memory: 7, infamy: 0.1 });
  w.deed('paid', { regard: 0.02 });
  w.deed('talked', { regard: 0.01 });

  // ---- Fellowship: groups --------------------------------------------------
  const fs = w.fellowship;
  if (fs) {
    fs.group({ id: 'h_okafor', kind: 'household', label: 'the Okafors', purse: true });
    fs.group({ id: 'watch', kind: 'authority', label: 'the Watch' });
    fs.group({ id: 'regulars', kind: 'club', label: 'the Belt\'s regulars' });
    if (!fs.partner('mara')) fs.setPartner('mara', 'tomas');
  }

  // ---- Wormtongue: crimes --------------------------------------------------
  if (w.wormtongue) {
    w.wormtongue.crime({ kind: 'theft', severity: 0.4, reportTo: 'watch' });
    w.wormtongue.crime({ kind: 'strip', severity: 0.6, reportTo: 'watch' });
  }

  // ---- Ceres: goods ----------------------------------------------------------
  if (w.ceres) {
    w.ceres.good({ id: 'food', kind: 'food', price: 4 });
    // the Okafors share a purse and a pantry
    if (!w.kept('stocked')) {
      w.ceres.pay('world', 'h_okafor', 200, 'savings');
      w.ceres.income('ruth', 120, 7);         // a pension
      w.ceres.income('kofi', 70, 7);          // a student grant
      w.ceres.rent('kofi', 25, 7, 'dev');     // Dev is his landlord
      w.keep('stocked', true);
    }
    w.ceres.good({ id: 'radio', kind: 'gadget', price: 40 });
    w.ceres.good({ id: 'broken_radio', kind: 'junk', price: 0 });
    // the cafe's bread: flour delivered every morning, baked by Mara, eaten at the tables
    w.ceres.good({ id: 'flour', kind: 'stores' });
    w.ceres.good({ id: 'bread', kind: 'food', price: 2 });
    w.ceres.chain({ id: 'bread', label: 'Bread', goods: ['flour', 'bread'], store: 'cafe' });
  }

  // ---- Cityspeak: lines, practices, social acts -------------------------------
  const cs = w.cityspeak;
  if (cs) {
    cs.addLines([
      { key: 'greet', topic: 'greet', text: ['Morning.', 'All right?', 'Hey.'] },
      { key: 'greet_friend', topic: 'greet', to: ['friend'], text: 'There you are!' },
      { key: 'greet_tired', topic: 'greet', when: ['need.energy>0.7'], text: 'Don\'t. I\'m half asleep.' },
      { key: 'greet_player_fixed', topic: 'greet', to: ['file:target.fixed>0'], text: 'You\'re the one who fixed my radio.' },
      { key: 'chat_weather', topic: 'chat', text: 'Looks like rain.', reply: 'topic:chat_reply' },
      { key: 'chat_hungry', topic: 'chat', when: ['need.hunger>0.6'], text: 'I could eat a horse.', reply: 'topic:chat_reply' },
      { key: 'chat_theft', topic: 'chat', when: ['knows:did:sam:theft'], text: 'Did you hear about Sam at the market?', reply: 'topic:gossip_reply', weight: 3 },
      { key: 'reply_ok', topic: 'chat_reply', text: ['Mm.', 'Too right.'] },
      { key: 'reply_gossip', topic: 'gossip_reply', text: 'No! Really?' },
      { key: 'bar_cheers', topic: 'chat', who: 'job:bartender', when: ['at:bar'], text: 'What\'ll it be?' },
      { key: 'mara_bread', topic: 'greet', who: 'mara', when: ['at:cafe'], text: 'Bread\'s fresh this morning.', cooldown: 6 * HOUR },
    ]);
    // the words of the player's talks (Voice): a beat names a topic, the most specific line wins
    cs.addLines([
      { key: 'how_fine', topic: 'how', text: ['Not bad, thanks.', 'Getting along.'] },
      { key: 'how_hungry', topic: 'how', when: ['need.hunger>0.6'], text: 'Starving, if I\'m honest.' },
      { key: 'how_tired', topic: 'how', when: ['need.energy>0.7'], text: 'Dead on my feet.' },
      { key: 'how_low', topic: 'how', when: ['mood<0.4'], text: 'Could be better.' },
      { key: 'how_cold', topic: 'how', when: ['under:cold=sniffles'], pri: 1, text: '*sniff* Full of cold.' },
      { key: 'radio', topic: 'radio', text: 'My radio\'s packed in, and the quiz is on tonight.' },
      { key: 'radio_thanks', topic: 'radio.thanks', text: 'Would you? You\'re a dear.' },
      { key: 'radio_tomas', topic: 'radio.tomas', text: 'Tomas? I suppose I could take it to him.' },
      { key: 'bye_talk', topic: 'bye', text: ['See you around.', 'Take care.'] },
      { key: 'close_talk', topic: 'close', text: 'Anyway, I should get on.' },
      { key: 'react_badly', topic: 'react.badly', text: 'Hm.' },
      { key: 'react_jest_well', topic: 'react.jest.well', text: 'Ha! Cheek.' },
    ]);
    cs.practice({ id: 'dinner', at: 'cafe', hours: [17, 21], roles: { cook: { job: 'baker', actions: ['bake'] }, diner: { actions: ['eat_cafe', 'chat'] } }, tone: 0.05 });
    cs.practice({ id: 'last_orders', at: 'bar', hours: [0, 1], roles: { drinker: { actions: ['drink'] } }, boost: 1.3 });
    cs.act({ id: 'chat', accept: [{ name: 'regard', input: 'regard', range: [-1, 1], out: [0.2, 1] }], feelings: { refused: 'lonely' }, regard: [0.03, -0.02] });
  }

  // ---- Voice: the player's talks -----------------------------------------------
  const vo = w.voice;
  if (vo) {
    vo.approach({ id: 'warm', base: 1, lands: [{ if: ['trait.talkative<0.4'], by: -1 }] });
    vo.approach({ id: 'jest', lands: [{ if: ['trait.courage>0.6'], by: 2 }, { if: ['trait.honesty>0.85'], by: -1 }, { if: ['mood<0.4'], by: -2 }] });
    vo.thread({
      id: 'how', label: 'How are you?', weight: 1.2, cooldown: DAY,
      beats: { start: { line: 'how', answers: [
        { say: 'Glad to hear it.', approach: 'warm' },
        { say: 'You look like you need a holiday.', approach: 'jest' },
      ] } },
    });
    vo.thread({
      id: 'radio', label: 'Is everything all right?', if: ['has:broken_radio'], reveals: 'radio', weight: 1.5,
      beats: {
        start: { line: 'radio', then: ['learn:radio=broken'], answers: [
          { say: 'I could fix it for you.', approach: 'warm', then: ['promise:fix_radio'], to: 'thanks' },
          { say: 'Tomas fixes radios.', then: ['believe:fixes:tomas=true'], to: 'tomas' },
        ] },
        thanks: { line: 'radio.thanks', end: true },
        tomas: { line: 'radio.tomas', end: true },
      },
    });
    // once you know about her radio, you can ask after it: it recalls what she told you, and lands better
    vo.thread({
      id: 'radio.again', label: 'How\'s the radio?', recalls: 'radio', approach: 'warm',
      beats: { start: { text: 'Still {learned.radio}. Thanks for asking, though.', end: true } },
    });
    vo.promise({ id: 'fix_radio', label: 'You said you\'d fix my radio', days: 2, kept: ['has:radio'], onKept: ['regard+=0.1', 'feel:helped'], onBroken: ['regard-=0.15'], lapse: 'broken' });
  }

  // ---- Bree: interactions between the townsfolk (with the bree option) -------
  // The starter set: chats over topics, jokes, compliments, teasing, flirting,
  // comfort, favors, gifts, a hand, lessons, arguments, insults, fights,
  // apologies, making up and the cold shoulder. A fight is a crime the Watch
  // hears of; a natter at the cafe or the Belt is a conversation of its own.
  const br = w.bree;
  if (bree && br) {
    br.starter({ company: 'company', fun: 'fun' });
    w.action({ id: 'natter', label: 'a natter', tell: { did: 'nattered with {target}', doing: 'was nattering with {target}' }, target: 'person', at: 'here', minutes: 25, relieves: { company: 0.3, fun: 0.05 }, tags: ['social'], interact: 'chat', pose: 'stand', cooldown: 60, targetIf: ['regard>0'] });
    if (w.wormtongue) w.wormtongue.crime({ kind: 'fight', severity: 0.3, reportTo: 'watch' });
    if (cs) cs.addLines([
      { key: 'bree_small_open', topic: 'small_talk.open', text: ['Busy day?', 'Keeping well?', 'How\'s things?'] },
      { key: 'bree_small_reply', topic: 'small_talk.reply', text: ['Can\'t complain.', 'Same as ever.'] },
      { key: 'bree_small_reply_ornery', topic: 'small_talk.reply', when: ['manner:ornery'], text: 'Why do you want to know?' },
      { key: 'bree_small_reply_sour', topic: 'small_talk.reply', when: ['turn:sour'], text: 'Mm.' },
      { key: 'bree_news_open', topic: 'news.open', text: 'Have you heard?' },
      { key: 'bree_doing_open', topic: 'the_moment.open', when: ['at:cafe'], text: 'Mara\'s outdone herself.' },
      { key: 'bree_argue_open', topic: 'argue.open', text: 'Now you listen to me.' },
      { key: 'bree_grievance_open', topic: 'grievance.open', text: 'You know what you did.' },
      { key: 'bree_fight_open', topic: 'fight.open', text: '*shoves*' },
      { key: 'bree_calm', topic: 'bree.calm', text: 'Hey. I didn\'t mean it like that.' },
      { key: 'bree_step_in', topic: 'bree.step_in', text: 'All right, that\'s enough, the pair of you.' },
      { key: 'bree_leave', topic: 'bree.leave', text: 'Suit yourself.' },
      { key: 'bree_sorry', topic: 'apologize.open', text: 'Look, I\'m sorry.' },
      { key: 'bree_bye', topic: 'bree.bye', text: ['See you around.', 'Mind how you go.'] },
      { key: 'bree_bye_friend', topic: 'bree.bye', to: ['friend'], text: 'Same time tomorrow?' },
    ]);
    // Sam owes Dev rent, and Dev has let him know it
    if (!w.kept('grudges')) { br.grudgeAgainst('sam', 'dev', 0.4, 'the rent'); w.keep('grudges', true); }
  }

  // ---- Gaff: storylets -------------------------------------------------------
  const gaff = w.gaff;
  if (gaff) {
    gaff.storylet({
      id: 'rain', label: 'Rain', mtb: 2 * DAY, cooldown: DAY, when: ['!fact:raining'],
      fire: (world) => { world.fact('raining', true); world.at(world.now + 6 * HOUR, 'rain-stops'); },
    });
    gaff.storylet({
      id: 'blackout', label: 'A blackout at the Belt', mtb: 6 * DAY, cooldown: 3 * DAY, phase: ['build', 'relax'],
      fire: (world) => { world.fact('closed:bar', true); world.at(world.now + 3 * HOUR, 'power-back'); },
    });
    w.on('timer:rain-stops', () => w.fact('raining', false));
    w.on('timer:power-back', () => w.fact('closed:bar', false));
  }

  // ---- Athelas: courses that run their course -------------------------------
  const athelas = w.athelas;
  if (athelas) {
    athelas.course({ id: 'ale', label: 'A few drinks', tell: { on: 'had a few drinks too many', over: 'slept off the drink' }, again: 'extend', phases: [
      { id: 'merry', label: 'merry', minutes: 180, rates: { energy: 1.3 }, weigh: { 'tag:work': 0.7, chat: 1.3 } },
      { id: 'sore_head', label: 'a sore head', minutes: 360, weigh: { nap: 1.5, 'tag:social': 0.8 } },
    ] });
    athelas.course({
      id: 'cold', label: 'A cold', tell: { on: 'caught a cold', over: 'shook off the cold' }, tags: ['illness'], immunity: 5 * DAY,
      contagion: { chance: 0.05, resist: [{ name: 'courage', input: 'trait.courage', out: [1.3, 0.7] }] },
      phases: [
        { id: 'coming_on', label: 'coming on', minutes: [300, 540], spreads: false },
        { id: 'sniffles', label: 'the sniffles', minutes: [900, 1800], rates: { energy: 1.4 }, weigh: { nap: 2, sleep: 1.3, 'tag:outdoors': 0.5, '*': 0.85 } },
      ],
    });
    // Kofi has brought a cold back from his lectures, and it may go round
    if (!w.kept('a_cold')) { athelas.afflict('kofi', 'cold'); w.keep('a_cold', true); }
  }

  // ---- Morgul: harm between the townsfolk (with the harm option) -------------
  // A brawl at the Belt (Bree's fights, blow by blow, by strength, nerve and
  // what they carry: Vance's baton, Sam's knife), a snare Pip sets in the
  // barn as a prank (Tomas fetches timber there every morning), and the
  // nightshade Sam slips into the cafe's stew when nobody's looking. Bruises
  // and beatings mend; a cut festers unless someone tends it; nightshade
  // works quietly for hours before anyone knows. Whoever's hurt bears a
  // grudge, is afraid, and may want to get even (have it out, or spike their
  // supper); whoever didn't see it done suspects someone, rightly or not;
  // Lena's first aid is the best in town. Nobody dies of it (lethality 0).
  const mg = w.morgul;
  if (harm && mg && athelas) {
    w.skill({ id: 'first_aid', label: 'First aid', rate: 0.02 });
    // what harm is done with: the same means the game's Tycho.harm would play on screen
    mg.means({ id: 'knife', kinds: ['cut'], use: 'strike', severity: 0.2 });
    mg.means({ id: 'baton', kinds: ['blunt'], use: 'strike', severity: 0.15 });
    mg.means({ id: 'snare', kinds: ['cut'], use: 'set', severity: 0.2 });
    mg.means({ id: 'nightshade', kinds: ['poison'], use: 'dose', course: 'nightshade', severity: 0.45 });
    mg.trap({ id: 'snare', label: 'a snare', kind: 'cut', severity: 0.2, hidden: true, uses: 1, catch: 0.4 });
    // what each harm leaves: the first wound that fits
    mg.wound({ id: 'bruised', kinds: ['blunt'], at: [0, 0.3], course: 'bruised' });
    mg.wound({ id: 'beaten', kinds: ['blunt'], at: [0.3, 1], course: 'beaten' });
    mg.wound({ id: 'cut', kinds: ['cut'], course: 'cut' });
    athelas.course({ id: 'bruised', label: 'Bruised', tell: { on: 'was bruised', over: 'stopped hurting' }, tags: ['wound'], again: 'worsen', phases: [
      { id: 'sore', label: 'sore', minutes: [120, 240], weigh: { 'tag:work': 0.8, nap: 1.3 }, feel: 'sore' },
      { id: 'stiff', label: 'stiff', minutes: [300, 600], hurts: 0.4 },
    ] });
    athelas.course({ id: 'beaten', label: 'A beating', tell: { on: 'took a beating', over: 'got over the beating' }, tags: ['wound'], again: 'worsen', phases: [
      { id: 'battered', label: 'battered', minutes: [300, 480], stop: true, rates: { energy: 1.5 }, weigh: { sleep: 1.6, nap: 2, 'tag:work': 0.5, 'tag:social': 0.7 }, feel: 'battered' },
      { id: 'aching', label: 'aching', minutes: [720, 1440], hurts: 0.5, weigh: { 'tag:work': 0.8 } },
      { id: 'mending', label: 'mending', minutes: 1440, hurts: 0.15 },
    ] });
    // a cut tended heals; untended, it festers, and a bad one can go bad (it would kill, at a lethality above 0)
    athelas.course({ id: 'cut', label: 'A cut', tell: { on: 'was cut', over: 'had the cut heal' }, tags: ['wound'], again: 'worsen', phases: [
      { id: 'bleeding', label: 'bleeding', minutes: [60, 120], next: [{ if: ['tended:cut'], to: 'healing' }, { to: 'festering' }] },
      { id: 'festering', label: 'festering', minutes: [600, 1200], hurts: 1.3, rates: { energy: 1.4 }, weigh: { sleep: 1.3, 'tag:work': 0.6 }, feel: 'festering',
        next: [{ if: ['tended:cut'], to: 'healing' }, { if: ['sev:cut>0.6'], to: 'gone_bad' }, { to: 'healing' }] },
      { id: 'gone_bad', label: 'gone bad', minutes: [1440, 2880], hurts: 1.5, stop: true, weigh: { sleep: 2, '*': 0.3 }, blocks: ['tag:work'], dies: true, next: 'healing' },
      { id: 'healing', label: 'healing', minutes: [1440, 2880], hurts: 0.3 },
    ] });
    // nightshade works unnoticed for hours, then tells
    athelas.course({ id: 'nightshade', label: 'Nightshade', tell: { on: 'was poisoned', over: 'pulled through the poisoning' }, tags: ['illness', 'poison'], phases: [
      { id: 'working', minutes: [180, 360], quiet: true, rates: { hunger: 0.6 } },
      { id: 'sick', label: 'violently sick', minutes: [600, 1080], tells: true, stop: true, rates: { energy: 1.8, hunger: 0.2 }, weigh: { sleep: 2, nap: 2, '*': 0.4 }, blocks: ['tag:work'], feel: 'poisoned' },
      { id: 'weak', label: 'weak', minutes: [720, 1440], hurts: 0.3, rates: { energy: 1.3 } },
    ] });
    if (rv) {
      rv.feeling({ id: 'sore', label: 'Sore', tell: 'was sore', weight: -0.05, minutes: 4 * HOUR, emotion: 'sad' });
      rv.feeling({ id: 'battered', label: 'Battered', tell: 'felt battered', weight: -0.15, minutes: DAY, emotion: 'sad' });
      rv.feeling({ id: 'festering', label: 'A cut gone angry', tell: 'had a cut gone angry', weight: -0.12, minutes: 12 * HOUR, emotion: 'sad' });
      rv.feeling({ id: 'poisoned', label: 'Sick as a dog', tell: 'was sick as a dog', weight: -0.2, minutes: 12 * HOUR, emotion: 'sad' });
    }
    if (w.wormtongue) {
      w.wormtongue.crime({ kind: 'assault', severity: 0.5, reportTo: 'watch' });
      w.wormtongue.crime({ kind: 'negligence', severity: 0.2, reportTo: 'watch' });
      w.wormtongue.crime({ kind: 'murder', severity: 1, reportTo: 'watch' });
    }
    // Tomas's timber, and a barn to play in
    w.action({ id: 'fetch_timber', label: 'fetching timber', tell: { did: 'fetched timber from {place}' }, at: 'barn', minutes: 15, rank: -1, pose: 'work', tags: ['work'] });
    w.action({ id: 'play_barn', label: 'playing in the barn', tell: { did: 'played in {place}', doing: 'was playing in {place}' }, at: 'barn', minutes: 40, relieves: { fun: 0.35 }, who: ['is:child'], tags: ['outdoors'], pose: 'play', palls: 'park' });
    // mischief: a snare by the barn door, as a prank
    w.action({ id: 'set_snare', label: 'setting a snare', tell: { did: 'set a snare in {place}' }, at: 'barn', minutes: 10, base: 0.08, who: ['is:child', 'nature.humor>0.6'], if: ['has:snare'], then: ['take:snare', 'set:snare'], tags: ['harm', 'mischief'], pose: 'kneel', cooldown: DAY });
    // nightshade in the stew, when nobody's watching
    const unwatched = (ctx) => ctx.world.ring.present('cafe').every((id) => id === ctx.person.id);
    w.action({ id: 'eat_stew', label: 'a bowl of stew', tell: { did: 'had a bowl of stew at {place}' }, at: 'cafe', slot: 'seat', minutes: [25, 40], relieves: { hunger: [0.5, 0.7], company: 0.1 }, price: 5, store: 'here', uses: { stew: 1 }, pose: 'sit', tags: ['social', 'food'] });
    w.action({ id: 'dose_stew', label: 'stirring the stew', tell: { did: 'stirred something into the stew' }, at: 'cafe', minutes: 4, base: 0.12, who: ['trait.honesty<0.3'], if: ['has:nightshade', unwatched], then: ['take:nightshade', 'taint:nightshade.stew=2'], tags: ['harm', 'illegal'], pose: 'stand', cooldown: DAY });
    // a brawl at the Belt: a few drinks, and someone there they've a grudge against
    w.action({ id: 'pick_a_fight', label: 'picking a fight', tell: { did: 'picked a fight with {target}' }, target: 'person', at: 'tag:drink', minutes: 20, base: 0.15, who: ['under:ale'], targetIf: ['grudge>0.15'], interact: 'fight', tags: ['harm'], pose: 'stand', cooldown: DAY });
    // care, and getting away
    w.action({ id: 'tend', label: 'seeing to someone', tell: { did: 'saw to {target}' }, target: 'person', at: 'here', minutes: 20, base: 0.05, targetIf: ['target.hurt>0.05'], then: ['tend'], tags: ['care', 'social'], trains: { first_aid: 0.5 }, pose: 'kneel', cooldown: 2 * HOUR });
    w.action({ id: 'slip_home', label: 'slipping off home', tell: { did: 'slipped off home' }, at: 'home', minutes: 30, base: 0.01, if: ['fleeing>0'], tags: ['flee'], pose: 'sit' });
    // getting even: have it out with them, or spike their supper
    w.action({ id: 'confront', label: 'having it out', tell: { did: 'had it out with {target}' }, target: 'person', at: 'target', minutes: 15, rank: -1, interact: 'fight', tags: ['harm'], pose: 'stand' });
    w.action({ id: 'spike', label: 'spiking a supper', tell: { did: 'spiked {target}\'s supper' }, target: 'person', at: 'cafe', minutes: 5, rank: -1, if: ['has:nightshade'], then: ['take:nightshade', 'taint:nightshade'], tags: ['harm', 'illegal'], pose: 'stand' });
    w.action({ id: 'brood', label: 'brooding', tell: { did: 'brooded', doing: 'was brooding' }, at: 'home', minutes: 30, rank: -1, if: ['planning:avenge'], pose: 'sit' });
    w.task({ id: 'avenge', label: 'getting even', target: 'person', tags: ['harm'], cooldown: DAY, methods: [
      { name: 'have it out', if: ['odds>0.5'], do: [{ action: 'confront', target: 'target' }] },
      { name: 'spike their supper', if: ['has:nightshade'], do: [{ action: 'spike', target: 'target' }] },
      { name: 'let it lie', do: ['brood'] },
    ] });
    // Gaff paces it: now and then of an evening, the two at the Belt who like each other least come to blows
    if (gaff && w.bree) gaff.storylet({
      id: 'brawl', label: 'A brawl at the Belt', mtb: 6 * HOUR, cooldown: DAY, when: ['hour>=18'],
      fire: (world) => {
        const here = world.ring.present('bar').filter((id) => !world.morgul.isDown(id)).sort();
        let pair = null, low = Infinity;
        for (const a of here) for (const b of here) {
          if (a >= b) continue;
          const r = (world.fellowship ? world.fellowship.regard(a, b) + world.fellowship.regard(b, a) : 0) - world.bree.animosity(a, b) - world.bree.animosity(b, a);
          if (r < low) { low = r; pair = world.bree.animosity(b, a) > world.bree.animosity(a, b) ? [b, a] : [a, b]; }
        }
        if (pair) world.bree.start('fight', pair[0], pair[1]);
      },
    });
    if (cs) cs.addLines([
      { key: 'bree_fight_reply', topic: 'fight.reply', text: ['Get off me!', '*swings back*'] },
      { key: 'bree_fight_back', topic: 'fight.back', text: 'That\'s it, then.' },
    ]);
  }

  // ---- Strangers -------------------------------------------------------------
  w.strangers.define('main', {
    perHour: [0, 0, 0, 0, 0, 1, 2, 4, 6, 4, 3, 3, 5, 4, 3, 3, 4, 6, 5, 4, 3, 2, 1, 0],
    errands: [
      { from: 'station', to: 'cafe', action: 'eat_cafe', minutes: [20, 40], weight: 2, hours: [6, 21] },
      { from: 'station', to: 'market', minutes: [10, 20], weight: 2, hours: [8, 19] },
      { from: 'station', to: 'park', weight: 3 },
      { from: 'station', to: 'bar', action: 'drink', minutes: [40, 90], hours: [17, 2] },
    ],
    data: (r) => ({ coat: r.pick(['gray', 'navy', 'rust', 'olive']) }),
  });

  // ---- Irulan: the town's own words for its story (actions, feelings and kinds have their `tell`) ----
  const facts = {
    raining: ['rain set in', 'the rain stopped'],
    'closed:bar': ['the lights went out at the Belt', 'the power came back on at the Belt'],
  };
  w.irulan.words('fact', (e) => (facts[e.d.key] ? facts[e.d.key][e.d.value ? 0 : 1] : undefined));

  return w;
});
