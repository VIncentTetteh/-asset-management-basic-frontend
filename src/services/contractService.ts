import api from "@/lib/axios";
import { Contract, ContractDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const getOrgId = (): string | undefined => getOrganisationIdFromStorage();

const withOrgParams = (params?: Record<string, string | number | boolean | undefined>) => ({
    ...(params || {}),
    organisationId: getOrgId(),
});

export const contractService = {
    /** POST /contracts */
    create: async (data: ContractDto): Promise<Contract> => {
        const response = await api.post<Contract>("/contracts", data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** GET /contracts */
    getAll: async (): Promise<Contract[]> => {
        const response = await api.get("/contracts", { params: withOrgParams() });
        return extractList<Contract>(response.data);
    },

    /** GET /contracts/expiring-soon?days=30 */
    getExpiringSoon: async (days = 30): Promise<Contract[]> => {
        const response = await api.get("/contracts/expiring-soon", {
            params: withOrgParams({ days }),
        });
        return extractList<Contract>(response.data);
    },

    /** PATCH /contracts/{id} */
    update: async (id: string, data: Partial<ContractDto>): Promise<Contract> => {
        const response = await api.patch<Contract>(`/contracts/${id}`, data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** DELETE /contracts/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/contracts/${id}`, { params: withOrgParams() });
    },

    /** GET /contracts/{id} */
    get: async (id: string): Promise<Contract> => {
        const response = await api.get<Contract>(`/contracts/${id}`, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** PUT /contracts/{id} */
    replace: async (id: string, data: ContractDto): Promise<Contract> => {
        const response = await api.put<Contract>(`/contracts/${id}`, data, {
            params: withOrgParams(),
        });
        return response.data;
    },
};
