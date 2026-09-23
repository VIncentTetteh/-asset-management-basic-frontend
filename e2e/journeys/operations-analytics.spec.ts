import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * The five operational surfaces, against the real static export.
 *
 * The API is stubbed at the network boundary rather than run, which keeps this
 * in the fast CI config and — more usefully — lets each test serve the awkward
 * payload it is about. The states worth an end-to-end check are the ones where
 * a dashboard can quietly mislead someone: a total that silently excluded
 * money, a section the caller may not see, a tenant with no history, a
 * mid-series currency change, and a figure you cannot open.
 *
 * The unit suite asserts the same payloads in jsdom. This exists because two
 * of the defects those payloads produced were only visible once the page was
 * laid out: text that needed sideways scrolling at phone width, and a figure
 * that rendered fine but linked to the wrong list.
 */

const ORG_ID = "6f1a1d1e-9999-4f00-9a00-0000000000ff";

const PERMISSIONS = [
    "VIEW_ASSETS", "VIEW_REPORTS", "VIEW_BUDGETS", "VIEW_CONTRACTS",
    "VIEW_SOFTWARE_LICENSES", "VIEW_MAINTENANCE", "VIEW_DEPARTMENTS", "VIEW_LOCATIONS",
];

const PROFILE = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "ops@acme.test",
    firstName: "Ama",
    lastName: "Mensah",
    role: "ORG_ADMIN",
    organisationId: ORG_ID,
    organisationName: "Northwind Logistics",
    permissions: PERMISSIONS,
};

const ASOF = "2026-09-23";
const GENERATED = "2026-09-23T09:14:02Z";

const ENGINEERING = "6f1a1d1e-0001-4f00-9a00-000000000001";

const ESTATE = {
    asOf: ASOF,
    currency: "USD",
    complete: false,
    missingRates: ["EUR->USD"],
    withheldSections: [],
    groupBy: "department",
    assetCount: 1284,
    totalCost: 3980100,
    accumulatedDepreciation: 1974310.25,
    netBookValue: 2208289.75,
    monthlyDepreciation: 41230.5,
    assetsFullyDepreciated: 212,
    assetsMissingDepreciationSetup: 37,
    groups: [
        {
            id: ENGINEERING,
            name: "Engineering",
            count: 512,
            countShare: 39.9,
            cost: 2104880,
            accumulatedDepreciation: 1012440,
            netBookValue: 1092440,
            monthlyDepreciation: 21980,
            costShare: 50.3,
            assetsFullyDepreciated: 88,
            filter: { departmentId: ENGINEERING },
        },
        {
            id: null,
            name: "No department",
            count: 113,
            countShare: 8.8,
            cost: 167200,
            accumulatedDepreciation: 70000,
            netBookValue: 97200,
            monthlyDepreciation: 1300,
            costShare: 4,
            assetsFullyDepreciated: 11,
            filter: { departmentId: null },
        },
    ],
    generatedAt: GENERATED,
};

const COST_WASTE = {
    asOf: ASOF,
    currency: "USD",
    complete: true,
    missingRates: [],
    withheldSections: ["software licences"],
    idleDays: 180,
    distinctAssetsFlagged: 96,
    capitalTiedUp: 184320,
    licenceAnnualSavings: 0,
    findings: [
        {
            key: "NOT_SEEN_IN_STOCK",
            title: "In stock or reserved and not seen for 180+ days",
            explanation:
                "Assets held in stock or reserved that nobody is recorded as having seen for 180 days. Editing the "
                + "record is not a sighting and does not count here.",
            resourceType: "asset",
            count: 24,
            originalCost: 38400,
            netBookValue: 15360,
            filter: { status: "IN_STOCK" },
            items: [
                {
                    id: "a0000000-0000-4000-8000-000000000002",
                    name: "Dell Latitude 5452",
                    reference: "AST-012",
                    resourceType: "asset",
                    status: "IN_STOCK",
                    departmentName: "Operations",
                    locationName: "Accra HQ",
                    cost: 1200,
                    netBookValue: 480,
                    nativeCurrency: "USD",
                    detail: "Never scanned, checked out or audited; record unchanged for 198 days",
                },
            ],
            truncated: true,
        },
    ],
    generatedAt: GENERATED,
};

