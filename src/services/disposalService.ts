import api from "@/lib/axios";
import { DisposalRecord, DisposalsDto } from "@/types";
import { extractList } from "@/services/responseUtils";

/** GET /disposals filters; every one is optional and they combine (AND). */
export interface DisposalFilterParams {
    assetId?: string;
    startDate?: string;   // YYYY-MM-DD
    endDate?: string;     // YYYY-MM-DD
    approvedById?: string;
    status?: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
}

export const disposalService = {
    /** GET /disposals — all for org (JWT-scoped) */
    getAll: async (params?: DisposalFilterParams): Promise<DisposalRecord[]> => {
        const response = await api.get("/disposals", { params });
        return extractList<DisposalRecord>(response.data);
    },

    /** GET /disposals/{id} */
    get: async (id: string): Promise<DisposalRecord> => {
        const response = await api.get<DisposalRecord>(`/disposals/${id}`);
        return response.data;
    },

    /** POST /disposals — a request; the asset is disposed only on approval. */
    create: async (data: DisposalsDto): Promise<DisposalRecord> => {
        const response = await api.post<DisposalRecord>("/disposals", data);
        return response.data;
    },

    /** PATCH /disposals/{id} */
    update: async (id: string, data: Partial<DisposalsDto>): Promise<DisposalRecord> => {
        const response = await api.patch<DisposalRecord>(`/disposals/${id}`, data);
        return response.data;
    },

    /** POST /disposals/{id}/approve — a user other than the requester; fresh MFA. Disposes the asset. */
    approve: async (id: string): Promise<DisposalRecord> => {
        const response = await api.post<DisposalRecord>(`/disposals/${id}/approve`);
        return response.data;
    },

    /** POST /disposals/{id}/reject — refuse (or withdraw) a pending disposal, saying why. */
    reject: async (id: string, reason: string): Promise<DisposalRecord> => {
        const response = await api.post<DisposalRecord>(`/disposals/${id}/reject`, { reason });
        return response.data;
    },

    /** DELETE /disposals/{id} — pending or rejected only */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/disposals/${id}`);
    },

    /** PUT /disposals/{id} */
    replace: async (id: string, data: DisposalsDto): Promise<DisposalRecord> => {
        const response = await api.put<DisposalRecord>(`/disposals/${id}`, data);
        return response.data;
    },
};
