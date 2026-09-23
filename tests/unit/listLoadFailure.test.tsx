import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import SuppliersPage from "@/app/suppliers/page";

/**
 * An empty list and a broken list must never look alike.
 *
 * Every list page in this app renders a `DataTable`, and every one of them used
 * to show its empty state when the request failed: "No suppliers yet - add your
 * first supplier" to someone with two hundred suppliers and a dropped
 * connection. Most of those pages did not even toast, so the failure was
 * completely silent. Teaching `DataTable` the difference fixes the whole class
 * at once, which is why the contract is tested here rather than page by page.
 */

type Row = { id: string; name: string };
const columns: ColumnDef<Row, unknown>[] = [{ accessorKey: "name", header: "Name" }];

afterEach(cleanup);

describe("DataTable", () => {
    it("shows the empty state when the list is genuinely empty", () => {
        render(<DataTable columns={columns} data={[]} emptyTitle="No suppliers yet" />);

        expect(screen.getByText("No suppliers yet")).toBeTruthy();
        expect(screen.queryByTestId("data-error")).toBeNull();
    });

    it("shows the failure — and not the empty state — when the request failed", () => {
        render(
            <DataTable
                columns={columns}
                data={[]}
                error={new Error("Request failed with status code 503")}
                errorWhat="your suppliers"
                emptyTitle="No suppliers yet"
            />,
        );

        const alert = screen.getByTestId("data-error");
        expect(alert.textContent).toMatch(/couldn't load your suppliers/i);
        expect(alert.getAttribute("role")).toBe("alert");
        // The claim the user must never be shown for a failed request.
        expect(screen.queryByText("No suppliers yet")).toBeNull();
    });

    it("retries through the caller's refetch", () => {
        const onRetry = vi.fn();
        render(
            <DataTable
                columns={columns}
                data={[]}
                error={new Error("boom")}
                onRetry={onRetry}
                emptyTitle="No suppliers yet"
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /try again/i }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("says nothing at all while the first load is still in flight", () => {
        render(
            <DataTable
                columns={columns}
                data={[]}
                isLoading
                error={new Error("a stale error from the previous page")}
                emptyTitle="No suppliers yet"
            />,
        );

        expect(screen.queryByTestId("data-error")).toBeNull();
        expect(screen.queryByText("No suppliers yet")).toBeNull();
    });

    it("keeps showing the rows it has, rather than replacing them with a failure", () => {
        // A background refetch can fail while good data is on screen. Throwing
        // the table away for it would be a downgrade, not a warning.
        render(
            <DataTable
                columns={columns}
                data={[{ id: "1", name: "Acme Supplies" }]}
                error={new Error("background refetch failed")}
                emptyTitle="No suppliers yet"
            />,
        );

        expect(screen.getByText("Acme Supplies")).toBeTruthy();
    });
});

// ── The same guarantee, through a real page ──────────────────────────────────

const supplierSvc = vi.hoisted(() => ({ getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("@/services/supplierService", () => ({ supplierService: supplierSvc }));
vi.mock("@/services/bulkOperationService", () => ({ bulkOperationService: { exportSuppliers: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("react-hot-toast", () => {
    const fn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() });
    return { toast: fn, default: fn };
});

beforeEach(() => {
    supplierSvc.getAll.mockReset();
});

function renderSuppliers() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <SuppliersPage />
        </QueryClientProvider>,
    );
}

describe("the suppliers register", () => {
    it("does not tell a user with suppliers that they have none", async () => {
        supplierSvc.getAll.mockRejectedValue(new Error("Request failed with status code 500"));

        renderSuppliers();

        const alert = await screen.findByTestId("data-error");
        expect(alert.textContent).toMatch(/couldn't load your suppliers/i);
        expect(screen.queryByText(/no suppliers/i)).toBeNull();
    });

    it("recovers the list when the retry succeeds, without a reload", async () => {
        supplierSvc.getAll.mockRejectedValueOnce(new Error("boom"));
        renderSuppliers();

        await screen.findByTestId("data-error");

        supplierSvc.getAll.mockResolvedValue([{ id: "s-1", name: "Acme Supplies" }]);
        fireEvent.click(screen.getByRole("button", { name: /try again/i }));

        expect(await screen.findByText("Acme Supplies")).toBeTruthy();
        await waitFor(() => expect(screen.queryByTestId("data-error")).toBeNull());
    });
});
