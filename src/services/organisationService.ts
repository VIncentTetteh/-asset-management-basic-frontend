import api from "@/lib/axios";
import { Organisation, OrganisationDto } from "@/types";

export const organisationService = {
    getAll: async () => {
        const response = await api.get<Organisation[]>("/organisations");
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<Organisation>(`/organisations/${id}`);
        return response.data;
    },

    create: async (data: OrganisationDto) => {
        const response = await api.post<Organisation>("/organisations", data);
        return response.data;
    },

    update: async (id: string, data: OrganisationDto) => {
        const response = await api.put<Organisation>(`/organisations/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/organisations/${id}`);
    },
};
