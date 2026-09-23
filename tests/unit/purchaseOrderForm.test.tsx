import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PurchaseOrdersPage from "@/app/purchase-orders/page";

/**
 * The purchase-order form, rendered and submitted for real.
 *
 * `financePayloads.test.ts` already proves `buildPurchaseOrderPayload` — and it
 * passed all along, because the defect was never in the payload: with a line
 * present, react-hook-form refused to submit at all, so the builder was never
 * reached and no request was made. The only level that catches that is one that
 * renders the page and clicks Save, which is what this file does.
 */

const purchaseOrders = vi.hoisted(() => ({
    getAll: vi.fn(),
    create: vi.fn(),
    replace: vi.fn(),
}));
vi.mock("@/services/purchaseOrderService", () => ({ purchaseOrderService: purchaseOrders }));
vi.mock("@/services/budgetService", () => ({ budgetService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock("@/services/supplierService", () => ({
    supplierService: { getAll: vi.fn().mockResolvedValue([{ id: "sup-1", name: "Acme Supplies" }]) },
}));
vi.mock("@/services/departmentService", () => ({
    departmentService: { getAll: vi.fn().mockResolvedValue([{ id: "dep-1", name: "Finance" }]) },
}));
vi.mock("@/services/categoryService", () => ({
    categoryService: { getAll: vi.fn().mockResolvedValue([{ id: "cat-1", name: "Laptops" }]) },
}));
vi.mock("@/services/bulkOperationService", () => ({ bulkOperationService: { exportPurchaseOrders: vi.fn() } }));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/authContext", () => ({ getOrganisationIdFromStorage: () => "org-1" }));
vi.mock("@/contexts/CurrencyContext", () => ({
    useCurrency: () => ({
        baseCurrency: "USD",
        availableCurrencies: ["USD", "GHS"],
        format: (amount: number, currency = "USD") => `${currency} ${amount}`,
        sum: () => ({ total: 0, currency: "USD", complete: true, missingRates: [] }),
    }),
}));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.success = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

afterEach(cleanup);
beforeEach(() => {
    // The hoisted mocks live for the whole file; each test starts from zero calls.
    purchaseOrders.create.mockReset();
    purchaseOrders.replace.mockReset();
    toastFns.error.mockClear();
    toastFns.success.mockClear();
});

function renderPage() {
    purchaseOrders.getAll.mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <PurchaseOrdersPage />
        </QueryClientProvider>,
    );
}

/** Opens "New order" and fills the header fields every order needs. */
async function openCreateForm() {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /New order/i }));
    await screen.findByLabelText(/PO number/);
    fireEvent.change(screen.getByLabelText(/PO number/), { target: { value: "PO-2026-001" } });
    fireEvent.change(screen.getByLabelText(/Supplier/), { target: { value: "sup-1" } });
    fireEvent.change(screen.getByLabelText(/Department/), { target: { value: "dep-1" } });
}

/** Adds one line and fills it. */
function fillOneLine() {
    fireEvent.click(screen.getByTestId("po-add-line"));
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "Dell Latitude 5450" } });
    fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/^Unit price/), { target: { value: "1200" } });
}

const save = () => {
    // happy-dom does not run implicit form submission from a click on a submit
    // button, so the form event is dispatched directly.
    const button = screen.getByRole("button", { name: /^(Create order|Save changes)$/ });
    fireEvent.submit(button.closest("form") as HTMLFormElement);
};

describe("purchase order form", () => {
    it("submits an itemised order: the disabled total must not block the save", async () => {
        purchaseOrders.create.mockResolvedValue({ id: "po-1" });
        await openCreateForm();
        fillOneLine();
        save();

        await waitFor(() => expect(purchaseOrders.create).toHaveBeenCalledTimes(1));
        const body = purchaseOrders.create.mock.calls[0][0];
        expect(body.poNumber).toBe("PO-2026-001");
        // Derived from the line (2 x 1200), not from the disabled "Total amount" input.
        expect(body.totalAmount).toBe(2400);
        expect(body.lineItems).toHaveLength(1);
        expect(body.lineItems[0]).toMatchObject({ description: "Dell Latitude 5450", quantity: 2, unitPrice: 1200 });
    });

    it("keeps the typed total when the order has no lines", async () => {
        purchaseOrders.create.mockResolvedValue({ id: "po-2" });
        await openCreateForm();
        fireEvent.change(screen.getByLabelText(/Total amount/), { target: { value: "500" } });
        save();

        await waitFor(() => expect(purchaseOrders.create).toHaveBeenCalledTimes(1));
        expect(purchaseOrders.create.mock.calls[0][0].totalAmount).toBe(500);
        expect(purchaseOrders.create.mock.calls[0][0].lineItems).toEqual([]);
    });

    it("never refuses a save in silence: a blocked submit always says why", async () => {
        await openCreateForm();
        // Clear the PO number: a required-field failure the user must be told about.
        fireEvent.change(screen.getByLabelText(/PO number/), { target: { value: "" } });
        fillOneLine();
        save();

        await waitFor(() => expect(toastFns.error).toHaveBeenCalled());
        expect(String(toastFns.error.mock.calls[0][0])).toMatch(/PO number/i);
        expect(purchaseOrders.create).not.toHaveBeenCalled();
    });
});
