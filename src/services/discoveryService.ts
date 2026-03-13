import api from "@/lib/axios";
import { DiscoveredDevice, DiscoveryScanDto, DiscoverySummary, PaginatedResponse } from "@/types";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const getOrgId = (): string | undefined => getOrganisationIdFromStorage();

const withOrgParams = (params?: Record<string, string | number | boolean | undefined>) => ({
    ...(params || {}),
    organisationId: getOrgId(),
});

export const discoveryService = {
    /** POST /discovery/scan */
    scan: async (data: DiscoveryScanDto): Promise<{ message: string; jobId?: string }> => {
        const response = await api.post<{ message: string; jobId?: string }>("/discovery/scan", data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** GET /discovery/devices?page=0&size=20 */
    getDevices: async (params?: { page?: number; size?: number }): Promise<PaginatedResponse<DiscoveredDevice>> => {
        const response = await api.get<PaginatedResponse<DiscoveredDevice>>("/discovery/devices", {
            params: withOrgParams({ page: params?.page ?? 0, size: params?.size ?? 20 }),
        });
        return response.data;
    },

    /** GET /discovery/devices/{id} */
    getDevice: async (id: string): Promise<DiscoveredDevice> => {
        const response = await api.get<DiscoveredDevice>(`/discovery/devices/${id}`, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** POST /discovery/devices/{id}/promote */
    promote: async (id: string): Promise<{ assetId: string; assetName: string; deviceId: string }> => {
        const response = await api.post<{ assetId: string; assetName: string; deviceId: string }>(
            `/discovery/devices/${id}/promote`,
            {},
            { params: withOrgParams() }
        );
        return response.data;
    },

    /** DELETE /discovery/devices/{id} */
    deleteDevice: async (id: string): Promise<void> => {
        await api.delete(`/discovery/devices/${id}`, { params: withOrgParams() });
    },

    /** GET /discovery/summary */
    getSummary: async (): Promise<DiscoverySummary> => {
        const response = await api.get<DiscoverySummary>("/discovery/summary", {
            params: withOrgParams(),
        });
        return response.data;
    },
};
