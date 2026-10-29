import type { Module } from '../core/module';
import type { Candidate, Consideration, Doing, Id, PersonState, QueueItem, Value } from '../core/types';
import type { World } from '../core/world';
/** Why a harm happened, which decides what it leaves: meant, in self-defense, careless, or nobody's doing. */
export type Intent = 'meant' | 'defense' | 'careless' | 'accident';
/** How a means is used: up close, thrown, shot, cast, coated onto another, dosed into food, or set as a trap. */
export type MeansUse = 'strike' | 'throw' | 'shoot' | 'cast' | 'coat' | 'dose' | 'set';
/**
 * What harm is done with: a weapon, a spell, a poison, a trap. Declared once
 * and shared with the game's own (Tycho.harm plays the on-screen fields; the
 * rest are kept and ignored). A character holds one as a good of the same id.
 */
export interface MeansDef {
    id: Id;
    label?: string;
    /** The kinds of harm it does: 'blunt', 'cut', 'poison'... */
    kinds?: string[];
    /** How it's used: 'strike', 'throw', 'shoot', 'cast', 'coat', 'dose' or 'set'. */
    use?: MeansUse;
    /** How bad its harm is, 0..1: a blow with it adds this to a fist's; a trap or a dose of it harms this much. */
    severity?: number;
    /** The course a dose of it starts (a poison). */
    course?: Id;
    /** The game's own fields (the move, the blow, the trigger...). */
    [field: string]: unknown;
}
/** What a harm leaves on the body: by kind, how severe, and what it was done with; the first that fits. */
export interface WoundDef {
    id: Id;
    label?: string;
    /** The kinds of harm it's for. None: any. */
    kinds?: string[];
    /** The severities it's for, [least, most]. None: any. */
    at?: [number, number];
    /** What it was done with (a means or an item). None: anything. */
    what?: string | string[];
    /** How it came ('blow', 'trap', 'dose'...). None: any way. */
    via?: string[];
    /** The Athelas course it runs. */
    course: Id;
}
/** A kind of trap. */
export interface TrapDef {
    id: Id;
    label?: string;
    /** The kind of harm it does. Default: its means' first kind, or 'trap'. */
    kind?: string;
    /** How bad, 0..1. Default: its means' severity, or 0.2. */
    severity?: number;
    /** Hidden from whoever comes by (default true); one that isn't catches fewer, and is seen by whoever it doesn't catch. */
    hidden?: boolean;
    /** How many it catches before it's spent. Default 1. */
    uses?: number;
    /** Its chance to catch someone who comes to or does something at its place off screen. Default config.catch. */
    catch?: number;
}
/** A harm: who it struck, who did it, what kind and how bad, how it came, why, with what, where, and who saw it land. */
export interface Harm {
    to: Id;
    /** Who did it: a person, 'player', or null (nobody: a rockfall). */
    by?: Id | null;
    /** The game's own kind ('blunt', 'cut', 'burn', 'poison'...). Default: what it was done with's first kind, or 'harm'. */
    kind?: string;
    /** How bad, 0..1: a slap 0.05, a beating 0.5, a killing blow 1. */
    severity?: number;
    /** How it came: 'blow', 'trap', 'dose', 'fall', 'fire'... Default 'blow'. */
    via?: string;
    /** Default 'meant' if someone did it, else 'accident'. */
    intent?: Intent;
    /** The hazard it came from (a trap's or a taint's id). */
    cause?: string;
    /** What it was done with: a means, an item, a trap's kind. */
    what?: string;
    /** Where. Default: where the one struck is. */
    place?: Id | null;
    /** Who saw it land. Default: everyone at the place but the two of them. */
    seenBy?: Id[];
    /** The course it starts, over the wound it would leave (a dose's own). */
    course?: Id;
}
/** A harm as the game sees it (event 'morgul:harm'). */
export interface HarmView {
    id: number;
    t: number;
    to: Id;
    by: Id | null;
    kind: string;
    severity: number;
    via: string;
    intent: Intent;
    place: Id | null;
    seenBy: Id[];
    cause?: string;
    what?: string;
    /** The wound it left, and its course. */
    wound?: Id;
    course?: Id;
    /** Noticed yet (a dose isn't, until its course tells). */
    shown: boolean;
    /** How hurt the one struck is now. */
    hurt: number;
    /** A blow in a fight: the Bree exchange. */
    exchange?: number;
}
/** A blow in a fight by numbers, as a Bree turn carries it (`turn.harm`). */
export interface Blow {
    /** The harm it was. */
    id: number;
    by: Id;
    to: Id;
    kind: string;
    severity: number;
    what?: string;
    /** How hurt the one struck is now. */
    hurt: number;
    /** The fight ends with it: the one struck went down, yielded, or walked off. */
    end?: 'down' | 'yielded' | 'left';
}
/** A character's answer to harm from the player (event 'morgul:respond'). */
export interface Response {
    id: Id;
    to: Id;
    act: 'fight' | 'flee' | 'yield' | 'help';
    /** Their odds against the other, and how hurt they are. */
    odds: number;
    hurt: number;
    /** The first harm between them a while: the fight starts. */
    start: boolean;
    /** Who they'd call on (act 'help'). */
    help?: Id[];
    /** How appealing each answer was. */
    weights: Record<string, number>;
}
export interface MorgulConfig {
    /** How readily anyone chooses an action or task tagged harmTag: its weight, times it. 0: nobody ever does. Default 1. */
    violence: number;
    /** How often harm at its worst kills: hurt at killAt kills with deathChance times it; a wound's phase that ends in death, with it. 0: nobody dies of harm. Default 0. */
    lethality: number;
    /** How strongly harm turns into a wish for revenge. Default 1. */
    vengeance: number;
    /** How much people steer clear of danger they know of. Default 1. */
    caution: number;
    /** How fast wounds heal: a wound's phases last 1 / healing as long (under 0.01 taken as 0.01). Default 1. */
    healing: number;
    /** How readily people suspect someone of harm they didn't see, and how strongly. Default 1. */
    suspicion: number;
    /** Hurt at which someone goes down. Default 0.8. */
    downAt: number;
    /** Minutes they lie there before they come round, unless someone helps them up: [min, max]. Default [20, 60]. */
    downMinutes: number[];
    /** The rank lying down comes at: above everything (a break is 4). Default 5. */
    downRank: number;
    /** The action lying down is (Morgul declares it, unless the game has one by this id). Default 'down'. */
    down: string;
    /** The action fighting is: both fighters are held in it while a fight by numbers lasts (declared like down). Default 'fighting'. */
    fighting: string;
    /** The rank fighting comes at: above directives and breaks, under lying down. Default 4.5. */
    fightRank: number;
    /** Hurt at which harm is at its worst, and may kill. Default 1. */
    killAt: number;
    /** The chance harm at its worst kills, times lethality. Default 0.5. */
    deathChance: number;
    /** The ways of harm whose victim sees who did it (otherwise they suspect). Default ['blow', 'throw', 'shoot', 'cast']. */
    direct: string[];
    /** The share of the grudge, the regard lost, the fear and onlookers' blame each intent brings. Default meant 1, careless 0.4, accident 0.1, defense 0. */
    intents: Record<string, number>;
    /** A victim's grudge (Bree): severity × this × the intent's share. Default 1.5. */
    grudge: number;
    /** A victim's regard lost for whoever did it: severity × this × the share. Default 0.6. */
    regard: number;
    /** Fear of whoever did it: severity × this × the share × (1 + (0.5 - courage) × 2 × fearCourage). Defaults 1 and 0.5. */
    fear: number;
    fearCourage: number;
    /** Fear of the place it happened: severity × this. Default 1. */
    wary: number;
    /** Fear, fear of places, and what they hold against someone from harm, lost a day (the last times 0.5 + forgiveness; fear times 0.5 + courage). Default 0.05. */
    fade: number;
    /** A victim whose temper and nerve (temper × 0.6 + courage × 0.4) are at least this is furious, else scared. Default 0.5. */
    angerAt: number;
    /** A harm at least this bad leaves them shaken. Default 0.15. */
    shakenAt: number;
    /** The importance of the victim's memory: memory + severity × memorySeverity. Defaults 3 and 6. */
    memory: number;
    memorySeverity: number;
    /** Meant harm between people of two households sets the households feuding by severity × this (Bree). 0: never. Default 0. */
    feud: number;
    /** Harm someone does to someone they held harm against eases it by severity × this (revenge sated). Default 2. */
    sated: number;
    /** How strongly an onlooker believes what they saw. Default 0.8. */
    witnessStrength: number;
    /** The importance of an onlooker's memory: witnessMemory + severity × memorySeverity / 2. Default 2. */
    witnessMemory: number;
    /** An onlooker's regard lost for whoever did it: severity × this × the share. Default 0.3. */
    witnessRegard: number;
    /** The Wormtongue crime each intent is, and a killing ('killed'): { meant: 'assault', careless: 'negligence', killed: 'murder' }. Default none. */
    crimes: Record<string, string>;
    /** A trap's chance to catch someone, for one with no `catch`. Default 0.3. */
    catch: number;
    /** The careful are caught less: × (1 - (careful - 0.5) × 2 × this). Default 0.5. */
    careful: number;
    /** A trap that isn't hidden catches at this share of its chance. Default 0.3. */
    seenCatch: number;
    /** Someone who knows of a trap or a taint set for someone warns them when they meet, if their regard for them is at least this. Default 0.2. */
    warnAt: number;
    /** Action tags that eat from a place's pot (a taint with no item). Default ['food']. */
    eats: string[];
    /** A dose's severity, for a taint with none whose means says none. Default 0.5. */
    dose: number;
    /** The chance someone who learns of a harm they didn't see suspects someone, times suspicion. Default 0.8. */
    suspect: number;
    /** The evidence: being told who set or dosed it, by the belief's strength (whoever saw it, knows). Default 2. */
    suspectTold: number;
    /** ...having served it (the place's owner, staff on shift there). Default 0.6. */
    suspectServed: number;
    /** ...a grudge against the victim, by its strength. Default 1.5. */
    suspectGrudge: number;
    /** ...being about when it happened. Default 0.3. */
    suspectAbout: number;
    /** A suspicion weighs 1 + dislike × suspectSpite (a scapegoat), and 1 - liking × suspectLoyal (never under 0.1). Defaults 1 and 0.6. */
    suspectSpite: number;
    suspectLoyal: number;
    /** A suspicion's strength: its weight × this × suspicion, at most suspectMax; under suspectFloor it isn't held. Defaults 0.5, 0.9 and 0.1. */
    suspectStrength: number;
    suspectMax: number;
    suspectFloor: number;
    /** The Bree kinds that are fights by numbers: ids or 'tag:<tag>'. Default ['fight']. */
    fights: string[];
    /** Most blows in a fight. Default 12. */
    blows: number;
    /** A fighter's might: considerations on them (strength, size, skill, nerve), multiplied. Default none (1). */
    might: Consideration[];
    /** A bare blow's severity, and its kind. Defaults 0.1 and 'blunt'. */
    fist: number;
    fistKind: string;
    /** A held means adds its severity times meansBlow to a blow, and times meansMight to might (× (1 + severity × meansMight)). Defaults 0.5 and 1. */
    meansBlow: number;
    meansMight: number;
    /** Might lost a point of hurt: × (1 - hurt × hurtMight). Default 0.6. */
    hurtMight: number;
    /** A blow's severity, give or take this share. Default 0.5. */
    blowSpread: number;
    /** A fighter yields at this much hurt, at middling nerve: × (1 + (courage - 0.5) × yieldCourage). Defaults 0.5 and 1. */
    yieldAt: number;
    yieldCourage: number;
    /** After a blow that doesn't end it, the one struck walks off with this chance times how near they are to yielding (hurt over the hurt they'd yield at). Default 0.4. */
    walkOff: number;
    /** The fact the player's might is read from (default 1 when it isn't set). Default 'might:player'. */
    playerMight: string;
    /** How appealing each answer to the player's harm is, over its shape (fight, flee, yield, help). Default 1 each. */
    respond: Record<string, number>;
    /** Someone there whose regard for them is at least this can be called on for help. Default 0.2. */
    helpFrom: number;
    /** Minutes without harm between them after which the next starts a fight afresh. Default 30. */
    fightGap: number;
    /** Minutes someone who chose to flee, or was frightened off, keeps wanting to get away (and before fear sends them off again). Default 30. */
    fleeMinutes: number;
    /** The tags of harmful actions (violence), of fleeing, and of tending the hurt. Defaults 'harm', 'flee' and 'care'. */
    harmTag: string;
    fleeTag: string;
    careTag: string;
    /** The task revenge is: offered, aimed at whoever they want it on, when they want it enough. Default 'avenge'. */
    avenge: string;
    /** What they hold against someone from harm, times vengeance and their temper (1 + (temper - 0.5) × 2 × vengeTemper), at which revenge is an option. Defaults 0.3 and 0.5. */
    vengeAt: number;
    vengeTemper: number;
    /** Revenge weighs this times how much they want it; a harmful action aimed at whoever they want it on, 1 + that. Default 0.5. */
    vengePull: number;
    /** Fear of someone there times poor odds against them, at which someone wants to leave. Default 0.25. */
    fleeAt: number;
    /** Options where someone they fear is weigh 1 - fear × (1 - odds) × fleePlace; fleeing weighs 1 + fear × fleePull. Defaults 0.8 and 2. */
    fleePlace: number;
    fleePull: number;
    /** Options at a place they know is dangerous weigh 1 - danger × cautionPlace × caution. Default 0.7. */
    cautionPlace: number;
    /** Tending someone hurt weighs 1 + hurt × carePull × (0.5 + regard); the one tended gains `cared` regard for them. Defaults 2 and 0.03. */
    carePull: number;
    cared: number;
    /** None of these weighs an option under this. Default 0.1. */
    floor: number;
    /** Harms kept, for history and suspicion (and every one not noticed yet). Default 50. */
    recent: number;
    /** The terms trait roles are read from (temper, courage, careful, forgiveness): over Bree's mapping, else trait.<role>. Default none. */
    traits: Record<string, string>;
}
export declare const DEFAULT_MORGUL: MorgulConfig;
export declare class Morgul implements Module {
    readonly name = "morgul";
    readonly config: MorgulConfig;
    readonly knobs: {
        readonly violence: "person";
        readonly lethality: "person";
        readonly vengeance: "person";
        readonly caution: "person";
        readonly healing: "person";
        readonly suspicion: "person";
    };
    readonly meansDefs: Map<string, MeansDef>;
    readonly woundDefs: Map<string, WoundDef>;
    readonly trapDefs: Map<string, TrapDef>;
    private w;
    /** Where someone knows of danger, as of a moment (worked out again from the state). */
    private dangerCache;
    constructor(cfg?: Partial<MorgulConfig>);
    private get st();
    private mut;
    /** The config in force: as declared, under any world.tune. */
    private get c();
    /** A headline knob for someone: the world's, times their own. */
    knob(name: 'violence' | 'lethality' | 'vengeance' | 'caution' | 'healing' | 'suspicion', id: Id | null | undefined): number;
    /** Has the game declared anything (a means, a wound, a trap)? Until then Morgul weighs nothing. */
    get used(): boolean;
    attach(w: World): void;
    /** What harm is done with (shared with the game's own: the off-screen fields are read here). */
    means(def: MeansDef): this;
    /** What a harm leaves on the body: by kind, how severe, with what; the first that fits. */
    wound(def: WoundDef): this;
    /** A kind of trap. */
    trap(def: TrapDef): this;
    /** The actions lying down and fighting are: declared once a wound is, unless the game has its own. */
    private declareDown;
    /** Is someone in a fight by numbers (a Bree exchange of a kind that fights)? */
    inFight(id: Id): boolean;
    /**
     * A fight by numbers breaks out (Bree calls this): both fighters stop what
     * they're doing and fight, just after (whoever started it with an action of
     * their own keeps at it).
     */
    brawl(who: Id[], kind: Id): void;
    /** A fight by numbers is over (Bree calls this): whoever was fighting thinks again, just after. */
    parted(who: Id[]): void;
    /** Someone's nature in a role (temper, courage, careful, forgiveness): Morgul's mapping, else Bree's, else trait.<role>. */
    nature(p: PersonState, role: string): number;
    /** How hurt someone is: the severities of their open wounds, each by how much its phase still hurts. */
    hurt(id: Id): number;
    /** How bad someone's open wounds of a kind are (any kind, with none). */
    private wounded;
    /** Someone's open wounds: which, the course and phase, how bad, how much it still hurts, who gave it, tended or not. */
    wounds(id: Id): Array<{
        wound: Id;
        course: Id;
        phase: string;
        severity: number;
        hurts: number;
        by: Id[];
        tended: number;
        quiet: boolean;
    }>;
    /** Is someone down? */
    isDown(id: Id): boolean;
    /** A faded strength: what's left of [strength, since] at this pace a day. */
    private faded;
    private forgiving;
    private brave;
    /** What a holds against b from harm b did them (as a believes), 0..1, fading. */
    held(a: Id, b: Id): number;
    /** a's fear of b, 0..1, fading. */
    fearOf(a: Id, b: Id): number;
    /** a's fear of a place (where they were hurt), 0..1, fading. */
    private waryOf;
    /** How much a wants revenge on b: what they hold against them, times vengeance and their temper. */
    vengeance(a: Id, b: Id): number;
    /** How strongly a believes b did harm (to anyone): their belief that b did it, as harm or as one of the crimes harm is. */
    suspicionOf(a: Id, b: Id): number;
    /** Who someone suspects (or knows) of harm: the people they believe did it, strongest first. */
    suspects(id: Id): Array<{
        id: Id;
        strength: number;
        to: Value;
        src: string;
    }>;
    /** The means someone holds (as goods of the same id) that arm them, best first; with a kind, of that kind. */
    private arms;
    private bestMeans;
    /** How many means that arm them someone holds. */
    armed(p: PersonState): number;
    /** Someone's might in a fight: the game's considerations, what they hold, less what they've been hurt. The player's is the game's fact. */
    might(id: Id): number;
    /** a's odds against b: the chance a blow between them is a's, 0..1. */
    odds(a: Id, b: Id): number;
    /** The hurt at which someone yields: yieldAt, sooner for the timid. */
    private yieldAt;
    /** A stream of Morgul's own: its draws leave people's own streams as they were. */
    private stream;
    /** Who's at a place (its outermost), but these. */
    private present;
    /** The wound a harm leaves: the first declared that fits. */
    private woundFor;
    /** A harm (from the game, on screen: recorded, and it applies at once). Returns it as it stands, or null if nobody was struck. */
    harm(h: Harm): HarmView | null;
    /** Records a harm inside the simulation: the body now, the mind now or when it shows. */
    applyHarm(h: Harm & {
        ex?: number;
        about?: Id[];
        served?: Id[];
    }): HarmView | null;
    private view;
    /** Harms kept (the last config.recent, and every one not noticed yet), newest last: someone's (as victim or doer), with an id. */
    harms(id?: Id): HarmView[];
    private prune;
    /** Changes what a holds against b (negative eases it). */
    private hold;
    private frighten;
    private warn;
    /**
     * The mind's part of a harm, once it's noticed: the victim's feelings,
     * memory and belief; for a harm they saw done, a grudge, fear and regard;
     * onlookers' beliefs, memories and regard, and a crime; and for harm
     * nobody saw done, suspicion.
     */
    private notice;
    /**
     * Someone comes to believe `doer` hurt `victim` (as strongly as `str`):
     * the belief; and for the victim, what they hold against them, a grudge
     * (Bree) by the severity and the intent, fear, less regard, a note in
     * their file. A scapegoat is blamed the same way.
     */
    private blame;
    /**
     * Someone learns of a harm they didn't see done: whoever they saw set or
     * serve it, they know; otherwise, by chance, they suspect someone, by the
     * evidence (believing they set or served it, having served it, a grudge
     * against the victim, being about), their dislike of them and their
     * liking. It can be wrong.
     */
    private suspect;
    private told;
    /** The belief that says who set a trap or dosed a taint. */
    private actKey;
    /** After a harm: down past downAt, and at the worst, maybe dead. */
    private check;
    private goDown;
    /** Someone gets up: they came round, or someone helped them. */
    private applyUp;
    /** Someone tends someone (from the game: recorded): their wounds' tended mark (Athelas), and up if they're down. */
    tend(id: Id, by?: Id): void;
    /** Tends inside the simulation: Athelas's mark on their courses (or one), and, from Morgul, up if down, a feeling and a little regard. */
    applyTend(id: Id, by?: Id, course?: Id): void;
    /** A trap's kind: its own definition, or a means that's set. */
    private trapDef;
    /**
     * Sets a trap (from the game: recorded): a kind, at a place, by someone (or
     * nobody), for someone, seen by whoever (default everyone there), and, if
     * the game says, who was about (by its sight: evidence once it springs).
     * Returns its id.
     */
    set(kind: Id, o: {
        by?: Id | null;
        place: Id;
        for?: Id;
        seenBy?: Id[];
        about?: Id[];
    }): string | null;
    /** Sets a trap inside the simulation. */
    applySet(kind: Id, o: {
        by: Id | null;
        place: Id | null;
        for?: Id;
        seenBy?: Id[];
        about?: Id[];
    }): string | null;
    /** Someone learns a trap is there (and who set it, if they saw it set). */
    private learnTrap;
    /** Does someone know a trap is there? */
    private knowsTrap;
    /** The traps set (at a place, or everywhere): id, kind, place, who set it, for whom, uses left, who knows. */
    traps(place?: Id): Array<{
        id: string;
        kind: Id;
        place: Id;
        by: Id | null;
        for?: Id;
        uses: number;
        t: number;
        known: Id[];
    }>;
    /**
     * A trap caught someone on screen, or the player (from the game: recorded),
     * seen by whoever (default everyone there), with whoever else was about if
     * the game says (its sight: evidence for suspicion, with whoever was about
     * when it was set).
     */
    spring(trap: string, id: Id, seenBy?: Id[], about?: Id[]): void;
    /** A trap catches someone (or the player), inside the simulation: the harm, and it's spent a use. */
    applySpring(trap: string, id: Id, seenBy?: Id[], about?: Id[]): HarmView | null;
    /** A trap is disarmed (from the game: recorded), by someone if given. */
    disarm(trap: string, by?: Id): void;
    /** Disarms a trap inside the simulation. */
    applyDisarm(trap: string, by?: Id): void;
    /** Someone disarms the traps they know of where they are (of a kind, if given). */
    private disarmHere;
    /** The regions whose traps the game springs itself, on screen (from the game: recorded). Default: the regions in focus now. */
    near(regions?: string[]): void;
    private applyNear;
    /** Is a place near the player: its traps the game's to spring? (As the game last said with near().) */
    nearPlace(place: Id): boolean;
    /** A trap may catch someone who does something at its place, off screen (none for someone who knows). */
    private snare;
    /** Taints food or drink (from the game: recorded): a place's stock of an item, a place's pot (no item), or someone's goods. Returns its id. */
    taint(def: TaintDef): string | null;
    /** The holder of a person's goods: their household, if it shares a pantry (Ceres), else themselves. */
    private holderOf;
    /** Taints inside the simulation. */
    applyTaint(def: TaintDef): string | null;
    /** The taints (at a place, or everywhere): where, what, how many servings, by whom, for whom. */
    taints(place?: Id): Array<{
        id: string;
        course: Id;
        n: number;
        place?: Id;
        owner?: Id;
        item?: Id;
        by?: Id;
        for?: Id;
        t: number;
    }>;
    /** The poison's severity: the taint's own, else its means', else config.dose. */
    private doseOf;
    /** Tainted servings move with the goods, and afflict whoever eats them: an action just started. */
    private eat;
    /** How many of n servings taken from `before` are tainted: drawn one at a time (all of them for whoever it's for). Takes them off the taint. */
    private draw;
    /** Tainted servings move into someone's goods: a taint of their own, carried on. */
    private move;
    /** Is a Bree kind a fight by numbers? (Only once Morgul has been given a wound.) */
    fights(kind: Id): boolean;
    /** The most blows a fight runs to. */
    get blows(): number;
    /**
     * A turn of a fight by numbers (Bree calls this): a blow lands one way or
     * the other, by the odds; the harm follows; the fight ends if the one
     * struck goes down or yields.
     */
    applyBlow(ex: number, starter: Id, a: PersonState, b: PersonState, place: Id | null, seenBy: Id[]): Blow | null;
    /** How someone would answer a fight with someone (the player, by default) now: fight back, flee, yield or call for help. A look. */
    respond(id: Id, against?: Id): Response | null;
    private answer;
    /** A character in a fight with the player answers (after each harm between them): emitted, and fleeing makes them want to get away. */
    private respondTo;
    /** How dangerous someone believes a place is: a trap or a taint they know of there, or a place they were hurt. */
    danger(id: Id, place: Id | null | undefined): number;
    /** The places someone knows of a trap or a taint at, worked out once a moment. */
    private dangers;
    /** Athelas asks: how fast a course runs for someone (a wound heals at the healing knob's pace). */
    paceOf(p: PersonState, course: Id): number;
    /** Athelas asks, as a phase that ends in death runs out: are they spared? A wound kills only as often as lethality says. */
    spares(p: PersonState, course: Id): boolean;
    /** Athelas tells: a course's phase that tells has started, so whatever harm it was is noticed now. */
    showed(p: PersonState, course: Id): void;
    /** Athelas tells: a course passed or was cured; a wound it was is healed. */
    healed(p: PersonState, course: Id): void;
    candidates(p: PersonState, out: Candidate[]): void;
    block(p: PersonState, cand: Candidate): string | null;
    consider(p: PersonState, cand: Candidate): Array<[string, number]> | void;
    /** How much someone wants to get away: someone they fear is where they are (fear times poor odds, past fleeAt), or they chose to flee (1). */
    fleeing(p: PersonState): number;
    /** The one someone fears most at a place (fear times poor odds), if it's enough to want to leave. */
    private feared;
    /** Someone starts something: a trap there may catch them, and what they eat may be tainted. */
    started(p: PersonState, d: Doing): void;
    /** Lying down ran its course: they come round. */
    ended(p: PersonState, d: Doing, _frac: number, interrupted: boolean): void;
    /** People meet: fear may send someone away; someone who knows of a trap or a taint set for the other warns them. */
    met(a: PersonState, b: PersonState): void;
    /** x warns y of a trap or taint set for y that x knows of, if fond enough of them. */
    private warnOf;
    timer(item: QueueItem): void;
    day(): void;
    removed(p: PersonState): void;
}
/** Food or drink tainted: a place's stock of an item (or its pot, with none), or someone's goods. */
export interface TaintDef {
    /** The course whoever eats it gets (an Athelas course: a quiet phase, then one that tells). */
    course: Id;
    /** Where: a place's stock (or pot)... */
    place?: Id;
    /** ...or someone's goods (their household's pantry, if they share one)... */
    person?: Id;
    /** ...or a holder's, by id (a person or a household). */
    owner?: Id;
    /** The good tainted; none: a place's pot, whatever's eaten there next. */
    item?: Id;
    /** How many servings. Default 1. */
    n?: number;
    /** Who did it. */
    by?: Id;
    /** Who it's meant for: only they get it (the meal they'll eat). */
    for?: Id;
    /** How bad, 0..1. Default: its means', or config.dose. */
    severity?: number;
    /** What it was (a means). */
    what?: Id;
    /** Who saw it done. Default: everyone at the place but whoever did it. */
    seenBy?: Id[];
}
