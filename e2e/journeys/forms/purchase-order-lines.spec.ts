import type { Locator, Page } from "@playwright/test";
import { expect, uniq } from "../../fixtures/auth";
import { clickRowAction, formModal, overLength, rowWith, type FieldSpec } from "../../fixtures/forms";
import { createCategory, createDepartment, createSupplier, dropCategory, dropDepartment, dropSupplier } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { applyCurrencies, orgCurrencies } from "./_finance-helpers";

/**
 * An itemised purchase order, through the same round trip as every other form.
 *
 * The line fields only exist once a row has been added, so both openers make
 * sure exactly one row is on the form before the data-driven fill runs. "Total
 * amount" is deliberately not in the field list: with lines present the server
 * derives it, and the form disables the input to say so.
 */

const supplier = uniq("POL-Supplier");
const department = uniq("POL-Dept");
const category = uniq("POL-Category");
const ids: { supplier?: string; department?: string; category?: string } = {};

const currency: FieldSpec = { label: "Currency", type: "select", value: "USD" };

const PATH = "/purchase-orders";

/** Adds a line row if the form has none, so the line fields are present. */
async function ensureOneLine(scope: Locator): Promise<void> {
    const rows = scope.getByTestId("po-line-row");
    if ((await rows.count()) === 0) {
        await scope.getByTestId("po-add-line").click();
    }
    await expect(rows).toHaveCount(1);
}

describeRoundTrip({
    title: "Purchase order line items",
    path: PATH,
    key: uniq("POLines"),
    editedKey: uniq("POLines-edited"),
    createButton: /New order/i,
    editButton: /^Edit purchase order$/i,
    deleteButton: /^Delete purchase order$/i,
    setup: async ({ api }) => {
        // Deliberately NOT changed on edit. Every list and detail figure in the app
        // is rendered in the viewer's display currency, converted from the record's
        // own — so an order edited into another currency shows a converted amount
        // (USD 4,500 came back as "GHS 74,025.00" on staging), and this file's
        // afterEdit assertions are about the total derived from the lines, not about
        // conversion. purchase-orders.spec.ts covers the currency change.
        applyCurrencies(currency, await orgCurrencies(api), false);
        ids.supplier = (await createSupplier(api, supplier)).id;
        ids.department = (await createDepartment(api, department)).id;
        ids.category = (await createCategory(api, category)).id;
    },
    teardown: async ({ api }) => {
        await dropCategory(api, ids.category);
        await dropDepartment(api, ids.department);
        await dropSupplier(api, ids.supplier);
    },
    openCreate: async (page: Page) => {
        await page.getByRole("button", { name: /New order/i }).first().click();
        const scope = formModal(page);
        await expect(scope).toBeVisible();
        await ensureOneLine(scope);
        return scope;
    },
    openEdit: async (page: Page, key: string) => {
        await clickRowAction(page, key, /^Edit purchase order$/i);
        const scope = formModal(page);
        await expect(scope).toBeVisible();
        await ensureOneLine(scope);
        return scope;
    },
    fields: [
        { label: "PO number", type: "text", value: uniq("POLines"), edit: uniq("POLines-edited") },
        { label: "Supplier", type: "select", value: supplier },
        { label: "Department", type: "select", value: department },
        currency,
        // ── the line ──────────────────────────────────────────────────────────
        { label: "Description", type: "text", value: "Dell Latitude 5450", edit: "Dell Latitude 5550" },
        { label: "Supplier part no.", type: "text", value: "LAT-5450", optional: true },
        { label: "Category", type: "select", value: category, optional: true },
        { label: "Quantity", type: "number", value: 2, edit: 3 },
        { label: "Unit price", type: "number", value: 1200, edit: 1500 },
        { label: "Tax %", type: "number", value: 12.5, optional: true },
    ],
    negative: [
        { field: "Description", value: overLength(500), error: /Description must be at most 500 characters/ },
        { field: "Quantity", value: 0, error: /Quantity must be at least 0\.0001/ },
        { field: "Unit price", value: -1, error: /Unit price must be at least 0/ },
    ],
    afterEdit: async ({ page }, key) => {
        await page.goto(PATH);
        const row = rowWith(page, key);
        // The list shows the derived total (3 x 1500, tax cleared by the edit)
        // and says the order is itemised.
        await expect(row).toContainText(/1 line/i);
        await expect(row).toContainText(/4,?500/);

        await row.getByRole("button", { name: /^View line items$/i }).click();
        const view = page.getByTestId("po-lines-view");
        await expect(view).toBeVisible();
        await expect(view).toContainText("Dell Latitude 5550");
        await expect(page.getByTestId("po-lines-view-total")).toContainText(/4,?500/);
        await page.keyboard.press("Escape");
    },
});

// The lump-sum round trip (no lines, typed total) is purchase-orders.spec.ts:
// this file only covers what changes once an order is itemised.
