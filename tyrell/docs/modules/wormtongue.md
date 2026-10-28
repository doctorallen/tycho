# Wormtongue

Word of mouth: witnesses, reports and heat, gossip, lies, silencing, secrets and favors. Named for the whisperer in Théoden's ear.

The ideas come from Thief's guards and Skyrim's crimes (witnesses who report), Hitman (disguises), and Talk of the Town (beliefs passed a hop at a time, weakening as they go).

- [Crimes](#crimes)
- [Witnessing](#witnessing)
- [Reports and heat](#reports-and-heat)
- [Silencing](#silencing)
- [Gossip](#gossip)
- [Lies](#lies)
- [Secrets](#secrets)
- [Favors](#favors)
- [State](#state)
- [API](#api)
- [Terms](#terms)
- [Events](#events)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Example](#example)

Wormtongue keeps what people know as Reverie beliefs. Without Reverie it can count heat and favors, but nobody remembers what they saw, nobody gossips, and nobody reports.

## Crimes

```js
world.fellowship.group({ id: 'watch', kind: 'authority', label: 'the Watch' });
world.wormtongue.crime({ kind: 'strip', severity: 0.6, reportTo: 'watch' });
world.wormtongue.crime({ kind: 'theft', severity: 0.4 });
```

`CrimeDef`:

| Field | Default | Meaning |
|---|---|---|
| `kind` | required | The stimulus kind (or deed `crime`, or action `crime`) that is this crime |
| `severity` | required | 0..1: how bad |
| `heat` | `severity × config.heatPerSeverity` (10) | Heat each report adds (times the headline knob `heat`) |
| `reportTo` | the first group of kind `'authority'` | The group reports go to |
| `feeling` | `'witnessed'` | The feeling a witness gets |
| `report` | `config.reportChance` (0.6) | The base chance a witness reports it |

Crimes come from three places: the game's `world.sense` with a crime's kind; a deed with `crime` reported with `seenBy` (`world.did`); and actions people do with `crime` (`steal_food` with `crime: 'theft'`), which everyone in the place sees with strength 0.8 (`crimeSeen`).

## Witnessing

When something is sensed, each witness in `seenBy` (not the actor):

1. **Recognizes the actor, or doesn't.** The chance is `strength × (1 - disguise)`, times `recognizeStranger` (0.5) if they don't know the actor. They know the actor if they have a relationship record with them (Fellowship) or a file on them (Reverie).
2. **Believes it.** They believe `did:<actor>:<kind>` (or `did:someone:<kind>` if they didn't recognize the actor) with the value `what` (or `true`), as something seen, with strength at least 0.3 (`sawStrength`).
3. **Remembers it**, as a memory of kind `saw:<kind>`, with importance 4 + 6 × severity for a crime (3 otherwise). The severity is the stimulus's own if it gives one (a harm's, from [Morgul](morgul.md)), else the crime's, and a report it leads to adds heat and infamy by it too.
4. **Feels it**, for a crime: the crime's `feeling`.
5. **Maybe reports it**, for a crime whose actor they recognized: with probability `report × (0.5 + lawful) × (1 - fear × 0.3) × (1 - max(0, regard) × 0.8) × reporting`, clamped to 0..1, where `lawful` is their trait `lawful` (else their value `law`, else 0.5), `fear` is `1 - courage` (0.5 if they have no courage trait), `regard` is their regard for the actor, 0.3 and 0.8 are `fearWeight` and `loyalty`, and `reporting` is the headline knob (the world's times the witness's own; 0: nobody reports). A report is scheduled `reportDelay` (10 to 90) minutes later.

Any stimulus kind is witnessed this way (beliefs and memories); only crimes add feelings and reports. The `witnessed` event is emitted for each witness.

## Reports and heat

When a report comes due, it's made only if the witness is still around and still holds the belief unsilenced. Then:

- the report is kept (the last 200, for 14 days);
- the actor's **heat** rises by the crime's `heat`;
- the actor's infamy rises by `0.2 × severity` (`infamyAuthority`) with the authority and `0.1 × severity` (`infamyGroups`) with each of the witness's groups (Fellowship);
- every member of the authority now believes it too (told by the witness, strength 0.8, `toldAuthority`);
- a `report` log entry and event.

Heat is the weight of reports against someone. It fades by `heatDecay` (to 85%) every day (to the power of the headline knob `cooling`), and is dropped under 0.05 (`heatFloor`). The game reads it with `heat(actor)` or the `heat` term, and can add to it with `addHeat`.

A member of the authority who hears about a crime through gossip takes it as a report too, with the teller as the witness and the belief's value as `what` (not when the belief is that it didn't happen).

## Silencing

```js
world.wormtongue.silence('lena', 'player', 'pay', 40);
world.wormtongue.silence('kofi', 'player', 'scare');
world.on('silenced', (e) => console.log(e.witness, e.ok ? 'agreed' : 'refused'));
```

A witness can be paid or scared off. The chance they agree:

- paid: `clamp(greed × 0.6 + min(1, amount / 100) × 0.5 - honesty × 0.4 + 0.1)` (`bribeGreed`, `bribeFull`, `bribeMoney`, `bribeHonesty`, `bribeBase`);
- scared: `clamp((1 - courage) × 0.8 - honesty × 0.2 + 0.1)` (`scareFear`, `scareHonesty`, `scareBase`).

Traits default to 0.5 (`config.traitDefault`). If they agree, every belief they hold about the actor's deeds (`did:<actor>:*`) is silenced: they won't gossip it, a pending report is dropped, and they no longer count as a witness. A paid witness who agrees gets the amount added to their money; Wormtongue doesn't take it from anyone, so take it from the player yourself. Scaring someone gives them the `scared` feeling and lowers their regard for the actor by 0.3 (`scareRegard`), whether or not it works.

Silencing works on what the witness believes about the named actor. A witness who didn't recognize the actor (`did:someone:...`) has nothing to silence, and an authority that has already heard is past silencing.

## Gossip

When two people meet, each may pass one thing on to the other: with probability `gossipChance × (0.5 + talkative) × gossip`, the last the headline knob (the world's times the teller's own; 0: nobody tells anybody). They pick the belief most worth telling:

- not silenced, fewer than `maxHops` (3) tellings from whoever saw it, not a key starting with `@`;
- not something the listener already believes the same way;
- not about the listener ("not to their face");
- a secret only if the teller dislikes the person it's about (regard under -0.3, `secretSpite`), and isn't that person;
- scored by juiciness (a crime 3, any other `did:` 1.5, anything else 1: `juicyCrime`, `juicyDeed`) times strength times `0.99` (`gossipRecency`) per hour since they last heard it.

The listener believes it, as told, from the teller, with strength `str × trust × 0.9` (`toldKeep`) and one more hop, where trust is `clamp(0.6 + regard × 0.4, 0.2, 1)` (`trustBase`, `trustRegard`, `trustMin`, `trustMax`) from the listener's regard for the teller (0.7, `trustAlone`, without Fellowship). A `told` log entry and event follow.

## Lies

A teller who is dishonest (honesty under 0.3, `liarBelow`) and dislikes the person a `did:` belief is about (regard under -0.3, `lieSpite`) lies with probability `lieChance` (0.5) times the headline knob `lies`: they shift the blame, naming someone else they dislike (regard under -0.2, `scapegoat`, not the listener) as the one who did it. `did:ruth:theft` goes on as `did:dev:theft`, with the same value. A lie never clears anyone: with nobody else to blame, or for a belief that someone *didn't* do something (`false`), they pass on what they believe.

The `told` event and log entry carry `lie: true` only when the blame was shifted.

## Secrets

```js
world.wormtongue.secret('affair', { about: 'tomas', key: 'affair:tomas', value: true, knownBy: ['ines'] });
```

A `Secret` is `{ about, key, value, knownBy }`. Declaring one (an input) gives everyone in `knownBy` the belief. Secrets are gossiped only by people who dislike the person they're about. Each new teller adds the listener to `knownBy`; when four people know (`exposedAt`), an `exposed` event fires (once).

## Favors

```js
world.wormtongue.owe('kofi', 'dev', 2);     // Kofi owes Dev two favors
world.wormtongue.owes('kofi', 'dev');       // 2
world.wormtongue.owe('kofi', 'dev', -2);    // settled
```

Favors are a count per pair (debtor, creditor), dropped at 0 or below. Conditions read them with `owes:<id>` and `owed:<id>`.

## State

In `world.s.mod.wormtongue`:

| Key | Holds |
|---|---|
| `heat` | Heat by actor |
| `reports` | Reports: `{ t, witness, actor, kind, what?, to? }` |
| `secrets` | Secrets by id |
| `favors` | Favors by `'debtor>creditor'` |

Pending reports are module timers in the world's queue.

## API

`world.wormtongue`. **Input** methods are recorded and safe from the game.

| Method | Returns | |
|---|---|---|
| `crime(def)` | this | Declares a crime |
| `heat(actor)` | number | Heat on someone |
| `addHeat(actor, by)` | void | **Input.** Changes heat |
| `reports(actor?)` | Report[] | Recent reports, newest last |
| `witnesses(actor, kind?)` | id[] | Everyone active who holds an unsilenced belief that the actor did a crime (seen or heard) |
| `silence(witness, actor, how, amount = 0)` | void | **Input.** `how` is `'pay'` or `'scare'`; listen for `silenced` for the outcome |
| `secret(id, secret)` | void | **Input.** Declares a secret |
| `secrets()` | object | Every secret, by id |
| `owe(debtor, creditor, n = 1)` | void | **Input.** Adds favors owed (negative settles) |
| `owes(debtor, creditor)` | number | Favors owed |
| `applyOwe(debtor, creditor, n)` | void | **Engine.** The direct version |
| `config`, `crimes` | | The config and the declared crimes |

## Terms

`heat` / `heat:<actor>`, `owes:<id>`, `owed:<id>`, `saw:<actor>.<kind>`. See [Conditions](../conditions.md#wormtongue).

## Events

| Event | Payload |
|---|---|
| `witnessed` | `{ id, actor, kind, recognized }`: `id` is the witness; `actor` is `'someone'` when not recognized |
| `report` | `{ t, witness, actor, kind, what?, to?, heat }`: `heat` is the actor's heat after it |
| `silenced` | `{ witness, actor, how, ok }` |
| `told` | `{ from, to, key, v, lie }` |
| `exposed` | `{ about, key }`: a secret reached four people |

Log entries: `witnessed`, `report`, `silenced`, `told`, `exposed`, `owes`.

A `'*'` listener gets `{ kind, ...payload, event }`. Read the event's name from `event`: for `witnessed` and `report`, whose payloads have their own `kind`, `kind` is the crime (`'theft'`).

## Config

`Tyrell.create({ moduleConfig: { wormtongue: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `reportChance` | 0.6 | Base chance a witness reports a crime |
| `reportDelay` | `[10, 90]` | Minutes before a report is made |
| `recognizeStranger` | 0.5 | Chance of recognizing someone you don't know (before strength and disguise) |
| `gossipChance` | 0.45 | Chance per meeting that someone passes something on (times 0.5 + talkative) |
| `maxHops` | 3 | Gossip goes at most this many tellings from whoever saw it |
| `heatDecay` | 0.85 | Heat kept per day |
| `lieChance` | 0.5 | Chance a dishonest teller who dislikes the subject lies |
| `gossip` | 1 | Headline knob: how readily gossip spreads (0: nobody tells) |
| `reporting` | 1 | Headline knob: how readily crimes are reported (0: nobody reports) |
| `heat` | 1 | Headline knob: how much heat each report adds |
| `cooling` | 1 | Headline knob: how fast heat cools (0: never) |
| `lies` | 1 | Headline knob: how readily liars shift the blame (0: nobody lies) |

A person's own `tune: { wormtongue: { ... } }` multiplies the knobs for them: as the teller for `gossip` and `lies`, the witness for `reporting`, the actor for `heat` and `cooling`. The finer numbers, each explained in [Tuning](../tuning.md#wormtongue): `heatPerSeverity` (10), `heatFloor` (0.05), `sawStrength` (0.3), `crimeMemory` (4), `severityMemory` (6), `plainMemory` (3), `fearWeight` (0.3), `loyalty` (0.8), `crimeSeen` (0.8), `infamyAuthority` (0.2), `infamyGroups` (0.1), `toldAuthority` (0.8), the bribe's `bribeGreed` (0.6), `bribeFull` (100), `bribeMoney` (0.5), `bribeHonesty` (0.4), `bribeBase` (0.1), the threat's `scareFear` (0.8), `scareHonesty` (0.2), `scareBase` (0.1), `scareRegard` (-0.3), and gossip's `secretSpite` (-0.3), `juicyCrime` (3), `juicyDeed` (1.5), `gossipRecency` (0.99), `liarBelow` (0.3), `lieSpite` (-0.3), `scapegoat` (-0.2), `trustBase` (0.6), `trustRegard` (0.4), `trustMin` (0.2), `trustMax` (1), `trustAlone` (0.7), `toldKeep` (0.9), `exposedAt` (4). During play, `world.tune('wormtongue', { ... })` changes any of them as an input.

## With other modules

- **Reverie** holds everything people know (beliefs), what they saw (memories), and how they feel about it.
- **Fellowship** decides who knows whom (recognition), how far people trust each other (gossip strength), who lies about whom, and where reports go (authority groups, infamy).
- **Mentat**: actions tagged `'illegal'` cost more to plan for honest people and people with heat.
- **Gaff**: `metric:heat.player` lets storylets react to heat.

## Example

```js
world.fellowship.group({ id: 'watch', kind: 'authority' });
world.wormtongue.crime({ kind: 'strip', severity: 0.6, reportTo: 'watch' });

world.on('report', (r) => { if (r.actor === 'player') showToast(`${world.get(r.witness).name} reported you. Heat ${r.heat}.`); });

// the game saw the player strip the market's till in front of Dev and Ruth
world.sense({ kind: 'strip', actor: 'player', what: 'till', place: 'market', seenBy: ['dev', 'ruth'] });
world.reverie.belief('dev', 'did:player:strip');      // 'till' (if he recognized the player)
world.wormtongue.witnesses('player');                  // the ones who did

// pay one off before the report comes in (and take the money from the player)
world.wormtongue.silence('ruth', 'player', 'pay', 40);
```
