import api from "@/lib/axios";
import { isAxiosError } from "axios";

export interface OrgStorageConfig {
    id?:            string;
    s3Enabled:      boolean;
    /** Request: the override ("" clears it). Response: the effective bucket (override or default). */
    bucketName?:    string;
    /** Response only: the organisation's own bucket, null when it uses the default. */
    bucketOverride?: string | null;
    /** Response only: the server-wide default bucket, if configured. */
    defaultBucket?: string | null;
    reportPrefix:   string;
    importPrefix:   string;
    presignMinutes: number;
}

/** The longest presigned-URL lifetime the API accepts (12 hours). */
export const MAX_PRESIGN_MINUTES = 720;

/**
 * Form values from the API response. The bucket field holds only the override:
 * pre-filling the effective (default) bucket made the first save pin it.
 */
export function storageFormFromResponse(c: OrgStorageConfig): OrgStorageConfig {
    return {
        s3Enabled: c.s3Enabled,
        bucketName: c.bucketOverride ?? "",
        reportPrefix: c.reportPrefix,
        importPrefix: c.importPrefix,
        presignMinutes: c.presignMinutes,
    };
}

/** PUT body: a blank bucket is sent as "" so the API clears the override. */
export function buildStoragePayload(form: OrgStorageConfig): OrgStorageConfig {
    return {
        s3Enabled: form.s3Enabled,
        bucketName: (form.bucketName ?? "").trim(),
        reportPrefix: form.reportPrefix,
        importPrefix: form.importPrefix,
        presignMinutes: Number(form.presignMinutes),
    };
}

/** An error for the TTL input, or null. Mirrors @Min(1) @Max(720) on the API. */
export function presignMinutesError(value: unknown): string | null {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PRESIGN_MINUTES) {
        return `Enter whole minutes from 1 to ${MAX_PRESIGN_MINUTES}`;
    }
    return null;
}

export const storageConfigService = {
    get: async (orgId: string): Promise<OrgStorageConfig | null> => {
        try {
            const r = await api.get<OrgStorageConfig>(`/organisations/${orgId}/storage-config`);
            return r.data;
        } catch (e: unknown) {
            if (isAxiosError(e) && e.response?.status === 404) return null;
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
