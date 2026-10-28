# Delos

Genomes: looks carried as dominant and recessive alleles, personality traits blended from both parents, talents (how fast each skill is learned) and instincts (inborn tastes for actions), with the odd mutation. Named for Westworld's Delos, the company that kept a copy of everyone who came to the parks and made new people from the copies.

The ideas come from Merryfolk's genetics (and Creatures' genome before it): children who look like one parent or the other, sometimes like a grandparent, and whose nature blends both with a little of their own.

- [Genes](#genes)
- [Blended values: traits, talents, instincts, looks](#blended-values-traits-talents-instincts-looks)
- [Founders](#founders)
- [Births](#births)
- [Mutations](#mutations)
- [State](#state)
- [API](#api)
- [Terms, events and log](#terms-events-and-log)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Example](#example)

## Genes

A gene has alleles, listed most dominant first. With two copies (the default), a child takes one copy from each parent, picked at random from the two that parent carries; what shows is the most dominant allele carried, so two brown-eyed parents who each carry blue can have a blue-eyed child. With `copies: 1`, the child takes one parent's copy whole (a hair color, a sex). `express` replaces dominance with any rule (codominance, a count).

```js
world.delos.gene({ id: 'eyes', alleles: ['brown', 'hazel', 'green', 'blue'], weights: [5, 2, 1.5, 2.5], mutate: 0.04 });
world.delos.gene({ id: 'freckles', alleles: ['plain', 'freckled'], weights: [3, 1] });    // recessive: freckled only with two copies
world.delos.gene({ id: 'chrome', alleles: ['chrome', 'plain'], weights: [1, 9] });        // dominant: one copy shows
world.delos.gene({ id: 'hair', alleles: ['auburn', 'black', 'flaxen', 'chestnut'], copies: 1, mutate: 0.06 });
world.delos.express('ana', 'eyes');      // 'brown'
world.delos.carries('ana', 'eyes', 'blue');
```

Looks are the game's to draw: `delos.looks(id)` gives every gene as it shows, and the continuous looks.

## Blended values: traits, talents, instincts, looks

Four kinds of value are blended from both parents, each declared with a `BlendDef`:

| Declared with | Written to | Read by | Defaults: founders, bounds, cross, noise |
|---|---|---|---|
| `delos.trait(def)` | `PersonDef.traits` | `trait.<id>`, every module that reads traits | `[0.1, 0.9]`, `[0, 1]`, 0.65, 0.1 |
| `delos.talent(def)` | `PersonDef.talents` | [skills](../deciding.md#skills-and-talents): how fast it's learned | `[0.6, 1.4]`, `[0.2, 2]`, 0.7, 0.08 |
| `delos.instinct(def)` | `PersonDef.instincts` | the weighing: the factor [`instinct`](../deciding.md#instincts) | `[0.8, 1.25]`, `[0.5, 1.5]`, 0, 0.1 |
| `delos.look(def)` | nothing (read with `looks`) | the game | `[0, 1]`, `[0, 1]`, 0.65, 0.1 |

A child's value is `one parent's × cross + the parents' average × (1 - cross)`, plus a draw within `±noise`, kept within `bounds` (and whole with `round`). The parent is picked at random for each value, so a child can take after either. `express` turns the genome's value into what the person gets: Merryfolk's aptitudes run 0 to 1 and mean learning at `0.4 + aptitude × 1.2` times the rate:

```js
world.delos.trait({ id: 'merriness', founders: [0.1, 0.95], bounds: [0.03, 1] });
world.delos.talent({ id: 'baking', founders: [0.15, 1], bounds: [0.05, 1], cross: 0.7, noise: 0.08, express: (a) => 0.4 + a * 1.2 });
world.delos.instinct({ id: 'fish', founders: [0.8, 1.25], bounds: [0.6, 1.4] });
world.delos.look({ id: 'skin', founders: [0, 5], bounds: [0, 5], cross: 0, noise: 0.7, round: true });
```

## Founders

Someone who joins without a genome (everyone at the start, travelers later) gets a founder's: each gene's copies drawn by `weights`, each value drawn from `founders`, from a stream of the world's seed and their id (so the same seed makes the same people). A trait, talent or instinct their definition already gives is kept as the genome's value, and left as it is; the rest are expressed into their definition. Declare Delos's definitions before adding people. `delos.set(id, part)` (an input) sets any part of someone's genome (an imported traveler's, a game's own founders') and writes what the values mean into their definition.

## Births

When anything is declared, Delos takes over Cradle's inheritance: a child born through `cradle.birth` (or Cradle's own daily births) gets a genome from its parents' (parents without one get a founder's first), and its definition gets the traits, talents and instincts it carries. Traits the parents have that Delos doesn't carry are still blended Cradle's way. With nothing declared, Cradle blends traits as it always has, and Delos keeps no state. A birth without parents gets a founder's genome.

## Mutations

Rare changes, kept in the genome's `mut` list and logged and emitted as `mutated`:

- a gene with `mutate`: with that chance per child (times the headline knob `mutation`), one copy turns into another allele, drawn by `weights`;
- a trait jump: with `config.jump.chance` (0.12) per child (times `mutation`), one trait moves by `jump.by` (0.35), up or down;
- a gift: with `config.gift.chance` (0.1) per child (times `mutation`), one talent rises by `gift.by` (0.4).

## State

In `world.s.mod.delos`, made with the first genome:

| Key | Holds |
|---|---|
| `g` | By person: `{ genes, traits, talents, instincts, looks, mut? }`. Genes hold the copies carried; the values are the genome's own (before `express`) |

What a genome means for the person is in their definition (`traits`, `talents`, `instincts`), saved with them.

## API

`world.delos`. **Input** methods are recorded and safe from the game.

| Method | Returns | |
|---|---|---|
| `gene(def)` | this | Declares a gene: [GeneDef](#genedef) |
| `trait(def)`, `talent(def)`, `instinct(def)`, `look(def)` | this | Declares a blended value: [BlendDef](#blenddef) |
| `active()` | boolean | Is anything declared? |
| `genome(id)` | Genome or undefined | Someone's genome (a copy) |
| `express(id, gene)` | value | What a gene shows |
| `carries(id, gene, allele)` | boolean | Do they carry the allele, showing or not? |
| `looks(id)` | object | Every gene as it shows, and the continuous looks |
| `set(id, part)` | void | **Input.** Sets parts of a genome: `{ genes?, traits?, talents?, instincts?, looks? }` |
| `applyFounder(id)`, `applyInherit(parents, child)`, `applySet(id, part)` | | **Engine** |
| `genes`, `blends` | | The declarations |
| `config` | | The config |

### GeneDef

| Field | Default | Meaning |
|---|---|---|
| `id` | required | |
| `label` | none | |
| `alleles` | required | Most dominant first |
| `weights` | even | How common each allele is among founders, and in mutations |
| `copies` | 2 | 2: one from each parent; 1: taken whole from either |
| `express` | dominance | `(copies) => value`: what shows |
| `mutate` | 0 | The chance per child that one copy turns into another allele |

### BlendDef

| Field | Default | Meaning |
|---|---|---|
| `id` | required | The trait, skill, action or look |
| `label` | none | |
| `founders` | by kind (above) | Founders' values are drawn from this range |
| `bounds` | by kind | Values are kept in this range |
| `cross` | by kind | The share taken from one parent, picked at random; the rest is the parents' average |
| `noise` | by kind | A child's value moves by up to this much either way |
| `round` | false | Whole numbers only |
| `express` | none | `(v) => number`: what the person gets from the genome's value |

## Terms, events and log

Terms: `gene:<id>` (what the gene shows), `carries:<gene>.<allele>`.

| Event | Payload |
|---|---|
| `mutated` | `{ id, kind, what, by?, to? }`: `kind` is `'gene'`, `'trait'` or `'talent'`; `what` is its id |

Log entries: `mutated`.

## Config

`Tyrell.create({ moduleConfig: { delos: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `jump` | `{ chance: 0.12, by: 0.35 }` | A child's chance that one trait jumps, up or down |
| `gift` | `{ chance: 0.1, by: 0.4 }` | A child's chance that one talent rises |
| `mutation` | 1 | Headline knob: how often genomes mutate (trait jumps, gifts, every gene's `mutate`); 0: never |
| `variation` | 1 | Headline knob: how far children stray (every blended value's `noise`, times it); 0: a child is exactly the blend |
| `traitBlend`, `talentBlend`, `instinctBlend`, `lookBlend` | the defaults by kind (above) | Each kind's founders, bounds, cross and noise, for a value that doesn't say its own: give any of them (`{ noise: 0.2 }`), the rest stay |

Delos's knobs are the world's only (a child's genome is made before they're anyone). See [Tuning](../tuning.md#delos); during play, `world.tune('delos', { ... })`.

## With other modules

- **Cradle**: births inherit a genome when anything is declared (above).
- **Skills** (the core) read talents; **Bicameral** weighs instincts.
- **Fellowship**: nothing direct; compatibility reads values, which Delos doesn't carry (a game can keep values in its definitions as it likes).

## Example

```js
const d = world.delos;
d.gene({ id: 'eyes', alleles: ['brown', 'blue'], weights: [3, 2] });
for (const t of ['merriness', 'sociability', 'bravery']) d.trait({ id: t });
d.talent({ id: 'baking' });
d.instinct({ id: 'fish' });

world.person('rose', { home: 'hole_1' });     // a founder's genome, drawn from the seed
world.person('sam', { home: 'hole_1' });
const baby = world.cradle.birth(['rose', 'sam']);
world.delos.looks(baby);                       // { eyes: 'blue' }
world.get(baby).def.traits.merriness;          // between Rose's and Sam's, with a little of its own
world.on('mutated', (e) => chronicle(`${world.get(e.id)?.name ?? 'The baby'} was born with ${e.kind === 'talent' ? 'a gift for ' + e.what : 'unusual ' + e.what}.`));
```
