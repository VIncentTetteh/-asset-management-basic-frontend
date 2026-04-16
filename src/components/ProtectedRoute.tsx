"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
    children: React.ReactNode;
    /**
     * Optional permission(s) required to access this route.
     * If provided, authenticated users without the permission see <Forbidden />.
     */
    require?: string | string[];
    /** Whether ANY of the listed permissions satisfies the check (default: ALL). */
    requireAny?: boolean;
}

/**
 * Route-level auth guard.
 *
 * - While loading: renders nothing (prevents flicker).
 * - Unauthenticated: redirects to /login.
 * - Authenticated but missing required permission: renders a Forbidden message.
 * - Authenticated and authorized: renders children.
 *
 * Wrap entire page layouts or individual pages:
 * @example
 * <ProtectedRoute require="MANAGE_ROLES">
 *   <RolesPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
    children,
    require: requiredPerms,
    requireAny = false,
}: ProtectedRouteProps) {
    const router = useRouter();
    const { isAuthenticated, isReady, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

    // Still fetching the profile — render nothing to prevent a flash of unauthorized content
    if (!isReady) {
        return null;
    }

    // Not authenticated — redirect to login
    if (!isAuthenticated) {
        router.replace("/login");
        return null;
    }

    // Permission check (optional)
    if (requiredPerms) {
        const permArray = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];
        const allowed = requireAny
            ? hasAnyPermission(...permArray)
            : hasAllPermissions(...permArray);

        if (!allowed) {
            return (
                <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
                    <div className="text-6xl font-bold text-gray-300">403</div>
                    <h1 className="text-2xl font-semibold text-gray-700">Access Denied</h1>
                    <p className="max-w-sm text-gray-500">
                        You don&apos;t have permission to view this page.
                    </p>
                </div>
            );
        }
    }

    return <>{children}</>;
}