const EXPIRING = {
    asOf: ASOF,
    currency: "USD",
    complete: true,
    missingRates: [],
    withheldSections: ["leases"],
    horizonDays: 90,
    horizonEnd: "2026-12-22",
    totals: { overdue: 5, dueWithinHorizon: 18 },
    streams: [
        {
            key: "WARRANTY",
            label: "Asset warranties",
            resourceType: "asset",
            valueMeaning: "original purchase cost of the asset losing cover",
            overdue: 5,
            dueWithinHorizon: 18,
            buckets: [
                { bucket: "OVERDUE", label: "Already past due", count: 5, value: 14200, valueComplete: true },
                { bucket: "DUE_0_29", label: "Due in 0-29 days", count: 9, value: 21600, valueComplete: true },
                { bucket: "DUE_30_59", label: "Due in 30-59 days", count: 6, value: 14400, valueComplete: false },
                { bucket: "DUE_60_90", label: "Due in 60-90 days", count: 3, value: 7200, valueComplete: true },
                // Always empty by construction: nothing can fall into a window
                // wholly inside the previous one.
                { bucket: "DUE_90_90", label: "Due in 90-90 days", count: 0, value: 0, valueComplete: true },
            ],
            items: [
                {
                    id: "a0000000-0000-4000-8000-000000000011",
                    name: "ThinkPad X1 Carbon",
                    reference: "AST-0442",
                    resourceType: "asset",
                    dueDate: "2026-09-10",
                    daysUntil: -13,
                    overdue: true,
                    relatedId: null,
                    relatedName: "Engineering",
                    value: 2400,
                    nativeCurrency: "USD",
                },
            ],
            truncated: true,
        },
    ],
    generatedAt: GENERATED,
};

const SPEND_NO_BUDGETS = {
    asOf: ASOF,
    currency: "USD",
    complete: true,
    missingRates: [],
    withheldSections: [],
    windowStart: "2026-01-01",
    windowEnd: "2026-12-31",
    budgetCount: 0,
    totalBudget: 0,
    spent: 0,
    committed: 0,
    available: 0,
    spentPercent: null,
    committedPercent: null,
    burnPercent: null,
    periodElapsedPercent: 72.3,
    pacePercentagePoints: null,
    projectedSpendAtPeriodEnd: null,
    budgetsOverThreshold: 0,
    budgets: [],
    generatedAt: GENERATED,
};

const TRENDS_NO_HISTORY = {
    asOf: ASOF,
    days: 90,
    withheldSections: [],
    firstSnapshot: null,
    historyDays: 0,
    pointCount: 0,
    sufficientHistory: false,
    note:
        "No history has been recorded yet. The first snapshot is taken overnight; trends appear from the following "
        + "day.",
    currencies: [],
    currency: null,
    currencyChanged: false,
    anyIncomplete: false,
    points: [],
    change: { comparable: false },
    generatedAt: GENERATED,
};

/** Answers every API call the authenticated shell and these surfaces make. */
function stubBody(path: string): unknown {
    if (path === "/auth/profile") return PROFILE;
    if (path === "/auth/me/permissions") return { permissions: PERMISSIONS };
    if (path.startsWith("/organisations/")) return { id: ORG_ID, name: "Northwind Logistics" };
    if (path === "/currency/settings") {
        return { baseCurrency: "USD", availableCurrencies: ["USD", "GHS", "EUR"], canEdit: false };
    }
    if (path === "/exchange-rates") return [];
    if (path === "/analytics/estate") return ESTATE;
    if (path === "/analytics/cost-waste") return COST_WASTE;
    if (path === "/analytics/expiring") return EXPIRING;
    if (path === "/analytics/spend") return SPEND_NO_BUDGETS;
    if (path === "/analytics/trends") return TRENDS_NO_HISTORY;
    if (path.includes("notification")) return { content: [], totalElements: 0 };
    if (path.includes("subscription") || path.includes("billing")) {
        return { plan: "ENTERPRISE", status: "ACTIVE", limits: {} };
    }
    if (path.includes("onboarding")) return { dismissed: true, steps: [] };
    if (path.includes("license")) return { mode: "saas", status: "ACTIVE" };
    return [];
}

/** Signs the browser in the only way a static export can be: stub and seed. */
async function signIn(page: Page, options: { failAnalytics?: boolean } = {}): Promise<void> {
    await page.addInitScript(
        ([org, profile]: [string, string]) => {
            localStorage.setItem("verifiedOrganisationId", org);
            localStorage.setItem("user", profile);
        },
        [ORG_ID, JSON.stringify(PROFILE)] as [string, string],
    );
    await page.route("**/api/v1/**", (route: Route) => {
        const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
        if (options.failAnalytics && path.startsWith("/analytics/")) {
            return route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({ message: "Service unavailable" }),
            });
        }
        return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(stubBody(path)),
        });
    });
}

