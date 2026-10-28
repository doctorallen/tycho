# Ceres

Money and goods: each person's money or a household's shared purse, prices paid to whoever owns a place, stock that runs out and restocks, wages, rent and incomes, household pantries, and people who weigh prices by thrift. Named for The Expanse's station that lives on trade, water and air.

- [Money and purses](#money-and-purses)
- [Prices, wages and owners](#prices-wages-and-owners)
- [Goods and stock](#goods-and-stock)
- [The household pantry](#the-household-pantry)
- [Rent and incomes](#rent-and-incomes)
- [Affording things](#affording-things)
- [Production](#production)
- [State](#state)
- [API](#api)
- [Terms and effects](#terms-and-effects)
- [Events and log](#events-and-log)
- [With other modules](#with-other-modules)
- [Example](#example)

## Money and purses

A person's money is their variable `money` (`PersonDef.vars.money`, 0 by default). A household that shares a purse (Fellowship: a group of kind `'household'` with `purse: true`) has one purse instead, held by Ceres, and its members spend from it and are paid into it.

```js
world.fellowship.group({ id: 'h_okafor', kind: 'household', purse: true });
world.person('mara', { home: 'apt_1', groups: ['h_okafor'] });
world.person('pip', { home: 'apt_1', groups: ['h_okafor'] });
world.ceres.pay('world', 'h_okafor', 200, 'savings');
world.ceres.money('pip');      // 200: Pip spends from the household's purse
```

`ceres.money(id)` is what a person can spend: their household's purse if it shares one, else their own `vars.money`. It takes a person's id; to read a household's purse, ask about one of its members. In conditions, `purse` reads the same thing, while the core `money` term reads only the person's own variable.

Money moves with `pay` (an input) from the game, or `applyPay` inside the simulation. `'world'` stands for everything outside the simulation: paying `'world'` makes money vanish, and money from `'world'` appears. Any other id that isn't a person (a household, a business) gets a purse of its own. Nothing stops money going negative: a payment always goes through.

## Prices, wages and owners

```js
world.place({ id: 'cafe', tags: ['food'], owner: 'mara', slots: { seat: 8 } });
world.action({ id: 'eat_cafe', at: 'tag:food', slot: 'seat', minutes: 40, relieves: { hunger: 0.6 }, price: 6 });
world.action({ id: 'serve', at: 'bar', slot: 'taps', minutes: 60, job: 'bartender', rank: -1, wage: 9 });
```

- **Price.** An action's `price` is paid when it starts, from the person's purse to the place's `owner` (or `'world'`). An action they can't afford is ruled out ("can't afford 6").
- **Wage.** An action's `wage`, or the job's `wage` for the job's action, is paid per hour when the action ends (or stops), for the time actually spent, by the place's owner (or `'world'`) to the person. Nobody pays themselves: an owner working their own place earns nothing from it.

## Goods and stock

```js
world.ceres.good({ id: 'food', kind: 'food', price: 4, satisfies: { hunger: 0.2 } });
world.place({ id: 'market', tags: ['shop'], owner: 'dev', stock: { food: 40, radio: 2 }, restock: { food: [20, 6] } });
world.action({ id: 'buy_food', at: 'market', minutes: 10, price: 8, buys: { food: 2 } });
world.action({ id: 'eat_home', at: 'home', minutes: 25, relieves: { hunger: 0.55 }, uses: { food: 1 } });
```

`GoodDef`:

| Field | Meaning |
|---|---|
| `id` | The good's id, as used in `buys`, `uses`, `gives`, `has:`, inventories |
| `price` | Its price, read by the `price:<good>` term |
| `satisfies` | Needs it meets when used up: `{ hunger: 0.2 }` lowers hunger by 0.2 per unit when an action `uses` it, at the start |
| `kind` | A kind of good (`'food'`, `'part'`): the `goods:<kind>` term counts every good of that kind a person can use |
| `label` | A readable name: `world.describe` shows it for what people carry |

Goods don't have to be declared: any id works in `buys`, `uses` and `gives`. Declare a good to give it a price or `satisfies`.

- **`buys`**: when the action starts, the goods leave the place's stock and go to the person (or their household's pantry). Ruled out when the stock is short ("food sold out"). A place with no stock state at all doesn't limit buying.
- **`uses`**: when the action starts, the goods are used up (their own first, then the pantry), and `satisfies` applies. Ruled out when they don't have enough ("needs food").
- **`gives`**: when the action ends (not interrupted), the goods go to the person.
- An action can't buy and use the same good: `uses` is checked before anything is bought, so the action is ruled out. Use a price and `relieves` for something eaten on the spot, or split it into buying and using.
- **Restocking**: `restock: { food: [20, 6] }` adds 20 every 6 game hours (on the hours whose count since minute 0 divides by 6), up to the place's starting `stock` of it (or 20 if it had none).

The game can change stock with `ceres.restock(place, item, n)` (an input; negative removes) and goods a person carries with `world.give(id, item, n)`.

## The household pantry

In a household that shares a purse, goods bought by any member go into the household's pantry, and any member can use them. `world.have(person, item)` and the `has:` term count a person's own goods plus their pantry; using goods takes their own first.

```js
world.ceres.pantry('h_okafor');           // { food: 2 }
world.ceres.pantryCount('pip', 'food');   // 2
```

## Rent and incomes

```js
if (!world.kept('setup:money')) {            // set these up once, not on every load
  world.ceres.rent('kofi', 25, 7, 'dev');    // 25 every 7 days, to Dev
  world.ceres.income('ruth', 120, 7);        // a pension: 120 every 7 days, from the world
  world.keep('setup:money', true);
}
```

- **Rent** is first due at the midnight after `everyDays` days, then every `everyDays` days. If the person can spend enough, it's paid (to `to`, or `'world'`). If not, it's missed: a `rent` log entry, a `rent-missed` event, the `behind_on_rent` feeling (Reverie), and the landlord, if they're a person, believes `behind:<id>`.
- **An income** is paid at the next midnight, then every `everyDays` days, from `from` (or `'world'`), while the person is active.

Both are inputs that set up a standing arrangement in the state; calling them again replaces it. Since they're state, guard setup calls with `world.kept` so a loaded game doesn't set them up twice when the game declares after loading.

## Affording things

People weigh a price against what they can spend: an action with a price weighs `clamp(1 - share × (0.4 + thrift × 0.8) × prices, 0.05, 1)`, where `share` is the price over their money (at most 1), 0.4, 0.8 and 0.05 are `priceShare`, `priceThrift` and `priceFloor`, and `prices` is the headline knob (1; 0: price is no object, though they still can't buy what they can't afford). Thrifty people are put off more. Mentat's `get:` searches cost money the same way.

## Production

Goods that are made, one from another, in a store everyone works from: grain milled into flour, flour baked into bread, the bread eaten. This is Merryfolk's economy, generalized.

```js
world.place({ id: 'store', stock: { grain: 40, flour: 0, bread: 10 } });
world.action({ id: 'grind', at: 'mill', minutes: 60, job: 'miller', rank: -1, fill: false, store: 'store', uses: { grain: 2 }, makes: { flour: 2 } });
world.action({ id: 'bake', at: 'bakery', minutes: 60, job: 'baker', rank: -1, fill: false, store: 'store', uses: { flour: 1 }, makes: { bread: 4 },
  yields: [{ input: 'skill.baking', out: [0.6, 1.5] }], trains: { baking: 1 } });
world.action({ id: 'supper', at: 'store', minutes: 30, relieves: { hunger: 0.6 }, store: 'store', uses: { bread: 1 } });
world.ceres.chain({ id: 'bread', goods: ['grain', 'flour', 'bread'], store: 'store' });
```

- **`makes`** adds goods to a place's stock when the action ends: the `store`'s, or the place where it's done. Cut short, it makes that share of it (an hour's bake stopped at a quarter makes a quarter of the loaves); `yields` considerations multiply it (a skilled hand makes more). Stock can be fractional. `PlaceDef.stock` caps restocks, not what's made.
- **`store`** names the place whose stock the action works from: a place id, or `'here'` for the place it's done. With a store, `uses` comes out of that stock when it starts (and rules the action out, "no flour left at store", when there isn't enough) instead of out of the person's goods; it isn't eaten, so goods' `satisfies` doesn't apply. Without one, `uses` is the person's own, as always.
- **A steady output.** An action chosen by a job or routine stretches to fill the shift; one that makes something should usually have `fill: false`, so it makes its goods once per its own minutes, again and again, through the shift.

Once anything has `makes` or `store`, or a chain is declared, Ceres counts every change to every place's stock: made (what actions make, restocks, deliveries with `restock`) and used (what actions use from a store, what people buy, `restock` with a negative number). At midnight the day's figures become yesterday's, and Ceres emits `production` with the report; `ceres.production(place?)` gives it at any time:

```js
const r = world.ceres.production('store');
r.places.store.flour;    // { stock: 6, made: 10, used: 8, net: 2, days: null }
r.places.store.grain;    // { stock: 12, made: 0, used: 10, net: -10, days: 1.2 }: a day and a bit left
r.bottlenecks;           // [{ chain: 'bread', from: 'flour', to: 'bread', store: 'store', fromStock: 9, toStock: 0 }]
```

`days` is how long the stock would last if yesterday repeated (`null` unless it's running down). A chain's link is a **bottleneck** when its first good piles up while the next runs short: by default, the first has at least two days of what was used of it yesterday (and at least 2), and the next has less than a day's worth (or none). `plenty` and `short` set either line as a stock count instead (Merryfolk uses half and a sixth of a store's capacity). A chain without a `store` adds up every place's stock and flows. What to do about a bottleneck (more millers, a word on the board) is the game's.

| `ChainDef` field | Default | Meaning |
|---|---|---|
| `id` | required | |
| `label` | none | A readable name |
| `goods` | required | The goods, from the rawest to the finished |
| `store` | every place | The place whose stock it's judged by |
| `plenty` | two days' use, at least 2 | A good piles up at this much stock |
| `short` | under a day's use, at least 1 | A good is short at or under this much stock |

## State

In `world.s.mod.ceres`:

| Key | Holds |
|---|---|
| `purses` | Money by purse id (households, businesses, any non-person id) |
| `pantry` | Goods by household |
| `rent` | Rent arrangements by person: `{ amount, every, next, to? }` |
| `income` | Income arrangements by person (the payer in `to`) |
| `ledger` | The last 200 payments: `{ t, from, to, amount, why }` |
| `prod` | Only once production is on: `{ day, today, yesterday }`, each by place: `{ made?, used? }` by good |

Stock is in each place's state (`world.s.places[id].stock`); a person's own money and goods are in their state.

## API

`world.ceres`. **Input** methods are recorded and safe from the game.

| Method | Returns | |
|---|---|---|
| `good(def)` | this | Declares a good |
| `ofKind(person, kind)` | number | How many goods of a kind a person (a PersonState) can use |
| `money(id)` | number | What a person can spend |
| `purseOf(id)` | `{ kind, id }` | Where a person's money is: `'person'` or `'household'` |
| `pay(from, to, amount, why = 'paid')` | void | **Input.** Moves money (`'world'` for outside) |
| `rent(id, amount, everyDays = 7, to?)` | void | **Input.** Sets up rent |
| `income(id, amount, everyDays = 7, from?)` | void | **Input.** Sets up an income |
| `restock(place, item, n)` | void | **Input.** Adds (or removes) stock |
| `stock(place, item)` | number | Stock at a place |
| `pantry(household)` | object | A household's pantry (a copy) |
| `pantryCount(id, item)` | number | How many of an item are in a person's household pantry |
| `ledger(id?)` | array | Recent payments, or those from or to an id |
| `applyPay(from, to, amount, why)` | void | **Engine.** The direct version of `pay` (1.0 called it `transfer`) |
| `takeFromPantry(id, item, n)` | void | **Engine.** Takes goods from a pantry |
| `chain(def)` | this | Declares a production chain |
| `production(place?)` | ProductionReport | Stock, yesterday's made and used, days left, and the chains' bottlenecks |
| `producing()` | boolean | Whether stock flows are being counted (anything has `makes` or `store`, or there's a chain) |
| `storeOf(action, place)` | id or null | The place an action's `store` names, from where it's done |
| `goods`, `chains` | Map | The declared goods and chains |

## Terms and effects

Terms: `purse`, `price:<good>`, `stock:<place>.<item>` (or `stock:<item>` at the context's place), `afford:<n>`, `goods:<kind>`. Effect: `pay:<to>=n` (from the person's purse; `pay=n` pays the world). See [Conditions](../conditions.md#ceres).

## Events and log

| Event | Payload |
|---|---|
| `rent-missed` | `{ id, amount }` |
| `production` | The ProductionReport, each midnight once production is on |

Log entries: `rent` (`{ paid }` or `{ missed }`).

## Config

`Tyrell.create({ moduleConfig: { ceres: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `prices` | 1 | Headline knob: how much prices put people off. A person's own (`tune: { ceres: { prices } }`) multiplies it |
| `priceShare` | 0.4 | How much a price, as a share of what they have, weighs an option down... |
| `priceThrift` | 0.8 | ...more by this per point of thrift |
| `priceFloor` | 0.05 | ...never under this |

See [Tuning](../tuning.md#ceres); during play, `world.tune('ceres', { ... })`.

## With other modules

- **Fellowship**: households with `purse: true` share one purse and one pantry; a place's owner can be a household or a group.
- **Reverie**: missing rent gives `behind_on_rent`, and the landlord believes `behind:<id>`.
- **Mentat**: `get:` searches buy from stock and cost money by thrift; an unaffordable route is impossible.
- **Cradle**: with no partner or children to inherit, a departed person's money goes to their household's purse.
- **Skills**: `yields` can read `skill.<id>`, and the same action can `train` it.

## Example

```js
world.ceres.good({ id: 'noodles', price: 6 });
world.place({ id: 'stall', tags: ['food'], owner: 'h_okafor', stock: { noodles: 20 }, restock: { noodles: [10, 4] }, slots: { stool: 3 } });
world.link('stall', 'market', 1);
world.action({ id: 'slurp', at: 'stall', slot: 'stool', minutes: 20, price: 6, relieves: { hunger: 0.5 }, pose: 'sit' });       // eaten there
world.action({ id: 'take_away', at: 'stall', minutes: 5, price: 6, buys: { noodles: 1 } });                                          // for later
world.action({ id: 'eat_take_away', at: 'home', minutes: 15, uses: { noodles: 1 }, relieves: { hunger: 0.5 }, pose: 'sit' });

world.on('rent-missed', (e) => console.log(`${world.get(e.id).name} couldn't pay ${e.amount}`));
console.log(world.ceres.money('mara'), world.ceres.ledger('h_okafor'));
```
