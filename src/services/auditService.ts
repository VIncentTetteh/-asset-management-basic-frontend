import api from "@/lib/axios";
import {
    Audit,
    AssetAuditDto,
    AuditItem,
    AuditItemDiscrepancyRequest,
    AuditItemVerifyRequest,
} from "@/types";
import { extractList } from "@/services/responseUtils";

/** GET /audits/{id}/items filters; every one is optional and they combine (AND). */
export interface AuditItemFilterParams {
    status?: string;
    discrepancyType?: string;
    /** Matches asset tag or name. */
    search?: string;
    /** 0-based. */
    page?: number;
    /** Server default 20, capped at 200. */
    size?: number;
}

/** The count sheet's standard envelope (PagedResponseDto). */
export interface AuditItemPage {
    total: number;
    limit: number;
    offset: number;
    items: AuditItem[];
}

/** GET /audits filters; every one is optional and they combine (AND). */
export interface AuditFilterParams {
    departmentId?: string;
    startDate?: string;       // YYYY-MM-DD
    endDate?: string;         // YYYY-MM-DD
    conductedById?: string;
    status?: string;
}

export const auditService = {
    /** GET /audits — all for org (JWT-scoped) */
    getAll: async (params?: AuditFilterParams): Promise<Audit[]> => {
        const response = await api.get("/audits", { params });
        return extractList<Audit>(response.data);
    },

    /** GET /audits/{id} */
    get: async (id: string): Promise<Audit> => {
        const response = await api.get<Audit>(`/audits/${id}`);
        return response.data;
    },

    /** GET /audits — convenience alias matching common service pattern */
    getById: async (id: string): Promise<Audit> => {
        const response = await api.get<Audit>(`/audits/${id}`);
        return response.data;
    },

    /** POST /audits */
    create: async (data: Partial<AssetAuditDto>): Promise<Audit> => {
        const response = await api.post<Audit>("/audits", data);
        return response.data;
    },

    /**
     * PATCH /audits/{id}/status?status={value}
     * status: PLANNED | IN_PROGRESS | COMPLETED | DISCREPANCY_FOUND | RESOLVED | CANCELLED,
     * limited to the transitions in features/audits/workflow.ts.
     */
    updateStatus: async (id: string, status: string): Promise<Audit> => {
        const response = await api.patch<Audit>(`/audits/${id}/status`, null, {
            params: { status }
        });
        return response.data;
    },

    // ── Count sheet ──────────────────────────────────────────────────────────

    /**
     * POST /audits/{id}/items/generate — builds or tops up the count sheet and
     * returns the audit with its progress refreshed. Idempotent.
     */
    generateItems: async (id: string): Promise<Audit> => {
        const response = await api.post<Audit>(`/audits/${id}/items/generate`);
        return response.data;
    },

    /** GET /audits/{id}/items — one page of the sheet. */
    listItems: async (id: string, params?: AuditItemFilterParams): Promise<AuditItemPage> => {
        const response = await api.get<AuditItemPage>(`/audits/${id}/items`, { params });
        return response.data;
    },

    /**
     * POST /audits/{id}/items/verify — records that an asset was sighted. `scan`
     * is whatever came off the label; the server parses a QR link, the legacy
     * `asset:<uuid>` text, a bare id, or an asset tag.
     */
    verifyItem: async (id: string, body: AuditItemVerifyRequest): Promise<AuditItem> => {
        const response = await api.post<AuditItem>(`/audits/${id}/items/verify`, body);
        return response.data;
    },

    /** POST /audits/{id}/items/{itemId}/discrepancy — flags one item as wrong. */
    flagItemDiscrepancy: async (
        id: string,
        itemId: string,
        body: AuditItemDiscrepancyRequest,
    ): Promise<AuditItem> => {
        const response = await api.post<AuditItem>(`/audits/${id}/items/${itemId}/discrepancy`, body);
        return response.data;
    },

    /** PATCH /audits/{id} — replace an open audit's remarks (blank clears them). */
    updateRemarks: async (id: string, remarks: string | null): Promise<Audit> => {
        const response = await api.patch<Audit>(`/audits/${id}`, { remarks });
        return response.data;
    },
};
