import type { Page } from "@playwright/test";
import { opsApproverCredentials, expect, test, uniq } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";
import { acceptConfirm, fieldControl, formModal, overLength, rowWith, submitAndClose, type FieldSpec } from "../../fixtures/forms";
import { createAsset, dropAsset, isoDate, type Created } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { asApprover, baseCurrency, NO_APPROVER, pickAsset } from "./_workflow-helpers";

/**
 * Disposal request (features/disposals/DisposalFormModal.tsx): request, edit
 * while pending, delete. The asset is picked on create only (locked on edit),
 * so the picker is driven by openCreate rather than the field list.
 *
 * Currency: the select's empty option means "the asset's currency" and the API
 * fills that in on save, so a cleared currency reads back as the asset's own.
 * The asset is created in the organisation's base currency, which is also
 * what the create step selects.
 */

const PATH = "/disposals";
const assetName = uniq("DispAsset");
let asset: Created | undefined;

const currency: FieldSpec = { label: "Currency", type: "select", value: "USD", optional: true, clearedText: "USD" };

/** Removes every disposal of an asset (best-effort; an approved one cannot be deleted and stays). */
async function dropDisposalsFor(api: ApiClient, assetId?: string): Promise<void> {
    if (!assetId) return;
    const rows = await api.list<{ id: string; assetId?: string }>("/disposals").catch(() => []);
    for (const row of rows.filter((r) => r.assetId === assetId)) await api.tryDelete(`/disposals/${row.id}`);
}

async function openRequest(page: Page, name: string) {
    await page.getByRole("button", { name: /^Request disposal$/ }).first().click();
    const form = formModal(page);
    await expect(form).toBeVisible();
    await pickAsset(form, name);
    return form;
}

describeRoundTrip({
    title: "Disposals",
    path: PATH,
    key: assetName,
    openCreate: (page) => openRequest(page, assetName),
    editButton: /^Edit disposal$/,
    deleteButton: /^Delete disposal$/,
    setup: async ({ api }) => {
        const code = await baseCurrency(api);
        currency.value = code;
        currency.clearedText = code;
        asset = await createAsset(api, assetName, { currency: code });
    },
    teardown: async ({ api }) => {
        await dropDisposalsFor(api, asset?.id);
        await dropAsset(api, asset?.id);
    },
    fields: [
        { label: "Disposal date", type: "date", value: isoDate(-3), edit: isoDate(-5) },
        // "Sale — sold to buyer" (the first option containing "Sale").
        { label: "Disposal method", type: "select", value: "Sale", edit: "Recycling" },
        { label: "Primary reason", type: "textarea", value: uniq("disposal reason"), edit: uniq("disposal reason edited") },
        { label: "Value recovered", type: "number", value: 250.5, optional: true },
        currency,
        {
            label: "Compliance document (link or reference)",
            type: "text",
            value: "https://example.com/e2e/certificate-of-destruction.pdf",
            optional: true,
        },
    ],
    negative: [
        { field: "Primary reason", value: overLength(5000), error: /Reason must be at most 5000 characters/ },
        { field: "Value recovered", value: -1, error: /Value recovered must be at least 0/ },
        {
            field: "Compliance document (link or reference)",
            value: "javascript:alert(1)",
            error: /Compliance document must be an http:\/\/ or https:\/\/ link/,
        },
    ],
});

test.describe("Disposals: maker-checker", () => {
    test("a second user rejects the request with a reason, then the requester deletes it", async ({ page, api, browser }) => {
        const approver = opsApproverCredentials();
        test.skip(!approver, NO_APPROVER);
        const name = uniq("DispApprovalAsset");
        const reason = uniq("disposal for review");
        const rejection = uniq("still under warranty");
        const target = await createAsset(api, name);
        try {
            await test.step("admin requests the disposal", async () => {
                await page.goto(PATH);
                const form = await openRequest(page, name);
                const why = await fieldControl(form, { label: "Primary reason" });
                await why.fill(reason);
                await submitAndClose(page, form);
                const row = rowWith(page, reason);
                await expect(row).toContainText("Pending Approval");
                // The requester is never offered Approve on their own request.
                await expect(row.getByRole("button", { name: "Approve disposal" })).toHaveCount(0);
            });

            await test.step("approver rejects it in a separate session", async () => {
                await asApprover(browser, approver!, async (approverPage) => {
                    await approverPage.goto(PATH);
                    const row = rowWith(approverPage, reason);
                    await expect(row.getByRole("button", { name: "Approve disposal" })).toBeVisible();
                    await row.getByRole("button", { name: "Reject disposal" }).click();
                    const form = formModal(approverPage);
                    await expect(form.getByRole("heading", { name: "Reject disposal" })).toBeVisible();
                    await (await fieldControl(form, { label: "Reason" })).fill(rejection);
                    await submitAndClose(approverPage, form, form.getByRole("button", { name: /^Reject$/ }));
                    await expect(rowWith(approverPage, reason)).toContainText("Rejected", { timeout: 20_000 });
                });
            });

            await test.step("requester sees the rejection trail and deletes the record", async () => {
                await page.goto(PATH);
                const row = rowWith(page, reason);
                await expect(row).toContainText("Rejected");
                await expect(row).toContainText(rejection);
                await row.getByRole("button", { name: "Delete disposal" }).click();
                await acceptConfirm(page);
                await expect(rowWith(page, reason)).toBeHidden({ timeout: 20_000 });
            });
        } finally {
            await dropDisposalsFor(api, target.id);
            await dropAsset(api, target.id);
        }
    });
});
