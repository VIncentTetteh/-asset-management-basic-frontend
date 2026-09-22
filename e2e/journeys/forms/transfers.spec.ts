import type { Locator, Page } from "@playwright/test";
import { opsApproverCredentials, expect, test, uniq } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";
import {
    acceptConfirm,
    bypassNativeValidation,
    expectControl,
    fieldControl,
    fillForm,
    formModal,
    overLength,
    rowWith,
    setControl,
    submitAndClose,
    toasts,
    type FieldSpec,
} from "../../fixtures/forms";
import {
    createAsset,
    createDepartment,
    createLocation,
    dropAsset,
    dropDepartment,
    dropLocation,
    type Created,
} from "../../fixtures/prereqs";
import { asApprover, NO_APPROVER } from "./_workflow-helpers";

/**
 * Asset transfer request (features/transfers/TransferFormModal.tsx). A request
 * cannot be edited, only approved / rejected / completed / deleted, so this is a
 * request round trip: fill every field, check the list shows each one after a
 * reload, then delete. The origin selects are display-only (derived from the
 * asset), so they are asserted, not filled.
 */

const PATH = "/transfers";

const names = {
    fromDept: uniq("TrFromDept"),
    toDept: uniq("TrToDept"),
    fromLoc: uniq("TrFromLoc"),
    toLoc: uniq("TrToLoc"),
    asset: uniq("TrAsset"),
    approvalAsset: uniq("TrAsset-approval"),
};

interface Prereqs {
    fromDept: Created;
    toDept: Created;
    fromLoc: Created;
    toLoc: Created;
    asset: Created;
    approvalAsset: Created;
}

let prereqs: Promise<Prereqs> | undefined;

/** Two departments, two locations and two assets placed at the origin; created once per worker. */
function ensurePrereqs(api: ApiClient): Promise<Prereqs> {
    prereqs ??= (async () => {
        const fromDept = await createDepartment(api, names.fromDept);
        const toDept = await createDepartment(api, names.toDept);
        const fromLoc = await createLocation(api, names.fromLoc);
        const toLoc = await createLocation(api, names.toLoc);
        const placement = { departmentId: fromDept.id, locationId: fromLoc.id };
        const asset = await createAsset(api, names.asset, placement);
        const approvalAsset = await createAsset(api, names.approvalAsset, placement);
        return { fromDept, toDept, fromLoc, toLoc, asset, approvalAsset };
    })();
    return prereqs;
}

/** The asset option reads "<name> (<tag>)"; createAsset uses the name as the tag. The full text keeps "TrAsset" from matching "TrAsset-approval". */
const assetOption = (name: string): string => `${name} (${name})`;

const fieldsFor = (assetName: string, reason: string): FieldSpec[] => [
    { label: "Asset", type: "select", value: assetOption(assetName) },
    { label: "To department", type: "select", value: names.toDept },
    { label: "To location (optional)", type: "select", value: names.toLoc },
    { label: "Reason / notes", type: "textarea", value: reason },
];

async function openRequest(page: Page): Promise<Locator> {
    await page.goto(PATH);
    await page.getByRole("button", { name: /Request transfer/i }).first().click();
    const form = formModal(page);
    await expect(form).toBeVisible();
    return form;
}

/** The origin selects follow the chosen asset's current department and location. */
async function expectOrigin(form: Locator): Promise<void> {
    const fromDept = await fieldControl(form, { label: "From department" });
    const fromLoc = await fieldControl(form, { label: "From location" });
    await expect(fromDept).toBeDisabled();
    await expectControl(fromDept, { label: "From department", type: "select", value: "" }, names.fromDept);
    await expectControl(fromLoc, { label: "From location", type: "select", value: "" }, names.fromLoc);
}

/** Removes every transfer of an asset (best-effort; a completed one cannot be deleted and stays). */
async function dropTransfersFor(api: ApiClient, assetId?: string): Promise<void> {
    if (!assetId) return;
    const rows = await api.list<{ id: string; assetId?: string }>("/asset-transfers").catch(() => []);
    for (const row of rows.filter((r) => r.assetId === assetId)) await api.tryDelete(`/asset-transfers/${row.id}`);
}

