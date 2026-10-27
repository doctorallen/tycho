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
export declare class Joi implements Module {
    readonly name = "joi";
    /** The game's voice, in a sentence: 'neon noir, clipped' or 'cozy, folksy'. */
    voice: string;
    private provider;
    private allowed;
    private w;
    attach(w: World): void;
    /** Sets the function that calls a model (async). */
    setProvider(fn: JoiProvider | null): this;
    /** Flags a reply may suggest (anything else is dropped). */
    allow(flags: string[]): this;
    /** The prompt for a person speaking (useful to look at, or to send yourself). */
    prompt(who: Id, opts?: {
        to?: Id;
        topic?: string;
    }): string;
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
