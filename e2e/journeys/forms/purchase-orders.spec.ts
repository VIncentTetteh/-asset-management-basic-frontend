import { approverCredentials, expect, installStepUpHandler, login, test, uniq } from "../../fixtures/auth";
import { overLength, rowWith, type FieldSpec } from "../../fixtures/forms";
import { createDepartment, createSupplier, dropDepartment, dropSupplier, isoDate } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { applyCurrencies, createBudget, dropBudget, orgCurrencies, organisationIdOf } from "./_finance-helpers";

// Pickers: two suppliers (the edit switches supplier), a department and a budget
// in the base currency (a linked PO must use the budget's currency).
const supplier = uniq("PO-Supplier-A");
const supplier2 = uniq("PO-Supplier-B");
const department = uniq("PO-Dept");
const budget = uniq("PO-Budget");
const ids: { suppliers: string[]; department?: string; budget?: string } = { suppliers: [] };

// Filled in at setup from the tenant's currencies. The edit unlinks the budget,
// so the currency is free to change then.
const currency: FieldSpec = { label: "Currency", type: "select", value: "USD" };

const PATH = "/purchase-orders";
const STATUS_TIMEOUT = 20_000;

describeRoundTrip({
    title: "Purchase orders",
    path: PATH,
    key: uniq("PurchaseOrder"),
    editedKey: uniq("PurchaseOrder-edited"),
    createButton: /New order/i,
    // Edit is offered on DRAFT orders only.
    editButton: /^Edit purchase order$/i,
    deleteButton: /^Delete purchase order$/i,
    setup: async ({ api }) => {
        const currencies = await orgCurrencies(api);
        applyCurrencies(currency, currencies);
        ids.suppliers.push((await createSupplier(api, supplier)).id, (await createSupplier(api, supplier2)).id);
        ids.department = (await createDepartment(api, department)).id;
        ids.budget = (await createBudget(api, budget, currencies.base)).id;
    },
    teardown: async ({ api }) => {
        await dropBudget(api, ids.budget);
        await dropDepartment(api, ids.department);
        for (const id of ids.suppliers) await dropSupplier(api, id);
    },
    fields: [
        { label: "PO number", type: "text", value: uniq("PurchaseOrder"), edit: uniq("PurchaseOrder-edited") },
        // Option text is "<name> (<currency>)"; the empty option is "No budget".
        { label: "Budget", type: "select", value: budget, optional: true },
        { label: "Supplier", type: "select", value: supplier, edit: supplier2 },
        { label: "Department", type: "select", value: department },
        { label: "Total amount", type: "number", value: 2_500, edit: 3_750.25 },
        currency,
        { label: "Expected delivery", type: "date", value: isoDate(30), optional: true },
        { label: "Remarks", type: "textarea", value: uniq("po remarks"), optional: true },
    ],
    negative: [
        { field: "PO number", value: overLength(255), error: /PO number must be at most 255 characters/ },
        { field: "Total amount", value: 0, error: /Total amount must be at least 0\.01/ },
    ],
    // DRAFT -> SUBMITTED from the row action; the order then leaves the edit flow.
    afterEdit: async ({ page }, key) => {
        await page.goto(PATH);
        const row = rowWith(page, key);
        await expect(row).toContainText(/draft/i);
        await row.getByRole("button", { name: /^Submit for approval purchase order$/i }).click();
        await expect(row).toContainText(/submitted/i, { timeout: STATUS_TIMEOUT });
        await expect(row.getByRole("button", { name: /^Edit purchase order$/i })).toHaveCount(0);
        // Approving needs a different user (maker-checker): see the test below.
        await expect(row.getByRole("button", { name: /^Approve purchase order$/i })).toBeVisible();
    },
});

test.describe("Purchase orders: approval by a second user", () => {
    test("a submitted order is approved by another user", async ({ page, api, browser, baseURL }) => {
        const approver = approverCredentials();
        test.skip(!approver, "maker-checker needs a second user: set E2E_APPROVER_EMAIL and E2E_APPROVER_PASSWORD");
        if (!approver || !baseURL) return;

        const poNumber = uniq("PO-Approval");
        const created: { supplier?: string; department?: string; po?: string } = {};
        try {
            await test.step("admin creates and submits a draft order via the API", async () => {
                const { base } = await orgCurrencies(api);
                created.supplier = (await createSupplier(api, uniq("PO-Approval-Supplier"))).id;
                created.department = (await createDepartment(api, uniq("PO-Approval-Dept"))).id;
                const po = await api.post<{ id: string }>(await api.withOrg("/purchase-orders"), {
                    poNumber,
                    totalAmount: 100,
                    currency: base,
                    supplierId: created.supplier,
                    departmentId: created.department,
                    organisationId: await organisationIdOf(page),
                });
                created.po = po.id;
                await api.post(await api.withOrg(`/purchase-orders/${po.id}/submit`));
            });

            await test.step("the approver approves it from the list", async () => {
                const context = await browser.newContext({ baseURL });
                try {
                    const approverPage = await context.newPage();
                    await installStepUpHandler(approverPage, approver);
                    await login(approverPage, approver);
                    await approverPage.goto(PATH);
                    const row = rowWith(approverPage, poNumber);
                    await expect(row).toContainText(/submitted/i);
                    await row.getByRole("button", { name: /^Approve purchase order$/i }).click();
                    await expect(row).toContainText(/approved/i, { timeout: STATUS_TIMEOUT });
                } finally {
                    await context.close();
                }
            });

            await test.step("the maker sees it approved", async () => {
                await page.goto(PATH);
                await expect(rowWith(page, poNumber)).toContainText(/approved/i);
            });
        } finally {
            if (created.po) await api.tryDelete(await api.withOrg(`/purchase-orders/${created.po}`));
            await dropDepartment(api, created.department);
            await dropSupplier(api, created.supplier);
        }
    });
});
