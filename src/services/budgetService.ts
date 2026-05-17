import api from "@/lib/axios";
import { Budget, BudgetDto, BudgetSpendDto, BudgetSummary, Expense } from "@/types";
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

    /** GET /budgets/{id} */
    get: async (id: string): Promise<Budget> => {
        const response = await api.get<Budget>(`/budgets/${id}`);
        return response.data;
    },

    /** PUT /budgets/{id} */
    replace: async (id: string, data: BudgetDto): Promise<Budget> => {
        const response = await api.put<Budget>(`/budgets/${id}`, data);
        return response.data;
    },

    /** GET /budgets/summary */
    getSummary: async (): Promise<BudgetSummary> => {
        const response = await api.get<BudgetSummary>("/budgets/summary");
        return response.data;
    },

    /** GET /budgets/{id}/expenses */
    getExpenses: async (id: string, page = 0, size = 20): Promise<{ total: number; limit: number; offset: number; items: Expense[] }> => {
        const response = await api.get(`/budgets/${id}/expenses`, { params: { page, size } });
        return response.data;
    },

    /** POST /budgets/{id}/adjustment */
    recordAdjustment: async (id: string, data: { amount: number; note: string }): Promise<Budget> => {
        const response = await api.post<Budget>(`/budgets/${id}/adjustment`, data);
        return response.data;
    },
};
