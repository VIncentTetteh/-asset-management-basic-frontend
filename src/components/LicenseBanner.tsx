"use client";

/**
 * LicenseBanner — Phase 3
 *
 * Displays a persistent top banner when:
 *   - License expires within 30 days (warning, dismissible for 24h)
 *   - License is in grace period (critical, not dismissible)
 *   - License is expired / error (critical, not dismissible)
 *
 * Invisible in cloud mode (NEXT_PUBLIC_APP_MODE=cloud).
 */

import { useState, useSyncExternalStore } from "react";
import { useLicenseStatus } from "@/contexts/LicenseContext";
import { AlertTriangle, X, RefreshCw } from "lucide-react";

const DISMISS_KEY = "assetiq_license_banner_dismissed_until";
const WARNING_DAYS = 30;

function subscribeToDismissal(onStoreChange: () => void) {
    if (typeof window === "undefined") return () => {};

    const handleStorage = (event: StorageEvent) => {
        if (event.key === DISMISS_KEY) onStoreChange();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
}

function getDismissedSnapshot() {
    if (typeof window === "undefined") return false;

    const dismissedUntil = window.localStorage.getItem(DISMISS_KEY);
    return Boolean(dismissedUntil && new Date(dismissedUntil) > new Date());
}

export function LicenseBanner() {
    const { status, refresh } = useLicenseStatus();
    const [dismissedLocally, setDismissedLocally] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const dismissedFromStorage = useSyncExternalStore(
        subscribeToDismissal,
        getDismissedSnapshot,
        () => false
    );
    const dismissed = dismissedLocally || dismissedFromStorage;

    // Cloud mode — render nothing
    if (status.mode === "cloud") return null;

    const isCritical  = status.readOnly === true;
    const isWarning   = !isCritical &&
                        typeof status.daysRemaining === "number" &&
                        status.daysRemaining <= WARNING_DAYS;

    if (!isCritical && !isWarning) return null;
    if (!isCritical && dismissed)  return null; // only dismissible on warning

    const handleDismiss = () => {
        const until = new Date();
        until.setHours(until.getHours() + 24);
        localStorage.setItem(DISMISS_KEY, until.toISOString());
        setDismissedLocally(true);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    };

    const bgColor   = isCritical ? "bg-red-600"    : "bg-amber-500";
    const textColor = isCritical ? "text-red-50"   : "text-amber-50";
    const iconColor = isCritical ? "text-red-200"  : "text-amber-200";

    const message = isCritical
        ? status.message || "Your license has expired. Write access is disabled."
        : `Your license expires in ${status.daysRemaining} day${status.daysRemaining === 1 ? "" : "s"}.`;

    return (
        <div className={`${bgColor} ${textColor} px-4 py-2.5 flex items-center gap-3 text-sm font-medium`}
             role="alert">
            <AlertTriangle className={`h-4 w-4 shrink-0 ${iconColor}`} />

            <span className="flex-1">
                {message}{" "}
                <a
                    href="https://portal.assetiq.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:no-underline font-semibold"
                >
                    Renew your license →
                </a>
            </span>

            <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Re-check license status"
                className={`p-1 rounded hover:bg-black/10 transition-colors ${iconColor}`}
            >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>

            {/* Dismiss only available for warnings, not critical */}
            {!isCritical && (
                <button
                    onClick={handleDismiss}
                    title="Dismiss for 24 hours"
                    className={`p-1 rounded hover:bg-black/10 transition-colors ${iconColor}`}
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}
