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

const normalizePoStatus = (status?: string): string | undefined => {
    if (!status) return undefined;
    if (status === "PENDING") return "SUBMITTED";
    if (status === "RECEIVED" || status === "ORDERED") return "DELIVERED";
    return status;
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
        const payload: PurchaseOrderDto = {
            ...data,
            organisationId,
            status: normalizePoStatus(data.status) as PurchaseOrderDto["status"],
        };
        delete payload.id;
        const response = await api.post<PurchaseOrder>("/purchase-orders", payload, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** PATCH /purchase-orders/{id} */
    update: async (id: string, data: Partial<PurchaseOrderDto>): Promise<PurchaseOrder> => {
        const organisationId = data.organisationId || getOrgId();
        const payload: Partial<PurchaseOrderDto> = {
            ...data,
            status: normalizePoStatus(data.status),
        };
        if (organisationId) {
            payload.organisationId = organisationId;
        }
        delete payload.id;
        const response = await api.patch<PurchaseOrder>(`/purchase-orders/${id}`, payload, {
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

    /** POST /purchase-orders/{id}/reject */
    reject: async (id: string): Promise<PurchaseOrder> => {
        const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/reject`, null, {
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
};
