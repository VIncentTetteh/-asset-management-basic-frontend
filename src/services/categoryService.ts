import api from "@/lib/axios";
import { Category, CategoryDto } from "@/types";

export const categoryService = {
    /** GET /categories — all in org (JWT-scoped) */
    getAll: async (): Promise<Category[]> => {
        const response = await api.get<Category[]>("/categories");
        return response.data;
    },

    /** GET /categories/{id} */
    get: async (id: string): Promise<Category> => {
        const response = await api.get<Category>(`/categories/${id}`);
        return response.data;
    },

    /** GET /categories/{parentId}/sub-categories */
    getSubCategories: async (parentId: string): Promise<Category[]> => {
        const response = await api.get<Category[]>(`/categories/${parentId}/sub-categories`);
        return response.data;
    },

    /** POST /categories */
    create: async (data: CategoryDto): Promise<Category> => {
        const response = await api.post<Category>("/categories", data);
        return response.data;
    },

    /** PUT /categories/{id} */
    update: async (id: string, data: CategoryDto): Promise<Category> => {
        const response = await api.put<Category>(`/categories/${id}`, data);
        return response.data;
    },

    /** DELETE /categories/{id} — soft delete */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/categories/${id}`);
    },
};
