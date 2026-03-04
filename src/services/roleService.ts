import api from "@/lib/axios";
import { Role, RoleDto } from "@/types";

export const roleService = {
    /** GET /roles — all roles in org (JWT-scoped) */
    getAll: async (): Promise<Role[]> => {
        const response = await api.get<Role[]>("/roles");
        return response.data;
    },

    /** GET /roles/{id} */
    get: async (id: string): Promise<Role> => {
        const response = await api.get<Role>(`/roles/${id}`);
        return response.data;
    },

    /** POST /roles */
    create: async (data: RoleDto): Promise<Role> => {
        const response = await api.post<Role>("/roles", data);
        return response.data;
    },

    /** PUT /roles/{id} */
    update: async (id: string, data: RoleDto): Promise<Role> => {
        const response = await api.put<Role>(`/roles/${id}`, data);
        return response.data;
    },

    /** DELETE /roles/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/roles/${id}`);
    },
};
