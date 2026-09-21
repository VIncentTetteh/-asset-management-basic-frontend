import axios from "axios";

/**
 * Plan-limit 403s (a Freemium org creating its 51st asset, or calling a paid
 * analytics endpoint) come back from the API as plain 403s whose message names
 * the plan/subscription/limit. They are a commercial nudge, not a security
 * event, so they must never block the UI: pages that are wholly paid render an
 * inline upgrade card, everything else gets a non-blocking toast.
 */

export const PLAN_LIMIT_EVENT = "plan-limit-error";

export interface PlanLimitDetail {
    message: string;
    /** Request path relative to the API base, e.g. "/analytics/assets". */
    url?: string;
    /** Upper-case HTTP method. */
    method?: string;
}

const PLAN_LIMIT_HINTS = ["plan", "subscription", "limit"] as const;

/** True when a 403 message reads as a plan/subscription limit rather than a permission denial. */
export const isPlanLimitMessage = (message: unknown): boolean => {
    if (typeof message !== "string") return false;
    const lower = message.toLowerCase();
    return PLAN_LIMIT_HINTS.some((hint) => lower.includes(hint));
};

/** True for an axios 403 whose body says it was a plan limit. */
export const isPlanLimitError = (error: unknown): boolean => {
    if (!axios.isAxiosError(error) || error.response?.status !== 403) return false;
    const data = error.response.data as { message?: unknown } | undefined;
    return isPlanLimitMessage(data?.message);
};

/** Endpoints whose pages render their own inline upgrade card (no toast). */
const INLINE_PLAN_LIMIT_PATHS = ["/analytics"] as const;

export const isHandledInline = (url?: string): boolean => {
    if (!url) return false;
    const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/v1/, "");
    return INLINE_PLAN_LIMIT_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
};
