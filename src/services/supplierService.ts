import api from "@/lib/axios";
import { Supplier, SupplierDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

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
        const response = await api.get("/suppliers", {
            params: withOrgParams(),
        });
        return extractList<Supplier>(response.data);
    },

    /** GET /suppliers/{id} */
    get: async (id: string): Promise<Supplier> => {
        const response = await api.get<Supplier>(`/suppliers/${id}`, {
            params: withOrgParams(),
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
        return response.data;
    },

    /** DELETE /suppliers/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/suppliers/${id}`, {
            params: withOrgParams(),
        });
    },
};
