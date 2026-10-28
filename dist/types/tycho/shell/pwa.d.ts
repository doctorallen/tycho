export interface PwaOptions {
    /** This page's build, as the deploy stamped it ('__BUILD__' unstamped). */
    build: string;
    /** The worker's script. */
    sw?: string;
    /** How often to look for a new deploy while open, in ms. */
    every?: number;
    /** A newer build has taken over; `newer` is its name from version.json. */
    onNewer?: (newer: string) => void;
    /** Whether now is a good moment for the browser's install pop-up (a tap
     * outside play, say). Without it the pop-up is never asked for. */
    canAsk?: () => boolean;
    /** Storage key remembering when the pop-up was last asked for. */
    askedKey?: string;
    /** How long before asking again after it was turned down, in ms. */
    askEvery?: number;
    /** The browser said it can install (redraw a menu that offers it). */
    onInstallable?: () => void;
    /** Installed (say so). */
    onInstalled?: () => void;
    /** The session-storage key that remembers a reload was an update. */
    updatedKey?: string;
}
type Prompt = Event & {
    prompt(): Promise<void>;
    userChoice: Promise<unknown>;
};
export declare class Pwa {
    o: PwaOptions;
    reg: ServiceWorkerRegistration | null;
    /** The browser's install prompt, while it can be shown. */
    prompt: Prompt | null;
    /** The live build, from version.json at start (null until known). */
    live: string | null;
    /** A newer build that has taken over, waiting for the game to load it. */
    newer: string | null;
    reloading: boolean;
    constructor(o: PwaOptions);
    /** Starts it all: the install prompt, the live build, the worker. Only
     * over http(s): opened from a file there's no worker. */
    start(): this;
    /** The live build from version.json, or null. */
    version(): Promise<string | null>;
    /** Looks for a new deploy now. */
    check(): void;
    /** Loads the page again onto the new build, remembering it was an update. */
    reload(): void;
    /** After a reload onto a new build: what it was (once), or null. */
    updated(): string | null;
    installed(): boolean;
    ios(): boolean;
    /**
     * Whether the game is installed on this device while it's open in a browser
     * tab (so the browser won't offer to install it): true where the browser
     * can tell (Chrome and Edge, getInstalledRelatedApps), when the game's
     * manifest lists itself in `related_applications` (`platform: "webapp"`,
     * `url`: the manifest's full address). False where it can't tell.
     */
    installedElsewhere(): Promise<boolean>;
    /** Shows the browser's install prompt, if it can. */
    install(): void;
}
/** Makes and starts the page's half of an installable game. */
export declare function start(o: PwaOptions): Pwa;
export {};
