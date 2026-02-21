import api from "@/lib/axios";
import { Category, CategoryDto } from "@/types";

export const categoryService = {
    getAll: async (organisationId?: string) => {
        const params = organisationId ? { organisationId } : undefined;
        const response = await api.get<Category[]>("/categories", { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<Category>(`/categories/${id}`);
        return response.data;
    },

    getSubCategories: async (parentId: string) => {
        const response = await api.get<Category[]>(`/categories/${parentId}/sub-categories`);
        return response.data;
    },

    create: async (data: CategoryDto) => {
        const response = await api.post<Category>("/categories", data);
        return response.data;
    },

    update: async (id: string, data: CategoryDto) => {
        const response = await api.put<Category>(`/categories/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/categories/${id}`);
    },
};
