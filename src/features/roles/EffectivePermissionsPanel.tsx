"use client";

import { Check, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { DataErrorState } from "@/components/patterns/DataErrorState";
import { useEffectivePermissions, groupPermissions } from "@/features/roles/hooks";

/**
 * What a person holding this role will actually be able to do, in the API's own
 * words — the same question an administrator is really asking when they open a
 * role, and the same answer the invitee is shown on the acceptance screen.
 *
 * Resolved server-side, so a grant-all role expands to the permissions it
 * implies rather than showing an empty list, and the permissions that gate
 * nothing are named as such instead of padding the count.
 */
export function EffectivePermissionsPanel({ roleId }: { roleId: string }) {
    const { data, isLoading, error, refetch, isFetching } = useEffectivePermissions(roleId);

    if (error) {
        return (
            <DataErrorState
                what="what this role allows"
                error={error}
                onRetry={refetch}
                isRetrying={isFetching}
            />
        );
    }

    if (isLoading || !data) {
        return (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-fg">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                <span role="status">Working out what this role allows…</span>
            </p>
        );
    }

    const enforced = data.permissions.filter((permission) => permission.enforced);
    const groups = groupPermissions(enforced);

    return (
        <div className="space-y-4" data-testid="effective-permissions">
            <div className="rounded-card border border-edge bg-surface-muted p-3 text-sm">
                <p className="font-semibold text-foreground">
                    {data.roleName}
                    {data.systemRole ? <span className="ml-2 text-xs font-normal text-muted-fg">Built-in role</span> : null}
                </p>
                {data.description ? <p className="mt-0.5 text-[13px] text-muted-fg">{data.description}</p> : null}
                <p className="mt-1 text-[13px] text-muted-fg">
                    {data.grantAllPermissions
                        ? `Everything: this role carries all ${data.permissionCount} permissions in the product.`
                        : `${enforced.length} of ${data.permissionCount} granted permission${data.permissionCount === 1 ? "" : "s"} do something today.`}
                </p>
            </div>

            {data.unenforced.length > 0 ? (
                <Alert tone="warn" title="Granted, but not enforced anywhere yet" live={false}>
                    {data.unenforced.join(", ").replace(/_/g, " ").toLowerCase()} — no part of the product checks{" "}
                    {data.unenforced.length === 1 ? "this one" : "these"} today, so {data.unenforced.length === 1 ? "it does" : "they do"} not
                    change what this person can do. {data.unenforced.length === 1 ? "It is" : "They are"} listed here rather than hidden so the role
                    is not quietly different from what was saved.
                </Alert>
            ) : null}

            {groups.length === 0 ? (
                <p className="text-sm text-muted-fg">
                    This role allows nothing beyond signing in. Someone holding it will see an empty
                    workspace until permissions are added.
                </p>
            ) : (
                <div className="space-y-3">
                    {groups.map((group) => (
                        <div key={group.label}>
                            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint-fg">{group.label}</p>
                            <ul className="mt-1 space-y-1">
                                {group.permissions.map((permission) => (
                                    <li key={permission.key} className="flex gap-2 text-[13px] text-muted-fg">
                                        <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                                        <span>
                                            <span className="font-medium text-foreground">{permission.label}</span>
                                            {" — "}
                                            {permission.summary}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
