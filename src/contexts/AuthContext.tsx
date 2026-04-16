"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authService } from "@/services/authService";
import { clearAuthState } from "@/lib/axios";
import type { User } from "@/types";

// ── Permission type ──────────────────────────────────────────────────────────
// Auto-generated from the backend Permission enum (F-3).
// Run `node Enterprise-Asset-Manager/scripts/generate-permissions.mjs` to refresh.
import type { Permission } from "@/types/permissions";
export type { Permission } from "@/types/permissions";

// ── Context shape ────────────────────────────────────────────────────────────
export interface AuthContextValue {
    /** The authenticated user's profile, or null if not logged in. */
    user: User | null;
    /** Live set of permission strings for the current user. */
    permissions: Set<Permission>;
    /** True while the profile fetch is in flight (prevents redirect flicker). */
    isLoading: boolean;
    /** True once the profile has been fetched at least once. */
    isReady: boolean;
    /** True if a user is authenticated. */
    isAuthenticated: boolean;
    /** Returns true if the user has the given permission. */
    hasPermission: (permission: Permission) => boolean;
    /** Returns true if the user has ANY of the given permissions. */
    hasAnyPermission: (...permissions: Permission[]) => boolean;
    /** Returns true if the user has ALL of the given permissions. */
    hasAllPermissions: (...permissions: Permission[]) => boolean;
    /** Clears auth state and marks the user as logged out. */
    signOut: () => Promise<void>;
    /** Re-fetches the user profile and permissions from the server. */
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Set<Permission>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);

    const loadProfile = useCallback(async () => {
        setIsLoading(true);
        try {
            const profile = await authService.getProfile();
            setUser(profile);
            // Profile includes the user's live permissions from the backend cache
            const perms = Array.isArray((profile as any).permissions)
                ? (profile as any).permissions as Permission[]
                : [];
            setPermissions(new Set(perms));
        } catch {
            // 401/network error — user is not authenticated
            setUser(null);
            setPermissions(new Set());
        } finally {
            setIsLoading(false);
            setIsReady(true);
        }
    }, []);

    // Load profile once on mount — the HttpOnly cookie is sent automatically
    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const signOut = useCallback(async () => {
        try {
            await authService.logout();
        } catch {
            // Best-effort logout — clear local state regardless
        }
        clearAuthState();
        setUser(null);
        setPermissions(new Set());
    }, []);

    const hasPermission = useCallback(
        (permission: Permission) => permissions.has(permission),
        [permissions],
    );

    const hasAnyPermission = useCallback(
        (...perms: Permission[]) => perms.some((p) => permissions.has(p)),
        [permissions],
    );

    const hasAllPermissions = useCallback(
        (...perms: Permission[]) => perms.every((p) => permissions.has(p)),
        [permissions],
    );

    return (
        <AuthContext.Provider
            value={{
                user,
                permissions,
                isLoading,
                isReady,
                isAuthenticated: user !== null,
                hasPermission,
                hasAnyPermission,
                hasAllPermissions,
                signOut,
                refreshProfile: loadProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the authenticated user and permission helpers anywhere in the tree.
 *
 * @example
 * const { user, hasPermission } = useAuth();
 * if (hasPermission("CREATE_ASSET")) { ... }
 */
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an <AuthProvider>");
    }
    return ctx;
}
