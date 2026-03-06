import api from "@/lib/axios";
import { SsoConfig, SsoConfigDto } from "@/types";
import { extractList } from "@/services/responseUtils";

export const ssoConfigService = {
    /** GET /sso-configs — current org's SSO config */
    getAll: async (): Promise<SsoConfig[]> => {
        const response = await api.get("/sso-configs");
        return extractList<SsoConfig>(response.data);
    },

    /** GET /sso-configs/{id} */
    get: async (id: string): Promise<SsoConfig> => {
        const response = await api.get<SsoConfig>(`/sso-configs/${id}`);
        return response.data;
    },

    /** POST /sso-configs */
    create: async (data: SsoConfigDto): Promise<SsoConfig> => {
        const response = await api.post<SsoConfig>("/sso-configs", data);
        return response.data;
    },

    /** PUT /sso-configs/{id} */
    update: async (id: string, data: SsoConfigDto): Promise<SsoConfig> => {
        const response = await api.put<SsoConfig>(`/sso-configs/${id}`, data);
        return response.data;
    },

    /** DELETE /sso-configs/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/sso-configs/${id}`);
    },
};
