# Recipes

Short worked examples to copy from. Most start from the small base world below: two apartments on a street, four needs, sleeping, eating in and reading. Add a recipe's code after it. The detective recipe uses Rocinante.

- [The base world](#the-base-world)
- [A shop with hours and a keeper on shift](#a-shop-with-hours-and-a-keeper-on-shift)
- [A bar regular](#a-bar-regular)
- [A household with a shared purse and pantry](#a-household-with-a-shared-purse-and-pantry)
- [A crime, witnesses, reports and heat](#a-crime-witnesses-reports-and-heat)
- [A rumor spreading, and a lie](#a-rumor-spreading-and-a-lie)
- [A plan with fallbacks and a get: chain](#a-plan-with-fallbacks-and-a-get-chain)
- [A festival storylet with a deck](#a-festival-storylet-with-a-deck)
- [A detective game](#a-detective-game)
- [A time-loop day](#a-time-loop-day)
- [A time-rewind ability for the player](#a-time-rewind-ability-for-the-player)
- [A language-model voice with Joi](#a-language-model-voice-with-joi)

## The base world

```js
const HOUR = 60, DAY = 1440;
const world = Tyrell.create({ seed: 'recipes', start: 6 * HOUR });

world.need({ id: 'hunger', rise: 0.06, start: 0.3 });
world.need({ id: 'energy', rise: 0.06, start: 0.2 });
world.need({ id: 'fun', rise: 0.05, start: 0.3, urgent: 1.1 });
world.need({ id: 'company', rise: 0.04, start: 0.3, urgent: 1.1 });

world.place({ id: 'apt_a', tags: ['home'], region: 'apartments', slots: { bed: 2 } });
world.place({ id: 'apt_b', tags: ['home'], region: 'apartments', slots: { bed: 2 } });
world.place({ id: 'street', region: 'street' });
world.link('apt_a', 'street', 3);
world.link('apt_b', 'street', 4);

const night = { name: 'night', input: 'hour', range: [0, 24], curve: [[0, 1], [6 / 24, 1], [8 / 24, 0.1], [21 / 24, 0.3], [23 / 24, 1], [1, 1]] };
world.action({ id: 'sleep', at: 'home', slot: 'bed', minutes: [420, 480], relieves: { energy: 0.95 }, rates: { hunger: 0.4 }, tags: ['sleep'], pose: 'sleep', considerations: [night] });
world.action({ id: 'eat_in', at: 'home', minutes: 30, relieves: { hunger: 0.6 }, pose: 'sit' });
world.action({ id: 'read', at: 'home', minutes: 60, relieves: { fun: 0.2 }, base: 0.02, pose: 'sit' });
```

`rates: { hunger: 0.4 }` makes hunger rise at 40% of its rate while asleep, so people don't wake starving.

## A shop with hours and a keeper on shift

Mo's grocery opens at 8. Mo opens up at 7, minds the till on her shift, and gets paid for what she sells. Ana shops at 10.

```js
world.place({ id: 'grocery', name: "Mo's", tags: ['shop'], region: 'street', hours: [8, 20], slots: { till: 1 },
  owner: 'mo', stock: { food: 30 }, restock: { food: [10, 4] } });
world.link('street', 'grocery', 1);

// work: rank -1 (only when required) and job: 'grocer' (so Mo is let in before it opens)
world.action({ id: 'open_up', label: 'opening up', at: 'grocery', minutes: 20, job: 'grocer', rank: -1, pose: 'work' });
world.action({ id: 'mind_till', label: 'at the till', at: 'grocery', slot: 'till', minutes: 60, job: 'grocer', rank: -1, pose: 'work', tags: ['work'] });
// customers
world.action({ id: 'buy_food', label: 'shopping', at: 'tag:shop', minutes: 10, price: 4, buys: { food: 2 }, pose: 'stand' });
world.action({ id: 'cook', label: 'cooking', at: 'home', minutes: 30, uses: { food: 1 }, relieves: { hunger: 0.6 }, pose: 'sit' });

world.person('mo', {
  name: 'Mo', home: 'apt_a', vars: { money: 50 },
  job: { id: 'grocer', place: 'grocery', action: 'mind_till', shifts: [[7.5, 20]], days: [0, 1, 2, 3, 4, 5] },
  routine: [[7, 'grocery', 'open_up'], [7.5, null, '*'], [22.5, 'home', 'sleep']],
});
world.person('ana', {
  name: 'Ana', home: 'apt_b', vars: { money: 30 },
  routine: [[7, null, '*'], [10, 'tag:shop', 'buy_food'], [10.25, null, '*'], [23, 'home', 'sleep']],
});

world.advanceTo(DAY + 12 * HOUR);
console.log(world.westmarch.chronicle('mo', DAY).join('\n'));   // opening up at 7, at the till from 7:30
console.log(world.ceres.stock('grocery', 'food'), world.get('mo').vars.money);
console.log(world.whyNot('ana', 'mind_till'));                    // "grocery: needs the job 'grocer'"
```

What makes it work:

- The shop's `hours` keep customers out before 8; the work actions' `job` lets Mo in.
- The job requires `mind_till` at rank 2 from 7:30 to 20:00, so only a desperate need takes her off it; `mind_till` fills the shift. On day 6, the job's `days` leave it out, and her routine's free time takes over.
- The routine's `open_up` at 7:00 runs until 7:30 (the next entry), then the shift starts.
- `price` goes to the owner, `buys` takes from the stock, `restock` tops it up every 4 hours.

## A bar regular

Ruth goes to the Belt at seven on weekdays and stays until half past nine; at weekends it's her own time; when it rains she stays in. Ines greets her regulars differently.

```js
world.place({ id: 'bar', name: 'The Belt', tags: ['drink', 'social'], region: 'street', hours: [17, 2], slots: { stool: 6, taps: 1 }, owner: 'ines' });
world.link('street', 'bar', 2);
world.action({ id: 'drink', label: 'a drink at the Belt', at: 'tag:drink', slot: 'stool', minutes: [60, 120], relieves: { fun: 0.4, company: 0.35 }, price: 5, pose: 'sit', tags: ['social'] });
world.action({ id: 'pour', label: 'behind the bar', at: 'bar', slot: 'taps', minutes: 60, job: 'bartender', rank: -1, pose: 'work' });

world.fellowship.group({ id: 'regulars', kind: 'club', label: "the Belt's regulars" });
world.person('ines', { name: 'Ines', home: 'apt_a', job: { id: 'bartender', place: 'bar', action: 'pour', shifts: [[17, 1]], wage: 9 }, routine: [[2, 'home', 'sleep'], [10, null, '*']] });
world.person('ruth', {
  name: 'Ruth', home: 'apt_b', groups: ['regulars'], vars: { money: 60 },
  routine: [
    { days: [5, 6], plan: [[8, null, '*'], [23, 'home', 'sleep']] },
    { when: ['fact:raining'], plan: [[8, null, '*'], [22, 'home', 'sleep']] },
    { plan: [[8, null, '*'], [19, 'bar', 'drink'], [21.5, null, '*'], [23, 'home', 'sleep']] },
  ],
});

// happy hour: drinking is more tempting for regulars, and the room's a little brighter
world.cityspeak.practice({ id: 'happy_hour', at: 'bar', hours: [19, 21], roles: { regular: { who: ['member:regulars'], actions: ['drink'] } }, tone: 0.05 });
world.cityspeak.line({ key: 'usual', topic: 'greet', who: 'job:bartender', to: ['target.member:regulars'], text: 'The usual?' });
world.cityspeak.line({ key: 'hello', topic: 'greet', text: 'Evening.' });

world.advanceTo(19 * HOUR + 30);
world.get('ruth').doing;                                         // drink at the bar, routine, until 21:30
world.cityspeak.choose('ines', { topic: 'greet', to: 'ruth' });  // 'The usual?'
world.cityspeak.choose('ines', { topic: 'greet', to: 'mo' });    // 'Evening.'
```

What makes it work:

- A routine entry that names an action stretches it to the next entry: `drink` lasts from 19:00 to 21:30 whatever its own `minutes`.
- Variants are tried in order: the weekend days first, then rain, then the usual plan. The rain variant is checked whenever her routine is read, so she notices at her next decision.
- At weekends the practice still makes a drink tempting, so she may well go anyway: her own choice, at need rank.
- The line with `who` and `to` conditions is more specific than the plain greeting, so it wins whenever it matches.

## A household with a shared purse and pantry

The Okafors share one purse and one cupboard: Mara shops, and Pip eats what she bought.

```js
world.place({ id: 'grocery', tags: ['shop'], region: 'street', hours: [8, 20], stock: { food: 30 }, restock: { food: [10, 4] } });
world.link('street', 'grocery', 1);
world.action({ id: 'buy_food', at: 'tag:shop', minutes: 10, price: 8, buys: { food: 2 }, pose: 'stand' });
world.action({ id: 'cook', at: 'home', minutes: 30, uses: { food: 1 }, relieves: { hunger: 0.6 }, pose: 'sit' });

world.fellowship.group({ id: 'h_okafor', kind: 'household', label: 'the Okafors', purse: true });
world.person('mara', { name: 'Mara', home: 'apt_a', groups: ['h_okafor'], routine: [[7, null, '*'], [9, 'tag:shop', 'buy_food'], [9.25, null, '*'], [23, 'home', 'sleep']] });
world.person('pip', { name: 'Pip', home: 'apt_a', groups: ['h_okafor'], tags: ['child'] });

if (!world.kept('setup:okafor')) {                 // once, not on every load
  world.ceres.pay('world', 'h_okafor', 100, 'savings');
  world.ceres.income('mara', 50, 7);               // paid into her purse, which is the household's
  world.keep('setup:okafor', true);
}

world.ceres.money('pip');                          // 100: the household's purse
world.advanceTo(10 * HOUR);
world.ceres.pantry('h_okafor');                    // { food: 2 }: Mara's shopping
world.have(world.get('pip'), 'food');              // 2: Pip can cook with it
```

What makes it work:

- A group of kind `'household'` with `purse: true` shares money: prices come out of it, wages and incomes go into it.
- Goods bought by any member go into the pantry; `has:food`, `uses` and `world.have` count it for every member.
- In conditions, `purse` reads the household's money; `money` reads only the person's own variable.

## A crime, witnesses, reports and heat

The player strips the grocery's till in front of Mo and Ana. Mo knows the player; Ana doesn't. The game pays Ana off before she talks.

```js
world.place({ id: 'grocery', tags: ['shop'], region: 'street', hours: [8, 20] });
world.link('street', 'grocery', 1);
world.action({ id: 'browse', at: 'grocery', minutes: 30, base: 0.05 });
world.fellowship.group({ id: 'watch', kind: 'authority', label: 'the Watch' });
world.wormtongue.crime({ kind: 'strip', severity: 0.6, reportTo: 'watch' });
world.deed('fixed', { feeling: 'helped', regard: 0.2, memory: 6 });

world.person('mo', { name: 'Mo', home: 'apt_a', traits: { courage: 0.6, honesty: 0.8, greed: 0.3 } });
world.person('ana', { name: 'Ana', home: 'apt_b', traits: { courage: 0.3, honesty: 0.3, greed: 0.8 } });
world.person('vance', { name: 'Officer Vance', home: 'apt_b', groups: ['watch'] });
world.advanceTo(10 * HOUR);
world.direct('mo', { do: 'browse', at: 'grocery', until: 13 * HOUR, repeat: true });
world.direct('ana', { do: 'browse', at: 'grocery', until: 13 * HOUR, repeat: true });
world.advance(15);
world.did('player', 'fixed', { for: 'mo', what: 'radio' });   // now Mo knows the player

world.on('witnessed', (e) => console.log(e.id, e.recognized ? 'saw the player' : 'saw someone'));
world.on('report', (r) => console.log(`${r.witness} reported ${r.actor}: heat ${r.heat}`));
world.on('silenced', (e) => console.log(e.witness, e.ok ? 'took the money' : 'refused'));

// the game saw the strip, and works out who could see it
world.sense({ kind: 'strip', actor: 'player', what: 'till', place: 'grocery', seenBy: ['mo', 'ana'] });
world.wormtongue.silence('ana', 'player', 'pay', 40);         // take the 40 from the player yourself

world.advance(2 * HOUR);
world.wormtongue.heat('player');
world.fellowship.standing('watch', 'player');                 // infamy with the Watch
world.reverie.belief('vance', 'did:player:strip');            // the Watch knows, if a report reached it
world.wormtongue.witnesses('player');
```

What happens:

- Mo knows the player (a file from the deed), so he recognizes them for sure; Ana recognizes a stranger half the time. Each believes `did:player:strip` = `'till'` (or `did:someone:strip`), as seen, with a memory and the `witnessed` feeling.
- Mo, if he recognized the player, reports with a chance from the crime's `report`, his lawfulness and courage, and how much he likes the player. A report comes 10 to 90 minutes later: heat, infamy with the Watch, and every member of the Watch believes it.
- Ana takes the money with a chance from her greed, the amount and her honesty. If she does, her beliefs about the player are silenced: no gossip, no report. If she only saw "someone", there's nothing to silence.
- Gossip can carry what Mo saw to the Watch even if he doesn't report: a Watch member who hears of a crime takes it as a report.
- Heat fades to 85% each day.

## A rumor spreading, and a lie

Regulars meet at the cafe every morning. Kofi has heard Ines is engaged; Sam saw Ruth take some bread, and Sam is a liar who can't stand Ruth or Dev.

```js
world.place({ id: 'cafe', tags: ['social'], region: 'street', hours: [7, 22], slots: { seat: 8 } });
world.link('street', 'cafe', 2);
world.action({ id: 'coffee', at: 'cafe', slot: 'seat', minutes: [40, 90], relieves: { company: 0.4, fun: 0.1 }, tags: ['social'], pose: 'sit' });
const regular = (id, traits) => world.person(id, { home: 'apt_a', traits, routine: [[8, null, '*'], [10, 'cafe', 'coffee'], [12, null, '*'], [23, 'home', 'sleep']] });
regular('sam', { honesty: 0.1, talkative: 0.9 });
regular('lena', { honesty: 0.9, talkative: 0.5 });
regular('kofi', { honesty: 0.6, talkative: 0.7 });
regular('ruth', { honesty: 0.9, talkative: 0.8 });
regular('dev', { honesty: 0.7, talkative: 0.4 });

world.wormtongue.crime({ kind: 'theft', severity: 0.4 });
world.fellowship.adjust('sam', 'ruth', -0.8);
world.fellowship.adjust('sam', 'dev', -0.5);
world.reverie.believe('sam', 'did:ruth:theft', 'bread', 'saw');           // what Sam saw
world.reverie.believe('kofi', 'engaged:ines', true, 'told', 'ines', 0.9); // a rumor

world.on('told', (e) => console.log(`${e.from} -> ${e.to}: ${e.key} = ${e.v}${e.lie ? ' (a lie)' : ''}`));
world.advance(2 * DAY);
world.reverie.beliefs('lena');   // what Lena believes now, who told her, how strongly, how many hops
```

What happens:

- When two people meet, each may pass on one belief, the juiciest they hold that the other doesn't (a crime first), weakened by how much the listener trusts the teller, one hop further. After three hops it stops.
- Sam is dishonest and dislikes Ruth, so when he passes on `did:ruth:theft` he may lie: he shifts the blame onto someone else he dislikes, and his listeners hear `did:dev:theft` (still `'bread'`). If he disliked nobody else, he'd pass on the truth.
- Each listener's belief records who told them (`from`) and how many hops it came, so a game can trace a rumor back. The truth is a fact the game sets (`world.fact('did:ruth:theft', 'bread')`), and `reverie.accurate(id, key)` compares.

## A plan with fallbacks and a get: chain

Ruth's radio is broken. She'll take it to the workshop if she thinks it's open, or buy another if she can afford it, or do without. Later she wants an antenna, which needs wire from the scrapyard.

```js
world.place({ id: 'workshop', tags: ['repairs'], region: 'street', hours: [8, 18] });
world.place({ id: 'market', tags: ['shop'], region: 'street', hours: [8, 19], stock: { radio: 2 } });
world.place({ id: 'yard', tags: ['scrap'], region: 'street' });
world.link('street', 'workshop', 4); world.link('street', 'market', 2); world.link('street', 'yard', 6);

world.action({ id: 'repair_service', at: 'tag:repairs', minutes: 20, price: 15, uses: { broken_radio: 1 }, gives: { radio: 1 } });
world.action({ id: 'buy_radio', at: 'market', minutes: 10, price: 40, buys: { radio: 1 } });
world.action({ id: 'scavenge', at: 'tag:scrap', minutes: 30, gives: { wire: 1 } });
world.action({ id: 'make_antenna', at: 'home', minutes: 20, if: ['has:wire'], uses: { wire: 1 }, gives: { antenna: 1 } });
world.action({ id: 'tune_in', at: 'home', minutes: 60, if: ['has:radio', 'has:antenna'], relieves: { fun: 0.4 }, pose: 'sit' });
world.action({ id: 'shrug', minutes: 1, then: ['take:broken_radio'] });

world.task({
  id: 'fix_radio', relieves: { fun: 0.3 }, base: 0.05, if: ['has:broken_radio'], cooldown: 12 * HOUR,
  methods: [
    { name: 'take it in', if: ['thinks:open:workshop'], do: ['repair_service'] },
    { name: 'buy another', if: ['money>=60'], do: ['get:radio'] },
    { name: 'do without', do: ['shrug'] },
  ],
});
world.task({ id: 'rig_antenna', base: 0.2, if: ['has:radio', '!has:antenna'], methods: [{ do: ['get:antenna', 'tune_in'] }] });

world.advanceTo(9 * HOUR);                                          // the shops are open
world.person('ruth', { name: 'Ruth', home: 'apt_b', vars: { money: 100 }, inv: { broken_radio: 1 } });
world.fact('closed:workshop', true);                                 // shut today...
world.reverie.believe('ruth', 'open:workshop', true, 'assumed');    // ...but Ruth thinks it's open

world.on('planned', (e) => console.log(e.task, e.ok ? 'done' : 'gave up: ' + e.why));
world.direct('ruth', { do: 'fix_radio' });
world.advance(6 * HOUR);
world.westmarch.find({ who: 'ruth', k: ['planned', 'failed', 'replanned', 'route', 'done-plan'] });
world.reverie.belief('ruth', 'open:workshop');   // false: she found out
world.get('ruth').inv;                           // a radio, and an antenna
```

What happens:

1. The first method's condition reads her belief: she thinks the workshop is open, so she walks there.
2. It's shut. The step fails, she now believes `open:workshop` is false (seen), and the plan replans: the next method.
3. `get:radio` finds the cheapest way to get a radio: buying one at the market (`buy_radio` buys it). She buys it.
4. With a radio and no antenna, `rig_antenna` is now a free choice for her. `get:antenna` chains: `make_antenna` needs wire (`has:wire`), so the route is `scavenge`, then `make_antenna`, then `tune_in`.

`fix_radio` has `relieves` and `base`, so it's also a free choice, and a free choice can come at a bad hour. Added at 6:00 instead of 9:00, Ruth picks it herself before anything opens: the workshop is shut (by its hours), `get:radio` finds no open shop, and the last method, doing without, throws the radio away. Give tasks like this conditions on the hour (`if: ['has:broken_radio', 'hour>=8']`), or make them `rank: -1` and start them by directive or routine.

## A festival storylet with a deck

About every other day, at a quiet time, something happens in the square: a street party, lantern night or market day, never the same twice running.

```js
world.place({ id: 'square', tags: ['outdoors', 'social'], region: 'street' });
world.link('street', 'square', 2);
world.action({ id: 'dance', at: 'square', minutes: 60, relieves: { fun: 0.5, company: 0.3 }, tags: ['social'], pose: 'dance', if: ['fact:festival'] });
world.action({ id: 'watch_lanterns', at: 'square', minutes: 45, relieves: { fun: 0.3 }, pose: 'stand', if: ['fact:lanterns'] });
for (const id of ['ana', 'bo', 'cy']) world.person(id, { home: 'apt_a', routine: [[7, null, '*'], [23, 'home', 'sleep']] });

const gaff = world.gaff;
// the trigger: when it comes up, a card is drawn from the deck and fired instead
gaff.storylet({ id: 'festival_season', mtb: 2 * DAY, phase: ['build', 'relax'], deck: 'festivals', fire: () => {} });
gaff.deck('festivals', ['street_party', 'lantern_night', 'market_day']);
// the cards: mtb Infinity so they only come from the deck; each with its own cooldown
gaff.storylet({ id: 'street_party', label: 'A street party', mtb: Infinity, cooldown: 3 * DAY, bump: 0.5, fire: (w) => {
  w.fact('festival', true);
  w.at(w.now + 6 * HOUR, 'festival-over');
} });
gaff.storylet({ id: 'lantern_night', label: 'Lantern night', mtb: Infinity, cooldown: 3 * DAY, when: ['hour>=17'], bump: 0.3, fire: (w) => {
  w.fact('lanterns', true);
  w.at(w.now + 4 * HOUR, 'lanterns-out');
} });
gaff.storylet({ id: 'market_day', label: 'Market day', mtb: Infinity, cooldown: 3 * DAY, bump: 0.2, fire: (w) => {
  w.fact('market_day', true);
  w.at(w.now + 8 * HOUR, 'market-over');
} });
world.on('timer:festival-over', () => world.fact('festival', false));
world.on('timer:lanterns-out', () => world.fact('lanterns', false));
world.on('timer:market-over', () => world.fact('market_day', false));
world.on('director', (e) => console.log(`day ${world.day}, ${Math.floor(world.hour)}:00: ${e.label}`));

world.advance(10 * DAY);
```

What makes it work:

- Every hour, `festival_season` fires with probability `1 - exp(-60 / mtb)` while it's in phase. It has a deck, so a card is drawn and the card's storylet fires instead (if the card is eligible: lantern night waits for the evening; a drawn card that isn't eligible is used up).
- Each card has a cooldown of its own. A `cooldown` on `festival_season` would space out festivals of any kind.
- `fire` runs inside the simulation, so it sets facts and timers directly through the API; a rewind replays it exactly. The timers' listeners are game code: their `world.fact` calls are recorded after the timer event, and replay at the same point.
- Actions gated on the facts (`if: ['fact:festival']`) become possible while they last.

## A detective game

A theft at the market. The detective asks around: who believes what, who told them, and is it true? Then they replay the suspect's morning with Esper and come back to the present unchanged. This uses Rocinante.

```js
const world = buildRocinante(Tyrell, { start: 8 * 60, esper: { keep: 2 * 1440 } });

// the truth, as a fact, whenever anyone steals (a function effect runs inside the simulation)
world.action({ ...world.actions.get('steal_food'), then: [(ctx) => { ctx.world.s.facts['did:' + ctx.person.id + ':theft'] = true; }] });
world.setVar('sam', 'money', 0);           // broke: his dinner plan will steal
world.advanceTo(1440 + 9 * 60);           // the next morning

// who believes Sam stole, and where it came from
for (const p of world.people()) {
  const b = world.reverie.beliefRecord(p.id, 'did:sam:theft');
  if (b) console.log(p.name, b.src, b.from ?? '', 'hops', b.hops, 'strength', b.str, 'true?', world.reverie.accurate(p.id, 'did:sam:theft'));
}

// follow a told belief back to whoever saw it
function source(id, key, seen = new Set()) {
  const b = world.reverie.beliefRecord(id, key);
  if (!b || seen.has(id)) return null;
  if (b.src === 'saw' || !b.from) return id;
  seen.add(id);
  return source(b.from, key, seen) ?? b.from;
}

// replay the suspect's morning, then come back
world.esper.mark('present');
const morning = [];
for (let t = 8 * 60; t <= 14 * 60; t += 30) {
  world.seek(t);
  const b = world.body('sam');
  morning.push([t, b.action === 'travel' ? 'walking to ' + b.travel.to : b.action + ' at ' + b.place]);
}
world.esper.seekMark('present');           // nothing changed: same hash as before
```

What makes it work:

- **The truth is a fact.** Tyrell never decides what's true for the player; the game keeps it, here with an effect on the crime action. `reverie.accurate(id, key)` compares a belief with the fact.
- **Beliefs carry their source.** `src` (`'saw'` or `'told'`), `from`, `hops` and `str` let the detective weigh testimony: a first-hand account is stronger than a third-hand one, and a liar's version names the wrong person (see the rumor recipe).
- **Esper replays the past exactly.** Seeking back and forward with no inputs in between changes nothing, so the reconstruction can be shown to the player as a sequence of bodies (or with `world.westmarch.chronicle('sam', since)`). Esper's `keep` option must cover the time you want to look back over.
- **Questioning without changing anyone.** Reading beliefs and files changes nothing. A conversation that should leave a mark (they now know the detective asked) is an input: `world.reverie.believe(id, '@asked:theft', true, 'knew')` (the `@` keeps it out of gossip).

## A time-loop day

The same day, again and again: the player remembers, the town doesn't.

```js
const dawn = world.save();             // at dawn
const dusk = world.now + 17 * HOUR;
let loop = 1;

function frame(dt) {
  world.tick(dt);
  if (world.now >= dusk) {             // the day is over: back to dawn
    world.load(dawn);                  // the town, minute for minute as it was
    loop++;
    // the player's knowledge lives in the game, outside Tyrell: keep it
  }
}
```

What makes it work:

- **Determinism.** The same state and the same inputs give the same day. Unless the player does something different, everyone does exactly what they did last loop, which is what lets a player plan around them.
- **Loading drops the future.** After `load`, there's no recorded future to replay, so the player's actions from the last loop don't happen again.
- **Load from the frame loop or a listener.** From an event listener (a `timer:` handler, say), `load` (like `seek`) doesn't happen in the middle of the engine's work: it waits until the call that's running (the `tick`) returns, and the rest of that frame's events run first. So `world.at(dusk, 'dusk')` with `world.on('timer:dusk', () => world.load(dawn))` works too.
- With Esper instead of a save: `world.esper.mark('dawn')` at dawn, then `world.esper.seekMark('dawn')` and one new input (`world.keep('loop', loop)`) at the end of the day, again from the frame loop. Without that input, the player's recorded actions would replay as time ran forward. Esper's `keep` option must be longer than the loop.

## A time-rewind ability for the player

Hold a button to run time backward; let go to carry on from there, with whatever the player did after that point undone.

```js
world.config.minutesPerSecond = 2;
const player = { x: 100, level: 'street' };
const trail = [];                       // [time, the player's state]

function remember() {
  trail.push([world.now, { ...player }]);
  if (trail.length > 20000) trail.shift();
}
world.on('seek', ({ to }) => {          // put the player back where they were then
  let best = null;
  for (const [t, s] of trail) if (t <= to) best = s;
  if (best) Object.assign(player, best);
  while (trail.length && trail[trail.length - 1][0] > to) trail.pop();
});
world.on('esper:start', () => console.log("Can't go back any further."));

let rewinding = false;
function frame(dt) {
  if (!rewinding) { updatePlayer(dt); remember(); }
  world.tick(dt);
}
function holdRewind() { rewinding = true; world.speed = -15; }
function releaseRewind() {
  rewinding = false;
  world.speed = 1;
  world.keep('rewound-at', world.now);  // a new input: the old future is dropped (a 'branch' event)
}
```

What makes it work:

- A negative speed plays history backward a little each frame, as a small seek. Each frame emits `seek`, and a `step` for anyone in view whose doing changed: sprites stay where they are.
- The world rewinds itself; the player's own state is the game's, restored here from a trail keyed by game time.
- Letting go makes an input, which branches: the player's recorded actions after this point are dropped instead of replaying.
- Esper's `keep` option bounds how far back the player can go; `esper:start` says when they hit the limit.

## A language-model voice with Joi

People speak in their own words, from what they feel and know, through a model the game's server calls. The written lines are the fallback.

```js
world.joi.voice = 'A rainy harbor town. People are wry, warm and a little nosy. One or two short sentences.';
world.joi.allow(['offers_job', 'refuses_service']);
world.joi.setProvider(async (req) => {
  const res = await fetch('/api/voice', {               // your server holds the API key
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system: req.system, prompt: req.prompt }),
  });
  if (!res.ok) throw new Error('voice failed');
  return res.json();                                    // { text, flags }
});

async function talkTo(id) {
  showBubble(id, '...');
  const spoken = await world.joi.speak(id, { topic: 'greet', to: 'player', timeoutMs: 2000 });
  showBubble(id, spoken.text || strings[spoken.key] || '');
  if (spoken.flags.includes('offers_job')) world.fact('job_offer:' + id, true);
  if (spoken.key) world.cityspeak.say(id, { topic: 'greet', to: 'player' });   // count the line (once, cooldown, then)
}
```

What makes it work:

- The prompt is built from the person's state: temperament, what they're doing, pressing needs, mood, feelings, strongest memories, regard for the listener and their file on them, and the written line. Labels on actions and feelings and text on memories make it read well.
- Joi never changes the world. Flags come back for the game to act on, through the API, like any input.
- Slow, failed or empty replies fall back to the written line, so the game keeps working offline.
