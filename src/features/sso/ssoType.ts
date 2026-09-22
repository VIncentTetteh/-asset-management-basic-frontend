import type { OrgSsoConfig } from "@/types";

/** The two SSO protocols an organisation can use. Only one is active at a time. */
export type SsoType = "oauth2" | "saml";

/**
 * Which SSO type the stored configuration currently holds, mirroring the backend
 * rule in `SsoConfigServiceImpl`: provider SAML means SAML; any other provider
 * with a client ID or issuer means OAuth2; otherwise nothing is configured yet.
 */
export function activeSsoType(config: OrgSsoConfig | null | undefined): SsoType | null {
    if (!config) return null;
    if (config.provider === "SAML") return "saml";
    if (config.clientId?.trim() || config.issuerUri?.trim()) return "oauth2";
    return null;
}

/**
 * True when saving `target` would replace a different configured type. The API
 * refuses such a save with 409 unless `replaceExisting=true` is sent, so the page
 * must warn first.
 */
export function needsReplaceConfirmation(config: OrgSsoConfig | null | undefined, target: SsoType): boolean {
    const current = activeSsoType(config);
    return current !== null && current !== target;
}

const LABEL: Record<SsoType, string> = { oauth2: "OAuth2 / OIDC", saml: "SAML 2.0" };

/** Warning shown before one SSO type replaces the other. */
export function replaceWarning(target: SsoType): string {
    const other: SsoType = target === "saml" ? "oauth2" : "saml";
    return `This organisation already uses ${LABEL[other]} single sign-on. Saving ${LABEL[target]} `
        + `settings deletes the ${LABEL[other]} settings and switches SSO off until you enable it again. `
        + "Users signing in with SSO will be affected.";
}
