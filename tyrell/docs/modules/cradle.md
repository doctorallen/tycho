# Cradle

The course of a life: ages and stages, couples, births with inherited traits, and departures with grief and inheritance. Named for Westworld's Cradle, where the hosts' minds are kept and new ones made.

The ideas come from Merryfolk's genetics (children who blend their parents' traits with a little of their own) and life simulations generally.

- [Ages and stages](#ages-and-stages)
- [Couples](#couples)
- [Births](#births)
- [Departures](#departures)
- [State](#state)
- [API](#api)
- [Terms, events and log](#terms-events-and-log)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Example](#example)

## Ages and stages

A person's age comes from `PersonDef.born` (a time in minutes, usually negative for people older than the world): `(now - born) / config.year`, in years. People without `born` are always 30.

```js
world.person('pip', { home: 'apt_1', born: -9 * 365 * 1440, tags: ['child'] });
world.cradle.age('pip');     // 9
world.cradle.stage('pip');   // 'child'
```

The stage is the last of `config.stages` whose starting age they've reached: by default baby (0), child (3), teen (13), adult (18), elder (65). Each midnight, Cradle notices stage changes and emits `stage` (not the first time it sees someone).

A game with short years (Merryfolk's year is 12 days) sets `year`:

```js
Tyrell.create({ moduleConfig: { cradle: { year: 12 * 1440, lifespan: [60, 80] } } });
```

## Couples

Partners are kept by Fellowship. Cradle pairs people:

- by the game: `cradle.pair(a, b)` (an input) makes them partners, gives each a 'my partner' sentiment (+0.3) and emits `paired`;
- on their own, each midnight, when `config.autoPair` is set: two adults or elders, neither with a partner, whose regard and attraction for each other both reach the thresholds (0.6 and 0.5 by default). Set `autoPair: null` to leave couples to the game.

## Births

Each midnight, every couple where both are within the fertile ages (20 to 42) has a child with probability `fertility / days in a year` (25% a year). People without `born` count as 30, so they're fertile. The game can make a birth happen with `cradle.birth(parents, def?, id?)`, an input that returns the child's id at once.

A child:

- gets an id: the one given, or `'born1'`, `'born2'`...;
- inherits every trait either parent has: the parents' average plus a draw in ±0.12, clamped to 0..1;
- gets a name from `cradle.namer(r, parents)` and the rest of its definition from `cradle.template(r, parents)` (both take the child's own stream `r`); `def` overrides both;
- lives at `def.home`, else the template's, else the first parent's home, and starts there;
- belongs to the groups in `def` and the template, and to each parent's household;
- is `born` now, tagged `'born'`;
- has each parent keep a 'my child' sentiment (+0.5) about it.

```js
world.cradle.namer = (r, parents) => r.pick(['Asha', 'Ben', 'Cleo', 'Dov']) + ' ' + parents[0].name.split(' ').pop();
world.cradle.template = (r, parents) => ({ data: { hair: r.pick(['black', 'red', 'brown']) } });
```

`namer` and `template` are definitions: set them on every start. They run during births in the simulation (and again in replays), so they must be deterministic: use `r`.

## Departures

```js
world.cradle.depart('tomas', 'died');
```

`depart(id, why)` (an input) takes someone out for good, with consequences:

1. **Grief.** Everyone active whose regard for them is 0.35 or more gets the `grief` feeling and a `loss` memory (importance by regard, 5 to 10).
2. **Inheritance.** Their own money goes to their partner and children (active ones), split equally, into their own money. With no heirs, it goes to their household's purse (with Ceres).
3. **Gone.** They're recorded as departed (`departed()`), and removed (`status: 'gone'`, the `gone` event).

Old age is a departure too: each midnight, people with `born` past `lifespan[0]` (72) may die, more likely the older they are, and almost surely past `lifespan[1]` (96).

`world.remove` takes someone out without grief or inheritance; Cradle still records them as departed.

## State

In `world.s.mod.cradle`:

| Key | Holds |
|---|---|
| `stage` | The last stage seen per person |
| `parents` | Parents by child |
| `departed` | By id: `{ name, born?, left, why }` |
| `next` | The counter for children's ids |

A person's `born` is in their state.

## API

`world.cradle`. **Input** methods are recorded and safe from the game.

| Method | Returns | |
|---|---|---|
| `age(id)` | number | Age in years |
| `stage(id)` | string | Life stage |
| `parents(id)` | id[] | Someone's parents |
| `children(id)` | id[] | Someone's children |
| `departed()` | object | Everyone who has left, by id |
| `pair(a, b)` | void | **Input.** Makes two people partners |
| `birth(parents, def = {}, id?)` | id | **Input.** A child is born; applies at once and returns the id |
| `depart(id, why = 'left')` | void | **Input.** Someone leaves for good |
| `namer` | function | `(r, parents) => string`: names newborns |
| `template` | function | `(r, parents) => PersonDef`: fills in newborns |
| `config` | | The config |

## Terms, events and log

Terms: `age`, `stage` / `stage:<name>`, `married`.

| Event | Payload |
|---|---|
| `paired` | `{ a, b }` |
| `born` | `{ id, parents }` |
| `stage` | `{ id, from, to }` |

Log entries: `paired`, `born`, `stage`.

## Config

`Tyrell.create({ moduleConfig: { cradle: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `year` | 525600 (365 days) | Minutes in a year |
| `stages` | `[['baby', 0], ['child', 3], ['teen', 13], ['adult', 18], ['elder', 65]]` | Stages and the age each starts at |
| `lifespan` | `[72, 96]` | People die of old age between these ages |
| `fertility` | 0.25 | Chance per year a couple of the right age has a child |
| `fertile` | `[20, 42]` | The ages at which people have children |
| `autoPair` | `{ regard: 0.6, attraction: 0.5 }` | Couples form on their own past these; `null` to leave it to the game |

## With other modules

- **Fellowship** keeps partners, so couples, automatic pairing and daily births need it; so do grief (by regard) and children joining their parents' household. Without it, `cradle.birth` still works, without the sentiments and households.
- **Reverie** gives grief and `loss` memories on a departure.
- **Ceres**: with no heirs, a departed person's money goes to their household's purse.

## Example

```js
const cradle = world.cradle;
cradle.namer = (r) => r.pick(['Juno', 'Ravi', 'Mei', 'Otto']);

const baby = cradle.birth(['mara', 'tomas']);
world.get(baby).def.traits;            // blended from Mara's and Tomas's
cradle.parents(baby);                  // ['mara', 'tomas']
world.fellowship.household(baby);      // 'h_okafor'

world.on('born', (e) => showToast(`${world.get(e.id).name} was born`));
world.on('gone', (e) => showToast(`${world.get(e.id).name} ${e.why}`));
```
