import axios from "axios";

/**
 * What a failed sign-in means, and what the user can do about it.
 *
 * The bug this exists to prevent: a user who had not verified their email saw
 * the word "Forbidden" on every attempt and concluded the product was broken.
 * The server had explained itself — "Please verify your email address before
 * signing in." — but under the key `error`, while the client read `message`,
 * and the fallback chain ended at the HTTP reason phrase. A reason phrase is a
 * category, not a reason; it is never shown to a user here.
 *
 * Classification keys off the HTTP status and the server's machine-readable
 * flags, never off the English in the message: the wording is the server's to
 * change, and a client that greps it breaks silently when it does.
 */
export type SignInBlock =
    | "invalid-credentials"
    | "email-verification"
    | "account-inactive"
    | "locked-out"
    | "unreachable"
    | "unknown";

export interface SignInFailure {
    block: SignInBlock;
    /** The sentence to show. The server's own words whenever it gave any. */
    message: string;
    /** Only ever true when the server set `emailVerificationRequired`. */
    canResendVerification: boolean;
    /** When the lock lifts, ISO-8601, when the server said so. */
    retryAt: string | null;
}

/**
 * HTTP reason phrases and axios's own status text. These arrive as
 * `{"error": "Forbidden"}` from a default framework error envelope, and as
 * `error.message` from axios. None of them tells a user anything.
 */
const REASON_PHRASES = new Set([
    "bad request", "unauthorized", "unauthorised", "payment required", "forbidden",
    "not found", "method not allowed", "not acceptable", "request timeout", "conflict",
    "gone", "precondition failed", "unsupported media type", "unprocessable entity",
    "locked", "too many requests", "internal server error", "not implemented",
    "bad gateway", "service unavailable", "gateway timeout", "error",
]);

const isCategoryNotReason = (text: string): boolean => {
    const cleaned = text.trim().replace(/[.!]$/, "").toLowerCase();
    if (!cleaned) return true;
    if (REASON_PHRASES.has(cleaned)) return true;
    if (/^request failed with status code \d+$/.test(cleaned)) return true;
    return /^\d{3}\b/.test(cleaned);
};

const readable = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed && !isCategoryNotReason(trimmed) ? trimmed : null;
};

const ISO_INSTANT =
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;

/**
 * A wall-clock time a person can act on, in their own timezone.
 *
 * The server states the unlock moment as a raw `Instant`; "Try again after
 * 2026-09-24T10:04:31.221Z" is not something to read off a phone.
 */
export const formatRetryTime = (iso: string, now: Date = new Date()): string | null => {
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) return null;
    const sameDay = when.toDateString() === now.toDateString();
    return sameDay
        ? when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
        : when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const GENERIC: Record<SignInBlock, string> = {
    "invalid-credentials": "That email and password do not match an account.",
    "email-verification": "Your email address has to be confirmed before you can sign in.",
    "account-inactive": "This account cannot sign in at the moment. Ask an administrator in your organisation to check it.",
    "locked-out": "This account is locked for a short while after too many sign-in attempts.",
    unreachable: "We could not reach the server. Check your connection and try again.",
    unknown: "We could not sign you in. Please try again.",
};

const blockFor = (status: number | undefined, body: Record<string, unknown>): SignInBlock => {
    if (body.emailVerificationRequired === true) return "email-verification";
    if (status === 423) return "locked-out";
    if (status === 401) return "invalid-credentials";
    if (status === 403) return "account-inactive";
    return "unknown";
};

/**
 * Reads a failed `POST /auth/login` and says what to show.
 *
 * `message` is preferred over `error` because the API is converging on
 * `message`; `error` stays in the chain because older deployments only send
 * that, and a client that reads one key is how this bug happened.
 */
export const describeSignInFailure = (error: unknown): SignInFailure => {
    const response = axios.isAxiosError(error) ? error.response : undefined;

    if (axios.isAxiosError(error) && !response) {
        return { block: "unreachable", message: GENERIC.unreachable, canResendVerification: false, retryAt: null };
    }

    const body = (response?.data ?? {}) as Record<string, unknown>;
    const block = blockFor(response?.status, body);
    const said = readable(body.message) ?? readable(body.error);

    const retryAt =
        readable(body.lockedUntil) ??
        readable(body.retryAt) ??
        readable(body.unlockAt) ??
        (block === "locked-out" ? (said?.match(ISO_INSTANT)?.[0] ?? null) : null);
    const friendlyTime = retryAt ? formatRetryTime(retryAt) : null;

    let message = said ?? GENERIC[block];
    if (block === "locked-out" && friendlyTime) {
        message = ISO_INSTANT.test(message)
            ? message.replace(ISO_INSTANT, friendlyTime)
            : `${/[.!?]$/.test(message) ? message : `${message}.`} You can try again after ${friendlyTime}.`;
    }

    return {
        block,
        message,
        canResendVerification: body.emailVerificationRequired === true,
        retryAt,
    };
};
