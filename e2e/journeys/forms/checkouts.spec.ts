import type { Locator, Page } from "@playwright/test";
import { test, expect, uniq } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";
import {
    DUPLICATE_TOAST,
    bypassNativeValidation,
    expectForm,
    fieldControl,
    fillForm,
    formModal,
    overLength,
    searchList,
    setControl,
    submitAndClose,
    toasts,
    type FieldSpec,
} from "../../fixtures/forms";
import { createAsset, createEmployee, dropAsset, dropEmployee, isoDate } from "../../fixtures/prereqs";
import { tableDate } from "./_core-helpers";

/**
 * Check-out and check-in have no edit form: a checkout record is immutable once
 * issued, and check-in is a one-shot action on an ACTIVE row. So instead of the
 * reopen-and-prefill round trip, these tests assert what the table persists
 * (holder, expected return, condition, notes, status) after a reload, and that
 * the check-in form always opens blank.
 */

const PATH = "/checkouts";
const SEARCH = /Search by asset or holder/i;
const NOTES_MAX = 2000;

const asset = uniq("CheckoutAsset");
const empFirst = uniq("CoFirst");
const empLast = "Holder";
let assetId: string | undefined;
let employeeId: string | undefined;

async function prepare(api: ApiClient): Promise<void> {
    if (assetId) return;
    assetId = (await createAsset(api, asset)).id;
    employeeId = (await createEmployee(api, empFirst, empLast, { status: "ACTIVE" })).id;
}

// ── Check-out to an employee: every field ─────────────────────────────────────
const returnDate = isoDate(14);
const toEmployee: readonly FieldSpec[] = [
    // Option text is "<name> (<tag>)"; only IN_STOCK / IN_USE assets are listed.
    { label: "Asset", type: "select", value: asset },
    { label: "Issue to", type: "select", value: "An employee (no login needed)" },
    // Option text is "<first> <last>[ (<employee number>)]".
    { label: "Employee", type: "select", value: `${empFirst} ${empLast}` },
    { label: "Expected return date", type: "date", value: returnDate },
    { label: "Condition on checkout", type: "text", value: "Good, E2E scuff" },
    { label: "Notes", type: "textarea", value: uniq("issued for field trip") },
];

// ── Check-out to a user account (the admin running the suite) ───────────────
const userCondition = "Fair, E2E user";
const toUser = (email: string): readonly FieldSpec[] => [
    { label: "Asset", type: "select", value: asset },
    { label: "Issue to", type: "select", value: "A user account" },
    // Option text is "<first> <last> (<email>)".
    { label: "User", type: "select", value: email },
    { label: "Condition on checkout", type: "text", value: userCondition },
];

// ── Check-in: both fields ─────────────────────────────────────────────────────
const checkIn: readonly FieldSpec[] = [
    { label: "Condition on return", type: "text", value: "Damaged, E2E" },
    { label: "Notes", type: "textarea", value: uniq("returned with cracked case") },
];

async function openCheckOut(page: Page): Promise<Locator> {
    await page.goto(PATH);
    await page.getByRole("button", { name: /^Check out asset$/i }).first().click();
    const form = formModal(page);
    await expect(form).toBeVisible();
    return form;
}

/** The ACTIVE/RETURNED row for our asset whose text also includes `marker`. */
async function recordRow(page: Page, marker: string): Promise<Locator> {
    await page.goto(PATH);
    await searchList(page, asset, SEARCH);
    const row = page.locator("tr").filter({ hasText: asset }).filter({ hasText: marker }).first();
    await expect(row, `checkout row with "${marker}"`).toBeVisible();
    return row;
}

async function openCheckIn(page: Page, marker: string): Promise<Locator> {
    const row = await recordRow(page, marker);
    await row.getByRole("button", { name: /^Check in$/i }).click();
    const form = formModal(page);
    await expect(form).toBeVisible();
    await expect(form.getByText(/Check in asset/i).first()).toBeVisible();
    return form;
}

