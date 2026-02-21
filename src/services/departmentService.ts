import api from "@/lib/axios";
import { Department, DepartmentDto } from "@/types";

export const departmentService = {
    getAll: async (organisationId?: string) => {
        const params = organisationId ? { organisationId } : undefined;
        const response = await api.get<Department[]>("/departments", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<Department>(`/departments/${id}`);
        return response.data;
    },

    getSubDepartments: async (parentId: string) => {
        const response = await api.get<Department[]>(`/departments/${parentId}/sub-departments`);
        return response.data;
    },

    create: async (data: DepartmentDto) => {
        const response = await api.post<Department>("/departments", data);
        return response.data;
    },

    update: async (id: string, data: DepartmentDto) => {
        const response = await api.put<Department>(`/departments/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/departments/${id}`);
    },
};
