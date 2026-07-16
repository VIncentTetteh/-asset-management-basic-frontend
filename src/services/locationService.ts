import api from "@/lib/axios";
import { Location, LocationDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { invalidateRequestCache, withRequestCache } from "@/services/requestCache";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

export const locationService = {
    /** GET /locations — all in org (JWT-scoped) */
    getAll: async (): Promise<Location[]> => {
        return withRequestCache(`locations:${getOrganisationIdFromStorage() ?? "default"}:list`, async () => {
            const response = await api.get("/locations");
            return extractList<Location>(response.data);
        }, 5 * 60_000);
    },

    /** GET /locations/{id} */
    get: async (id: string): Promise<Location> => {
        return withRequestCache(`locations:${getOrganisationIdFromStorage() ?? "default"}:one:${id}`, async () => {
            const response = await api.get<Location>(`/locations/${id}`);
            return response.data;
        }, 5 * 60_000);
    },

    /** GET /locations/{parentId}/sub-locations */
    getSubLocations: async (parentId: string): Promise<Location[]> => {
        return withRequestCache(`locations:${getOrganisationIdFromStorage() ?? "default"}:children:${parentId}`, async () => {
            const response = await api.get(`/locations/${parentId}/sub-locations`);
            return extractList<Location>(response.data);
        }, 5 * 60_000);
    },

    /** POST /locations */
    create: async (data: LocationDto): Promise<Location> => {
        const response = await api.post<Location>("/locations", data);
        invalidateRequestCache("locations:");
        return response.data;
    },

    /** PATCH /locations/{id} */
    update: async (id: string, data: Partial<LocationDto>): Promise<Location> => {
        const response = await api.patch<Location>(`/locations/${id}`, data);
        invalidateRequestCache("locations:");
        return response.data;
    },

    /** DELETE /locations/{id} — soft delete */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/locations/${id}`);
        invalidateRequestCache("locations:");
    },

    /** PUT /locations/{id} */
    replace: async (id: string, data: LocationDto): Promise<Location> => {
        const response = await api.put<Location>(`/locations/${id}`, data);
        invalidateRequestCache("locations:");
        return response.data;
    },
};
