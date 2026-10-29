# Tyrell

*More human than human.*

Tyrell is a minds engine for games full of people. It decides what each person does, remembers what happened to them, keeps track of what they believe and how they feel about each other and about the player, and keeps them living when nobody is watching. It can also run the world faster, or backward: time walk is built into the core.

It knows about needs, places, time and other people, and nothing about tiles, side views, sprites or maps. Each game writes a thin adapter (a *shell*) that says what places exist, how long it takes to get between them and what people can do there, and draws whatever Tyrell decides.

Tyrell is written in TypeScript and ships as plain JavaScript with no dependencies: one `<script>` tag defines one global, `Tyrell`.

```js
const world = Tyrell.create({ seed: 'my-town', start: 8 * 60 });

world.need({ id: 'hunger', rise: 0.07 });                       // per game hour, 0 calm to 1 desperate
world.place({ id: 'cafe', tags: ['food'], hours: [7, 22], slots: { seat: 6 } });
world.place({ id: 'apartment', tags: ['home'] });
world.link('apartment', 'cafe', 10);                                  // ten minutes' walk
world.action({ id: 'eat', at: 'tag:food', slot: 'seat', minutes: 30, relieves: { hunger: 0.6 }, pose: 'sit' });

world.person('ana', { home: 'apartment', routine: [[7, null, '*'], [23, 'home', 'sleep']] });

world.focus(['downtown']);                 // the regions the game has loaded
world.on('embody', (body) => spawnSprite(body));
world.on('step', (body) => moveSprite(body));
world.tick(1 / 60);                        // every frame
```

## What's in it

| Part | Named for | What it does |
|---|---|---|
| **Bicameral** (core) | Westworld's bicameral mind | Needs, the layered priorities (story, job, routine, needs), considerations, the pick, habits that learn, instincts, pastimes that pall, wishes and dreams; skills that grow with practice |
| **Ring** (core) | The Expanse's Ring | Places, travel times, opening hours, slots with a capacity, what each place offers |
| **Entmoot** (core) | The Ents' council | The clock: an event queue that jumps between action ends; near and far; handing bodies to the game |
| **Esper** (core) | Blade Runner's photo machine | Time walk: run faster, rewind, play backward, branch, bookmark |
| **Reverie** | Westworld's reveries | Feelings, mood and emotion, breaking points, stress, memories that change people, beliefs that can be wrong, a file on the player |
| **Fellowship** | The Fellowship of the Ring | Regard, attraction, sentiments, compatibility, groups and households, standing (fame and infamy) |
| **Wormtongue** | Théoden's whisperer | Witnesses, reports and heat, gossip, lies, silencing, secrets, favors |
| **Cityspeak** | Blade Runner's street language | Lines chosen by the most specific rule, barks, practices with roles, social acts, an ink bridge |
| **Mentat** | Dune's human computers | Planning: HTN tasks with methods, `get:` searches (GOAP) for getting hold of things, replanning |
| **Gaff** | Blade Runner's origami watcher | The director: storylets, mean time between events, intensity phases, decks, unseen places |
| **Ceres** | The Expanse's trading station | Money, prices, stock, wages, rent, incomes, household purses and pantries, production chains and a daily report |
| **Cradle** | Westworld's Cradle | Ages and stages, couples, births with inherited traits, departures, grief and inheritance |
| **Joi** | Blade Runner 2049's companion | An optional language-model voice that never changes the world |
| **Athelas** | The kingsfoil of the Houses of Healing | Conditions that run a course: phases that change needs and choices, contagion, immunity |
| **Delos** | Westworld's Delos, which kept a copy of everyone | Genomes: genes with dominance, blended traits, talents and instincts, mutations, inherited through Cradle |
| **Voice** | The Voice of Dune | Branching conversations: threads of beats, answers whose approaches land by the listener's nature, things learned (and recalled, and familiarity as trust), promises kept or broken |
| **Bree** | The village of the Prancing Pony | Interactions between people: chats, jokes, flirts, apologies, arguments and fights that come out by degrees, conversations over turns on topics in each one's manner, escalation, grudges, feuds, avoidance and making up |
| **Morgul** | The Morgul-blade, whose wound won't heal | Harm between people: wounds that heal or fester, hurt, down and (only if the game says) dead, pain, fear, grudges and revenge, witnesses and crimes, traps, poison that works unnoticed, suspicion that can be wrong, fights by numbers |
| **Palantír** (tool) | The seeing-stones | The inspector: every choice with its scores, "why not that?", a readable account |
| **Westmarch** (tool) | The Red Book of Westmarch | The log of what happened, and chronicles of anyone's day |
| **Irulan** (tool) | Princess Irulan, Muad'Dib's historian | The narrator: the log told as a story, the routine left out, its storylines and headlines, in parts a game can style |
| **Voight-Kampff** (tool) | Blade Runner's test | Headless seeded runs that check people still behave like people |
| **Rocinante** (example) | The Expanse's ship | A sample town of ten people that exercises everything |

## Using it in a game

Tyrell lives in the Tycho repository, which a game pulls in as a git submodule. The built files in Tycho's `dist/` are committed, so the game needs no build step and nothing installed:

```sh
git submodule add https://github.com/doctorallen/tycho vendor/tycho
```

```html
<script src="vendor/tycho/dist/tyrell.js"></script>
```

If the game deploys from CI, its checkout needs `submodules: true`. A service worker that caches the game's files should list `vendor/tycho/dist/tyrell.js` too. To update, `git -C vendor/tycho pull` and commit the new pointer: each game pins the engine version it was tested with.

Node and bundlers can use `dist/tyrell.mjs` or `dist/tyrell.cjs`; types are in `dist/tyrell.d.ts` (and `dist/tyrell.global.d.ts` for the global). A game with people on screen can load Tycho's bridge too (`dist/tycho-minds.js`, see the Tycho README); a game without people loads neither.

## Documentation

Start with [docs/README.md](docs/README.md). The guides walk through integrating a game; the reference covers every call. [docs/tuning.md](docs/tuning.md) lists every setting, and the headline knobs that tune a whole behavior (how fast friendships form, how often breaks come, how readily gossip spreads), for everyone, for one person, or during play.

## Building and testing

From the root of the Tycho repository, which builds Tyrell with the engine and the bridge:

```sh
npm install            # TypeScript and esbuild, for building only
npm run build          # src/ -> dist/ (commit dist/ with the change)
npm run test:tyrell    # builds, then runs Tyrell's test suite
npm run typecheck
npm run vk             # Voight-Kampff: a week of Rocinante
```
