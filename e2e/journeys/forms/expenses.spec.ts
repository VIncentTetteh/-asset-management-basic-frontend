import type { Page } from "@playwright/test";
import { expect, test, uniq } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";
import {
    DUPLICATE_TOAST,
    acceptConfirm,
    bypassNativeValidation,
    fieldControl,
    fillForm,
    formModal,
    overLength,
    rowWith,
    searchList,
    setControl,
    submitAndClose,
    toasts,
    type FieldSpec,
} from "../../fixtures/forms";
import { createAsset, createDepartment, dropAsset, dropDepartment, isoDate } from "../../fixtures/prereqs";
import { applyCurrencies, createBudget, dropBudget, orgCurrencies } from "./_finance-helpers";

/**
 * Expenses have no edit form: "Submit expense" posts straight to the approval
 * queue and a row can only be approved, rejected or deleted. So instead of the
 * standard round trip this creates one with every field, checks the list row
 * and the stored record (via the API), then deletes it from the row.
 */

const PATH = "/expenses";
const SEARCH = /Search title or description/i;
const title = uniq("Expense");
const budget = uniq("EX-Budget");
const asset = uniq("EX-Asset");
const department = uniq("EX-Dept");
const receiptUrl = "https://example.com/e2e/receipt.pdf";
const description = uniq("expense description");
const expenseDate = isoDate(-2);
const amount = 123.45;
const ids: { budget?: string; asset?: string; department?: string } = {};

// Filled in at setup. Filled before the budget: linking a budget locks the select to its currency.
const currency: FieldSpec = { label: "Currency", type: "select", value: "USD" };

const fields: readonly FieldSpec[] = [
    { label: "Title", type: "text", value: title },
    { label: "Amount", type: "number", value: amount },
    currency,
    { label: "Category", type: "select", value: "Software" },
    { label: "Expense date", type: "date", value: expenseDate },
    // Option text is "<name> (<currency>)".
    { label: "Linked budget", type: "select", value: budget },
    { label: "Linked asset", type: "select", value: asset },
    { label: "Department", type: "select", value: department },
    { label: "Receipt URL", type: "text", value: receiptUrl },
    { label: "Description", type: "textarea", value: description },
];

let prepared = false;
async function prepare(api: ApiClient): Promise<void> {
    if (prepared) return;
    const currencies = await orgCurrencies(api);
    applyCurrencies(currency, currencies, false);
    ids.budget = (await createBudget(api, budget, currencies.base)).id;
    ids.asset = (await createAsset(api, asset)).id;
    ids.department = (await createDepartment(api, department)).id;
    prepared = true;
}

async function openSubmit(page: Page) {
    await page.goto(PATH);
    await page.getByRole("button", { name: /^Submit expense$/i }).first().click();
    const form = formModal(page);
    await expect(form).toBeVisible();
    return form;
}

interface StoredExpense {
    id: string;
    title?: string;
    description?: string;
    amount?: number | string;
    currency?: string;
    category?: string;
    status?: string;
    expenseDate?: string;
    linkedBudgetId?: string;
    linkedAssetId?: string;
    departmentId?: string;
    receiptUrl?: string;
}

async function findStored(api: ApiClient, text: string): Promise<StoredExpense | undefined> {
    const rows = await api.list<StoredExpense>(`/expenses?search=${encodeURIComponent(text)}&size=20`);
    return rows.find((row) => row.title === text);
}

const NEGATIVE: readonly { field: string; value: string | number; error: RegExp }[] = [
    { field: "Title", value: overLength(255), error: /Title must be at most 255 characters/ },
    { field: "Amount", value: 0, error: /Amount must be at least 0\.01/ },
    { field: "Receipt URL", value: "ftp://example.com/receipt.pdf", error: /Receipt URL must be an http:\/\/ or https:\/\/ link/ },
];

test.describe("Expenses", () => {
    for (const [index, neg] of NEGATIVE.entries()) {
        test(`e${index + 1}) inline error for invalid "${neg.field}"`, async ({ page, api }) => {
            await prepare(api);
            const form = await openSubmit(page);
            await fillForm(form, fields, "create");
            const spec = fields.find((f) => f.label === neg.field)!;
            const control = await fieldControl(form, spec);
            await bypassNativeValidation(form, control);
            await setControl(control, spec, neg.value);
            await form.locator('button[type="submit"]').last().click();

            await expect(form.getByRole("alert").filter({ hasText: neg.error }).first()).toBeVisible();
            await expect(form, "the form stays open").toBeVisible();
            await expect(toasts(page).filter({ hasText: DUPLICATE_TOAST })).toHaveCount(0);
        });
    }

    test("submit with every field, row + stored record, delete", async ({ page, api }) => {
        let created = false;
        try {
            await test.step("prerequisites", () => prepare(api));

            await test.step("a) submit with every field filled", async () => {
                const form = await openSubmit(page);
                await fillForm(form, fields, "create");
                await submitAndClose(page, form);
                created = true;
            });

            await test.step("b) the list row shows the expense", async () => {
                await page.goto(PATH);
                await searchList(page, title, SEARCH);
                const row = rowWith(page, title);
                await expect(row).toBeVisible();
                await expect(row).toContainText("Software");
                await expect(row).toContainText(department);
                await expect(row).toContainText(description);
                await expect(row).toContainText(`Asset · ${asset}`);
                await expect(row).toContainText(budget);
                await expect(row).toContainText(/submitted/i);
                await expect(row.getByRole("link", { name: "Receipt" })).toBeVisible();
            });

            await test.step("c) every field was stored (no edit form to reopen)", async () => {
                const stored = await findStored(api, title);
                expect(stored, `expense "${title}" via the API`).toBeTruthy();
                expect(stored).toMatchObject({
                    title,
                    description,
                    currency: currency.value,
                    category: "SOFTWARE",
                    status: "SUBMITTED",
                    linkedBudgetId: ids.budget,
                    linkedAssetId: ids.asset,
                    departmentId: ids.department,
                    receiptUrl,
                });
                expect(Number(stored!.amount)).toBe(amount);
                expect(String(stored!.expenseDate).slice(0, 10)).toBe(expenseDate);
            });

            await test.step("f) delete from the row", async () => {
                await page.goto(PATH);
                await searchList(page, title, SEARCH);
                const row = rowWith(page, title);
                await row.getByRole("button", { name: /^Delete expense$/i }).click();
                await acceptConfirm(page);
                await expect(rowWith(page, title)).toBeHidden({ timeout: 20_000 });
                created = false;
            });
        } finally {
            if (created) {
                const stored = await findStored(api, title).catch(() => undefined);
                if (stored) await api.tryDelete(`/expenses/${stored.id}`);
            }
            // The budget may be kept by its ledger history; the prefix marks it as a leftover.
            await dropBudget(api, ids.budget);
            await dropAsset(api, ids.asset);
            await dropDepartment(api, ids.department);
        }
    });
});
