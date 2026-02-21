import api from "@/lib/axios";
import { Location, LocationDto } from "@/types";

export const locationService = {
    getAll: async (organisationId?: string) => {
        const params = organisationId ? { organisationId } : undefined;
        const response = await api.get<Location[]>("/locations", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<Location>(`/locations/${id}`);
        return response.data;
    },

    getSubLocations: async (parentId: string) => {
        const response = await api.get<Location[]>(`/locations/${parentId}/sub-locations`);
        return response.data;
    },

    create: async (data: LocationDto) => {
        const response = await api.post<Location>("/locations", data);
        return response.data;
    },

    update: async (id: string, data: LocationDto) => {
        const response = await api.put<Location>(`/locations/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/locations/${id}`);
    },
};
