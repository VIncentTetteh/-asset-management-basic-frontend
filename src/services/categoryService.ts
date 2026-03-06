import api from "@/lib/axios";
import { Category, CategoryDto } from "@/types";
import { extractList } from "@/services/responseUtils";

export const categoryService = {
    /** GET /categories — all in org (JWT-scoped) */
    getAll: async (): Promise<Category[]> => {
        const response = await api.get("/categories");
        return extractList<Category>(response.data);
    },

    /** GET /categories/{id} */
    get: async (id: string): Promise<Category> => {
        const response = await api.get<Category>(`/categories/${id}`);
        return response.data;
    },

    /** GET /categories/{parentId}/sub-categories */
    getSubCategories: async (parentId: string): Promise<Category[]> => {
        const response = await api.get(`/categories/${parentId}/sub-categories`);
        return extractList<Category>(response.data);
    },

    /** POST /categories */
    create: async (data: CategoryDto): Promise<Category> => {
        const response = await api.post<Category>("/categories", data);
        return response.data;
    },

    /** PATCH /categories/{id} */
    update: async (id: string, data: Partial<CategoryDto>): Promise<Category> => {
        const response = await api.patch<Category>(`/categories/${id}`, data);
        return response.data;
    },

    /** DELETE /categories/{id} — soft delete */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/categories/${id}`);
    },
};
