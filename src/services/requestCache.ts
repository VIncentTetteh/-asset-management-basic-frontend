type CacheEntry<T> = {
    expiresAt: number;
    value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();

export const withRequestCache = async <T>(
    key: string,
    loader: () => Promise<T>,
    ttlMs = 60_000,
): Promise<T> => {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
        return hit.value as T;
    }
    const value = await loader();
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
};

export const invalidateRequestCache = (prefix?: string) => {
    if (!prefix) {
        cache.clear();
        return;
    }
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) cache.delete(key);
    }
};
