import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OperationsPage from "@/app/operations/page";
import * as fixtures from "../fixtures/insights";

/**
 * The five operational surfaces, rendered from the payloads the backend
 * actually sends.
 *
 * These are page-level on purpose. The interesting behaviour is not in any one
 * function — it is in what reaches the screen when the data is awkward, and
 * every case below is a way a dashboard can quietly lie:
 *
 *   - a total that excluded amounts but prints as if it did not;
 *   - a permission-withheld section shown as a confident zero;
 *   - a new tenant's empty history drawn as a flat line along the bottom;
 *   - two different currencies joined by one smooth line;
 *   - a figure that cannot be opened, or that opens the wrong records;
 *   - a failed request rendered as "nothing here yet".
 *
 * The axios instance is mocked rather than the service, so the normalisers run
 * for real: "money key absent means withheld, not zero" is enforced there and
 * would otherwise go untested.
 */

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/axios", () => ({ default: { get } }));

const push = vi.hoisted(() => vi.fn());
const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParams.current,
    useRouter: () => ({ push, replace: push, prefetch: vi.fn() }),
    usePathname: () => "/operations",
}));

vi.mock("@/contexts/CurrencyContext", () => ({
    useCurrency: () => ({
        baseCurrency: "USD",
        currency: "USD",
        format: (amount: number, currency = "USD") => `${currency} ${amount.toLocaleString()}`,
        formatCompact: (amount: number, currency = "USD") => `${currency} ${amount.toLocaleString()}`,
    }),
}));

/** Serves each analytics endpoint whatever payload this test planted. */
type Responses = Partial<Record<"estate" | "cost-waste" | "expiring" | "spend" | "trends", unknown>>;

function serve(responses: Responses, failing: readonly string[] = []) {
    get.mockImplementation((url: string) => {
        const key = url.replace("/analytics/", "") as keyof Responses;
        if (failing.includes(key)) {
            return Promise.reject(new Error("Request failed with status code 503"));
        }
        if (!(key in responses)) return Promise.reject(new Error(`no fixture for ${url}`));
        return Promise.resolve({ data: responses[key] });
    });
}

function renderOperations(view: string) {
    searchParams.current = new URLSearchParams(`view=${view}`);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <OperationsPage />
        </QueryClientProvider>,
    );
}

/** The anchor whose text starts with `label`. */
const linkNamed = (pattern: RegExp): HTMLAnchorElement =>
    screen.getByRole("link", { name: pattern }) as HTMLAnchorElement;

afterEach(cleanup);
beforeEach(() => {
    get.mockReset();
    push.mockReset();
});

// ── Estate ───────────────────────────────────────────────────────────────────

