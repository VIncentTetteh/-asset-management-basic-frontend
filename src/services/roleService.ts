import api from "@/lib/axios";
import { Role, RoleDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const withOrgParams = () => {
    const organisationId = getOrganisationIdFromStorage();
    return organisationId ? { organisationId } : undefined;
};

const normalizeRole = (role: Role): Role => {
    if (Array.isArray(role.permissions)) return role;
    if (typeof role.permissions === "string") {
        try {
            const parsed = JSON.parse(role.permissions);
            if (Array.isArray(parsed)) {
                return { ...role, permissions: parsed.map(String) };
            }
            if (parsed && typeof parsed === "object") {
                const enabled = Object.entries(parsed)
                    .filter(([, value]) => Boolean(value))
                    .map(([key]) => key);
                return { ...role, permissions: enabled };
            }
        } catch {
            return { ...role, permissions: [] };
        }
    }
    return { ...role, permissions: [] };
};

export const roleService = {
    /** GET /roles — all roles in org (JWT-scoped) */
    getAll: async (): Promise<Role[]> => {
        const response = await api.get("/roles", { params: withOrgParams() });
        return extractList<Role>(response.data).map(normalizeRole);
    },

    /** GET /roles/{id} */
    get: async (id: string): Promise<Role> => {
        const response = await api.get<Role>(`/roles/${id}`);
        return normalizeRole(response.data);
    },

    /** POST /roles */
    create: async (data: RoleDto): Promise<Role> => {
        const payload: Record<string, unknown> = { ...data };
        if (Array.isArray(data.permissions)) {
            payload.permissions = JSON.stringify(
                Object.fromEntries(data.permissions.map((permission) => [permission, true]))
            );
        }
        const response = await api.post<Role>("/roles", payload, { params: withOrgParams() });
        return normalizeRole(response.data);
    },

    /** PATCH /roles/{id} */
    update: async (id: string, data: Partial<RoleDto>): Promise<Role> => {
        const payload: Record<string, unknown> = { ...data };
        if (Array.isArray(data.permissions)) {
            payload.permissions = JSON.stringify(
                Object.fromEntries(data.permissions.map((permission) => [permission, true]))
            );
        }
        const response = await api.patch<Role>(`/roles/${id}`, payload);
        return normalizeRole(response.data);
    },

    /** DELETE /roles/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/roles/${id}`);
    },
};
