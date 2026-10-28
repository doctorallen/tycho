# API reference

The complete reference: what `Tyrell` exports, every option, every `World` property and method, every event, the main types, and how to write your own module. Module APIs are on their own pages: [Reverie](modules/reverie.md#api), [Fellowship](modules/fellowship.md#api), [Wormtongue](modules/wormtongue.md#api), [Cityspeak](modules/cityspeak.md#api), [Mentat](modules/mentat.md#api), [Gaff](modules/gaff.md#api), [Ceres](modules/ceres.md#api), [Cradle](modules/cradle.md#api), [Joi](modules/joi.md#api). The core's parts: [Ring](places.md#the-ring-api), [Strangers](places.md#strangers), [Esper](time.md), [Palantír and Westmarch](tools.md).

Throughout, **input** marks a method that changes the world through `world.input`: it's recorded for time walk and safe to call from the game. **Engine** marks a method that changes state directly: call it only from inside the simulation (effects, storylets, module hooks, custom input handlers).

- [Exports](#exports)
- [Options](#options)
- [World properties](#world-properties)
- [World methods](#world-methods)
- [Events](#events)
- [Inputs by name](#inputs-by-name)
- [Types](#types)
- [Writing a module](#writing-a-module)

## Exports

`dist/tyrell.js` defines the global `Tyrell`; `dist/tyrell.mjs` and `dist/tyrell.cjs` export the same names.

| Export | |
|---|---|
| `create(opts?)` | Makes a new world: `World` |
| `VERSION` | `'1.0.0'` |
| `MODULES` | `['reverie', 'fellowship', 'wormtongue', 'cityspeak', 'mentat', 'gaff', 'ceres', 'cradle', 'joi']` |
| `VoightKampff` | `{ run(opts), compare(report, baseline, tolerance?) }`: see [Tools](tools.md#voight-kampff) |
| `World` | The world class (use `create`) |
| `DEFAULT_CONFIG` | The default `Config` |
| `SCHEMA` | The save schema version: `2` |
| `MIGRATIONS` | Save migrations: `MIGRATIONS[v](state)` turns a version-`v` state into `v + 1`. See [Saving](saving.md) |
| `Reverie`, `Fellowship`, `Wormtongue`, `Cityspeak`, `Mentat`, `Gaff`, `Ceres`, `Cradle`, `Joi` | The module classes. `create` makes them; you only need these for types or to build a world by hand |
| `curveAt(curve, x)` | Evaluates a response curve at `x` in 0..1 |
| `Stream` | A seeded random stream: `new Stream(...parts)`; `next()`, `range(lo, hi)`, `int(n)`, `chance(p)`, `pick(items)`, `weighted(items, weightFn)`, `shuffle(items)` |
| `clamp(x, lo = 0, hi = 1)` | Clamps a number |
| `hash(...parts)` | A stable 32-bit hash of strings and numbers |
| `hash01(...parts)` | The hash as a number in [0, 1) |
| `hourOf(t)` | The hour of the day (0 to 24) at a time in minutes |
| `dayOf(t)` | The day number at a time |
| `inHours(h, [from, to])` | Is hour `h` inside the span (wrapping past midnight)? |
| `HOUR`, `DAY` | 60 and 1440 |

Types are exported too (from `dist/tyrell.d.ts`, or `dist/tyrell.global.d.ts` for the global): everything in `types.ts`, `SaveData`, `Module`, and the modules' definition types (`FeelingDef`, `BreakDef`, `MemoryKindDef`, `Belief`, `Memory`, `PersonFile`, `Shift`, `ReverieConfig`, `GroupDef`, `Sentiment`, `FellowshipConfig`, `CrimeDef`, `Report`, `Secret`, `WormtongueConfig`, `LineDef`, `PracticeDef`, `SocialActDef`, `Said`, `MentatConfig`, `StoryletDef`, `Phase`, `GaffConfig`, `GoodDef`, `CradleConfig`, `JoiRequest`, `JoiReply`, `JoiProvider`, `Spoken`, `StrangerDef`, `StrangerErrand`, `VKOptions`, `VKReport`, `VKStats`, `VKCheck`, `Requirement`, `LogFilter`).

## Options

`create(opts)` takes `CreateOptions`:

| Field | Default | Meaning |
|---|---|---|
| `seed` | `'tyrell'` | The world's seed (a string or number) |
| `start` | 0 | Start time in minutes (`8 * 60` is 8 am on day 0) |
| `modules` | all | The modules to switch on, by name. An unknown name throws |
| `shell` | `{}` | `{ travel?, near?, check? }`: see [Integration: the shell](integration.md#the-shell) |
| `config` | | Partial `Config` (below) |
| `esper` | | Partial `EsperConfig` (below) |
| `moduleConfig` | | Settings by module name: `{ reverie: {...}, fellowship: {...}, wormtongue: {...}, mentat: {...}, gaff: {...}, cradle: {...} }`. Cityspeak, Ceres and Joi take none |
| `extra` | | Your own modules, added after the built-in ones |

`Config` (all optional; see [Deciding: config](deciding.md#config) for what each does):

| Field | Default | | Field | Default |
|---|---|---|---|---|
| `minutesPerSecond` | 1 | | `travelScale` | 30 |
| `week` | 7 | | `placesPerAction` | 4 |
| `urgent` | 0.85 | | `idle` | 20 |
| `urgentRank` | 1.5 | | `backoff` | 15 |
| `desperateRank` | 2.5 | | `budgetMs` | 4 |
| `cut` | 0.25 | | `logSize` | 1000 |
| `top` | 3 | | `decisions` | 12 |
| `power` | 2 | | `habitFast` | 0.25 |
| `inertia` | 1.15 | | `habitSlow` | 0.05 |
| `repeat` | 0.75 | | `habitMin` | 0.25 |
| `compensate` | true | | `habitMax` | 4 |

`EsperConfig` (see [Time](time.md#esperconfig-and-memory)):

| Field | Default |
|---|---|
| `on` | true |
| `every` | 15 |
| `keep` | 1440 |
| `sparseAfter` | 240 |
| `sparseEvery` | 60 |

## World properties

| Property | Type | |
|---|---|---|
| `s` | WorldState | The state, plain JSON. Read it; never write it from game code |
| `config` | Config | The config. `minutesPerSecond` and `budgetMs` can be changed at any time |
| `shell` | Shell | The shell |
| `now` | number | Minutes since the world began |
| `hour` | number | Hour of the day, 0 to 24 |
| `day` | number | Day number |
| `weekday` | number | `day % config.week` |
| `speed` | number | Get or set: 1 normal, 0 paused, negative plays backward |
| `needs`, `actions`, `tasks`, `deeds` | Map | The declared definitions |
| `lang` | Lang | The condition language: `test(cond, ctx)`, `all(conds, ctx)`, `failing(conds, ctx)`, `value(term, ctx)`, `compile(cond)`, `apply(effect, ctx)` (engine), `applyAll(effects, ctx)` (engine), `term`, `effect`, `hasTerm(name)` |
| `ring` | Ring | Places, travel, slots, hours: see [Places](places.md#the-ring-api) |
| `mind` | Bicameral | Needs and decisions: `level(p, need, t?)`, `urgency(p, need)`, `habit(p, action)`, `routineAt(p, t?)`, `routineFor(p, t?)`, `shiftAt(p, t?)`, `required(p)`, `options(p)`, `explain(p, id)`, `blockedReason(p, candidate)`, `consider(consideration, ctx, travel?)`, `offeredAt(action, place, p)`; engine: `setLevel`, `settle`, `relieve`, `learn`, `nudge`, `decide`, `weigh`, `pick` |
| `clock` | Entmoot | The clock: `body(id)`, `bodies()`, `isNear(p)`, `embodied(id)`, `regionsInFocus()`; engine: `schedule(item)`, `think`, `rethink`, `reconsider`, `begin`, `interrupt`, `fail`, `finishNow`, `sendAway`, `removePerson`, `refreshBodies` |
| `esper` | Esper | Time walk: `on`, `config`, `earliest()`, `latest()`, `span()`, `size()`, `mark(name)`, `seekMark(name)`, `export()`, `import(h)` |
| `westmarch` | Westmarch | The log: `find(filter)`, `since(t, k?)`, `chronicle(id, since)` |
| `palantir` | Palantir | The inspector: `why`, `whyNot`, `describe`, `history(id)`, `inspect(id)`, `parts(c)`, `enabled` |
| `strangers` | Strangers | `define`, `at`, `find`, `promote` (input), `promoted` |
| `modules` | Map | Modules by name |
| `hooks` | Module[] | Modules in the order their hooks run |
| `replaying` | boolean | True while Esper replays (events are silent) |
| `reverie`, `fellowship`, `wormtongue`, `cityspeak`, `mentat`, `gaff`, `ceres`, `cradle`, `joi` | | Each module, or `undefined` when it's off |

## World methods

### The clock

| Method | Returns | |
|---|---|---|
| `tick(seconds)` | void | Moves on `seconds × minutesPerSecond × speed` minutes (forward with the frame budget; backward with Esper), then refreshes bodies |
| `advance(minutes)` | void | `advanceTo(now + minutes)` |
| `advanceTo(t)` | void | Runs to time `t` with no budget; a past `t` seeks back |
| `seek(t)` | void | Goes to any time Esper remembers, back or forward |
| `rewind(minutes)` | void | `seek(now - minutes)` |

Called from a listener (or a storylet, an effect, an input handler), these and `load` wait until the call that's running returns, then run in order.
| `at(t, name, data = {})` | void | **Input.** A timer: emits `timer` and `timer:<name>` at `t` |

### Declaring

All definitions; declare them on every start. Each returns the world, so they chain.

| Method | |
|---|---|
| `need(def)` | A need: [NeedDef](deciding.md#needs) |
| `place(def)` | A place: [PlaceDef](places.md#declaring-a-place) |
| `link(a, b, minutes, oneWay = false)` | A walk between places |
| `action(def)` | An action: [ActionDef](deciding.md#actions) |
| `task(def)` | A task: [TaskDef](modules/mentat.md#tasks-and-methods) |
| `deed(verb, def)` | What a deed means: [DeedDef](integration.md#sensing-and-deeds) |
| `term(name, fn)` | A condition term: [Extending](conditions.md#extending-the-language) |
| `effect(name, fn)` | An effect |
| `defineInput(name, fn)` | A custom input: [Integration](integration.md#custom-inputs) |

| Method | Returns | |
|---|---|---|
| `person(id, def = {})` | PersonState | **Input** (applies at once). Adds a person, or returns the existing one (after a load, the saved person; `def` is then ignored) |
| `module(name)` | Module or undefined | A module by name (your own too) |

### Telling the world things

| Method | Returns | |
|---|---|---|
| `fact(key)` | value or undefined | Reads a fact |
| `fact(key, value)` | value | **Input** (skipped if unchanged). Sets a fact |
| `focus(regions)` | void | The regions the game has loaded. Not saved, not an input |
| `sense(stimulus)` | void | **Input.** Something was seen or heard: [Stimulus](integration.md#sensing-and-deeds) |
| `did(actor, verb, data = {})` | void | **Input.** A deed: `data.for` (or `to`, `target`), `what`, `place`, `seenBy` |
| `report(id, 'failed' or 'done', reason = '')` | void | **Input.** A body reports back |
| `direct(id, directive or null)` | void | **Input.** A directive, or release: [Directives](deciding.md#directives) |
| `reward(id, action, amount)` | void | **Input.** Nudges a habit |
| `setVar(id, name, value)` | void | **Input.** Sets a person's variable |
| `give(id, item, count = 1)` | void | **Input.** Gives goods (negative takes, not below 0) |
| `away(id, until, summary = '', place?)` | void | **Input.** Sends someone away until a time |
| `follow(id, leader or null)` | void | **Input.** Following |
| `remove(id, why = 'left')` | void | **Input.** Gone for good |
| `keep(key, value)` | void | **Input.** Keeps game state with the world (copied as JSON) |
| `kept(key)` | value or undefined | Reads it back |

### Asking

| Method | Returns | |
|---|---|---|
| `get(id)` | PersonState or undefined | A person's state (read it; don't change it) |
| `people()` | PersonState[] | Everyone active |
| `have(person, item)` | number | Their goods plus their household's pantry |
| `needOf(id, need)` | number | A need's level now |
| `bodies()` | Body[] | Everyone near |
| `body(id)` | Body or null | Anyone's body as it would be shown now (null if not active) |
| `why(id)` | Decision or null | The latest decision |
| `whyNot(id, action)` | string | Why they aren't doing it |
| `describe(id)` | string | A readable account |
| `hash()` | string | A hash of the whole state |
| `takeItem(person, item, n)` | void | **Engine.** Takes goods (own first, then pantry) |

### Events

| Method | Returns | |
|---|---|---|
| `on(kind, fn)` | function | Listens; returns a function that stops listening. `'*'` hears everything as `{ kind, ...payload, event }` |
| `off(kind, fn)` | void | Stops listening |
| `emit(kind, data)` | void | Emits an event (silent while replaying). For modules |

With `'*'`, `event` is always the event's name. `kind` is the event's name too, except for payloads with a `kind` of their own (`witnessed`, `report` and `broke`), where it's the payload's, as it always was:

```js
world.on('*', (e) => { if (e.event === 'report') showToast(`${e.actor} reported for ${e.kind}`); });
```

### Saving

| Method | Returns | |
|---|---|---|
| `save(withHistory = false)` | SaveData | `{ tyrell: 'world', v, s, history? }`, plain JSON (a deep copy) |
| `load(data)` | void | Loads a SaveData or its JSON string, migrating older versions; throws on a newer version |

### Randomness and inputs

| Method | Returns | |
|---|---|---|
| `stream(person)` | Stream | The person's next stream (advances their counter) |
| `worldStream(name)` | Stream | The world's next stream (advances its counter) |
| `worldStreamPeek(...parts)` | Stream | A stream that changes nothing |
| `peek(fn)` | fn's result | Runs `fn` as a look: `chance:` conditions inside draw from a stream that changes nothing |
| `input(name, args)` | value | Applies and records an input; returns the handler's result (or `undefined` when deferred inside a listener) |
| `internally(fn)` | fn's result | Runs engine-driven code: inputs inside it are applied, not recorded |
| `ctx(person?, extra?)` | Ctx | A context for conditions |
| `log(kind, who?, data?)` | void | Writes a log entry. From the game it's an **input** (`log`), recorded for time walk; inside the simulation (modules, effects, input handlers) it writes at once |
| `flushDeferred`, `replay`, `nextSeq` | | **Engine** internals |

## Events

Events are emitted to listeners registered with `world.on`. None are emitted while Esper replays history.

| Event | Payload | Emitted |
|---|---|---|
| `embody` | Body | Someone comes into view |
| `disembody` | `{ id }` | Someone leaves view (also every near body before a backward seek or a load) |
| `step` | Body | A near person starts something |
| `arrive` | `{ id, place }` | Anyone arrives anywhere |
| `failed` | `{ id, why }` | Anyone's action or walk failed |
| `decided` | `{ who, picked, place }` | Anyone decided (`picked` is the option's id, or `null`) |
| `log` | LogEntry | Every log entry |
| `timer` | `{ name, data, t }` | A game timer fired |
| `timer:<name>` | `{ name, data, t }` | The same, by name |
| `seek` | `{ from, to }` | After a backward seek, before the new bodies are embodied |
| `branch` | `{ t, dropped }` | A new input in the past dropped the recorded future |
| `esper:start` | `{ t }` | Playing backward reached the start of history (speed set to 0) |
| `back` | `{ id, summary }` | Someone came back from being away |
| `gone` | `{ id, why }` | Someone left for good |
| `felt` | `{ id, feeling, label, emotion }` | Reverie: a feeling |
| `broke` | `{ id, kind, level, label }` | Reverie: a breakdown |
| `changed` | `{ id, memory, shifts }` | Reverie: a core memory changed someone |
| `witnessed` | `{ id, actor, kind, recognized }` | Wormtongue: someone saw something |
| `report` | `{ t, witness, actor, kind, what?, to?, heat }` | Wormtongue: a crime was reported |
| `silenced` | `{ witness, actor, how, ok }` | Wormtongue: a payoff or a threat |
| `told` | `{ from, to, key, v, lie }` | Wormtongue: gossip |
| `exposed` | `{ about, key }` | Wormtongue: a secret reached four people |
| `say` | Said | Cityspeak: a line said with `say` |
| `bark` | `{ a, b, lines }` | Cityspeak: an exchange near the player |
| `social` | `{ act, from, to, ok }` | Cityspeak: a social act resolved |
| `planned` | `{ id, task, ok, why? }` | Mentat: a plan completed or was given up |
| `director` | `{ id, place, label }` | Gaff: a storylet fired |
| `rent-missed` | `{ id, amount }` | Ceres |
| `paired` | `{ a, b }` | Cradle |
| `born` | `{ id, parents }` | Cradle |
| `stage` | `{ id, from, to }` | Cradle: a new life stage |

Listeners run synchronously, in the middle of the engine's work. Inputs they make are deferred until the engine finishes what it's handling (see [Concepts](concepts.md#inputs-and-determinism)). Calls that move time or replace the state (`tick`, `advance`, `advanceTo`, `seek`, `rewind`, `load`, `esper.seekMark`) wait until the call that's running returns, then run in order. Don't throw from a listener: an exception propagates out of the call that moved time.

## Inputs by name

The names Esper records, for tools that read a history. Each is made by the method shown.

| Input | Made by |
|---|---|
| `person` | `world.person` |
| `fact`, `sense`, `did`, `report`, `direct`, `reward`, `setVar`, `give`, `away`, `follow`, `remove`, `keep`, `at` | The `world` method of the same name |
| `promote` | `strangers.promote` |
| `log` | `world.log`, called from the game |
| `feel`, `believe`, `remember`, `forget`, `recollect` (`recall`), `hush` (`silence`) | Reverie |
| `regard` (`adjust`), `attraction` (`attract`), `sentiment`, `standing` (`changeStanding`), `join`, `partners` (`setPartner`) | Fellowship |
| `silence`, `secret`, `owe`, `heat` (`addHeat`) | Wormtongue |
| `say`, `social` (`resolve`) | Cityspeak |
| `trigger`, `bump`, `draw` | Gaff |
| `pay`, `rent`, `income`, `stock` (`restock`) | Ceres |
| `birth`, `pair`, `depart` | Cradle |

`person`, `promote`, `say`, `birth`, `recollect`, `social` and `draw` apply at once even inside a listener, because they return a value.

## Types

### Body

A person as the game should show them now. See [Integration: bodies](integration.md#body-fields).

```ts
interface Body {
  id: string; name: string;
  place: string | null;       // null while walking
  slot?: string;
  action: string;             // the action id, 'travel', or 'wait'
  next?: string;              // while walking: the action they're walking to do
  pose: string;               // the action's pose, 'walk', or 'idle'
  target?: string;
  progress: number;           // 0..1 when the body was made
  start: number; end: number;
  travel?: { from: string | null; to: string | null; start: number; end: number; f: number };
  emotion?: string; mood?: number;   // Reverie
  with?: string;              // the routine entry's `with`
  data?: Record<string, unknown>;    // PersonDef.data
}
```

### Doing

What someone is doing (`person.doing`).

```ts
interface Doing {
  kind: 'act' | 'travel' | 'wait';
  action: string;             // for travel: the action they're traveling to do
  place: string | null; slot?: string; target?: string;
  start: number; end: number;
  from?: string | null; to?: string | null;   // travel only
  rank: number;
  layer: string;              // 'story', 'job', 'routine', 'need', 'plan', 'break', 'follow', 'idle'
  task?: string;              // the plan's task
  seq: number;                // the event that ends it
  until?: number;             // when the routine entry, shift or directive that chose it ends
  fill?: boolean;             // travel only: the action at the end keeps its own length
  minutes?: number;           // travel only: how long the action at the end takes (a plan step's minutes)
}
```

### PersonDef

What the game declares about a person. Plain JSON: it's saved with them.

| Field | Meaning |
|---|---|
| `name` | Their name (default: the id) |
| `traits` | Personality, 0..1 each: `thrift`, `honesty`, `talkative`, `courage`, `greed`, `lawful`... (read as `trait.<name>`, 0.5 if unset) |
| `values` | Values held, 0..1 each: `honesty`, `family`, `law`... (read as `value.<name>`, 0 if unset) |
| `home` | Their home's place id |
| `job` | A [JobDef](deciding.md#jobs-and-shifts): `{ id, place, action, shifts, days?, wage? }` |
| `routine` | A plan of [entries](deciding.md#routines), or a list of variants `{ days?, when?, plan }` |
| `groups` | Group ids (Fellowship) |
| `tags` | Free tags (`is:<tag>`; Cityspeak's `'tag:<tag>'` lines) |
| `needs` | Starting need levels |
| `vars` | Starting variables (`money` defaults to 0) |
| `inv` | Starting goods |
| `place` | Where they start (default: home) |
| `born` | Born at this time in minutes (Cradle) |
| `data` | Anything the game wants: a look, a sprite id (on every body) |

### PersonState

A person in the state (`world.get(id)`):

| Field | Meaning |
|---|---|
| `id`, `name` | |
| `def` | Their PersonDef (a copy, saved with them; Reverie's core memories can change `def.traits`) |
| `status` | `'active'`, `'away'` or `'gone'` |
| `needs` | By need: `{ v, t }` (the level stored at time `t`; read levels with `world.needOf`) |
| `vars` | Variables |
| `inv` | Goods |
| `place` | Where they are (`null` while walking or away) |
| `slot` | The slot they hold |
| `doing` | A Doing, or `null` |
| `habits` | By action: `[fast, slow]` |
| `cool` | By action: when its cooldown ends; and by `'@fail:<action>@<place>'`, when the back-off after a failure there ends |
| `fails` | `[time, count]`: failures at the latest moment they failed (the loop guard) |
| `last`, `lastEnd` | The last action and when it ended |
| `n` | Draws taken from their stream |
| `plan`, `suspended` | Mentat's plan and plans set aside |
| `directive` | The current Directive, or `null` |
| `away` | While away: `{ until, summary?, place? }` |
| `follow` | Who they follow |
| `born` | Born at (Cradle) |

### Other definitions

| Type | Fields | See |
|---|---|---|
| `NeedDef` | `id, rise, start?, curve?, urgent?, label?, emotion?` | [Deciding](deciding.md#needs) |
| `ActionDef` | every field | [Deciding](deciding.md#actions) |
| `TaskDef`, `MethodDef`, `Step` | | [Mentat](modules/mentat.md) |
| `PlaceDef`, `SlotDef` | | [Places](places.md) |
| `RoutineEntry` | `[hour, place, activity, { with?, rank? }?]` | [Deciding](deciding.md#routines) |
| `RoutineVariant` | `{ days?, when?, plan }` | [Deciding](deciding.md#routines) |
| `JobDef` | `{ id, place, action, shifts, days?, wage? }` | [Deciding](deciding.md#jobs-and-shifts) |
| `Directive` | `{ do, at?, target?, until?, rank?, repeat?, label?, done? }` | [Deciding](deciding.md#directives) |
| `DeedDef` | `{ feeling?, witnessFeeling?, memory?, regard?, sentiment?, fame?, infamy?, crime? }` | [Integration](integration.md#sensing-and-deeds) |
| `Stimulus` | `{ kind, actor, what?, place?, seenBy?, strength?, disguise?, data? }` | [Integration](integration.md#sensing-and-deeds) |
| `Consideration` | `{ name?, input, range?, curve?, out? }` | [Deciding](deciding.md#considerations-and-curves) |
| `Curve` | a curve name, `[[x, y], ...]`, or `(x) => y` | [Deciding](deciding.md#considerations-and-curves) |
| `Cond`, `Effect` | a string, or a function of `Ctx` | [Conditions](conditions.md) |
| `Ctx` | `{ world, person?, place?, target?, action?, topic?, data? }` | [Conditions](conditions.md#functions) |
| `Value` | `string | number | boolean | null` | |
| `Shell` | `{ travel?, near?, check? }` | [Integration](integration.md#the-shell) |

### Decisions

```ts
interface Candidate {
  id: string; kind: 'action' | 'task';
  place: string | null; target?: string;
  rank: number; weight: number; layer: string;
  parts: Array<[string, number]>;   // what the weight is made of; the base first
  blocked?: string;                 // why it was ruled out
  slot?: string; until?: number;
  fill?: boolean;                   // false: keeps its own length ('*' choices)
  minutes?: number;                 // a plan step's own length, in place of the action's
}
interface Decision { t: number; who: string; picked: Candidate | null; candidates: Candidate[]; reason: string }
```

### State

```ts
interface WorldState {
  v: number;                        // schema version
  seed: string; now: number; seq: number;
  people: Record<string, PersonState>;
  places: Record<string, { claims: Record<string, string[]>; stock?: Record<string, number> }>;
  facts: Record<string, Value>;
  q: QueueItem[];                   // the event queue (a heap)
  log: LogEntry[];
  mod: Record<string, any>;         // module state by name ('@strangers': promotions)
  game: Record<string, unknown>;    // world.keep
  n: number;                        // the world's stream counter
  ids: number;                      // ids handed out (promoted strangers)
}
interface QueueItem { t: number; seq: number; k: 'end' | 'think' | 'hour' | 'timer' | 'module' | 'back'; who?: string; ref?: number | string; data?: object }
interface LogEntry { t: number; k: string; who?: string; d?: Record<string, unknown> }
interface SaveData { tyrell: string; v: number; s: WorldState; history?: unknown }
```

## Writing a module

A module is an object with a `name`, an `attach` function and any of the hooks below. Pass your own in `create({ extra: [...] })`; they run after the built-in ones.

```js
// A curfew: while it's on, people can't go out to the main street after 22:00, unless they're in the Watch.
const curfew = {
  name: 'curfew',
  attach(w) {
    this.w = w;
    w.lang.term('curfew', () => !!w.s.mod.curfew.on);
    w.defineInput('curfew', (on) => { w.s.mod.curfew.on = on; w.log('curfew', undefined, { on }); });
  },
  init() { return { on: false }; },
  block(p, c) {
    const w = this.w;
    if (!w.s.mod.curfew.on || !c.place || w.hour < 22 || p.def.groups?.includes('watch')) return null;
    return w.ring.region(c.place) === 'main' ? 'curfew' : null;
  },
};

const world = Tyrell.create({ seed: 'town', extra: [curfew] });
// ... declare the town ...
world.input('curfew', [true]);
world.module('curfew');   // the module
```

| Hook | Called | Use it to |
|---|---|---|
| `attach(world)` | Once, at creation | Keep the world; register terms, effects and inputs |
| `init()` | At creation, and on load if the save has no state for the module | Return the module's fresh state (plain JSON), kept in `world.s.mod[name]` |
| `loaded()` | After a save is loaded | Fix up anything derived from the state |
| `candidates(p, out)` | While someone decides | Push extra options (`Candidate`s); unweighed ones (no `parts`) are weighed as required |
| `consider(p, c)` | For every option weighed | Return `[name, factor]` pairs to multiply into the weight |
| `block(p, c)` | For every option | Return a reason to rule it out, or `null` |
| `started(p, doing)` | Someone starts a walk or an action | React (pay, witness) |
| `ended(p, doing, frac, interrupted)` | An action ends or stops (`frac` is how much was done), or a walk or wait is interrupted | React (wages, feelings) |
| `arrived(p, place)` | Someone arrives | |
| `met(a, b, place, minutes)` | Two people spend time together | Relationships, gossip |
| `hour(t)` | Every game hour, on the hour | Upkeep |
| `day(day)` | Every midnight | Daily upkeep |
| `timer(item)` | A queue item addressed to the module comes due | Delayed work |
| `sensed(stimulus)` | The game reported a stimulus | |
| `did(actor, verb, data)` | A deed | |
| `added(p)` | Someone joins the world | |
| `removed(p, why)` | Someone leaves for good | |
| `failed(p, why)` | Someone's action failed (called, though not in the `Module` type) | |

Rules for a module:

- **State** lives in `world.s.mod[name]`, plain JSON only. Definitions live on the module object.
- **Hooks run inside the simulation**: change state directly there. Public methods the game calls should go through inputs (`w.defineInput` in `attach`, and `w.input(...)` in the method), like the built-in modules' `feel` and `applyFeel`.
- **Timers**: `w.clock.schedule({ t, k: 'module', ref: name, who?, data? })` queues an item; at time `t` the module's `timer(item)` is called. Queue items are state, so they save and rewind.
- **Randomness**: `w.stream(person)` or `w.worldStream(name)`. Never `Math.random` or the wall clock.
- **Events**: `w.emit(kind, payload)` (silent during replays) and `w.log(kind, who, data)`.
- **Stable order**: iterate in a stable order (object keys in insertion order, sorted lists), so the same seed gives the same world.
