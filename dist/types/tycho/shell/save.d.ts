/** JSON from storage, or `fallback` if it's missing or can't be read. */
export declare function get<T = unknown>(key: string, fallback?: T | null): T | null;
/** Writes a value as JSON; false if storage refused it. */
export declare function set(key: string, value: unknown): boolean;
/** The raw string, or null. */
export declare function raw(key: string): string | null;
export declare function remove(key: string): void;
/** Every key that starts with `prefix`. */
export declare function keys(prefix?: string): string[];
export interface StoreOptions<D> {
    /** The storage key, e.g. 'mygame.save.v1'. */
    key: string;
    /** A new game's save. */
    fresh: () => D;
    /** Keys of saves this game no longer reads, deleted on load. */
    old?: string[];
    /** Ids renamed since a save could have been made: [pattern, replacement]
     * pairs applied to the save's JSON text before it's read. */
    renamed?: [RegExp | string, string][];
    /** Whether a stored save is still this game's (say, the same version);
     * if not, the game starts fresh. By default every save is. */
    accept?: (stored: Record<string, unknown>, fresh: D) => boolean;
    /** Puts a loaded save right (fills what's missing, moves old fields). */
    clean?: (data: D) => void;
    /** Keep a save that can't be read under key + '.unread', so a new game
     * never writes over it. */
    keepUnread?: boolean;
    /** Called the first time storage refuses a write. */
    onRefused?: () => void;
}
/** One save object kept in storage. `load()` reads it (merged over a fresh
 * save) into `data`; `write()` stores `data` (or what's given). */
export declare class Store<D extends object = Record<string, unknown>> {
    o: StoreOptions<D>;
    data: D | null;
    /** True once wiped: nothing more is written. */
    wiped: boolean;
    /** True if a save was there but couldn't be read (and was kept aside). */
    unread: boolean;
    /** True if `load()` found this game's save. */
    loaded: boolean;
    private refused;
    constructor(o: StoreOptions<D>);
    /** The stored save as it is (renamed ids put right), or null. */
    read(): Record<string, unknown> | null;
    private renamed;
    /** Reads the save into `data`: the stored one over a fresh one, or a fresh
     * one. Old keys are deleted first. Returns `data`. */
    load(): D;
    /** Stores the save; false if storage refused it (said once by onRefused). */
    write(data?: D | null): boolean;
    /** Writes one field into the stored save at once, leaving the rest as last
     * stored (or the whole save, if none is stored yet). */
    writeField(name: keyof D & string): void;
    /** Deletes the save and stops writing (until the page loads again). */
    wipe(): void;
    /** Starting over: every key starting with `prefix` is deleted, and the
     * save becomes `next` (a fresh one, perhaps with settings kept). Nothing
     * more is written after. */
    startOver(prefix: string, next?: D): void;
}
