import { describe, expect, it } from "vitest";
import { activeSsoType, needsReplaceConfirmation, replaceWarning } from "@/features/sso/ssoType";
import type { OrgSsoConfig } from "@/types";

const saml: OrgSsoConfig = { provider: "SAML", enabled: true, idpMetadataUrl: "https://idp/metadata" };
const oauth: OrgSsoConfig = { provider: "OKTA", enabled: true, clientId: "client", issuerUri: "https://okta" };
const empty: OrgSsoConfig = { provider: "GOOGLE", enabled: false };

describe("activeSsoType", () => {
    it("detects SAML, OAuth2 and nothing configured", () => {
        expect(activeSsoType(saml)).toBe("saml");
        expect(activeSsoType(oauth)).toBe("oauth2");
        expect(activeSsoType(empty)).toBeNull();
        expect(activeSsoType(null)).toBeNull();
    });
});

describe("needsReplaceConfirmation", () => {
    it("warns only when switching between configured types", () => {
        expect(needsReplaceConfirmation(saml, "oauth2")).toBe(true);
        expect(needsReplaceConfirmation(oauth, "saml")).toBe(true);
        expect(needsReplaceConfirmation(saml, "saml")).toBe(false);
        expect(needsReplaceConfirmation(oauth, "oauth2")).toBe(false);
        expect(needsReplaceConfirmation(null, "saml")).toBe(false);
        expect(needsReplaceConfirmation(empty, "saml")).toBe(false);
    });

    it("explains what the replacement deletes", () => {
        expect(replaceWarning("saml")).toContain("deletes the OAuth2 / OIDC settings");
        expect(replaceWarning("oauth2")).toContain("deletes the SAML 2.0 settings");
    });
});
