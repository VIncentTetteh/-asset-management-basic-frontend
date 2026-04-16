import axios from "axios";
import { clearVerifiedOrganisationId, getOrganisationIdFromStorage } from "@/lib/authContext";

/**
 * Axios instance for all API requests.
 *
 * F-1 Security change: the JWT is now stored in an HttpOnly cookie set by the
 * backend on login/refresh. The browser sends it automatically on every
 * credentialed request — JavaScript can never read it, which eliminates the
 * XSS token-theft attack surface.
 *
 * The Authorization: Bearer header path is preserved for the desktop (Electron)
 * app and direct API clients that still use localStorage-based tokens.
 */
const api = axios.create({
    baseURL: "/api/v1",
    withCredentials: true,   // F-1: send HttpOnly cookie on every request
    headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    },
});

const MAX_AUTH_TOKEN_HEADER_LENGTH = 4096;

/**
 * Returns a stored Bearer token if one exists in localStorage.
 * Used only for desktop-app compatibility — browser sessions rely on the cookie.
 */
const getSafeToken = (): string | null => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("token");
    if (!token) return null;
    const normalized = token.trim();
    if (!normalized || normalized.length > MAX_AUTH_TOKEN_HEADER_LENGTH) {
        localStorage.removeItem("token");
        return null;
    }
    return normalized;
};

// ── Helper: clear all auth state ─────────────────────────────────────────────
export const clearAuthState = (): void => {
    // Remove any localStorage token (desktop/legacy compatibility)
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
// For browser sessions the HttpOnly cookie is sent automatically via withCredentials.
// If a localStorage token also exists (desktop/legacy) it is added as a Bearer header
// so the backend filter can accept it from either source.
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = getSafeToken();

        if (config.headers && isPublicAuthEndpoint(config.url)) {
            delete config.headers["Authorization"];
        } else if (token && config.headers) {
            // Desktop/legacy: add Bearer header when a stored token is present
            config.headers["Authorization"] = `Bearer ${token}`;
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

    if (typeof window !== "undefined" && error.response?.status === 403) {
        const message = String(error.response?.data?.message || "").toLowerCase();
        if (message.includes("plan") || message.includes("subscription") || message.includes("limit")) {
            window.dispatchEvent(new CustomEvent("plan-limit-error", {
                detail: { message: error.response?.data?.message || "Plan limit reached" },
            }));
            return Promise.reject(error);
        }

        // Auto-refresh on 403 — only retry once
        if (!originalRequest._permissionsRetried) {
            originalRequest._permissionsRetried = true;
            const refreshed = await refreshToken();
            if (refreshed) {
                return api(originalRequest);
            }
        }
    }

    if (error.response?.status === 401) {
        if (typeof window !== "undefined"
            && !window.location.pathname.startsWith("/login")
            && !window.location.pathname.startsWith("/register")) {
            clearAuthState();
            window.location.href = "/login";
        }
    }

    return Promise.reject(error);
});

export default api;
