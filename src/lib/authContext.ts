const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const normalized = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
        const decoded = atob(normalized);
        return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
        return null;
    }
};

export const getOrganisationIdFromStorage = (): string | undefined => {
    if (typeof window === "undefined") return undefined;

    try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const orgFromUser = user.organisationId || user.organizationId;
        if (typeof orgFromUser === "string" && orgFromUser) return orgFromUser;
    } catch {
        // no-op
    }

    const token = localStorage.getItem("token");
    if (!token) return undefined;

    const payload = decodeJwtPayload(token);
    if (!payload) return undefined;

    const orgFromToken = payload.organisationId || payload.organizationId;
    return typeof orgFromToken === "string" && orgFromToken ? orgFromToken : undefined;
};
