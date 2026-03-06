import api from "@/lib/axios";
import { DisposalRecord, DisposalsDto } from "@/types";
import { extractList } from "@/services/responseUtils";

export interface DisposalFilterParams {
    assetId?: string;
    startDate?: string;   // YYYY-MM-DD
    endDate?: string;     // YYYY-MM-DD
    approvedById?: string;
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

    /** POST /disposals */
    create: async (data: DisposalsDto): Promise<DisposalRecord> => {
        const response = await api.post<DisposalRecord>("/disposals", data);
        return response.data;
    },

    /** PATCH /disposals/{id} */
    update: async (id: string, data: Partial<DisposalsDto>): Promise<DisposalRecord> => {
        const response = await api.patch<DisposalRecord>(`/disposals/${id}`, data);
        return response.data;
    },

    /** DELETE /disposals/{id} — ADMIN only */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/disposals/${id}`);
    },
};
