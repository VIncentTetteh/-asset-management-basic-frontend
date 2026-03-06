import api from "@/lib/axios";
import { Asset, AssetDto } from "@/types";
import { extractList } from "@/services/responseUtils";

export interface AssetFilterParams {
    /** Filter by AssetStatus enum value e.g. "IN_USE" */
    status?: string;
    /** Filter by department UUID */
    departmentId?: string;
    /** Filter by category UUID */
    categoryId?: string;
}

export const assetService = {
    /** GET /assets — all assets in org (JWT-scoped) */
    getAll: async (params?: AssetFilterParams): Promise<Asset[]> => {
        const response = await api.get("/assets", { params });
        return extractList<Asset>(response.data);
    },

    /** GET /assets/{id} */
    get: async (id: string): Promise<Asset> => {
        const response = await api.get<Asset>(`/assets/${id}`);
        return response.data;
    },

    /** POST /assets */
    create: async (data: AssetDto): Promise<Asset> => {
        const response = await api.post<Asset>("/assets", data);
        return response.data;
    },

    /** PATCH /assets/{id} */
    update: async (id: string, data: Partial<AssetDto>): Promise<Asset> => {
        const response = await api.patch<Asset>(`/assets/${id}`, data);
        return response.data;
    },

    /** POST /assets/{id}/assign/{departmentId} */
    assignToDepartment: async (id: string, departmentId: string): Promise<Asset> => {
        const response = await api.post<Asset>(`/assets/${id}/assign/${departmentId}`);
        return response.data;
    },

    /** POST /assets/{assetId}/assign-user/{userId} */
    assignToUser: async (assetId: string, userId: string): Promise<Asset> => {
        const response = await api.post<Asset>(`/assets/${assetId}/assign-user/${userId}`, {});
        return response.data;
    },

    /** DELETE /assets/{assetId}/assign-user */
    unassignUser: async (assetId: string): Promise<Asset> => {
        const response = await api.delete<Asset>(`/assets/${assetId}/assign-user`, { data: {} });
        return response.data;
    },

    /** DELETE /assets/{id} — soft delete */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/assets/${id}`);
    },
};
