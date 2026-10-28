import type { Module } from '../core/module';
import type { Id } from '../core/types';
import type { World } from '../core/world';
import type { Said } from './cityspeak';
export interface JoiRequest {
    /** The full prompt Joi built. */
    prompt: string;
    /** A short system line: the game's voice. */
    system: string;
    who: Id;
    to?: Id;
    /** The line the written rules would say (the fallback). */
    line: Said | null;
}
export type JoiReply = string | {
    text: string;
    flags?: string[];
};
export type JoiProvider = (req: JoiRequest) => Promise<JoiReply>;
export interface Spoken {
    text: string;
    key: string | null;
    flags: string[];
    fromModel: boolean;
}
/** Joi's settings. It never changes the world, so it has no headline knobs: these shape only the prompt and the wait. */
export interface JoiConfig {
    /** Needs over this level go into the prompt as what they badly want. Default 0.6. */
    wants: number;
    /** How many of their strongest memories go into the prompt. Default 3. */
    memories: number;
    /** Milliseconds to wait for the provider before the written line, unless speak() is given its own. Default 2500. */
    timeoutMs: number;
}
export declare const DEFAULT_JOI: JoiConfig;
export declare class Joi implements Module {
    readonly name = "joi";
    readonly config: JoiConfig;
    /** The game's voice, in a sentence: 'neon noir, clipped' or 'cozy, folksy'. */
    voice: string;
    private provider;
    private allowed;
    private w;
    constructor(cfg?: Partial<JoiConfig>);
    attach(w: World): void;
    /** The config in force: as declared, under any world.tune. */
    private get c();
    /** Sets the function that calls a model (async). */
    setProvider(fn: JoiProvider | null): this;
    /** Flags a reply may suggest (anything else is dropped). */
    allow(flags: string[]): this;
    /** The prompt for a person speaking (useful to look at, or to send yourself). */
    prompt(who: Id, opts?: {
        to?: Id;
        topic?: string;
    }): string;
    private promptNow;
    /**
     * Speaks: asks the provider, or falls back to the written line. Never
     * changes the world.
     */
    speak(who: Id, opts?: {
        to?: Id;
        topic?: string;
        timeoutMs?: number;
    }): Promise<Spoken>;
}
