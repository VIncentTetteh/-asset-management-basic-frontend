import api from "@/lib/axios";
import { PurchaseOrder, PurchaseOrderDto } from "@/types";

export interface POFilterParams {
    organisationId?: string;
    status?: string;
}

export const purchaseOrderService = {
    getAll: async (params?: POFilterParams) => {
        const response = await api.get<PurchaseOrder[]>("/purchase-orders", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<PurchaseOrder>(`/purchase-orders/${id}`);
        return response.data;
    },

    create: async (data: PurchaseOrderDto) => {
        const response = await api.post<PurchaseOrder>("/purchase-orders", data);
        return response.data;
    },

    update: async (id: string, data: PurchaseOrderDto): Promise<PurchaseOrder> => {
        const response = await api.put(`/purchase-orders/${id}`, data);
        return response.data;
    },

    updateStatus: async (id: string, status: string): Promise<PurchaseOrder> => {
        const response = await api.patch(`/purchase-orders/${id}/status`, { status });
        return response.data;
    },

    approve: async (id: string, approvedById: string) => {
        const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/approve`, null, {
            params: { approvedById }
        });
        return response.data;
    },

    reject: async (id: string) => {
        const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/reject`);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/purchase-orders/${id}`);
    },
};
