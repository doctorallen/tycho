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
import { World, DEFAULT_CONFIG, CORE_KNOBS, MIGRATIONS, SCHEMA } from './core/world';
import type { SaveData } from './core/world';
import type { Module } from './core/module';
import type { Options } from './core/types';
import { Reverie, DEFAULT_REVERIE } from './modules/reverie';
import { Fellowship, DEFAULT_FELLOWSHIP } from './modules/fellowship';
import { Wormtongue, DEFAULT_WORMTONGUE } from './modules/wormtongue';
import { Cityspeak, DEFAULT_CITYSPEAK } from './modules/cityspeak';
import { Mentat, DEFAULT_MENTAT } from './modules/mentat';
import { Gaff, DEFAULT_GAFF } from './modules/gaff';
import { Ceres, DEFAULT_CERES } from './modules/ceres';
import { Cradle, DEFAULT_CRADLE } from './modules/cradle';
import { Joi, DEFAULT_JOI } from './modules/joi';
import { Athelas, DEFAULT_ATHELAS } from './modules/athelas';
import { Delos, DEFAULT_DELOS } from './modules/delos';
import { Voice, DEFAULT_VOICE } from './modules/voice';
import { Bree, DEFAULT_BREE, OUTCOMES, breeStarter } from './modules/bree';
import { Morgul, DEFAULT_MORGUL } from './modules/morgul';
import { run, compare } from './tools/voightkampff';
import { curveAt } from './core/bicameral';
import { DAY, HOUR, Stream, clamp, hash, hash01, hourOf, dayOf, inHours } from './core/util';

/** The engine's version. */
export const VERSION = '2.0.0';

/** Every module that ships with Tyrell, by name. */
export const MODULES = ['reverie', 'fellowship', 'wormtongue', 'cityspeak', 'mentat', 'gaff', 'ceres', 'cradle', 'joi', 'athelas', 'delos', 'voice', 'bree', 'morgul'] as const;
export type ModuleName = (typeof MODULES)[number];

export interface CreateOptions extends Options {
  /** Settings for the modules, by name: { reverie: { breaks: 0.5 }, cradle: { year: 12 * 1440 } }. Every field is in docs/tuning.md. */
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
    cityspeak: () => new Cityspeak(cfg.cityspeak as any),
    mentat: () => new Mentat(cfg.mentat as any),
    gaff: () => new Gaff(cfg.gaff as any),
    ceres: () => new Ceres(cfg.ceres as any),
    cradle: () => new Cradle(cfg.cradle as any),
    joi: () => new Joi(cfg.joi as any),
    athelas: () => new Athelas(cfg.athelas as any),
    delos: () => new Delos(cfg.delos as any),
    voice: () => new Voice(cfg.voice as any),
    bree: () => new Bree(cfg.bree as any),
    morgul: () => new Morgul(cfg.morgul as any),
  };
  const modules: Module[] = [];
  for (const n of MODULES) if (names.includes(n)) modules.push(make[n]());
  for (const n of names) if (!(MODULES as readonly string[]).includes(n)) throw new Error(`Tyrell: no module named '${n}'`);
  if (opts.extra) modules.push(...opts.extra);
  return new World(opts, modules);
}

/** The behavior tests. */
export const VoightKampff = { run, compare };

/** Every module's default settings, by name (what moduleConfig is merged over): see docs/tuning.md. */
export const MODULE_DEFAULTS: Readonly<Record<ModuleName, Readonly<Record<string, unknown>>>> = {
  reverie: DEFAULT_REVERIE, fellowship: DEFAULT_FELLOWSHIP, wormtongue: DEFAULT_WORMTONGUE, cityspeak: DEFAULT_CITYSPEAK, mentat: DEFAULT_MENTAT,
  gaff: DEFAULT_GAFF, ceres: DEFAULT_CERES, cradle: DEFAULT_CRADLE, joi: DEFAULT_JOI, athelas: DEFAULT_ATHELAS, delos: DEFAULT_DELOS, voice: DEFAULT_VOICE,
  bree: DEFAULT_BREE, morgul: DEFAULT_MORGUL,
} as unknown as Readonly<Record<ModuleName, Readonly<Record<string, unknown>>>>;

export {
  World, DEFAULT_CONFIG, CORE_KNOBS, MIGRATIONS, SCHEMA,
  Reverie, Fellowship, Wormtongue, Cityspeak, Mentat, Gaff, Ceres, Cradle, Joi, Athelas, Delos, Voice, Bree, Morgul,
  OUTCOMES, breeStarter,
  curveAt, Stream, clamp, hash, hash01, hourOf, dayOf, inHours, DAY, HOUR,
};
export type { SaveData, Module };
export type * from './core/types';
export type { FeelingDef, BreakDef, MemoryKindDef, Belief, Memory, PersonFile, Shift, ReverieConfig } from './modules/reverie';
export type { GroupDef, Sentiment, FellowshipConfig } from './modules/fellowship';
export type { CrimeDef, Report, Secret, WormtongueConfig } from './modules/wormtongue';
export type { LineDef, PracticeDef, SocialActDef, Said, ChooseOpts, CityspeakConfig } from './modules/cityspeak';
export type { MentatConfig } from './modules/mentat';
export type { StoryletDef, Phase, GaffConfig } from './modules/gaff';
export type { GoodDef, ChainDef, GoodReport, ProductionReport, CeresConfig } from './modules/ceres';
export type { CradleConfig } from './modules/cradle';
export type { JoiRequest, JoiReply, JoiProvider, Spoken, JoiConfig } from './modules/joi';
export type { CourseDef, CoursePhase, CourseBranch, CourseSeverity, CourseView, AthelasConfig } from './modules/athelas';
export type { GeneDef, BlendDef, Genome, Mutation, DelosConfig } from './modules/delos';
export type { ApproachDef, AnswerDef, BeatDef, ThreadDef, PromiseDef, VoiceConfig, TalkLine, TalkOption, TalkView } from './modules/voice';
export type { LandRules } from './modules/landing';
export type { Outcome, OutcomeKey, OutcomeDo, KindDef, TopicDef, TopicSource, MannerDef, BreeConfig, Exchange, ExchangeView, Turn, Feud, Finished, StarterOptions } from './modules/bree';
export type { Intent, MeansUse, MeansDef, WoundDef, TrapDef, TaintDef, Harm, HarmView, Blow, Response, MorgulConfig } from './modules/morgul';
export type { StrangerDef, StrangerErrand } from './core/strangers';
export type { VKOptions, VKReport, VKStats, VKCheck, VKInteractions, VKHarm } from './tools/voightkampff';
export type { Requirement } from './core/bicameral';
export type { LogFilter } from './core/westmarch';
