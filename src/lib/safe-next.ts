/**
 * Post-login redirect targets (`/login?next=...`).
 *
 * `next` is attacker-controllable (anyone can craft a login link), so only a
 * same-origin, relative path is honoured: it must start with exactly one "/",
 * contain no backslashes, control characters or scheme, and must resolve to
 * this origin. Everything else falls back to the default destination, which
 * closes the open-redirect hole ("//evil.com", "/\\evil.com", "https://...").
 */

export const DEFAULT_POST_LOGIN_PATH = "/dashboard";

const PROBE_ORIGIN = "https://assetiq.invalid";
const MAX_NEXT_LENGTH = 2048;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
/** Where sending the user after login would loop or make no sense. */
const NON_DESTINATIONS = ["/login", "/register", "/register-tenant", "/forgot-password", "/reset-password"];

/** Returns `raw` when it is a safe same-origin relative path, else `fallback`. */
export function safeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_POST_LOGIN_PATH): string {
    if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_NEXT_LENGTH) return fallback;
    if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
    if (raw.includes("\\") || CONTROL_CHARS.test(raw)) return fallback;

    let url: URL;
    try {
        url = new URL(raw, PROBE_ORIGIN);
    } catch {
        return fallback;
    }
    if (url.origin !== PROBE_ORIGIN) return fallback;
    if (NON_DESTINATIONS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
}

/** `/login`, carrying `current` as `next` when it is worth returning to. */
export function loginPathWithNext(current: string | null | undefined): string {
    const next = safeNextPath(current, "");
    return next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

/** Reads and validates `next` from a query string (e.g. window.location.search). */
export function nextFromSearch(search: string, fallback: string = DEFAULT_POST_LOGIN_PATH): string {
    return safeNextPath(new URLSearchParams(search).get("next"), fallback);
}
