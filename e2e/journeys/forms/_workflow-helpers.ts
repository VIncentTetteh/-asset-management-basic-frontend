import type { Browser, Locator, Page } from "@playwright/test";
import { expect, installStepUpHandler, login, test, type Credentials } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";

/**
 * Helpers shared by the workflow form specs (transfers, disposals, audits,
 * cloud assets, employees). Kept out of e2e/fixtures on purpose.
 */

/** The organisation's base currency (GET /currency/settings), always an option in the currency selects. */
export async function baseCurrency(api: ApiClient): Promise<string> {
    const settings = await api.get<{ baseCurrency?: string }>("/currency/settings");
    return (settings?.baseCurrency ?? "USD").toUpperCase();
}

/**
 * Picks an asset in the server-side AssetSearchPicker (components/assets/AssetSearchPicker.tsx):
 * types the name into the search box, then clicks the matching option.
 */
export async function pickAsset(scope: Locator, name: string): Promise<void> {
    await scope.getByPlaceholder(/Search by name, tag or model/i).fill(name);
    const option = scope.getByRole("option").filter({ hasText: name }).first();
    await expect(option, `asset "${name}" in the picker`).toBeVisible({ timeout: 20_000 });
    await option.getByRole("button").click();
    // The picker collapses to the chosen asset with a "Choose a different asset" button.
    await expect(scope.getByRole("button", { name: "Choose a different asset" })).toBeVisible();
}

/**
 * Runs `fn` as the second (approver) user in a separate, freshly signed-in
 * browser context, so maker-checker rules see a different person. The context
 * answers its own step-up MFA prompts with the approver's TOTP secret.
 */
export async function asApprover(
    browser: Browser,
    creds: Credentials,
    fn: (page: Page) => Promise<void>,
): Promise<void> {
    const baseURL = test.info().project.use.baseURL;
    const context = await browser.newContext({ baseURL });
    try {
        const page = await context.newPage();
        await installStepUpHandler(page, creds);
        await login(page, creds);
        await fn(page);
    } finally {
        await context.close();
    }
}

/** Why an approver test is skipped when no second user is configured. */
export const NO_APPROVER =
    "maker-checker approval needs a second user: set E2E_APPROVER_EMAIL and E2E_APPROVER_PASSWORD (and E2E_APPROVER_TOTP when it has MFA)";
