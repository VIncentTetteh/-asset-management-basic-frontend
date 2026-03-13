import api from "@/lib/axios";
import { DashboardSummary, AssetsByStatus, MaintenanceAlerts, AssetsByDepartment, DepreciationSummary } from "@/types";

export const dashboardService = {
    getSummary: async (): Promise<DashboardSummary> => {
        const response = await api.get<DashboardSummary>("/dashboard/summary");
        return response.data;
    },
    getAssetsByStatus: async (): Promise<AssetsByStatus> => {
        const response = await api.get<AssetsByStatus>("/dashboard/assets-by-status");
        return response.data;
    },
    getMaintenanceAlerts: async (): Promise<MaintenanceAlerts> => {
        const response = await api.get<MaintenanceAlerts>("/dashboard/maintenance-alerts");
        return response.data;
    },
    getAssetsByDepartment: async (): Promise<AssetsByDepartment> => {
        const response = await api.get<AssetsByDepartment>("/dashboard/assets-by-department");
        return response.data;
    },
    getDepreciationSummary: async (): Promise<DepreciationSummary> => {
        const response = await api.get<DepreciationSummary>("/dashboard/depreciation-summary");
        return response.data;
    },
};
