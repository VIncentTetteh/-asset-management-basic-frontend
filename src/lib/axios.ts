import axios from "axios";
import { clearVerifiedOrganisationId, getOrganisationIdFromStorage } from "@/lib/authContext";
import { loginPathWithNext } from "@/lib/safe-next";
import { PLAN_LIMIT_EVENT, isPlanLimitError, type PlanLimitDetail } from "@/lib/plan-limit";
import {
    MFA_ENROLMENT_REQUIRED_EVENT,
    isMfaCodeInvalidError,
    isMfaEnrolmentRequiredError,
    isStepUpRequiredError,
    requestStepUp,
} from "@/lib/step-up";

/**
 * Axios instance for all API requests.
 *
 * F-1 Security change: the JWT is now stored in an HttpOnly cookie set by the
 * backend on login/refresh. The browser sends it automatically on every
 * credentialed request — JavaScript can never read it, which eliminates the
 * XSS token-theft attack surface.
 *
 * Web sessions no longer read or persist JWTs in localStorage.
 */
const api = axios.create({
    // Hosted/static deployments keep the same-origin `/api/v1` path behind
    // CloudFront or nginx. Local and customer-managed environments can point
    // directly at their API without requiring a Next.js proxy.
    baseURL: process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1",
    withCredentials: true,   // F-1: send HttpOnly cookie on every request
    headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    },
});

// ── Helper: clear all auth state ─────────────────────────────────────────────
export const clearAuthState = (): void => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("user_meta");
    clearVerifiedOrganisationId();
    delete api.defaults.headers.common["Authorization"];
};

const isPublicAuthEndpoint = (url?: string): boolean =>
    Boolean(
        url?.includes("/auth/login")
        || url?.includes("/auth/register")
        || url?.includes("/auth/forgot-password")
        || url?.includes("/auth/reset-password")
        || url?.includes("/mfa/challenge")
        || url?.includes("/auth/sso/public")
        // Redeeming an invitation: the caller has no account and no tenant yet.
        // The invitation token in the body is the whole credential.
        || url?.includes("/invitations/lookup")
        || url?.includes("/invitations/accept")
    );

const shouldSkipOrganisationHeader = (url?: string): boolean =>
    Boolean(
        isPublicAuthEndpoint(url)
        || url?.includes("/auth/profile")
        || url?.includes("/auth/me/permissions")
        || url?.includes("/users/me")
        || url?.includes("/auth/refresh")
    );

// ── Request interceptor ───────────────────────────────────────────────────────
// Browser sessions use the HttpOnly cookie sent automatically via withCredentials.
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        if (config.headers && isPublicAuthEndpoint(config.url)) {
            delete config.headers["Authorization"];
        } else if (config.headers) {
            delete config.headers["Authorization"];
        }

        const organisationId = getOrganisationIdFromStorage();
        if (organisationId && config.headers && !shouldSkipOrganisationHeader(config.url)) {
            config.headers["X-Organisation-Id"] = organisationId;
        } else if (config.headers) {
            delete config.headers["X-Organisation-Id"];
        }
    }
    return config;
}, (error) => Promise.reject(error));

// ── Token refresh ─────────────────────────────────────────────────────────────
let _refreshingToken: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
    if (_refreshingToken) return _refreshingToken;
    _refreshingToken = (async () => {
        try {
            // POST /auth/refresh — backend reads the cookie and issues a new one
            await api.post("/auth/refresh", {});
            return true;
        } catch {
            return false;
        } finally {
            _refreshingToken = null;
        }
    })();
    return _refreshingToken;
}

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use((response) => response, async (error) => {
    const originalRequest = error.config;

    if (typeof window !== "undefined" && isPlanLimitError(error)) {
        // Announce it; the app shell decides how (never a blocking modal).
        const detail: PlanLimitDetail = {
            message: error.response?.data?.message || "Plan limit reached",
            url: originalRequest?.url,
            method: originalRequest?.method?.toUpperCase(),
        };
        window.dispatchEvent(new CustomEvent<PlanLimitDetail>(PLAN_LIMIT_EVENT, { detail }));
        return Promise.reject(error);
    }

    // Step-up MFA: the session is valid but this action needs a fresh
    // authenticator check. Prompt once (shared across concurrent requests),
    // then retry the original request exactly once. These 401s must never
    // reach the session-expired handling below, which would sign the user out.
    if (typeof window !== "undefined" && isStepUpRequiredError(error)) {
        if (!originalRequest || originalRequest._stepUpRetried) {
            return Promise.reject(error);
        }
        originalRequest._stepUpRetried = true;
        await requestStepUp(); // rejects StepUpCancelledError when dismissed
        return api(originalRequest);
    }

    // A mistyped authenticator code (step-up, enrolment, disable) is a form
    // error, not an expired session.
    if (isMfaCodeInvalidError(error)) {
        return Promise.reject(error);
    }

    if (typeof window !== "undefined" && isMfaEnrolmentRequiredError(error)) {
        window.dispatchEvent(new CustomEvent(MFA_ENROLMENT_REQUIRED_EVENT));
        return Promise.reject(error);
    }

    const isRefreshRequest = String(originalRequest?.url ?? "").includes("/auth/refresh");
    if (error.response?.status === 401 && !isRefreshRequest && !originalRequest?._authRetried) {
        originalRequest._authRetried = true;
        if (await refreshToken()) {
            return api(originalRequest);
        }
    }

    if (error.response?.status === 401) {
        if (typeof window !== "undefined"
            && !window.location.pathname.startsWith("/login")
            && !window.location.pathname.startsWith("/register")
            // An invitee has no session by definition; bouncing them to login
            // would throw away the token they arrived with.
            && !window.location.pathname.startsWith("/accept-invite")) {
            clearAuthState();
            // Carry the current page so the user lands back on it (e.g. a scanned
            // asset label) after signing in; login validates it again.
            window.location.href = loginPathWithNext(`${window.location.pathname}${window.location.search}`);
        }
    }

    return Promise.reject(error);
});

export default api;
