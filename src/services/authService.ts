import api from "@/lib/axios";
import { User, UserDto, LoginResponse } from "@/types";

/** Full tenant registration payload — POST /tenant/register */
export interface TenantRegistrationDto {
    // Organisation fields
    organisationName: string;               // required
    organisationContactEmail: string;       // required
    country?: string;
    address?: string;
    timezone?: string;
    industry?: string;
    registrationNumber?: string;
    taxId?: string;
    contactPhone?: string;
    // Admin user fields
    adminFirstName: string;                 // required
    adminLastName: string;                  // required
    adminEmail: string;                     // required
    adminPhone?: string;
    adminJobTitle?: string;
    password: string;                       // required, min 8 chars
}

export interface TenantRegistrationResponse {
    organisationId: string;
    adminUserId: string;
    message: string;
}

export const authService = {
    /** POST /tenant/register — creates org + first admin user */
    registerTenant: async (data: TenantRegistrationDto): Promise<TenantRegistrationResponse> => {
        const response = await api.post<TenantRegistrationResponse>("/tenant/register", data);
        return response.data;
    },

    /** POST /auth/register — register additional user within existing org */
    register: async (data: UserDto & { organisationId: string; roleId?: string }): Promise<User> => {
        const response = await api.post<User>("/auth/register", data);
        return response.data;
    },

    /** POST /auth/login */
    login: async (data: { email: string; password: string }): Promise<LoginResponse> => {
        const response = await api.post<LoginResponse>("/auth/login", data);
        return response.data;
    },

    /** GET /auth/profile */
    getProfile: async (): Promise<User> => {
        const response = await api.get<User>("/auth/profile");
        return response.data;
    },

    /** POST /auth/refresh — refreshes the JWT expiry to 24 h */
    refreshToken: async (): Promise<{ token: string; expiresIn: number; tokenType: string }> => {
        const response = await api.post<{ token: string; expiresIn: number; tokenType: string }>("/auth/refresh");
        return response.data;
    },

    /** POST /auth/logout */
    logout: async (): Promise<{ message: string }> => {
        const response = await api.post("/auth/logout");
        return response.data;
    },

    /** POST /auth/forgot-password */
    forgotPassword: async (data: { email: string }): Promise<{ message: string; token?: string }> => {
        const response = await api.post("/auth/forgot-password", data);
        return response.data;
    },

    /** POST /auth/reset-password */
    resetPassword: async (data: { token: string; newPassword: string }): Promise<{ message: string }> => {
        const response = await api.post("/auth/reset-password", data);
        return response.data;
    },
};
