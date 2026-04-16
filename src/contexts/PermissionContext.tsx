"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PermissionContextValue {
    /** Live set of permission strings for the current user */
    permissions: Set<string>;
    /** True while the initial fetch is in flight */
    loading: boolean;
    /** Returns true if the user holds the given permission */
    hasPermission: (permission: string) => boolean;
    /** Re-fetches permissions from the server (call after role changes) */
    refresh: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const PermissionContext = createContext<PermissionContextValue>({
    permissions: new Set(),
    loading: true,
    hasPermission: () => false,
    refresh: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function PermissionProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [permissions, setPermissions] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const publicPaths = ["/", "/login", "/register", "/register-tenant", "/forgot-password", "/reset-password"];
    const isPublicPage = publicPaths.includes(pathname);

    const fetchPermissions = useCallback(async () => {
        if (isPublicPage) {
            setPermissions(new Set());
            setLoading(false);
            return;
        }
        if (typeof window === "undefined") return;
        // F-1: the JWT is now in an HttpOnly cookie — no localStorage check needed.
        // The API call will return 401 if the user is not authenticated; we handle
        // that gracefully below by clearing permissions.
        setLoading(true);
        try {
            const response = await api.get<{ permissions: string[] } | { data: { permissions: string[] } }>(
                "/auth/me/permissions"
            );
            // Tolerate both `{ permissions: [...] }` and `{ data: { permissions: [...] } }` envelopes.
            const raw = response.data as any;
            const list: string[] = Array.isArray(raw?.permissions)
                ? raw.permissions
                : Array.isArray(raw?.data?.permissions)
                ? raw.data.permissions
                : [];
            setPermissions(new Set(list));
        } catch (err) {
            // If the request fails (e.g., network error, token expired), leave
            // permissions empty so the user doesn't see anything they shouldn't.
            console.warn("[PermissionContext] Failed to fetch permissions:", err);
            setPermissions(new Set());
        } finally {
            setLoading(false);
        }
    }, [isPublicPage]);

    useEffect(() => {
        fetchPermissions();

        // Refetch when auth state changes (login / logout dispatches "auth-changed").
        // The localStorage "storage" event is no longer the primary signal since the
        // token is now in an HttpOnly cookie, but we keep it for desktop/legacy compat.
        const onAuthChanged = () => { fetchPermissions(); };
        const onStorage = (e: StorageEvent) => {
            if (e.key === "token") fetchPermissions();
        };
        window.addEventListener("auth-changed", onAuthChanged);
        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener("auth-changed", onAuthChanged);
            window.removeEventListener("storage", onStorage);
        };
    }, [fetchPermissions]);

    const hasPermission = useCallback(
        (permission: string) => permissions.has(permission),
        [permissions]
    );

    return (
        <PermissionContext.Provider
            value={{ permissions, loading, hasPermission, refresh: fetchPermissions }}
        >
            {children}
        </PermissionContext.Provider>
    );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Access the full permission context (permissions Set, loading state, helpers) */
export function usePermissions() {
    return useContext(PermissionContext);
}

/**
 * Returns true if the current user holds the given permission.
 * Returns true when no permission is required (undefined / empty string).
 * Returns false while permissions are still loading — the AppLayoutClient
 * blocks the shell during this window so no UI flash occurs.
 */
export function usePermission(permission: string | undefined): boolean {
    const { hasPermission, loading } = useContext(PermissionContext);
    if (!permission) return true;    // no restriction — always visible
    if (loading) return false;       // deny until confirmed — shell is blocked anyway
    return hasPermission(permission);
}
