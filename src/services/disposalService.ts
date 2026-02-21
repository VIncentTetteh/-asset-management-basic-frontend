import api from "@/lib/axios";
import { DisposalRecord, DisposalRecordDto } from "@/types";

export interface DisposalFilterParams {
    assetId?: string;
    startDate?: string;
    endDate?: string;
}

export const disposalService = {
    getAll: async (params?: DisposalFilterParams) => {
        const response = await api.get<DisposalRecord[]>("/disposals", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<DisposalRecord>(`/disposals/${id}`);
        return response.data;
    },

    create: async (data: DisposalRecordDto) => {
        const response = await api.post<DisposalRecord>("/disposals", data);
        return response.data;
    },

    update: async (id: string, data: DisposalRecordDto) => {
        const response = await api.put<DisposalRecord>(`/disposals/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/disposals/${id}`);
    },
};
