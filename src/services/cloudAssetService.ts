import api from "@/lib/axios";
import { CloudAsset, CloudAssetDto, CloudCostSummary, CloudMonthlyCostDto, PaginatedResponse } from "@/types";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const getOrgId = (): string | undefined => getOrganisationIdFromStorage();

const withOrgParams = (params?: Record<string, string | number | boolean | undefined>) => ({
    ...(params || {}),
    organisationId: getOrgId(),
});

export const cloudAssetService = {
    /** POST /cloud-assets */
    create: async (data: CloudAssetDto): Promise<CloudAsset> => {
        const response = await api.post<CloudAsset>("/cloud-assets", data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** GET /cloud-assets?provider=&environment=&page=0&size=20 */
    getAll: async (params?: { provider?: string; environment?: string; page?: number; size?: number }): Promise<PaginatedResponse<CloudAsset>> => {
        const response = await api.get<PaginatedResponse<CloudAsset>>("/cloud-assets", {
            params: withOrgParams({
                ...(params?.provider ? { provider: params.provider } : {}),
                ...(params?.environment ? { environment: params.environment } : {}),
                page: params?.page ?? 0,
                size: params?.size ?? 20,
            }),
        });
        return response.data;
    },

    /** GET /cloud-assets/{id} */
    get: async (id: string): Promise<CloudAsset> => {
        const response = await api.get<CloudAsset>(`/cloud-assets/${id}`, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** PUT /cloud-assets/{id} */
    update: async (id: string, data: CloudAssetDto): Promise<CloudAsset> => {
        const response = await api.put<CloudAsset>(`/cloud-assets/${id}`, data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** DELETE /cloud-assets/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/cloud-assets/${id}`, { params: withOrgParams() });
    },

    /** GET /cloud-assets/cost-summary */
    getCostSummary: async (): Promise<CloudCostSummary> => {
        const response = await api.get<CloudCostSummary>("/cloud-assets/cost-summary", {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** POST /cloud-assets/{id}/cost */
    recordMonthlyCost: async (id: string, data: CloudMonthlyCostDto): Promise<void> => {
        await api.post(`/cloud-assets/${id}/cost`, data, { params: withOrgParams() });
    },
};
