import api from "@/lib/axios";
import { Audit, AuditDto } from "@/types";

export interface AuditFilterParams {
    organisationId?: string;
    startDate?: string;
    endDate?: string;
}

export const auditService = {
    getAll: async (params?: AuditFilterParams) => {
        const response = await api.get<Audit[]>("/audits", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<Audit>(`/audits/${id}`);
        return response.data;
    },

    create: async (data: AuditDto) => {
        const response = await api.post<Audit>("/audits", data);
        return response.data;
    },

    updateStatus: async (id: string, status: string) => {
        const response = await api.patch<Audit>(`/audits/${id}/status`, null, {
            params: { status }
        });
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/audits/${id}`);
    },
};
