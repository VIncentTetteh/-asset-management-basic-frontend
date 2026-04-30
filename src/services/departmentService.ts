import api from "@/lib/axios";
import { Department, DepartmentDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { invalidateRequestCache, withRequestCache } from "@/services/requestCache";

const withOrgParams = () => {
    const organisationId = getOrganisationIdFromStorage();
    return organisationId ? { organisationId } : undefined;
};

export const departmentService = {
    /** GET /departments — all in org (JWT-scoped) */
    getAll: async (): Promise<Department[]> => {
        return withRequestCache(`departments:${getOrganisationIdFromStorage() ?? "default"}:list`, async () => {
            const response = await api.get("/departments", { params: withOrgParams() });
            return extractList<Department>(response.data);
        }, 2 * 60_000);
    },

    /** GET /departments/{id} */
    get: async (id: string): Promise<Department> => {
        const response = await api.get<Department>(`/departments/${id}`, { params: withOrgParams() });
        return response.data;
    },

    /** GET /departments/{id}/sub-departments */
    getSubDepartments: async (parentId: string): Promise<Department[]> => {
        const response = await api.get(`/departments/${parentId}/sub-departments`, { params: withOrgParams() });
        return extractList<Department>(response.data);
    },

    /** POST /departments */
    create: async (data: DepartmentDto): Promise<Department> => {
        const response = await api.post<Department>("/departments", data, { params: withOrgParams() });
        invalidateRequestCache("departments:");
        return response.data;
    },

    /** PATCH /departments/{id} */
    update: async (id: string, data: Partial<DepartmentDto>): Promise<Department> => {
        const response = await api.patch<Department>(`/departments/${id}`, data, { params: withOrgParams() });
        invalidateRequestCache("departments:");
        return response.data;
    },

    /** DELETE /departments/{id} — soft delete */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/departments/${id}`, { params: withOrgParams() });
        invalidateRequestCache("departments:");
    },

    /** PUT /departments/{id} */
    replace: async (id: string, data: DepartmentDto): Promise<Department> => {
        const response = await api.put<Department>(`/departments/${id}`, data, { params: withOrgParams() });
        invalidateRequestCache("departments:");
        return response.data;
    },
};
