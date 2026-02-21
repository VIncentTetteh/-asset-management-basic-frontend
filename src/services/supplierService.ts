import api from "@/lib/axios";
import { Supplier, SupplierDto } from "@/types";

export const supplierService = {
    getAll: async (organisationId?: string) => {
        const params = organisationId ? { organisationId } : undefined;
        const response = await api.get<Supplier[]>("/suppliers", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<Supplier>(`/suppliers/${id}`);
        return response.data;
    },

    create: async (data: SupplierDto) => {
        const response = await api.post<Supplier>("/suppliers", data);
        return response.data;
    },

    update: async (id: string, data: SupplierDto) => {
        const response = await api.put<Supplier>(`/suppliers/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/suppliers/${id}`);
    },
};
