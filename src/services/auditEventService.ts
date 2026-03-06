import api from "@/lib/axios";
import { AuditEvent, AuditEventFilterParams } from "@/types";
import { extractList } from "@/services/responseUtils";

export const auditEventService = {
    /** GET /audit-events */
    getAll: async (params?: AuditEventFilterParams): Promise<AuditEvent[]> => {
        const response = await api.get("/audit-events", { params });
        return extractList<AuditEvent>(response.data);
    },

    /** GET /audit-events/{id} */
    get: async (id: string): Promise<AuditEvent> => {
        const response = await api.get<AuditEvent>(`/audit-events/${id}`);
        return response.data;
    },
};

