import api from "@/lib/axios";
import { MaintenanceRecord, MaintenanceDto } from "@/types";

export interface MaintenanceFilterParams {
    assetId?: string;
    dueBefore?: string;
}

export const maintenanceService = {
    getAll: async (params?: MaintenanceFilterParams) => {
        const response = await api.get<MaintenanceRecord[]>("/maintenance", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<MaintenanceRecord>(`/maintenance/${id}`);
        return response.data;
    },

    create: async (data: MaintenanceDto) => {
        const response = await api.post<MaintenanceRecord>("/maintenance", data);
        return response.data;
    },

    update: async (id: string, data: MaintenanceDto) => {
        const response = await api.put<MaintenanceRecord>(`/maintenance/${id}`, data);
        return response.data;
    },

    complete: async (id: string, data?: { notes?: string }) => {
        const response = await api.post<MaintenanceRecord>(`/maintenance/${id}/complete`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/maintenance/${id}`);
    },
};
