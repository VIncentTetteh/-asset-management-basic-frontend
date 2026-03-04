import api from "@/lib/axios";
import { PurchaseOrder, PurchaseOrderDto } from "@/types";

export interface POFilterParams {
    status?: string;
    departmentId?: string;
    supplierId?: string;
}

export const purchaseOrderService = {
    /** GET /purchase-orders — all for org (JWT-scoped) */
    getAll: async (params?: POFilterParams): Promise<PurchaseOrder[]> => {
        const response = await api.get<PurchaseOrder[]>("/purchase-orders", { params });
        return response.data;
    },

    /** GET /purchase-orders/{id} */
    get: async (id: string): Promise<PurchaseOrder> => {
        const response = await api.get<PurchaseOrder>(`/purchase-orders/${id}`);
        return response.data;
    },

    /** POST /purchase-orders */
    create: async (data: PurchaseOrderDto): Promise<PurchaseOrder> => {
        const response = await api.post<PurchaseOrder>("/purchase-orders", data);
        return response.data;
    },

    /** PUT /purchase-orders/{id} */
    update: async (id: string, data: PurchaseOrderDto): Promise<PurchaseOrder> => {
        const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}`, data);
        return response.data;
    },

    /**
     * POST /purchase-orders/{id}/approve
     * Approver is the currently authenticated user — no body or extra params needed.
     */
    approve: async (id: string): Promise<PurchaseOrder> => {
        const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/approve`);
        return response.data;
    },

    /** POST /purchase-orders/{id}/reject */
    reject: async (id: string): Promise<PurchaseOrder> => {
        const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/reject`);
        return response.data;
    },

    /** DELETE /purchase-orders/{id} — ADMIN only */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/purchase-orders/${id}`);
    },
};
