import type { Locator, Page } from "@playwright/test";
import { test, expect, RUN_ID, uniq } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";
import {
    bypassNativeValidation,
    expectForm,
    fieldControl,
    fillForm,
    formModal,
    OVERLAY,
    rowWith,
    searchList,
    submitAndClose,
    type FieldSpec,
} from "../../fixtures/forms";

/**
 * DPA data subject access requests (/dpa/dsar). A request is submitted once
 * (type, subject email, details) and cannot be edited or deleted; afterwards the
 * "Update status" dialog sets status, assignee and response summary. Completed
 * and rejected are final, so the journey ends by rejecting its own request (it
 * stays, prefixed, out of the open queue).
 */

const SEARCH = /Search by email, notes or request type/i;
const subjectEmail = `e2e-${RUN_ID.toLowerCase()}-subject@example.com`;

const SUBMIT_FIELDS: FieldSpec[] = [
    { label: "Request type", type: "select", value: "Erasure" },
    { label: "Data subject email", type: "text", value: subjectEmail },
    { label: "Request details", type: "textarea", value: uniq("DSAR details") },
];

async function openSubmit(page: Page): Promise<Locator> {
    await page.goto("/dpa/dsar");
    await page.getByRole("button", { name: /^New DSAR$/ }).first().click();
    const form = formModal(page);
    await expect(form).toBeVisible();
    return form;
}

function requestRow(page: Page): Locator {
    return rowWith(page, subjectEmail);
}

async function openUpdate(page: Page): Promise<Locator> {
    await page.goto("/dpa/dsar");
    await searchList(page, subjectEmail, SEARCH);
    const row = requestRow(page);
    await expect(row, `DSAR row ${subjectEmail}`).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: /^Update status$/ }).click();
    const form = formModal(page);
    await expect(form).toBeVisible();
    return form;
}

/** Best-effort: a request this run left open (a failed step) is rejected, so it leaves the open queue. */
async function closeLeftover(api: ApiClient): Promise<void> {
    const rows = await api
        .list<{ id: string; requesterEmail?: string; status?: string }>("/dpa/dsar?size=200&sort=submittedAt,desc")
        .catch(() => []);
    for (const row of rows) {
        if (row.requesterEmail?.toLowerCase() !== subjectEmail) continue;
        if (row.status === "COMPLETED" || row.status === "REJECTED") continue;
        await api.patch(`/dpa/dsar/${row.id}/status`, { status: "REJECTED", responseSummary: "" }).catch(() => undefined);
    }
}

test.describe("DSAR requests", () => {
    test("e1) the subject email is required", async ({ page }) => {
        const form = await openSubmit(page);
        await fillForm(form, SUBMIT_FIELDS, "create");
        const email = await fieldControl(form, { label: "Data subject email" });
        await bypassNativeValidation(form, email);
        await email.fill("");
        await form.getByRole("button", { name: /Submit DSAR/ }).click();
        // The message is not (yet) a role=alert on this form, so match the text itself.
        await expect(form.getByText(/email is required/i).first()).toBeVisible();
        await expect(form, "the form stays open").toBeVisible();
    });

    test("round trip: submit, view, assign + respond, clear, reject", async ({ page, api }) => {
        const me = await api.get<{ firstName?: string; lastName?: string }>("/users/me");
        const myName = `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim();
        expect(myName, "the admin has a display name for the assignee picker").not.toBe("");

        const UPDATE_FIELDS: FieldSpec[] = [
            { label: "New status", type: "select", value: "in progress" },
            { label: "Assigned to", type: "select", value: myName, optional: true, clearedText: "Unassigned" },
            { label: "Response summary", type: "textarea", value: uniq("DSAR response"), optional: true },
        ];

        try {
            await test.step("a) submit with every field", async () => {
                const form = await openSubmit(page);
                await fillForm(form, SUBMIT_FIELDS, "create");
                await submitAndClose(page, form, form.getByRole("button", { name: /Submit DSAR/ }));
            });

            await test.step("b) reload: the detail shows what was submitted", async () => {
                await page.goto("/dpa/dsar");
                await searchList(page, subjectEmail, SEARCH);
                const row = requestRow(page);
                await expect(row).toBeVisible({ timeout: 20_000 });
                await expect(row).toContainText("Erasure (right to be forgotten)");
                await expect(row).toContainText(/pending/i);
                await row.getByRole("button", { name: /^View$/ }).click();
                const detail = page.locator(OVERLAY).filter({ hasText: "DSAR detail" }).last();
                await expect(detail).toContainText(subjectEmail);
                await expect(detail).toContainText("Erasure (right to be forgotten)");
                await expect(detail).toContainText(String(SUBMIT_FIELDS[2].value));
                await detail.getByRole("button", { name: /^Close$/ }).click();
            });

            await test.step("c) move to in progress, assign, write a response", async () => {
                const form = await openUpdate(page);
                await fillForm(form, UPDATE_FIELDS, "create");
                await submitAndClose(page, form, form.getByRole("button", { name: /Update status/ }));
            });

            await test.step("d) reload, reopen: status, assignee and summary persisted", async () => {
                const form = await openUpdate(page);
                await expectForm(form, UPDATE_FIELDS, "created");
                await test.step("e) clear the assignee and the summary", async () => {
                    await fillForm(form, UPDATE_FIELDS, "edit");
                    await submitAndClose(page, form, form.getByRole("button", { name: /Update status/ }));
                });
            });

            await test.step("f) reload, reopen: clears persisted", async () => {
                const form = await openUpdate(page);
                await expectForm(form, UPDATE_FIELDS, "edited");
                await test.step("g) reject (final): the request leaves the open queue", async () => {
                    const status = await fieldControl(form, { label: "New status" });
                    await status.selectOption("REJECTED");
                    await submitAndClose(page, form, form.getByRole("button", { name: /Update status/ }));
                });
            });

            await test.step("h) a rejected request can no longer be updated", async () => {
                await page.goto("/dpa/dsar");
                await searchList(page, subjectEmail, SEARCH);
                const row = requestRow(page);
                await expect(row).toContainText(/rejected/i);
                await expect(row.getByRole("button", { name: /^Update status$/ })).toHaveCount(0);
            });
        } finally {
            await closeLeftover(api);
        }
    });
});
