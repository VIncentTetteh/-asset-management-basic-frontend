import api from "@/lib/axios";
import { DashboardSummary, AssetsByStatus, MaintenanceAlerts, AssetsByDepartment, DepreciationSummary } from "@/types";

const withOrgParam = (organisationId?: string) =>
    organisationId ? { params: { org: organisationId } } : undefined;

export const dashboardService = {
    getSummary: async (organisationId?: string): Promise<DashboardSummary> => {
        const response = await api.get<DashboardSummary>("/dashboard/summary", withOrgParam(organisationId));
        return response.data;
    },
    getAssetsByStatus: async (organisationId?: string): Promise<AssetsByStatus> => {
        const response = await api.get<AssetsByStatus>("/dashboard/assets-by-status", withOrgParam(organisationId));
        return response.data;
    },
    getMaintenanceAlerts: async (organisationId?: string): Promise<MaintenanceAlerts> => {
        const response = await api.get<MaintenanceAlerts>("/dashboard/maintenance-alerts", withOrgParam(organisationId));
        return response.data;
    },
    getAssetsByDepartment: async (organisationId?: string): Promise<AssetsByDepartment> => {
        const response = await api.get<AssetsByDepartment>("/dashboard/assets-by-department", withOrgParam(organisationId));
        return response.data;
    },
    getDepreciationSummary: async (organisationId?: string): Promise<DepreciationSummary> => {
        const response = await api.get<DepreciationSummary>("/dashboard/depreciation-summary", withOrgParam(organisationId));
        return response.data;
    },
};
