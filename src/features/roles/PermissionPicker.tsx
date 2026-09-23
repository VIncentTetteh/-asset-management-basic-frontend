"use client";

import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { DataErrorState } from "@/components/patterns/DataErrorState";
import { groupPermissions, usePermissionCatalogue } from "@/features/roles/hooks";

/**
 * The permission checkboxes on a role, worded by the backend.
 *
 * Three permissions — ESCALATE_REQUESTS, REGENERATE_QR, REVIEW_ACCESS — report
 * `enforced: false`: no endpoint consults them, so granting one changes
 * nothing. They are still shown, because a role that already carries one would
 * otherwise appear to have been silently edited, but they are labelled as not
 * yet enforced and say so in the same sentence. Presenting them as working
 * would be the one thing a permission screen must never do.
 */
export function PermissionPicker({
    selected,
    onToggle,
    readOnly = false,
}: {
    selected: string[];
    onToggle: (key: string) => void;
    readOnly?: boolean;
}) {
    const { data: catalogue = [], isLoading, error, refetch, isFetching } = usePermissionCatalogue();
    const groups = groupPermissions(catalogue);
    const unenforcedSelected = selected.filter((key) => catalogue.some((e) => e.key === key && !e.enforced));

    if (error) {
        return (
            <DataErrorState
                what="the list of permissions"
                error={error}
                onRetry={refetch}
                isRetrying={isFetching}
            />
        );
    }

    if (isLoading) {
        return <p className="py-4 text-center text-xs text-faint-fg">Loading permissions…</p>;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label id="permission-picker-label">What this role allows</Label>
                <span className="text-xs text-faint-fg">{selected.length} selected</span>
            </div>

            {unenforcedSelected.length > 0 ? (
                <Alert tone="warn" title="Some of these do nothing yet" live={false}>
                    {unenforcedSelected.length === 1 ? "One permission on this role" : `${unenforcedSelected.length} permissions on this role`}
                    {" "}are not enforced anywhere in the product yet. They are kept so nothing is
                    lost, but granting them changes what nobody can do.
                </Alert>
            ) : null}

            <div
                role="group"
                aria-labelledby="permission-picker-label"
                className="max-h-[320px] space-y-4 overflow-y-auto pr-1"
            >
                {groups.map((group) => (
                    <div key={group.label}>
                        <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-faint-fg">
                            {group.label}
                        </p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                            {group.permissions.map((permission) => (
                                <div
                                    key={permission.key}
                                    className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-sunken"
                                >
                                    <input
                                        type="checkbox"
                                        id={`perm-${permission.key}`}
                                        className="ea-focus mt-0.5 rounded border-edge accent-[var(--primary)]"
                                        checked={selected.includes(permission.key)}
                                        onChange={() => !readOnly && onToggle(permission.key)}
                                        disabled={readOnly}
                                        aria-describedby={`perm-${permission.key}-summary`}
                                    />
                                    <div className="min-w-0">
                                        <Label
                                            htmlFor={`perm-${permission.key}`}
                                            className="cursor-pointer text-[13px] leading-tight font-medium"
                                        >
                                            {permission.label}
                                            {!permission.enforced ? (
                                                <span className="ml-1.5 rounded border border-warn/40 bg-warn-soft px-1 py-px text-[10px] font-semibold text-warn">
                                                    Not enforced yet
                                                </span>
                                            ) : null}
                                        </Label>
                                        <p id={`perm-${permission.key}-summary`} className="text-[11px] leading-snug text-muted-fg">
                                            {permission.enforced
                                                ? permission.summary
                                                : `${permission.summary} Nothing checks this permission today, so granting it has no effect.`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
