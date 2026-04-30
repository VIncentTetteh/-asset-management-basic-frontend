import api from "@/lib/axios";
import { Supplier, SupplierDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { invalidateRequestCache, withRequestCache } from "@/services/requestCache";

const getOrgId = (): string | undefined => {
    return getOrganisationIdFromStorage();
};

const withOrgParams = (params?: Record<string, string | number | boolean | undefined>) => ({
    ...(params || {}),
    organisationId: getOrgId(),
});

export const supplierService = {
    /** GET /suppliers */
    getAll: async (): Promise<Supplier[]> => {
        return withRequestCache(`suppliers:${getOrgId() ?? "default"}:list`, async () => {
            const response = await api.get("/suppliers", {
                params: withOrgParams(),
            });
            return extractList<Supplier>(response.data);
        }, 2 * 60_000);
    },

    /** GET /suppliers/{id} */
    get: async (id: string): Promise<Supplier> => {
        const response = await api.get<Supplier>(`/suppliers/${id}`, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** GET /suppliers/by-email */
    getByEmail: async (email: string): Promise<Supplier> => {
        const response = await api.get<Supplier>("/suppliers/by-email", {
            params: withOrgParams({ email }),
        });
        return response.data;
    },

    /** POST /suppliers */
    create: async (data: SupplierDto): Promise<Supplier> => {
        const payload: SupplierDto = {
            ...data,
            organisationId: data.organisationId || getOrgId(),
        };
        const response = await api.post<Supplier>("/suppliers", payload, {
            params: withOrgParams(),
        });
        invalidateRequestCache("suppliers:");
        return response.data;
    },

    /** PATCH /suppliers/{id} */
    update: async (id: string, data: Partial<SupplierDto>): Promise<Supplier> => {
        const payload: Partial<SupplierDto> = {
            ...data,
            organisationId: data.organisationId || getOrgId(),
        };
        const response = await api.patch<Supplier>(`/suppliers/${id}`, payload, {
            params: withOrgParams(),
        });
        invalidateRequestCache("suppliers:");
        return response.data;
    },

    /** DELETE /suppliers/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/suppliers/${id}`, {
            params: withOrgParams(),
        });
        invalidateRequestCache("suppliers:");
    },

    /** PUT /suppliers/{id} */
    replace: async (id: string, data: SupplierDto): Promise<Supplier> => {
        const payload: SupplierDto = {
            ...data,
            organisationId: data.organisationId || getOrgId(),
        };
        const response = await api.put<Supplier>(`/suppliers/${id}`, payload, {
            params: withOrgParams(),
        });
        invalidateRequestCache("suppliers:");
        return response.data;
    },
};
