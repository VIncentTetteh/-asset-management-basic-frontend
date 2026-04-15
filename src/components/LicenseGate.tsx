"use client";

/**
 * LicenseGate — Phase 3 (enforcement active)
 *
 * Controls access to write actions and feature-gated content based on
 * the current license state.
 *
 * Behaviour by mode:
 *   cloud mode      → renders children unchanged — zero overhead
 *   standalone/valid → renders children unchanged
 *   standalone/readOnly → disables write children + shows tooltip
 *   standalone/feature disabled → renders fallback or nothing
 */

import React, { ReactNode, cloneElement, isValidElement } from "react";
import { useLicenseStatus, LicenseStatus } from "@/contexts/LicenseContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type LicenseFeature = keyof NonNullable<LicenseStatus["features"]>;

interface LicenseGateProps {
    children: ReactNode;
    /**
     * Set to "write" to gate create/edit/delete actions.
     * When the license is read-only, the child element is disabled
     * and wrapped in a tooltip.
     */
    action?: "write";
    /**
     * Set to a feature key to gate content behind a license feature flag.
     * e.g. feature="customFields" hides the panel on plans without it.
     */
    feature?: LicenseFeature;
    /** Content shown when access is denied. Defaults to null (nothing). */
    fallback?: ReactNode;
    /** Custom tooltip shown on disabled write actions. */
    disabledMessage?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LicenseGate({
    children,
    action,
    feature,
    fallback = null,
    disabledMessage,
}: LicenseGateProps) {
    const { status } = useLicenseStatus();

    // ── Cloud mode: render children unchanged ─────────────────────────────────
    if (status.mode === "cloud") return <>{children}</>;

    // ── Feature gate ──────────────────────────────────────────────────────────
    if (feature !== undefined) {
        const enabled = status.features?.[feature] !== false;
        if (!enabled) return <>{fallback}</>;
    }

    // ── Write action gate ─────────────────────────────────────────────────────
    if (action === "write" && status.readOnly) {
        const tooltip = disabledMessage
            ?? "Your license has expired. Contact your admin to renew.";

        // Try to clone the immediate child and inject disabled + aria-disabled
        if (isValidElement(children)) {
            return (
                <span
                    className="relative inline-block cursor-not-allowed group"
                    title={tooltip}
                    aria-label={tooltip}
                >
                    {cloneElement(children as React.ReactElement<Record<string, unknown>>, {
                        disabled:     true,
                        "aria-disabled": true,
                        onClick:      (e: React.MouseEvent) => e.preventDefault(),
                        className:    `${(children.props as Record<string, unknown>).className ?? ""} opacity-40 pointer-events-none`,
                    })}
                    {/* Tooltip */}
                    <span className="
                        absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                        whitespace-nowrap rounded bg-gray-900 text-white text-xs px-2 py-1
                        opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
                    ">
                        {tooltip}
                    </span>
                </span>
            );
        }

        // Fallback: wrap non-element children in a disabled span
        return (
            <span
                className="opacity-40 cursor-not-allowed pointer-events-none"
                title={tooltip}
            >
                {children}
            </span>
        );
    }

    return <>{children}</>;
}

// ── HOC variant ───────────────────────────────────────────────────────────────

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
