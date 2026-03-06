import api from "@/lib/axios";
import { Organisation, OrganisationDto } from "@/types";
import { extractOneOrMany } from "@/services/responseUtils";

export const organisationService = {
    /**
     * GET /organisations — returns the current user's organisation.
     * The API may return a single object or an array; we normalise to always return an array.
     */
    getAll: async (): Promise<Organisation[]> => {
        const response = await api.get("/organisations");
        return extractOneOrMany<Organisation>(response.data);
    },

    /** GET /organisations/{id} */
    get: async (id: string): Promise<Organisation> => {
        const response = await api.get<Organisation>(`/organisations/${id}`);
        return response.data;
    },

    /** PATCH /organisations/{id} */
    update: async (id: string, data: Partial<OrganisationDto>): Promise<Organisation> => {
        const response = await api.patch<Organisation>(`/organisations/${id}`, data);
        return response.data;
    },
};
