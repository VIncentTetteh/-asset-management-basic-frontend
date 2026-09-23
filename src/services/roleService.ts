import api from "@/lib/axios";
import { Role, RoleDto } from "@/types";
import type { PermissionDescription, RoleEffectivePermissions } from "@/types/invitations";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { invalidateRequestCache, withRequestCache } from "@/services/requestCache";

const withOrgParams = () => {
    const organisationId = getOrganisationIdFromStorage();
    return organisationId ? { organisationId } : undefined;
};

// Phase 2 / B-1: The API now returns permissions as a plain string[] — no
// JSON stringification or client-side normalisation is required.  The old
// normalizeRole() helper and the Object.fromEntries() serialisation that
// converted arrays to {"PERM":true} objects have both been removed.

export const roleService = {
    /** GET /roles — all roles in org (JWT-scoped) */
    getAll: async (): Promise<Role[]> => {
        return withRequestCache(`roles:${getOrganisationIdFromStorage() ?? "default"}:list`, async () => {
            const response = await api.get("/roles", { params: withOrgParams() });
            return extractList<Role>(response.data);
        }, 2 * 60_000);
    },

    /** GET /roles/{id} */
    get: async (id: string): Promise<Role> => {
        return withRequestCache(`roles:${getOrganisationIdFromStorage() ?? "default"}:one:${id}`, async () => {
            const response = await api.get<Role>(`/roles/${id}`);
            return response.data;
        }, 2 * 60_000);
    },

    /** GET /roles/by-name */
    getByName: async (name: string): Promise<Role> => {
        return withRequestCache(`roles:${getOrganisationIdFromStorage() ?? "default"}:name:${name}`, async () => {
            const response = await api.get<Role>("/roles/by-name", {
                params: { name, ...withOrgParams() },
            });
            return response.data;
        }, 2 * 60_000);
    },

    /** POST /roles */
    create: async (data: RoleDto): Promise<Role> => {
        // permissions is already a string[] — send as-is.
        const response = await api.post<Role>("/roles", data, {
            params: withOrgParams(),
        });
        invalidateRequestCache("roles:");
        return response.data;
    },

    /** PATCH /roles/{id} */
    update: async (id: string, data: Partial<RoleDto>): Promise<Role> => {
        const response = await api.patch<Role>(`/roles/${id}`, data);
        invalidateRequestCache("roles:");
        return response.data;
    },

    /** PUT /roles/{id} — full replacement */
    replace: async (id: string, data: RoleDto): Promise<Role> => {
        const response = await api.put<Role>(`/roles/${id}`, data);
        invalidateRequestCache("roles:");
        return response.data;
    },

    /** DELETE /roles/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/roles/${id}`);
        invalidateRequestCache("roles:");
    },

    /** GET /roles/permissions — all available permission enum values */
    getPermissions: async (): Promise<string[]> => {
        return withRequestCache("roles:permissions", async () => {
            const response = await api.get<string[]>("/roles/permissions");
            return Array.isArray(response.data) ? response.data : [];
        }, 10 * 60_000);
    },

    /**
     * GET /roles/permissions/catalogue — every permission, described in plain
     * language, grouped by area of the product, and honest about which ones
     * gate nothing today (`enforced: false`).
     *
     * This replaces the hand-maintained group/label tables the roles page used
     * to carry: a second source of truth that had already drifted from the
     * backend enum it was copying.
     */
    getPermissionCatalogue: async (): Promise<PermissionDescription[]> => {
        return withRequestCache("roles:permissions:catalogue", async () => {
            const response = await api.get<PermissionDescription[]>("/roles/permissions/catalogue");
            return Array.isArray(response.data) ? response.data : [];
        }, 10 * 60_000);
    },

    /** GET /roles/{id}/effective-permissions — what a holder can actually do. */
    getEffectivePermissions: async (id: string): Promise<RoleEffectivePermissions> => {
        const response = await api.get<RoleEffectivePermissions>(`/roles/${id}/effective-permissions`);
        return response.data;
    },
};
