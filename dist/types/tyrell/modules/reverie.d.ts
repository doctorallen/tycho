import type { Module } from '../core/module';
import type { Candidate, Consideration, Doing, Id, PersonState, PlaceSpec, Value } from '../core/types';
import type { World } from '../core/world';
export interface FeelingDef {
    id: Id;
    label?: string;
    /** How much it lifts (+) or sinks (-) the mood, -1..1. */
    weight: number;
    /** How long it lasts. */
    minutes: number;
    /** How many can stack (default 1: a new one refreshes the old). */
    stack?: number;
    /** Each extra stack counts this much of the one before (default 0.8). */
    stackMul?: number;
    /** The emotion it feeds: 'happy', 'angry', 'sad', 'scared', 'tense', 'guilty'... */
    emotion?: string;
    /** Stress it adds when felt (default: half its weight, if negative). */
    stress?: number;
    /** While felt, actions with these tags weigh this much more or less: { comfort: 1.5 }. */
    boost?: Record<string, number>;
}
export interface BreakDef {
    id: Id;
    /** 'minor', 'major' or 'extreme'. */
    level: 'minor' | 'major' | 'extreme';
    /** The action or task they break into. */
    do: Id;
    at?: PlaceSpec;
    /** How likely this break is for a person (a temperament), against the others at its level. */
    weight?: Consideration[];
    /** The feeling afterward. Default 'catharsis'. */
    after?: Id;
    label?: string;
}
export interface MemoryKindDef {
    id: Id;
    /** 1..10. Default 5. */
    importance?: number;
    /** Trait shifts if it becomes a core memory: { courage: -0.1 }. */
    shifts?: Record<string, number>;
    label?: string;
}
export interface Feeling {
    id: Id;
    t: number;
    until: number;
    w: number;
    cause?: string;
}
export interface Memory {
    k: Id;
    t: number;
    imp: number;
    recalls: number;
    about?: Id;
    place?: Id;
    text?: string;
    core?: boolean;
}
export interface Belief {
    key: string;
    v: Value;
    src: 'saw' | 'told' | 'assumed' | 'knew';
    from?: Id;
    t: number;
    str: number;
    hops: number;
    silenced?: boolean;
}
export interface FileEntry {
    verb: string;
    t: number;
    what?: string;
}
export interface PersonFile {
    met: number;
    first: number;
    last: number;
    tally: Record<string, number>;
    notes: FileEntry[];
}
export interface Shift {
    trait: string;
    by: number;
    cause: string;
    t: number;
}
interface State {
    f: Record<Id, Feeling[]>;
    m: Record<Id, Memory[]>;
    b: Record<Id, Record<string, Omit<Belief, 'key'>>>;
    files: Record<Id, Record<Id, PersonFile>>;
    st: Record<Id, [number, number, number]>;
    checked: Record<Id, number>;
    shifts: Record<Id, Shift[]>;
}
export interface ReverieConfig {
    /** Mood with no feelings and needs met. Default 0.6. */
    base: number;
    /** How much unmet needs drag the mood. Default 0.25. */
    needWeight: number;
    /** An emotion shows only above this strength. Default 0.08. */
    emotionFloor: number;
    /** Break thresholds: [mood below, mean days between breaks]. */
    minor: [number, number];
    major: [number, number];
    extreme: [number, number];
    memoryCap: number;
    coreCap: number;
    /** Memory strength lost per game hour (Generative Agents used 0.995). */
    memoryDecay: number;
    /** Beliefs weaker than this are forgotten. */
    beliefFloor: number;
    /** Belief strength kept per day. */
    beliefDecay: number;
    /** Stress half-lives in minutes. */
    stressShort: number;
    stressLong: number;
}
export declare const DEFAULT_REVERIE: ReverieConfig;
export declare class Reverie implements Module {
    readonly name = "reverie";
    readonly config: ReverieConfig;
    readonly feelingDefs: Map<string, FeelingDef>;
    readonly breakDefs: Map<string, BreakDef>;
    readonly memoryKinds: Map<string, MemoryKindDef>;
    private w;
    constructor(cfg?: Partial<ReverieConfig>);
    init(): State;
    private get st();
    attach(w: World): void;
    feeling(def: FeelingDef): this;
    breakdown(def: BreakDef): this;
    memoryKind(def: MemoryKindDef): this;
    /** Gives someone a feeling (from the game: recorded for time walk). */
    feel(id: Id, feeling: Id, cause?: string): void;
    /** Gives a feeling inside the simulation (modules use this; the game uses feel()). */
    applyFeel(id: Id, feeling: Id, cause?: string | null): void;
    /** Active feelings with their labels and weights. */
    feelings(id: Id): Array<{
        id: Id;
        label: string;
        weight: number;
        until: number;
        emotion?: string;
        cause?: string;
    }>;
    /** Mood, 0 (miserable) to 1 (elated): feelings, less unmet needs. */
    mood(id: Id): number;
    /** The one named emotion showing now ('fine' when nothing stands out). */
    emotion(id: Id): string;
    /** Stress now: short-term and long-term together, 0..1. */
    stress(id: Id): number;
    stressParts(id: Id): [number, number];
    addStress(id: Id, amount: number): void;
    /** Remembers something (from the game: recorded for time walk). */
    remember(id: Id, m: Partial<Memory> & {
        k: Id;
    }): void;
    /** Remembers inside the simulation (modules use this). */
    applyRemember(id: Id, m: Partial<Memory> & {
        k: Id;
    }): void;
    /** How strongly a memory is held now: importance, faded by time. Core memories don't fade. */
    strength(m: Memory): number;
    /** Someone's memories, strongest first. */
    memories(id: Id): Memory[];
    /**
     * Brings memories to mind: the strongest matching ones (about someone, of
     * a kind). Recalling an important memory often enough can make it a core
     * memory that changes them. From the game: recorded for time walk.
     */
    recall(id: Id, match?: {
        about?: Id;
        k?: Id;
        place?: Id;
    }, n?: number): Memory[];
    /** Recalls inside the simulation (copies of the memories recalled). */
    applyRecall(id: Id, match?: {
        about?: Id;
        k?: Id;
        place?: Id;
    }, n?: number): Memory[];
    private maybeCore;
    /** How a person's traits have shifted, and why. */
    shifts(id: Id): Shift[];
    /** Gives someone a belief (from the game: recorded for time walk). */
    believe(id: Id, key: string, v: Value, src?: Belief['src'], from?: Id, str?: number): void;
    /** Changes a belief inside the simulation (modules use this). */
    applyBelieve(id: Id, key: string, v: Value, src: Belief['src'], from?: Id | null, str?: number, hops?: number): void;
    forget(id: Id, key: string): void;
    /** What someone believes about a key (undefined if they don't know or have forgotten). */
    belief(id: Id, key: string): Value | undefined;
    /** The full belief record. */
    beliefRecord(id: Id, key: string): Belief | undefined;
    /** What someone takes to be true: their belief, or the world's fact if they have none. */
    thinks(id: Id, key: string): Value;
    /** All of someone's beliefs, strongest and newest first. */
    beliefs(id: Id): Belief[];
    /** Is someone's belief true? (null when the world has no fact to check it against) */
    accurate(id: Id, key: string): boolean | null;
    /** Marks a belief as one they won't pass on (a promise kept; from the game: recorded). */
    silence(id: Id, key: string, on?: boolean): void;
    /** Marks a belief as one they won't pass on, inside the simulation (paid or scared off). */
    applySilence(id: Id, key: string, on?: boolean): void;
    /** Someone's file on someone else (the player, usually). */
    file(id: Id, subject: Id): PersonFile | undefined;
    /** Notes a deed in someone's file on someone, inside the simulation (the game reports deeds with world.did). */
    applyNote(id: Id, subject: Id, verb: string, what?: string): void;
    candidates(p: PersonState, out: Candidate[]): void;
    consider(p: PersonState, c: Candidate): Array<[string, number]> | void;
    started(p: PersonState, d: Doing): void;
    ended(p: PersonState, d: Doing, frac: number, interrupted: boolean): void;
    did(actor: Id, verb: string, data: Record<string, Value>): void;
    met(a: PersonState, b: PersonState): void;
    day(): void;
    removed(p: PersonState): void;
}
export {};
