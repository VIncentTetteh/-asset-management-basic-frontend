import api from "@/lib/axios";
import { User } from "@/types";

export interface LoginResponse {
    token: string;
    user: User;
    expiresIn: number;
}

export const authService = {
    register: async (data: any) => {
        const response = await api.post("/auth/register", data);
        return response.data;
    },

    login: async (data: any): Promise<LoginResponse> => {
        const response = await api.post<LoginResponse>("/auth/login", data);
        return response.data;
    },

    getProfile: async (): Promise<User> => {
        const response = await api.get<User>("/auth/profile");
        return response.data;
    },

    refreshToken: async (): Promise<{ token: string, expiresIn: number }> => {
        const response = await api.post("/auth/refresh");
        return response.data;
    },

    logout: async () => {
        const response = await api.post("/auth/logout");
        return response.data;
    }
};
