# Bree

Interactions between people: a chat, a joke, a compliment, a flirt, an apology, an argument, a fight. Each is an exchange that comes out by degrees (warm, good, fine, awkward, sour or a row), runs over turns on topics in each one's manner, can turn into an argument and an argument into a fight, leaves grudges that fade and feuds that last, and can be made up. Named for the village of the Prancing Pony, where folk of every sort meet over a pint, talk, and now and then fall out.

The ideas come from Prom Week's social exchanges (an intent, a volition, an outcome that changes how two people stand), The Sims' social interactions (a menu of kinds, accepted or not by mood and relationship), RimWorld's social fights and opinions (an insult that turns into a fight, witnessed), Dwarf Fortress's grudges, Crusader Kings' rivalries and Dune's kanly (a feud between houses, both ways), and Merryfolk's natters and table talk (topics from what's true for two people, answers in each one's temper, friends talking long and strangers briefly, a sour answer sending someone off).

Beside [Cityspeak](cityspeak.md)'s social acts (asked and accepted or refused) and [Voice](voice.md)'s talks (the player's, with choices), Bree is for what passes between the people themselves, on screen and off. Social acts keep working as they did; Voice's approaches can be Bree's too.

- [Kinds](#kinds)
- [How words land](#how-words-land)
- [Outcomes by degrees](#outcomes-by-degrees)
- [Exchanges: when they happen](#exchanges-when-they-happen)
- [Conversations over turns](#conversations-over-turns)
- [Topics](#topics)
- [Manners](#manners)
- [Round a table](#round-a-table)
- [The words](#the-words)
- [Escalation, and what stops it](#escalation-and-what-stops-it)
- [Witnesses](#witnesses)
- [Grudges](#grudges)
- [Feuds](#feuds)
- [Avoidance](#avoidance)
- [Making up](#making-up)
- [The starter set](#the-starter-set)
- [State](#state)
- [API](#api)
- [Terms, effects, events and log](#terms-effects-events-and-log)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Carrying a game's own talk](#carrying-a-games-own-talk)
- [Example](#example)

## Kinds

A kind is a definition: declared on every start, it may hold functions. Nothing happens until the game declares some (or the [starter set](#the-starter-set)).

```js
const b = world.bree;
b.kind({ id: 'joke', base: 0.25, traits: { humor: 1.5, temper: -0.5 }, skill: { humor: 1 }, relieves: { fun: 0.1 }, escalates: 'argue',
  weight: [{ input: 'nature.humor', out: [0.1, 1.2] }] });
b.kind({ id: 'insult', tags: ['hostile'], to: ['regard<-0.2'], base: -2.5, traits: { temper: -1 }, grudge: 1.5, escalates: 'fight' });
b.kind({ id: 'apologize', to: ['grudged>0.05'], base: 0.5, traits: { forgiveness: 1.5 }, mends: 0.5, on: { sour: { feel: ['snubbed', null] } } });
```

`KindDef`:

| Field | Default | Meaning |
|---|---|---|
| `id` | required | |
| `label` | none | Words for it (memories use it) |
| `tags` | none | Free labels. Bree reads `'hostile'` (quarrels, avoidance) and `'romantic'` (attraction) |
| `who` | anyone | Conditions on the one who starts it (the other is the target) |
| `to` | anyone | Conditions on the other, read from the starter's side: `'regard>0.3'`, `'grudge>0.2'`, `'target.mood<0.4'` |
| `if` | none | Conditions on the moment and the place |
| `weight` | 1 | How appealing it is to strike up on meeting: a number, considerations (the starter's side) or a function. 0: only by an action, an escalation, an effect or the game |
| `relieves` | none | Needs it relieves for each of them, by the share of its turns they had; a pressing one makes it more appealing (`needPull`) and more welcome (`needWeight`) |
| `topics` | none | Topics that fit: ids, `'tag:<tag>'`, or `'*'` (any topic that doesn't name its kinds). With topics, it's a [conversation](#conversations-over-turns); without, a word and an answer |
| `turns` | by bond, or `quickTurns` | A number, `[min, max]`, or a function (the starter as the person, the other as target: the game's own reckoning) |
| `gap` | `turnGap` | Minutes between its turns, `[min, max]` |
| `group` | false | Others at the place can join in |
| `stays` | false | A group goes on without whoever leaves it, while two are left (a table someone gets up from); otherwise anyone leaving ends it |
| `base` | 0 | How it lands with the one spoken to, before anything else |
| `lands` | none | Rules from the listener's side (the listener as the person, the speaker as target), or a function, as Voice's approaches |
| `approach` | none | A Voice approach whose landing it takes too |
| `knack` | none | Rules from the speaker's side: their knack for it |
| `traits` | none | The listener's nature: trait role → how much each point above the middle adds (below takes away) |
| `skill` | none | The speaker's nature, the same way |
| `escalates` | none | What it turns into when it goes sour and they won't let it go |
| `regard`, `attraction`, `grudge` | 1 | Multipliers on what its outcome moves |
| `mends` | none | How much a good outcome takes off the other's grudge against the starter |
| `mutual` | false | It mends both ways |
| `deed` | none | A [deed](../integration.md#sensing-and-deeds) the starter does for the other when it goes well |
| `gives` | none | An item the starter gives the other when it goes well (struck up on meeting, only by someone who has one) |
| `owes` | none | Favors the starter owes the other when it goes well (Wormtongue) |
| `teaches` | none | Hours of practice the other gets, when it goes well, at the starter's best skill over theirs (by `teachOver`; struck up on meeting, only by someone who has one) |
| `crime` | none | The Wormtongue crime it is, if the game declares one: whoever's there witnesses it as it breaks out |
| `seen` | true | Whether people about see it go wrong |
| `on` | none | What each outcome does, by `warm` ... `row`, `long`, `left` and `end`: `{ feel?, sentiment?, memory?, then? }` ([below](#outcomes-by-degrees)) |
| `line` | its id | The start of its own steps' line topics |

"Goes well" means fine or better for the other.

**Trait roles.** Bree reads seven roles: `temper`, `warmth`, `humor`, `patience`, `courage`, `forgiveness` and `talkative`, each from a term the game maps it to (`config.traits`, by default `trait.<role>`): `{ humor: 'trait.wit' }`, or a term of the game's own. A role nobody maps reads as `config.traitDefault`. The `nature` term reads them: `nature.humor`.

## How words land

Every turn is scored from the side of whoever hears it: the listener, with the speaker as their target. The parts, each a setting's weight:

```
score = base + lands + approach + knack
      + Σ traits[role] × (listener's role - 0.5) × 2       + Σ skill[role] × (speaker's role - 0.5) × 2
      + regardWeight × regard (the listener's for the speaker)   + compatWeight × compatibility
      + attractWeight × attraction                         (romantic kinds)
      + moodWeight × (mood - 0.5) × 2                      - stressWeight × stress
      + needWeight × Σ relieves[need] × urgency            (a lonely listener welcomes a chat)
      - grudgeWeight × the listener's grudge or feud against the speaker
      - rowWeight × e^(-(minutes since their last row) / rowMinutes)
      + roomWeight × (the room's mood - 0.5) × 2           (Cityspeak)
      + topicWeight × the topic's fit for the listener      + mannerWeight × how the speaker's manner lands
      + the luck of the turn: (two draws - 1) × spread
```

The rules that are the kind's, the speaker's knack and the manner's (`lands`, `knack`) can read what's being said in `ctx.data`: `{ kind, step, topic, subject }`, so a game can say a grump's answers land badly but not their openings.

`world.bree.weigh(kind, speaker, listener, { topic?, subject?, manner?, place?, step? })` shows the parts without the luck, and where the score falls. It changes nothing.

## Outcomes by degrees

The scale (`scale`, `[2, 0.75, -0.75, -1.75, -3]`) says where a score falls: warm at 2 or more, good at 0.75, fine at -0.75, awkward at -1.75, sour at -3, a row below. Each turn has its own outcome (how those words landed), and the exchange keeps a running score that each turn moves `sway` (0.4) of the way toward its own: one bad turn spoils a good talk, but not all of it. Each one keeps a running score of what they heard too, so an exchange can go well for one and badly for the other: at the end, each one's own outcome decides what it leaves them.

What an exchange leaves each of them, by their outcome:

- **regard** for the other: `regard[outcome]` (warm 0.04, good 0.02, fine 0.005, awkward -0.01, sour -0.03, row -0.08) times the kind's `regard`; gains times the `warmth` knob, losses times `quarrels` (the one whose regard it is);
- **attraction**, for romantic kinds: `attraction[outcome]` times the kind's `attraction`, the same knobs;
- a **grudge**, for a bad one: `grudge[outcome]` (sour 0.1, row 0.25) times the kind's `grudge` ([Grudges](#grudges));
- a **feeling**: the kind's `on[outcome].feel` (one for each, or `[for the starter, for the other]`, `null` for none), else `feel[outcome]` (warm `good_talk`, sour and row `had_words`);
- a **memory**, kind `<kind>:<outcome>` about the other, as important as the kind's `on[outcome].memory`, else `memory[outcome]` (a row, 5);
- a **sentiment** the other keeps about the starter, if the kind's `on[outcome]` says one (`both` for both ways);
- the kind's **effects**, `on[outcome].then`, for each of them (the person is one, the target the other; `ctx.data` is the exchange: `{ exchange, kind, first, who, turns, outcome, left }`, their own outcome and who walked off);
- **relief** of the needs it meets, by the share of its turns they had;
- and, when it goes well for the other: the kind's **deed**, **gift**, **favor owed** and **lesson**.

An exchange of `longTurns` (6) turns or more that went fine or better counts as long too: `on.long`, else the `long_chat` feeling. Whoever walks off gets `on.left` (else `snubbed`) and loses `leftRegard` (0.03) for the one they walked away from. `on.end` applies at any outcome. In a group, each pair takes `groupShare` (0.5) of the regard.

The built-in feelings (declared when Reverie is on; declare your own with the same ids to change them): `good_talk` (+0.05, 4 h), `long_chat` (+0.07, 7 h), `had_words` (-0.1, 6 h), `snubbed` (-0.05, 4 h), `fought` (-0.2, a day), `made_up` (+0.1, a day), `saw_row` (-0.04, 4 h) and `comforted` (+0.08, 6 h).

## Exchanges: when they happen

- **When people meet.** Two people doing something together for a few minutes (Tyrell's meetings, as Fellowship's) strike up an exchange with chance `strike` (0.3) times the `talk` knob (the world's, times both people's own), unless either is in one already or doing something `quiet` (asleep). The chattier is likelier to start; they draw a kind among those whose `who`, `to` and `if` hold, by weight (times `1 + relief × urgency × needPull` for the needs it meets, and `quarrels` for a hostile one). Its turns are what they have time for.
- **On and off, while they're together.** With `again` (minutes; 0, the default, never), two people still together when an exchange between them is done (both free, at the same place) may strike up another that many minutes later, by the same chance, and every as many after while they stay together and nothing strikes: two at a bar talk on and off all evening, not only as the second sits down. Each pair waits once (a later wait supersedes it), kept with the pair.
- **By an action.** An action with `interact: '<kind>'` and a target begins its exchange as it starts, over the action's length. With no target, `interactWith` (conditions, the candidate as the target) finds who it's with: the first one at the place, by id, who is free and for whom they hold, someone not in an exchange before someone in one, who breaks off from it (`interactWith: ['target.doing:work']`: whoever's serving, as someone pays at a till). Without either, it begins nothing.
- **By the game.** `world.bree.start(kind, a, b, { minutes?, turns? })` (an input that applies at once) starts one, `b` one person or several; anyone in an exchange leaves it. It returns the exchange as it stands after the first turn. `world.bree.end(idOrPerson)` ends one (a person walking away from a group that `stays` leaves it). An effect `exchange:<kind>` starts one between the person and the target.
- **By the game, as on meeting.** A game that works out who meets whom itself (it walks one person up to another) says they've met with `world.bree.strike(a, b, { minutes?, turns? })` (an input that applies at once): `a` draws a kind among those that fit `b`, by weight, as above, and it begins. Null if nothing fits.

Each turn is a module timer `turnGap` (2 to 4) minutes after the last (or the kind's own `gap`), so off screen it all happens the same. They must stay together: whoever leaves the place, starts walking, or falls asleep ends it (`parted`). The first turn of one the game starts is taken as the game says, so a one-turn greeting between two people passing in the street works.

The game owns space: give `world.bree.together = (exchange, world) => id or null` (a definition, deterministic, like `witnesses`) and it says who has left the others instead of the place, for a game whose people are each at a place of their own in Tyrell (whoever is asleep or away has left anyway).

## Conversations over turns

A kind with topics (in a world that declares some) is a conversation, topic by topic. The opener raises a topic; each of the others answers (`open`, then a `reply` each); the opener follows it up (`more`); one of the others has the last word (`back`); then the next one round opens another. When the turns they have are done (but not before the first answer), or there's nothing left to say, whoever's turn it is takes their leave (`bye`).

How long they talk is by how the starter stands with the other (`bond`): `turns` gives partner 8, kin 6, close friends 8, friends 5, acquaintances 3, strangers 2, rivals 4, the sour 2; plus `talkativeTurns` (2) a point of talkativeness above the middle for the two together, less `lowMoodTurns` (2) if either is under `lowMood` (0.35), give or take `turnsJitter` (1), held to `minTurns` and `maxTurns` (2 to 12), plus `groupTurns` (3) for each member past two, times `talk`, within the time they have. A kind's own `turns` overrides it. Without declared topics, a conversation goes turn about.

## Topics

```js
b.topic({ id: 'weather', if: ['fact:raining'], weight: 1.5 });
b.topic({ id: 'news', from: 'beliefs', weight: 1.5 });
b.topic({ id: 'work', if: ['job'], fit: [{ if: ['trait.thrift>0.6'], by: 0.5 }] });
```

`TopicDef`: `id`, `label`, `tags`; `from` (where its subject comes from, below); `if` (conditions for the speaker to raise it, the listener as target, `ctx.data.subject` its subject); `kinds` (the kinds it fits, ids or `tag:`; default every kind whose topics include `'*'`); `weight` (number, considerations or function); `fit` (rules read for each of them: how much it's to their taste); `steps` (2 to 4: open and reply, then more, then back; default 4); `then` (effects for each when it's talked through).

What a topic is about comes from what's true for the two of them:

| `from` | Subject | Available when |
|---|---|---|
| none | | Always (its conditions hold: world facts, jobs, the hour...) |
| `'beliefs'` | a belief key | The speaker believes something the listener doesn't, not about the listener, not private (`@`), not silenced: Wormtongue's pick of the juiciest, when it's on. If the telling lands at least `tellAt` (fine), everyone in it hears it: through Wormtongue's telling (lies, trust, secrets, reports to the authority), or without it at `trust` (0.7) of its strength |
| `'memories'` | a memory kind | A memory they share (the same kind within `shareWindow`, an hour), or the speaker's about the listener; opening it brings it to mind for both (a recall: it may become a core memory) |
| `'events'` | a memory kind | What's happened to the speaker lately: their strongest memory of the last `recentMinutes` (a day) |
| `'likes'` | an action | Something the speaker loves doing: an instinct or habit over `likeAbove` (1.1); its fit for the listener is their own taste for it |
| `'doing'` | an action | What the speaker's doing now (the food in front of them); they share it if the listener is at it too (`shareFit`) |
| `'place'` | a place | Where they are |
| `'grudge'` | its reason | What the speaker holds against the listener (an argument's grievance) |

A topic is drawn by weight, times `1 + its fit for the speaker × topicPull`, times how fresh it is between them (`1 - e^(-minutes since / topicCooldown)`, a day; each pair remembers its last `topicMemory` topics), and never twice in one exchange. Its fit for the listener colors how each turn on it lands.

## Manners

```js
b.manner({ id: 'ornery', traits: { temper: 2 }, fits: [{ if: ['mood<0.4'], by: 0.5 }], lands: [{ by: -0.75 }] });
b.manner({ id: 'witty', traits: { humor: 2 }, lands: [{ if: ['nature.humor>0.6'], by: 0.75 }] });
```

At the start of an exchange each of them takes the manner that fits them best: its `base`, its `fits` rules (the person), its `traits` (role → weight a point from the middle), and up to `mannerJitter` (0.1) of their own, the same always; `if` limits who can have it. A manner's `lands` rules say how words in it land with the listener (`mannerWeight`). The turn carries the speaker's manner, so their words can be in it (`manner:ornery` in a line's conditions). `world.bree.mannerOf(id)` reads it.

## Round a table

A kind with `group` gathers whoever else is at the same place as it starts (up to `groupMax`, 5): each, free, fond enough of one of them (`joinRegard`), with chance `joinChance` (0.5) times their `talk`. Someone who comes along later and meets one of them may join too (`bree:joined`), from the next topic; or the game seats them, `world.bree.join(exchange, id)` (an input: false if it isn't a group's, it's full, or they're busy). Everyone answers the opener in turn. If it turns into an argument, it narrows to the two, and the rest look on. With `stays`, someone who leaves (gets up, falls asleep, is drawn into another) is out of the turns to come and it goes on with the rest (`bree:parted`), while two are left.

## The words

Bree tells the game each turn (`bree:turn`): who speaks to whom, the step, the topic and its subject, the speaker's manner, how the turn landed and how it's going, and the words: with Cityspeak on, the most specific line on the first of `<topic>.<step>`, `<kind>.<step>` and `bree.<step>` that has one (passing over lines said in this exchange), with its `key` and `text`; else just `line`, the most specific of those topics, for the game to look up. Lines' conditions can read the moment: `manner:ornery`, `turn:sour` (how this turn landed), `outcome`, `subject`, `bond:friend`, `exchange:argue`, `grudged>0.2`. Words never change anything.

The steps: `open`, `reply`, `more`, `back` (a topic's, or a quick kind's turn about), `bye`, and the ones below: `calm`, `step_in`, `leave`.

## Escalation, and what stops it

When a turn lands at `escalateAt` (sour) or worse, the one who heard it reacts:

1. **They answer back harder**, if the kind `escalates`, with chance `escalateBase + escalateTemper × (temper - 0.5) × 2 + escalateStress × stress + escalateGrudge × their grudge - escalateRegard × regard` (0.25, 0.5, 0.5, 0.6, 0.5), times the `escalation` knob (theirs). Unless:
   - **the other keeps their patience** (`calmBase + calmPatience × patience + calmRegard × regard`: 0.1, 0.6, 0.3): a `calm` turn, and it goes on as it was; or
   - **someone there steps in**: whoever likes one of them most (at least `stepInFrom`, 0.2), with the nerve for it, with chance `stepInBase + stepInRegard × that regard + stepInCourage × (courage - 0.5) × 2`: a `step_in` turn, and it's over (`stepped in`). Both like them `mediateRegard` (0.03) more, and their grudges against each other ease by `mediateMends` (0.1, by forgiveness);
   - otherwise it **escalates**: the exchange becomes the next kind (a chat an argument, an argument a fight), led by the one who escalated (who's now `by`, who started the trouble), with its own turns; `bree:escalated`.
2. **Or they walk off**, in a pair, with chance `leaveBase + leaveTemper × temper - leaveRegard × regard + leaveSour × each sour turn before` (0.3, 0.35, 0.3, 0.2): a `leave` turn, and it's over (`left`).
3. **Or they let it go.**

A kind that starts hostile (an insult) has its starter as `by`. Every escalation is [seen](#witnesses); a kind with `crime` (the starter's fight) goes to Wormtongue as it breaks out. With `feudSpread` above 0, a fight between people of two households sets the households [feuding](#feuds) by that much.

## Witnesses

Whoever is about sees every escalation, and an exchange that ends at `seenAt` (sour) or worse: by default everyone at the place (its outermost), awake, not in it; give `world.bree.witnesses = (exchange, world) => ids` (a definition, deterministic) for the game's own sight, or report them after with `world.bree.witnessed(exchangeId, ids)` (an input; it works on an exchange lately finished, too). Each one, once a kind:

- believes it, as seen: `did:<who started it>:<kind>`, the other as its value (strength `witnessStrength`, 0.8), so Wormtongue's gossip spreads it like any deed;
- remembers it (`saw:<kind>`, importance `witnessMemory`, 3) and feels it (`witnessFeeling`, `saw_row`);
- thinks less of whoever started it: `witnessRegard` (0.5) of what the outcome moves.

A kind with `crime`, declared to Wormtongue, is Wormtongue's to witness instead (the other one in it too, who may report it): reports, heat and infamy as for any crime.

## Grudges

A grudge is one person's against another: a strength 0..1, a reason, and when it was last set. It fades `fade` (0.04) a day, times the holder's `forgiveness` knob and `forgiveBase + forgiveTrait × forgiveness` (0.5 + 1 × their forgiveness: 1 at a middling nature), worked out when it's read; under `grudgeFloor` it's let go at midnight.

A bad exchange leaves each one who heard it go badly a grudge against the other: `grudge[outcome]` times the kind's `grudge`, times the `grudges` knob, `1 + (temper - 0.5) × 2 × grudgeTemper` and `1 - (forgiveness - 0.5) × 2 × grudgeForgive`. A grudge colors every exchange after (`grudgeWeight`), how readily they escalate (`escalateGrudge`), what they choose ([avoidance](#avoidance)), and which kinds they strike up (the starter's argue and avoid weigh by `grudge`, apologize by `grudged`).

`world.bree.grudgeAgainst(a, b, by, why?)` (an input) changes one (negative eases it); `grudge(a, b)` and `grudges(a)` read them. Effects: `grudge+=n`, `grudge:<id>-=n`.

## Feuds

A feud is between two people or two groups (households, families, factions: Fellowship's groups), both ways: every member of one has it against every member of the other. Two people who hold grudges of `feudAt` (0.5) against each other are in one; the game declares any with `world.bree.feud(a, b, strength, why?)` (an input; 0 or `null` ends it). A feud fades `feudFade` (0.01) a day, times the world's `forgiveness`. `feudBetween(a, b)` reads it for two people, through their groups; `animosity(a, b)` is the stronger of a's grudge and feud against b; `feuds()` lists them. Rivals (`bond`) are two people with `rivalAt` (0.3) or more against each other both ways.

## Avoidance

Someone with a grudge or a feud (at least `avoidFrom`) weighs an option at a place where the other is (its outermost place) `1 - animosity × avoidPlace` (0.6), and a social action (tagged `social`, or one that interacts) aimed at them `1 - animosity × avoidTarget` (0.8), never under `avoidFloor` (0.1): the part `avoiding <name>`. A hostile interaction aimed at them weighs `1 + animosity × hostilePull` instead (`a grudge against <name>`). So people keep away from those they've fallen out with, and pick quarrels with them.

## Making up

- **An apology, a gift, making up.** A kind with `mends` takes `mends × mends[the other's outcome]` (warm 1.5, good 1, fine 0.5, worse nothing) times the other's forgiveness off their grudge against the starter; with `mutual`, both ways. A feud between them eases by as much (between their groups, by `feudMends`, 0.5, of it).
- **A go-between** who steps in eases both (above).
- **Time**: grudges fade.
- **The game**: `world.bree.reconcile(a, b)` (an input) ends grudges both ways and a feud between them; the effect `reconcile` does the same for the person and the target.

A grudge eased to nothing by mending (not by fading) is made up: it ends, and a sentiment remembers it for good (`reconcileLabel`, 'made it up', `reconcileSentiment`, 0.05), with the `made_up` feeling and a memory (`made_up`, importance 5); `bree:mended`.

## The starter set

`world.bree.starter(opts?)` declares seventeen kinds, ten topics and six manners; `Tyrell.breeStarter(opts)` returns them as plain definitions to change. Declare your own with the same ids after, to replace any. `opts.kinds`, `opts.topics` and `opts.manners` take only some; `opts.company` and `opts.fun` are the game's names for those needs.

| Kind | Who, to whom | How it lands | Notes |
|---|---|---|---|
| `chat` | anyone | as they are | topics `*`, a group, relieves company and fun, escalates to `argue` |
| `deep_talk` | regard over 0.3 | +0.25, warm listeners | deep topics, relieves company, 1.5 × regard, a memory when long |
| `joke` | the humorous | +0.25, humor, not temper | relieves fun, escalates |
| `compliment` | regard over 0 | +1, warmth | warm: a sentiment for two days |
| `tease` | regard over 0.2 | humor, badly with temper | escalates |
| `flirt` | attraction over 0.1, not children | attraction, warmth | romantic topics |
| `comfort` | someone low, liked | +0.5, more the lower they are | the `comforted` feeling |
| `favor` | regard over 0.1 | -0.25, warmth, regard | the asker owes a favor |
| `gift` | regard over 0 | +1.5 | 2 × regard, mends a little, a sentiment for a week |
| `help` | regard over 0.1 | +1 | the deed `helped` |
| `teach` | a skill to share | +0.5, patience | an hour's practice |
| `argue` | grudge, low regard | -1, temper | the grievance first, escalates to `fight` |
| `insult` | regard under -0.2 | -2.5, temper | 1.5 × grudge, escalates to `fight` |
| `fight` | only by escalation | -4 | 2 × grudge, the crime `fight`, the `fought` feeling |
| `apologize` | they hold a grudge | +0.5, forgiveness | mends 0.5 |
| `make_up` | grudges both ways | +0.5, forgiveness | mends 0.6, both ways |
| `avoid` | a grudge over 0.3 | -1 | the cold shoulder: one turn, the other `snubbed` |

Topics: `small_talk`, `news` (beliefs), `old_times` (memories), `doings` (events), `pastimes` (likes), `here` (place), `the_moment` (doing), `troubles` (for deep talk and comfort, someone low), `sweet_nothings` (flirting) and `grievance` (a grudge, for arguments). Manners: `plain`, `warm`, `witty`, `ornery`, `shy` and `gloomy`.

## State

In `world.s.mod.bree`, made with the first exchange or grudge:

| Key | Holds |
|---|---|
| `n`, `ids`, `v` | Draws from Bree's own stream; exchanges begun; changes to grudges and feuds |
| `ex` | Exchanges in progress, by id: kind (and the kind it began as), who, place, turns taken and planned, the running scores, manners, the topic, who started the trouble, who saw it |
| `of` | Who's in which exchange |
| `g` | Grudges: holder → other → `[strength, since, why]` |
| `feuds` | By `'a|b'`: `{ a, b, s, t, why }` |
| `pairs` | By `'a|b'`: exchanges between them, the last, the last row and who started it, their last topics, when they last made up, when they may talk again (`again`) (let go `pairDays`, 30, after their last) |
| `recent` | The last `recent` (50) finished exchanges |

Turns are module timers in the world's queue. Kinds, topics, manners and `witnesses` are definitions.

## API

`world.bree`. **Input** methods are recorded and safe from the game.

| Method | Returns | |
|---|---|---|
| `kind(def)`, `topic(def)`, `manner(def)` | this | Declarations |
| `starter(opts?)` | this | Declares the starter set |
| `start(kind, a, b, opts?)` | ExchangeView or null | **Input** (applies at once). `b` one id or several; `opts` `{ minutes?, turns? }` |
| `strike(a, b, opts?)` | ExchangeView or null | **Input** (applies at once). As on meeting: `a` draws a kind that fits `b` |
| `join(exchange, id)` | boolean | **Input** (applies at once). Seats someone in a group exchange in progress |
| `end(idOrPerson)` | void | **Input.** Ends an exchange (a person leaves a group that stays) |
| `witnessed(exchange, ids)` | void | **Input.** The game says who saw it |
| `grudgeAgainst(a, b, by, why?)` | void | **Input.** Changes a's grudge against b |
| `feud(a, b, strength, why?)` | void | **Input.** Declares (or with 0 or null ends) a feud between people or groups |
| `reconcile(a, b, why?)` | void | **Input.** They make it up |
| `exchange(idOrPerson)` | ExchangeView or null | An exchange in progress |
| `exchanges()` | ExchangeView[] | Every exchange in progress |
| `history(a?, b?)` | Finished[] | Finished exchanges (the last `recent`), a person's or a pair's |
| `weigh(kind, speaker, listener, opts?)` | `{ score, outcome, parts }` | How words would land, without luck. A look |
| `outcome(score)` | Outcome | Where a score falls |
| `grudge(a, b)`, `grudges(a)` | number, array | Grudges |
| `feudBetween(a, b)`, `feuds()`, `animosity(a, b)` | | Feuds |
| `bond(a, b)` | string | `'partner'`, `'kin'`, `'rival'`, `'close'`, `'friend'`, `'acquaintance'`, `'stranger'` or `'sour'` |
| `mannerOf(id)` | id or null | Their manner (in their exchange, or now) |
| `nature(person, role)` | number | Their nature in a role |
| `subject(topic, speaker, listener)` | value | What a topic would be about now (undefined: it can't be raised) |
| `knob(name, id?)` | number | A headline knob for someone |
| `witnesses` | function or null | **Definition**: who sees an exchange |
| `together` | function or null | **Definition**: who has left an exchange (the game's sight); null, the place |
| `applyStart`, `applyStrike`, `applyJoin`, `applyEnd`, `applyGrudge`, `applyFeud`, `applyReconcile`, `applyWitnessed` | | **Engine** versions |
| `kinds`, `topics`, `manners`, `config` | | Declarations and config |

**ExchangeView**: `{ id, kind, first, who, place, t, why, turn, turns, outcome, score, topic: { id, subject? } | null, manners, by? }`. **Finished**: `{ id, kind, first, who, place, t, end, outcome, outcomes (each one's), n, why, by?, left?, mediator? }`; `why` is `'done'`, `'parted'`, `'left'` (walked off), `'stepped in'`, `'ended'` (the game), `'interrupted'` or `'gone'`.

## Terms, effects, events and log

Terms (the person, with the target the other): `nature.<role>`, `grudge` / `grudge:<id>` (theirs against the other), `grudged` (the other's against them), `feud` / `feud:<id>`, `bond` / `bond:<label>`, `rowed` (minutes since their last row, or null), `exchanges` (how many between them), `exchange` / `exchange:<kind>` (the kind of the one they're in), `outcome` / `outcome:<o>` (how it's going, or how the last between them went), `turn` / `turn:<o>` (how the last turn landed), `manner` / `manner:<id>`, `subject` (the topic's subject now).

Effects: `grudge+=n` / `grudge:<id>-=n` / `grudge=n`, `reconcile` / `reconcile:<id>`, `exchange:<kind>` (starts one between the person and the target).

| Event | Payload |
|---|---|
| `bree:start` | ExchangeView |
| `bree:turn` | `{ id, kind, n, who, to, step, topic, subject?, manner?, landed, outcome, line, key?, text?, end }` |
| `bree:joined` | `{ id, who }` |
| `bree:parted` | `{ id, who }`: someone left a group that stays |
| `bree:escalated` | `{ id, from, to, by, against }` |
| `bree:witnessed` | `{ id, exchange, actor, kind, against }`: `id` is the witness |
| `bree:end` | Finished |
| `bree:grudge` | `{ id, against, strength, why }` (one formed or deepened) |
| `bree:feud` | `{ a, b, strength, why }` (0: it ended) |
| `bree:mended` | `{ id, with, why }`: `id` made up their grudge |

Log entries: `exchange`, `joined`, `parted`, `escalated`, `saw`, `exchanged`, `grudge`, `feud`, `mended`.

## Config

`Tyrell.create({ moduleConfig: { bree: { ... } } })`. The headline knobs, each 1 by default, 0 stopping what it scales:

| Knob | What it scales | A person's own |
|---|---|---|
| `warmth` | The regard and attraction good exchanges give | the one whose regard it is |
| `quarrels` | The regard bad exchanges take away; how appealing hostile kinds are | the same; the one who'd pick the quarrel |
| `escalation` | The chance a sour turn escalates | the one who'd escalate |
| `grudges` | The grudges bad exchanges leave | the one who'd hold it |
| `forgiveness` | How fast grudges fade, how much mending takes off them (feuds: the world's) | the one who holds it |
| `talk` | How often people strike up exchanges, how many turns they talk, how readily they join in; 0: none on their own, and one begun by an action or the game is a word and a goodbye | everyone in it |

Every other setting is in [Tuning](../tuning.md#bree), with its default and which way to turn it. During play, `world.tune('bree', { ... })`; a person's own, `world.tune('bree', { talk: 2 }, id)`.

## With other modules

- **Fellowship**: regard, attraction, compatibility and sentiments are how people stand and what exchanges move; households and groups feud; partners and households make bonds.
- **Reverie**: mood and stress color every turn; feelings, memories and beliefs are what exchanges leave; witnesses believe and remember what they saw; shared memories and news are topics.
- **Wormtongue**: news in talk is told its way; what witnesses saw is gossiped; a fight it knows as a crime is reported; favors are owed.
- **Cityspeak**: the words, and the mood of the room; social acts are unchanged and can sit beside interactions.
- **Voice**: a kind can land as a Voice approach does (the same landing, shared), so a game's approaches serve its people as well as the player.
- **Cradle**: flirting grows attraction, which Cradle's courtship pairs by.
- **Bicameral**: avoidance is a consideration on every choice; an action can interact.

## Carrying a game's own talk

**Merryfolk's natters** (`js/converse.js`, on Bree in `js/bree.js`). Every villager is at a place of their own in Tyrell and the game works out who's near whom, so it gives `together` (both still in their natter, or at the table) and `witnesses` (the room, or shouting distance), and strikes exchanges up itself as it walks one villager up to another (`strike`). Its kinds: a natter; sweet nothings between sweethearts (romantic, its courting strands as topics); a squabble (hostile, struck at the game's own odds, or a natter that stings and won't be let go); a natter with a toddler and a newcomer asking their way (no topics: a line and its answer in the game's own words); making it up and an apology, for two still sore after words; and table talk, a group that `stays` as people get up, at its own pace (`gap`). Its tempers (cheerful, ornery, shy, curious, dreamy, witty, proud, gloomy: `temperOf`) are manners, each fitting by that function; how long two talk is the game's own reckoning (`turns` as a function: what they are to each other, how chatty and low they are, the rain); its topics are topics, `when` as `if` and `w` as `weight` (the food in front of them `from: 'doing'`; its doings, hobbies, news and messages are subjects of the game's own, since its memories, hobbies and news are kept its own way); and its pools of openers, answers by temper, follow-ups and last words are Cityspeak lines on `<topic>.open`, `.reply`, `.more` and `.back`, with `manner:` conditions and a curt word for an answer that landed badly. A curt answer is the natter kind's `lands`, read at the `reply` step (`ctx.data.step`) from the one who answers: a grump on the topics that sour them, or anyone low, worn out or no friend of the speaker; walking off is Bree's `leave`. Bree's own regard, feelings and memories are off (all zero), and what each outcome does is the kinds' `on`: effects that grow a friendship the game's way and give its own feelings (`snubbed` on `left`, `long_chat` on `long`, `good_chat` by outcome, `quarrel` at a squabble's end) and memories. Gatherings stay the game's (a spot and a shape).

**The White Dragon's small talk** (`js/chat.js`): small talk between residents settled somewhere together is a `chat` kind, struck up as they meet and on and off while they stay (`again`), but in a room you can see only between two side by side (an `if` of the game's, from where each is drawn); each of `TOWN_SMALL`'s pairs of lines, a pair's own (`TOWN_PAIR`: the first of the two raises it) and the news once your work's out in the street (`TOWN_NEWS`, each with `if: ['fact:<name>']` on a fact the game keeps in the world) is a topic of two steps, its opener and its answer Cityspeak lines on `<topic>.open` and `.reply`, with an answer of its own when the turn lands sour or worse (`turn:sour`). Chat escalates to an argument (`argue`), and nothing past it: the block quarrels with words; grudges bring the cold shoulder (`avoid`), apologies and making up. Their natures are a term of the game's (`nat:<role>`, mapped in `traits`). What's said at the till, a bar's counter and a neighbor's door are kinds the pay, drink, eat and visit actions begin with whoever's serving or in (`interactWith: ['target.doing:work']`). `bree.witnesses` is the game's sight, from where people are rather than where they're drawn: in a room or behind a door, everyone there awake; at a spot in the open, whoever's at the spots within shouting distance. Greetings in passing and a word between two walking together stay the game's barks (Tyrell doesn't know who passes whom in the street), their words Cityspeak lines (no greeting from someone with a grudge); what's said to Lin over the counter stays the game's (she isn't a resident); and what residents say on seeing you strip a machine are Cityspeak lines the game says in its own order and beat. The player's own talk stays on Voice.

## Example

```js
const w = Tyrell.create({ seed: 'inn', moduleConfig: { bree: { traits: { ...Tyrell.MODULE_DEFAULTS.bree.traits, humor: 'trait.wit' } } } });
// ... needs, places, actions, people ...
w.bree.starter();
w.wormtongue.crime({ kind: 'fight', severity: 0.3, reportTo: 'watch' });
w.cityspeak.addLines([
  { key: 'small_open', topic: 'small_talk.open', text: 'Keeping well?' },
  { key: 'small_reply', topic: 'small_talk.reply', text: 'Can\'t complain.' },
  { key: 'small_reply_ornery', topic: 'small_talk.reply', when: ['manner:ornery'], text: 'Why do you want to know?' },
  { key: 'calm', topic: 'bree.calm', text: 'Hey. I didn\'t mean it like that.' },
  { key: 'bye_friend', topic: 'bree.bye', to: ['friend'], text: 'Same time tomorrow?' },
]);
w.bree.witnesses = (ex, world) => world.ring.present(ex.place).filter((id) => !ex.who.includes(id));

w.on('bree:turn', (t) => bubble(t.who, t.text ?? words(t.line, t.manner)));
w.on('bree:escalated', (e) => console.log(`${e.by} won't let it go: ${e.from} became ${e.to}`));
w.on('bree:end', (e) => console.log(`${e.who.join(' and ')}: ${e.kind}, ${e.outcome}`));

w.bree.start('chat', 'ines', 'kofi');            // the game can start one; most start on their own
w.bree.grudge('sam', 'dev');                     // how much Sam holds against Dev
w.bree.weigh('apologize', 'dev', 'sam');         // how an apology would land now
```

`buildRocinante(Tyrell, { bree: true })` is the same in the sample town: the starter set, a natter that interacts, a fight the Watch hears of, a few lines, and a grudge Sam bears Dev; `npm run vk:bree` runs Voight-Kampff on it with the `interactions` check.
