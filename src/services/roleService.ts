import api from "@/lib/axios";
import { Role, RoleDto } from "@/types";

export const roleService = {
    getAll: async (organisationId?: string) => {
        const params = organisationId ? { organisationId } : undefined;
        const response = await api.get<Role[]>("/roles", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<Role>(`/roles/${id}`);
        return response.data;
    },

    getByName: async (name: string, organisationId?: string) => {
        const params: any = { name };
        if (organisationId) params.organisationId = organisationId;
        const response = await api.get<Role>("/roles/by-name", { params });
        return response.data;
    },

    create: async (data: RoleDto) => {
        const response = await api.post<Role>("/roles", data);
        return response.data;
    },

    update: async (id: string, data: RoleDto) => {
        const response = await api.put<Role>(`/roles/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/roles/${id}`);
    },
};
