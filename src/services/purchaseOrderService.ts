import api from "@/lib/axios";
import { PurchaseOrder, PurchaseOrderDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

export interface POFilterParams {
    status?: string;
    departmentId?: string;
    supplierId?: string;
    organisationId?: string;
}

const getOrgId = (): string | undefined => {
    return getOrganisationIdFromStorage();
};

const requireOrgId = (): string => {
    const orgId = getOrgId();
    if (!orgId) {
        throw new Error("Organisation ID is required");
    }
    return orgId;
};

const withOrgParams = (params?: POFilterParams): POFilterParams => {
    const orgId = getOrgId();
    return orgId ? { ...(params || {}), organisationId: orgId } : { ...(params || {}) };
};

export const purchaseOrderService = {
    /** GET /purchase-orders — all for org (JWT-scoped) */
    getAll: async (params?: POFilterParams): Promise<PurchaseOrder[]> => {
        const response = await api.get("/purchase-orders", { params: withOrgParams(params) });
        return extractList<PurchaseOrder>(response.data);
    },

    /** GET /purchase-orders/{id} */
    get: async (id: string): Promise<PurchaseOrder> => {
        const response = await api.get<PurchaseOrder>(`/purchase-orders/${id}`, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** POST /purchase-orders */
    create: async (data: PurchaseOrderDto): Promise<PurchaseOrder> => {
        const organisationId = data.organisationId || requireOrgId();
        const payload: PurchaseOrderDto = { ...data, organisationId };
        delete payload.id;
        const response = await api.post<PurchaseOrder>("/purchase-orders", payload, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** PATCH /purchase-orders/{id} */
    update: async (id: string, data: Partial<PurchaseOrderDto>): Promise<PurchaseOrder> => {
        const organisationId = data.organisationId || getOrgId();
        const payload: Partial<PurchaseOrderDto> = { ...data };
        if (organisationId) {
            payload.organisationId = organisationId;
        }
        delete payload.id;
        const response = await api.patch<PurchaseOrder>(`/purchase-orders/${id}`, payload, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** POST /purchase-orders/{id}/submit — DRAFT → SUBMITTED; the caller becomes the maker. */
    submit: async (id: string): Promise<PurchaseOrder> => {
        const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/submit`, null, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** POST /purchase-orders/{id}/receive — APPROVED → DELIVERED; commitment becomes spend. */
    receive: async (id: string): Promise<PurchaseOrder> => {
        const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`, null, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** POST /purchase-orders/{id}/cancel — releases an approved order's budget commitment. */
    cancel: async (id: string): Promise<PurchaseOrder> => {
        const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`, null, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /**
     * POST /purchase-orders/{id}/approve
     * Approver is the currently authenticated user — no body or extra params needed.
     */
    approve: async (id: string): Promise<PurchaseOrder> => {
        const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/approve`, null, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** POST /purchase-orders/{id}/reject with the (required) reason. */
    reject: async (id: string, reason: string): Promise<PurchaseOrder> => {
        const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/reject`, { reason }, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** DELETE /purchase-orders/{id} — ADMIN only */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/purchase-orders/${id}`, {
            params: withOrgParams(),
        });
    },

    /** PUT /purchase-orders/{id} */
    replace: async (id: string, data: PurchaseOrderDto): Promise<PurchaseOrder> => {
        const organisationId = data.organisationId || requireOrgId();
        const payload: PurchaseOrderDto = { ...data, organisationId };
        delete payload.id;
        const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}`, payload, {
            params: withOrgParams(),
        });
        return response.data;
    },
};
