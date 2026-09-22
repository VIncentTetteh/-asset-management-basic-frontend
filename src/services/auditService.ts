import api from "@/lib/axios";
import { Audit, AssetAuditDto } from "@/types";
import { extractList } from "@/services/responseUtils";

/** GET /audits filters; every one is optional and they combine (AND). */
export interface AuditFilterParams {
    departmentId?: string;
    startDate?: string;       // YYYY-MM-DD
    endDate?: string;         // YYYY-MM-DD
    conductedById?: string;
    status?: string;
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

    /** GET /audits — convenience alias matching common service pattern */
    getById: async (id: string): Promise<Audit> => {
        const response = await api.get<Audit>(`/audits/${id}`);
        return response.data;
    },

    /** POST /audits */
    create: async (data: Partial<AssetAuditDto>): Promise<Audit> => {
        const response = await api.post<Audit>("/audits", data);
        return response.data;
    },

    /**
     * PATCH /audits/{id}/status?status={value}
     * status: PLANNED | IN_PROGRESS | COMPLETED | DISCREPANCY_FOUND | RESOLVED | CANCELLED,
     * limited to the transitions in features/audits/workflow.ts.
     */
    updateStatus: async (id: string, status: string): Promise<Audit> => {
        const response = await api.patch<Audit>(`/audits/${id}/status`, null, {
            params: { status }
        });
        return response.data;
    },

    /** PATCH /audits/{id} — replace an open audit's remarks (blank clears them). */
    updateRemarks: async (id: string, remarks: string | null): Promise<Audit> => {
        const response = await api.patch<Audit>(`/audits/${id}`, { remarks });
        return response.data;
    },
};
