/** Is `name` a flag in the address (?name or &name)? */
export declare function query(name: string, search?: string): boolean;
/** A set of dev switches: `s` holds them (over `defaults`), `load()` reads
 * them (and, with ?dev in the address, remembers that they're shown),
 * `save()` keeps them, `shown()` says whether the dev settings show. */
export declare class Flags<S extends Record<string, unknown> = Record<string, unknown>> {
    key: string;
    s: S & {
        shown?: boolean;
    };
    constructor(key: string, defaults: S);
    load(): this;
    save(): void;
    shown(): boolean;
}
