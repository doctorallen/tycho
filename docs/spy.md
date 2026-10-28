# Spy (proposed)

**Proposed: nothing on this page is built yet.** Spy is a development tool for watching what happens inside a running game: every event the simulation produces, each with an impact from 0 to 1, shown above a threshold you set. A death is near 1; two people chatting is near 0. Set the threshold to 0.6 and you see only the fights, the deaths, the weddings and the crimes, as they happen, on screen or off; drop it to 0 and you see everything. It's for the people making the games, in the dev drawer; players never see it.

- [What it shows](#what-it-shows)
- [Where the events come from](#where-the-events-come-from)
- [Impact](#impact)
- [Keeping what matters](#keeping-what-matters)
- [The viewer](#the-viewer)
- [Each game](#each-game)
- [Open questions](#open-questions)
- [The order to build it](#the-order-to-build-it)

## What it shows

One list of events, newest first, each a line:

```
Day 3 · 23:50  0.95  momentous  Tomas died in his sleep, aged 91                      Tomas · home
Day 3 · 21:38  0.61  major      Dev and Sam's argument turned into a fight            Dev · Sam · bar
Day 3 · 19:05  0.44  notable    Ruth fell ill: the stew at the market was poisoned    Ruth · market
Day 3 · 18:12  0.31  notable    Kofi saw the player strip the till at the grocery     Kofi · grocery
```

Above it, the threshold (a number, and a slider), a few filters (who, where, what kind), and a button to stop the list moving while you read. Tap an event for its details: everything in it, and how its impact was worked out.

## Where the events come from

- **Tyrell's log.** Westmarch, Tyrell's record of what happened, already writes an entry for nearly everything: arrivals, actions, feelings, deeds, crimes witnessed and reported, gossip told, couples, births, departures, the director's events ([its kinds](../tyrell/docs/tools.md#westmarch)). It saves and rewinds with the world. Spy reads it. Anything a module emits but doesn't log yet (Bree's exchanges by how they came out, Morgul's harms from the [harm design](harm.md)) gets a log entry, so the log stays the one source.
- **The game's own events.** A game with Tyrell writes its own with `world.log(kind, who, data)`, which is already an input, so they rewind too: the White Dragon's finished jobs, Merryfolk's festivals.
- **A game without Tyrell** (Lodestar) writes to a small log of Tycho's own, in the same shape: a boss felled, the Kindler falling, a piece of the core lost.

Every event comes to Spy as `{ t, kind, who, place, impact, text, data }`.

## Impact

Each event's impact is worked out as it's written, from a table the game gives: a base by kind, then raised or lowered by what's in the event and who's in it.

**A base by kind**, for example:

| Kind | Base |
|---|---|
| A death (`gone`, `killed`) | 0.95 |
| A birth, a wedding (`born`, `paired`) | 0.8 |
| A fight, a harm that knocks someone down | 0.6 |
| A crime reported (`report`) | 0.5 |
| A feud begun, a grudge deepened | 0.4 |
| An argument | 0.3 |
| A friendship made, a feeling that broke someone (`broke`) | 0.3 |
| Gossip told (`told`) | 0.1 |
| A chat | 0.05 |
| An action started, an arrival | 0.01 |

**Then the specifics**, each a setting the game can weigh or turn off:

- **How bad it was**: the severity an event already carries (a crime's, a harm's), and how a conversation came out (a row counts for more than a warm chat).
- **Who was in it**: famous people (Fellowship's standing), the player, and people the player knows count for more.
- **How many saw it**: something done in front of a crowd counts for more than the same thing alone.
- **How rare it is**: the first fight between two old friends counts for more than the tenth between rivals (a small count by kind and pair).
- **How much it changed**: a chat that made two strangers friends counts for more than one that left them as they were.

Impact is the world's: how much this matters to the story of the place. How much it matters to one person is already their memory's importance (Reverie), and Spy can show that too, filtered to one person.

**Bands** name the ranges, so the threshold can be a word as well as a number: trivial (under 0.1), minor (0.1), notable (0.3), major (0.6), momentous (0.9). The game sets the cutoffs.

Scoring runs on every entry, so it's a table lookup and a few multiplications. It reads only the world's state and the entry, so it's deterministic, and an impact is the same on a replay. It's off unless the game gives a table: a world without one logs exactly as now, hash for hash.

## Keeping what matters

Today Westmarch keeps its last 1,000 entries and drops the oldest first. With impact on, it keeps by band instead: trivial entries for a few hours, minor ones for a couple of days, notable ones for a couple of weeks, and major and momentous ones for the whole game, up to a cap of their own. That's a lasting history of the place for the price of a few hundred entries, and since the log is in every time-walk snapshot, dropping the trivial ones sooner makes time walk lighter too.

## The viewer

`Tycho.spy`, in the engine's shell layer: the list, the threshold, the filters and the details, drawn into the dev drawer. The minds inspector (`Tycho.inspect`, the White Dragon's Tyrell mode) carries it as a tab, so from an event you can go straight to what it touched:

- **Open the mind** of anyone in it: what they're doing, their needs and feelings, why they chose what they did.
- **Go there**: the dev drawer's Go to, landing by them or at the place.
- **Go back to it**: time walk to a minute before it happened (`world.seek`), to watch it play out.

And for watching while you play:

- **Alerts**: anything at or above a second threshold (momentous, by default) pops up as a toast wherever you are, so you hear about a death across the city as it happens.
- **Runs folded**: "Ruth chatted 14 times" as one line that opens up, so the trivial doesn't bury the rest when the threshold is low.
- **Why this impact**: the details show the sum: base 0.6 for a fight, × 1.4 for its severity, + 0.1 for the player knowing them, + 0.05 for three witnesses.
- **Copy**: an event, or the list as shown, as text, for a bug report.

The bridge (`Tycho.minds.spy`) turns Westmarch's entries into Spy's events, with names and places from the game and a line of text from Westmarch's own words for each kind (the ones its chronicles already use).

## Each game

- **The White Dragon**: in its dev drawer, and as a tab in Tyrell mode. Its table weighs strips that were seen and reported, rows and feuds among the residents, and jobs finished and botched. Nobody dies there.
- **Merryfolk**: in its dev drawer. Births, weddings and deaths of old age weigh most, then quarrels and, with harm, scuffles and pranks.
- **Lodestar**: Spy on Tycho's own log, if it's wanted: bosses and elites felled, the Kindler falling, the core losing a piece.

## Open questions

1. **The name**: Spy, for the viewer (`Tycho.spy`)?
2. **Kept in the world or worked out when shown?** Worked out as written (as above), the impact is saved, rewinds, and lets the log keep what matters. Worked out only when shown, nothing in the world changes, but the log can't keep by impact. The first is proposed; Spy could still score again with a different table while you tune it.
3. **Keeping by band**: the lifetimes above, or keep the log as it is and score only?
4. **Lodestar**: does it get Spy too?

## The order to build it

1. **Westmarch**: impact from the game's table, the bands, `find` by a least impact, keeping by band, and words for every kind; log entries for what modules emit but don't log. Tests that a world without a table hashes as now, and that impacts are the same on a replay. After the harm work, which adds Morgul's entries to the same log.
2. **`Tycho.spy`**: the viewer, and the small log for games without Tyrell, with its tests and its page.
3. **The bridge**: `Tycho.minds.spy`, and the inspector's tab.
4. **Each game**: its table, and Spy in its dev drawer.
