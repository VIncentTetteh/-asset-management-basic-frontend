import api from "@/lib/axios";
import { SoftwareLicense, SoftwareLicenseDto, LicenseUtilization } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const getOrgId = (): string | undefined => getOrganisationIdFromStorage();

const withOrgParams = (params?: Record<string, string | number | boolean | undefined>) => ({
    ...(params || {}),
    organisationId: getOrgId(),
});

export const licenseService = {
    /** POST /licenses */
    create: async (data: SoftwareLicenseDto): Promise<SoftwareLicense> => {
        const response = await api.post<SoftwareLicense>("/licenses", data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** GET /licenses */
    getAll: async (): Promise<SoftwareLicense[]> => {
        const response = await api.get("/licenses", { params: withOrgParams() });
        return extractList<SoftwareLicense>(response.data);
    },

    /** GET /licenses/expiring-soon?days=30 */
    getExpiringSoon: async (days = 30): Promise<SoftwareLicense[]> => {
        const response = await api.get("/licenses/expiring-soon", {
            params: withOrgParams({ days }),
        });
        return extractList<SoftwareLicense>(response.data);
    },

    /** GET /licenses/over-allocated */
    getOverAllocated: async (): Promise<SoftwareLicense[]> => {
        const response = await api.get("/licenses/over-allocated", {
            params: withOrgParams(),
        });
        return extractList<SoftwareLicense>(response.data);
    },

    /** GET /licenses/utilization */
    getUtilization: async (): Promise<LicenseUtilization> => {
        const response = await api.get<LicenseUtilization>("/licenses/utilization", {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** PATCH /licenses/{id} */
    update: async (id: string, data: Partial<SoftwareLicenseDto>): Promise<SoftwareLicense> => {
        const response = await api.patch<SoftwareLicense>(`/licenses/${id}`, data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** DELETE /licenses/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/licenses/${id}`, { params: withOrgParams() });
    },
};
