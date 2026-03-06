import api from "@/lib/axios";
import { DepreciationPolicy, DepreciationPolicyDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const withOrgParams = () => {
    const organisationId = getOrganisationIdFromStorage();
    return organisationId ? { organisationId } : undefined;
};

export const depreciationPolicyService = {
    /** GET /depreciation-policies — all in org (JWT-scoped) */
    getAll: async (): Promise<DepreciationPolicy[]> => {
        const response = await api.get("/depreciation-policies", { params: withOrgParams() });
        return extractList<DepreciationPolicy>(response.data);
    },

    /** GET /depreciation-policies/{id} */
    get: async (id: string): Promise<DepreciationPolicy> => {
        const response = await api.get<DepreciationPolicy>(`/depreciation-policies/${id}`);
        return response.data;
    },

    /** POST /depreciation-policies */
    create: async (data: DepreciationPolicyDto): Promise<DepreciationPolicy> => {
        const response = await api.post<DepreciationPolicy>("/depreciation-policies", data, { params: withOrgParams() });
        return response.data;
    },

    /** PATCH /depreciation-policies/{id} */
    update: async (id: string, data: Partial<DepreciationPolicyDto>): Promise<DepreciationPolicy> => {
        const response = await api.patch<DepreciationPolicy>(`/depreciation-policies/${id}`, data);
        return response.data;
    },

    /** DELETE /depreciation-policies/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/depreciation-policies/${id}`);
    },
};