describe("Operations · estate", () => {
    it("renders the totals and every group from a realistic payload", async () => {
        serve({ estate: fixtures.estateByDepartment });
        renderOperations("estate");

        expect(await screen.findByText("1,284")).toBeTruthy();
        expect(screen.getByText("USD 4,182,600")).toBeTruthy();
        expect(screen.getByText("Engineering")).toBeTruthy();
        expect(screen.getByText("No department")).toBeTruthy();
        // Shares come from the payload; nothing is recomputed in the browser.
        expect(screen.getByText("39.9%")).toBeTruthy();
    });

    it("clicking a group's figure links to the assets behind it", async () => {
        serve({ estate: fixtures.estateByDepartment });
        renderOperations("estate");

        await screen.findByText("Engineering");
        const link = linkNamed(/View 512 assets/);
        expect(link.getAttribute("href")).toBe(
            "/assets?departmentId=6f1a1d1e-0001-4f00-9a00-000000000001",
        );
        expect(link.getAttribute("data-exactness")).toBe("exact");
        fireEvent.click(link);
    });

    it("says the register cannot ask for the 'no department' set rather than linking to everything", async () => {
        serve({ estate: fixtures.estateByDepartment });
        renderOperations("estate");

        await screen.findByText("No department");
        const link = linkNamed(/Open the asset register$/);
        // No query string: a `departmentId=` with an empty value would be read
        // as "no department filter" and show the whole register.
        expect(link.getAttribute("href")).toBe("/assets");
        expect(link.getAttribute("data-exactness")).toBe("unfiltered");
        expect(screen.getByText(/records with no department, which the asset register has no filter for/i)).toBeTruthy();
    });

    it("says a total is incomplete, next to the number, when a rate was missing", async () => {
        serve({ estate: fixtures.estateIncomplete });
        renderOperations("estate");

        const caveat = await screen.findByTestId("insight-incomplete");
        expect(caveat.textContent).toMatch(/EUR→USD/);
        expect(caveat.textContent).toMatch(/floor, not the answer/i);
    });

    it("says valuations are withheld instead of showing a money figure of zero", async () => {
        serve({ estate: fixtures.estateWithheldValuation });
        renderOperations("estate");

        const notice = await screen.findByTestId("insight-withheld");
        expect(notice.textContent).toMatch(/do not have access to asset valuations/i);
        // The money columns are gone entirely — not rendered as 0.00.
        expect(screen.queryByText(/Original cost/i)).toBeNull();
        expect(screen.queryByText("USD 0")).toBeNull();
    });

    it("gives an empty tenant honest zeros and no NaN or stray percent signs", async () => {
        serve({ estate: fixtures.estateEmpty });
        renderOperations("estate");

        expect(await screen.findByText(/no assets on the books yet/i)).toBeTruthy();
        expect(document.body.textContent).not.toMatch(/NaN/);
        expect(document.body.textContent).not.toMatch(/—%/);
    });

    it("renders the error state, not the empty state, when the request fails", async () => {
        serve({}, ["estate"]);
        renderOperations("estate");

        const error = await screen.findByTestId("data-error");
        expect(error.textContent).toMatch(/couldn't load your estate valuation/i);
        expect(error.getAttribute("role")).toBe("alert");
        expect(screen.queryByText(/no assets on the books yet/i)).toBeNull();
    });
});

// ── Cost & waste ─────────────────────────────────────────────────────────────

describe("Operations · cost and waste", () => {
    it("shows every finding with the explanation of what it counted", async () => {
        serve({ "cost-waste": fixtures.costWaste });
        renderOperations("waste");

        expect(await screen.findByTestId("finding-count-FULLY_DEPRECIATED_ACTIVE")).toBeTruthy();
        expect(screen.getByTestId("finding-count-NOT_SEEN_IN_STOCK").textContent).toMatch(/24/);
        expect(screen.getByTestId("finding-count-LICENCE_OVER_ALLOCATED")).toBeTruthy();
        // The rule, in the backend's words — the user may disagree with it.
        expect(screen.getByText(/Editing the record is not a sighting/i)).toBeTruthy();
    });

    it("reports only the de-duplicated figures and never a grand total of the findings", async () => {
        serve({ "cost-waste": fixtures.costWaste });
        renderOperations("waste");

        expect((await screen.findByTestId("waste-distinct")).textContent).toMatch(/96/);
        expect(screen.getByText(/Findings overlap on purpose/i)).toBeTruthy();
        // 212 + 24 + 31 + 4 + 0 = 271. If that ever appears, something summed
        // the findings, which double-counts every asset in more than one.
        expect(document.body.textContent).not.toMatch(/\b271\b/);
    });

    it("says licences are withheld rather than showing the licence findings as zero", async () => {
        serve({ "cost-waste": fixtures.costWasteLicencesWithheld });
        renderOperations("waste");

        const notice = await screen.findByTestId("insight-withheld");
        expect(notice.textContent).toMatch(/do not have access to software licences/i);
        expect(screen.queryByTestId("finding-count-LICENCE_UNUSED_SEATS")).toBeNull();
        expect(screen.queryByTestId("finding-count-LICENCE_OVER_ALLOCATED")).toBeNull();
    });

    it("warns that a broad filter shows more than the finding counted", async () => {
        serve({ "cost-waste": fixtures.costWaste });
        renderOperations("waste");

        await screen.findByTestId("finding-count-NOT_SEEN_IN_STOCK");
        // status=IN_STOCK is a filter the register honours perfectly — and it
        // shows every in-stock asset, not the 24 that went unseen for 180 days.
        // A link that claimed to be exact here would be the lie this whole
        // surface exists to avoid.
        const link = linkNamed(/filtered to status In stock/i);
        expect(link.getAttribute("href")).toBe("/assets?status=IN_STOCK");
        expect(link.getAttribute("data-exactness")).toBe("broader");
        expect(screen.getAllByText(/shows a wider list/i).length).toBeGreaterThan(0);
    });

    it("shows an unconvertible licence amount as unknown, never as free", async () => {
        serve({ "cost-waste": fixtures.costWaste });
        renderOperations("waste");

        const heading = await screen.findByText(/Software seats paid for and not used/i);
        const panel = heading.closest("section") as HTMLElement;
        fireEvent.click(within(panel).getByRole("button", { name: /^Show all/i }));

        const row = within(panel).getByText("Atlassian Confluence").closest("tr") as HTMLElement;
        expect(within(row).getByTestId("unknown-money").textContent).toBe("Unknown");
        expect(row.textContent).toMatch(/held in EUR/);
    });

    it("renders the error state when the request fails", async () => {
        serve({}, ["cost-waste"]);
        renderOperations("waste");

        expect((await screen.findByTestId("data-error")).textContent)
            .toMatch(/couldn't load your cost and waste findings/i);
    });
});

// ── Expiring ─────────────────────────────────────────────────────────────────

describe("Operations · expiring", () => {
    it("renders the buckets the payload named, rather than a hardcoded set", async () => {
        serve({ expiring: fixtures.expiring90 });
        renderOperations("expiring");

        expect(await screen.findByTestId("expiry-overdue")).toBeTruthy();
        expect(screen.getAllByText("Due in 0-29 days").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Due in 60-90 days").length).toBeGreaterThan(0);
        // Nothing can ever fall into the backend's trailing duplicate window,
        // so it is not drawn as a permanent empty row.
        expect(screen.queryByText("Due in 90-90 days")).toBeNull();
    });

    it("states what each stream's money figure means instead of leaving it to be guessed", async () => {
        serve({ expiring: fixtures.expiring90 });
        renderOperations("expiring");

        // Stated twice on purpose: once visibly, once in the table's caption
        // for a screen reader reading the bucket figures out of context.
        expect((await screen.findAllByText(/original purchase cost of the asset losing cover/i)).length)
            .toBeGreaterThan(0);
        expect(screen.getAllByText(/total contract value/i).length).toBeGreaterThan(0);
    });

    it("names a withheld stream rather than omitting it silently or showing zero", async () => {
        serve({ expiring: fixtures.expiring90 });
        renderOperations("expiring");

        const notice = await screen.findByTestId("insight-withheld");
        expect(notice.textContent).toMatch(/do not have access to leases/i);
        expect(screen.queryByText("Equipment leases")).toBeNull();
    });

    it("flags a bucket whose value excluded an amount it could not convert", async () => {
        serve({ expiring: fixtures.expiring90 });
        renderOperations("expiring");

        await screen.findByTestId("expiry-overdue");
        expect(screen.getAllByText(/excludes some amounts/i).length).toBeGreaterThan(0);
    });

    it("renders the error state when the request fails", async () => {
        serve({}, ["expiring"]);
        renderOperations("expiring");

        expect((await screen.findByTestId("data-error")).textContent)
            .toMatch(/couldn't load what is expiring/i);
    });
});

// ── Spend ────────────────────────────────────────────────────────────────────

describe("Operations · spend", () => {
    it("compares burn against how much of the period has gone", async () => {
        serve({ spend: fixtures.spendCurrentYear });
        renderOperations("spend");

        expect((await screen.findByTestId("spend-pace")).textContent)
            .toMatch(/4\.6 points ahead of the calendar/);
        expect(screen.getByText("76.9%")).toBeTruthy();
        expect(screen.getByText("72.3%")).toBeTruthy();
    });

    it("keeps a budget's own-currency burn even when its amounts cannot be converted", async () => {
        serve({ spend: fixtures.spendCurrentYear });
        renderOperations("spend");

        const row = (await screen.findByText("Accra office fit-out")).closest("tr") as HTMLElement;
        expect(within(row).getByText("41.8%")).toBeTruthy();
        expect(row.textContent).toMatch(/No exchange rate for GHS/);
        expect(within(row).getAllByTestId("unknown-money").length).toBeGreaterThan(0);
    });

    it("leaves every percentage blank when there is no budget, rather than printing 0%", async () => {
        serve({ spend: fixtures.spendNoBudgets });
        renderOperations("spend");

        expect(await screen.findByText(/No approved budget covers this window/i)).toBeTruthy();
        expect(screen.getAllByTestId("empty-ratio").length).toBeGreaterThan(0);
        expect(document.body.textContent).not.toMatch(/NaN/);
        expect(document.body.textContent).not.toMatch(/0\.0%/);
    });

    it("explains the missing projection early in a period instead of hiding the row", async () => {
        serve({ spend: fixtures.spendEarlyInPeriod });
        renderOperations("spend");

        expect((await screen.findByTestId("spend-projection")).textContent)
            .toMatch(/too little of the period has elapsed/i);
    });

    it("links a budget row through to its record", async () => {
        serve({ spend: fixtures.spendCurrentYear });
        renderOperations("spend");

        await screen.findByText("IT hardware refresh");
        // The budgets register has no per-record deep link, so a row opens the
        // list — said once in the panel description, not per row.
        expect(screen.getAllByRole("link", { name: /Open in Budgets/i })[0].getAttribute("href"))
            .toBe("/budgets");
        expect(screen.getByText(/no per-budget link, so a row opens the list/i)).toBeTruthy();
    });

    it("renders the error state when the request fails", async () => {
        serve({}, ["spend"]);
        renderOperations("spend");

        expect((await screen.findByTestId("data-error")).textContent)
            .toMatch(/couldn't load your budget burn/i);
    });
});

// ── Trends ───────────────────────────────────────────────────────────────────

describe("Operations · trends", () => {
    it("draws a series when there is enough recorded history, with a text alternative", async () => {
        serve({ trends: fixtures.trendsHealthy });
        renderOperations("trends");

        const chart = await screen.findByTestId("trend-chart");
        expect(chart.getAttribute("data-segments")).toBe("1");
        expect(chart.getAttribute("aria-label")).toMatch(/Assets on the books has risen/);
        // The chart is never the only representation.
        expect(screen.getByTestId("trend-summary")).toBeTruthy();
        expect(screen.getByText("Every recorded day")).toBeTruthy();
    });

    it("renders the API's note instead of a chart when history is thin", async () => {
        serve({ trends: fixtures.trendsThinHistory });
        renderOperations("trends");

        const note = await screen.findByTestId("trends-note");
        expect(note.textContent).toMatch(/Only 3 day\(s\) of history exist/);
        expect(note.textContent).toMatch(/First snapshot/);
        // No line, and in particular no flat line along zero.
        expect(screen.queryByTestId("trend-chart")).toBeNull();
    });

    it("draws nothing at all for a tenant with no recorded history", async () => {
        serve({ trends: fixtures.trendsNoHistory });
        renderOperations("trends");

        const note = await screen.findByTestId("trends-note");
        expect(note.textContent).toMatch(/No history has been recorded yet/);
        expect(screen.queryByTestId("trend-chart")).toBeNull();
        expect(screen.getByText(/nothing to draw or list/i)).toBeTruthy();
    });

    it("breaks the series at a change of base currency and suppresses money deltas", async () => {
        serve({ trends: fixtures.trendsCurrencyChanged });
        renderOperations("trends");

        expect(await screen.findByTestId("trends-currency-changed")).toBeTruthy();
        const chart = screen.getByTestId("trend-chart");
        // Two segments, not one line drawn through two different units.
        expect(Number(chart.getAttribute("data-segments"))).toBeGreaterThan(1);
        expect(screen.getByTestId("trends-money-incomparable").textContent)
            .toMatch(/base currency changed during this window/i);
    });

    it("says there is nothing to compare, rather than 'no change', with one point", async () => {
        serve({ trends: { ...fixtures.trendsThinHistory, change: { comparable: false } } });
        renderOperations("trends");

        expect((await screen.findByTestId("trends-change")).textContent)
            .toMatch(/nothing to compare it against/i);
    });

    it("renders the error state when the request fails", async () => {
        serve({}, ["trends"]);
        renderOperations("trends");

        expect((await screen.findByTestId("data-error")).textContent)
            .toMatch(/couldn't load your recorded trends/i);
    });
});

// ── Navigation ───────────────────────────────────────────────────────────────

describe("Operations · views", () => {
    it("keeps the chosen view in the URL so a surface can be linked to", async () => {
        serve({ estate: fixtures.estateByDepartment, "cost-waste": fixtures.costWaste });
        renderOperations("estate");

        await screen.findByText("Engineering");
        fireEvent.click(screen.getByRole("tab", { name: "Cost & waste" }));
        await waitFor(() => expect(push).toHaveBeenCalledWith("?view=waste"));
    });
});
