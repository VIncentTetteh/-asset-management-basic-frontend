import api from "@/lib/axios";
import { Supplier, SupplierDto } from "@/types";

/** Read organisationId from the cached user — needed as a query param for /suppliers */
const getOrgId = (): string => {
    if (typeof window !== "undefined") {
        try {
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            return user.organisationId || "";
        } catch {
            return "";
        }
    }
    return "";
};

export const supplierService = {
    /** GET /suppliers — backend requires organisationId as a query param */
    getAll: async (): Promise<Supplier[]> => {
        const orgId = getOrgId();
        const response = await api.get<Supplier[]>("/suppliers", {
            params: orgId ? { organisationId: orgId } : undefined,
        });
        return response.data;
    },

    /** GET /suppliers/{id} */
    get: async (id: string): Promise<Supplier> => {
        const response = await api.get<Supplier>(`/suppliers/${id}`);
        return response.data;
    },

    /** POST /suppliers */
    create: async (data: SupplierDto): Promise<Supplier> => {
        const response = await api.post<Supplier>("/suppliers", data);
        return response.data;
    },

    /** PUT /suppliers/{id} */
    update: async (id: string, data: SupplierDto): Promise<Supplier> => {
        const response = await api.put<Supplier>(`/suppliers/${id}`, data);
        return response.data;
    },

    /** DELETE /suppliers/{id} — soft delete */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/suppliers/${id}`);
    },
};
