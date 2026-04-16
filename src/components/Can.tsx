"use client";

import React from "react";
import { useAuth, type Permission } from "@/contexts/AuthContext";

interface CanProps {
    /**
     * One or more permissions to check.
     * @example do="CREATE_ASSET"
     * @example do={["VIEW_USERS", "MANAGE_USERS"]}
     */
    do: Permission | Permission[];
    /**
     * When true, the user needs ANY of the listed permissions (OR logic).
     * When false (default) the user needs ALL of them (AND logic).
     */
    any?: boolean;
    /**
     * What to render when the user does NOT have the required permission(s).
     * Defaults to null (renders nothing).
     */
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * Declarative permission gate component.
 *
 * Renders {@code children} only when the authenticated user holds the required
 * permission(s). Renders {@code fallback} (or nothing) otherwise.
 *
 * @example
 * // Show the Create button only to users with CREATE_ASSET permission
 * <Can do="CREATE_ASSET">
 *   <CreateAssetButton />
 * </Can>
 *
 * @example
 * // Show the Users menu if the user has either VIEW_USERS or MANAGE_USERS
 * <Can do={["VIEW_USERS", "MANAGE_USERS"]} any fallback={<p>No access</p>}>
 *   <UsersMenu />
 * </Can>
 */
export function Can({ do: perms, any = false, fallback = null, children }: CanProps) {
    const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = useAuth();

    // Don't render anything while the profile is loading to prevent flicker
    if (isLoading) return null;

    const permArray = Array.isArray(perms) ? perms : [perms];
    const allowed = any
        ? hasAnyPermission(...permArray)
        : hasAllPermissions(...permArray);

    return allowed ? <>{children}</> : <>{fallback}</>;
}
