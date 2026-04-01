import api from "@/lib/axios";
import { Asset, AssetDto, AssetImportResult, AssetHistory } from "@/types";
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

    /** PUT /assets/{id} */
    replace: async (id: string, data: AssetDto): Promise<Asset> => {
        const response = await api.put<Asset>(`/assets/${id}`, data);
        return response.data;
    },

    /** GET /assets/{id}/history */
    getHistory: async (id: string): Promise<AssetHistory[]> => {
        const response = await api.get<AssetHistory[]>(`/assets/${id}/history`);
        return response.data;
    },

    /** GET /assets/{id}/qrcode */
    getQrCode: async (id: string): Promise<Blob | Record<string, unknown> | string> => {
        const response = await api.get<Blob>(`/assets/${id}/qrcode`, { responseType: "blob" });
        const contentType = String(response.headers["content-type"] || "").toLowerCase();
        if (contentType.includes("image/")) {
            return response.data;
        }
        const text = await response.data.text();
        try {
            return JSON.parse(text) as Record<string, unknown>;
        } catch {
            return text;
        }
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

    /** POST /assets/import — multipart .xlsx bulk import */
    importFromExcel: async (file: File): Promise<AssetImportResult> => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.post<AssetImportResult>("/assets/import", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    },

    /** GET /assets/{id}/tco — Total Cost of Ownership breakdown. */
    getTco: async (id: string): Promise<{
        assetId: string;
        assetName: string;
        assetTag: string;
        acquisitionCost: number;
        totalMaintenanceCost: number;
        totalInsuranceCost: number;
        totalDowntimeCost: number;
        disposalRecovery: number;
        netTco: number;
        currency: string;
        calculatedAt: string;
        maintenanceRecordCount: number;
        downtimeDays: number;
    }> => {
        const response = await api.get(`/assets/${id}/tco`);
        return response.data;
    },

    /** GET /assets/scan/{payload} — Look up an asset by its decoded QR payload. */
    getByQrPayload: async (payload: string): Promise<Asset> => {
        const response = await api.get<Asset>(`/assets/scan/${encodeURIComponent(payload)}`);
        return response.data;
    },

    /** GET /assets/{id}/qrcode/payload — Enriched QR payload JSON for an asset. */
    getQrPayload: async (id: string): Promise<Record<string, string>> => {
        const response = await api.get<Record<string, string>>(`/assets/${id}/qrcode/payload`);
        return response.data;
    },
};
