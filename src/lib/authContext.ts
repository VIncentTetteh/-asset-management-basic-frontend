const USER_STORAGE_KEY = "user";
const VERIFIED_ORGANISATION_ID_STORAGE_KEY = "verifiedOrganisationId";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const asNonEmptyString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

const isUuid = (value: unknown): value is string =>
    typeof value === "string" && UUID_PATTERN.test(value.trim());

const parseStoredUser = (): Record<string, unknown> | null => {
    if (typeof window === "undefined") return null;

    try {
        return asRecord(JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "null"));
    } catch {
        return null;
    }
};

export const extractOrganisationId = (value: unknown): string | undefined => {
    const record = asRecord(value);
    if (!record) return undefined;

    const direct = asNonEmptyString(record.organisationId ?? record.organizationId);
    if (isUuid(direct)) return direct;

    const nestedOrg =
        asRecord(record.organisation)
        ?? asRecord(record.organization)
        ?? asRecord(record.org);
    const nestedId = asNonEmptyString(nestedOrg?.id);
    if (isUuid(nestedId)) return nestedId;

    return undefined;
};

export const extractOrganisationName = (value: unknown): string | undefined => {
    const record = asRecord(value);
    if (!record) return undefined;

    const direct = asNonEmptyString(record.organisationName ?? record.organizationName);
    if (direct) return direct;

    const nestedOrg =
        asRecord(record.organisation)
        ?? asRecord(record.organization)
        ?? asRecord(record.org);
    return asNonEmptyString(nestedOrg?.name);
};

export const getStoredUser = (): Record<string, unknown> | null => parseStoredUser();

export const setStoredUser = (user: unknown): void => {
    if (typeof window === "undefined") return;

    const record = asRecord(user);
    if (!record) {
        localStorage.removeItem(USER_STORAGE_KEY);
        return;
    }

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(record));
};

export const mergeStoredUser = (partial: unknown): Record<string, unknown> | null => {
    if (typeof window === "undefined") return null;

    const next = asRecord(partial);
    const current = parseStoredUser() ?? {};
    const merged = next ? { ...current, ...next } : current;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
    return merged;
};

export const clearVerifiedOrganisationId = (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(VERIFIED_ORGANISATION_ID_STORAGE_KEY);
};

export const setVerifiedOrganisationId = (organisationId?: string | null): void => {
    if (typeof window === "undefined") return;

    if (!organisationId || !isUuid(organisationId)) {
        localStorage.removeItem(VERIFIED_ORGANISATION_ID_STORAGE_KEY);
        return;
    }

    localStorage.setItem(VERIFIED_ORGANISATION_ID_STORAGE_KEY, organisationId);
};

export const getVerifiedOrganisationIdFromStorage = (): string | undefined => {
    if (typeof window === "undefined") return undefined;

    const stored = localStorage.getItem(VERIFIED_ORGANISATION_ID_STORAGE_KEY);
    return isUuid(stored) ? stored : undefined;
};

export const verifyOrganisationContext = (value: unknown): string | undefined => {
    const organisationId = extractOrganisationId(value);
    setVerifiedOrganisationId(organisationId);
    return organisationId;
};

export const getOrganisationIdFromStorage = (): string | undefined => {
    return getVerifiedOrganisationIdFromStorage();
};
