import api from "@/lib/axios";
import { AssetAnalytics, FinancialAnalytics, PurchaseOrderAnalytics } from "@/types";

export interface AnalyticsFilterParams {
    period?: "month" | "quarter" | "year";
    groupBy?: "status" | "department" | "category" | "condition";
}

export const analyticsService = {
    getAssetAnalytics: async (params?: AnalyticsFilterParams): Promise<AssetAnalytics> => {
        const response = await api.get<AssetAnalytics>("/analytics/assets", { params });
        return response.data;
    },
    getFinancialAnalytics: async (params?: { period?: "month" | "quarter" | "year" }): Promise<FinancialAnalytics> => {
        const response = await api.get<FinancialAnalytics>("/analytics/financial", { params });
        return response.data;
    },
    getPurchaseOrderAnalytics: async (params?: { period?: "month" | "quarter" | "year" }): Promise<PurchaseOrderAnalytics> => {
        const response = await api.get<PurchaseOrderAnalytics>("/analytics/purchase-orders", { params });
        return response.data;
    }
};
