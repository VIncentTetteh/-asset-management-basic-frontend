import api from "@/lib/axios";
import { Category, CategoryDto } from "@/types";
import { extractList } from "@/services/responseUtils";
import { invalidateRequestCache, withRequestCache } from "@/services/requestCache";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

export const categoryService = {
    /** GET /categories — all in org (JWT-scoped) */
    getAll: async (): Promise<Category[]> => {
        return withRequestCache(`categories:${getOrganisationIdFromStorage() ?? "default"}:list`, async () => {
            const response = await api.get("/categories");
            return extractList<Category>(response.data);
        }, 5 * 60_000);
    },

    /** GET /categories/{id} */
    get: async (id: string): Promise<Category> => {
        return withRequestCache(`categories:${getOrganisationIdFromStorage() ?? "default"}:one:${id}`, async () => {
            const response = await api.get<Category>(`/categories/${id}`);
            return response.data;
        }, 5 * 60_000);
    },

    /** GET /categories/{parentId}/sub-categories */
    getSubCategories: async (parentId: string): Promise<Category[]> => {
        return withRequestCache(`categories:${getOrganisationIdFromStorage() ?? "default"}:children:${parentId}`, async () => {
            const response = await api.get(`/categories/${parentId}/sub-categories`);
            return extractList<Category>(response.data);
        }, 5 * 60_000);
    },

    /** POST /categories */
    create: async (data: CategoryDto): Promise<Category> => {
        const response = await api.post<Category>("/categories", data);
        invalidateRequestCache("categories:");
        return response.data;
    },

    /** PATCH /categories/{id} */
    update: async (id: string, data: Partial<CategoryDto>): Promise<Category> => {
        const response = await api.patch<Category>(`/categories/${id}`, data);
        invalidateRequestCache("categories:");
        return response.data;
    },

    /** DELETE /categories/{id} — soft delete */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/categories/${id}`);
        invalidateRequestCache("categories:");
    },

    /** PUT /categories/{id} */
    replace: async (id: string, data: CategoryDto): Promise<Category> => {
        const response = await api.put<Category>(`/categories/${id}`, data);
        invalidateRequestCache("categories:");
        return response.data;
    },
};
