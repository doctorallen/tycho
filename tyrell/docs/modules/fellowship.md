# Fellowship

How people stand with each other: regard between any two people, attraction, sentiments with reasons, hidden compatibility, groups and households, and standing with groups as fame and infamy kept apart. Named for the Fellowship of the Ring.

The ideas come from Merryfolk's hearts (regard grown by time together), The Sims (attraction as its own track; The Sims 4's sentiments), RimWorld (hidden compatibility) and Fallout: New Vegas (fame and infamy kept apart, so the same people can like you and fear you).

- [Regard](#regard)
- [Attraction and compatibility](#attraction-and-compatibility)
- [Sentiments](#sentiments)
- [Groups and households](#groups-and-households)
- [Standing](#standing)
- [Imitation](#imitation)
- [State](#state)
- [API](#api)
- [Terms and effects](#terms-and-effects)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Example](#example)

## Regard

Regard is one person's feeling toward another, -1..1, one way: Ruth can like Kofi more than he likes her. It's a base value plus the person's active sentiments about the other, clamped.

It moves:

- **by time together**: when someone starts an action at a place where others are doing something (up to three of them, picked at random), and the two will overlap for 3 minutes or more, they meet. Each one's regard for the other grows by `meetGain × (minutes / 30) × (1 + compat + (mood - 0.5))`, where `minutes` is the overlap, held between -0.05 and 0.08 per meeting. Compatible people in good moods warm faster; incompatible ones can cool;
- **by deeds**: a deed's `regard` changes the receiver's regard for the doer, and 0.4 of it for anyone who saw (`seenBy`);
- **by social acts** (Cityspeak), silencing by fear (Wormtongue, -0.3), and the game (`fellowship.adjust`);
- **back toward zero** by `decay` (0.004) every day.

Social actions (tagged `'social'`) aimed at someone weigh `clamp(1 + regard × 0.8 + compat × 0.2, 0.1, 2)`: people seek out the people they like.

## Attraction and compatibility

**Compatibility** is hidden and the same both ways: a seeded value in ±`compatSpread` (0.6) for each pair, plus up to 0.3 for shared values (`PersonDef.values`), clamped to -1..1. Some people just get on.

**Attraction** is a second track for romance, -1..1. It grows by half the regard gain when they meet, but only for pairs with compatibility over 0.3, and only while the person has no partner. Cradle can pair people when regard and attraction are both high.

## Sentiments

A sentiment is a labeled reason that adds to regard: "helped me out" +0.15, "snubbed me" -0.5 for an hour.

```js
world.fellowship.sentiment('kofi', 'player', 'snubbed me', -0.5, 60);   // for an hour
world.fellowship.sentiments('kofi', 'player');   // [{ label: 'snubbed me', by: -0.5, until: ... }]
```

A relationship keeps at most `sentiments` (4); past that, the weakest (by absolute value) goes. A new sentiment with the same label replaces the old one. Sentiments with a time run out. Deeds with `sentiment` add one (worth the deed's `regard`, or 0.1); Cradle adds 'my partner' and 'my child'.

## Groups and households

```js
world.fellowship.group({ id: 'h_okafor', kind: 'household', label: 'the Okafors', purse: true });
world.fellowship.group({ id: 'watch', kind: 'authority', label: 'the Watch' });
world.person('mara', { home: 'flat_1', groups: ['h_okafor'] });
world.fellowship.join('regulars', 'kofi');
```

`GroupDef`:

| Field | Meaning |
|---|---|
| `id` | The group's id |
| `label` | A readable name |
| `kind` | `'household'` (a person's household: Ceres shares money in it), `'authority'` (Wormtongue reports crimes to it), or anything else (`'family'`, `'faction'`, `'club'`) |
| `members` | Members listed here, on top of people whose definitions name the group |
| `purse` | Households: money and goods are shared (Ceres) |

A person's groups are those their definition names, those that list them, and those they've joined at runtime. A person's household is their first group of kind `'household'`.

## Standing

Standing is how a group sees someone (usually the player): fame and infamy, each 0..1, kept apart, with a label from the pair.

```js
world.fellowship.changeStanding('watch', 'player', 0.5, 0);
world.fellowship.standing('watch', 'player');   // { fame: 0.5, infamy: 0, label: 'liked' }
```

Each value falls in a band (under 0.15, under 0.4, under 0.7, above), and the label is `config.labels[fameBand][infamyBand]`:

| Fame \ Infamy | low | some | high | very high |
|---|---|---|---|---|
| **low** | unknown | suspect | trouble | menace |
| **some** | familiar | mixed | rough edges | feared |
| **high** | liked | complicated | loved and feared | dangerous hero |
| **very high** | beloved | tolerated | wild card | legend |

Deeds with `fame` or `infamy` change the doer's standing with every group the receiver belongs to. Wormtongue adds infamy when crimes are reported.

## Imitation

When two people meet and one likes the other (regard over 0.3), what the liked person is doing becomes a little more appealing: their habit for that action rises by `imitation` (0.03).

## State

In `world.s.mod.fellowship`:

| Key | Holds |
|---|---|
| `rel` | Relationships by `'a>b'`: `{ r, a, s, met, last }`: regard base, attraction, sentiments, meetings, last met |
| `standing` | By group, by subject: `[fame, infamy]` |
| `partners` | Partner by person (both ways) |
| `joined` | Members added at runtime, by group |

## API

`world.fellowship`. **Input** methods are recorded and safe from the game; **engine** methods change state directly.

| Method | Returns | |
|---|---|---|
| `group(def)` | this | Declares a group |
| `members(group)` | id[] | Everyone in it (not gone) |
| `groupsOf(id)` | id[] | The groups a person belongs to |
| `household(id)` | id or undefined | Their household group |
| `join(group, id, on = true)` | void | **Input.** Joins (or leaves, with `false`) a group |
| `regard(a, b)` | number | a's regard for b, sentiments included |
| `attraction(a, b)` | number | a's attraction to b |
| `compat(a, b)` | number | The pair's compatibility |
| `knows(a, b)` | boolean | a has a relationship record with b (they've met, or regard was set) |
| `relations(a)` | array | Everyone a has a record with: `{ id, regard, attraction, met }`, best first |
| `friends(a, n = 3)` | id[] | The people a likes most (regard over 0.2) |
| `adjust(a, b, by, why?)` | void | **Input.** Changes a's regard for b (logged when `why` is given) |
| `sentiment(a, b, label, by, minutes?)` | void | **Input.** Adds a sentiment |
| `sentiments(a, b)` | Sentiment[] | Active sentiments |
| `partner(a)` | id or undefined | a's partner |
| `setPartner(a, b)` | void | **Input.** Makes them partners (or ends a's partnership with `null`) |
| `standing(group, subject)` | `{ fame, infamy, label }` | Standing |
| `changeStanding(group, subject, fame, infamy)` | void | **Input.** Adds to fame and infamy |
| `rel(a, b)` | Rel | **Engine.** The record, made if missing |
| `applyRegard`, `applySentiment`, `applyStanding`, `applyJoin`, `applyPartners` | void | **Engine.** The direct versions of the inputs |
| `config`, `groups` | | The config and the declared groups |

## Terms and effects

Terms: `regard`, `attraction`, `compat`, `friend`, `foe` (each toward the target, or `:<id>`), `member:<group>`, `partner` / `partner:<id>`, `fame:<group>.<subject>`, `infamy:<group>.<subject>`.

Effects: `regard+=n` / `regard:<id>+=n` / `regard=n`, `fame:<group>.<subject>+=n`, `infamy:<group>.<subject>+=n`. In effects, `fame` and `infamy` without a subject change the player's standing; in conditions, they read the person's own.

See [Conditions](../conditions.md#fellowship).

## Events

Fellowship emits no events of its own. It writes log entries: `met` (`{ target, minutes }`), `regard` (when a reason is given), `sentiment`.

## Config

`Tyrell.create({ moduleConfig: { fellowship: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `meetGain` | 0.03 | Regard gained per half hour together, before compatibility and mood |
| `compatSpread` | 0.6 | How much compatibility varies between pairs |
| `decay` | 0.004 | Regard drifts back toward zero by this much a day |
| `sentiments` | 4 | Most sentiments kept per relationship |
| `imitation` | 0.03 | How much a liked person's habits rub off |
| `labels` | the table above | Standing labels, rows by fame band, columns by infamy band |

## With other modules

- **Reverie**: mood speeds or slows warming; deeds' feelings and memories go with their regard.
- **Wormtongue**: someone the witness has a record with is recognized; regard lowers the chance a witness reports someone they like; gossip trust depends on how much the listener likes the teller; liars lie about people they dislike; reports go to `'authority'` groups and add infamy.
- **Ceres**: a household with `purse: true` shares one purse and one pantry.
- **Cityspeak**: social acts change regard; the `regard` input makes a natural `accept` consideration.
- **Cradle**: partners, couples forming from regard and attraction, children joining their parents' household, grief by regard.

## Example

```js
const fs = world.fellowship;
fs.group({ id: 'regulars', kind: 'club', label: "the Belt's regulars" });
world.deed('stood_a_round', { regard: 0.1, sentiment: 'bought me a drink' });

world.did('player', 'stood_a_round', { for: 'ines', seenBy: ['kofi'] });
fs.regard('ines', 'player');        // 0.1 base + 0.1 sentiment
fs.regard('kofi', 'player');        // 0.04: he saw it
fs.changeStanding('regulars', 'player', 0.2, 0);
fs.standing('regulars', 'player').label;   // 'familiar'
world.lang.test('friend:player', world.ctx(world.get('ines')));   // false: regard is under 0.5
```
