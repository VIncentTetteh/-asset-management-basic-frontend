"use client";

/**
 * LicenseContext — Phase 0 foundation
 *
 * In cloud mode  (NEXT_PUBLIC_APP_MODE=cloud, the default):
 *   - No API calls are made
 *   - useLicenseStatus() returns { mode: 'cloud' }
 *   - LicenseGate renders children unconditionally
 *   - Zero visible change to the existing cloud UI
 *
 * In standalone mode (NEXT_PUBLIC_APP_MODE=standalone):
 *   - Polls GET /api/v1/license/status every 5 minutes (added in Phase 2)
 *   - useLicenseStatus() returns full license state
 *   - LicenseGate gates write actions and shows banners
 *
 * This file is the Phase 0 stub. The polling logic and full LicenseStatus
 * type will be filled in during Phase 2 & 3.
 */

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    ReactNode,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppMode = "cloud" | "standalone";

/**
 * Returned by useLicenseStatus() in both modes.
 * In cloud mode only `mode` is populated — everything else is undefined.
 */
export interface LicenseStatus {
    /** Current deployment mode — always present. */
    mode: AppMode;
    /** true when the license key is valid and write actions are allowed. */
    active?: boolean;
    /** true when the key has expired / grace period lapsed — writes blocked. */
    readOnly?: boolean;
    /** Days remaining on the current license key. */
    daysRemaining?: number;
    /** Licence plan name e.g. "professional". */
    plan?: string;
    /** ISO timestamp when the key expires. */
    expiresAt?: string;
    /** Feature flags from the license payload. */
    features?: {
        apiAccess?: boolean;
        customFields?: boolean;
        analytics?: "basic" | "full";
        sso?: boolean;
        auditLogDays?: number;
    };
    /** Plan limits from the license payload. */
    limits?: {
        assets?: number;
        users?: number;
        departments?: number;
    };
    /** Last error message from the license server, if any. */
    error?: string;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const APP_MODE: AppMode =
    (process.env.NEXT_PUBLIC_APP_MODE as AppMode) === "standalone"
        ? "standalone"
        : "cloud";

const CLOUD_STATUS: LicenseStatus = { mode: "cloud" };

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ── Context ───────────────────────────────────────────────────────────────────

interface LicenseContextValue {
    status: LicenseStatus;
    /** Manually re-fetch license status (e.g. after entering a new key). */
    refresh: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue>({
    status: CLOUD_STATUS,
    refresh: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function LicenseProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<LicenseStatus>(
        APP_MODE === "cloud" ? CLOUD_STATUS : { mode: "standalone" }
    );

    const fetchStatus = useCallback(async () => {
        // Phase 0: no-op in cloud mode — no API call made, zero network traffic.
        if (APP_MODE === "cloud") return;

        // Phase 2 will implement the actual fetch from GET /api/v1/license/status.
        // Stub below keeps TypeScript happy and is safe to leave in place.
        try {
            const res = await fetch("/api/v1/license/status", {
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });
            if (!res.ok) {
                setStatus({ mode: "standalone", readOnly: true, error: `HTTP ${res.status}` });
                return;
            }
            const data: Omit<LicenseStatus, "mode"> = await res.json();
            setStatus({ mode: "standalone", ...data });
        } catch (err) {
            setStatus((prev) => ({ ...prev, error: "Unable to reach license endpoint" }));
        }
    }, []);

    useEffect(() => {
        // In cloud mode nothing runs — no polling, no side effects.
        if (APP_MODE === "cloud") return;

        fetchStatus();
        const timer = setInterval(fetchStatus, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [fetchStatus]);

    return (
        <LicenseContext.Provider value={{ status, refresh: fetchStatus }}>
            {children}
        </LicenseContext.Provider>
    );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current license status.
 *
 * In cloud mode always returns `{ mode: 'cloud' }`.
 * In standalone mode returns full license state.
 *
 * @example
 * const { status } = useLicenseStatus();
 * if (status.readOnly) return <ReadOnlyBanner />;
 */
export function useLicenseStatus(): LicenseContextValue {
    return useContext(LicenseContext);
}

/**
 * Convenience hook — returns true when the app is in standalone mode
 * AND the license is in read-only state (expired or grace period lapsed).
 */
export function useLicenseReadOnly(): boolean {
    const { status } = useLicenseStatus();
    return status.mode === "standalone" && status.readOnly === true;
}

/**
 * Convenience hook — returns true when a specific feature is enabled
 * by the license. Always returns true in cloud mode (cloud billing controls
 * feature access separately via the existing PermissionContext).
 */
export function useLicenseFeature(
    feature: keyof NonNullable<LicenseStatus["features"]>
): boolean {
    const { status } = useLicenseStatus();
    if (status.mode === "cloud") return true;
    return status.features?.[feature] !== false;
}
