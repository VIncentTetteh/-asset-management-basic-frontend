import api from "@/lib/axios";
import { DepreciationPolicy, DepreciationPolicyDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { invalidateRequestCache, withRequestCache } from "@/services/requestCache";

const withOrgParams = () => {
    const organisationId = getOrganisationIdFromStorage();
    return organisationId ? { organisationId } : undefined;
};

export const depreciationPolicyService = {
    /** GET /depreciation-policies — all in org (JWT-scoped) */
    getAll: async (): Promise<DepreciationPolicy[]> => {
        return withRequestCache(`depreciation-policies:${getOrganisationIdFromStorage() ?? "default"}:list`, async () => {
            const response = await api.get("/depreciation-policies", { params: withOrgParams() });
            return extractList<DepreciationPolicy>(response.data);
        }, 5 * 60_000);
    },

    /** GET /depreciation-policies/{id} */
    get: async (id: string): Promise<DepreciationPolicy> => {
        return withRequestCache(`depreciation-policies:${getOrganisationIdFromStorage() ?? "default"}:one:${id}`, async () => {
            const response = await api.get<DepreciationPolicy>(`/depreciation-policies/${id}`);
            return response.data;
        }, 5 * 60_000);
    },

    /** POST /depreciation-policies */
    create: async (data: DepreciationPolicyDto): Promise<DepreciationPolicy> => {
        const response = await api.post<DepreciationPolicy>("/depreciation-policies", data, { params: withOrgParams() });
        invalidateRequestCache("depreciation-policies:");
        return response.data;
    },

    /** PATCH /depreciation-policies/{id} */
    update: async (id: string, data: Partial<DepreciationPolicyDto>): Promise<DepreciationPolicy> => {
        const response = await api.patch<DepreciationPolicy>(`/depreciation-policies/${id}`, data);
        invalidateRequestCache("depreciation-policies:");
        return response.data;
    },

    /** DELETE /depreciation-policies/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/depreciation-policies/${id}`);
        invalidateRequestCache("depreciation-policies:");
    },

    /** PUT /depreciation-policies/{id} */
    replace: async (id: string, data: DepreciationPolicyDto): Promise<DepreciationPolicy> => {
        const response = await api.put<DepreciationPolicy>(`/depreciation-policies/${id}`, data);
        invalidateRequestCache("depreciation-policies:");
        return response.data;
    },
};