test.describe("Transfers", () => {
    test("e1) inline error for an over-length reason", async ({ page, api }) => {
        await ensurePrereqs(api);
        const form = await openRequest(page);
        const fields = fieldsFor(names.asset, "x");
        await fillForm(form, fields);
        const reason = await fieldControl(form, fields[3]);
        await bypassNativeValidation(form, reason);
        await setControl(reason, fields[3], overLength(2000));
        await form.locator('button[type="submit"]').last().click();

        await expect(form.getByRole("alert").filter({ hasText: /Reason must be at most 2000 characters/ })).toBeVisible();
        await expect(form, "the form stays open").toBeVisible();
    });

    test("e2) destination department must differ from the asset's current one", async ({ page, api }) => {
        await ensurePrereqs(api);
        const form = await openRequest(page);
        await fillForm(form, [
            { label: "Asset", type: "select", value: assetOption(names.asset) },
            { label: "To department", type: "select", value: names.fromDept },
        ]);
        await form.locator('button[type="submit"]').last().click();

        await expect(
            form.getByRole("alert").filter({ hasText: /Destination department must be different from the asset's current department/ }),
        ).toBeVisible();
        await expect(form, "the form stays open").toBeVisible();
        await expect(toasts(page).filter({ hasText: /Transfer requested/ })).toHaveCount(0);
    });

    test("round trip: request with every field, list shows it after reload, delete", async ({ page, api }) => {
        const p = await ensurePrereqs(api);
        const reason = uniq("transfer reason");
        try {
            await test.step("a) request with every field filled", async () => {
                const form = await openRequest(page);
                await fillForm(form, fieldsFor(names.asset, reason));
                await expectOrigin(form);
                await submitAndClose(page, form);
            });

            await test.step("b) reload: the list shows every value", async () => {
                await page.goto(PATH);
                const row = rowWith(page, reason);
                await expect(row).toBeVisible();
                for (const text of [names.asset, names.fromDept, names.fromLoc, names.toDept, names.toLoc, reason, "Requested"]) {
                    await expect(row, `row shows "${text}"`).toContainText(text);
                }
                // Maker-checker: the requester is never offered Approve on their own request.
                await expect(row.getByRole("button", { name: "Approve transfer" })).toHaveCount(0);
            });

            await test.step("f) delete", async () => {
                const row = rowWith(page, reason);
                await row.getByRole("button", { name: "Delete transfer" }).click();
                await acceptConfirm(page);
                await expect(rowWith(page, reason)).toBeHidden({ timeout: 20_000 });
            });
        } finally {
            await dropTransfersFor(api, p.asset.id);
        }
    });

    test("approval by a second user, then reject and delete", async ({ page, api, browser }) => {
        const approver = opsApproverCredentials();
        test.skip(!approver, NO_APPROVER);
        const p = await ensurePrereqs(api);
        const reason = uniq("transfer for approval");
        try {
            await test.step("admin requests the transfer", async () => {
                const form = await openRequest(page);
                await fillForm(form, fieldsFor(names.approvalAsset, reason));
                await submitAndClose(page, form);
            });

            await test.step("approver approves it in a separate session", async () => {
                await asApprover(browser, approver!, async (approverPage) => {
                    await approverPage.goto(PATH);
                    const row = rowWith(approverPage, reason);
                    await row.getByRole("button", { name: "Approve transfer" }).click();
                    await expect(rowWith(approverPage, reason)).toContainText("Approved", { timeout: 20_000 });
                });
            });

            await test.step("requester sees it approved, rejects and deletes it", async () => {
                await page.goto(PATH);
                const row = rowWith(page, reason);
                await expect(row).toContainText("Approved");
                // APPROVED -> reject is allowed for anyone with TRANSFER_ASSET; the asset never moves.
                await row.getByRole("button", { name: "Reject transfer" }).click();
                await expect(rowWith(page, reason)).toContainText("Rejected", { timeout: 20_000 });
                await rowWith(page, reason).getByRole("button", { name: "Delete transfer" }).click();
                await acceptConfirm(page);
                await expect(rowWith(page, reason)).toBeHidden({ timeout: 20_000 });
            });
        } finally {
            await dropTransfersFor(api, p.approvalAsset.id);
        }
    });

    // Runs last: the staging config is one worker, in file order.
    test("cleanup: prerequisites", async ({ api }) => {
        test.skip(!prereqs, "no prerequisites were created");
        const p = await prereqs!.catch(() => undefined);
        if (!p) return;
        for (const asset of [p.asset, p.approvalAsset]) {
            await dropTransfersFor(api, asset.id);
            await dropAsset(api, asset.id);
        }
        await dropDepartment(api, p.fromDept.id);
        await dropDepartment(api, p.toDept.id);
        await dropLocation(api, p.fromLoc.id);
        await dropLocation(api, p.toLoc.id);
    });
});
