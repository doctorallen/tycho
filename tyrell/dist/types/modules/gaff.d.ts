import type { Module } from '../core/module';
import type { Cond, Id } from '../core/types';
import type { World } from '../core/world';
export type Phase = 'build' | 'peak' | 'fade' | 'relax';
export interface StoryletDef {
    id: Id;
    label?: string;
    /** Conditions (strings or a function of the world). */
    when?: Cond[] | ((w: World) => boolean);
    /** Mean minutes between firings while it's eligible. */
    mtb: number;
    /** Minutes before it can fire again. */
    cooldown?: number;
    /** Fires only in these phases of its subject's intensity. */
    phase?: Phase | Phase[];
    /** The intensity subject it reads and bumps. Default 'world'. */
    subject?: string;
    /** How much firing raises the subject's intensity. Default 0.2. */
    bump?: number;
    /** Part of a deck: when it comes up, a card is drawn from the deck instead. */
    deck?: string;
    /** Pick a place nobody can see (not in focus, nobody there), from this tag. */
    unseen?: string;
    /** What happens. */
    fire: (w: World, ctx: {
        place: Id | null;
        subject: string;
        id: Id;
    }) => void;
}
interface Intensity {
    v: number;
    phase: Phase;
    since: number;
}
interface State {
    last: Record<Id, number>;
    decks: Record<string, {
        cards: Id[];
        last?: Id;
    }>;
    intensity: Record<string, Intensity>;
    fired: Array<{
        t: number;
        id: Id;
        place: Id | null;
    }>;
}
export interface GaffConfig {
    /** Intensity at which the build-up turns into a peak. */
    peakAt: number;
    /** Minutes a peak lasts. */
    peakMinutes: number;
    /** Minutes of relaxing after the fade. */
    relaxMinutes: number;
    /** Intensity lost per hour. */
    decay: number;
}
export declare const DEFAULT_GAFF: GaffConfig;
export declare class Gaff implements Module {
    readonly name = "gaff";
    readonly config: GaffConfig;
    readonly storylets: Map<string, StoryletDef>;
    private deckCards;
    private metricFns;
    private w;
    constructor(cfg?: Partial<GaffConfig>);
    init(): State;
    private get st();
    attach(w: World): void;
    storylet(def: StoryletDef): this;
    /** A deck of storylet ids, drawn without repeating back to back. */
    deck(id: string, cards: Id[]): this;
    /** A number Gaff can read ('metric:<name>' in conditions). */
    defineMetric(name: string, fn: (w: World) => number): this;
    metric(name: string): number;
    /** A subject's intensity, made if missing (inside the simulation). */
    private int;
    /** A subject's intensity for reading: one never bumped is building from 0 (and isn't made). */
    private look;
    intensity(subject?: string): number;
    phase(subject?: string): Phase;
    /** Raises (or lowers) a subject's intensity (from the game: recorded). */
    bump(subject: string, by: number): void;
    applyBump(subject: string, by: number): void;
    private stepPhases;
    /** Could a storylet fire now? (Looking only: changes nothing.) */
    eligible(def: StoryletDef): boolean;
    private ready;
    hour(): void;
    /** Draws a card from a deck (from the game: recorded): shuffled, no repeat of the last one. */
    draw(deck: string): Id | undefined;
    /** Draws a card inside the simulation. */
    applyDraw(deck: string): Id | undefined;
    /** Makes a storylet fire now (the game can force one: recorded). */
    trigger(id: Id, place?: Id | null): void;
    private fire;
    /** A place with a tag that nobody is at and the game isn't showing. */
    unseenPlace(tag: string): Id | null;
    /** What's fired recently. */
    history(): Array<{
        t: number;
        id: Id;
        place: Id | null;
    }>;
}
export {};
