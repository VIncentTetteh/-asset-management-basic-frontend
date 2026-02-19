import api from "@/lib/axios";
import { Asset, AssetDto } from "@/types";

export const assetService = {
    getAll: async () => {
        const response = await api.get<Asset[]>("/assets");
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<Asset>(`/assets/${id}`);
        return response.data;
    },

    create: async (data: AssetDto) => {
        const response = await api.post<Asset>("/assets", data);
        return response.data;
    },

    update: async (id: string, data: AssetDto) => {
        const response = await api.put<Asset>(`/assets/${id}`, data);
        return response.data;
    },

    assignToDepartment: async (id: string, departmentId: string) => {
        const response = await api.post<Asset>(`/assets/${id}/assign/${departmentId}`);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/assets/${id}`);
    },
};
