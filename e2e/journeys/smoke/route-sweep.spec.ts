import type { Page, Response } from "@playwright/test";
import { test, expect } from "../../fixtures/auth";
import { OVERLAY } from "../../fixtures/forms";

/**
 * Visits every sidebar route as the admin and fails on: an uncaught page error,
 * any 5xx API response, a bounce to /login, or a blocking modal overlay left
 * open after the page settles.
 *
 * The list is the sidebar's static routes (src/components/Sidebar.tsx) plus
 * whatever the rendered sidebar links to, so feature-flagged entries (webhooks,
 * platform health, license key) are covered when the tenant shows them.
 */
const SIDEBAR_ROUTES = [
    "/dashboard", "/analytics", "/reports",
    "/assets", "/categories", "/checkouts", "/maintenance", "/transfers", "/disposals", "/audits",
    "/discovery", "/cloud-assets",
    "/employees", "/users", "/roles", "/departments", "/profile",
    "/suppliers", "/purchase-orders", "/contracts", "/budgets", "/expenses", "/leases", "/vendor-reviews",
    "/licenses", "/depreciation-policies", "/exchange-rates",
    "/compliance/controls", "/compliance/bog-controls", "/compliance/bog-report", "/compliance/risks",
    "/compliance/incidents", "/compliance/policies", "/compliance/security-zones", "/compliance/ics-assets",
    "/compliance/patch-records", "/compliance/pci-saq", "/compliance/sla-metrics",
    "/compliance/vulnerability-scans", "/compliance/regulatory-filings", "/dpa/consent", "/dpa/dsar",
    "/ai-insights", "/ai-chat",
    "/organisations", "/locations", "/sso-configuration", "/settings/storage", "/notifications", "/billing",
    "/audit-events",
] as const;

const SETTLE_MS = 1_500;

async function sidebarLinks(page: Page): Promise<string[]> {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const hrefs = await page
        .locator("aside a[href^='/'], nav a[href^='/']")
        .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
    return hrefs.map((h) => h.split(/[?#]/)[0]).filter((h) => h.length > 1);
}

/** Loads one route and returns every problem seen (empty = clean). */
async function checkRoute(page: Page, route: string): Promise<string[]> {
    const problems: string[] = [];
    const onError = (error: Error) => problems.push(`page error: ${error.message}`);
    const onResponse = (response: Response) => {
        if (response.status() >= 500) {
            problems.push(`${response.status()} ${response.request().method()} ${response.url()}`);
        }
    };
    page.on("pageerror", onError);
    page.on("response", onResponse);
    try {
        await page.goto(route);
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
        await page.waitForTimeout(SETTLE_MS);
        if (new URL(page.url()).pathname.startsWith("/login")) problems.push("redirected to /login");
        const overlays = page.locator(OVERLAY).filter({ visible: true });
        if ((await overlays.count()) > 0) {
            const text = (await overlays.first().innerText()).slice(0, 120).replace(/\s+/g, " ");
            problems.push(`blocking overlay after load: "${text}"`);
        }
    } finally {
        page.off("pageerror", onError);
        page.off("response", onResponse);
    }
    return problems;
}

test.describe("Route sweep", () => {
    for (const route of SIDEBAR_ROUTES) {
        test(`${route} loads cleanly`, async ({ page }) => {
            const problems = await checkRoute(page, route);
            expect(problems, `${route}:\n  ${problems.join("\n  ")}`).toEqual([]);
        });
    }

    test("sidebar routes not in the static list load cleanly", async ({ page }) => {
        const known = new Set<string>(SIDEBAR_ROUTES);
        const extra = [...new Set(await sidebarLinks(page))].filter((route) => !known.has(route));
        const failures: string[] = [];
        for (const route of extra) {
            await test.step(route, async () => {
                const problems = await checkRoute(page, route);
                if (problems.length > 0) failures.push(`${route}\n    ${problems.join("\n    ")}`);
            });
        }
        test.info().annotations.push({ type: "extra routes", description: extra.join(", ") || "(none)" });
        expect(failures, `routes with problems:\n${failures.join("\n")}`).toEqual([]);
    });
});
