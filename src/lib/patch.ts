export const buildPatchPayload = <T extends object>(prev: Partial<T>, next: Partial<T>): Partial<T> => {
    const patch: Partial<T> = {};
    (Object.keys(next as object) as (keyof T)[]).forEach((key) => {
        const nextValue = next[key];
        const prevValue = prev[key];
        if (JSON.stringify(nextValue) !== JSON.stringify(prevValue)) {
            patch[key] = nextValue;
        }
    });
    return patch;
};
