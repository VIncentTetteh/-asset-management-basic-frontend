import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../fixtures/auth";
import { bypassNativeValidation, fieldControl, overLength } from "../../fixtures/forms";
import { blockWrites } from "./_admin-helpers";

/**
 * SSO configuration is the REAL tenant's sign-in: this spec is READ / VALIDATE
 * ONLY. It enters invalid values, clicks save so react-hook-form shows its
 * inline errors (an invalid form never submits), and reloads to discard. As a
 * second guard every write to /organisations/{id}/sso is aborted by the route
 * handler, and the test fails if one was even attempted.
 */

const SSO_WRITES = /\/organisations\/[^/]+\/sso(\/|\?|$)/;

/** The card that holds the given tab's form (OAuth2 / OIDC or SAML 2.0). */
const formCard = (page: Page, title: RegExp): Locator =>
    page.locator("form").filter({ has: page.getByRole("button", { name: title }) });

async function openPage(page: Page): Promise<void> {
    await page.goto("/sso-configuration");
    await expect(page.getByRole("heading", { name: /SSO Configuration/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^SSO is (enabled|disabled|not configured)$/)).toBeVisible();
}

async function typeInto(form: Locator, label: string, value: string): Promise<void> {
    const control = await fieldControl(form, { label });
    await bypassNativeValidation(form, control);
    await control.fill(value);
}

test.describe("SSO configuration (validate only, never saved)", () => {
    test("page loads with both tabs", async ({ page }) => {
        await openPage(page);
        await expect(page.getByRole("button", { name: /^OAuth2 \/ OIDC$/ })).toBeVisible();
        await expect(page.getByRole("button", { name: /^SAML 2\.0$/ })).toBeVisible();
    });

    test("OAuth2: bad email domain, non-https issuer, over-length client id show inline errors", async ({ page }) => {
        const blocked = await blockWrites(page, SSO_WRITES);
        await openPage(page);
        await page.getByRole("button", { name: /^OAuth2 \/ OIDC$/ }).click();
        const form = formCard(page, /^Save OAuth2 Config$/);
        await expect(form).toBeVisible();

        await typeInto(form, "Email Domain", "not a domain");
        await typeInto(form, "Issuer URI", "http://idp.example.com");
        await typeInto(form, "Client ID", overLength(255));
        await typeInto(form, "Redirect URI", "javascript:alert(1)");
        await form.getByRole("button", { name: /^Save OAuth2 Config$/ }).click();

        const alerts = form.getByRole("alert");
        await expect(alerts.filter({ hasText: "Enter a domain such as company.com" }).first()).toBeVisible();
        await expect(alerts.filter({ hasText: "Must be an https:// URL" }).first()).toBeVisible();
        await expect(alerts.filter({ hasText: "Client ID must be at most 255 characters" }).first()).toBeVisible();
        await expect(alerts.filter({ hasText: "Must be an http:// or https:// URL" }).first()).toBeVisible();
        expect(blocked, "no SSO write was attempted").toHaveLength(0);

        // Discard: the reloaded form shows the stored config again, not the invalid values.
        await page.reload();
        await openPage(page);
        await expect(page.getByRole("alert").filter({ hasText: /Enter a domain|https:\/\/ URL|at most 255/ })).toHaveCount(0);
        expect(blocked).toHaveLength(0);
    });

    test("SAML: bad metadata URL, bad email domain, over-length SP entity id show inline errors", async ({ page }) => {
        const blocked = await blockWrites(page, SSO_WRITES);
        await openPage(page);
        await page.getByRole("button", { name: /^SAML 2\.0$/ }).click();
        const form = formCard(page, /^Save SAML Config$/);
        await expect(form).toBeVisible();

        await typeInto(form, "IdP Metadata URL", "javascript:alert(1)");
        await typeInto(form, "SP Entity ID", overLength(255));
        await typeInto(form, "Email Domain", "company");
        await form.getByRole("button", { name: /^Save SAML Config$/ }).click();

        const alerts = form.getByRole("alert");
        await expect(alerts.filter({ hasText: "Must be an http:// or https:// URL" }).first()).toBeVisible();
        await expect(alerts.filter({ hasText: "SP entity ID must be at most 255 characters" }).first()).toBeVisible();
        await expect(alerts.filter({ hasText: "Enter a domain such as company.com" }).first()).toBeVisible();
        // The replace-type confirmation must not appear either: validation stops the submit first.
        await expect(page.getByText("Replace the existing SSO configuration?")).toHaveCount(0);
        expect(blocked, "no SSO write was attempted").toHaveLength(0);

        await page.reload();
        await openPage(page);
        expect(blocked).toHaveLength(0);
    });
});
