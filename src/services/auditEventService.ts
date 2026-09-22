import api from "@/lib/axios";
import { AuditEvent, AuditEventFilterParams } from "@/types";
import { extractList, normalizePage, type NormalizedPage } from "@/services/responseUtils";

/** Rows per page; the API caps a page at 200. */
export const AUDIT_EVENTS_PAGE_SIZE = 50;

export const auditEventService = {
    /**
     * GET /audit-events — one page. The endpoint used to return every event the
     * tenant had ever recorded; it now answers a {@link NormalizedPage}.
     */
    getPage: async (
        params?: AuditEventFilterParams,
        page = 0,
        size = AUDIT_EVENTS_PAGE_SIZE,
    ): Promise<NormalizedPage<AuditEvent>> => {
        const response = await api.get("/audit-events", { params: { ...params, page, size } });
        return normalizePage<AuditEvent>(response.data);
    },

    /** GET /audit-events — the first page only, for callers that just want rows. */
    getAll: async (params?: AuditEventFilterParams): Promise<AuditEvent[]> => {
        const response = await api.get("/audit-events", { params: { ...params, page: 0, size: AUDIT_EVENTS_PAGE_SIZE } });
        return extractList<AuditEvent>(response.data);
    },

    /** GET /audit-events/{id} */
    get: async (id: string): Promise<AuditEvent> => {
        const response = await api.get<AuditEvent>(`/audit-events/${id}`);
        return response.data;
    },
};
