import api from "@/lib/axios";
import { User, UserDto } from "@/types";

export const userService = {
    /** GET /users — all users in org (JWT-scoped, no organisationId param) */
    getAll: async (): Promise<User[]> => {
        const response = await api.get<User[]>("/users");
        return response.data;
    },

    /** GET /users?departmentId={uuid} */
    getByDepartment: async (departmentId: string): Promise<User[]> => {
        const response = await api.get<User[]>("/users", { params: { departmentId } });
        return response.data;
    },

    /** GET /users/{id} */
    get: async (id: string): Promise<User> => {
        const response = await api.get<User>(`/users/${id}`);
        return response.data;
    },

    /** POST /users — password required on creation */
    create: async (data: UserDto & { password: string }): Promise<User> => {
        const response = await api.post<User>("/users", data);
        return response.data;
    },

    /** PUT /users/{id} — update profile (no password) */
    update: async (id: string, data: Omit<UserDto, "password">): Promise<User> => {
        const response = await api.put<User>(`/users/${id}`, data);
        return response.data;
    },

    /** PUT /users/{id}/deactivate — sets status → INACTIVE */
    deactivate: async (id: string): Promise<void> => {
        await api.put(`/users/${id}/deactivate`);
    },

    /** PUT /users/{id}/role?roleId={uuid} */
    assignRole: async (id: string, roleId: string): Promise<User> => {
        const response = await api.put<User>(`/users/${id}/role`, null, {
            params: { roleId }
        });
        return response.data;
    },
};
