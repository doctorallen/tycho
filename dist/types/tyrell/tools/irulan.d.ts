import type { Id, LogEntry, Minutes } from '../core/types';
import type { World } from '../core/world';
/** A piece of a sentence: words, or a person or a place by its id. */
export interface Part {
    text: string;
    person?: Id;
    place?: Id;
}
/** Something that happened, told as a sentence. */
export interface Beat {
    /** When it began (for an action someone walked to, when they set out). */
    t: Minutes;
    /** When it ended, for an action or a talk that did. */
    end?: Minutes;
    /** Whom it's about: the subject, or several people told as one ("Kofi and Sam"). Empty for what happened to nobody in particular (the rain). */
    who: Id[];
    /** Others in it: the target, the company kept, the other side of a talk. */
    with: Id[];
    /** Where, when it's known. */
    place?: Id;
    /** The kinds of entry it was made from. */
    kinds: string[];
    /** How much it matters, 0..1: the weight of its kinds, up to twice that for what's rare among the entries told. */
    score: number;
    /** The sentence. */
    text: string;
    /** The sentence in parts, the people and places in it tagged. */
    parts: Part[];
    /** The entries it was made from, oldest first. */
    entries: LogEntry[];
}
/** A storyline: the beats of one matter (a deed and what came of it) or between the same people, in order. */
export interface Thread {
    /**
     * What it's about: 'did:sam:theft' (a deed, and its witnesses, gossip and
     * reports), 'pair:dev+sam' (what passed between two people), 'trap:t1',
     * 'taint:x2', 'harm:5'. Several when they turned out to be one story.
     */
    keys: string[];
    /** A title: "Sam's theft", "Dev and Sam at odds". */
    title: string;
    /** The title in parts. */
    parts: Part[];
    /** The people in it, the most involved first. */
    people: Id[];
    /** Its beats, in order: everything about its matters whatever it scores, and what its people felt along the way. */
    beats: Beat[];
    t: Minutes;
    end: Minutes;
    /** Its best beat's score. */
    score: number;
}
export interface TellOptions {
    /** Only the beats about this person: theirs, or with them in it. */
    who?: Id;
    /** Leave out beats scoring below this. Default 0 (beats, tell), 0.3 (day), 0.4 (threads). */
    min?: number;
    /** Weights by kind of entry, over Irulan's own (IRULAN_WEIGHTS); 0 leaves a kind out. */
    weights?: Record<string, number>;
    /** People who matter more to the story (the player, their friends): a beat with them in it scores this many times more, up to 1. */
    focus?: Record<Id, number>;
    /** The parts of the day tell's paragraphs are made by: [the hour it starts, its name], earliest first. */
    periods?: Array<[number, string]>;
    /** A day's name, for tell's paragraphs. Default 'Day n'. */
    day?: (day: number) => string;
}
/** What a game's words see: names for people, groups and places, and the world. */
export interface WordsContext {
    world: World;
    /** A person, a group or a place by its name ('someone' for none), tagged for the beat's parts: put it in your words as it is. */
    name(id: unknown): string;
    /** A place as someone would say it, tagged the same way: 'home' for their own, 'Mara's place' for another's, else its name. */
    place(id: Id | undefined, who?: Id): string;
}
/**
 * A game's words for a kind of entry: what follows the person's name ("rain
 * set in" for an entry with no person, without a full stop), null to leave
 * the entry out, or undefined for Irulan's own words.
 */
export type WordsFn = (e: LogEntry, ctx: WordsContext) => string | null | undefined;
/**
 * How much each kind of entry matters, 0..1, before what's rare counts for
 * more: routine low, the turns of a day in the middle, what a story is made
 * of high. 0 leaves a kind out (the day's turning is told by the paragraphs,
 * a plan by what's done about it). A kind not here weighs 0.3.
 */
