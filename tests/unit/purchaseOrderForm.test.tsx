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
const suppliersSvc = vi.hoisted(() => ({ getAll: vi.fn() }));
vi.mock("@/services/supplierService", () => ({ supplierService: suppliersSvc }));
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
    suppliersSvc.getAll.mockReset();
    suppliersSvc.getAll.mockResolvedValue([{ id: "sup-1", name: "Acme Supplies" }]);
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

    it("waits for the supplier list before prefilling, so reopening an order keeps its supplier", async () => {
        // The order arrives before the suppliers do — the exact ordering staging
        // served (GET /purchase-orders answered first, GET /suppliers last). A form
        // prefilled in that window leaves the <select> on its placeholder for good,
        // because a select cannot hold a value it has no <option> for.
        let releaseSuppliers: (value: unknown) => void = () => undefined;
        suppliersSvc.getAll.mockReturnValue(new Promise((resolve) => { releaseSuppliers = resolve; }));
        purchaseOrders.getAll.mockResolvedValue([{
            id: "po-9",
            poNumber: "PO-2026-009",
            totalAmount: 2400,
            currency: "USD",
            status: "DRAFT",
            supplierId: "sup-1",
            departmentId: "dep-1",
            lineItems: [{ description: "Dell Latitude 5450", quantity: 2, unitPrice: 1200 }],
        }]);
        purchaseOrders.replace.mockResolvedValue({ id: "po-9" });

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <PurchaseOrdersPage />
            </QueryClientProvider>,
        );

        fireEvent.click(await screen.findByRole("button", { name: /^Edit purchase order$/i }));
        releaseSuppliers([{ id: "sup-1", name: "Acme Supplies" }]);

        const supplier = (await screen.findByLabelText(/Supplier/)) as HTMLSelectElement;
        await waitFor(() => expect(supplier.value).toBe("sup-1"));
        expect(supplier.selectedOptions[0].text).toBe("Acme Supplies");

        // And the save carries it, rather than being refused as "Supplier is required".
        fireEvent.submit(
            (screen.getByRole("button", { name: /^Save changes$/ }).closest("form")) as HTMLFormElement,
        );
        await waitFor(() => expect(purchaseOrders.replace).toHaveBeenCalledTimes(1));
        expect(purchaseOrders.replace.mock.calls[0][1]).toMatchObject({ supplierId: "sup-1", departmentId: "dep-1" });
        expect(toastFns.error).not.toHaveBeenCalled();
    });
});
