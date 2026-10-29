# Morgul

Harm between people: a blow in a fight, a snare by the barn door, nightshade in the stew, a fall nobody meant. Morgul handles what follows, in minutes, on screen and off: the wound and how it heals, the pain and the fear, the grudge and the wish to get even, who saw it, who's blamed, the crime and the gossip. Named for the Morgul-blade of The Lord of the Rings, whose wound won't heal.

The ideas come from RimWorld (wounds that need tending, infections, social fights that become brawls), Dwarf Fortress (grudges and vengeance that outlive the fight), Thief and Dishonored (traps and poison as the patient way to hurt someone), and Crusader Kings (murder by scheme, suspicion that falls on whoever had reason). The moment of a hit, in frames, is the game's ([Tycho.harm](../../../docs/harm.md)); Morgul starts where it ends, and off screen it settles harm by numbers: a fight by its odds, a trap by its chance, a poison by who eats.

- [A harm](#a-harm)
- [Means, wounds and traps](#means-wounds-and-traps)
- [Wounds and hurt](#wounds-and-hurt)
- [Down and dead](#down-and-dead)
- [The victim](#the-victim)
- [Onlookers and the law](#onlookers-and-the-law)
- [Traps](#traps)
- [Poison](#poison)
- [Suspicion](#suspicion)
- [Fights by numbers](#fights-by-numbers)
- [Fights with the player](#fights-with-the-player)
- [Choosing harm](#choosing-harm)
- [On screen and off](#on-screen-and-off)
- [State](#state)
- [API](#api)
- [Terms, effects, events and log](#terms-effects-events-and-log)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Example](#example)

## A harm

Everything comes down to one record. The game reports one (`world.morgul.harm(h)`, an input); Morgul makes them itself off screen (a blow in a fight, a trap sprung, a dose eaten, an action's `harm:` effect).

| Field | Default | Meaning |
|---|---|---|
| `to` | required | Who it struck: a person, or `'player'` |
| `by` | null | Who did it: a person, `'player'`, or null (nobody: a rockfall) |
| `kind` | what it was done with's first kind, or `'harm'` | The game's own: `'blunt'`, `'cut'`, `'burn'`, `'poison'`... |
| `severity` | 0 | 0..1: a slap 0.05, a beating 0.5, a killing blow 1 (the scale of Wormtongue's crimes). A game with a health bar gives the share of it the hit took |
| `via` | `'blow'` | How it came: `'blow'`, `'trap'`, `'dose'`, `'fall'`, `'fire'`... The `direct` ones (blow, throw, shoot, cast) are seen done |
| `intent` | `'meant'` if someone did it, else `'accident'` | `'meant'`, `'defense'`, `'careless'` or `'accident'` |
| `cause` | none | The hazard it came from: a trap's or a taint's id |
| `what` | none | What it was done with: a means, an item, a trap's kind |
| `place` | where they are | Where |
| `seenBy` | everyone there but the two of them | Who saw it land (the game's sight on screen) |
| `course` | the wound's | The Athelas course it starts, over the wound it would leave |

It returns the harm as the game sees it (`HarmView`: the fields above, `id`, `t`, the `wound` and `course` it left, `shown`, and how `hurt` the one struck is now), and emits `morgul:harm` with it.

## Means, wounds and traps

Nothing happens until the game declares some. Definitions, declared on every start:

```js
const M = world.morgul;
M.means({ id: 'cudgel', kinds: ['blunt'], use: 'strike', severity: 0.2 });
M.means({ id: 'nightshade', kinds: ['poison'], use: 'dose', course: 'nightshade', severity: 0.45 });
M.means({ id: 'snare', kinds: ['cut'], use: 'set', severity: 0.2 });
M.wound({ id: 'bruised', kinds: ['blunt'], at: [0, 0.3], course: 'bruised' });
M.wound({ id: 'beaten', kinds: ['blunt'], at: [0.3, 1], course: 'beaten' });
M.wound({ id: 'cut', kinds: ['cut'], course: 'cut' });
M.trap({ id: 'snare', kind: 'cut', severity: 0.2, hidden: true, uses: 1, catch: 0.4 });
```

**A means** (`MeansDef`) is what harm is done with, shared with the game's own (the bridge declares the same list to [Tycho.harm](../../../docs/harm.md) and here; fields Morgul doesn't read are kept and ignored): `id`, `kinds`, `use` (`'strike'`, `'throw'`, `'shoot'`, `'cast'`, `'coat'`, `'dose'`, `'set'`), `severity`, `course`. A character holds one as a good of the same id (Ceres, or their own goods), which they can buy, carry, be given and use up: a means they hold that strikes, throws, shoots or casts arms them (`armed`, and a fight's odds and blows); one that doses names a poison's course and severity; one that's set is a trap, if no trap says otherwise.

**A wound** (`WoundDef`) is what a harm leaves on the body: `kinds` (none: any), `at` (`[least, most]` severity, both ends counting), `what` (what it was done with), `via` (how it came), and the Athelas `course` it runs. The first declared that fits is taken.

**A trap** (`TrapDef`): `kind` (the harm it does; default its means' first kind), `severity` (default its means', or 0.2), `hidden` (default true), `uses` (default 1), `catch` (its chance off screen; default `config.catch`).

The first wound declared also declares two actions, unless the game has its own by those ids: lying down (`config.down`, pose `'down'`) and fighting (`config.fighting`, pose `'fight'`), each ruled out unless someone is down, or in a fight by numbers.

## Wounds and hurt

A harm's wound is an Athelas course afflicted at the harm's [severity](athelas.md#severity), which stretches its phases and deepens what they do. With `again: 'worsen'` a second harm adds to it: two beatings in a day are worse than one. Its phases are written like any course's (sore, then stiff; bleeding, then healing or festering), with one more field: `hurts`, how much of the severity the phase still counts (1 at first, less as it heals; a quiet phase, 0).

Someone's **hurt** is the sum of their open wounds' severities, each by its phase's `hurts`: `world.morgul.hurt(id)`, the `hurt` term. `wounds(id)` lists them: which, the course and phase, how bad, who gave it, how well tended. Wounds heal at the `healing` knob's pace (a wound's phases last 1 / healing as long; a cold isn't a wound, and keeps its own). A cut [tended](athelas.md#care) heals; one left festers: the branches are the course's.

## Down and dead

At `downAt` (0.8) hurt they go **down**: just after the harm they stop what they're doing (and any exchange they're in), lie there (the down action, at `downRank`, 5: above everything else, everything else ruled out), and come round after `downMinutes` (20 to 60), or sooner if someone helps them up (the `tend` effect, or `morgul.tend`). Events `morgul:down` and `morgul:up`; the `down` term.

At `killAt` (1) harm is at its worst, and it may **kill**: with chance `deathChance` (0.5) times the `lethality` knob, which is 0 by default, so nobody dies of harm unless the game says so. A death is a departure through [Cradle](cradle.md) (`'killed'`): grief for whoever loved them, inheritance; whoever saw it done sees the game's `crimes.killed` (a murder); and whoever knew them and believes who did it remembers it. Without Cradle nobody can die: they go down. A wound's own phase that ends in death (`dies`, an Athelas phase) kills as often as `lethality` says, and otherwise they pull through to its `next` (a cut gone bad).

## The victim

Once a harm is noticed (at once, unless its course starts [quiet](athelas.md#quiet-phases-and-telling)):

- **Feelings** (Reverie): `in_pain`; `shaken` for one at least `shakenAt` (0.15) bad; and, if someone did it, `furious` for a hot temper and a bold one (`temper × 0.6 + courage × 0.4` at least `angerAt`), else `scared`.
- **A memory** (`harmed`), as important as `memory + severity × memorySeverity` (3 + 6 a point), about whoever did it if they know.
- **Wariness of the place**: a place where they were hurt is dangerous to them a while (`wary`, fading `fade` a day).

If they saw who did it (a `direct` way: a blow, something thrown, shot or cast), **they blame them**, by the intent's share (`intents`: meant 1, careless 0.4, accident 0.1, defense 0):

- they believe it (`did:<who>:harm`, as seen);
- they hold it against them (`hurt_by`, the severity times the share, fading `fade` a day by their forgiveness), which is what [revenge](#choosing-harm) grows from;
- a **grudge** (Bree), `severity × grudge × share` (1.5) times Bree's `grudges` knob: little for an accident, none for a blow struck back at them in a fight they started (defense);
- **fear** of them, `severity × fear × share`, more for the timid (`fearCourage`), fading by their courage;
- **regard** lost (Fellowship), `severity × regard × share` (0.6), and a note in their file (`file:<who>.harmed`);
- with `feud` above 0, meant harm between two households sets the households feuding.

If they didn't see who did it (a trap, a dose, a fall), they may [suspect](#suspicion) someone.

## Onlookers and the law

Whoever saw a harm land (`seenBy`), when it was seen done, believes it (`did:<who>:harm`, `witnessStrength`), remembers it (`saw:harm`), feels it (`saw_harm`), and thinks less of whoever did it (`witnessRegard`, by the share). A harm the game declares a **crime** goes to [Wormtongue](wormtongue.md) instead, with its own severity: `crimes: { meant: 'assault', careless: 'negligence', killed: 'murder' }` names the Wormtongue crime each intent is. Wormtongue's witnesses (the victim among them) believe `did:<who>:assault`, may report it (heat for the player, infamy, the authority told), and gossip carries it to people who never saw it. Self-defense is never a crime. Blows in a Bree fight are Bree's to witness (and its `fight` crime, if the game declares one).

## Traps

A trap is set at a place, by someone or nobody, for someone or anyone:

```js
world.action({ id: 'set_snare', at: 'barn', minutes: 10, base: 0.08, if: ['has:snare'], then: ['take:snare', 'set:snare'], tags: ['harm'] });
world.morgul.set('snare', { by: 'pip', place: 'barn', for: 'tomas', seenBy: [] });   // from the game: recorded
```

The effect `set:<trap>` sets one where the person is, with them as its setter and the action's target (a plan's target) as who it's for. Whoever saw it set (default: everyone there) knows it's there (`trap:<id>`, its place) and who set it (`set:<id>`), and steer clear of the place (`danger`, `caution`); gossip carries it; someone who knows of a trap set for someone they like warns them when they meet (`warnAt`).

**Off screen**, whenever someone starts something at a trap's place (its outermost), it may catch them: with its `catch`, less for the careful (`careful`), less again if it isn't hidden (`seenCatch`; whoever it doesn't catch then sees it). Never someone who knows it's there, or its setter; a trap set for someone catches only them. It's a harm (`via: 'trap'`, its `cause` the trap's id, by its setter), and uses one of its `uses`. Events `morgul:set`, `morgul:sprung`, `morgul:disarmed`.

**On screen**, the game draws it as a trigger and says when it springs (`morgul.spring(trap, id, seenBy?, about?)`, a character or `'player'`: the harm to the player, and the trap spent); traps in the regions the game has said are near (`morgul.near(regions)`, by default the regions in focus) aren't sprung off screen, so nobody is caught twice. The effect `disarm` (or `disarm:<kind>`) disarms the traps someone knows of where they are; `morgul.disarm(trap, by)` does it from the game. A game that owns space can say who was about, by its own sight, when a trap was set (`set`'s `about`; whoever set it is among them, as with a taint) and when it sprang (`spring`'s `about`; otherwise whoever's at the place): the evidence of [suspicion](#suspicion) that being about is.

## Poison

A taint goes into a place's stock of a good, a place's pot (no good: whatever's eaten there next, by an action tagged with one of `eats`), or someone's goods:

```js
world.morgul.taint({ place: 'cafe', item: 'stew', n: 3, course: 'nightshade', by: 'sam' });
world.action({ id: 'spike', target: 'person', at: 'cafe', minutes: 5, if: ['has:nightshade'], then: ['take:nightshade', 'taint:nightshade'] });
```

The effect `taint:<course>` (or `taint:<course>.<item>`, `=n` servings) taints the place's pot (or stock) where the person is, for the action's target if it has one. Tainted servings travel with the goods ([Ceres](ceres.md)): bought (an action's `buys`), they go home with the buyer, into their household's pantry if it shares one; eaten (`uses` from a store's stock, from their own goods, or the pot), each serving is tainted with the chance of what's left, and whoever gets one has a harm (`via: 'dose'`) that starts the taint's course at its severity (its own, its means', or `dose`). A taint aimed at someone (`for`) is theirs alone: the meal they'll eat.

A poison's course starts quiet: nobody notices, not even the one eating (no feeling, no hurt, `under:` reads nothing), until a phase that tells. Then the harm is noticed: the victim's feelings and memory, and whoever's about when they're taken ill, and [suspicion](#suspicion). Whoever saw it dosed knows (`dosed:<id>`, who did it; `tainted:<place>`, and they won't eat there).

## Suspicion

When a harm nobody saw done comes to light (a trap sprung, a poison that tells), the victim and whoever saw them struck down may suspect someone. Whoever saw it set or dosed knows who did it. Anyone else, with chance `suspect` (0.8) times the `suspicion` knob, puts it on someone by the evidence:

| Evidence | Weight |
|---|---|
| Told who set or dosed it (gossip of what someone saw) | `suspectTold` (2) × the belief's strength |
| Served it: the place's owner, and whoever's on shift there | `suspectServed` (0.6) |
| A grudge against the victim (Bree's animosity) | `suspectGrudge` (1.5) × its strength |
| About when it was done, or when it struck | `suspectAbout` (0.3) |

Each candidate's weight is times `1 + dislike × suspectSpite` and `1 - liking × suspectLoyal` (never under 0.1), and one is drawn by weight. The suspicion is a belief (`did:<suspect>:harm`, assumed) as strong as `weight × suspectStrength × suspicion` (at most `suspectMax`, none under `suspectFloor`): the victim holds it against them, bears them a grudge and fears them as if they'd seen it, and anyone else thinks less of them. It can be wrong. A scapegoat is blamed and hated for what someone else did, and gossip spreads the wrong name as readily as the right one. Nobody investigates: suspicion is all there is, and the truth is the player's to work out. Event `morgul:suspect` (with `right`, for the game's own tools); `suspects(id)` lists who someone believes did harm.

## Fights by numbers

A Bree exchange of a kind in `fights` (the starter set's `fight`) is a fight by numbers once a wound is declared: wherever it is, on screen or off.

- **Held.** As it breaks out (begun, or escalated into) both fighters stop what they're doing and fight (the fighting action, at `fightRank`, 4.5) until it's over; it has `blows` (12) turns and no time limit.
- **A blow a turn.** Each turn one of them lands a blow, by the odds: `odds(a, b) = might(a) / (might(a) + might(b))`. A fighter's **might** is the game's considerations (`might`: strength, size, skill, nerve), times `1 + severity × meansMight` for the best means they hold, times `1 - hurt × hurtMight`. The blow's severity is `fist + means severity × meansBlow`, give or take `blowSpread`; its kind is the means' (or `fistKind`); the one who started the fight strikes meant blows, the other strikes back in defense. Each blow is a harm, with everything above.
- **The end.** The one struck goes down, or yields (hurt past `yieldAt`, sooner for the timid: `yieldCourage`), or walks off (`walkOff` times how near they are to yielding); or someone there steps in (Bree's `stepIn...`). Bree's `finish` says `'down'`, `'yielded'`, `'left'` or `'stepped in'`.
- **The scuffle.** Each `bree:turn` of a fight carries its blow (`turn.harm`: `{ id, by, to, kind, severity, what?, hurt, end? }`), so the game can show the scuffle in step with the turns.

## Fights with the player

Harm by `'player'` (or by a character to the player) face to face (a `direct` way: a blow, a throw, a shot, a cast; not a trap or a dose, which nobody fights) makes the character answer, as the fight starts and after each harm between them: **fight back**, **flee**, **yield** or **call for help**, drawn by how appealing each is, from their nerve and temper, their hurt and their odds against the player (whose might is the game's fact, `playerMight`, default `might:player`, 1 when unset), and whether anyone about likes them enough to help (`helpFrom`); `respond` scales each. It's emitted as `morgul:respond` (`{ id, to, act, odds, hurt, start, help?, weights }`; `start` for the first harm between them in `fightGap` minutes), and `respond(id)` looks without changing anything. A character who flees wants to get away for `fleeMinutes` (fleeing actions weigh more). The fight itself the game plays in frames.

## Choosing harm

Harm is chosen like anything else. The game declares the actions (attacking, ambushing, setting a trap, poisoning, fleeing, tending the hurt) and Morgul weighs them:

- **Violence.** An action or task tagged `harm` weighs times the `violence` knob: 0, and nobody ever does harm.
- **Revenge.** What someone holds against whoever hurt them, times `vengeance` and their temper (`vengeTemper`), is their wish for revenge (`vengeance:<id>`). Past `vengeAt` the game's `avenge` task (a [Mentat](mentat.md) task with `target: 'person'`) becomes an option aimed at them, weighing `vengePull` times the wish, its methods planned like any other (have it out; spike their supper; let it lie); a harmful action aimed at them weighs `1 +` that. Harm done to them sates it (`sated`).
- **Flight.** Someone who fears a person where they are, with poor odds against them (fear × (1 - odds) past `fleeAt`), wants to leave: options there weigh less (`fleePlace`), fleeing (tagged `flee`) more (`fleePull`), and meeting them makes them think again (once in `fleeMinutes`). The `fleeing` term reads it.
- **Caution.** Options at a place they know is dangerous (a trap or taint they know of, a place they were hurt) weigh `1 - danger × cautionPlace × caution`.
- **Care.** Tending someone hurt (an action tagged `care` aimed at them) weighs more, the more hurt and the more liked (`carePull`); the `tend` effect tends their wounds (Athelas's mark, the better for skill), helps them up if they're down, and leaves them `cared_for` and fonder of whoever did it.

The terms: `hurt`, `wounded:<kind>`, `hurt_by:<id>`, `afraid_of:<id>`, `danger`, `armed`, `odds:<id>`, `suspects:<id>`, `down`, `vengeance:<id>`, `fleeing`. [Gaff](gaff.md) can pace it, so violence is an event when it comes, not the weather (Rocinante's brawl at the Belt is a storylet).

## On screen and off

Tyrell has no coordinates, so off screen Morgul settles harm by numbers. On screen the game plays it out with [Tycho.harm](../../../docs/harm.md) and reports each harm (`morgul.harm`, with `seenBy` from its sight) and each trap sprung (`morgul.spring`). A fight between characters goes on by numbers wherever it is; near the player the game shows it as a scuffle from its turns. Traps in the regions the game has said are near (`morgul.near`) are the game's to spring: it's an input, recorded, so a rewind replays it as it was (focus itself isn't state). The bridge does the handing over ([Harm in the bridge](../../../docs/minds.md#harm)): the means declared to both halves, a hit on screen as a harm, the scuffle in step with a fight's turns, a character's answer to the player as what their fighter does, and the traps near and far.

## State

In `world.s.mod.morgul`, made with the first harm, trap or taint (a world without harm saves and hashes as if Morgul were off):

| Key | Holds |
|---|---|
| `n`, `ids` | Draws from Morgul's own stream; harms, traps and taints numbered |
| `harms` | The last `recent` harms (and every one not yet noticed): who, by whom, kind, severity, via, intent, place, who saw, cause, what, wound, course, shown, the exchange, who was about and who served it |
| `wounds` | Person → course → `{ w, by, h }`: the wound, who gave it, the last harm |
| `held`, `fear`, `wary` | What someone holds against whoever hurt them, their fear of someone, their fear of a place: `[strength, since]`, fading |
| `down` | Who's down, since and until when |
| `traps` | By id: kind, place, setter, for, when, uses left, who knows |
| `taints` | By id: the course, servings, the place (and good) or holder, by, for, severity, what, who knows, who was about |
| `flee`, `pf` | Who wants to get away until when; the last harm between each and the player |
| `near` | The regions whose traps the game springs (`morgul.near`) |

Lying down, getting up, stopping to fight and dying are module timers in the world's queue; wounds' phases are Athelas's.

## API

`world.morgul`. **Input** methods are recorded and safe from the game.

| Method | Returns | |
|---|---|---|
| `means(def)`, `wound(def)`, `trap(def)` | this | Declarations |
| `harm(h)` | HarmView or null | **Input** (applies at once). A harm |
| `set(kind, { by?, place, for?, seenBy?, about? })` | trap id or null | **Input.** Sets a trap (`about`: who else was about, by the game's sight) |
| `spring(trap, id, seenBy?, about?)` | void | **Input.** A trap caught someone on screen, or the player (`about`: who else was about) |
| `disarm(trap, by?)` | void | **Input.** A trap is disarmed |
| `taint(def)` | taint id or null | **Input.** `{ course, place? or person? or owner?, item?, n?, by?, for?, severity?, what?, seenBy? }` |
| `tend(id, by?)` | void | **Input.** Someone tends someone: their wounds, and up if down |
| `near(regions?)` | void | **Input.** The regions whose traps the game springs (default: those in focus now) |
| `hurt(id)`, `wounds(id)`, `isDown(id)` | | The body |
| `held(a, b)`, `fearOf(a, b)`, `vengeance(a, b)`, `danger(id, place)`, `fleeing(p)` | number | The mind |
| `suspicionOf(a, b)`, `suspects(id)` | | Who someone believes did harm |
| `might(id)`, `odds(a, b)`, `armed(p)` | | A fight's numbers |
| `respond(id, against?)` | Response or null | How someone would answer a fight with the player now. A look |
| `traps(place?)`, `taints(place?)`, `harms(id?)` | arrays | What's set, what's tainted, what's happened |
| `fights(kind)`, `inFight(id)`, `blows`, `nearPlace(place)` | | Fights and traps, as the bridge reads them |
| `knob(name, id?)`, `nature(p, role)`, `used` | | A headline knob for someone; a trait role; whether anything is declared |
| `applyHarm`, `applySet`, `applySpring`, `applyDisarm`, `applyTaint`, `applyTend`, `applyBlow` | | **Engine** versions |
| `paceOf`, `spares`, `showed`, `healed`, `brawl`, `parted` | | **Engine**: what Athelas and Bree ask and tell |
| `meansDefs`, `woundDefs`, `trapDefs`, `config` | | Declarations and config |

## Terms, effects, events and log

Terms (the person; `<id>` defaults to the target): `hurt`, `wounded` / `wounded:<kind>`, `hurt_by:<id>`, `afraid_of:<id>`, `danger` / `danger:<place>`, `armed`, `odds:<id>`, `suspects:<id>`, `down`, `vengeance:<id>`, `fleeing`.

Effects (the person does it, to the target): `harm:<kind>=<severity>` (with the best means they hold of that kind), `set:<trap>`, `taint:<course>` / `taint:<course>.<item>=n`, `disarm` / `disarm:<kind>`, `tend` / `tend:<course>` (Athelas's, and up if down).

| Event | Payload |
|---|---|
| `morgul:harm` | HarmView |
| `morgul:down` | `{ id, harm, hurt }` |
| `morgul:up` | `{ id, why, by }`: `'came round'` or `'helped up'` |
| `morgul:killed` | `{ id, by, harm }` |
| `morgul:set` | `{ trap, kind, place, by, for, seenBy }` |
| `morgul:sprung` | `{ trap, kind, place, id, by, harm }` |
| `morgul:disarmed` | `{ trap, kind, place, by }` |
| `morgul:tainted` | `{ taint, course, place, owner, item, n, by, for, seenBy }` |
| `morgul:suspect` | `{ id, suspect, harm, to, strength, why, right }` |
| `morgul:respond` | Response |

Bree's `bree:turn` carries a fight's blow (`harm`). Log entries: `harm`, `blamed`, `suspect`, `noticed`, `down`, `up`, `killed`, `spared`, `yielded`, `set`, `sprung`, `disarmed`, `tainted`, `warned`, `respond`, `healed`.

## Config

`Tyrell.create({ moduleConfig: { morgul: { ... } } })`. The headline knobs, each 1 by default (lethality 0), multiplied for someone by their own `tune: { morgul: { ... } }`:

| Knob | What it scales |
|---|---|
| `violence` | How readily anyone chooses harm; 0: nobody ever does |
| `lethality` | How often harm at its worst kills; 0: nobody dies of harm |
| `vengeance` | How strongly harm turns into a wish for revenge |
| `caution` | How much people steer clear of danger they know of |
| `healing` | How fast wounds heal |
| `suspicion` | How readily people suspect, and how strongly |

Every other setting is in [Tuning](../tuning.md#morgul), with its default and which way to turn it. During play, `world.tune('morgul', { ... })`.

## With other modules

- **Athelas**: wounds are its courses, at their severity; `hurts` on its phases; tending is its mark; its quiet phases and the phase that tells are a poison's; a wound's phase that ends in death asks Morgul's lethality. Without Athelas a harm leaves no wound and no hurt (the mind's part still happens).
- **Bree**: grudges and feuds from harm; fights by numbers are its fights, blow by blow, ended by its stepping in; someone down talks to nobody; grudges are evidence for suspicion.
- **Reverie**: feelings, memories, beliefs (who did it, who set or dosed what, where it's dangerous), files.
- **Fellowship**: regard lost and gained, households feuding, liking and dislike in suspicion.
- **Wormtongue**: the crimes harm is, with their severity; gossip of what was seen, and of suspicion.
- **Cradle**: a killing is a departure; without it, nobody dies.
- **Ceres**: means are goods; taints ride its stock, its sales and its pantries.
- **Mentat**: revenge is a task aimed at someone, planned like any other.
- **Gaff**: paces violence as an event.

## Example

Rocinante's harm option (`buildRocinante(Tyrell, { harm: true })`, with Bree): a brawl at the Belt that Gaff paces (the two who like each other least come to blows, blow by blow, by strength, nerve, Vance's baton and Sam's knife), a snare Pip sets in the barn where Tomas fetches timber, and the nightshade Sam slips into the cafe's stew when nobody's there; bruises and beatings that mend, a cut that festers unless Lena tends it, nightshade working quietly for hours; grudges, fear, revenge (have it out, or spike their supper), and suspicion that falls on Sam some of the time and on the cook or a grudge-holder the rest. `npm run vk:harm` runs Voight-Kampff on it with the `harm` check: nobody dies with lethality 0, grudges follow harm, the poisoner is suspected some of the time and not always.

```js
const M = world.morgul;
M.means({ id: 'knife', kinds: ['cut'], use: 'strike', severity: 0.2 });
M.wound({ id: 'cut', kinds: ['cut'], course: 'cut' });
world.athelas.course({ id: 'cut', label: 'A cut', again: 'worsen', phases: [
  { id: 'bleeding', minutes: [60, 120], next: [{ if: ['tended:cut'], to: 'healing' }, { to: 'festering' }] },
  { id: 'festering', minutes: [600, 1200], hurts: 1.3, feel: 'festering', next: 'healing' },
  { id: 'healing', minutes: [1440, 2880], hurts: 0.3 },
] });
world.action({ id: 'tend', target: 'person', at: 'here', minutes: 20, base: 0.05, targetIf: ['target.hurt>0.05'], then: ['tend'], tags: ['care'] });
world.on('morgul:harm', (h) => showHit(h.to, h.severity));
world.on('bree:turn', (t) => { if (t.harm) scuffle(t.harm.by, t.harm.to); });
// on screen: the game's own hit, with who saw it
world.morgul.harm({ to: 'ruth', by: 'player', kind: 'blunt', severity: 0.15, seenBy: visibleTo(ruth) });
```
