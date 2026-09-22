import fs from "node:fs";
import path from "node:path";
import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { freshTotp } from "./totp";
import { ApiClient } from "./api";

/**
 * Authenticated test fixtures for the staging journeys.
 *
 * Credentials come only from the environment (never from the repo):
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD  (required)
 *   E2E_ADMIN_TOTP                       (base32 authenticator secret; needed when the
 *                                         admin has MFA on, and for step-up approvals)
 *   E2E_ORGANISATION_NAME                (optional; picks the org when the email is in several)
 *
 * Each worker signs in once and reuses the saved storage state for every test.
 */

export interface Credentials {
    email: string;
    password: string;
    totpSecret?: string;
}

export function adminCredentials(): Credentials {
    const email = process.env.E2E_ADMIN_EMAIL?.trim();
    const password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) {
        throw new Error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the staging journeys");
    }
    return { email, password, totpSecret: process.env.E2E_ADMIN_TOTP?.trim() || undefined };
}

/** Optional second user for approve/reject flows (maker-checker needs a different person). */
export function approverCredentials(): Credentials | null {
    const email = process.env.E2E_APPROVER_EMAIL?.trim();
    const password = process.env.E2E_APPROVER_PASSWORD;
    if (!email || !password) return null;
    return { email, password, totpSecret: process.env.E2E_APPROVER_TOTP?.trim() || undefined };
}

const MFA_INPUT_PLACEHOLDER = "000000";

/** Signs in through the real login page, answering the MFA challenge when shown. */
export async function login(page: Page, creds: Credentials): Promise<void> {
    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.getByRole("button", { name: /^Sign in$/ }).click();

    const mfaInput = page.getByPlaceholder(MFA_INPUT_PLACEHOLDER);
    const orgSelect = page.locator("#organisationId");
    const outcome = await Promise.race([
        page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 }).then(() => "in" as const),
        mfaInput.waitFor({ state: "visible", timeout: 45_000 }).then(() => "mfa" as const),
        orgSelect.waitFor({ state: "visible", timeout: 45_000 }).then(() => "org" as const),
    ]);

    if (outcome === "org") {
        const wanted = process.env.E2E_ORGANISATION_NAME?.trim();
        if (wanted) await orgSelect.selectOption({ label: wanted });
        await page.getByRole("button", { name: /^Sign in$/ }).click();
        const next = await Promise.race([
            page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 }).then(() => "in" as const),
            mfaInput.waitFor({ state: "visible", timeout: 45_000 }).then(() => "mfa" as const),
        ]);
        if (next === "mfa") await answerLoginMfa(page, creds);
    } else if (outcome === "mfa") {
        await answerLoginMfa(page, creds);
    }

    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 });
    // The shell stores the user and verified organisation after the profile loads;
    // the saved storage state must carry both.
    await page.waitForFunction(
        () => Boolean(localStorage.getItem("user") && localStorage.getItem("verifiedOrganisationId")),
        undefined,
        { timeout: 45_000 },
    );
}

async function answerLoginMfa(page: Page, creds: Credentials): Promise<void> {
    if (!creds.totpSecret) {
        throw new Error("The account has MFA enabled: set E2E_ADMIN_TOTP to its base32 authenticator secret");
    }
    await page.getByPlaceholder(MFA_INPUT_PLACEHOLDER).fill(await freshTotp(creds.totpSecret));
    await page.getByRole("button", { name: /Verify/ }).click();
}

/** The app-wide step-up prompt (StepUpMfaDialog), shown for approvals and admin writes. */
export const stepUpDialog = (page: Page) => page.getByRole("dialog", { name: /Confirm it.s you/ });

/**
 * Answers the step-up prompt whenever it appears, before any later action or
 * auto-waiting assertion on the page. The code input submits itself at 6 digits.
 */
export async function installStepUpHandler(page: Page, creds: Credentials): Promise<void> {
    await page.addLocatorHandler(stepUpDialog(page), async (dialog) => {
        if (!creds.totpSecret) {
            throw new Error("A step-up MFA prompt appeared: set E2E_ADMIN_TOTP to answer it");
        }
        await dialog.getByPlaceholder(MFA_INPUT_PLACEHOLDER).fill(await freshTotp(creds.totpSecret));
        await expect(dialog).toBeHidden({ timeout: 20_000 });
    });
}

/** Explicit variant for flows that want to wait for, and answer, a step-up prompt. */
export async function completeStepUpIfPrompted(page: Page, creds: Credentials, waitMs = 5_000): Promise<boolean> {
    const dialog = stepUpDialog(page);
    const shown = await dialog.waitFor({ state: "visible", timeout: waitMs }).then(() => true, () => false);
    if (!shown) return false;
    if (!creds.totpSecret) throw new Error("A step-up MFA prompt appeared: set E2E_ADMIN_TOTP to answer it");
    await dialog.getByPlaceholder(MFA_INPUT_PLACEHOLDER).fill(await freshTotp(creds.totpSecret));
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    return true;
}

/** Signs a fresh browser context in and writes its storage state to `file`. */
export async function saveStorageState(browser: Browser, baseURL: string, creds: Credentials, file: string): Promise<void> {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    try {
        await login(page, creds);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await context.storageState({ path: file });
    } finally {
        await context.close();
    }
}

/** Unique per run, so reruns never collide with earlier records. */
export const RUN_ID = process.env.E2E_RUN_ID?.trim() || Date.now().toString(36).toUpperCase();
/** Every record the suite creates starts with this, so leftovers are easy to find and purge. */
export const PREFIX = `E2E-${RUN_ID}-`;

/** Unique, prefixed value for a text field. */
export const uniq = (label: string): string => `${PREFIX}${label}`;

type WorkerFixtures = { workerStorageState: string };
type TestFixtures = { api: ApiClient; creds: Credentials; stagingOnly: void };

export const test = base.extend<TestFixtures, WorkerFixtures>({
    // The default playwright.config.ts (public pages, local static build) also
    // globs e2e/: these journeys only run under playwright.staging.config.ts.
    stagingOnly: [
        async ({}, use) => {
            test.skip(!process.env.E2E_BASE_URL, "staging journeys: run with playwright.staging.config.ts and E2E_BASE_URL");
            await use();
        },
        { auto: true },
    ],
    workerStorageState: [
        async ({ browser }, use, workerInfo) => {
            const baseURL = workerInfo.project.use.baseURL;
            if (!baseURL) throw new Error("baseURL is not configured");
            const file = path.resolve(workerInfo.project.outputDir, `.auth/admin-${workerInfo.parallelIndex}.json`);
            if (!fs.existsSync(file)) {
                await saveStorageState(browser, baseURL, adminCredentials(), file);
            }
            await use(file);
        },
        { scope: "worker" },
    ],
    storageState: ({ workerStorageState }, use) => use(workerStorageState),
    creds: async ({}, use) => use(adminCredentials()),
    page: async ({ page, creds }, use) => {
        await installStepUpHandler(page, creds);
        await use(page);
    },
    api: async ({ page }, use) => {
        await use(new ApiClient(page));
    },
});

export { expect };
