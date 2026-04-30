import type { AxiosResponse } from "axios";

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

export interface NormalizedPage<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
    totalPages: number;
}

/**
 * Normalizes list responses that may come as:
 * - raw array: T[]
 * - paginated: { content: T[] }
 * - wrapped: { data: T[] } or custom key e.g. { users: T[] }
 */
export const extractList = <T>(payload: unknown, keys: string[] = []): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    if (!isObject(payload)) return [];

    const lookupKeys = [...keys, "content", "data", "items"];
    for (const key of lookupKeys) {
        const candidate = payload[key];
        if (Array.isArray(candidate)) return candidate as T[];
    }

    return [];
};

/** Normalizes an API response to an array of one-or-many entities. */
export const extractOneOrMany = <T>(payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    if (isObject(payload)) return [payload as T];
    return [];
};

export const normalizePage = <T>(payload: unknown): NormalizedPage<T> => {
    if (Array.isArray(payload)) {
        return {
            items: payload as T[],
            total: payload.length,
            limit: payload.length,
            offset: 0,
            totalPages: payload.length > 0 ? 1 : 0,
        };
    }

    if (!isObject(payload)) {
        return { items: [], total: 0, limit: 0, offset: 0, totalPages: 0 };
    }

    const items = extractList<T>(payload);
    const legacyPage = typeof payload.number === "number" ? payload.number : Number(payload.currentPage ?? 0);
    const limit = Number(payload.limit ?? payload.size ?? payload.pageSize ?? items.length);
    const offset = Number(payload.offset ?? (Number.isFinite(legacyPage) && Number.isFinite(limit) ? legacyPage * limit : 0));
    const total = Number(payload.total ?? payload.totalElements ?? items.length);
    const totalPages = Number(payload.totalPages ?? (limit > 0 ? Math.ceil(total / limit) : 0));

    return { items, total, limit, offset, totalPages };
};

const filenameFromDisposition = (contentDisposition?: string): string | null => {
    if (!contentDisposition) return null;
    const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    if (encoded) return decodeURIComponent(encoded.replace(/"/g, ""));
    const plain = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
    return plain || null;
};

export const downloadBlobResponse = (response: AxiosResponse<Blob>, fallbackFilename: string): string => {
    const filename = filenameFromDisposition(response.headers["content-disposition"]) || fallbackFilename;
    const blob = response.data;

    if (typeof window !== "undefined") {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    return filename;
};
