import { isAcceptableUrl } from "@/lib/field-limits";

/** Mirrors OrgSsoConfigDto.EMAIL_DOMAIN_PATTERN: a DNS name with an alphabetic TLD. */
const EMAIL_DOMAIN = /^(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

/** Blank, or a domain such as company.com (no scheme, "@" or path). */
export function isEmailDomain(value: unknown): boolean {
    if (typeof value !== "string" || value.trim() === "") return true;
    return EMAIL_DOMAIN.test(value.trim());
}

/** Blank, or an absolute https URL with a host (the API's @HttpUrl(httpsOnly = true)). */
export function isHttpsUrl(value: unknown): boolean {
    if (typeof value !== "string" || value.trim() === "") return true;
    try {
        const url = new URL(value.trim());
        return url.protocol === "https:" && url.hostname !== "";
    } catch {
        return false;
    }
}

export const emailDomainRule = (v: unknown) => isEmailDomain(v) || "Enter a domain such as company.com";
export const httpsUrlRule = (v: unknown) => isHttpsUrl(v) || "Must be an https:// URL";
export const httpUrlRule = (v: unknown) => isAcceptableUrl(v) || "Must be an http:// or https:// URL";
