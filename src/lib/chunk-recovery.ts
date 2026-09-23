/**
 * Recovery from stale-chunk failures.
 *
 * Next.js emits content-hashed JavaScript chunks. A deploy replaces them with
 * new hashes, and any tab that was already open still holds a router manifest
 * naming the old ones. The moment that tab navigates — or reaches a lazily
 * imported component — it requests a file that no longer exists, the request
 * 403s, and the whole route blows up on a framework error screen that says
 * nothing. Reloading fixes it, because the reload fetches the new manifest.
 *
 * `scripts/deploy-web.sh` now keeps the previous build's chunks alive, which
 * shrinks the window. It does not close it: a long-lived tab can still outlive
 * the retention window, and a CDN can still miss. So the app recovers on its
 * own — one reload, silently, before any error screen is shown.
 *
 * The loop guard matters more than the reload. If the chunk is genuinely gone
 * and a reload cannot fix it, reloading again would spin the browser forever.
 * One attempt is recorded in sessionStorage; a second chunk error inside
 * {@link RELOAD_COOLDOWN_MS} of it is treated as "the reload did not help" and
 * falls through to the error screen.
 *
 * The cooldown — rather than a permanent one-shot flag — is deliberate. If the
 * marker is older than the cooldown, the earlier reload demonstrably worked
 * (the user has been using the app since), so a fresh deploy hours later gets
 * its own attempt instead of dropping the user on an error screen because of
 * something that was fixed this morning.
 */

/** sessionStorage key holding the timestamp of the last recovery reload. */
export const CHUNK_RELOAD_KEY = "assetiq:chunk-reload-at";

/**
 * A second chunk error within this window means the reload did not help.
 * 30s is comfortably longer than a reload plus first paint on a slow phone,
 * and far shorter than the gap between two unrelated deploys.
 */
export const RELOAD_COOLDOWN_MS = 30_000;

/**
 * Patterns every bundler/browser combination uses for "I could not fetch that
 * script". webpack throws a named `ChunkLoadError`; native ESM import failures
 * vary by engine, hence the message matching.
 */
const CHUNK_ERROR_PATTERNS = [
    /loading chunk \S+ failed/i,
    /loading css chunk/i,
    /failed to fetch dynamically imported module/i,
    /error loading dynamically imported module/i,
    /importing a module script failed/i,
    /expected a javascript(-or-wasm)? module script/i,
    /'text\/html' is not a valid javascript mime type/i,
];

/** Unwraps the `error` off a value that may be an Error, an event, or a rejection reason. */
function messageOf(error: unknown): string {
    if (!error) return "";
    if (typeof error === "string") return error;
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    const candidate = error as { name?: unknown; message?: unknown };
    const name = typeof candidate.name === "string" ? candidate.name : "";
    const message = typeof candidate.message === "string" ? candidate.message : "";
    return `${name}: ${message}`;
}

/**
 * True when this failure is "the browser could not load a JavaScript chunk",
 * as opposed to a genuine bug in the app.
 */
export function isChunkLoadError(error: unknown): boolean {
    if (error && typeof error === "object" && (error as { name?: unknown }).name === "ChunkLoadError") {
        return true;
    }
    const message = messageOf(error);
    if (!message) return false;
    return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/** sessionStorage throws in private-mode Safari and when storage is disabled. */
function readMarker(): number | null {
    try {
        const raw = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
        if (!raw) return null;
        const at = Number(raw);
        return Number.isFinite(at) ? at : null;
    } catch {
        return null;
    }
}

function writeMarker(at: number): boolean {
    try {
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(at));
        return true;
    } catch {
        // No storage means no loop guard, and an unguarded reload loop is far
        // worse than an error screen. Refuse to reload.
        return false;
    }
}

/** True when a recovery reload has already been attempted and has not had time to work. */
export function hasRecentlyReloaded(now = Date.now()): boolean {
    const at = readMarker();
    return at !== null && now - at < RELOAD_COOLDOWN_MS;
}

/**
 * If `error` is a stale-chunk failure and no reload has been attempted in the
 * cooldown, records the attempt and reloads the page.
 *
 * @returns true when a reload was started — the caller should render nothing
 *          further, because the document is on its way out.
 */
export function recoverFromChunkError(error: unknown, now = Date.now()): boolean {
    if (typeof window === "undefined") return false;
    if (!isChunkLoadError(error)) return false;
    if (hasRecentlyReloaded(now)) return false;
    if (!writeMarker(now)) return false;
    window.location.reload();
    return true;
}

/** Test seam: forgets that a reload was attempted. */
export function clearChunkReloadMarker(): void {
    try {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
        // Nothing to clear if storage is unavailable.
    }
}
