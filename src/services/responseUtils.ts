const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

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