/** Sets an over-length value, submits, and asserts the inline error without saving. */
async function expectInlineError(page: Page, form: Locator, spec: FieldSpec, value: string, error: RegExp): Promise<void> {
    const control = await fieldControl(form, spec);
    await bypassNativeValidation(form, control);
    await setControl(control, spec, value);
    await form.locator('button[type="submit"]').last().click();
    await expect(form.getByRole("alert").filter({ hasText: error }).first()).toBeVisible();
    await expect(form, "the form stays open").toBeVisible();
    await expect(toasts(page).filter({ hasText: DUPLICATE_TOAST })).toHaveCount(0);
}

test.describe("Checkouts", () => {
    test("e1) check-out notes over the limit are refused inline", async ({ page, api }) => {
        await prepare(api);
        const form = await openCheckOut(page);
        await fillForm(form, toEmployee, "create");
        await expectInlineError(page, form, toEmployee[5], overLength(NOTES_MAX), /Notes must be at most 2000 characters/);
    });

    test("round trip: check out to an employee, persist, check in, persist; again to a user", async ({ page, api, creds }) => {
        try {
            await test.step("prerequisites", () => prepare(api));

            await test.step("a) check out to an employee with every field", async () => {
                const form = await openCheckOut(page);
                await fillForm(form, toEmployee, "create");
                await submitAndClose(page, form);
            });

            await test.step("b) reload: the record shows every value", async () => {
                const row = await recordRow(page, empFirst);
                await expect(row).toContainText(`${empFirst} ${empLast}`);
                await expect(row).toContainText(tableDate(returnDate));
                await expect(row).toContainText(String(toEmployee[4].value));
                await expect(row).toContainText(String(toEmployee[5].value));
                await expect(row).toContainText("Active");
                await expect(row.getByRole("button", { name: /^Check in$/i })).toBeVisible();
            });

            await test.step("e2) check-in notes over the limit are refused inline", async () => {
                const form = await openCheckIn(page, empFirst);
                await expectInlineError(page, form, checkIn[1], overLength(NOTES_MAX), /Notes must be at most 2000 characters/);
            });

            await test.step("c) check in: the form opens blank, fill both fields", async () => {
                const form = await openCheckIn(page, empFirst);
                // Blank on open: nothing from the checkout is carried into the return.
                for (const spec of checkIn) await expect(await fieldControl(form, spec)).toHaveValue("");
                await fillForm(form, checkIn, "create");
                await expectForm(form, checkIn, "created");
                await submitAndClose(page, form);
            });

            await test.step("d) reload: returned, return condition shown, return notes appended", async () => {
                const row = await recordRow(page, empFirst);
                await expect(row).toContainText("Returned");
                // The condition column prefers the return condition.
                await expect(row).toContainText(String(checkIn[0].value));
                // One notes column: the API appends "Return notes: ..." after the checkout notes.
                const notes = row.locator(`[title*="${String(toEmployee[5].value)}"]`);
                await expect(notes).toHaveAttribute("title", new RegExp(`Return notes: ${String(checkIn[1].value)}`));
                await expect(row.getByRole("button", { name: /^Check in$/i })).toHaveCount(0);
            });

            await test.step("a2) check out the returned asset to a user account", async () => {
                const form = await openCheckOut(page);
                await fillForm(form, toUser(creds.email), "create");
                await submitAndClose(page, form);
                const row = await recordRow(page, userCondition);
                await expect(row).toContainText("Active");
                // No expected return date was given (column 4: Expected return).
                await expect(row.locator("td").nth(3)).toHaveText("—");
            });

            await test.step("c2) check in with both fields blank: the checkout values stay", async () => {
                const form = await openCheckIn(page, userCondition);
                await submitAndClose(page, form);
                const row = await recordRow(page, userCondition);
                await expect(row).toContainText("Returned");
                // No return condition, so the column falls back to the checkout condition.
                await expect(row).toContainText(userCondition);
                await expect(row).not.toContainText("Return notes:");
            });
        } finally {
            await dropAsset(api, assetId);
            await dropEmployee(api, employeeId);
        }
    });
});
