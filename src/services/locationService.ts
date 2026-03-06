import api from "@/lib/axios";
import { Location, LocationDto } from "@/types";
import { extractList } from "@/services/responseUtils";

export const locationService = {
    /** GET /locations — all in org (JWT-scoped) */
    getAll: async (): Promise<Location[]> => {
        const response = await api.get("/locations");
        return extractList<Location>(response.data);
    },

    /** GET /locations/{id} */
    get: async (id: string): Promise<Location> => {
        const response = await api.get<Location>(`/locations/${id}`);
        return response.data;
    },

    /** GET /locations/{parentId}/sub-locations */
    getSubLocations: async (parentId: string): Promise<Location[]> => {
        const response = await api.get(`/locations/${parentId}/sub-locations`);
        return extractList<Location>(response.data);
    },

    /** POST /locations */
    create: async (data: LocationDto): Promise<Location> => {
        const response = await api.post<Location>("/locations", data);
        return response.data;
    },

    /** PATCH /locations/{id} */
    update: async (id: string, data: Partial<LocationDto>): Promise<Location> => {
        const response = await api.patch<Location>(`/locations/${id}`, data);
        return response.data;
    },

    /** DELETE /locations/{id} — soft delete */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/locations/${id}`);
    },
};
