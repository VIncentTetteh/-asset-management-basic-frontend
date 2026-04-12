import axios from "axios";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const api = axios.create({
    baseURL: "/api/v1",
    headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest"
    },
});

// ── Boot-time token re-hydration ──────────────────────────────────────────────
// Restore the Authorization header from localStorage on every module load so
// that requests fired before the first interceptor run (e.g. during SSR or
// early effects) still carry the correct token.
if (typeof window !== "undefined") {
    const _bootToken = localStorage.getItem("token");
    if (_bootToken) {
        api.defaults.headers.common["Authorization"] = `Bearer ${_bootToken}`;
    }
}

// ── Helper: clear all auth state ─────────────────────────────────────────────
export const clearAuthState = (): void => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete api.defaults.headers.common["Authorization"];
};

// Request interceptor: Attach token to every request automatically
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");
        // Never attach Bearer to public auth endpoints
        const isPublicAuthEndpoint =
            config.url?.includes("/auth/login") ||
            config.url?.includes("/auth/register") ||
            config.url?.includes("/auth/forgot-password") ||
            config.url?.includes("/auth/reset-password") ||
            config.url?.includes("/mfa/challenge") ||
            config.url?.includes("/auth/sso/public");
        if (token && config.headers && !isPublicAuthEndpoint) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        const organisationId = getOrganisationIdFromStorage();
        if (organisationId && config.headers) {
            config.headers["X-Organisation-Id"] = organisationId;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Track in-flight token refresh to avoid duplicate requests
let _refreshingToken: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
    if (_refreshingToken) return _refreshingToken;
    _refreshingToken = (async () => {
        try {
            const current = localStorage.getItem("token");
            if (!current) return null;
            const res = await axios.post(
                "/api/v1/auth/refresh",
                {},
                { headers: { Authorization: `Bearer ${current}` } }
            );
            const newToken: string = res.data?.token;
            if (newToken) {
                localStorage.setItem("token", newToken);
                api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
                return newToken;
            }
            return null;
        } catch {
            return null;
        } finally {
            _refreshingToken = null;
        }
    })();
    return _refreshingToken;
}

// Response interceptor: Handle 401 and 403 globally
api.interceptors.response.use((response) => {
    return response;
}, async (error) => {
    const originalRequest = error.config;

    if (typeof window !== "undefined" && error.response?.status === 403) {
        const message = String(error.response?.data?.message || "").toLowerCase();
        if (message.includes("plan") || message.includes("subscription") || message.includes("limit")) {
            window.dispatchEvent(new CustomEvent("plan-limit-error", {
                detail: { message: error.response?.data?.message || "Plan limit reached" }
            }));
            return Promise.reject(error);
        }

        // Auto-refresh token on 403 (permissions may have been updated server-side)
        // Only retry once to avoid infinite loops
        if (!originalRequest._permissionsRetried) {
            originalRequest._permissionsRetried = true;
            const newToken = await refreshToken();
            if (newToken) {
                originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
                return api(originalRequest);
            }
        }
    }

    if (error.response?.status === 401) {
        if (typeof window !== "undefined" &&
            !window.location.pathname.startsWith("/login") &&
            !window.location.pathname.startsWith("/register")) {
            // Fully wipe auth state (localStorage + axios defaults) before redirect
            clearAuthState();
            window.location.href = "/login";
        }
    }
    return Promise.reject(error);
});

export default api;
