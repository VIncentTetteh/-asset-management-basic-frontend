import api from "@/lib/axios";
import { DepreciationPolicy, DepreciationPolicyDto } from "@/types";

export const depreciationPolicyService = {
    /** GET /depreciation-policies — all in org (JWT-scoped) */
    getAll: async (): Promise<DepreciationPolicy[]> => {
        const response = await api.get<DepreciationPolicy[]>("/depreciation-policies");
        return response.data;
    },

    /** GET /depreciation-policies/{id} */
    get: async (id: string): Promise<DepreciationPolicy> => {
        const response = await api.get<DepreciationPolicy>(`/depreciation-policies/${id}`);
        return response.data;
    },

    /** POST /depreciation-policies */
    create: async (data: DepreciationPolicyDto): Promise<DepreciationPolicy> => {
        const response = await api.post<DepreciationPolicy>("/depreciation-policies", data);
        return response.data;
    },

    /** PUT /depreciation-policies/{id} */
    update: async (id: string, data: DepreciationPolicyDto): Promise<DepreciationPolicy> => {
        const response = await api.put<DepreciationPolicy>(`/depreciation-policies/${id}`, data);
        return response.data;
    },

    /** DELETE /depreciation-policies/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/depreciation-policies/${id}`);
    },
};
