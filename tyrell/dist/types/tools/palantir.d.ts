import type { Candidate, Decision, Id } from '../core/types';
import type { World } from '../core/world';
export declare class Palantir {
    private w;
    private decisions;
    /** Turn off to save a little time in big headless runs. */
    enabled: boolean;
    constructor(w: World);
    record(d: Decision): void;
    clear(): void;
    /** The latest decision for a person. */
    why(id: Id): Decision | null;
    /** A person's recent decisions, oldest first. */
    history(id: Id): Decision[];
    /** Why someone isn't doing something: weighs it now and says what stops it or what beat it. */
    whyNot(id: Id, action: Id): string;
    private whyNotNow;
    /** "base 0.4 x habit 1.2 x travel 0.6" */
    parts(c: Candidate): string;
    /** A readable account of a person: what they're doing and why, needs, mood, plan, beliefs. */
    describe(id: Id): string;
    private describeNow;
    /** The full state of a person as JSON-ready data. */
    inspect(id: Id): unknown;
}
