import api from "@/lib/axios";
import { DashboardSummary, AssetsByStatus, MaintenanceAlerts } from "@/types";

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
    }
};
