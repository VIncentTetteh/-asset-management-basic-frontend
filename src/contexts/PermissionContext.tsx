"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
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
    const [permissions, setPermissions] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    const fetchPermissions = useCallback(async () => {
        if (typeof window === "undefined") return;
        const token = localStorage.getItem("token");
        if (!token) {
            setPermissions(new Set());
            setLoading(false);
            return;
        }
        try {
            const response = await api.get<{ permissions: string[] }>("/auth/me/permissions");
            setPermissions(new Set(response.data.permissions));
        } catch {
            // If the request fails (e.g., network error, token expired), leave
            // permissions empty so the user doesn't see anything they shouldn't.
            setPermissions(new Set());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPermissions();
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
