import api from "@/lib/axios";
import { SoftwareLicense, SoftwareLicenseDto, LicenseUtilization } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const getOrgId = (): string | undefined => getOrganisationIdFromStorage();

const withOrgParams = (params?: Record<string, string | number | boolean | undefined>) => ({
    ...(params || {}),
    organisationId: getOrgId(),
});

const normalizeLicense = (license: any): SoftwareLicense => {
    if (!license) return license as SoftwareLicense;
    return {
        ...license,
        productName: license.productName ?? license.name ?? "",
    } as SoftwareLicense;
};

const normalizeLicenseList = (data: any): SoftwareLicense[] => {
    const list = extractList<SoftwareLicense>(data);
    return list.map(normalizeLicense);
};

const normalizePayload = (data: Partial<SoftwareLicenseDto>) => {
    const payload: Record<string, unknown> = { ...data };
    if (payload.productName && !payload.name) {
        payload.name = payload.productName;
    }
    delete payload.productName;
    return payload;
};

export const licenseService = {
    /** POST /licenses */
    create: async (data: SoftwareLicenseDto): Promise<SoftwareLicense> => {
        const response = await api.post<SoftwareLicense>("/licenses", normalizePayload(data), {
            params: withOrgParams(),
        });
        return normalizeLicense(response.data);
    },

    /** GET /licenses */
    getAll: async (): Promise<SoftwareLicense[]> => {
        const response = await api.get("/licenses", { params: withOrgParams() });
        return normalizeLicenseList(response.data);
    },

    /** GET /licenses/expiring-soon?days=30 */
    getExpiringSoon: async (days = 30): Promise<SoftwareLicense[]> => {
        const response = await api.get("/licenses/expiring-soon", {
            params: withOrgParams({ days }),
        });
        return normalizeLicenseList(response.data);
    },

    /** GET /licenses/over-allocated */
    getOverAllocated: async (): Promise<SoftwareLicense[]> => {
        const response = await api.get("/licenses/over-allocated", {
            params: withOrgParams(),
        });
        return normalizeLicenseList(response.data);
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
        const response = await api.patch<SoftwareLicense>(`/licenses/${id}`, normalizePayload(data), {
            params: withOrgParams(),
        });
        return normalizeLicense(response.data);
    },

    /** DELETE /licenses/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/licenses/${id}`, { params: withOrgParams() });
    },

    /** GET /licenses/{id} */
    get: async (id: string): Promise<SoftwareLicense> => {
        const response = await api.get<SoftwareLicense>(`/licenses/${id}`, { params: withOrgParams() });
        return normalizeLicense(response.data);
    },

    /** PUT /licenses/{id} */
    replace: async (id: string, data: SoftwareLicenseDto): Promise<SoftwareLicense> => {
        const response = await api.put<SoftwareLicense>(`/licenses/${id}`, normalizePayload(data), { params: withOrgParams() });
        return normalizeLicense(response.data);
    },
};
