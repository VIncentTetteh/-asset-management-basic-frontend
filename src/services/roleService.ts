import api from "@/lib/axios";
import { Role, RoleDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

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
        const response = await api.get("/roles", { params: withOrgParams() });
        return extractList<Role>(response.data);
    },

    /** GET /roles/{id} */
    get: async (id: string): Promise<Role> => {
        const response = await api.get<Role>(`/roles/${id}`);
        return response.data;
    },

    /** GET /roles/by-name */
    getByName: async (name: string): Promise<Role> => {
        const response = await api.get<Role>("/roles/by-name", {
            params: { name, ...withOrgParams() },
        });
        return response.data;
    },

    /** POST /roles */
    create: async (data: RoleDto): Promise<Role> => {
        // permissions is already a string[] — send as-is.
        const response = await api.post<Role>("/roles", data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** PATCH /roles/{id} */
    update: async (id: string, data: Partial<RoleDto>): Promise<Role> => {
        const response = await api.patch<Role>(`/roles/${id}`, data);
        return response.data;
    },

    /** PUT /roles/{id} — full replacement */
    replace: async (id: string, data: RoleDto): Promise<Role> => {
        const response = await api.put<Role>(`/roles/${id}`, data);
        return response.data;
    },

    /** DELETE /roles/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/roles/${id}`);
    },

    /** GET /roles/permissions — all available permission enum values */
    getPermissions: async (): Promise<string[]> => {
        const response = await api.get<string[]>("/roles/permissions");
        return Array.isArray(response.data) ? response.data : [];
    },
};
