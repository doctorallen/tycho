// Rocinante: the sample town that ships with Tyrell, named for the ship in
// The Expanse. Ten people, a cafe, a market, a bar, a workshop, a clinic and
// a park. It's used by the tests and the Voight-Kampff runner, and it's the
// worked example the docs point to: every part of the engine appears here at
// least once.
//
// Plain JavaScript that works three ways: in a browser after dist/tyrell.js
// (it defines buildRocinante), with require() in Node, and with import.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.buildRocinante = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildRocinante(Tyrell, opts) {
  opts = opts || {};
  const HOUR = 60, DAY = 1440;
  const w = Tyrell.create({
    seed: opts.seed || 'rocinante',
    start: opts.start !== undefined ? opts.start : 6 * HOUR,
    modules: opts.modules,
    config: Object.assign({ minutesPerSecond: 1 }, opts.config || {}),
    esper: opts.esper,
    moduleConfig: { cradle: { autoPair: null } },
  });

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
  w.place({ id: 'cafe', name: 'Mara\'s Cafe', tags: ['food', 'social'], region: 'main', hours: [6, 21], slots: { seat: 8, counter: 1 }, owner: 'mara', stock: { bread: 30, flour: 12 }, restock: { flour: [8, 24] } });
  w.place({ id: 'market', name: 'The Market', tags: ['shop'], region: 'main', hours: [8, 19], slots: { till: 1 }, owner: 'dev', stock: { food: 40, radio: 2 }, restock: { food: [20, 6], radio: [1, 48] } });
  w.place({ id: 'bar', name: 'The Belt', tags: ['social', 'drink'], region: 'main', hours: [17, 2], slots: { stool: 6, bar: 1 }, owner: 'ines' });
  w.place({ id: 'park', name: 'Ring Park', tags: ['outdoors', 'fun', 'social'], region: 'main', slots: { bench: 6 } });
  w.place({ id: 'workshop', name: 'Tomas\'s Workshop', tags: ['work', 'repairs'], region: 'river', hours: [8, 18], slots: { bench: 2 }, owner: 'tomas' });
  w.place({ id: 'clinic', name: 'The Clinic', tags: ['care'], region: 'river', hours: [9, 17], slots: { desk: 1, chair: 3 } });
  w.place({ id: 'station', name: 'Tram Station', tags: ['edge'], region: 'main' });
  for (const f of apartments) { w.link(f, 'park', 6); w.link(f, 'cafe', 8); }
  w.link('park', 'cafe', 3); w.link('cafe', 'market', 2); w.link('market', 'bar', 3); w.link('cafe', 'bar', 4);
  w.link('park', 'workshop', 9); w.link('workshop', 'clinic', 3); w.link('station', 'cafe', 5);

  // ---- actions --------------------------------------------------------------
  const night = { name: 'night', input: 'hour', range: [0, 24], curve: [[0, 1], [6 / 24, 1], [8 / 24, 0.12], [20 / 24, 0.3], [22.5 / 24, 1], [1, 1]] };
  const daylight = { name: 'daylight', input: 'hour', range: [0, 24], curve: [[0, 0.05], [7 / 24, 0.05], [9 / 24, 1], [19 / 24, 1], [21 / 24, 0.1], [1, 0.05]] };
  w.action({ id: 'sleep', label: 'sleeping', at: 'home', slot: 'bed', minutes: [420, 510], relieves: { energy: 0.95 }, rates: { hunger: 0.4, fun: 0.2, company: 0.2, hygiene: 0.5 }, tags: ['sleep'], pose: 'sleep', considerations: [night] });
  w.action({ id: 'nap', label: 'a nap', at: 'home', slot: 'bed', minutes: 60, relieves: { energy: 0.3 }, tags: ['sleep'], pose: 'sleep', cooldown: 6 * HOUR });
  w.action({ id: 'shower', at: 'home', slot: 'shower', minutes: 15, relieves: { hygiene: 0.85 }, pose: 'stand', feels: ['fresh'] });
  w.action({ id: 'read', label: 'reading', at: 'home', minutes: 60, relieves: { fun: 0.2 }, base: 0.02, pose: 'sit', tags: ['comfort'], trains: { lore: 0.5 }, palls: true });
  w.action({ id: 'eat_cafe', label: 'eating at the cafe', at: 'tag:food', slot: 'seat', minutes: [30, 45], relieves: { hunger: [0.5, 0.7], company: 0.1 }, price: 6, pose: 'sit', tags: ['social', 'food'], feels: ['good_meal'], store: 'here', uses: { bread: 1 } });
  w.action({ id: 'eat_home', label: 'eating at home', at: 'home', minutes: 25, relieves: { hunger: 0.55 }, uses: { food: 1 }, pose: 'sit', tags: ['food'] });
  w.action({ id: 'buy_food', label: 'shopping', at: 'market', minutes: 10, buys: { food: 2 }, price: 8, pose: 'stand' });
  w.action({ id: 'steal_food', label: 'pocketing food', at: 'market', minutes: 4, gives: { food: 1 }, tags: ['illegal'], against: ['honesty'], crime: 'theft', pose: 'stand' });
  w.action({ id: 'bar_snack', label: 'a bowl of noodles at the Belt', at: 'tag:drink', slot: 'stool', minutes: 20, relieves: { hunger: 0.45 }, price: 4, pose: 'sit', tags: ['food'] });
  w.action({ id: 'drink', label: 'drinking at the Belt', at: 'tag:drink', slot: 'stool', minutes: [60, 120], relieves: { fun: 0.4, company: 0.35 }, price: 5, pose: 'sit', tags: ['social'], palls: 'drink', then: ['afflict:ale'] });
  w.action({ id: 'walk', label: 'a walk in the park', at: 'park', minutes: 45, relieves: { fun: 0.3 }, tags: ['outdoors'], pose: 'walk', considerations: [daylight], palls: 'park' });
  w.action({ id: 'sit_park', label: 'sitting in the park', at: 'park', slot: 'bench', minutes: 40, relieves: { fun: 0.15, company: 0.15 }, tags: ['outdoors', 'social'], pose: 'sit', considerations: [daylight], palls: 'park' });
  w.action({ id: 'chat', label: 'chatting', target: 'person', at: 'here', minutes: 20, relieves: { company: 0.4, fun: 0.1 }, tags: ['social'], social: 'chat', pose: 'stand', cooldown: 30 });
  w.action({ id: 'help_out', label: 'helping out', target: 'person', at: 'here', minutes: 30, base: 0.04, relieves: { company: 0.2 }, deed: 'helped', tags: ['social'], targetIf: ['regard>0.2'], cooldown: DAY });
  w.action({ id: 'sulk', label: 'sulking', at: 'home', minutes: 120, pose: 'sit', rank: -1 });
  w.action({ id: 'bender', label: 'a bender', at: 'tag:drink', minutes: 240, relieves: { fun: 0.6 }, pose: 'sit', rank: -1 });
  // work: only done on shift (rank -1 means "only when required")
  // Mara bakes the cafe's bread from its flour, an hour at a time (fill: false), more of it the better she is
  w.action({ id: 'bake', label: 'baking', at: 'cafe', slot: 'counter', minutes: 60, fill: false, job: 'baker', rank: -1, pose: 'work', tags: ['work'], trains: { baking: 1 },
    store: 'here', uses: { flour: 1 }, makes: { bread: 2 }, yields: [{ input: 'skill.baking', out: [0.6, 1.4] }] });
  w.action({ id: 'fix', label: 'fixing things', at: 'workshop', slot: 'bench', minutes: 60, job: 'mechanic', rank: -1, pose: 'work', tags: ['work'], trains: { repair: 1 } });
  w.action({ id: 'serve', label: 'serving drinks', at: 'bar', slot: 'bar', minutes: 60, job: 'bartender', rank: -1, pose: 'work', tags: ['work'], relieves: { company: 0.15 } });
  w.action({ id: 'sell', label: 'minding the till', at: 'market', slot: 'till', minutes: 60, job: 'grocer', rank: -1, pose: 'work', tags: ['work'] });
  w.action({ id: 'treat', label: 'seeing patients', at: 'clinic', slot: 'desk', minutes: 60, job: 'doctor', rank: -1, pose: 'work', tags: ['work'] });
  w.action({ id: 'patrol', label: 'on patrol', at: 'park', minutes: 60, job: 'officer', rank: -1, pose: 'walk', tags: ['work'] });
  // the radio repair: a service, a purchase, or nothing
  w.action({ id: 'repair_service', label: 'getting a radio fixed', at: 'tag:repairs', minutes: 20, price: 15, uses: { broken_radio: 1 }, gives: { radio: 1 }, pose: 'stand', deed: 'paid' });
  w.action({ id: 'buy_radio', label: 'buying a radio', at: 'market', minutes: 10, price: 40, buys: { radio: 1 }, pose: 'stand' });
  w.action({ id: 'listen', label: 'listening to the radio', at: 'home', minutes: 60, relieves: { fun: 0.35 }, if: ['has:radio'], pose: 'sit', tags: ['comfort'] });
  w.action({ id: 'shrug', label: 'giving up on the radio', minutes: 1, then: ['take:broken_radio'] });

  // ---- skills: levels that grow with practice, at each person's own pace -----
  w.skill({ id: 'baking', label: 'Baking', rate: 0.01, levels: [[0.5, 'skilled'], [0.8, 'expert']] });
  w.skill({ id: 'repair', label: 'Repair', rate: 0.01, levels: [[0.5, 'skilled'], [0.8, 'expert']], decay: 0.004, floor: 0.2 });
  w.skill({ id: 'lore', label: 'Lore', rate: 0.03, diminish: 2 });

  // ---- pastimes that pall, and wishes and dreams ------------------------------
  w.pastime({ id: 'drink', label: 'the Belt' });
  w.pastime({ id: 'park', label: 'the park' });
  w.wish({ id: 'night_out', label: 'A night at the Belt', if: ['!is:child'], weight: [{ input: 'trait.talkative', out: [0.3, 1.2] }], toward: ['drink'], by: ['drink'] });
  w.wish({ id: 'fresh_air', label: 'Some fresh air', toward: ['tag:outdoors'], by: ['walk', 'sit_park'] });
  w.wish({
    id: 'catch_up', label: 'A good talk with a friend', minutes: 2 * DAY, toward: ['chat', 'help_out'], by: ['chat', 'help_out'],
    about: (ctx) => (ctx.world.fellowship ? ctx.world.fellowship.friends(ctx.person.id, 1)[0] : undefined),
  });
  w.wish({ id: 'master_baker', label: 'Become an expert baker', dream: true, if: ['job:baker'], toward: ['bake'], progress: (ctx) => ctx.world.skillOf(ctx.person.id, 'baking') / 0.8 });
  w.wish({ id: 'master_mechanic', label: 'Become a master mechanic', dream: true, if: ['job:mechanic'], toward: ['fix'], progress: (ctx) => ctx.world.skillOf(ctx.person.id, 'repair') / 0.8 });

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
    traits: { thrift: 0.6, honesty: 0.9, talkative: 0.7, courage: 0.6 }, values: { honesty: 0.8, family: 0.9 },
    skills: { baking: 0.62 }, talents: { baking: 1.2 },
    job: { id: 'baker', place: 'cafe', action: 'bake', shifts: [[6, 14]], wage: 0 },
    routine: [[5.5, 'home', 'shower'], [6, null, '*'], [14.25, 'market', 'buy_food'], [14.5, null, '*'], [22, 'home', 'sleep']],
  });
  w.person('tomas', {
    name: 'Tomas', home: 'apt_1', groups: ['h_okafor'], vars: { money: 60 },
    traits: { thrift: 0.4, honesty: 0.8, talkative: 0.3, courage: 0.7 }, values: { honesty: 0.6, craft: 0.9 },
    skills: { repair: 0.74 }, talents: { repair: 1.3 },
    job: { id: 'mechanic', place: 'workshop', action: 'fix', shifts: [[8, 17]], days: [0, 1, 2, 3, 4, 5], wage: 0 },
    routine: [[7, null, '*'], [17, 'tag:food', 'eat_cafe'], [18, null, '*'], [23, 'home', 'sleep']],
  });
  w.person('pip', {
    name: 'Pip', home: 'apt_1', groups: ['h_okafor'], born: -9 * 365 * DAY, tags: ['child'],
    traits: { talkative: 0.8, courage: 0.4, honesty: 0.7 },
    routine: [[7, 'home', '*'], [10, 'park', 'sit_park'], [11, null, '*'], [15, 'park', 'walk'], [16, null, '*'], [20.5, 'home', 'sleep']],
  });
  w.person('ines', {
    name: 'Ines', home: 'apt_2', groups: ['regulars'], vars: { money: 80 },
    traits: { thrift: 0.3, honesty: 0.6, talkative: 0.9, courage: 0.8 }, values: { honesty: 0.4 },
    job: { id: 'bartender', place: 'bar', action: 'serve', shifts: [[17, 1]], wage: 9 },
    routine: [[2, 'home', 'sleep'], [10, null, '*']],
  });
  w.person('dev', {
    name: 'Dev', home: 'apt_3', vars: { money: 90 },
    traits: { thrift: 0.8, honesty: 0.7, talkative: 0.5, greed: 0.6 }, values: { honesty: 0.5 },
    job: { id: 'grocer', place: 'market', action: 'sell', shifts: [[8, 16]], days: [0, 1, 2, 3, 4, 5], wage: 0 },
    routine: sleepNight,
  });
  w.person('ruth', {
    name: 'Ruth', home: 'apt_4', vars: { money: 100 }, inv: { broken_radio: 1 },
    traits: { thrift: 0.7, honesty: 0.9, talkative: 0.8, memory: 0.5 }, values: { honesty: 0.9, faith: 0.7 },
    routine: [
      { days: [6], plan: [[8, null, '*'], [11, 'park', 'sit_park'], [12, null, '*'], [22, 'home', 'sleep']] },
      { when: ['fact:raining'], plan: [[8, 'home', '*'], [22, 'home', 'sleep']] },
      { plan: [[8, null, '*'], [9.5, 'market', 'buy_food'], [9.75, null, '*'], [14, 'park', 'sit_park'], [15, null, '*'], [18, 'tag:food', 'eat_cafe'], [19, null, '*'], [22, 'home', 'sleep']] },
    ],
  });
  w.person('kofi', {
    name: 'Kofi', home: 'apt_5', vars: { money: 25 },
    traits: { thrift: 0.5, honesty: 0.6, talkative: 0.6, courage: 0.5 }, values: { honesty: 0.5 },
    talents: { lore: 1.5 }, instincts: { walk: 1.25, read: 1.2 },   // a student who'd rather be outdoors
  });
  w.person('lena', {
    name: 'Lena', home: 'apt_5', vars: { money: 150 }, groups: ['regulars'],
    traits: { thrift: 0.5, honesty: 0.9, talkative: 0.4, courage: 0.6 }, values: { honesty: 0.8 },
    job: { id: 'doctor', place: 'clinic', action: 'treat', shifts: [[9, 17]], days: [0, 1, 2, 3, 4], wage: 20 },
    routine: [[7, 'home', 'shower'], [7.5, null, '*'], [23, 'home', 'sleep']],
  });
  w.person('sam', {
    name: 'Sam', home: 'apt_3', vars: { money: 4 },
    traits: { thrift: 0.2, honesty: 0.15, talkative: 0.7, courage: 0.7, greed: 0.8 }, values: { honesty: 0.05 },
  });
  w.person('vance', {
    name: 'Officer Vance', home: 'apt_2', groups: ['watch'], vars: { money: 100 },
    traits: { thrift: 0.5, honesty: 0.8, talkative: 0.5, courage: 0.9, lawful: 0.9 }, values: { honesty: 0.7, law: 0.9 },
    job: { id: 'officer', place: 'park', action: 'patrol', shifts: [[10, 18]], wage: 15 },
    routine: [[7, null, '*'], [18, 'tag:food', 'eat_cafe'], [19, null, '*'], [23, 'home', 'sleep']],
  });
  // Kofi and Sam have no routine at all: their needs run their days

  // ---- Reverie: feelings, breaks, memories ----------------------------------
  const rv = w.reverie;
  if (rv) {
    rv.feeling({ id: 'good_meal', label: 'A good meal', weight: 0.08, minutes: 4 * HOUR, emotion: 'happy' });
    rv.feeling({ id: 'fresh', label: 'Freshly showered', weight: 0.05, minutes: 3 * HOUR, emotion: 'happy' });
    rv.feeling({ id: 'lonely', label: 'Lonely', weight: -0.1, minutes: 12 * HOUR, emotion: 'sad', boost: { social: 1.5 } });
    rv.breakdown({ id: 'sulk', level: 'minor', do: 'sulk', label: 'sulking at home' });
    rv.breakdown({ id: 'bender', level: 'major', do: 'bender', label: 'a bender', weight: [{ input: 'trait.courage', out: [0.3, 1.5] }] });
    rv.breakdown({ id: 'walkout', level: 'extreme', do: 'walk', label: 'walking it off' });
    rv.memoryKind({ id: 'saw:theft', importance: 6, shifts: { honesty: 0.05 } });
    rv.memoryKind({ id: 'helped', importance: 6, shifts: { talkative: 0.03 } });
  }

  // ---- deeds: what doing something for (or to) someone means -----------------
  w.deed('helped', { feeling: 'helped', regard: 0.15, memory: 6, sentiment: 'helped me out' });
  w.deed('fixed', { feeling: 'helped', regard: 0.2, memory: 6, fame: 0.05 });
  w.deed('cheated', { feeling: 'wronged', regard: -0.3, memory: 7, infamy: 0.1 });
  w.deed('paid', { regard: 0.02 });

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
    cs.practice({ id: 'dinner', at: 'cafe', hours: [17, 21], roles: { cook: { job: 'baker', actions: ['bake'] }, diner: { actions: ['eat_cafe', 'chat'] } }, tone: 0.05 });
    cs.practice({ id: 'last_orders', at: 'bar', hours: [0, 1], roles: { drinker: { actions: ['drink'] } }, boost: 1.3 });
    cs.act({ id: 'chat', accept: [{ name: 'regard', input: 'regard', range: [-1, 1], out: [0.2, 1] }], feelings: { refused: 'lonely' }, regard: [0.03, -0.02] });
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
    athelas.course({ id: 'ale', label: 'A few drinks', again: 'extend', phases: [
      { id: 'merry', label: 'merry', minutes: 180, rates: { energy: 1.3 }, weigh: { 'tag:work': 0.7, chat: 1.3 } },
      { id: 'sore_head', label: 'a sore head', minutes: 360, weigh: { nap: 1.5, 'tag:social': 0.8 } },
    ] });
    athelas.course({
      id: 'cold', label: 'A cold', tags: ['illness'], immunity: 5 * DAY,
      contagion: { chance: 0.05, resist: [{ name: 'courage', input: 'trait.courage', out: [1.3, 0.7] }] },
      phases: [
        { id: 'coming_on', label: 'coming on', minutes: [300, 540], spreads: false },
        { id: 'sniffles', label: 'the sniffles', minutes: [900, 1800], rates: { energy: 1.4 }, weigh: { nap: 2, sleep: 1.3, 'tag:outdoors': 0.5, '*': 0.85 } },
      ],
    });
    if (gaff) {
      // now and then someone comes down with a cold, and it goes round
      gaff.storylet({
        id: 'a_cold', label: 'A cold going round', mtb: 4 * DAY, cooldown: 2 * DAY,
        fire: (world) => { const who = world.worldStream('a_cold').pick(world.people().map((p) => p.id).sort()); if (who) world.athelas.afflict(who, 'cold'); },
      });
    }
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

  return w;
});
