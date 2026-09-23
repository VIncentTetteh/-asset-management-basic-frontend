import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ExpensesPage from "@/app/expenses/page";
import api from "@/lib/axios";

/**
 * What an expense row says about its receipt.
 *
 * An expense is submitted once and can then only be approved, rejected or
 * deleted — there is no detail or edit form — so the list row is the only place
 * its receipt is ever reachable. When the receipt field became an upload the
 * row still showed only the legacy `receiptUrl` link, which a newly created
 * expense never has: the file went up and became unreachable, and an approver
 * was asked to approve spend with no way to see what backed it. These tests
 * pin the row down on all three states.
 */

const EXPENSE_ID = "11111111-2222-3333-4444-555555555555";

const expenses = vi.hoisted(() => ({
    getPaged: vi.fn(),
    listPending: vi.fn(),
    getById: vi.fn(),
    submit: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    delete: vi.fn(),
}));
vi.mock("@/services/expenseService", () => ({ expenseService: expenses }));
vi.mock("@/services/assetService", () => ({ assetService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock("@/services/budgetService", () => ({ budgetService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock("@/services/departmentService", () => ({ departmentService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/config/commercialFeatures", () => ({
    commercialFeatures: { documentAttachments: true },
    isCommercialRouteDisabled: () => false,
}));
vi.mock("@/contexts/CurrencyContext", () => ({
    useCurrency: () => ({
        baseCurrency: "USD",
        availableCurrencies: ["USD"],
        format: (amount: number, currency = "USD") => `${currency} ${amount}`,
        sum: () => ({ total: 0, currency: "USD", complete: true, missingRates: [] }),
    }),
}));
vi.mock("@/lib/axios", () => ({
    default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const expense = (overrides: Record<string, unknown> = {}) => ({
    id: EXPENSE_ID,
    title: "Design tool renewal",
    amount: 120,
    currency: "USD",
    category: "SOFTWARE",
    status: "SUBMITTED",
    expenseDate: "2026-09-01",
    ...overrides,
});

/** Answers the row's attachment lookup with `files`, and nothing else. */
function serveAttachments(files: unknown[]): void {
    mockedApi.get.mockImplementation((url: string) =>
        url === "/documents" ? Promise.resolve({ data: files }) : Promise.resolve({ data: [] }),
    );
}

afterEach(cleanup);
beforeEach(() => {
    expenses.getPaged.mockReset().mockResolvedValue({ total: 1, limit: 20, offset: 0, items: [expense()] });
    expenses.listPending.mockReset().mockResolvedValue([]);
    mockedApi.get.mockReset();
    serveAttachments([]);
});

const renderPage = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <ExpensesPage />
        </QueryClientProvider>,
    );
};

describe("the receipt on an expense row", () => {
    it("offers the attached file, because the row is the only way to reach it", async () => {
        serveAttachments([{ id: "doc-1", originalName: "renewal-invoice.pdf", contentType: "application/pdf", fileSize: 1024 }]);
        renderPage();

        const receipt = await screen.findByRole("button", { name: "Receipt" });
        expect(receipt.getAttribute("title")).toBe("Open renewal-invoice.pdf");
        await waitFor(() =>
            expect(mockedApi.get).toHaveBeenCalledWith("/documents", {
                params: { entityType: "EXPENSE", entityId: EXPENSE_ID },
            }),
        );
    });

    it("says there is no receipt rather than staying silent, so an approver is never guessing", async () => {
        renderPage();
        expect(await screen.findByText("No receipt")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Receipt" })).toBeNull();
    });

    it("still opens a link stored before receipts were uploads", async () => {
        expenses.getPaged.mockResolvedValue({
            total: 1,
            limit: 20,
            offset: 0,
            items: [expense({ receiptUrl: "https://files.example.com/receipt.pdf" })],
        });
        renderPage();

        const link = await screen.findByRole("link", { name: "Receipt" });
        expect(link.getAttribute("href")).toBe("https://files.example.com/receipt.pdf");
        expect(screen.queryByText("No receipt")).toBeNull();
    });
});
