import api from "@/lib/axios";
import { AssetTransfer, AssetTransferDto } from "@/types";

export interface TransferFilterParams {
    assetId?: string;
    fromDepartmentId?: string;
    toDepartmentId?: string;
    requestedById?: string;
}

export const assetTransferService = {
    /** GET /asset-transfers — all for org (JWT-scoped) */
    getAll: async (params?: TransferFilterParams): Promise<AssetTransfer[]> => {
        const response = await api.get<AssetTransfer[]>("/asset-transfers", { params });
        return response.data;
    },

    /** GET /asset-transfers/{id} */
    get: async (id: string): Promise<AssetTransfer> => {
        const response = await api.get<AssetTransfer>(`/asset-transfers/${id}`);
        return response.data;
    },

    /** POST /asset-transfers */
    create: async (data: AssetTransferDto): Promise<AssetTransfer> => {
        const response = await api.post<AssetTransfer>("/asset-transfers", data);
        return response.data;
    },

    /**
     * POST /asset-transfers/{id}/approve
     * Approver is the currently authenticated user — no body or params needed.
     */
    approve: async (id: string): Promise<AssetTransfer> => {
        const response = await api.post<AssetTransfer>(`/asset-transfers/${id}/approve`);
        return response.data;
    },

    /** POST /asset-transfers/{id}/reject */
    reject: async (id: string): Promise<AssetTransfer> => {
        const response = await api.post<AssetTransfer>(`/asset-transfers/${id}/reject`);
        return response.data;
    },

    /**
     * POST /asset-transfers/{id}/complete
     * Moves the asset to toDepartment/toLocation, sets status → COMPLETED.
     */
    complete: async (id: string): Promise<AssetTransfer> => {
        const response = await api.post<AssetTransfer>(`/asset-transfers/${id}/complete`);
        return response.data;
    },

    /** DELETE /asset-transfers/{id} — ADMIN only */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/asset-transfers/${id}`);
    },
};
