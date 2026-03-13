import api from "@/lib/axios";
import { Budget, BudgetDto, BudgetSpendDto } from "@/types";
import { extractList } from "@/services/responseUtils";

export const budgetService = {
    /** POST /budgets */
    create: async (data: BudgetDto): Promise<Budget> => {
        const response = await api.post<Budget>("/budgets", data);
        return response.data;
    },

    /** GET /budgets */
    getAll: async (): Promise<Budget[]> => {
        const response = await api.get("/budgets");
        return extractList<Budget>(response.data);
    },

    /** POST /budgets/{id}/spend */
    recordSpend: async (id: string, data: BudgetSpendDto): Promise<Budget> => {
        const response = await api.post<Budget>(`/budgets/${id}/spend`, data);
        return response.data;
    },

    /** PATCH /budgets/{id} */
    update: async (id: string, data: Partial<BudgetDto>): Promise<Budget> => {
        const response = await api.patch<Budget>(`/budgets/${id}`, data);
        return response.data;
    },

    /** DELETE /budgets/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/budgets/${id}`);
    },
};
