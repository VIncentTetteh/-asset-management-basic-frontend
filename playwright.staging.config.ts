import { defineConfig, devices } from "@playwright/test";

/**
 * Authenticated journeys against a deployed environment (staging).
 *
 *   E2E_BASE_URL=https://staging.example.com \
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... [E2E_ADMIN_TOTP=<base32 secret>] \
 *   npm run test:e2e:staging
 *
 * One worker: every spec writes into the same tenant, and step-up MFA codes are
 * single-use per 30s window, so parallel workers would race each other.
 */
const baseURL = process.env.E2E_BASE_URL?.trim();
if (!baseURL) {
    throw new Error("E2E_BASE_URL is required, e.g. E2E_BASE_URL=https://staging.example.com");
}

const MINUTE = 60_000;

export default defineConfig({
    testDir: "./e2e/journeys",
    outputDir: "./test-results/staging",
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    timeout: 5 * MINUTE,
    expect: { timeout: 15_000 },
    reporter: [["list"], ["html", { outputFolder: "playwright-report/staging", open: "never" }]],
    use: {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        actionTimeout: 20_000,
        navigationTimeout: 45_000,
        ignoreHTTPSErrors: false,
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
});
