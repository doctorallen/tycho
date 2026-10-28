import { World, DEFAULT_CONFIG, CORE_KNOBS, MIGRATIONS, SCHEMA } from './core/world';
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
import { Athelas } from './modules/athelas';
import { Delos } from './modules/delos';
import { Voice } from './modules/voice';
import { run, compare } from './tools/voightkampff';
import { curveAt } from './core/bicameral';
import { DAY, HOUR, Stream, clamp, hash, hash01, hourOf, dayOf, inHours } from './core/util';
/** The engine's version. */
export declare const VERSION = "2.0.0";
/** Every module that ships with Tyrell, by name. */
export declare const MODULES: readonly ["reverie", "fellowship", "wormtongue", "cityspeak", "mentat", "gaff", "ceres", "cradle", "joi", "athelas", "delos", "voice"];
export type ModuleName = (typeof MODULES)[number];
export interface CreateOptions extends Options {
    /** Settings for the modules, by name: { reverie: { breaks: 0.5 }, cradle: { year: 12 * 1440 } }. Every field is in docs/tuning.md. */
    moduleConfig?: Partial<Record<ModuleName, Record<string, unknown>>>;
    /** Your own modules, added after the built-in ones. */
    extra?: Module[];
}
/** Makes a new world. */
export declare function create(opts?: CreateOptions): World;
/** The behavior tests. */
export declare const VoightKampff: {
    run: typeof run;
    compare: typeof compare;
};
/** Every module's default settings, by name (what moduleConfig is merged over): see docs/tuning.md. */
export declare const MODULE_DEFAULTS: Readonly<Record<ModuleName, Readonly<Record<string, unknown>>>>;
export { World, DEFAULT_CONFIG, CORE_KNOBS, MIGRATIONS, SCHEMA, Reverie, Fellowship, Wormtongue, Cityspeak, Mentat, Gaff, Ceres, Cradle, Joi, Athelas, Delos, Voice, curveAt, Stream, clamp, hash, hash01, hourOf, dayOf, inHours, DAY, HOUR, };
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
export type { CourseDef, CoursePhase, AthelasConfig } from './modules/athelas';
export type { GeneDef, BlendDef, Genome, Mutation, DelosConfig } from './modules/delos';
export type { ApproachDef, AnswerDef, BeatDef, ThreadDef, PromiseDef, VoiceConfig, TalkLine, TalkOption, TalkView } from './modules/voice';
export type { StrangerDef, StrangerErrand } from './core/strangers';
export type { VKOptions, VKReport, VKStats, VKCheck } from './tools/voightkampff';
export type { Requirement } from './core/bicameral';
export type { LogFilter } from './core/westmarch';
