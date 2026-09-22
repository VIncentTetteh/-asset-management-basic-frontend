import { describe, expect, it } from "vitest";
import { isEmailDomain, isHttpsUrl } from "@/features/sso/ssoValidation";

describe("SSO field validation (mirrors OrgSsoConfigDto)", () => {
    it.each(["company.com", "mail.company.co.uk", " acme.io ", ""])("accepts domain %j", (d) => {
        expect(isEmailDomain(d)).toBe(true);
    });
    it.each(["company", "@company.com", "user@company.com", "https://company.com", "company.com/x", "-bad.com", "a..b.com"])(
        "refuses domain %j", (d) => {
            expect(isEmailDomain(d)).toBe(false);
        });
    it("accepts only https issuers", () => {
        expect(isHttpsUrl("https://dev-1.okta.com/oauth2/default")).toBe(true);
        expect(isHttpsUrl("")).toBe(true);
        expect(isHttpsUrl("http://login.company.com")).toBe(false);
        expect(isHttpsUrl("login.company.com")).toBe(false);
        expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    });
});
