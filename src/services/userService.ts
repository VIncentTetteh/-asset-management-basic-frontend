import api from "@/lib/axios";
import { User, UserDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { AxiosError } from "axios";

export const userService = {
    /** GET /users — all users in org (JWT-scoped, no organisationId param) */
    getAll: async (): Promise<User[]> => {
        const response = await api.get("/users");
        return extractList<User>(response.data);
    },

    /** GET /users?departmentId={uuid} */
    getByDepartment: async (departmentId: string): Promise<User[]> => {
        const response = await api.get("/users", { params: { departmentId } });
        return extractList<User>(response.data);
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

    /** Update user: prefer PATCH (partial), fallback to PUT (full DTO) */
    update: async (id: string, data: Partial<UserDto>): Promise<User> => {
        const organisationId = data.organisationId || getOrganisationIdFromStorage();
        const patchPayload: Partial<UserDto> = {
            ...data,
            organisationId,
        };

        try {
            const patchResponse = await api.patch<User>(`/users/${id}`, patchPayload);
            return patchResponse.data;
        } catch (error) {
            const status = (error as AxiosError)?.response?.status;
            // If PATCH is unsupported on this backend, fallback to PUT.
            if (status !== 404 && status !== 405) {
                throw error;
            }
        }

        const existing = await userService.get(id);
        const putOrganisationId = data.organisationId || existing.organisationId || organisationId;

        const payload: UserDto = {
            id,
            firstName: data.firstName ?? existing.firstName,
            lastName: data.lastName ?? existing.lastName,
            email: data.email ?? existing.email,
            phone: data.phone ?? existing.phone,
            employeeId: data.employeeId ?? existing.employeeId,
            jobTitle: data.jobTitle ?? existing.jobTitle,
            roleId: data.roleId ?? existing.roleId,
            departmentId: data.departmentId ?? existing.departmentId,
            status: data.status ?? existing.status ?? "ACTIVE",
            organisationId: putOrganisationId,
        };

        const response = await api.put<User>(`/users/${id}`, payload);
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
