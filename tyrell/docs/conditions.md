# Conditions and effects

Conditions and effects are short strings, so they can live in plain JSON (a person's routine, a saved directive) and survive a rewind. Anywhere a definition is code, a function works too.

```js
world.action({
  id: 'buy_round', at: 'tag:drink', minutes: 15, target: 'person', base: 0.1,
  if: ['money>=10', '!felt:wronged', 'hour>=17'],
  targetIf: ['regard>0.3'],
  then: ['money-=10', 'regard+=0.05', 'var.rounds+=1'],
});
```

- [Syntax](#syntax)
- [Where conditions and effects are used](#where-conditions-and-effects-are-used)
- [Core terms](#core-terms)
- [Module terms](#module-terms)
- [Effects](#effects)
- [Functions](#functions)
- [Extending the language](#extending-the-language)
- [Rewind safety](#rewind-safety)

## Syntax

A **condition** is a term, optionally compared with a literal, optionally negated:

```
term                  true when the term's value is truthy
term<op>literal       a comparison
!term<op>literal      negated (or 'not term<op>literal')
```

A **term** is a name, then `.` or `:`, then an argument: `need.hunger`, `has:radio`, `thinks:open:workshop`, `file:player.fixed`. The name is the part before the first `.` or `:`; the argument is everything after (it can contain more `:` and `.`). A bare word that isn't a registered term reads the world fact of that name (`raining` is `fact:raining`).

**Operators**: `>=`, `<=`, `>`, `<`, `==` (or `=`), `!=`. The first operator in the string is the one used (the longer one when two start at the same place), so keys can't contain operator characters.

**Literals**: numbers (`0.5`, `-2`), `true`, `false`, `null`, and strings, with or without quotes (`emotion==angry`, `person=='ruth'`).

**Comparing**:

| Operator | Behavior |
|---|---|
| none | Truthy: not `undefined`, `null`, `false`, `0` or `''` |
| `>=` `<=` `>` `<` | Numeric; a missing value counts as 0 |
| `==` `=` | Strict equality (numbers within 1e-9); a missing value counts as `null` |
| `!=` | Strict inequality; a missing value counts as `null` |

An **effect** is a term with an assignment, or a bare term:

```
money-=6      var.tips+=1      need.hunger-=0.2      fact:open:noodles=false
give:radio    take:radio*2     feel:tired            believe:fixed:radio=true
```

Assignment operators are `=`, `+=`, `-=` and `*=`. A bare effect (`give:radio`, `fact:alarm`) uses the effect's own default (for `fact:` and `game:`, `true`). An effect name that isn't registered is taken as a person variable: `tips+=1` is `var.tips+=1`.

Conditions are compiled once and cached, so using them is cheap.

## Where conditions and effects are used

| Field | Context: `person`, `place`, `target`... |
|---|---|
| `ActionDef.if`, `ActionDef.who` | The person, the candidate place, the target, the action |
| `ActionDef.targetIf` | The person; `target` is the candidate target |
| `ActionDef.then` (effects) | The person, the place, the target, the action |
| `TaskDef.if`, `TaskDef.who` | The person, the candidate place, the task |
| `MethodDef.if` | The person, the task (no place) |
| `RoutineVariant.when` (strings only) | The person |
| `SlotDef.who` | The person deciding or claiming, the place |
| `LineDef.who`, `when`, `to` (Cityspeak) | The speaker; `target` is the listener; `topic`; `place` is the speaker's place |
| `WishDef.if`, `weight`, `about` | The person |
| `WishDef.when`, `progress`, `then`, `fades` | The person; `target` is who it's about, if a person; `data.x` is what it's about |
| `SkillDef.then` (effects) | The person; `data.skill`, `data.level` |
| `LineDef.then` (effects) | The speaker; `target` is the listener; `topic` |
| `PracticeDef` role `who` | The person, their place |
| `SocialActDef.acceptIf`, `accept` | The target of the act as `person`; the asker as `target` |
| `SocialActDef.onAccept`, `onRefuse` (effects) | The asker as `person`; the target as `target` |
| `StoryletDef.when` (Gaff) | No person: world terms only |
| `CoursePhase.scale`, `then` (Athelas) | The person |
| `CourseDef.contagion.resist` (Athelas) | The one who might catch it; `target` is the carrier |
| `Consideration.input` | A term (not a condition), read in the option's context |

## Core terms

Always available. "The person" is the context's person.

| Term | Value |
|---|---|
| `need.<id>` | The person's level of a need, 0..1 |
| `var.<name>` | The person's variable |
| `money` | The person's own `vars.money` (0 if unset). With a Ceres household purse, use `purse` |
| `trait.<name>` | A trait from their definition; 0.5 if unset |
| `value.<name>` | A value they hold; 0 if unset |
| `has:<item>` | How many they have: their own goods plus their household's pantry |
| `hour` | The hour of the day, 0 to 24 |
| `day` | The day number |
| `weekday` | The day of the week, 0 to `config.week - 1` |
| `fact:<key>` | The world fact; if unset, `shell.check(key, ctx)`; else `null` |
| `game:<key>` | A value kept with `world.keep` |
| `at:<place>` | The person is at the place or inside it, and not walking. Also `at:tag:<tag>`, `at:home`, `at:work` |
| `open:<place>` | The place is open now |
| `free:<place>.<slot>` | Free places in the slot (`Infinity` if unlimited): `free:cafe.seat>0` |
| `is:<tag>` | The person's definition has this tag (`is:child`) |
| `job` | The person's job id (or `null`); `job:<id>` is true if it's that job |
| `in:<region>` | The person's place is in this region |
| `doing` | What they're doing (while walking, the action they're walking to); `doing:<action>` is true if it's that |
| `with:<id>` | The other person is in the same outermost place as the person, and neither is walking |
| `topic:<x>` | The context's topic is `x` (lines) |
| `chance:<p>` | A random draw, true with probability `p`, from the person's stream (or the world's); when only looking, from a stream that changes nothing. See [rewind safety](#rewind-safety) |
| `target` | The target's id (or `null`) |
| `target.<term>` | Any term evaluated for the target, with the person as their target: `target.trait.honesty>0.5`, `target.is:child`, `target.regard>0` (the target's regard for the person) |
| `person` | The person's id |
| `place` | The context's place; `place:<id>` is true if it's that place |
| `home` | The person's home id |
| `habit`, `habit:<action>` | The person's habit weight for the context's action (or the one named): 1 with none, 0.25 to 4 |
| `crowd`, `crowd:<place>` | How full a place is: the share of its slots taken, 0..1 (the context's place, else where the person is) |
| `skill.<id>` | The person's level in a skill now, forgetting included (their starting level, or the skill's `start`, if they've never practiced) |
| `talent.<id>` | How fast they learn the skill: their `talents` entry, 1 if unset |
| `instinct.<action>` | Their inborn taste for an action or task: their `instincts` entry, 1 if unset (the context's action with no name) |
| `tolerance:<kind>` | How much of a pastime that palls they've had lately, 0..1 |
| `wish:<id>` | While they hold the wish: what it's about, or `true`; else `false` |
| `wishes` | How many wishes they hold (not counting a dream) |
| `dream` | The id of their dream, or `null` |
| `granted:<id>` | How many times the wish has come true for them |
| any other word | The world fact of that name |

## Module terms

Each module registers its terms when it's switched on. With a module off, its terms read as facts of the same name (usually nothing).

### Reverie

| Term | Value |
|---|---|
| `mood` | The person's mood, 0..1 (0.5 with no person) |
| `stress` | Their stress, 0..1 |
| `emotion` | The emotion showing (`'fine'` when nothing stands out); `emotion:<x>` is true if it's `x` |
| `felt:<feeling>` | They have this feeling now |
| `believes:<key>` | What they believe about the key (`null` if nothing): `believes:open:cafe==false` |
| `knows:<key>` | They hold a belief about the key |
| `thinks:<key>` | What they take to be true: their belief, else the fact, else the key read as a term (`thinks:open:workshop` falls back to `open:workshop`) |
| `file:<subject>.<verb>` | How many times `subject` did `verb` to or for them: `file:player.fixed>=2`. `subject` can be `target`. `file:<subject>` alone is how many times they've met since the file was opened |
| `memories` | How many memories they hold; `memories:<kind>` counts one kind |

### Fellowship

`<id>` defaults to the context's target.

| Term | Value |
|---|---|
| `regard`, `regard:<id>` | The person's regard for them, -1..1 |
| `attraction`, `attraction:<id>` | Attraction, -1..1 |
| `compat`, `compat:<id>` | Hidden compatibility, -1..1 |
| `friend`, `friend:<id>` | Regard at least 0.5 |
| `foe`, `foe:<id>` | Regard at most -0.4 |
| `member:<group>` | The person is in the group |
| `partner` | Their partner's id (or `null`); `partner:<id>` is true if it's them |
| `fame:<group>.<subject>` | The subject's fame with the group, 0..1. Without `.subject`, the person (or `'player'` with no person) |
| `infamy:<group>.<subject>` | Infamy, the same way |

### Wormtongue

| Term | Value |
|---|---|
| `heat`, `heat:<actor>` | Heat on the actor; default the person, or `'player'` with no person |
| `owes:<id>` | Favors the person owes `id` (default the target) |
| `owed:<id>` | Favors `id` owes the person (default the target) |
| `saw:<actor>.<kind>` | The person believes the actor did it: `saw:player.strip` |

### Cityspeak

| Term | Value |
|---|---|
| `room` | The mood of the room where the person is (0.5 when they're nowhere) |
| `said:<key>` | The person has said a line with this key (with `cityspeak.say`). `said:<index>` also works, for the line at that index (in the order declared, from 0) |
| `practice:<id>` | That practice is going on where the person is |
| `role:<name>` | The person fills that role in a practice where they are |

### Mentat

| Term | Value |
|---|---|
| `planning` | The task the person is working on (or `null`); `planning:<task>` is true if it's that |

### Gaff

| Term | Value |
|---|---|
| `metric:<name>` | A metric: `mood` (mean mood), `people` (how many are active), `heat.<actor>`, or one from `gaff.defineMetric` |
| `intensity`, `intensity:<subject>` | A subject's intensity, 0..1 (default subject `world`) |
| `phase:<phase>` | The world's phase is this (`phase:relax`); `phase:<subject>.<phase>` for another subject |

### Ceres

| Term | Value |
|---|---|
| `purse` | What the person can spend: their household's purse if it shares one, else their money |
| `price:<good>` | A good's declared price. `price` alone is the context's action's `price` (a consideration's option) |
| `stock:<place>.<item>` | Stock at a place; `stock:<item>` at the context's place |
| `afford:<n>` | Their purse is at least `n` |
| `goods:<kind>` | How many goods of that kind (`GoodDef.kind`) they can use: their own plus their household's pantry |

### Cradle

| Term | Value |
|---|---|
| `age` | Age in years (30 for people with no `born`) |
| `stage` | Life stage (`'child'`, `'adult'`...); `stage:<name>` is true if it's that |
| `married` | They have a partner (needs Fellowship) |

### Athelas

| Term | Value |
|---|---|
| `under:<course>` | The phase the course is in (its id), or `false` when it isn't running: `under:ale=sore_head` |
| `under:tag:<tag>` | Any running course has the tag (`under:tag:illness`) |
| `under` | How many courses are running |
| `immune:<course>` | Immune to it now |

### Delos

| Term | Value |
|---|---|
| `gene:<id>` | What the gene shows for the person (`null` without a genome) |
| `carries:<gene>.<allele>` | They carry the allele, showing or not |

## Effects

Effects change state directly. They're meant to run inside the simulation: an action's `then`, a line said with `cityspeak.say`, a social act's outcome. There, they're replayed along with everything else.

### Core effects

| Effect | What it does |
|---|---|
| `var.<name>=v`, `+=`, `-=`, `*=` | Sets or changes a person variable |
| `<name>+=n` (any unregistered name) | Shorthand for `var.<name>` |
| `money=n`, `+=`, `-=` | The person's `vars.money` (not a household purse: use Ceres' `pay`) |
| `need.<id>=v`, `+=`, `-=` | Sets a need's level now |
| `give:<item>`, `give:<item>*n` | Adds goods to the person |
| `take:<item>`, `take:<item>*n` | Takes goods: their own first, then the household pantry |
| `fact:<key>=v`, `fact:<key>`, `+=`... | Sets a world fact (`fact:<key>` alone sets `true`) |
| `game:<key>=v` | Sets a kept game value |
| `log:<kind>` | Writes a log entry of that kind about the person |
| `skill.<id>=v`, `+=`, `-=`, `*=` | Sets or changes the person's level in a skill (kept within 0 and its `max`) |
| `train:<id>=hours`, `train:<id>` | Practice: that many hours (1 if none given) at the person's own pace |
| `wish:<id>` | Gives the person a wish (or dream), if they can wish it now |
| `grant:<id>` | Makes a wish they hold come true |

### Module effects

| Effect | Module | What it does |
|---|---|---|
| `feel:<feeling>` | Reverie | Gives the person a feeling |
| `believe:<key>=v`, `believe:<key>` | Reverie | Gives the person a belief (source `'knew'`, strength 1; `true` if no value) |
| `forget:<key>` | Reverie | Drops a belief |
| `remember:<kind>` | Reverie | A memory of that kind, at the context's place, about the target |
| `regard+=n`, `regard-=n`, `regard=n` | Fellowship | The person's regard for the target (or `regard:<id>`), clamped to -1..1 |
| `fame:<group>.<subject>+=n` | Fellowship | Standing; `-=` lowers it, any other operator adds. Without `.subject`, the person (or `'player'` with no person), as for the term |
| `infamy:<group>.<subject>+=n` | Fellowship | The same for infamy |
| `pay:<to>=n`, `pay=n` | Ceres | Pays `n` from the person's purse to `to` (default `'world'`) |
| `afflict:<course>` | Athelas | Afflicts the person (caught from the context's target, if any) |
| `cure:<course>`, `cure` | Athelas | Ends the course, or every course |

## Functions

Wherever a condition is accepted in a definition (not in routines, which are saved), a function `(ctx) => boolean` works; wherever an effect is, `(ctx) => void` works.

```js
world.action({
  id: 'confide', at: 'here', target: 'person', minutes: 20, base: 0.1,
  targetIf: [(ctx) => ctx.world.fellowship.regard(ctx.person.id, ctx.target) > 0.6],
  then: [(ctx) => { ctx.world.reverie.applyFeel(ctx.target, 'helped', ctx.person.id); }],
});
```

The context:

| Field | Meaning |
|---|---|
| `world` | The world |
| `person` | The PersonState thinking, acting or speaking |
| `place` | The place in question |
| `target` | The other person's id |
| `action` | The action or task id |
| `topic` | A line's topic |
| `data` | Anything else a caller passes |

A function effect runs inside the simulation, so it may change state directly (as above, with the `apply...` methods): a replay runs it again. It must be deterministic: draw randomness from `ctx.world.stream(ctx.person)`, never `Math.random`.

## Extending the language

```js
world.term('weekend', () => world.weekday >= 5);
world.term('owns', (ctx, item) => (ctx.person?.inv[item] ?? 0) > 0);
world.effect('stress', (ctx, _arg, op, value) => {
  if (ctx.person && world.reverie) world.reverie.addStress(ctx.person.id, Number(value));
});

world.action({ id: 'lie_in', at: 'home', minutes: 90, base: 0.1, if: ['weekend'], pose: 'sleep' });
world.action({ id: 'tax_return', at: 'home', minutes: 60, rank: -1, then: ['stress+=0.2'] });
```

`world.term(name, fn)`: `fn(ctx, arg)` returns a value (a string, number, boolean or null). The name must be a plain identifier; `arg` is everything after the first `.` or `:` (an empty string for a bare term). Registering a name again replaces it.

`world.effect(name, fn)`: `fn(ctx, arg, op, value)`, where `op` is `'='`, `'+='`, `'-='`, `'*='` or `''` for a bare effect, and `value` is the parsed literal (`null` for a bare effect). Effects run inside the simulation; change state directly, deterministically.

Terms and effects are definitions: register them on every start.

## Rewind safety

Every string condition and effect is safe across rewinds as long as it reads and writes Tyrell's own state. The exceptions:

- **`fact:` falling back to `shell.check`.** When a fact isn't set, `fact:<key>` asks the game live, and a replay sees the game as it is now, not as it was. Push facts with `world.fact` instead.
- **Function conditions and custom terms that read game state** that isn't kept in the world (the player's position, a game flag). Read facts or kept values instead.
- **`chance:`** is deterministic: in a decision it draws from the person's seeded stream, which advances it. Calls that only look (`world.whyNot`, `world.describe`, `world.mind.explain`, `cityspeak.choose` and `say`, barks, Joi, `gaff.eligible`, `mentat.acquire`, the ink bridge) draw from a stream that changes nothing instead, so looking never changes the world. When game code tests conditions itself, wrap it the same way: `world.peek(() => world.lang.test(cond, ctx))`.
- **Calling `world.lang.apply` (or any effect function) from game code** changes the state without an input. Use an input instead.
