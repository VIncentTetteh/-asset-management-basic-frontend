"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { roleService } from "@/services/roleService";
import { qk } from "@/lib/queryClient";
import type { PermissionDescription } from "@/types/invitations";

const rolesKey = qk.module("roles");

/**
 * Every permission the backend knows about, described in its own words.
 *
 * This replaced a hand-written table of twenty groups and their members that
 * lived in the roles page. It was a second source of truth and it had already
 * drifted: `OFFBOARD_EMPLOYEE` appeared in a group but not in the page's own
 * list of all permissions, so it could be displayed and never selected. The
 * catalogue cannot drift, because it is generated from the same enum the
 * authority checks use.
 */
export function usePermissionCatalogue() {
    return useQuery({
        queryKey: [...rolesKey.all, "permissions", "catalogue"],
        queryFn: () => roleService.getPermissionCatalogue(),
        staleTime: 600_000,
    });
}

/** What someone holding this role will actually be able to do. */
export function useEffectivePermissions(roleId: string | null) {
    return useQuery({
        queryKey: [...rolesKey.all, "effective", roleId],
        queryFn: () => roleService.getEffectivePermissions(roleId as string),
        enabled: Boolean(roleId),
        staleTime: 60_000,
    });
}

export interface PermissionGroup {
    label: string;
    permissions: PermissionDescription[];
}

/** Groups catalogue entries by product area, keeping the API's own ordering. */
export function groupPermissions(entries: PermissionDescription[]): PermissionGroup[] {
    const groups = new Map<string, PermissionDescription[]>();
    for (const entry of entries) {
        const bucket = groups.get(entry.group);
        if (bucket) bucket.push(entry);
        else groups.set(entry.group, [entry]);
    }
    return [...groups.entries()].map(([label, permissions]) => ({ label, permissions }));
}

/** `{ DISPOSE_ASSET: "Dispose of assets" }`, for rendering a role's own list. */
export function useCatalogueIndex(): {
    index: Map<string, PermissionDescription>;
    isLoading: boolean;
    describe: (key: string) => string;
    isEnforced: (key: string) => boolean;
} {
    const { data = [], isLoading } = usePermissionCatalogue();
    const index = useMemo(() => new Map(data.map((entry) => [entry.key, entry])), [data]);
    return {
        index,
        isLoading,
        // A key the catalogue has never heard of is shown as itself rather than
        // hidden: an unknown permission on a role is something an administrator
        // needs to see, not something to quietly drop.
        describe: (key: string) => index.get(key)?.label ?? key.replace(/_/g, " ").toLowerCase(),
        isEnforced: (key: string) => index.get(key)?.enforced ?? true,
    };
}
