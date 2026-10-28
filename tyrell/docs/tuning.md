# Tuning

Every number that shapes what people do, feel, remember and say, and how their relationships and beliefs move, is a setting a game can change: how often people have breaks, how quickly they make friends, how fast they forget, how readily they gossip or report a crime. There are three places to change them:

- **At creation**: the core's in `Tyrell.create({ config })`, each module's in `moduleConfig: { reverie: { ... }, ... }`.
- **Per person**: a person's own pace for the headline knobs, in their definition (`tune`).
- **During play**: `world.tune(module, values)`, an input, so time walk replays it and saves keep it.

Every setting defaults to what Tyrell always did, and every headline knob to 1, so a world made with no settings is exactly the world it was before they were settings, byte for byte.

- [The headline knobs](#the-headline-knobs)
- [An example](#an-example)
- [Per person](#per-person)
- [During play](#during-play)
- [Every setting](#every-setting): [Core](#core), [Reverie](#reverie), [Fellowship](#fellowship), [Wormtongue](#wormtongue), [Cityspeak](#cityspeak), [Voice](#voice), [Bree](#bree), [Mentat](#mentat), [Gaff](#gaff), [Ceres](#ceres), [Cradle](#cradle), [Athelas](#athelas), [Delos](#delos), [Joi](#joi)

## The headline knobs

A headline knob is a plain multiplier on a whole behavior, for a game that wants "friendships form faster" without knowing which numbers make friendships. Each is 1 by default (multiplying by 1 changes nothing), 2 is twice as much or as often, 0.5 half, and 0 switches the behavior off. Most can be had per person too: the world's knob times the person's own.

| Module | Knob | What it scales | Per person |
|---|---|---|---|
| Core (`config`) | `needs` | How fast every need rises: 2 and people eat, sleep and seek company twice as often | yes |
| | `habits` | How fast habits form and fade (`habitFast`, `habitSlow`, `habitDrift`); 0 freezes them | yes |
| | `learning` | How fast skills are learned (every skill's rate, on top of talents); 0 learns nothing | yes |
| | `wishes` | How often wishes and dreams come (`wishChance`); 0 brings none | yes |
| | `crowds` | How many strangers pass each hour (every region's `perHour`) | no |
| Reverie | `breaks` | How often breaks come, at a mood under a threshold; 0 never | yes |
| | `forgetting` | How fast memories and beliefs fade (`memoryDecay` over the hours, `beliefDecay` and `sawDecay` over the days); 0 never | yes |
| | `feelings` | How much feelings move the mood (each feeling's weight in it) | yes |
| | `stress` | How much stress everything adds (bad feelings, acting against their values) | yes |
| Fellowship | `friendship` | How fast friendships and enmities form: the regard each meeting adds or takes away | yes (the one whose regard it is) |
| | `romance` | How fast attraction grows from time together | yes |
| | `fading` | How fast relationships fade: regard drifting back to nothing, and how soon faint acquaintances are forgotten | yes |
| Wormtongue | `gossip` | How readily gossip spreads: the chance per meeting that someone passes something on | yes (the teller) |
| | `reporting` | How readily crimes are reported: the chance a witness reports | yes (the witness) |
| | `heat` | How much heat each report adds | yes (the actor, if a person) |
| | `cooling` | How fast heat cools (`heatDecay` over the days) | yes (the actor, if a person) |
| | `lies` | How readily a dishonest teller shifts the blame (`lieChance`) | yes (the teller) |
| Cityspeak | `chatter` | How chatty people in view are: the chance a meeting starts a bark exchange, and how long it runs. Barks change nothing in the world, so neither does this | yes (both people's) |
| Voice | `chatter` | How chatty the one talked to is: how many beats they'll talk for (patience), and how readily they raise something of their own | yes |
| Bree | `warmth` | How much good exchanges warm people: the regard (and attraction) a good one gives | yes (the one whose regard it is) |
| | `quarrels` | How readily people quarrel: the regard a bad exchange takes away, and how appealing hostile kinds are when they meet | yes (whose regard it is; the one who'd pick the quarrel) |
| | `escalation` | How readily a sour turn becomes an argument, and an argument a fight; 0 nothing escalates | yes (the one who'd escalate) |
| | `grudges` | How much a bad exchange leaves a grudge; 0 none | yes (the one who'd hold it) |
| | `forgiveness` | How readily people forgive: how fast grudges fade, and how much an apology or making up takes off them; 0 nobody forgives | yes (the one who holds the grudge) |
| | `talk` | How often people strike up exchanges when they meet, and how long they talk; 0 nobody does on their own | yes (both people's) |
| Mentat | `persistence` | How long people keep at a plan: the replans before they give up (`maxTries`) | yes |
| | `scruples` | What their scruples cost a way of getting something: the extra cost of illegal ways and of ways against their values (the very honest and the devout still never do them) | yes |
| Gaff | `events` | How often storylets fire on their own | no |
| | `intensity` | How much a firing raises its subject's intensity | no |
| Ceres | `prices` | How much prices put people off (the price factor); 0: price is no object | yes |
| Cradle | `courtship` | How readily couples form on their own (`autoPair`'s thresholds are divided by it) | yes (each side's own) |
| | `births` | How often couples have children (`fertility`) | yes (both partners') |
| | `deaths` | How likely people are to die of old age | yes |
| Athelas | `contagion` | How catching courses are (every course's chance per hour together) | yes (the one who might catch it) |
| | `duration` | How long courses last (every phase's minutes) | yes (the one who has it) |
| Delos | `mutation` | How often genomes mutate: trait jumps, gifts and every gene's `mutate` | no |
| | `variation` | How far children stray from their parents (every blended value's noise); 0: a child is exactly the blend | no |

Joi has no headline knob: it never changes the world. `Tyrell.CORE_KNOBS` and each module's `knobs` list them, with `'person'` or `'world'` for whether a person can have their own.

## An example

```js
const world = Tyrell.create({
  seed: 'my-town',
  config: { needs: 1.2 },                                   // a hungrier, sleepier town
  moduleConfig: {
    fellowship: { friendship: 1.5, fading: 0.5 },           // friends sooner, and for longer
    wormtongue: { gossip: 0.7, reporting: 1.5 },            // discreet, but law-abiding
    reverie: { breaks: 0.5, minor: [0.3, 6] },              // a knob and a finer setting together
  },
});

world.person('kofi', { name: 'Kofi', tune: { fellowship: { friendship: 2 }, cityspeak: { chatter: 1.5 } } });

// an options screen: a slider for how much the town gossips
slider.onchange = (v) => world.tune('wormtongue', { gossip: v });
world.tuning('wormtongue').gossip;                         // what's in force now
```

Rocinante shows the same with `buildRocinante(Tyrell, { tuned: true })`: friendships form half as fast again and fade half as fast, Kofi makes friends twice as fast, Sam gossips, lies and snaps, and Ruth forgets nothing in a hurry. It also takes `moduleConfig`, over its own.

## Per person

A person's definition can carry their own pace for the headline knobs, by module (`'core'` for the core's):

```js
world.person('sam', { tune: { wormtongue: { gossip: 1.5, lies: 2 }, reverie: { breaks: 2 }, core: { needs: 0.8 } } });
```

What applies to them is the world's knob (as declared and tuned) times their own; leave a knob out and it's 1. Only the knobs marked per person in the table above can be had this way: the others aren't anyone's (a storylet, a stranger, a newborn's genome). When a knob involves two people, the table says whose counts: regard is the holder's (`friendship` for Kofi's regard for Sam is Kofi's), gossip and lies are the teller's, reporting the witness's, contagion the catcher's; a couple's `births` is both partners' together, and a bark exchange's `chatter` is both people's.

Like the rest of a definition, `tune` is saved with the person (a saved person keeps the definition they had). To change it during play, use `world.tune(module, values, id)`.

`world.tuning(module, id)` gives the knobs as they apply to someone: `world.tuning('reverie', 'sam')` is `{ breaks: 2, forgetting: 1, feelings: 1, stress: 1 }` (the world's times Sam's own).

## During play

The settings are definitions, not state: changing `world.config` or a module's `config` by hand mid-game would be lost on a load and missed by a rewind, which replays history with whatever is current. To change them during play (a difficulty setting, a slider, a story beat that makes the town paranoid), use `world.tune`:

```js
world.tune('fellowship', { friendship: 2 });          // any setting of a module, by name
world.tune('core', { needs: 1.5, wishChance: 0.8 });   // the core's ('core')
world.tune('wormtongue', { reportDelay: [5, 20] });    // finer settings too, not only the knobs
world.tune('fellowship', { friendship: null });        // back to what was declared
world.tune('fellowship', null);                        // the whole module back
world.tune('reverie', { breaks: 0.5 }, 'sam');         // one person's own knobs (their `tune`)
```

- **It's an input.** Esper records it and replays it at the moment it was made: rewind past it and it's undone, play forward and it comes again; a new one in the past starts a new timeline (`branch`), as any input does.
- **It's state.** The overrides are kept in `world.s.tune` (a person's in their definition), plain JSON, so `world.save()` keeps them and `world.load()` brings them back. Nothing is kept until something is tuned, and putting everything back removes it again.
- **It's over what was declared.** The setting in force is the override if there is one, else what the game declared at creation (which it declares again on every start). `world.config` and `world.reverie.config` stay as declared; `world.tuning(module)` shows what's in force, and `world.cfg` is the core's config in force.
- **It checks what it's given.** The module must be switched on, the setting must exist, and the value must be plain data of the same kind as the default (a number for a number, a list for a list); a person's knobs must be numbers, 0 or more. Otherwise it throws, and nothing is recorded. `minutesPerSecond` and `budgetMs` aren't tuned: they change nothing that happens, so set `world.config` directly.
- **Needs keep their rise.** Changing how fast needs rise (`needs`) keeps everyone's rise so far first, as a course does, so levels don't jump.
- **Some things are worked out from when they were last set.** A memory's fade, stress, heat, a pastime's tolerance and a skill's slipping are kept as a value and a time, and worked out when they're read. A new pace for one of them applies to the whole time since then (a memory made yesterday fades, from today, as if the new pace had held since yesterday). Anything drawn when it starts (a course's phase, a report's delay) keeps its draw.

Tuning from inside a listener waits for the engine's current work, like any input.

## Every setting

Each table lists a part's settings: the name, the default, and what it does and which way to turn it. Headline knobs are marked **knob**.

### Core

`Tyrell.create({ config: { ... } })`; during play, `world.tune('core', { ... })`. See [Deciding](deciding.md#config) for how the decision settings work together.

| Setting | Default | What it does |
|---|---|---|
| `minutesPerSecond` | 1 | Game minutes per real second at speed 1 (`world.tick`). Set it directly at any time |
| `week` | 7 | Days in a week, for routine variants and job days |
| `urgent` | 0.85 | A need above this is urgent and lifts what meets it above routines (a need's `urgent` overrides it). Lower: needs break routines sooner |
| `urgentRank` | 1.5 | The rank an urgent need lifts an option to |
| `desperateRank` | 2.5 | The rank a desperate need lifts an option to, plus `desperateSlope` a point past `desperate` |
| `storyRank` | 3 | The rank of a directive that doesn't say its own |
| `jobRank` | 2 | The rank of a shift's work. Under `desperateRank`, so the desperate leave work; over `urgentRank`, so the merely urgent don't |
| `routineRank` | 1 | The rank of a routine entry that doesn't say its own |
| `cut` | 0.25 | Options under this share of the best weight are dropped. Higher: people pick the obvious more often |
| `top` | 3 | At most this many options go into the draw |
| `power` | 2 | The draw is weighted by weight to this power. Higher: more predictable; lower: more varied |
| `inertia` | 1.15 | Bonus for carrying on with what they're doing. Higher: people stick at things |
| `repeat` | 0.75 | Multiplier for choosing the same thing again soon after (within `repeatWindow`). Lower: more variety |
| `travelScale` | 30 | Travel factor `1 / (1 + minutes / travelScale)`. Lower: people stay nearer home |
| `placesPerAction` | 4 | How many places (nearest first) are weighed per action |
| `idle` | 20 | Minutes someone with nothing to do waits before thinking again |
| `backoff` | 15 | Minutes an action is ruled out at a place after it failed there |
| `budgetMs` | 4 | Milliseconds of simulation per `world.tick` frame. Set it directly at any time |
| `logSize` | 1000 | Westmarch log entries kept |
| `decisions` | 12 | Decisions Palantír keeps per person |
| `checksOnce` | false | A check (a boundary or an urge) already queued for someone at a moment isn't queued again, so each moment is thought over once |
| `habitFast` | 0.25 | How fast the fast habit weight learns from how a go turned out |
| `habitSlow` | 0.05 | How fast the slow weight follows the fast one |
| `habitDrift` | 0.02 | How far the fast weight is pulled back toward 1 each time it learns. Higher: habits fade sooner; 0 with `habitFast` and `habitSlow` 0 leaves only the game's rewards to move them |
| `habitMin` | 0.25 | Lowest habit weight |
| `habitMax` | 4 | Highest habit weight |
| `compensate` | true | Compensate considerations for their number (IAUS) |
| `pallGain` | 0.35 | Tolerance one go at a pastime adds (a pastime's `gain` overrides it) |
| `pallDecay` | 0.08 | Tolerance lost per hour (a pastime's `decay` overrides it) |
| `pallPenalty` | 0.6 | The share of a pastime's appeal lost at full tolerance (a pastime's `penalty` overrides it) |
| `wishMax` | 2 | Wishes held at once, not counting a dream |
| `wishHours` | `[8, 13, 17]` | The hours a new wish (or dream) may come |
| `wishChance` | 0.5 | The chance of one at each of those hours |
| `wishMinutes` | 2160 | Minutes before an unmet wish fades (a wish's `minutes` overrides it) |
| `wishPull` | 1.35 | How much more a wish's `toward` options weigh (a wish's `pull` overrides it) |
| `needs` | 1 | **knob** How fast every need rises |
| `habits` | 1 | **knob** How fast habits form and fade |
| `learning` | 1 | **knob** How fast skills are learned |
| `wishes` | 1 | **knob** How often wishes and dreams come |
| `crowds` | 1 | **knob** How many strangers pass each hour (the world's only) |
| `traitDefault` | 0.5 | The trait someone has when their definition doesn't give it (the `trait` term, and every module that reads traits: honesty, courage, thrift...) |
| `needStart` | 0.2 | Where a need starts, for one with no `start` |
| `needCurve` | `'pow1.5'` | The curve a need's level goes through to make its urgency, for one with no `curve` |
| `reliefFloor` | 0.05 | An option's relief for a need counts as no more than the need's level, but at least this. Higher: needs nearly met still pull |
| `liftRelief` | 0.3 | An urgent need lifts an option's rank only if it relieves at least this much. Lower: smaller things break routines |
| `desperate` | 0.97 | A need this high (or its `urgent`, if higher) is desperate: it lifts options above work |
| `desperateSlope` | 10 | Rank added per point of level past `desperate`, so the starving wake the exhausted |
| `habitBest` | 2 | A go counts as at most this many times as good as expected when habits learn |
| `habitDone` | 0.2 | The share of a go that must be done for habits to learn from it |
| `nudgeSlow` | 0.25 | The share of a reward (`world.reward`) that reaches the slow habit |
| `pallFrom` | 0.05 | Below this tolerance a pastime doesn't pall at all |
| `pallDone` | 0.2 | The share of a go at a pastime that must be done for it to add tolerance |
| `repeatWindow` | 90 | Minutes after doing something that choosing it again counts as `did it last` |
| `targets` | 6 | Most people an action aimed at someone is weighed against at once |
| `meetMax` | 3 | Most people someone meets on starting something with others about (regard, gossip, colds all come from meetings). Higher: news and colds travel faster in crowds |
| `meetMinutes` | 3 | The shortest time together, in minutes, that counts as meeting |
| `awayNeeds` | 0.4 | Coming back from away, needs are at most this |
| `skillRate` | 0.02 | Level gained per hour of practice, for a skill with no `rate` |
| `skillGrace` | 3 | Days without practice before a skill with `decay` starts to slip, for one with no `grace` |

### Reverie

`moduleConfig: { reverie: { ... } }`. See [Reverie](modules/reverie.md).

| Setting | Default | What it does |
|---|---|---|
| `base` | 0.6 | The mood with no feelings and needs met |
| `needWeight` | 0.25 | How much unmet needs drag the mood |
| `emotionFloor` | 0.08 | An emotion shows only above this strength; under it they're `fine` |
| `minor` | `[0.35, 4]` | Under this mood a minor break can come, on average this many days apart. Raise the mood to make them commoner |
| `major` | `[0.2, 0.8]` | The same for major breaks |
| `extreme` | `[0.08, 0.5]` | The same for extreme breaks |
| `memoryCap` | 24 | Memories kept (not counting core ones); the weakest goes |
| `coreCap` | 8 | Core memories kept |
| `memoryDecay` | 0.995 | Memory strength kept per game hour. Lower: they forget faster |
| `beliefFloor` | 0.05 | Beliefs weaker than this are forgotten |
| `beliefDecay` | 0.97 | Belief strength kept per day, for what they were told. Lower: they forget faster |
| `stressShort` | 720 | Half-life of short-term stress, in minutes |
| `stressLong` | 10080 | Half-life of long-term stress, in minutes |
| `breaks` | 1 | **knob** How often breaks come |
| `forgetting` | 1 | **knob** How fast memories and beliefs fade |
| `feelings` | 1 | **knob** How much feelings move the mood |
| `stress` | 1 | **knob** How much stress builds |
| `stackMul` | 0.8 | Each extra stack of a feeling counts this share of the one before, for a feeling with no `stackMul` |
| `feelingStress` | 0.5 | A bad feeling with no `stress` adds this share of its weight as stress |
| `needEmotion` | 0.7 | A need over this level shows as its emotion (hunger as `irritable`) |
| `needEmotionWeight` | 0.8 | How strongly, per point over |
| `stressShortWeight` | 0.6 | How much short-term stress counts in stress |
| `stressLongWeight` | 0.6 | How much long-term stress counts |
| `stressCarry` | 0.15 | The share of new stress that also goes to the long term |
| `strainAt` | 0.6 | While short-term stress is over this, each new stress adds `strain` more to the long term |
| `strain` | 0.02 | See `strainAt` |
| `memoryImportance` | 5 | The importance of a memory with none given and no kind to say |
| `memoryFloor` | 0.5 | At midnight, memories (not core ones) weaker than this are forgotten |
| `coreRecalls` | 3 | Recalls before an important memory may become a core memory |
| `coreImportance` | 7 | The least importance a memory needs to become a core memory |
| `coreChance` | 1/3 | The chance, each recall past that, that it does |
| `sawDecay` | null | Belief strength kept per day for what they saw themselves. null: the square root of `beliefDecay` (it fades half as fast) |
| `breakRank` | 4 | The rank a break comes at: above everything else |
| `breakDone` | 0.5 | The share of a break that must be done for it to bring catharsis |
| `catharsisKeep` | 0.7 | The share of long-term stress kept after a break (short-term stress goes) |
| `againstPull` | 0.8 | An action against a value they hold weighs `1 - held × againstPull`. Higher: values hold people back more |
| `againstFloor` | 0.05 | ...but never less than this |
| `againstStress` | 0.3 | Stress, per point of the values held, of starting an action against them |

### Fellowship

`moduleConfig: { fellowship: { ... } }`. See [Fellowship](modules/fellowship.md).

| Setting | Default | What it does |
|---|---|---|
| `meetGain` | 0.03 | Regard gained per half hour together, before compatibility and mood |
| `compatSpread` | 0.6 | How much compatibility varies between pairs (0..1) |
| `decay` | 0.004 | Regard drifts back toward nothing by this much a day |
| `sentiments` | 4 | Most sentiments kept per relationship |
| `imitation` | 0.03 | How much a liked person's habits rub off |
| `forget` | 14 | Days after their last meeting that a faint acquaintance is forgotten; 0 forgets nobody |
| `forgetBelow` | 0.05 | How faint a relationship has to be to be forgotten |
| `labels` | the standing table | Standing labels, rows by fame band, columns by infamy band |
| `friendship` | 1 | **knob** How fast friendships and enmities form |
| `romance` | 1 | **knob** How fast attraction grows from time together |
| `fading` | 1 | **knob** How fast relationships fade |
| `friendAt` | 0.5 | The `friend` term: regard at least this |
| `foeAt` | -0.4 | The `foe` term: regard at most this |
| `likeAbove` | 0.2 | `friends()`: the people liked more than this |
| `compatValues` | 0.3 | How much shared values add to compatibility |
| `meetMin` | -0.05 | The most one meeting can take away from regard |
| `meetMax` | 0.08 | The most one meeting can add |
| `meetCompat` | 1 | How much compatibility colors a meeting: the gain is `meetGain × (1 + compat × meetCompat + (mood - 0.5) × meetMood)` per half hour |
| `meetMood` | 1 | How much mood colors a meeting. Higher: the gloomy make enemies |
| `attractAt` | 0.3 | Time together grows attraction only between people more compatible than this |
| `attractGain` | 0.5 | Attraction grown per point of regard gained |
| `imitateAt` | 0.3 | Habits rub off only from people whose regard is over this |
| `socialRegard` | 0.8 | A social action aimed at someone weighs `1 + regard × socialRegard + compat × socialCompat`. Higher: people seek out those they like |
| `socialCompat` | 0.2 | See `socialRegard` |
| `socialMin` | 0.1 | ...at least this |
| `socialMax` | 2 | ...at most this |
| `deedSentiment` | 0.1 | A deed's sentiment, when the deed moves no regard, holds this much |
| `witnessRegard` | 0.4 | Witnesses to a deed take this share of its regard |
| `bands` | `[0.15, 0.4, 0.7]` | Where fame and infamy pass into the next band of `labels` |

### Wormtongue

`moduleConfig: { wormtongue: { ... } }`. See [Wormtongue](modules/wormtongue.md).

| Setting | Default | What it does |
|---|---|---|
| `reportChance` | 0.6 | The chance a witness reports a crime, before temperament (a crime's `report` overrides it) |
| `reportDelay` | `[10, 90]` | Minutes before a report is made |
| `recognizeStranger` | 0.5 | The chance of recognizing someone they don't know |
| `gossipChance` | 0.45 | The chance per meeting that someone passes something on, before talkativeness |
| `maxHops` | 3 | Gossip goes at most this many tellings from whoever saw it |
| `heatDecay` | 0.85 | Heat kept per day |
| `lieChance` | 0.5 | The chance a dishonest teller who dislikes the subject lies |
| `gossip` | 1 | **knob** How readily gossip spreads |
| `reporting` | 1 | **knob** How readily crimes are reported |
| `heat` | 1 | **knob** How much heat each report adds |
| `cooling` | 1 | **knob** How fast heat cools |
| `lies` | 1 | **knob** How readily liars shift the blame |
| `heatPerSeverity` | 10 | Heat a report adds per point of the crime's severity, for a crime with no `heat` |
| `heatFloor` | 0.05 | Heat under this is let go at midnight |
| `sawStrength` | 0.3 | A belief from seeing something is at least this strong, however unclear |
| `crimeMemory` | 4 | A witness's memory of a crime is this important... |
| `severityMemory` | 6 | ...plus this per point of severity |
| `plainMemory` | 3 | The importance of a memory of seeing anything else |
| `fearWeight` | 0.3 | How much fear (1 - courage) puts a witness off reporting |
| `loyalty` | 0.8 | How much liking the actor keeps a witness quiet |
| `crimeSeen` | 0.8 | How clearly bystanders see a crime someone commits (an action's `crime`) |
| `infamyAuthority` | 0.2 | Infamy a report adds per point of severity, with the group it went to |
| `infamyGroups` | 0.1 | ...and with the witness's own groups |
| `toldAuthority` | 0.8 | How strongly the authority believes what a report tells it |
| `bribeGreed` | 0.6 | A bribe's chance: `greed × bribeGreed + (amount, up to bribeFull) / bribeFull × bribeMoney - honesty × bribeHonesty + bribeBase` |
| `bribeFull` | 100 | The amount at which a bribe counts in full |
| `bribeMoney` | 0.5 | See `bribeGreed` |
| `bribeHonesty` | 0.4 | See `bribeGreed` |
| `bribeBase` | 0.1 | See `bribeGreed` |
| `scareFear` | 0.8 | A threat's chance: `(1 - courage) × scareFear - honesty × scareHonesty + scareBase` |
| `scareHonesty` | 0.2 | See `scareFear` |
| `scareBase` | 0.1 | See `scareFear` |
| `scareRegard` | -0.3 | The regard a threat costs |
| `secretSpite` | -0.3 | A secret is passed on only by someone whose regard for its subject is under this |
| `juicyCrime` | 3 | How much more worth telling a crime is than other news |
| `juicyDeed` | 1.5 | ...and any other deed |
| `gossipRecency` | 0.99 | News keeps this much of its worth an hour |
| `liarBelow` | 0.3 | Someone lies only with honesty under this... |
| `lieSpite` | -0.3 | ...about someone their regard for is under this... |
| `scapegoat` | -0.2 | ...onto someone their regard for is under this |
| `trustBase` | 0.6 | How far a listener trusts a teller: `trustBase + regard × trustRegard`, from `trustMin` to `trustMax` |
| `trustRegard` | 0.4 | See `trustBase` |
| `trustMin` | 0.2 | See `trustBase` |
| `trustMax` | 1 | See `trustBase` |
| `trustAlone` | 0.7 | The trust without Fellowship |
| `toldKeep` | 0.9 | The share of a belief's strength that survives a telling, before trust |
| `exposedAt` | 4 | A secret counts as exposed once this many know it |

### Cityspeak

`moduleConfig: { cityspeak: { ... } }`. See [Cityspeak](modules/cityspeak.md).

| Setting | Default | What it does |
|---|---|---|
| `chatter` | 1 | **knob** How chatty people in view are: the chance a meeting starts a bark exchange (at most 1) and the lines it runs to (`barkLength × chatter`, rounded, at least 1); 0 none |
| `barkGap` | 2.2 | Seconds between lines in a bark exchange (`cityspeak.barkGap` sets it too) |
| `barkLength` | 3 | Most lines in one exchange (`cityspeak.barkLength` sets it too) |
| `barkCooldown` | 60 | Minutes before someone barks the same line again, for a line with no `cooldown` |
| `practiceBoost` | 1.5 | How much more appealing role actions are, for a practice with no `boost` |
| `socialDone` | 0.5 | The share of an action with a `social` act that must be done for it to be resolved |
| `roomEmpty` | 0.5 | The mood of a room with nobody in it, before the practices' tone |

### Voice

`moduleConfig: { voice: { ... } }`. See [Voice](modules/voice.md).

| Setting | Default | What it does |
|---|---|---|
| `offers` | 3 | Subjects offered at once |
| `choices` | 3 | Answers offered at once (besides letting it lie and goodbye) |
| `theirs` | 0.3 | The chance, at the start and between subjects, that they raise something of their own |
| `patience` | 8 | Beats before they've had enough, unless `voice.patience` says otherwise |
| `fresh` | 10080 | Minutes a line said to someone is passed over for a fresher one |
| `strong` | 2 | A landing this strong (either way) runs `onWell` or `onBadly`, and draws a reaction |
| `onWell` | `[]` | Effects when an approach lands strongly well |
| `onBadly` | `[]` | Effects when it lands strongly badly |
| `greet` | `'greet'` | The greeting's line topic |
| `bye` | `'bye'` | Their goodbye's line topic |
| `close` | `'close'` | Their closing's, when patience runs out |
| `react` | `'react'` | The prefix of reactions' topics |
| `deed` | null | A deed recorded when a talk ends |
| `chatter` | 1 | **knob** How chatty they are: patience times it (rounded, at least 1), and `theirs` times it |
| `warmthRegard` | 3 | The default warmth a talk starts with: regard × this, rounded... |
| `warmthMin` | -1 | ...at least this... |
| `warmthMax` | 3 | ...at most this |
| `familiarTalk` | 0.5 | `familiarity`: this much for each talk... |
| `familiarLearned` | 1 | ...and this for each thing learned about them |
| `cooldown` | 4320 | Minutes a subject takes to come round fresh again, for a thread with no `cooldown` |
| `soreDays` | 2 | Days a subject stays sore after `sore` with no number |
| `soreWeight` | 0.1 | A sore subject is worth this share of its weight |
| `revealPull` | 1.5 | A subject for learning something not yet learned is worth this much more |
| `salientFloor` | 0.05 | Subjects worth less than this aren't offered |
| `variety` | 0.2 | Up to this much is added to each subject's worth, the same for a pair all day |
| `promiseDays` | 3 | Days before a promise comes due, for one with no `days` |
| `promiseKeep` | 30 | Days a settled promise is remembered (the `promise:` term reads it) |

### Bree

`moduleConfig: { bree: { ... } }`. See [Bree](modules/bree.md). The parts of how an exchange lands are each a weight on a score from the listener's side; the outcome tables (`regard`, `attraction`, `grudge`, `mends`, `feel`, `memory`) are keyed by outcome (`warm`, `good`, `fine`, `awkward`, `sour`, `row`).

| Setting | Default | What it does |
|---|---|---|
| `warmth` | 1 | **knob** How much good exchanges warm people: the regard and attraction a good one gives, times it |
| `quarrels` | 1 | **knob** How readily people quarrel: the regard a bad exchange takes away, and the appeal of hostile kinds on meeting, times it |
| `escalation` | 1 | **knob** How readily a sour turn becomes an argument and an argument a fight |
| `grudges` | 1 | **knob** How much a bad exchange leaves a grudge |
| `forgiveness` | 1 | **knob** How fast grudges fade, and how much an apology or making up takes off them |
| `talk` | 1 | **knob** How often people strike up exchanges when they meet, and how many turns they talk for |
| `strike` | 0.3 | The chance a meeting starts an exchange, before `talk`. Higher: a chattier town |
| `quiet` | `['sleep']` | Action tags during which nobody strikes up an exchange, joins one or keeps one going |
| `needPull` | 2 | A kind that relieves a pressing need is more appealing: weight × (1 + relief × urgency × `needPull`) |
| `traits` | each role's `trait.<role>` | The term each trait role is read from (`temper`, `warmth`, `humor`, `patience`, `courage`, `forgiveness`, `talkative`): map them to the game's own traits |
| `scale` | `[2, 0.75, -0.75, -1.75, -3]` | The least score for warm, good, fine, awkward and sour; under the last, a row. Lower them all: things go better |
| `spread` | 1.5 | The luck of a turn: up to this much either way. Higher: more surprises |
| `regardWeight` | 2 | How much the listener's regard for the speaker counts |
| `compatWeight` | 1 | How much compatibility counts |
| `moodWeight` | 1 | How much the listener's mood counts, a point from the middle |
| `stressWeight` | 1 | How much the listener's stress takes away |
| `needWeight` | 2 | How welcome a kind that meets a pressing need is |
| `attractWeight` | 3 | How much attraction counts for romantic kinds |
| `grudgeWeight` | 3 | How much a grudge or a feud against the speaker takes away |
| `rowWeight` | 2 | How much a row between them lately takes away... |
| `rowMinutes` | 1440 | ...fading over this many minutes |
| `roomWeight` | 0.5 | How much the mood of the room counts (Cityspeak) |
| `topicWeight` | 1 | How much the topic being to the listener's taste counts |
| `mannerWeight` | 1 | How much the speaker's manner counts |
| `sway` | 0.4 | How far each turn moves an exchange's running score toward its own. Higher: one bad turn spoils more |
| `regard` | warm 0.04, good 0.02, fine 0.005, awkward -0.01, sour -0.03, row -0.08 | Regard each of them gains or loses for the other, by outcome (a kind's `regard` multiplies it) |
| `attraction` | warm 0.05, good 0.025, fine 0, awkward -0.01, sour -0.03, row -0.06 | Attraction moved by romantic kinds, by outcome |
| `grudge` | sour 0.1, row 0.25, else 0 | Grudges left, by outcome (a kind's `grudge` multiplies it) |
| `mends` | warm 1.5, good 1, fine 0.5, else 0 | The share of a kind's `mends` an outcome brings |
| `feel` | warm `good_talk`, sour and row `had_words`, long `long_chat`, left `snubbed` | Feelings by outcome when a kind says none of its own |
| `memory` | row 5 | Memories by outcome (and `long`): how important; none under 1 |
| `groupShare` | 0.5 | In a group, each pair takes this share of the regard |
| `longTurns` | 6 | An exchange this many turns long, fine or better, counts as long |
| `leftRegard` | -0.03 | Regard the one who walks off loses for the one they walk away from |
| `teachOver` | 0.2 | A lesson teaches only a skill the teacher is at least this much better at |
| `turns` | partner 8, kin 6, close 8, friend 5, acquaintance 3, stranger 2, rival 4, sour 2 | Turns a conversation runs to, by how the starter stands with the other |
| `bonds` | `[0.6, 0.3, 0.05, -0.15]` | The regard for close, friend, acquaintance and stranger; under the last, sour |
| `rivalAt` | 0.3 | Grudges (or a feud) this strong both ways make them rivals |
| `talkativeTurns` | 2 | Turns added a point of talkativeness above the middle, both together |
| `lowMood` | 0.35 | Either in a mood under this... |
| `lowMoodTurns` | 2 | ...and they talk this many turns fewer |
| `turnsJitter` | 1 | Up to this many turns more or fewer, drawn |
| `minTurns` | 2 | Turns at least... |
| `maxTurns` | 12 | ...and at most, before `talk` |
| `quickTurns` | 2 | Turns of a kind with no topics that doesn't say its own |
| `groupTurns` | 3 | Turns added for each member past two |
| `turnGap` | `[2, 4]` | Minutes between turns, drawn |
| `topicPull` | 0.5 | A topic to the speaker's taste is more likely raised: weight × (1 + fit × `topicPull`) |
| `topicCooldown` | 1440 | Minutes a topic takes to come round fresh again between the same two |
| `topicMemory` | 8 | Topics remembered per pair |
| `tellAt` | `'fine'` | News passes on when its telling lands at least this well |
| `trust` | 0.7 | Without Wormtongue, the share of a belief's strength a telling keeps |
| `shareWindow` | 60 | Two memories of the same kind this many minutes apart count as shared |
| `likeAbove` | 1.1 | A taste (an instinct or a habit) above this counts as something they love doing |
| `mannerJitter` | 0.1 | Up to this much added to each manner's fit, the same for each person always |
| `groupMax` | 5 | Most people in one exchange |
| `joinChance` | 0.5 | The chance someone at the same place joins a group exchange, times their `talk` |
| `joinRegard` | 0 | Only people whose regard for one of those talking is at least this join |
| `escalateAt` | `'sour'` | A turn this bad or worse can escalate, send someone off, and be seen |
| `escalateBase` | 0.25 | The chance the one hurt answers back harder: this... |
| `escalateTemper` | 0.5 | ...plus this a point of temper above the middle... |
| `escalateStress` | 0.5 | ...plus this a point of stress... |
| `escalateGrudge` | 0.6 | ...plus this a point of grudge against the speaker... |
| `escalateRegard` | 0.5 | ...less this a point of regard for them; times `escalation` |
| `calmBase` | 0.1 | The chance the other keeps their patience and calms it: this... |
| `calmPatience` | 0.6 | ...plus this times their patience... |
| `calmRegard` | 0.3 | ...plus this times their regard for the one hurt |
| `stepInBase` | 0.05 | The chance someone there steps in: this... |
| `stepInRegard` | 0.5 | ...plus this times their regard for whichever they like more... |
| `stepInCourage` | 0.3 | ...plus this a point of courage above the middle... |
| `stepInFrom` | 0.2 | ...if they like one of them at least this much |
| `mediateRegard` | 0.03 | Someone who steps in gains this much regard from both... |
| `mediateMends` | 0.1 | ...and takes this much off their grudges against each other |
| `leaveBase` | 0.3 | The chance the one hurt walks off instead: this... |
| `leaveTemper` | 0.35 | ...plus this times their temper... |
| `leaveRegard` | 0.3 | ...less this times their regard for the speaker... |
| `leaveSour` | 0.2 | ...plus this for each sour turn so far |
| `grudgeTemper` | 0.5 | A quick temper holds more of a grudge: × (1 + (temper - 0.5) × 2 × this) |
| `grudgeForgive` | 0.5 | A forgiving nature holds less: × (1 - (forgiveness - 0.5) × 2 × this) |
| `fade` | 0.04 | Grudge strength lost a day, at a middling nature... |
| `forgiveBase` | 0.5 | ...times this... |
| `forgiveTrait` | 1 | ...plus this times their forgiveness (and an apology's mending times the same) |
| `grudgeFloor` | 0.02 | Grudges and feuds weaker than this are let go at midnight |
| `feudAt` | 0.5 | Two people who hold grudges this strong against each other are in a feud |
| `feudFade` | 0.01 | Feud strength lost a day, times the world's `forgiveness` |
| `feudSpread` | 0 | A fight between people of two households sets the households feuding by this much; 0 never |
| `feudMends` | 0.5 | A making-up between members of feuding groups takes this share of what it mends off the feud |
| `avoidFrom` | 0.05 | Animosity weaker than this keeps nobody away |
| `avoidPlace` | 0.6 | An option at a place where someone they've a grudge against is weighs 1 - animosity × this... |
| `avoidTarget` | 0.8 | ...a social one aimed at them 1 - animosity × this... |
| `avoidFloor` | 0.1 | ...never under this |
| `hostilePull` | 1 | A hostile interaction aimed at them weighs 1 + animosity × this instead |
| `reconcileLabel` | `'made it up'` | The sentiment a grudge made up leaves... |
| `reconcileSentiment` | 0.05 | ...and how much it adds to regard, for good |
| `reconcileFeeling` | `'made_up'` | The feeling of making up |
| `reconcileMemory` | 5 | The importance of the memory it leaves |
| `seenAt` | `'sour'` | People about see an exchange that goes this badly or worse, and every escalation |
| `witnessStrength` | 0.8 | How strongly a witness believes what they saw |
| `witnessMemory` | 3 | The importance of a witness's memory |
| `witnessRegard` | 0.5 | A witness's regard for whoever started it moves by this share of what the outcome moves |
| `witnessFeeling` | `'saw_row'` | The feeling a witness gets |
| `recent` | 50 | Finished exchanges kept, for history and witnesses reported late |

### Mentat

`moduleConfig: { mentat: { ... } }`. See [Mentat](modules/mentat.md).

| Setting | Default | What it does |
|---|---|---|
| `maxTries` | 3 | Replans before giving up |
| `depth` | 3 | How deep `get:` looks |
| `priceWeight` | 1 | Minutes of effort one unit of money is worth, before thrift |
| `persistence` | 1 | **knob** How long people keep at a plan: `maxTries` times it; 0 gives up at the first failure |
| `scruples` | 1 | **knob** What scruples cost: the risk of illegal ways and the cost of ways against their values, times it |
| `giveUp` | 120 | Minutes, at least, before a task given up on is chosen again |
| `setAside` | 2 | Plans kept set aside at once |
| `stale` | 1440 | Minutes after it began that a set-aside plan is dropped rather than picked up again |
| `honestNever` | 0.8 | Illegal ways are never taken by someone this honest |
| `riskBase` | 60 | An illegal way costs `riskBase + honesty × riskHonesty + heat × riskHeat` minutes of effort more |
| `riskHonesty` | 300 | See `riskBase` |
| `riskHeat` | 20 | See `riskBase` |
| `valuesNever` | 0.9 | Ways against a value are never taken by someone who holds it this much |
| `valuesCost` | 200 | ...otherwise they cost `held × valuesCost` minutes more |

### Gaff

`moduleConfig: { gaff: { ... } }`. See [Gaff](modules/gaff.md).

| Setting | Default | What it does |
|---|---|---|
| `peakAt` | 0.7 | Intensity at which the build-up turns into a peak |
| `peakMinutes` | 240 | Minutes a peak lasts |
| `relaxMinutes` | 720 | Minutes of relaxing after the fade |
| `decay` | 0.04 | Intensity lost per hour |
| `events` | 1 | **knob** How often storylets fire on their own; 0 never (`trigger` still fires them) |
| `intensity` | 1 | **knob** How much a firing raises its subject's intensity |
| `bump` | 0.2 | How much a firing raises intensity, for a storylet with no `bump` |
| `relaxAt` | 0.4 | A fade turns to relaxing under this share of `peakAt` |

### Ceres

`moduleConfig: { ceres: { ... } }`. See [Ceres](modules/ceres.md).

| Setting | Default | What it does |
|---|---|---|
| `prices` | 1 | **knob** How much prices put people off; 0: price is no object (they still can't buy what they can't afford) |
| `priceShare` | 0.4 | A priced option weighs `1 - share × (priceShare + thrift × priceThrift)`, share being the price over what they have |
| `priceThrift` | 0.8 | See `priceShare`. Higher: the thrifty mind prices more |
| `priceFloor` | 0.05 | ...never less than this |

### Cradle

`moduleConfig: { cradle: { ... } }`. See [Cradle](modules/cradle.md).

| Setting | Default | What it does |
|---|---|---|
| `year` | 525600 | Minutes in a year (365 days) |
| `stages` | baby 0, child 3, teen 13, adult 18, elder 65 | Stages and the age (in years) each starts at |
| `lifespan` | `[72, 96]` | People die of old age between these ages |
| `fertility` | 0.25 | The chance per year a couple of the right age has a child |
| `fertile` | `[20, 42]` | The ages at which people have children |
| `autoPair` | `{ regard: 0.6, attraction: 0.5 }` | Couples form on their own when regard and attraction both ways reach these; null leaves it to the game |
| `courtship` | 1 | **knob** How readily couples form on their own (the thresholds divided by it, each for their own side); 0 never |
| `births` | 1 | **knob** How often couples have children; 0 never |
| `deaths` | 1 | **knob** How likely people are to die of old age; 0 never |
| `ageUnknown` | 30 | The age of someone with no `born` |
| `pairStages` | `['adult', 'elder']` | The stages that couple up on their own |
| `partnerSentiment` | 0.3 | The sentiment a couple holds for each other (`my partner`) |
| `childSentiment` | 0.5 | ...and parents for a newborn (`my child`) |
| `traitSpread` | 0.12 | A child's trait is their parents' average, give or take up to this (without Delos) |
| `griefAt` | 0.35 | Those whose regard for someone who leaves is at least this grieve |
| `pastLifespan` | 0.2 | The chance a day, on top, of dying once past the end of the lifespan |

### Athelas

`moduleConfig: { athelas: { ... } }`. See [Athelas](modules/athelas.md).

| Setting | Default | What it does |
|---|---|---|
| `contagion` | 1 | **knob** How catching courses are: every course's chance per hour together, times it; 0 nothing spreads |
| `duration` | 1 | **knob** How long courses last: every phase's minutes, times it, as the phase starts |

### Delos

`moduleConfig: { delos: { ... } }`. See [Delos](modules/delos.md).

| Setting | Default | What it does |
|---|---|---|
| `jump` | `{ chance: 0.12, by: 0.35 }` | A child's chance that one trait jumps by `by`, up or down |
| `gift` | `{ chance: 0.1, by: 0.4 }` | A child's chance of a natural gift: one talent raised by `by` |
| `mutation` | 1 | **knob** How often genomes mutate: trait jumps, gifts and every gene's `mutate`, times it |
| `variation` | 1 | **knob** How far children stray: every blended value's noise, times it |
| `traitBlend` | founders `[0.1, 0.9]`, bounds `[0, 1]`, cross 0.65, noise 0.1 | The defaults for a trait that doesn't say its own; give any of them, the rest stay |
| `talentBlend` | founders `[0.6, 1.4]`, bounds `[0.2, 2]`, cross 0.7, noise 0.08 | The same for talents |
| `instinctBlend` | founders `[0.8, 1.25]`, bounds `[0.5, 1.5]`, cross 0, noise 0.1 | The same for instincts |
| `lookBlend` | founders `[0, 1]`, bounds `[0, 1]`, cross 0.65, noise 0.1 | The same for looks |

### Joi

`moduleConfig: { joi: { ... } }`. See [Joi](modules/joi.md). Joi never changes the world, so these shape only the prompt and the wait.

| Setting | Default | What it does |
|---|---|---|
| `wants` | 0.6 | Needs over this go into the prompt as what they badly want |
| `memories` | 3 | How many of their strongest memories go into the prompt |
| `timeoutMs` | 2500 | Milliseconds to wait for the provider before the written line, unless `speak` is given its own |

## What isn't a setting

What's left in the code changes nothing a person does, or is the shape of a rule rather than a number to turn: rounding, small tolerances, units (a meeting's regard is counted per half hour, contagion per hour), lists kept for reading (reports, the ledger, a file's notes, social acts, storylets fired), guards against loops, how specific a line's conditions make it, and the neutral points of formulas (a mood of 0.5 adds nothing to a meeting; a trait of 0.5 is middling). The built-in feelings (`catharsis`, `grief`, `scared`...) and Ceres's `behind_on_rent` are definitions: declare your own with the same id to change them.
