import api from "@/lib/axios";
import { Budget, BudgetDto, BudgetSpendDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const getOrgId = (): string | undefined => getOrganisationIdFromStorage();

const withOrgParams = (params?: Record<string, string | number | boolean | undefined>) => ({
    ...(params || {}),
    organisationId: getOrgId(),
});

export const budgetService = {
    /** POST /budgets */
    create: async (data: BudgetDto): Promise<Budget> => {
        const response = await api.post<Budget>("/budgets", data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** GET /budgets */
    getAll: async (): Promise<Budget[]> => {
        const response = await api.get("/budgets", { params: withOrgParams() });
        return extractList<Budget>(response.data);
    },

    /** POST /budgets/{id}/spend */
    recordSpend: async (id: string, data: BudgetSpendDto): Promise<Budget> => {
        const response = await api.post<Budget>(`/budgets/${id}/spend`, data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** PATCH /budgets/{id} */
    update: async (id: string, data: Partial<BudgetDto>): Promise<Budget> => {
        const response = await api.patch<Budget>(`/budgets/${id}`, data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** DELETE /budgets/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/budgets/${id}`, { params: withOrgParams() });
    },
};
