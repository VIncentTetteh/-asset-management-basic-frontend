import api from "@/lib/axios";
import { MaintenanceRecord, MaintenanceDto } from "@/types";
import { extractList } from "@/services/responseUtils";

export interface MaintenanceFilterParams {
    assetId?: string;
    vendorId?: string;
    dueBefore?: string;   // YYYY-MM-DD
}

export const maintenanceService = {
    /** GET /maintenance — all for org (JWT-scoped) */
    getAll: async (params?: MaintenanceFilterParams): Promise<MaintenanceRecord[]> => {
        const response = await api.get("/maintenance", { params });
        return extractList<MaintenanceRecord>(response.data);
    },

    /** GET /maintenance/{id} */
    get: async (id: string): Promise<MaintenanceRecord> => {
        const response = await api.get<MaintenanceRecord>(`/maintenance/${id}`);
        return response.data;
    },

    /** POST /maintenance — automatically sets asset status → MAINTENANCE */
    create: async (data: MaintenanceDto): Promise<MaintenanceRecord> => {
        const response = await api.post<MaintenanceRecord>("/maintenance", data);
        return response.data;
    },

    /** PATCH /maintenance/{id} */
    update: async (id: string, data: Partial<MaintenanceDto>): Promise<MaintenanceRecord> => {
        const response = await api.patch<MaintenanceRecord>(`/maintenance/${id}`, data);
        return response.data;
    },

    /**
     * POST /maintenance/{id}/complete
     * Sets status → COMPLETED, performedDate → today, asset status → IN_USE.
     * No body required.
     */
    complete: async (id: string): Promise<MaintenanceRecord> => {
        const response = await api.post<MaintenanceRecord>(`/maintenance/${id}/complete`);
        return response.data;
    },

    /** DELETE /maintenance/{id} — ADMIN only */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/maintenance/${id}`);
    },
};
