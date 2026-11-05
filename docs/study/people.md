# People and histories

How a generated place can come with people who have a past: names in a language of their own, cultures read from the land, a history that explains the ruins and shrines, and days that run on a clock. Tyrell already runs the minds: needs, routines, memories, households, lineage and gossip. What it lacks is a generator to write those people before minute 0, and that is this page. The finding is that every shipped system splits into the same two halves. History is either **simulated, then summarized** (Dwarf Fortress, Talk of the Town) or **generated as events, then explained** (Caves of Qud), and for a quest-sized world the second is cheaper and reads better. Either way, what matters is that every event leaves something in the place and in someone's memory. Names work the same way: a language is a few phoneme sets, a syllable shape and a spelling (Martin O'Leary), and if each morpheme keeps its meaning, a place can be named from what is there and glossed back. Routines are data in every game that has them, from Ultima VII's eight three-hour slots to Stardew Valley's keyed variants. Tyrell's routine format already is that data, so a generator only has to write it. A 300-year history for a small island takes about 70 ms of plain JS, and a village's day is a pure function of the clock.

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact. "(search summary)" marks a claim known only from a search-result snippet, where the source itself could not be fetched. The full research is in [the note on people, names and histories](notes/people_names_histories.md).

- [What Tyrell already does](#what-tyrell-already-does)
- [Names from a naming language](#names-from-a-naming-language)
- [Place names from the land](#place-names-from-the-land)
- [Cultures from the land](#cultures-from-the-land)
- [History: simulate or explain](#history-simulate-or-explain)
- [Lineage and legacy](#lineage-and-legacy)
- [Daily routines](#daily-routines)
- [Off screen](#off-screen)
- [A quest-sized past](#a-quest-sized-past)
- [What it means for Tycho and Tyrell](#what-it-means-for-tycho-and-tyrell)
- [Sources](#sources)

## What Tyrell already does

Tyrell decides what each person does, remembers what happened to them and "keeps them living when nobody is watching" ([Tyrell](../../tyrell/README.md)). For a generator, the useful facts are what a person *is* in Tyrell, and which inputs can give them a past.

| Tyrell part | What it holds | What a generator would feed it |
|---|---|---|
| `PersonDef` ([API](../../tyrell/docs/api.md#persondef)) | `name`, `traits` and `values` (0..1 each), `home`, `job`, `routine`, `groups`, `tags`, `born`, `skills`, `talents`, `data` | A name, a culture's values, a job and a routine written from them, a birth time before minute 0 |
| Routines ([Deciding](../../tyrell/docs/deciding.md#routines)) | `[hour, place, activity]` entries, each lasting until the next; variants `{ days, when, plan }`, first match wins | The routines themselves: Tyrell runs them but does not write them |
| Ring ([Places](../../tyrell/docs/places.md)) | Places as ids with tags, hours, slots and owners; travel in minutes | The village's places, from the generated map, with owners from its history |
| Strangers ([Places](../../tyrell/docs/places.md#strangers)) | Passers-by computed "from the seed alone", promoted to people when they matter | Errands per hour for a region |
| Reverie ([module](../../tyrell/docs/modules/reverie.md)) | Memories `{ k, t, imp, about, place, text }`, core memories that shift traits, beliefs that can be wrong | The history's events, as memories of the people who lived them (`reverie.remember`) |
| Fellowship ([module](../../tyrell/docs/modules/fellowship.md)) | Regard, sentiments with reasons, compatibility raised by shared values, households with a purse | Households, old friendships and grudges from the history |
| Cradle and Delos ([Cradle](../../tyrell/docs/modules/cradle.md), [Delos](../../tyrell/docs/modules/delos.md)) | Ages and stages from `born`, couples, births with blended traits and genes | Founders' genomes; children of the history's couples |
| Wormtongue, Cityspeak, Voice, Gaff | Secrets and gossip; lines chosen by the most specific rule; conversations; storylets | A secret from the history; a culture's lines as `who: 'tag:<culture>'`; a storylet that fires on an old grudge |

Tyrell knows "nothing about tiles, side views, sprites or maps" ([Tyrell](../../tyrell/README.md)), and it never invents a name, a language, a culture or a past. That is the gap. Everything below would be a generator that runs once, from a seed, and writes plain JSON that Tyrell's existing inputs accept *(inference)*.

## Names from a naming language

Martin O'Leary's naming-language generator, made for his Uncharted Atlas map bot, is the reference design, and it is small: one file of JavaScript ([mewo2/naming-language](https://github.com/mewo2/naming-language)). A language is a handful of choices:

| Part | Choices in O'Leary's code |
|---|---|
| Consonants | 8 sets, from Minimal `ptkmnls` to Arabic-ish `tksʃdbqɣxmnlrwj` |
| Sibilants, liquids, finals | `s`, `sʃ`, `sʃf`; `rl`, `r`, `l`, `wj`, `rlwj`; `mn`, `sk`, `mnŋ`, `sʃzʒ` |
| Vowels | 7 sets, from `aiu` to `aeiouAOU` (capitals are extra vowels the spelling resolves) |
| Syllable structure | 22 patterns such as `CVC`, `CVV?C`, `S?CVF`, `C?VLC?` (`?` optional, skipped half the time) |
| Restrictions | Regexes that reject a syllable: no doubled letters, no `[sʃf][sʃ]`, no `[rl][rl]` |
| Spelling | One consonant set (Slavic š ž č, German sch tsch, French ch j tch, pinyin x q j) and one vowel set (acutes, umlauts, Welsh â ê y ô w, doubles) |

Two details make the output sound like a language rather than noise. First, frequency is skewed: each language shuffles its phonemes once and picks with `list[floor(random()² × length)]`, so every language has its own common and rare sounds. Rosenfelder's Gen does the same with a 30% chance of stopping at each phoneme, which gives the first four about 30, 21, 15 and 10% ([Gen help](https://www.zompist.com/genhelp.html)). Second, **morphemes are kept by meaning**. A keyed concept such as "city" reuses an existing morpheme with probability n/(n + 1), so it settles on one or two stems, and the genitive "of" and the definite "the" are one morpheme each per language. A name is one word or two, joined by a space, a hyphen or the genitive, kept between 5 and 12 letters, and rejected if it contains another name. Rosenfelder's advice is the same in prose: "Start with a distinctive syllable pattern", and "It's better to derive long words by combining shorter words, or adding suffixes" ([Language Construction Kit](https://www.zompist.com/kitlong.html)).

The alternatives trade control for flavor:

| Method | How | Good for | Source |
|---|---|---|---|
| Phonotactic (O'Leary, Gen, Lexifer, Awkwords) | Sets, structures, rewrite rules | Invented languages with a consistent sound | [Gorrie's survey](https://colingorrie.pages.dev/articles/conlang-word-generator) |
| Markov on real names | Order-3 characters with back-off (RogueBasin), or Azgaar's pseudo-syllables keyed by the previous letter, over a base of 109 to 276 real names | A culture that should echo a real one | [RogueBasin](https://www.roguebasin.com/index.php/Names_from_a_high_order_Markov_Process_and_a_simplified_Katz_back-off_scheme), [Azgaar](https://github.com/Azgaar/Fantasy-Map-Generator) |
| Glossed lexicon | About 3,300 English words with a translation per race; names are compounds of words filtered by the culture's symbol groups | Names that mean something | [DF wiki, Language](https://dwarffortresswiki.org/index.php/DF2014:Language) |
| Templates | RinkWorks-style patterns (`sV'i`) compiled to a generator | Quick, uncontrolled variety | [fantasyname](https://github.com/skeeto/fantasyname) |
| Full language | Phonology, grammar, sound changes, a 4,000-word vocabulary | Authoring, offline | [Vulgar](https://www.vulgarlang.com/) |

The demo combines the first and third rows. It keeps O'Leary's sets, structures, restrictions and spellings, but gives every morpheme a meaning ("river", "ford", "oak", "wolf"). It makes them all once, in a fixed order, so a language is the same whatever asks first. Then any name can be glossed back. Dwarf Fortress shows the payoff: a dwarf's surname is two English words rendered in dwarvish, "Urist Borushdumat (Raked-Roughness)" (search summary, [DF wiki](https://dwarffortresswiki.org/index.php/Urist)), and 60-odd kinds of thing can be named, roads, bridges and tombs among them (DFHack's [df-structures](https://github.com/DFHack/df-structures)). Personal names in the demo are two meaningful elements, as Old English names were (Ælfred, "elf counsel") *(inference from common knowledge; not separately sourced)*. Family names follow one rule per language: by father or mother, by home place, by trade, or by a house name. One rule per language is what makes a household read as one family and a culture as one culture *(inference)*.

<figure class="demo"><div class="stage" data-demo="names"></div>
<figcaption><b>A naming language.</b> A seeded language after Martin O'Leary: phoneme sets, a syllable structure, restrictions and a spelling, shown under <i>Sounds</i>. Each meaning keeps its morpheme, so every place on the coast is named from what is there, a qualifier plus a head (oak + ford, salt + shore), and glossed with what an English namer would have said. Some languages put the head first, as Welsh does. <i>People</i> lists given names of two meaningful elements and family names by the language's one rule (by parent, place, trade or house). Tap a pin to find its name; tap elsewhere or <i>New names</i> for more people; <i>New seed</i> makes another language and another coast.</figcaption></figure>

## Place names from the land

Real place names are a **generic** for the kind of place plus a **specific** that tells it apart *(inference from the lists below)*. The English generics are a small table ([Wikipedia](https://en.wikipedia.org/wiki/List_of_generic_forms_in_place_names_in_the_United_Kingdom_and_Ireland); the [Key to English Place-Names](https://kepn.nottingham.ac.uk/) gives each name's elements and their languages):

| Generic | From | Meaning | Example |
|---|---|---|---|
| -by | Old Norse | settlement, village | Whitby |
| -thorpe | Old Norse | secondary settlement | Scunthorpe |
| -ton | Old English | enclosure, homestead | Brighton |
| -ham | Old English | farm, homestead | Nottingham |
| -bury, -borough | Old English | fortified enclosure | Canterbury |
| -chester, -caster | Old English, from Latin | Roman fort | Lancaster |
| -stow | Old English | (holy) place of assembly | Padstow |
| -ing | Old English | people of | Reading |
| -ford | Old English | crossing | Bradford |
| -burn, -beck | Old English, Old Norse | stream | Eastbourne, Troutbeck |
| -ley | Old English | woodland clearing | Barnsley |
| -mere | Old English | lake | Windermere |
| -mouth | Middle English | river mouth | Plymouth |

Three things carry over to a generator *(inference)*:

- **The generic comes from the map.** A town on a river cell with a road across it is a ford; a farm by the sea is a shore farm. In the demo every site is classified by its cell and neighbors, the same way the [settlements page](settling.md) scores village sites.
- **The specific comes from the neighborhood or the history**: a tree from the nearby wood, salt from the sea, a color, an animal, or a founder ("Beorma's people's homestead" is how Birmingham is usually glossed). The history demo names about one town in three after its founder.
- **The table can be swapped per culture.** English is head-last (-ford); Welsh and Gaelic names are head-first (Aber-, Llan-, Inver-). Old Norse and Old English generics in one county record who settled where. A map where two cultures meet should show two sets of generics, and a town that changed hands can keep its old name.

O'Leary's own map generator calls `makeName(lang, 'city')` and `makeName(lang, 'region')` ([mewo2/terrain](https://github.com/mewo2/terrain)): his keys repeat a stem without saying what it means. Glossing is the one addition. It lets the game say what a name means when someone asks, and lets a quest turn on a name ("Oakford has no oaks") *(inference)*.

## Cultures from the land

Generators that make cultures start from where the culture begins. Azgaar's Fantasy Map Generator reads a culture's type from its center cell, first match wins: Nomadic (low desert or grassland), Highland, Lake, Naval (a harbor), River (flux over 100), Hunting (inland forest, taiga, tundra, wetland), or Generic. The type sets how far it spreads (expansionism 0.7 for Hunting to 1.5 for Naval and Nomadic) and what each cell costs it: River cultures pay 0 along rivers and 100 away from them; Highland cultures pay 3,000 for lowland; Naval cultures cross water at a twenty-fifth of a Nomadic culture's cost ([cultures-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator)). Each culture points at one name base, and folk religions come from their culture.

What a culture *values* is a short vector in every system that models it:

| System | Values | Shape |
|---|---|---|
| Dwarf Fortress | 33 values (law, family, tradition, craftsmanship, merriment, nature, peace...) and 22 ethics, each with one of 17 responses from "acceptable" to "unthinkable" | About 105 small numbers per culture ([df-structures](https://github.com/DFHack/df-structures)) |
| Stellaris | Four axes; "Each empire has 3 ethic points which must all be spent", a fanatic ethic costs 2 | Three points on four axes ([wiki](https://stellaris.paradoxwikis.com/Ethics)) |
| Tyrell | `values` 0..1 per person; shared values raise compatibility | Free keys ([Fellowship](../../tyrell/docs/modules/fellowship.md#attraction-and-compatibility)) |

Mark R. Johnson's Ultima Ratio Regum goes furthest, and he names the danger: most cultural generation is "tremendously simplistic… nothing more than surface detail". His fix is to make every trait refer to something else in the world. A nation's dialect draws on its capital's climate, terrain, plants, animals, history and religion: a nomad's curse is "may you be buried beneath the sand where none shall find you". Sentence complexity is gameplay, because talkative cultures give more clues ([Johnson 2016](https://pcgworkshop.com/archive/johnson2016procedural.pdf)). His other habits keep the output from becoming a set of stock types. Outcomes are skewed: "three outcomes which each happen 30% of the time" beside "50 incredibly obscure ones which only happen 0.2% of the time". A hidden check asks whether something "is too much like something else" and rerolls it. And "every concept should in some way link to every other concept": if "ravens are thought to be lucky", a raven on a shield earns approval ([Game Developer](https://gamedeveloper.com/design/the-10-year-journey-of-ultima-ratio-regum-the-culture-generating-roguelike)).

For Elsewhere, whose quests each bring a small world with "its own look, people and way of playing", a culture can be a short record *(inference)*:

| Field | Drawn from | Becomes in Tyrell |
|---|---|---|
| Way of life (seafarers, river farmers, herders, foresters, fen folk) | The land around its first town, as Azgaar does | A tag on each person; jobs and routines |
| Two values | Weighted by the way of life, never fixed by it | `values` on each person |
| A taboo | Drawn apart from the others | A fact, a Cityspeak line, a storylet condition |
| A building style | Materials at hand (timber, stone, stilts, turf) | The painter's kit for the place |
| A language | Seeded per culture | Names; place names |
| A naming rule | Per language | Family names; households |

The demo's cultures are built this way. The land adds weight to some values (seafarers lean toward trade), but every value can come up anywhere. Taboos and building styles are drawn separately, so two seafaring cultures don't come out identical. That is a small version of Johnson's skew and interlinking, and it is the honest limit of the demo: four fields don't make a culture, they make a culture's label *(inference)*.

## History: simulate or explain

**Simulate, then summarize.** Dwarf Fortress builds the land, then "the simulation of civilization begins. Through this process settlements are raised, trade routes are formed, and wars are waged. At a designated point in time, the simulation stops and the player begins" (Tarn Adams, [Game AI Pro 2](http://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter41_Simulation_Principles_from_Dwarf_Fortress.pdf)). History length runs from 5 to 1,050 years, and more civilizations and sites lengthen generation "by a huge amount" (search summary, [DF wiki](https://dwarffortresswiki.org/index.php/DF2014:World_gen)). The record is kept as data: historical figures with birth and death years, events with a year, a type and the ids they touch, and collections (a war, a battle, a journey) that nest events. DFHack counts 134 event types ([df-structures](https://github.com/DFHack/df-structures)). Tarn's rules for the model are short: "Don't Overcomplicate", and "Operate at the level of what the player sees or one layer below". He also asks of each feature "whether or not a story thread can pass through" it ([Paprika](https://paprikamagazine.com/articles/interview-with-tarn-adams)).

Talk of the Town simulates a town "from its founding in 1839, when a handful of families converge on an empty townscape to establish farms, through the death of the central character in the summer of 1979", ending with 300 to 500 people ([Ryan and Mateas](http://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter37_Simulating_Character_Knowledge_Phenomena_in_Talk_of_the_Town.pdf)). Its cost tricks are the lesson:

- It simulates only ten half-days a year, about 1.4% of them ([basic_config.py](https://raw.githubusercontent.com/james-owen-ryan/talktown/master/config/basic_config.py)).
- It skips knowledge for 140 years. A week before the end it implants what each person knows of family, friends, neighbors and coworkers, then simulates one week in full.
- Even so, worldgen takes "a few minutes".

Ryan's dissertation then argues that the raw run "will almost always lack story structure", so it must be sifted and curated, the way a nonfiction writer would ([Emily Short's review](https://emshort.blog/2019/05/21/curating-simulated-storyworlds-james-ryan/)).

**Generate the events, then explain them.** Caves of Qud's sultan histories start from "a distinction to be made between history as a process and history as an artifact", and aim "to generate history in order to simulate historical accounts" ([Grinblat and Bucklew 2017](https://www.freeholdgames.com/papers/Generation_of_mythic_biographies_in_Cavesofqud.pdf)). A sultan is a small state (name, birth year, region, a domain such as ice or glass, allies, a profession). About twelve events are drawn from a pool, and "there's no logic behind the choice of events… though their gospels often profess causes." Each event's text, "Acting against #injustice#, #sultanName# led an army to the gates of #location#", fills its cause from the state: if the sultan has allied frogs, the injustice is "the persecution of frogs". If no state fits, the event invents it and adds the frogs: "the effect causes the cause." Coherence comes from the few shared properties: "The sultan's shared state acts as a glue." Every event leaves things in the world. Visited places become historic sites, named items lost there lie there as real loot, and shrines and murals each show one gospel. Tomb inscriptions retell the same events "more laudatory", a second, biased account ([Qud wiki](https://wiki.cavesofqud.com/wiki/Sultan_history)). A village gets only "two generated events", each with a 1 in 20 chance of having emptied it, leaving "sometimes explicit clues about what happened" ([Qud wiki](https://wiki.cavesofqud.com/wiki/Village)).

| | Simulate, then summarize | Generate, then explain |
|---|---|---|
| Examples | Dwarf Fortress, Talk of the Town | Caves of Qud, storylets |
| History is | A process that ran | An account that was written |
| Cost | Years × agents; minutes for a town | About a dozen events per figure; trivial |
| Coherence from | Real causes, which then need sifting | Shared state, plus the reader's apophenia |
| Player can stop it | Anywhere (DF) | No: the past is fixed |
| Leaves in the world | Sites, figures, artifacts, ruins | Sites, relics, shrines, murals |

Between the two sit story sifting and constraint solving. Kreminski's Felt runs Datalog patterns over the event log to find "events that constitute a compelling story", and reads Qud as sifting "to retroactively justify each action" ([Felt](https://mkremins.github.io/publications/Felt_SimpleStorySifter.pdf)). Winnow sifts while events are still playing out, so a game can foreshadow ([Winnow](https://mkremins.github.io/publications/Winnow_AIIDE2021.pdf)). Horswill's CatSAT solves for a consistent character instead ([CatSAT](https://github.com/ianhorswill/CatSAT)). And Nothing Beside Remains runs "an abstract simulation of a village population" until it fails (food, ecosystem, hostile animals), then prints the end state into the map: a hot, dry end means shrunken water ([Smith Nicholls and Cook 2023](https://arxiv.org/abs/2304.08293)).

The demo is the simulate side made cheap. It ticks yearly, never daily, keeps no agents beyond towns and rulers, and stores every event with its year and the ids of what it touched. Three hundred years on a 96×60 island with three or four cultures take 60 to 75 ms in Chrome on a laptop. Generation follows these rules:

- Towns grow toward what their site can feed.
- Full towns found daughters on the best free site nearby. The road between them is found by cost, so roads bend around hills and cross rivers at fords, and later roads reuse them.
- Neighbors drift toward trade or quarrel, by their values and by land hunger.
- Wars produce battles, captured towns and ruins. A fallen hero gets a cairn.
- Floods produce shrines upstream, and visions produce shrines on hills.

Because each event names what it touched, tapping a shrine on the map answers why it is there.

<figure class="demo"><div class="stage" data-demo="history"></div>
<figcaption><b>A world with a past.</b> Three hundred years on a seeded island. Three or four cultures start on good land; each one's way of life is read from the land around it (coast, river, hills, woods, fen), which weights its two values but never fixes them, and each gets a taboo and a way of building. Towns grow, found daughters along roads found by cost (so roads bend round hills and gather at fords), trade, quarrel, fight battles, change hands and burn; floods and visions raise shrines; cairns mark where heroes fell. Towns are named in their culture's language from their sites. Drag <i>Year</i> or press <i>Play</i> to scrub the timeline; tap a town, shrine or battlefield (the red cross) for its story. The legends list is every event up to that year.</figcaption></figure>

For a quest the explain side is usually the better fit *(inference)*. The player arrives at the end of history and never stops it partway, a quest needs three to five events rather than three hundred years, and each event can be chosen because it leaves something worth finding. The demo's real lesson is its data shape: events as `{ year, text, refs }`, with every object on the map holding the ids of the events that made it. That shape serves either method.

## Lineage and legacy

A past is also a family tree. Crusader Kings III authors its history and simulates forward from it. Character files carry `dynasty`, `culture`, `father` and `mother` by id, traits, and dated birth and death blocks ([CK3 wiki](https://ck3.paradoxwikis.com/Characters_modding)). Congenital traits pass on by table: 25% with one parent showing it, 80% with both, and 10% from two carriers ([CK3 wiki](https://ck3.paradoxwikis.com/Trait_inheritance)). Tyrell's Cradle and Delos already do the forward part: ages and stages from `born`, couples, births whose genes follow dominance and whose traits blend both parents ([Delos](../../tyrell/docs/modules/delos.md)). So a generator needs only to write the founders and the dead: a few generations as `PersonDef`s with negative `born`, and the departed as memories of `'loss'` *(inference)*.

Wildermyth shows how little text a character needs. Each hero starts with three history lines (Origin, Anecdote, Motivation), "A line of player-facing text that tells a story about the entity it's pinned to". The lines set stats and seed quirks, and more are added "in recognition of game-occurrences" ([Wildermyth wiki](https://wildermyth.com/wiki/History)). A retired hero becomes a legacy hero who keeps "items, transformations, history, and abilities" ([Legacy](https://wildermyth.com/wiki/Legacy)). That is the right size for an Elsewhere quest-giver: one or two lines of past, each tied to something the player can see *(inference)*.

## Daily routines

Routines are data in every game that has them, and the formats converge:

| Game | Format | Numbers |
|---|---|---|
| Ultima VII | Per NPC, 1 to 8 entries of (3-bit period, 5-bit activity, point) | 256 NPCs; eight periods of three hours; 32 activities from Farm and Tend Shop to Kid Games and Eat at Inn ([Ultima Codex](https://www.wiki.ultimacodex.com/wiki/Ultima_VII_internal_formats_%E2%80%93_SCHEDULE.DAT)) |
| Oblivion, Skyrim | A cascading list of packages (Travel, Wander, Find, Eat, UseItemAt, Sleep), the first valid by schedule and conditions runs; schedules in hour blocks | About 1,000 NPCs and 7,200 packages in Oblivion (half scheduled); 6,000 in Skyrim (a quarter) ([Paavo](https://blog.paavo.me/radiant-ai), [cs.uesp.net](https://cs.uesp.net/wiki/Package)) |
| Stardew Valley | Keyed schedule strings, "the first match in the order listed" wins, down to `default`; entries like `800 HaleyHouse 6 5 0` | Times in "24-hour military format with no colon"; `rain2` applies on half of rainy days (search summary) |
| The Sims | No schedule: objects advertise to eight needs, and a Sim picks "the behavior that maximizes their current happiness" | "a toilet advertises to Bladder, in a range from 0 to 70" ([Forbus and Wright](https://www.qrg.northwestern.edu/papers/Files/Programming_Objects_in_The_Sims.pdf)) |
| RimWorld | A 24-hour grid of Anything, Work, Recreation, Sleep; needs override by threshold | In Work only food under 30% interrupts ([wiki](https://rimworldwiki.com/wiki/Schedule)) |
| Animal Crossing | Personality sets the clock | Lazy villagers sleep 11 pm to 8 am; big sisters 3 to 9:30 am ([Nookipedia](https://nookipedia.com/wiki/Personality)) |
| Tyrell | `[hour, place, activity]` entries, variants `{ days, when, plan }`, rank 1 under job and story, needs in the gaps | Fractional hours; an entry lasts until the next ([Deciding](../../tyrell/docs/deciding.md#routines)) |

Tyrell's format is Ultima's entries with Stardew's variants, run over The Sims' needs, which leaves only the writing of routines to a generator *(inference)*. The demo writes them from a few parts:

- **The job**: where and when work happens. The smith works the forge 7 to 17, the baker from 4:30, the innkeeper until 23:30. The trader walks the east road except on market days; the herder takes the flock to the west hills.
- **The stage of life**: children play by the well, and elders sit there in the morning and nap after lunch.
- **The person's own habits**: a lark or owl score sets waking (as Animal Crossing's personalities do), devoutness adds a dawn prayer, and sociability chooses the tavern, the well or home in the evening.
- **The village's values**: with *kin*, supper is at 18:00 sharp for everyone; with *faith*, more people pray; with *merriment*, more go to the tavern.
- **Two weekday variants**: market days (1 and 4) bring traders and buyers to the square, and the rest day (6) brings everyone to the shrine at 9.

Each day adds a few minutes of seeded slack per entry, so nobody runs like a clock, except the shared supper and the rest-day prayer, which are social appointments. Bethesda's history is the warning against going further. Todd Howard promised NPCs that "can steal it, they can buy it, they can grow it"; Emil Pagliarulo found a quest's skooma dealer already dead, because addicts "were killing the merchant to get it!", and the team "had to consciously tone down" behavior ([GamesBeat](https://gamesbeat.com/dimming-the-radiant-ai-in-oblivion/)). Shipped, "NPCs cannot buy food" ([Paavo](https://blog.paavo.me/radiant-ai)). A routine is a promise to the player about where someone will be; needs should bend it, not break it. Tyrell's ranks already do that.

<figure class="demo"><div class="stage" data-demo="schedules"></div>
<figcaption><b>A village day.</b> Four households (ten to fourteen people) in a village whose language, values and few events are seeded. Each person's routine is written from their job, age, habits and the village's values as Tyrell routine variants (shown under the person, with today's marked), and the strip shows today's plan with the clock's place. Market days fill the square; on the rest day everyone goes to the shrine at nine; at night the windows of houses with someone awake are lit. Where everyone is comes from the clock alone, the way Tyrell's far people and strangers work off screen. Pick someone under <i>Follow</i> or tap them; change the speed; <i>New seed</i> makes another village.</figcaption></figure>

## Off screen

Every shipped system cheats the same way off screen:

| Game | What happens when nobody is watching |
|---|---|
| Oblivion | Four processing levels. In unloaded cells, Travel is about the only package that acts. Actors teleport cell to cell "when enough time has passed", and low-level actors "cannot interact with each other in any way" ([Paavo](https://blog.paavo.me/radiant-ai)) |
| Shadows of Doubt | First, a day was planned in advance for every citizen ("typically no more than 10-15 seconds"). Later, goals updated at a rate that is high "only… when nearest the player", making "the performance cost of 95% of the citizens at any one time relatively insignificant" ([DevBlog 8](https://colepowered.com/shadows-of-doubt-devblog-8-simulating-a-city/), [DevBlog 15](https://colepowered.com/shadows-of-doubt-devblog-15-moving-in-the-citizens/)) |
| Assassin's Creed Unity | "With the limit of 40 real AIs and 120 high resolution models, we could successfully create a scene where 10,000 crowd NPCs are on screen" ([GDC Vault](https://www.gdcvault.com/play/1022141/Massive-Crowd-on-Assassin-s)) |
| Talk of the Town | 140 years at 1.4% fidelity, with knowledge implanted at the end |

Tyrell's answer is exact rather than approximate. "Off screen nothing ticks": an event queue jumps between action ends, so "a day for a hundred people is a few thousand events, not a few million frames". Near and far follow one timetable, so a watched world hashes the same as an unwatched one ([Concepts](../../tyrell/docs/concepts.md#near-and-far-one-mind-two-ways-to-carry-it-out)). Strangers go one step further and cost nothing until promoted ([Places](../../tyrell/docs/places.md#strangers)). The schedules demo is the strangers' trick applied to routine-only people: their position at any minute is a pure function of the seed and the clock, with nothing stepped. For history, the same idea runs one level up *(inference)*:

- **Years before the quest** are a coarse simulation or a written account, done once at load.
- **Days before the quest** are Tyrell's `advance` over a day or two, so habits, regard and gossip settle. A night for Rocinante takes "tens of milliseconds" ([Time](../../tyrell/docs/time.md#fast-forward-while-sleeping)).
- **The quest itself** runs live.

## A quest-sized past

Elsewhere's quests are "five to fifteen minutes", each with "two to six residents" and one place (Elsewhere's design brief, its `DESIGN.md`). The [worlds page](worlds.md#places-with-people) already proposes the loop: a few people, three to five events that link people to places, a layout where each event leaves something, and the events fed to the minds as memories. Put together with this page's sources, the generator would run in seven steps, all from one named stream such as `ctx.rng('people')` *(inference)*:

1. **Read the site.** From the land the place already has ([geography](geography.md), [settlements](settling.md)): water, slope, woods, the road and its fords.
2. **Make the culture.** A way of life from the site, two values, a taboo, a building style, a language and its naming rule.
3. **Write the past backward from what the place shows.** Choose three to five events from a deck whose cards each leave a mark, Qud-style. Fill each card's cause from the state, or invent it:

   | Card | Leaves | Becomes |
   |---|---|---|
   | Flood | A shrine upstream | A fact, a memory for everyone old enough |
   | Fire | A ruin, a rebuilt forge on old stones | Who owns the forge now |
   | Quarrel over a boundary | A field split by a wall | Two households with a grudge (Fellowship sentiment) |
   | Marriage from elsewhere | A newcomer with a different name | A name from another language, a sentiment |
   | Death | A grave | Grief, an inheritance (Cradle) |
   | A road built round a hill | The bend in the road | A name ("Long Hill"), a memory |

4. **Name everything** from the site and the events, in the culture's language, glossed.
5. **Write the people.** Households with `born`, `home`, a job and a routine from the parts above, `values` from the culture plus a personal draw, and the events as `reverie.remember` memories for those who lived them, each with `about` and `place`.
6. **Settle.** `world.advance` a day or two so regard, habits and gossip start from somewhere.
7. **Check.** In Node over a thousand seeds: every person has a reachable home and workplace, no two names collide, every event has a mark the player can reach, and generation stays under its budget. This is the generate-and-test the [worlds page](worlds.md#generate-then-test) recommends.

**Why the shrine is there, why the road bends, who owns which field.** Each of these is an event whose mark is on the map and whose memory is in someone's head. The player can find it in either place, and Voice can bring it up when they ask (*inference*). Dwarf Fortress's test for a feature fits here: whether "a story thread can pass through" it.

## What it means for Tycho and Tyrell

Nothing here needs new engine machinery for minds, because Tyrell already runs everything the past is fed into. What's missing is a seeded writer of people, small enough to run at a quest's load. A proposed split, all *(inference)*:

| Part | Where | What | Size |
|---|---|---|---|
| `lang` | Tycho, core (no DOM) | O'Leary-style naming languages with glossed morphemes, made in a fixed order; naming rules; place names from a generic and a specific; a table of generics per language | S, about 200 lines (the demo's is about 130) |
| `culture` | Tycho, world | A record (way of life, values, taboo, building style, language, naming rule) from a site, with weights the game passes in | S |
| `chronicle` | Tycho, world | An event log `{ y, kind, text, refs }`, a deck of event cards with marks and cause slots filled from state (Qud), and an optional yearly simulator for wider maps (this page's demo) | M |
| `routine` | Tyrell tool, or the bridge | Writes Tyrell routine variants from job, stage, habits and values; the game passes the job table | S |
| `populate` | The bridge (`tycho-minds`) | Turns households, a chronicle and a culture into `world.person` calls, `fellowship` groups and sentiments, `reverie.remember` memories and facts | M |
| Checks | Test kit | A seed sweep for reachable homes, unique names and reachable marks | S |

Tyrell itself might gain two small options *(inference)*:

- A routine variant keyed by a fact the chronicle sets (a feast on a flood's anniversary). `when: ['fact:...']` already covers it.
- A memory kind for "heard of it" as against "was there", so the young know the flood only as a story. Reverie's beliefs with sources come close.

Elsewhere's rule still holds. Nobody in any world knows what a main quest is, and no generated past may be about the Hollow, the Lanterns or the Spire. The event deck simply has no such cards.

## Sources

- Tyrell: [README](../../tyrell/README.md), [Concepts](../../tyrell/docs/concepts.md), [Places](../../tyrell/docs/places.md), [Time](../../tyrell/docs/time.md), [Deciding](../../tyrell/docs/deciding.md), [API](../../tyrell/docs/api.md), and the modules [Reverie](../../tyrell/docs/modules/reverie.md), [Fellowship](../../tyrell/docs/modules/fellowship.md), [Cradle](../../tyrell/docs/modules/cradle.md), [Delos](../../tyrell/docs/modules/delos.md)
- Martin O'Leary: [naming-language](https://github.com/mewo2/naming-language) and [terrain](https://github.com/mewo2/terrain)
- Mark Rosenfelder: [Language Construction Kit](https://www.zompist.com/kitlong.html), [Gen](https://www.zompist.com/gen.html) and [its help](https://www.zompist.com/genhelp.html)
- [Colin Gorrie, conlang word generators](https://colingorrie.pages.dev/articles/conlang-word-generator); [Lingua::Awkwords](https://metacpan.org/pod/Lingua::Awkwords); [Vulgar](https://www.vulgarlang.com/); [fantasyname](https://github.com/skeeto/fantasyname); [Frozen Fractal, constructing languages](https://frozenfractal.com/blog/2024/8/9/around-the-world-19-constructing-languages)
- [RogueBasin, Markov names with Katz back-off](https://www.roguebasin.com/index.php/Names_from_a_high_order_Markov_Process_and_a_simplified_Katz_back-off_scheme)
- [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) (names, cultures and religions generators)
- [Wikipedia, generic forms in place names in the UK and Ireland](https://en.wikipedia.org/wiki/List_of_generic_forms_in_place_names_in_the_United_Kingdom_and_Ireland); [Key to English Place-Names](https://kepn.nottingham.ac.uk/)
- Dwarf Fortress: [Tarn Adams, Game AI Pro 2 ch. 41](http://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter41_Simulation_Principles_from_Dwarf_Fortress.pdf); [Paprika interview](https://paprikamagazine.com/articles/interview-with-tarn-adams); [DFHack df-structures](https://github.com/DFHack/df-structures); DF wiki: [World gen](https://dwarffortresswiki.org/index.php/DF2014:World_gen), [Language](https://dwarffortresswiki.org/index.php/DF2014:Language), [Urist](https://dwarffortresswiki.org/index.php/Urist)
- [Grinblat and Bucklew, Generation of Mythic Biographies in Caves of Qud (FDG 2017)](https://www.freeholdgames.com/papers/Generation_of_mythic_biographies_in_Cavesofqud.pdf); Qud wiki: [Sultan history](https://wiki.cavesofqud.com/wiki/Sultan_history), [Village](https://wiki.cavesofqud.com/wiki/Village)
- [Ryan and Mateas, Talk of the Town, Game AI Pro 3 ch. 37](http://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter37_Simulating_Character_Knowledge_Phenomena_in_Talk_of_the_Town.pdf) and [its config](https://raw.githubusercontent.com/james-owen-ryan/talktown/master/config/basic_config.py); [Ryan, Curating Simulated Storyworlds](https://escholarship.org/uc/item/1340j5h2), via [Emily Short's review](https://emshort.blog/2019/05/21/curating-simulated-storyworlds-james-ryan/)
- Kreminski: [Felt](https://mkremins.github.io/publications/Felt_SimpleStorySifter.pdf), [Winnow](https://mkremins.github.io/publications/Winnow_AIIDE2021.pdf); [Horswill, CatSAT](https://github.com/ianhorswill/CatSAT); [Smith Nicholls and Cook, Nothing Beside Remains](https://arxiv.org/abs/2304.08293)
- Mark R. Johnson: [Procedural Generation of Linguistics, Dialects, Naming Conventions and Spoken Sentences (2016)](https://pcgworkshop.com/archive/johnson2016procedural.pdf); [Game Developer, ten years of Ultima Ratio Regum](https://gamedeveloper.com/design/the-10-year-journey-of-ultima-ratio-regum-the-culture-generating-roguelike)
- [Stellaris wiki, Ethics](https://stellaris.paradoxwikis.com/Ethics); CK3 wiki: [Characters modding](https://ck3.paradoxwikis.com/Characters_modding), [Trait inheritance](https://ck3.paradoxwikis.com/Trait_inheritance); Wildermyth wiki: [History](https://wildermyth.com/wiki/History), [Legacy](https://wildermyth.com/wiki/Legacy)
- [Ultima Codex, Ultima VII SCHEDULE.DAT](https://www.wiki.ultimacodex.com/wiki/Ultima_VII_internal_formats_%E2%80%93_SCHEDULE.DAT); [Paavo, What was Radiant AI, anyway?](https://blog.paavo.me/radiant-ai); [cs.uesp.net, Package](https://cs.uesp.net/wiki/Package); [GamesBeat, dimming the Radiant AI](https://gamesbeat.com/dimming-the-radiant-ai-in-oblivion/)
- [Forbus and Wright, programming objects in The Sims](https://www.qrg.northwestern.edu/papers/Files/Programming_Objects_in_The_Sims.pdf); [RimWorld wiki, Schedule](https://rimworldwiki.com/wiki/Schedule); [Nookipedia, Personality](https://nookipedia.com/wiki/Personality)
- Shadows of Doubt: [DevBlog 8](https://colepowered.com/shadows-of-doubt-devblog-8-simulating-a-city/), [DevBlog 15](https://colepowered.com/shadows-of-doubt-devblog-15-moving-in-the-citizens/); [Assassin's Creed Unity crowds, GDC 2015](https://www.gdcvault.com/play/1022141/Massive-Crowd-on-Assassin-s)

The full research is in [the note on people, names and histories](notes/people_names_histories.md).

<script src="demos/kit.js"></script>
<script src="demos/people-shared.js"></script>
<script src="demos/names.js"></script>
<script src="demos/history.js"></script>
<script src="demos/schedules.js"></script>
<script src="demos/start.js"></script>
