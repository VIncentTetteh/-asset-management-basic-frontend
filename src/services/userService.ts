import api from "@/lib/axios";
import { User, UserDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { invalidateRequestCache, withRequestCache } from "@/services/requestCache";

/** Body of PUT /users/{id}. */
export interface UserProfileUpdate {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    jobTitle: string | null;
    employeeId: string | null;
    departmentId: string | null;
}

export const userService = {
    /** GET /users — all users in org (JWT-scoped, no organisationId param) */
    getAll: async (): Promise<User[]> => {
        return withRequestCache(`users:${getOrganisationIdFromStorage() ?? "default"}:list`, async () => {
            const response = await api.get("/users");
            return extractList<User>(response.data);
        }, 2 * 60_000);
    },

    /** GET /users?departmentId={uuid} */
    getByDepartment: async (departmentId: string): Promise<User[]> => {
        return withRequestCache(`users:${getOrganisationIdFromStorage() ?? "default"}:department:${departmentId}`, async () => {
            const response = await api.get("/users", { params: { departmentId } });
            return extractList<User>(response.data);
        }, 2 * 60_000);
    },

    /** GET /users/{id} */
    get: async (id: string): Promise<User> => {
        return withRequestCache(`users:${getOrganisationIdFromStorage() ?? "default"}:one:${id}`, async () => {
            const response = await api.get<User>(`/users/${id}`);
            return response.data;
        }, 2 * 60_000);
    },

    /** POST /users — password required on creation */
    create: async (data: UserDto & { password: string }): Promise<User> => {
        const response = await api.post<User>("/users", data);
        invalidateRequestCache("users:");
        return response.data;
    },

    /**
     * PUT /users/{id} — replaces the profile (name, phone, job title, employee id,
     * department). A missing optional field is cleared. Role and status have their
     * own endpoints (/role, /deactivate, /activate).
     */
    replaceProfile: async (id: string, data: UserProfileUpdate): Promise<User> => {
        const response = await api.put<User>(`/users/${id}`, data);
        invalidateRequestCache("users:");
        return response.data;
    },

    // ── Self-service (no admin role required) ──────────────────────────────────

    /** GET /users/me — returns the currently logged-in user's own profile. */
    getMe: async (): Promise<User> => {
        const response = await api.get<User>("/users/me");
        return response.data;
    },

    /**
     * PATCH /users/me — self-service profile update.
     * Only firstName, lastName, phone, and jobTitle are applied by the backend.
     * Use this instead of update() when a regular (non-admin) user saves their profile.
     */
    patchMe: async (data: Pick<UserDto, "firstName" | "lastName" | "phone" | "jobTitle">): Promise<User> => {
        const response = await api.patch<User>("/users/me", data);
        invalidateRequestCache("users:");
        return response.data;
    },

    /**
     * POST /users/me/password — change your own password. On success the API has
     * signed out every session, this one included.
     */
    changeMyPassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
        await api.post("/users/me/password", data);
    },

    /** PUT /users/{id}/deactivate — sets status → INACTIVE */
    deactivate: async (id: string): Promise<void> => {
        await api.put(`/users/${id}/deactivate`);
        invalidateRequestCache("users:");
    },

    /** PUT /users/{id}/activate — re-enable a deactivated user (fresh MFA). */
    activate: async (id: string): Promise<void> => {
        await api.put(`/users/${id}/activate`);
        invalidateRequestCache("users:");
    },

    /** DELETE /users/{id}/role — the user keeps their login but has no permissions. */
    removeRole: async (id: string): Promise<User> => {
        const response = await api.delete<User>(`/users/${id}/role`);
        return response.data;
    },

    /** PUT /users/{id}/role?roleId={uuid} */
    assignRole: async (id: string, roleId: string): Promise<User> => {
        const response = await api.put<User>(`/users/${id}/role`, null, {
            params: { roleId }
        });
        invalidateRequestCache("users:");
        return response.data;
    },
};