export declare const IRULAN_WEIGHTS: Readonly<Record<string, number>>;
export declare class Irulan {
    private w;
    private wordsFor;
    private ctx;
    constructor(w: World);
    /** Gives a kind of entry the game's own words (a definition: declare it again on every start). */
    words(kind: string, fn: WordsFn): this;
    /**
     * The entries told as beats, in the order they happened. `entries` is a
     * list (the game's own, kept from the 'log' events, to reach back further
     * than the log keeps) or a time to tell the log from.
     */
    beats(entries: LogEntry[] | Minutes, opts?: TellOptions): Beat[];
    /**
     * The entries told as paragraphs, one for each part of the day, each
     * starting with when: "Day 0, early morning. Mara went to Mara's Cafe and
     * baked bread. ..."
     */
    tell(entries: LogEntry[] | Minutes, opts?: TellOptions): string[];
    /** Someone's day as one paragraph: the beats about them since a time (or from a list of entries), the routine left out (min 0.3). */
    day(who: Id, since: LogEntry[] | Minutes, opts?: TellOptions): string;
    /** The headlines: the `limit` beats that matter most (default 5), in the order they happened. For a recap after time away. */
    recap(entries: LogEntry[] | Minutes, opts?: TellOptions & {
        limit?: number;
    }): Beat[];
    /**
     * The storylines running through the entries, the one that matters most
     * first, and the beats that belong to none (rest). A thread is the beats of
     * one matter (a deed, a trap, a taint, a harm: what was done, who saw it,
     * who was told and who reported it) or of what passed between two people
     * (talks, grudges, feuds, deeds), joined when they turn out to be one
     * story (the fight in a quarrel), with what its people felt along the way.
     * Everything about its matters is in it whatever it scores; a thread needs
     * two beats and one scoring `min` (default 0.4); the rest are what score
     * `min` too.
     */
    threads(entries: LogEntry[] | Minutes, opts?: TellOptions): {
        threads: Thread[];
        rest: Beat[];
    };
    /** When a time is, as tell's paragraphs say it: "Day 0, early morning". */
    when(t: Minutes, opts?: TellOptions): string;
    /** Whether a beat is about someone: theirs, with them in it, or naming them. */
    private concerns;
    private fold;
    /** How much a clause matters, before what's rare counts. */
    private weigh;
    /** A minute's clauses, as one: "gave up on dinner at home, was frustrated, then read at home for an hour". What happened comes first, then how they felt, then what they did. */
    private join;
    /**
     * What each beat is about, for threads: its matters (a deed, a trap, a
     * taint, a harm), or when it's about none, the two people it passed
     * between. A crime seen, told or reported without knowing who did it
     * ('did:someone:theft') is the latest crime of its kind done before it,
     * whoever did that.
     */
    private matters;
    /** Whether a beat holds a hostile talk (Bree's kinds tagged 'hostile'). */
    private hostile;
    /**
     * What a beat's entries are about, for threads, an entry at a time (what
     * one entry names is linked): deeds ('did:sam:theft', a crime done, seen,
     * told or reported, or a talk that is one, like a fight), traps, taints and
     * harms by their ids, and the two people something passed between
     * ('pair:dev+sam'). A harm by a trap is linked to the trap sprung in the
     * same beat, and one by a taint to its maker's ('taintby:sam').
     */
    private keys;
    /** The people a key names: the two of a pair, a deed's doer, a trap's setter and a taint's maker (from the beats). */
    private keyPeople;
    /** A thread's title: its trap or taint ("Pip's snare"), its deed ("Sam's theft"), or its two people ("Dev and Sam at odds"). */
    private title;
    /** A person, a group or a place by its name, people and places tagged for the parts. */
    private name;
    private isHome;
    private placeName;
    /** "at home", "at Mara's Cafe". */
    private at;
    /** "home", "to Mara's Cafe". */
    private to;
    /** A walk not followed by anything told with it. */
    private went;
    /** An action from start to finish: "went to Mara's Cafe and ate, with Ines there". */
    private acted;
    /** A talk (Bree): "argued with Lena at Mara's Cafe, which turned into a fight, and it ended in a row". */
    private talked;
    /** Any other entry: the game's words, Irulan's own, or describe's; null leaves it out. */
    private say;
}
