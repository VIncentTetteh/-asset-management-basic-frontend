import api from "@/lib/axios";
import { User, UserDto } from "@/types";

export const userService = {
    getAll: async () => {
        const response = await api.get<User[]>("/users");
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<User>(`/users/${id}`);
        return response.data;
    },

    create: async (data: UserDto) => {
        const response = await api.post<User>("/users", data);
        return response.data;
    },

    update: async (id: string, data: UserDto) => {
        const response = await api.put<User>(`/users/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/users/${id}`);
    },
};
