import api from "@/lib/axios";
import { DepreciationPolicy, DepreciationPolicyDto } from "@/types";

export const depreciationPolicyService = {
    getAll: async (organisationId?: string) => {
        const params = organisationId ? { organisationId } : undefined;
        const response = await api.get<DepreciationPolicy[]>("/depreciation-policies", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<DepreciationPolicy>(`/depreciation-policies/${id}`);
        return response.data;
    },

    create: async (data: DepreciationPolicyDto) => {
        const response = await api.post<DepreciationPolicy>("/depreciation-policies", data);
        return response.data;
    },

    update: async (id: string, data: DepreciationPolicyDto) => {
        const response = await api.put<DepreciationPolicy>(`/depreciation-policies/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/depreciation-policies/${id}`);
    },
};
