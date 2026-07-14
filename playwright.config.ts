import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke-test config for public, unauthenticated routes only.
 *
 * Full authenticated journeys (login → dashboard → CRUD) need the backend +
 * Postgres stack running and are covered by the nightly smoke-against-staging
 * job (Phase 7), not this fast CI-friendly suite.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      API_TARGET_BASE: process.env.API_TARGET_BASE ?? "http://localhost:8080/api",
    },
  },
});
