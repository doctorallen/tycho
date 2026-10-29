# Reverie

What people carry: feelings that add up to a mood and an emotion, breaking points, stress, memories that fade or change someone, beliefs that can be wrong, and files on the player. Named for Westworld's reveries, the small gestures old memories leave behind.

The ideas come from RimWorld's thoughts and The Sims 4's moodlets (feelings), RimWorld's mental breaks, Dwarf Fortress and Crusader Kings 3 (stress, values), Generative Agents (memory scoring), Talk of the Town (beliefs with sources) and the Nemesis system (files).

- [Feelings, mood and emotion](#feelings-mood-and-emotion)
- [Breaks](#breaks)
- [Stress and values](#stress-and-values)
- [Memories](#memories)
- [Beliefs](#beliefs)
- [Files](#files)
- [State](#state)
- [API](#api)
- [Terms and effects](#terms-and-effects)
- [Events](#events)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Example](#example)

## Feelings, mood and emotion

```js
world.reverie.feeling({ id: 'insulted', label: 'Insulted', weight: -0.15, minutes: 2 * 1440, stack: 3, emotion: 'angry' });
world.reverie.feel('kofi', 'insulted', 'the player');
world.reverie.mood('kofi');      // 0..1
world.reverie.emotion('kofi');   // 'angry'
```

`FeelingDef`:

| Field | Default | Meaning |
|---|---|---|
| `id` | required | The feeling's id |
| `label` | the id | A readable name ('A good meal') |
| `tell` | none | Its words in a story ([Irulan](../tools.md#irulan)), as they'd follow the person's name: `'enjoyed a good meal'`. The built-in feelings have theirs (`'was frustrated'`); without it, `'felt <label>'` |
| `weight` | required | How much it lifts (+) or sinks (-) the mood, -1..1 |
| `minutes` | required | How long it lasts |
| `stack` | 1 | How many can be held at once. A new one past the limit refreshes the oldest instead |
| `stackMul` | `config.stackMul` (0.8) | Each extra stack weighs this much of the one before (the fifth insult stings less than the first) |
| `emotion` | none | The emotion it feeds: 'happy', 'angry', 'sad', 'scared', 'tense', 'guilty'... |
| `stress` | half the weight, if negative | Stress added each time it's felt |
| `boost` | none | While felt, actions with these tags weigh this much more or less: `{ comfort: 1.5, social: 0.6 }` |

Built-in feelings (declare one with the same id to change it):

| Id | Label | Weight | Lasts | Stack | Emotion | Given by |
|---|---|---|---|---|---|---|
| `catharsis` | Got it out of my system | +0.25 | 2 days | 1 | relieved | The end of a break |
| `conscience` | A guilty conscience | -0.1 | 1 day | 3 | guilty | Acting against one's values |
| `witnessed` | Saw something bad | -0.06 | 12 h | 2 | tense | Witnessing a crime (Wormtongue) |
| `frustrated` | Nothing went right | -0.06 | 6 h | 3 | angry | A plan given up (Mentat) |
| `grief` | Grieving | -0.3 | 7 days | 1 | sad | Someone cared for departs (Cradle) |
| `scared` | Frightened | -0.15 | 1 day | 2 | scared | Being scared off (Wormtongue) |
| `helped` | Someone helped me | +0.1 | 1 day | 3 | happy | Deeds you declare with it |
| `wronged` | Someone did me wrong | -0.12 | 2 days | 3 | angry | Deeds you declare with it |

Ceres also declares `behind_on_rent` (-0.15, 7 days, tense) the first time someone misses rent, unless you've declared it.

**Mood** is `config.base` (0.6), plus the weight of every feeling held, minus the mean urgency of all needs times `2 × config.needWeight` (0.5), clamped to 0..1. Hungry, tired people are in a worse mood whatever they feel.

**Emotion** is the one named emotion showing: the emotion with the largest total feeling weight (absolute), counting also each need with an `emotion` whose level is over 0.7 (by `(level - 0.7) × 0.8`: `needEmotion` and `needEmotionWeight`). It shows only above `config.emotionFloor` (0.08); otherwise it's `'fine'`. Bodies carry it (`body.emotion`, `body.mood`).

Actions give feelings when they end (`feels: ['good_meal']`), as do deeds (`feeling`, `witnessFeeling`), effects (`feel:tired`), and the game (`reverie.feel`).

## Breaks

When someone's mood falls low enough, they can break: sulk at home, go on a bender, walk out. A break outranks everything (rank 4).

```js
world.action({ id: 'sulk', at: 'home', minutes: 120, pose: 'sit', rank: -1 });
world.action({ id: 'bender', at: 'tag:drink', minutes: 240, relieves: { fun: 0.6 }, pose: 'sit', rank: -1 });
world.reverie.breakdown({ id: 'sulk', level: 'minor', do: 'sulk', label: 'sulking at home' });
world.reverie.breakdown({ id: 'bender', level: 'major', do: 'bender', label: 'a bender',
  weight: [{ input: 'trait.courage', out: [0.3, 1.5] }] });
```

`BreakDef`:

| Field | Default | Meaning |
|---|---|---|
| `id` | required | The break's id |
| `level` | required | `'minor'`, `'major'` or `'extreme'` |
| `do` | required | The action or task they break into |
| `at` | the action's `at` | Where |
| `weight` | none (1) | Considerations (read for the person): how likely this break is for them, against the others at its level. A temperament |
| `after` | `'catharsis'` | The feeling once it's over |
| `label` | the id | A readable name |
| `tell` | none | Its words in a story ([Irulan](../tools.md#irulan)), as they'd follow the person's name: `'broke down and went on a bender'`. Without it, `'broke down (<label>)'` |

Each time someone decides, Reverie checks their mood against the thresholds in config: below `extreme[0]` (0.08) it's an extreme break, below `major[0]` (0.2) major, below `minor[0]` (0.35) minor. The chance of a break since they last decided is `1 - exp(-elapsed × breaks / meanTime)`, where the mean time between breaks is `extreme[1]` (0.5 days), `major[1]` (0.8) or `minor[1]` (4), and `breaks` is the headline knob (1; 0 means no breaks, and a person's own `tune` multiplies it for them); the elapsed time counts at most a day. The break is picked among the breaks of that level (or the nearest milder level that has any), weighted by their considerations. With no breaks declared, nobody breaks.

A break is an option at rank 4 and layer `'break'`, at the first place its spec resolves to. It isn't checked against hours, slots or conditions first; if the place turns out closed, it fails on arrival like any walk. When more than half of it is done, the person gets the `after` feeling, their short-term stress drops to 0 and their long-term stress by 30%.

## Stress and values

Stress has two parts: short-term (half-life `stressShort`, 12 hours) and long-term (half-life `stressLong`, 7 days). `stress(id)` is `0.6 × short + 0.6 × long` (`stressShortWeight`, `stressLongWeight`), clamped to 0..1. Each addition goes in full to the short part and 15% (`stressCarry`) to the long part (plus `strain`, 0.02, more when short-term stress is over `strainAt`, 0.6). Negative feelings add stress (half their weight, `feelingStress`, unless they say their own); breaks release it (all the short part, and 30% of the long: `catharsisKeep` 0.7 is kept). The headline knob `stress` scales every addition.

**Values** are held 0..1 (`PersonDef.values: { honesty: 0.9 }`). An action `against: ['honesty']` weighs `clamp(1 - held × 0.8, 0.05, 1)` (`againstPull`, `againstFloor`) for each value held, so an honest person hardly wants to. If they do it anyway (required by a job, a directive, desperation), starting it costs them stress (`0.3 ×` the sum of the values held: `againstStress`) and a guilty `conscience`.

Stress doesn't drive decisions by itself; read it with the `stress` term or as a consideration input.

## Memories

```js
world.reverie.memoryKind({ id: 'betrayed', importance: 9, shifts: { trust: -0.2 } });
world.reverie.remember('kofi', { k: 'betrayed', about: 'sam', text: 'Sam sold me out' });
world.reverie.memories('kofi');   // strongest first
```

`MemoryKindDef`:

| Field | Default | Meaning |
|---|---|---|
| `id` | required | The kind, matched by a memory's `k` |
| `importance` | 5 | 1..10 |
| `shifts` | none | Trait changes if a memory of this kind becomes a core memory: `{ courage: -0.1 }` |
| `label` | none | For the game |

A `Memory` is `{ k, t, imp, recalls, about?, place?, text?, core? }`: the kind, when, its importance (the memory's own `imp`, else the kind's, else `memoryImportance`, 5), how often it's been recalled, who it's about, where, words for the game, and whether it's a core memory.

- **Strength** is importance faded by time: `imp × memoryDecay^hours` (0.995 an hour: an importance-5 memory is about half as strong after six days). Core memories don't fade.
- **Forgetting.** At most `memoryCap` (24) memories that aren't core are kept; the weakest goes when there are more. Each midnight, memories weaker than `memoryFloor` (0.5) are dropped. A memory's strength is its importance times `memoryDecay` (0.995) to the power of the hours since, times the headline knob `forgetting` (and the person's own): 2 forgets twice as fast, 0 never.
- **Recall.** `recall(id, match, n)` returns the `n` strongest memories matching `{ about, k, place }` and counts a recall on each. A memory with importance 7 or more (`coreImportance`) that's been recalled 3 times or more (`coreRecalls`) has a one-in-three chance (`coreChance`), each recall, of becoming a **core memory** (up to `coreCap`, 8): it stops fading, its kind's `shifts` change the person's traits (clamped 0..1), and the change is kept with its reason (`shifts(id)`), logged and emitted as `changed`.

Memories come from deeds (`memory` in a DeedDef), from witnessing (Wormtongue: kind `'saw:<kind>'`), from departures (Cradle: kind `'loss'`), from the `remember:<kind>` effect, and from the game (`reverie.remember`).

`recall` changes state (the recall count, and maybe a core memory), so it's an input, recorded for time walk. It applies at once even inside a listener, and returns copies of the memories recalled:

```js
const memories = world.reverie.recall('kofi', { about: 'sam' });   // in dialogue: what he remembers of Sam
```

Inside the simulation (an effect, a storylet's `fire`), use `applyRecall`.

## Beliefs

A belief is what someone takes to be true about a key, with where it came from and how strongly they hold it. Beliefs can be wrong. Plans, lines and conditions run on what people believe.

```js
world.fact('open:coil', true);
world.reverie.believe('kofi', 'open:coil', false, 'told', 'sam', 0.6);
world.reverie.thinks('kofi', 'open:coil');     // false: his belief wins over the fact
world.reverie.accurate('kofi', 'open:coil');   // false
world.reverie.beliefRecord('kofi', 'open:coil');
// { key: 'open:coil', v: false, src: 'told', from: 'sam', t: 600, str: 0.6, hops: 0 }
```

A `Belief`:

| Field | Meaning |
|---|---|
| `key` | What it's about. Conventions: `'did:<actor>:<kind>'` (Wormtongue), `'open:<place>'` (Mentat), `'behind:<id>'` (Ceres); anything else you like |
| `v` | The value believed |
| `src` | `'saw'`, `'told'`, `'assumed'` or `'knew'` |
| `from` | Who told them |
| `t` | When it was last confirmed |
| `str` | Strength, 0..1 |
| `hops` | How many tellings from whoever saw it (gossip) |
| `silenced` | They won't pass it on (paid or scared off) |

Rules when a belief arrives:

- The same value: the strength becomes the stronger of the two, the time is refreshed, and seeing it upgrades the source to `'saw'`.
- A different value: something seen isn't overturned by hearsay of equal or lower strength, and hearsay doesn't replace a stronger belief. Otherwise the new belief replaces the old.

Each midnight, strength fades: by `beliefDecay` (0.97) a day, or for things seen by `sawDecay` (by default its square root), each to the power of the headline knob `forgetting` (and the person's own). Beliefs weaker than `beliefFloor` (0.05) are forgotten.

`thinks(id, key)` is what someone takes to be true: their belief; else the world's fact; else the key read as a term of the condition language (`thinks:open:workshop` falls back to whether the workshop is open). Keys starting with `@` are never gossiped: use them for private beliefs.

## Files

A file is what someone knows of another person's deeds, usually the player's: how often they've met, and a tally of every deed done to them or in front of them.

```js
world.did('player', 'fixed', { for: 'ruth', what: 'radio' });
world.reverie.file('ruth', 'player');
// { met: 0, first: 600, last: 600, tally: { fixed: 1 }, notes: [{ verb: 'fixed', t: 600, what: 'radio' }] }
```

`PersonFile`: `met` (meetings since the file was opened), `first` and `last` (times), `tally` (deeds by verb), `notes` (the last 12 deeds, with `what`). Every deed (`world.did`, or an action's `deed`) is noted in the receiver's file on the doer and in the files of everyone in `seenBy`. Conditions read files as `file:player.fixed>=2`, and Wormtongue counts someone with a file on the actor as knowing them.

## State

In `world.s.mod.reverie`, all plain JSON:

| Key | Holds |
|---|---|
| `f` | Feelings by person: `{ id, t, until, w, cause? }` |
| `m` | Memories by person |
| `b` | Beliefs by person, by key |
| `files` | Files by person, by subject |
| `st` | Stress by person: `[short, long, time]` |
| `checked` | When each person was last checked for a break |
| `shifts` | Trait shifts by person: `{ trait, by, cause, t }` |

## API

`world.reverie`. Methods marked **input** are recorded for time walk and safe to call from the game. Methods marked **engine** change state directly: call them only from inside the simulation (effects, storylets, module hooks, custom inputs).

| Method | Returns | |
|---|---|---|
| `feeling(def)` | this | Declares a feeling |
| `breakdown(def)` | this | Declares a break |
| `memoryKind(def)` | this | Declares a memory kind |
| `feel(id, feeling, cause?)` | void | **Input.** Gives a feeling |
| `remember(id, memory)` | void | **Input.** Adds a memory: `{ k, imp?, about?, place?, text? }` |
| `believe(id, key, value, src = 'knew', from?, str = 1)` | void | **Input.** Gives a belief |
| `forget(id, key)` | void | **Input.** Drops a belief |
| `recall(id, match?, n = 3)` | Memory[] | **Input** (applies at once). Brings memories to mind (may make a core memory); returns copies |
| `silence(id, key, on = true)` | void | **Input.** Marks a belief as one they won't pass on (a promise kept), or (`false`) lets it go again. For witnesses, `wormtongue.silence` |
| `feelings(id)` | array | Active feelings: `{ id, label, weight, until, emotion?, cause? }` |
| `mood(id)` | number | 0..1 (0.5 for nobody) |
| `emotion(id)` | string | The emotion showing, or `'fine'` |
| `stress(id)` | number | 0..1 |
| `stressParts(id)` | `[short, long]` | The two parts now |
| `memories(id)` | Memory[] | Strongest first |
| `strength(memory)` | number | A memory's strength now |
| `shifts(id)` | Shift[] | How their traits have shifted, and why |
| `belief(id, key)` | value or undefined | What they believe (undefined if nothing, or too weak) |
| `beliefRecord(id, key)` | Belief or undefined | The full record |
| `beliefs(id)` | Belief[] | All their beliefs, strongest and newest first |
| `thinks(id, key)` | value | Belief, else fact, else the truth by the condition language |
| `accurate(id, key)` | boolean or null | Is their belief the fact? `null` when there's no fact |
| `file(id, subject)` | PersonFile or undefined | Their file on someone |
| `applyFeel(id, feeling, cause?)` | void | **Engine.** Gives a feeling |
| `addStress(id, amount)` | void | **Engine.** Adds stress |
| `applyRemember(id, memory)` | void | **Engine.** Adds a memory |
| `applyBelieve(id, key, value, src, from?, str = 1, hops = 0)` | void | **Engine.** Gives a belief |
| `applyRecall(id, match?, n = 3)` | Memory[] | **Engine.** The direct version of `recall` |
| `applySilence(id, key, on = true)` | void | **Engine.** The direct version of `silence` |
| `applyNote(id, subject, verb, what?)` | void | **Engine.** Notes a deed in a file (the game reports deeds with `world.did`) |
| `config`, `feelingDefs`, `breakDefs`, `memoryKinds` | | The config and the declared definitions |

## Terms and effects

Terms: `mood`, `stress`, `emotion` / `emotion:<x>`, `felt:<feeling>`, `believes:<key>`, `knows:<key>`, `thinks:<key>`, `file:<subject>.<verb>`, `memories` / `memories:<kind>`.

Effects: `feel:<feeling>`, `believe:<key>=v`, `forget:<key>`, `remember:<kind>`.

See [Conditions](../conditions.md#reverie).

## Events

| Event | Payload |
|---|---|
| `felt` | `{ id, feeling, label, emotion }` (emotion is `null` if the feeling has none) |
| `broke` | `{ id, kind, level, label }`: `kind` is the break's id |
| `changed` | `{ id, memory, shifts }`: a core memory changed them |

Log entries: `felt`, `broke`, `changed`.

## Config

`Tyrell.create({ moduleConfig: { reverie: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `base` | 0.6 | Mood with no feelings and needs met |
| `needWeight` | 0.25 | How much unmet needs drag the mood (times 2 × mean urgency) |
| `emotionFloor` | 0.08 | An emotion shows only above this |
| `minor` | `[0.35, 4]` | Minor breaks: mood below, mean days between breaks |
| `major` | `[0.2, 0.8]` | Major breaks |
| `extreme` | `[0.08, 0.5]` | Extreme breaks |
| `memoryCap` | 24 | Memories kept that aren't core |
| `coreCap` | 8 | Core memories at most |
| `memoryDecay` | 0.995 | Memory strength kept per hour |
| `beliefFloor` | 0.05 | Beliefs weaker than this are forgotten |
| `beliefDecay` | 0.97 | Belief strength kept per day (things seen: its square root) |
| `stressShort` | 720 | Short-term stress half-life, minutes (12 hours) |
| `stressLong` | 10080 | Long-term stress half-life, minutes (7 days) |
| `breaks` | 1 | Headline knob: how often breaks come (0: never) |
| `forgetting` | 1 | Headline knob: how fast memories and beliefs fade (0: never) |
| `feelings` | 1 | Headline knob: how much feelings move the mood |
| `stress` | 1 | Headline knob: how much stress everything adds |
| `sawDecay` | null | Belief strength kept per day for what they saw: null is the square root of `beliefDecay` |

A person's own `tune: { reverie: { breaks, forgetting, feelings, stress } }` multiplies the knobs for them. The finer numbers, each explained in [Tuning](../tuning.md#reverie): `stackMul` (0.8), `feelingStress` (0.5), `needEmotion` (0.7), `needEmotionWeight` (0.8), `stressShortWeight` and `stressLongWeight` (0.6), `stressCarry` (0.15), `strainAt` (0.6), `strain` (0.02), `memoryImportance` (5), `memoryFloor` (0.5), `coreRecalls` (3), `coreImportance` (7), `coreChance` (1/3), `breakRank` (4), `breakDone` (0.5), `catharsisKeep` (0.7), `againstPull` (0.8), `againstFloor` (0.05), `againstStress` (0.3). During play, `world.tune('reverie', { ... })` changes any of them as an input.

## With other modules

- **Fellowship**: mood colors how much people warm to each other when they meet. A file on someone counts as knowing them.
- **Wormtongue**: witnesses get `did:<actor>:<kind>` beliefs, a memory and the `witnessed` feeling; gossip moves beliefs between people; silencing marks beliefs silenced; scaring gives `scared`.
- **Mentat**: methods' conditions read beliefs (`thinks:open:workshop`); a plan goes to a place believed open, and learns (`open:<place>` = false, seen) when it's shut; a plan given up gives `frustrated`.
- **Cityspeak**: lines can read mood, beliefs and files; the room's mood is the mean of the people in it.
- **Ceres**: missing rent gives `behind_on_rent`, and the landlord believes `behind:<id>`.
- **Cradle**: a departure gives grief and a `loss` memory to those who cared.
- **Joi**: the prompt includes mood, emotion, feelings, memories and the file on the listener.

## Example

```js
const rv = world.reverie;
rv.feeling({ id: 'good_meal', label: 'A good meal', weight: 0.08, minutes: 4 * 60, emotion: 'happy' });
rv.feeling({ id: 'lonely', label: 'Lonely', weight: -0.1, minutes: 12 * 60, emotion: 'sad', boost: { social: 1.5 } });
rv.memoryKind({ id: 'saw:theft', importance: 6, shifts: { honesty: 0.05 } });
world.action({ id: 'eat_out', at: 'tag:food', slot: 'seat', minutes: 40, relieves: { hunger: 0.6 }, feels: ['good_meal'], tags: ['social'] });

rv.feel('kofi', 'lonely');                      // social actions now weigh 1.5 times as much for him
world.deed('snubbed', { feeling: 'wronged', regard: -0.2, memory: 4 });
world.did('player', 'snubbed', { for: 'kofi' });
rv.emotion('kofi');                             // 'angry' or 'sad', whichever weighs more
world.lang.test('file:player.snubbed>0', world.ctx(world.get('kofi')));   // true
```
