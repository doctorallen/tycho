// Tyrell: a minds engine for games full of people. "More human than human."
//
//   const world = Tyrell.create({ seed: 'my-city' });
//   world.need({ id: 'hunger', rise: 0.15 });
//   world.place({ id: 'cafe', tags: ['food'], slots: { seat: 6 } });
//   world.action({ id: 'eat', at: 'tag:food', slot: 'seat', minutes: 30, relieves: { hunger: 0.6 } });
//   world.person('ana', { home: 'apt_a' });
//   world.tick(1 / 60);  // every frame
//
// See docs/ for everything else.
import { World, DEFAULT_CONFIG, MIGRATIONS, SCHEMA } from './core/world';
import type { SaveData } from './core/world';
import type { Module } from './core/module';
import type { Options } from './core/types';
import { Reverie } from './modules/reverie';
import { Fellowship } from './modules/fellowship';
import { Wormtongue } from './modules/wormtongue';
import { Cityspeak } from './modules/cityspeak';
import { Mentat } from './modules/mentat';
import { Gaff } from './modules/gaff';
import { Ceres } from './modules/ceres';
import { Cradle } from './modules/cradle';
import { Joi } from './modules/joi';
import { run, compare } from './tools/voightkampff';
import { curveAt } from './core/bicameral';
import { DAY, HOUR, Stream, clamp, hash, hash01, hourOf, dayOf, inHours } from './core/util';

/** The engine's version. */
export const VERSION = '2.0.0';

/** Every module that ships with Tyrell, by name. */
export const MODULES = ['reverie', 'fellowship', 'wormtongue', 'cityspeak', 'mentat', 'gaff', 'ceres', 'cradle', 'joi'] as const;
export type ModuleName = (typeof MODULES)[number];

export interface CreateOptions extends Options {
  /** Settings for the modules, by name: { reverie: { base: 0.6 }, cradle: { year: 12 * 1440 } }. */
  moduleConfig?: Partial<Record<ModuleName, Record<string, unknown>>>;
  /** Your own modules, added after the built-in ones. */
  extra?: Module[];
}

/** Makes a new world. */
export function create(opts: CreateOptions = {}): World {
  const names = opts.modules ?? [...MODULES];
  const cfg = opts.moduleConfig || {};
  const make: Record<string, () => Module> = {
    reverie: () => new Reverie(cfg.reverie as any),
    fellowship: () => new Fellowship(cfg.fellowship as any),
    wormtongue: () => new Wormtongue(cfg.wormtongue as any),
    cityspeak: () => new Cityspeak(),
    mentat: () => new Mentat(cfg.mentat as any),
    gaff: () => new Gaff(cfg.gaff as any),
    ceres: () => new Ceres(),
    cradle: () => new Cradle(cfg.cradle as any),
    joi: () => new Joi(),
  };
  const modules: Module[] = [];
  for (const n of MODULES) if (names.includes(n)) modules.push(make[n]());
  for (const n of names) if (!(MODULES as readonly string[]).includes(n)) throw new Error(`Tyrell: no module named '${n}'`);
  if (opts.extra) modules.push(...opts.extra);
  return new World(opts, modules);
}

/** The behavior tests. */
export const VoightKampff = { run, compare };

export {
  World, DEFAULT_CONFIG, MIGRATIONS, SCHEMA,
  Reverie, Fellowship, Wormtongue, Cityspeak, Mentat, Gaff, Ceres, Cradle, Joi,
  curveAt, Stream, clamp, hash, hash01, hourOf, dayOf, inHours, DAY, HOUR,
};
export type { SaveData, Module };
export type * from './core/types';
export type { FeelingDef, BreakDef, MemoryKindDef, Belief, Memory, PersonFile, Shift, ReverieConfig } from './modules/reverie';
export type { GroupDef, Sentiment, FellowshipConfig } from './modules/fellowship';
export type { CrimeDef, Report, Secret, WormtongueConfig } from './modules/wormtongue';
export type { LineDef, PracticeDef, SocialActDef, Said } from './modules/cityspeak';
export type { MentatConfig } from './modules/mentat';
export type { StoryletDef, Phase, GaffConfig } from './modules/gaff';
export type { GoodDef } from './modules/ceres';
export type { CradleConfig } from './modules/cradle';
export type { JoiRequest, JoiReply, JoiProvider, Spoken } from './modules/joi';
export type { StrangerDef, StrangerErrand } from './core/strangers';
export type { VKOptions, VKReport, VKStats, VKCheck } from './tools/voightkampff';
export type { Requirement } from './core/bicameral';
export type { LogFilter } from './core/westmarch';
