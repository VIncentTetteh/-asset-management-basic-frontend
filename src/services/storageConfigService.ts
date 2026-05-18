import api from "@/lib/axios";

export interface OrgStorageConfig {
    id?:            string;
    s3Enabled:      boolean;
    bucketName?:    string;
    reportPrefix:   string;
    importPrefix:   string;
    presignMinutes: number;
}

export const storageConfigService = {
    get: async (orgId: string): Promise<OrgStorageConfig | null> => {
        try {
            const r = await api.get<OrgStorageConfig>(`/organisations/${orgId}/storage-config`);
            return r.data;
        } catch (e: any) {
            if (e?.response?.status === 404) return null;
            throw e;
        }
    },

    save: async (orgId: string, data: OrgStorageConfig): Promise<OrgStorageConfig> => {
        const r = await api.put<OrgStorageConfig>(`/organisations/${orgId}/storage-config`, data);
        return r.data;
    },

    toggle: async (orgId: string, enabled: boolean): Promise<void> => {
        await api.patch(`/organisations/${orgId}/storage-config/toggle`, { enabled });
    },

    delete: async (orgId: string): Promise<void> => {
        await api.delete(`/organisations/${orgId}/storage-config`);
    },
};
