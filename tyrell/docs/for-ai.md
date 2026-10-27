# Tyrell for AI agents

You've been asked to integrate Tyrell into a game. This page is the compact, exact version: invariants, a procedure, the contracts of every callback, a skeleton that runs, and the pitfalls with their fixes. For details, follow the links into [api.md](api.md), [integration.md](integration.md), [conditions.md](conditions.md) and the module pages for the modules the game uses.

This describes Tyrell 1.0.0 (save schema 1).

- [Facts](#facts)
- [Invariants](#invariants)
- [Procedure](#procedure)
- [Skeleton](#skeleton)
- [Contracts](#contracts)
- [Pitfalls](#pitfalls)
- [Verify](#verify)

## Facts

- Browser: `<script src="vendor/tyrell/dist/tyrell.js">` before the game's scripts defines the global `Tyrell`. Node: `require('./vendor/tyrell/dist/tyrell.cjs')` or import `dist/tyrell.mjs`. Add `vendor/tyrell/dist/tyrell.js` to a service worker's cached files.
- `const world = Tyrell.create(opts)`. Everything else is a method or property of `world`.
- Time is game minutes. `world.now` is minutes since midnight of day 0. Hours in definitions are fractional 0 to 24; spans `[a, b)` wrap past midnight.
- Needs are 0 (calm) to 1 (desperate); `rise` is per game hour.
- Ranks: break 4 > story 3 > desperate need 2.5 to 2.8 > job 2 > urgent need 1.5 > routine 1 > free choice 0. Only the top rank is considered; weight decides within it.
- Places are ids; regions are what the game loads at once; travel is minutes (links or `shell.travel`). No coordinates anywhere.
- The engine talks to the game only through events (`world.on`) and the three optional shell callbacks.

## Invariants

1. **Determinism.** The same seed and the same inputs give the same `world.hash()`. Never use `Math.random`, `Date.now` or `performance.now` in anything the engine calls (conditions, effects, considerations, terms, storylets' `when` and `fire`, Cradle's `namer` and `template`, metrics, custom module hooks). Use `world.stream(person)`, `world.worldStream(name)` or `ctx.world.worldStreamPeek(...)`.
2. **State is the engine's.** All state is plain JSON in `world.s`. Game code never writes to it, to a `PersonState`, or to module state, and never calls engine-side methods (`world.mind.setLevel`, `world.lang.apply`, `world.log`, `reverie.applyX`/`recall`/`note`/`silence`, `fellowship.rel`/`applyX`, `cityspeak.resolve`, `ceres.transfer`, `gaff.draw`/`unseenPlace`, `world.ring.claim`/`release`). Every change from the game is an input: a public API mutator (list below) or a custom input (`world.defineInput` + `world.input`).
3. **Definitions every start.** Needs, places, links, actions, tasks, deeds, module content, custom terms, effects and inputs, listeners, the shell and config are not saved. Declare them on every start, identically, before or after `world.load`.
4. **People are state.** `world.person(id, def)` adds a person or returns the existing (saved) one, ignoring `def`. Their `PersonDef` (routine, job, traits...) is saved with them.
5. **Constant definitions.** Don't change definitions or decision config during a run; Esper replays with whatever is current. `config.minutesPerSecond` and `config.budgetMs` are safe to change.
6. **Stable order.** Custom module code iterates in a stable order.

Public input methods (safe from game code): `world.person`, `fact(key, value)`, `sense`, `did`, `report`, `direct`, `reward`, `setVar`, `give`, `away`, `follow`, `remove`, `keep`, `at`, `strangers.promote`; `reverie.feel`, `believe`, `remember`, `forget`; `fellowship.adjust`, `sentiment`, `changeStanding`, `join`, `setPartner`; `wormtongue.silence`, `secret`, `owe`, `addHeat`; `cityspeak.say`; `gaff.trigger`, `bump`; `ceres.pay`, `rent`, `income`, `restock`; `cradle.birth`, `pair`, `depart`.

## Procedure

1. **Decide who owns the clock.** If the game has its own clock (a day length, sleep that jumps time), call `world.advanceTo(gameMinutes)` every frame. Otherwise call `world.tick(dtSeconds)` and read `world.hour`.
2. **Create the world**: `Tyrell.create({ seed, start, modules, shell, config, esper, moduleConfig })`. Pick only the modules the game uses. Lower `config.logSize` (300) and size `esper` to what the game needs; `esper: { on: false }` if it never rewinds.
3. **Declare needs.** Vital needs (hunger, energy) with `urgent` at most 1 (default 0.85); soft needs (fun, company, hygiene) with `urgent: 1.1` so they never break a routine.
4. **Declare places**, each with a `region` (one per loaded level; omit for a single map), tags, `hours`, `slots`, `owner`, and the game's coordinates in `data`. Then travel: `world.link(a, b, minutes)` between outermost places (links on nested places are ignored; nested places are reached for free), or `shell.travel` from the game's pathfinder (cached, in minutes matching walking speed).
5. **Declare actions** (and tasks). Free-choice actions need `relieves` or `base`. Work actions get `job` and `rank: -1`. Sleep gets a night consideration and `rates`. Give actions `label` and `pose`.
6. **Declare module content**: deeds, groups, crimes, feelings, lines, storylets, goods.
7. **Add people** with `world.person(id, def)`: home, routine (entries covering the whole day), job, traits, values, money, groups, `data` for the sprite.
8. **One-time setup inputs** (starting money in purses, incomes, rent, partners, secrets) guarded with `if (!world.kept('setup')) { ...; world.keep('setup', true); }`.
9. **Load** a save if there is one: `world.load(saved)`.
10. **Wire bodies**: `world.focus([level])` on start and on every level change (or `shell.near`); listeners for `embody`, `step`, `disembody`; position walkers from `travel.start`/`travel.end` and `world.now`; refresh a body from `world.body(id)` when `world.now >= body.end`.
11. **Wire reports from the game**: `world.sense({ kind, actor: 'player', what, place, seenBy })` with `seenBy` from the game's geometry; `world.did('player', verb, { for: id, what })`; `world.report(id, 'failed', why)` when a body truly can't proceed (the action is then ruled out at that place for `config.backoff` minutes; if the obstacle lasts, change something, such as a `closed:<id>` fact, so it isn't tried again later).
12. **Wire talk**: `world.cityspeak.choose` / `say`, the `bark` event; Joi only if asked for.
13. **Save** with `world.save()` inside the game's save; restore with `world.load`. Keep game state that must rewind with `world.keep`.
14. **Test**: run `Tyrell.VoightKampff.run({ build: (seed) => buildWorld(seed), days: 7 })` and require `passed` (in CI too).

## Skeleton

A complete, runnable sketch of steps 1 to 13, with stand-ins for the game's side. It runs as is in Node.

```js
const Tyrell = require('./vendor/tyrell/dist/tyrell.cjs');   // the browser: the global Tyrell

// ---- the game's side: stand-ins -----------------------------------------------
const game = { minutes: 6 * 60, level: 'cafe', save: null };
const DOORS = { flat: 40, cafe: 300, street: 150 };   // each place's door, x on the street
const WALK = 4;                                       // px per game minute
const routeMinutes = (a, b) => Math.abs(DOORS[a] - DOORS[b]) / WALK;
const sprites = new Map();

// ---- 1-2. create -----------------------------------------------------------------
const travelCache = new Map();
const world = Tyrell.create({
  seed: 'my-game',
  start: game.minutes,
  modules: ['reverie', 'fellowship', 'wormtongue', 'cityspeak', 'mentat', 'ceres'],
  shell: {
    travel(a, b) {                                    // pure, cached, minutes matching walking speed
      const k = a + '>' + b;
      if (!travelCache.has(k)) travelCache.set(k, routeMinutes(a, b));
      return travelCache.get(k);
    },
  },
  config: { logSize: 300 },
});

// ---- 3. needs ------------------------------------------------------------------------
world.need({ id: 'hunger', rise: 0.06, start: 0.3 });
world.need({ id: 'energy', rise: 0.05, start: 0.2 });
world.need({ id: 'company', rise: 0.04, urgent: 1.1 });

// ---- 4. places and regions -----------------------------------------------------------
world.place({ id: 'street', region: 'street' });
world.place({ id: 'flat', region: 'flat', tags: ['home'], slots: { bed: 2 } });
world.place({ id: 'cafe', region: 'cafe', tags: ['food', 'social'], hours: [7, 22], slots: { seat: 6 }, owner: 'mo',
  data: { spots: { seat: [20, 40, 60, 80, 100, 120] } } });

// ---- 5. actions ------------------------------------------------------------------------
const night = { name: 'night', input: 'hour', range: [0, 24], curve: [[0, 1], [6 / 24, 1], [8 / 24, 0.05], [21 / 24, 0.3], [23 / 24, 1], [1, 1]] };
world.action({ id: 'sleep', at: 'home', slot: 'bed', minutes: [420, 480], relieves: { energy: 0.95 }, rates: { hunger: 0.4 }, tags: ['sleep'], pose: 'sleep', considerations: [night] });
world.action({ id: 'eat', label: 'eating', at: 'tag:food', slot: 'seat', minutes: 30, relieves: { hunger: 0.6, company: 0.2 }, price: 5, pose: 'sit', tags: ['social'] });
world.action({ id: 'serve', at: 'cafe', minutes: 60, job: 'cook', rank: -1, pose: 'work' });
world.action({ id: 'loaf', at: 'home', minutes: 45, base: 0.03, pose: 'sit' });

// ---- 6. module content -----------------------------------------------------------------
world.deed('helped', { feeling: 'helped', regard: 0.15, memory: 5 });
world.wormtongue.crime({ kind: 'theft', severity: 0.4 });
world.cityspeak.line({ key: 'hello', topic: 'greet', text: 'Hello.' });

// ---- 7. people ---------------------------------------------------------------------------
world.person('mo', { name: 'Mo', home: 'flat', vars: { money: 40 },
  job: { id: 'cook', place: 'cafe', action: 'serve', shifts: [[7, 15]] },
  routine: [[6, null, '*'], [22, 'home', 'sleep']] });
world.person('ana', { name: 'Ana', home: 'flat', vars: { money: 30 }, routine: [[7, null, '*'], [23, 'home', 'sleep']] });

// ---- 8. one-time setup, guarded --------------------------------------------------------------
if (!world.kept('setup')) { world.ceres.income('ana', 50, 7); world.keep('setup', true); }

// ---- 9. load -------------------------------------------------------------------------------------
if (game.save) world.load(game.save);

// ---- 10. bodies --------------------------------------------------------------------------------
world.on('embody', (b) => sprites.set(b.id, { body: b }));
world.on('step', (b) => { const s = sprites.get(b.id); if (s) s.body = b; });
world.on('disembody', ({ id }) => sprites.delete(id));
world.focus([game.level]);

function frame(dtSeconds) {
  game.minutes += dtSeconds * 2;                      // the game's clock: 2 game minutes a real second
  world.advanceTo(game.minutes);                      // or, if Tyrell owns the clock: world.tick(dtSeconds)
  for (const [id, s] of sprites) if (world.now >= s.body.end) s.body = world.body(id) ?? s.body;
}

// ---- 11. what the game saw ---------------------------------------------------------------------
const playerHelped = (id) => world.did('player', 'helped', { for: id });
const playerStole = (place, seenBy) => world.sense({ kind: 'theft', actor: 'player', place, seenBy });

// ---- 13. saving ------------------------------------------------------------------------------------
const saveGame = () => { game.save = JSON.stringify(world.save()); };

for (let i = 0; i < 60 * 60 * 3; i++) frame(1 / 60);   // three real minutes: six game hours
playerHelped('ana');
saveGame();
console.log(world.describe('mo'));
```

## Contracts

**`Tyrell.create(opts)`**: `{ seed?, start?, modules?, shell?, config?, esper?, moduleConfig?, extra? }`. Unknown module names throw. Defaults: [api.md](api.md#options).

**`shell.travel(from, to, person?) => number`**: minutes. `0` when no walk is needed, `Infinity` when unreachable. Deterministic and pure given Tyrell's state (it may read facts, not game state that doesn't rewind). Called for any two different place ids (including a place and one nested inside it), very often, and during replays; not cached by Tyrell. Must agree with how fast sprites walk.

**`shell.near(body, world) => boolean`**: whether the person gets a body. Called for every active person on every refresh (each tick). May read the game's view (it never affects the simulation). With it, `focus()` no longer decides who's near.

**`shell.check(fact, ctx) => Value | undefined`**: answers `fact:<key>` when the fact isn't set. Live, not rewound: prefer pushing `world.fact(key, value)`.

**Listeners** (`world.on(kind, fn)`, returns an unsubscribe function): run synchronously inside the engine's work. Inputs made inside are deferred to the end of the current event or input (and recorded there); `world.input` returns `undefined` for them. `world.person`, `strangers.promote`, `cityspeak.say` and `cradle.birth` apply at once. `tick`, `advance`, `advanceTo`, `seek`, `rewind`, `esper.seekMark` and `load` called from a listener wait until the call that's running returns, then run in order. Don't throw. Event list: [api.md](api.md#events).

**Bodies**: `{ id, name, place, slot?, action, next?, pose, target?, progress, start, end, travel?: { from, to, start, end, f }, emotion?, mood?, with?, data? }`. `place` is `null` while walking. `action` is `'travel'` while walking and `'wait'` while idle. `progress` and `travel.f` are as of when the body was made: recompute from `world.now`.

**`world.report(id, 'failed' | 'done', reason?)`**: `'failed'` stops the walk (ending at `to` past halfway, else `from`) or action (partial relief), emits `failed`, rules the action out at that place for `config.backoff` (15) minutes, replans a plan, and makes them think. More than ten failures for one person at one moment make them wait `config.idle` minutes instead, so a listener that fails every `step` can't loop. `'done'` ends it now with full effect. Both inputs.

**Custom input**: `world.defineInput(name, (...args) => result)`, defined on every start before loading or seeking. Call with `world.input(name, argsArray)`. Arguments plain JSON. The handler may change state directly.

**Custom term**: `world.term(name, (ctx, arg) => Value | undefined)`: pure and deterministic. `arg` is the text after the first `.` or `:`.

**Custom effect**: `world.effect(name, (ctx, arg, op, value) => void)`: runs inside the simulation; may change state directly; deterministic. `op` is `'='`, `'+='`, `'-='`, `'*='` or `''`.

**Function conditions, effects, consideration inputs**: `(ctx) => boolean`, `(ctx) => void`, `(ctx) => number`, with `ctx = { world, person?, place?, target?, action?, topic?, data? }`. Not allowed in routines (saved data): strings only there.

**Storylet** `fire(world, { place, subject, id })`: runs inside `world.internally()` (its inputs aren't recorded; a replay runs it again). Deterministic; use the public API.

**Cradle** `namer(r, parents) => string`, `template(r, parents) => PersonDef`: deterministic, using the stream `r`.

**Joi provider** `(req) => Promise<string | { text, flags? }>`: `req = { prompt, system, who, to?, line }`. Times out after 2500 ms by default and falls back to the written line.

**Module** (custom, via `create({ extra })`): `{ name, attach(w), init?(), loaded?(), candidates?, consider?, block?, started?, ended?, arrived?, met?, hour?, day?, timer?, sensed?, did?, added?, removed?, failed? }`. State in `w.s.mod[name]` from `init()`. See [api.md](api.md#writing-a-module).

## Pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| A routine with one entry, or a gap you meant as "until noon" | The entry lasts all day: each entry runs until the next one, and the last until the first entry of the next day | Write the whole day: `[[7, null, '*'], [12, 'cafe', 'eat'], [13, null, '*'], [23, 'home', 'sleep']]` |
| `'*'` with a place vs with `null` | `[h, null, '*']` is free time; `[h, 'home', '*']` requires "anything offered at home", which includes actions with no `at` and `rank: -1` actions (a sulk, a bender), at near-even odds | Use `null` for free time. With a place, keep "only when required" actions out of it (`who`/`if`), or name a specific activity |
| `urgent` left at the default for soft needs | Fun or company pulls people off their routine | `urgent: 1.1` for needs that should never break a routine |
| `urgent` above 1 for vital needs | Hunger never breaks a routine or a shift, so people with full days go hungry (and Voight-Kampff's `nobody-starves` only checks needs with `urgent <= 1`, so it won't notice) | Keep hunger and energy at the default |
| Work action without `job` | Staff are turned away when their shift starts before opening hours ("closed then") | Give work actions `job: '<job id>'` (only actions, not tasks, get in when closed) |
| Work action without `rank: -1` | Off-shift workers do it in their free time | `rank: -1`: only when required |
| An action with neither `relieves` nor `base` | Never chosen freely | Add `base`, or require it (routine, job, directive) |
| Expecting an input from a listener to apply at once | The state hasn't changed yet; `world.input` returned `undefined` | Inputs in listeners are deferred to the end of the event; react to the next event instead |
| Writing `world.s` or calling engine methods from game code | Works until a rewind or replay, then the world diverges | Use an input; for anything missing, `world.defineInput` |
| Shell travel times that don't match walking speed | Sprites arrive before or after Tyrell's timetable; near and far disagree | Return the route length divided by walking speed, or place walkers by `travel.f` |
| Reporting `'failed'` when the obstacle stays | The person tries again each time the back-off (`config.backoff`, 15 minutes) runs out, and fails again | Change something too (a `closed:<id>` fact, a fact the action's `if` reads) |
| Setup inputs (`ceres.pay`, `income`, `rent`, `setPartner`, `secret`) on every start | Repeated on top of a loaded save | Guard with `world.kept('setup')` and `world.keep('setup', true)` |
| Changing a person's routine in code | Saved people keep their saved definition | A custom input that patches `world.get(id).def`, run once per content version ([saving.md](saving.md#changing-content-under-existing-saves)) |
| `money` in conditions with a household purse | Reads 0 for household members | Use `purse` (Ceres) |
| An action that `buys` and `uses` the same good | Ruled out: `uses` is checked before buying | Price plus `relieves` for on-the-spot eating, or two actions |
| `chance:` in line conditions or inspected conditions | Looking (`choose`, barks, `whyNot`, Joi) advances a person's stream: watched and unwatched worlds differ | Use line `weight`s; keep `chance:` to actions' `if` |
| A `'*'` listener for `witnessed`, `report` or `broke` | The payload's own `kind` replaces the event name | Listen to those events by name |
| `said:<key>` in conditions | Never true: the term is keyed by the line's index | `said:<index>` (declaration order, from 0), or track it yourself with `var.` effects in the line's `then` |
| Consideration inputs `'habit'`, `'crowd'`, `'price'` | Read 0 (not terms; `price` needs a good) | A function input: `(ctx) => ctx.world.ring.crowd(ctx.place)` |
| A cooldown on a deck's trigger storylet | Ignored | Put cooldowns on the cards; give cards `mtb: Infinity` |
| The default near rule with several small levels | A walker shows in both the origin and destination levels for the whole walk | `shell.near` from the route: which level they're in at `travel.f` |
| Relying on `step` for every change | Idling (nothing to do) emits no `step` | Refresh from `world.body(id)` when `world.now >= body.end` |
| A task whose methods' conditions can all fail | `no-plan`, the person idles 20 minutes and picks it again | Give the task `if` conditions, or a last method with none |
| The game's clock going backward, or a different epoch | `advanceTo` with a past time rewinds the world (or does nothing with Esper off) | Minutes since midnight of day 0, monotonic; rebuild when going back past `esper.earliest()` |
| `world.save(true)` into `localStorage` | Quota errors: history is megabytes | Save without history; or IndexedDB; lower `logSize` and Esper's `keep` option |
| Inputs inside `seek`/`embody` handlers after a rewind | Each one branches the timeline, dropping the recorded future | Read state there; don't write |
| `world.did` data in TypeScript | `seenBy: string[]` isn't a `Value` | Cast the data object |
| A directive that's done | It stays on the person, marked `done` | `world.direct(id, null)` to clear, or use `until` |

## Verify

Run these on the game's world (a `build(seed)` function that creates and declares everything):

```js
const report = Tyrell.VoightKampff.run({ build: (seed) => buildWorld(seed), days: 7 });
console.assert(report.passed, report.failures.join('\n'));
```

The default checks cover starvation, slot capacity, sleep, people stuck idle, determinism (same seed, same hash), Esper (back six hours and forward: same hash) and save/load (same hash, and the same three hours later). Also check by hand that:

- a run with `focus` on the loaded regions and a run with nothing focused give the same `world.hash()` after the same inputs (watching changes nothing);
- `world.whyNot(id, action)` explains anything surprising before you change weights;
- `world.describe(id)` reads sensibly for a few people at a few times of day.
