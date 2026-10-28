import type { Id } from '../core/types';
import type { World } from '../core/world';
export interface VKCheck {
    name: string;
    /** Called at every sample; push failures into the list. */
    sample?(w: World, acc: Record<string, any>, fail: (msg: string) => void): void;
    /** Called once at the end. */
    end?(w: World, acc: Record<string, any>, fail: (msg: string) => void): void;
}
export interface VKOptions {
    /** Builds a fresh world for a seed (declare everything, add everyone). */
    build: (seed: string) => World;
    /** Days to run. Default 3. */
    days?: number;
    seed?: string;
    /** Minutes between samples. Default 30. */
    every?: number;
    /** Checks by name, or your own. Default: all the built-in ones. */
    checks?: Array<string | VKCheck>;
}
export interface VKStats {
    /** Share of all actions started, by action. */
    actions: Record<Id, number>;
    /** Mean and spread of mood across people, per day. */
    mood: Array<{
        day: number;
        mean: number;
        sd: number;
    }>;
    /** Where everyone is, by hour of day: place -> count, summed over days. */
    places: Record<number, Record<Id, number>>;
    /** The highest level each need reached. */
    needs: Record<Id, number>;
    /** How many decisions were made. */
    decisions: number;
    /** Milliseconds the run took. */
    ms: number;
}
export interface VKReport {
    seed: string;
    days: number;
    passed: boolean;
    failures: string[];
    checks: string[];
    stats: VKStats;
    hash: string;
}
/** Runs the tests. */
export declare function run(opts: VKOptions): VKReport;
/**
 * Compares a run with a baseline: action shares and mean mood within a
 * tolerance. Returns the differences (empty when they match).
 */
export declare function compare(report: VKReport, baseline: VKReport, tolerance?: number): string[];
