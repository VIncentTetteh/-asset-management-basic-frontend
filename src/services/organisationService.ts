import api from "@/lib/axios";
import { Organisation, OrganisationDto } from "@/types";

export const organisationService = {
    /**
     * GET /organisations — returns the current user's organisation.
     * The API may return a single object or an array; we normalise to always return an array.
     */
    getAll: async (): Promise<Organisation[]> => {
        const response = await api.get<Organisation | Organisation[]>("/organisations");
        const data = response.data;
        if (!data) return [];
        return Array.isArray(data) ? data : [data];
    },

    /** GET /organisations/{id} */
    get: async (id: string): Promise<Organisation> => {
        const response = await api.get<Organisation>(`/organisations/${id}`);
        return response.data;
    },

    /**
     * PUT /organisations/{id}
     * Full payload: name, address, country, contactEmail, contactPhone,
     * timezone, industry, registrationNumber, taxId, status
     */
    update: async (id: string, data: OrganisationDto): Promise<Organisation> => {
        const response = await api.put<Organisation>(`/organisations/${id}`, data);
        return response.data;
    },
};
