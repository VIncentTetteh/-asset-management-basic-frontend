import api from "@/lib/axios";
import { Audit, AssetAuditDto } from "@/types";
import { extractList } from "@/services/responseUtils";

export interface AuditFilterParams {
    departmentId?: string;
    startDate?: string;       // YYYY-MM-DD
    endDate?: string;         // YYYY-MM-DD
    conductedById?: string;
}

export const auditService = {
    /** GET /audits — all for org (JWT-scoped) */
    getAll: async (params?: AuditFilterParams): Promise<Audit[]> => {
        const response = await api.get("/audits", { params });
        return extractList<Audit>(response.data);
    },

    /** GET /audits/{id} */
    get: async (id: string): Promise<Audit> => {
        const response = await api.get<Audit>(`/audits/${id}`);
        return response.data;
    },

    /** POST /audits */
    create: async (data: AssetAuditDto): Promise<Audit> => {
        const response = await api.post<Audit>("/audits", data);
        return response.data;
    },

    /**
     * PATCH /audits/{id}/status?status={value}
     * status: PLANNED | IN_PROGRESS | COMPLETED | CANCELLED
     */
    updateStatus: async (id: string, status: string): Promise<Audit> => {
        const response = await api.patch<Audit>(`/audits/${id}/status`, null, {
            params: { status }
        });
        return response.data;
    },

    /** DELETE /audits/{id} — ADMIN only */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/audits/${id}`);
    },
};
