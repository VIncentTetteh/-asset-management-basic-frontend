import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    CHUNK_RELOAD_KEY,
    RELOAD_COOLDOWN_MS,
    clearChunkReloadMarker,
    hasRecentlyReloaded,
    isChunkLoadError,
    recoverFromChunkError,
} from "@/lib/chunk-recovery";

/**
 * The stale-chunk recovery contract.
 *
 * The whole point of this module is that it reloads the page *once*. A second
 * reload for the same failure is not a retry, it is an infinite loop with the
 * user's browser in it — which is strictly worse than the error screen it was
 * trying to avoid. Every test here exists to hold that line.
 */

let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
    window.sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...window.location, reload, pathname: "/assets", search: "" },
    });
});

afterEach(() => {
    window.sessionStorage.clear();
});

/** A webpack chunk failure, exactly as the browser throws it. */
function chunkError(): Error {
    const error = new Error("Loading chunk 4821 failed.\n(error: https://app/_next/static/chunks/4821-abc.js)");
    error.name = "ChunkLoadError";
    return error;
}

describe("isChunkLoadError", () => {
    it("recognises a webpack ChunkLoadError by name", () => {
        expect(isChunkLoadError(chunkError())).toBe(true);
    });

    it.each([
        "Failed to fetch dynamically imported module: https://app/_next/static/chunks/page.js",
        "error loading dynamically imported module",
        "Importing a module script failed.",
        "Loading CSS chunk 12 failed.",
        "Expected a JavaScript module script but the server responded with a MIME type of \"text/html\".",
    ])("recognises %s", (message) => {
        expect(isChunkLoadError(new Error(message))).toBe(true);
    });

    it("does not mistake an ordinary application bug for a chunk failure", () => {
        expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false);
        expect(isChunkLoadError(new Error("Request failed with status code 500"))).toBe(false);
        expect(isChunkLoadError(null)).toBe(false);
        expect(isChunkLoadError(undefined)).toBe(false);
    });
});

describe("recoverFromChunkError", () => {
    it("reloads exactly once for a chunk failure and refuses to loop", () => {
        expect(recoverFromChunkError(chunkError())).toBe(true);
        expect(reload).toHaveBeenCalledTimes(1);

        // The reload has happened; the page came back and threw again. That
        // means reloading did not fix it, so the second attempt must not fire.
        expect(recoverFromChunkError(chunkError())).toBe(false);
        expect(recoverFromChunkError(chunkError())).toBe(false);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("never reloads for a failure that is not a chunk failure", () => {
        expect(recoverFromChunkError(new TypeError("x.map is not a function"))).toBe(false);
        expect(reload).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
    });

    it("allows a fresh attempt once the earlier reload has demonstrably worked", () => {
        const first = Date.now();
        expect(recoverFromChunkError(chunkError(), first)).toBe(true);

        // Still inside the cooldown: the reload may not even have finished.
        expect(recoverFromChunkError(chunkError(), first + RELOAD_COOLDOWN_MS - 1)).toBe(false);
        expect(reload).toHaveBeenCalledTimes(1);

        // Long after: the user has been using the app since, so that reload
        // worked. A later deploy gets its own attempt rather than an error
        // screen for something that was fixed hours ago.
        expect(recoverFromChunkError(chunkError(), first + RELOAD_COOLDOWN_MS + 1)).toBe(true);
        expect(reload).toHaveBeenCalledTimes(2);
    });

    it("refuses to reload at all when sessionStorage is unavailable", () => {
        // Private-mode Safari, or blocked site data. Without storage there is
        // no loop guard, and an unguarded reload loop is far worse than an
        // error screen — so it declines rather than gambling.
        const setItem = vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
            throw new Error("QuotaExceededError");
        });
        try {
            expect(recoverFromChunkError(chunkError())).toBe(false);
            expect(reload).not.toHaveBeenCalled();
        } finally {
            setItem.mockRestore();
        }
    });
});

describe("hasRecentlyReloaded", () => {
    it("is false with no marker and true straight after one", () => {
        expect(hasRecentlyReloaded()).toBe(false);
        recoverFromChunkError(chunkError());
        expect(hasRecentlyReloaded()).toBe(true);
        clearChunkReloadMarker();
        expect(hasRecentlyReloaded()).toBe(false);
    });

    it("ignores a corrupt marker rather than blocking recovery forever", () => {
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "not-a-number");
        expect(hasRecentlyReloaded()).toBe(false);
    });
});