/** The page's own <h1>, which the sidebar's "Operations" link would otherwise clash with. */
const pageTitle = (page: Page) => page.getByRole("heading", { level: 1, name: "Operations" });

/** Fails if the document itself scrolls sideways — the phone-width regression. */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "the page must not scroll sideways; only tables may").toBeLessThanOrEqual(0);
}

test.describe("Operations analytics", () => {
    test("values the estate and links every figure to its records", async ({ page }) => {
        await signIn(page);
        await page.goto("/operations?view=estate");

        await expect(pageTitle(page)).toBeVisible();
        await expect(page.getByText("1,284").first()).toBeVisible();

        // complete:false must be visible next to the figures, not buried.
        const caveat = page.getByTestId("insight-incomplete");
        await expect(caveat).toBeVisible();
        await expect(caveat).toContainText("EUR→USD");

        // Every group opens the assets behind it.
        const link = page.getByRole("link", { name: /View 512 assets/ });
        await expect(link).toHaveAttribute("href", `/assets?departmentId=${ENGINEERING}`);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`/assets\\?departmentId=${ENGINEERING}`));
    });

    test("does not pretend the register can filter to 'no department'", async ({ page }) => {
        await signIn(page);
        await page.goto("/operations?view=estate");

        await expect(page.getByText("No department", { exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: /^Open the asset register$/ }))
            .toHaveAttribute("href", "/assets");
        await expect(page.getByText(/records with no department, which the asset register has no filter for/i))
            .toBeVisible();
    });

    test("names a withheld section instead of showing it as zero", async ({ page }) => {
        await signIn(page);
        await page.goto("/operations?view=waste");

        await expect(page.getByTestId("insight-withheld"))
            .toContainText("do not have access to software licences");
        await expect(page.getByText("Software seats paid for and not used")).toHaveCount(0);
        // And the overlap rule is stated, so nobody adds the findings up.
        await expect(page.getByText(/Findings overlap on purpose/i)).toBeVisible();
    });

    test("reads the expiry buckets from the response and drops the empty duplicate", async ({ page }) => {
        await signIn(page);
        await page.goto("/operations?view=expiring");

        await expect(page.getByText("Due in 0-29 days")).toBeVisible();
        await expect(page.getByText("Due in 60-90 days")).toBeVisible();
        await expect(page.getByText("Due in 90-90 days")).toHaveCount(0);
        await expect(page.getByText(/excludes some amounts/i).first()).toBeVisible();
    });

    test("leaves budget ratios blank when there is no budget", async ({ page }) => {
        await signIn(page);
        await page.goto("/operations?view=spend");

        await expect(page.getByText(/No approved budget covers this window/i)).toBeVisible();
        await expect(page.getByText("No budget to burn against")).toBeVisible();
        await expect(page.getByTestId("spend-projection"))
            .toContainText("nothing to project");
        expect(await page.locator("body").innerText()).not.toContain("NaN");
    });

    test("renders the API's note rather than a flat line for a tenant with no history", async ({ page }) => {
        await signIn(page);
        await page.goto("/operations?view=trends");

        await expect(page.getByTestId("trends-note")).toContainText("No history has been recorded yet");
        await expect(page.getByTestId("trend-chart")).toHaveCount(0);
    });

    test("shows the failure, not an empty state, when the request fails", async ({ page }) => {
        await signIn(page, { failAnalytics: true });
        await page.goto("/operations?view=estate");

        const error = page.getByTestId("data-error");
        await expect(error).toBeVisible();
        await expect(error).toContainText(/couldn't load your estate valuation/i);
        await expect(page.getByText(/no assets on the books yet/i)).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Try again/i })).toBeVisible();
    });

    test("moves between the five views and keeps the choice in the URL", async ({ page }) => {
        await signIn(page);
        await page.goto("/operations?view=estate");

        await page.getByRole("tab", { name: "Expiring" }).click();
        await expect(page).toHaveURL(/view=expiring/);
        await expect(page.getByRole("heading", { name: "Asset warranties" })).toBeVisible();

        await page.getByRole("tab", { name: "Trends" }).click();
        await expect(page).toHaveURL(/view=trends/);
        await expect(page.getByTestId("trends-note")).toBeVisible();
    });

    test("fits a phone without the page scrolling sideways", async ({ page }) => {
        await page.setViewportSize({ width: 400, height: 900 });
        await signIn(page);

        for (const view of ["estate", "waste", "expiring", "spend", "trends"]) {
            await page.goto(`/operations?view=${view}`);
            await expect(pageTitle(page)).toBeVisible();
            await expectNoSidewaysScroll(page);
        }
    });
});
