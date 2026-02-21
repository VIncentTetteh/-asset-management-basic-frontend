import api from "@/lib/axios";
import { AssetTransfer, AssetTransferDto } from "@/types";

export interface TransferFilterParams {
    assetId?: string;
    fromDepartmentId?: string;
    toDepartmentId?: string;
}

export const assetTransferService = {
    getAll: async (params?: TransferFilterParams) => {
        const response = await api.get<AssetTransfer[]>("/asset-transfers", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<AssetTransfer>(`/asset-transfers/${id}`);
        return response.data;
    },

    create: async (data: AssetTransferDto): Promise<AssetTransfer> => {
        const response = await api.post('/asset-transfers', data);
        return response.data;
    },

    update: async (id: string, data: AssetTransferDto): Promise<AssetTransfer> => {
        const response = await api.put(`/asset-transfers/${id}`, data);
        return response.data;
    },

    approve: async (id: string, approvedById: string) => {
        const response = await api.post<AssetTransfer>(`/asset-transfers/${id}/approve`, null, {
            params: { approvedById }
        });
        return response.data;
    },

    reject: async (id: string) => {
        const response = await api.post<AssetTransfer>(`/asset-transfers/${id}/reject`);
        return response.data;
    },

    complete: async (id: string) => {
        const response = await api.post<AssetTransfer>(`/asset-transfers/${id}/complete`);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/asset-transfers/${id}`); // Assumes exist according to API doc
    },
};
