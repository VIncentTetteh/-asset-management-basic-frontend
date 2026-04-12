"use client";

/**
 * LicenseGate — Phase 0 foundation
 *
 * A wrapper component that controls access to write actions based on the
 * current license state.
 *
 * Phase 0 behaviour:
 *   - cloud mode      → renders children with no wrapping, no DOM change
 *   - standalone mode → renders children normally (Phase 3 adds enforcement)
 *
 * Phase 3 will add:
 *   - Disabled state + tooltip when license is read-only
 *   - Feature-flag gating (e.g. hide Custom Fields if not on plan)
 *
 * Usage:
 * @example
 * // Wrap any create/edit/delete button:
 * <LicenseGate action="write">
 *   <Button onClick={handleCreate}>Create Asset</Button>
 * </LicenseGate>
 *
 * // Gate on a specific license feature:
 * <LicenseGate feature="customFields">
 *   <CustomFieldsPanel />
 * </LicenseGate>
 */

import React, { ReactNode } from "react";
import { useLicenseStatus, LicenseStatus } from "@/contexts/LicenseContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type WriteAction = "write";
type LicenseFeature = keyof NonNullable<LicenseStatus["features"]>;

interface LicenseGateProps {
    children: ReactNode;
    /**
     * Set to "write" to gate create/edit/delete actions.
     * When the license is in read-only mode these actions will be disabled
     * (Phase 3 implementation).
     */
    action?: WriteAction;
    /**
     * Set to a feature key to gate content behind a license feature flag.
     * e.g. feature="customFields" hides the panel on plans that don't include it.
     */
    feature?: LicenseFeature;
    /**
     * Optional fallback content shown when access is denied.
     * Defaults to null (nothing rendered).
     */
    fallback?: ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LicenseGate({
    children,
    action,
    feature,
    fallback = null,
}: LicenseGateProps) {
    const { status } = useLicenseStatus();

    // ── Cloud mode: always render children, zero overhead ────────────────────
    if (status.mode === "cloud") {
        return <>{children}</>;
    }

    // ── Standalone mode: Phase 3 will add enforcement here ───────────────────
    //
    // Phase 3 checklist (do not implement until Phase 3):
    // [ ] If action="write" and status.readOnly=true → disable children + show tooltip
    // [ ] If feature is set and status.features[feature]=false → render fallback
    //
    // For now in Phase 0, pass through normally so the UI is unaffected.
    // This lets us wire up the gate throughout the codebase now without
    // breaking anything until Phase 3 enforcement is ready.

    return <>{children}</>;
}

// ── HOC variant ───────────────────────────────────────────────────────────────

/**
 * Higher-order component variant of LicenseGate.
 * Wraps a component so that it is only rendered when the license allows it.
 *
 * @example
 * const ProtectedCreateButton = withLicenseGate(CreateButton, { action: "write" });
 */
export function withLicenseGate<P extends object>(
    Component: React.ComponentType<P>,
    gateProps: Omit<LicenseGateProps, "children">
): React.FC<P> {
    const displayName = Component.displayName || Component.name || "Component";

    const WrappedComponent: React.FC<P> = (props) => (
        <LicenseGate {...gateProps}>
            <Component {...props} />
        </LicenseGate>
    );

    WrappedComponent.displayName = `LicenseGate(${displayName})`;
    return WrappedComponent;
}
