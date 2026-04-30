import api from "@/lib/axios";
import { PredictiveInsight, InsightSummary, InsightFilterParams } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const getOrgId = (): string | undefined => getOrganisationIdFromStorage();

const withOrgParams = (params?: Record<string, string | number | boolean | undefined>) => ({
    ...(params || {}),
    organisationId: getOrgId(),
});

export const aiInsightsService = {
    /** POST /ai/insights/generate — re-analyze all assets & refresh insights.
     *  API spec: returns Array<PredictiveInsight>.
     *  Legacy behaviour: may return { message: string } — handled gracefully. */
    generate: async (): Promise<PredictiveInsight[]> => {
        const response = await api.post("/ai/insights/generate", {}, {
            params: withOrgParams(),
        });
        const data = response.data;
        // Spec: Array<PredictiveInsight>
        if (Array.isArray(data)) return data as PredictiveInsight[];
        // Fallback: old { message } shape — return empty array so callers stay stable
        return [];
    },

    /** GET /ai/insights?type=&severity=&unresolvedOnly=true */
    getAll: async (params?: InsightFilterParams): Promise<PredictiveInsight[]> => {
        const response = await api.get("/ai/insights", {
            params: withOrgParams({
                ...(params?.type ? { type: params.type } : {}),
                ...(params?.severity ? { severity: params.severity } : {}),
                unresolvedOnly: params?.unresolvedOnly ?? true,
            }),
        });
        return extractList<PredictiveInsight>(response.data);
    },

    /** GET /ai/insights/{id} */
    get: async (id: string): Promise<PredictiveInsight> => {
        const response = await api.get<PredictiveInsight>(`/ai/insights/${id}`, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** POST /ai/insights/{id}/resolve */
    resolve: async (id: string): Promise<void> => {
        await api.post(`/ai/insights/${id}/resolve`, {}, { params: withOrgParams() });
    },

    /** GET /ai/insights/summary */
    getSummary: async (): Promise<InsightSummary> => {
        const response = await api.get<InsightSummary>("/ai/insights/summary", {
            params: withOrgParams(),
        });
        return response.data;
    },
};
