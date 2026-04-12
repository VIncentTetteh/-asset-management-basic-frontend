"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/contexts/PermissionContext";
import { ShieldOff } from "lucide-react";

interface PermissionGateProps {
    /** The permission required to view this page */
    permission: string;
    children: React.ReactNode;
}

/**
 * Wraps a page and blocks rendering if the current user lacks the required
 * permission. Shows a loading state while permissions are being fetched, then
 * either renders children or a 403 screen.
 *
 * Usage (inside a page component):
 *   <PermissionGate permission="VIEW_ASSETS">
 *     <MyPage />
 *   </PermissionGate>
 */
export function PermissionGate({ permission, children }: PermissionGateProps) {
    const { hasPermission, loading } = usePermissions();
    const router = useRouter();

    const allowed = hasPermission(permission);

    useEffect(() => {
        // If permissions have loaded and the user lacks the required one,
        // redirect to the dashboard rather than showing a dead-end error page.
        if (!loading && !allowed) {
            router.replace("/dashboard");
        }
    }, [loading, allowed, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            </div>
        );
    }

    if (!allowed) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
                <ShieldOff className="h-10 w-10 text-slate-400" />
                <p className="text-sm font-medium">You don&apos;t have permission to view this page.</p>
                <p className="text-xs text-slate-400">Redirecting…</p>
            </div>
        );
    }

    return <>{children}</>;
}
