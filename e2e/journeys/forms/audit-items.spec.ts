import { expect, test, uniq } from "../../fixtures/auth";
import { formModal, rowWith } from "../../fixtures/forms";
import { createAsset, createDepartment, dropAsset, dropDepartment, isoDate } from "../../fixtures/prereqs";

/**
 * The audit count sheet (app/audits + features/audits/AuditCountSheet).
 *
 * The sheet is not a form that creates rows — the server generates one item per
 * in-scope asset — so this walks the journey the same way the form specs do:
 * build the sheet, fill it in field by field (verify, flag), assert what the
 * list shows back, prove the validation refuses an incomplete discrepancy, and
 * end with the audit closed rather than deleted (audits are immutable records).
 */

const PATH = "/audits";
const STATUS_TIMEOUT = 20_000;

const department = uniq("AuditItemsDept");
const remarks = uniq("audit items sheet");
const assetOne = uniq("AuditItemAssetA");
const assetTwo = uniq("AuditItemAssetB");
const tagOne = uniq("AITAG-A").toUpperCase();
const tagTwo = uniq("AITAG-B").toUpperCase();

test.describe("Audit count sheet", () => {
    test("build the sheet, verify by tag, flag a discrepancy, and only then a seal", async ({ page, api }) => {
        const ids: { department?: string; assets: string[]; audit?: string } = { assets: [] };
        try {
            await test.step("prerequisites: a department, two assets in it, an audit over it", async () => {
                ids.department = (await createDepartment(api, department)).id;
                for (const [name, assetTag] of [[assetOne, tagOne], [assetTwo, tagTwo]] as const) {
                    const asset = await createAsset(api, name, { assetTag, departmentId: ids.department });
                    ids.assets.push(asset.id);
                }
                const audit = await api.post<{ id: string }>("/audits", {
                    auditDate: isoDate(0),
                    departmentId: ids.department,
                    remarks,
                });
                ids.audit = audit.id;
            });

            await test.step("a planned audit has no sheet, and therefore no seal", async () => {
                await page.goto(PATH);
                const row = rowWith(page, remarks);
                await expect(row).toContainText(/No count sheet yet/i);
                await expect(row.getByLabel("Audit-verified")).toHaveCount(0);
            });

            await test.step("building the sheet puts every in-scope asset on it", async () => {
                await rowWith(page, remarks).getByRole("button", { name: /^Open count sheet$/ }).click();
                const sheet = page.getByTestId("audit-count-sheet");
                await expect(sheet).toBeVisible();
                await sheet.getByTestId("audit-generate-items").click();
                await expect(page.getByTestId("audit-progress-label"))
                    .toContainText("0 / 2 verified", { timeout: STATUS_TIMEOUT });
                await expect(sheet.getByTestId("audit-item-row")).toHaveCount(2);
            });

            await test.step("typing a tag verifies that asset", async () => {
                const sheet = page.getByTestId("audit-count-sheet");
                await sheet.getByTestId("audit-scan-input").fill(tagOne);
                await sheet.getByTestId("audit-verify-scan").click();
                await expect(page.getByTestId("audit-progress-label"))
                    .toContainText("1 / 2 verified", { timeout: STATUS_TIMEOUT });
                await expect(sheet.getByTestId("audit-item-row").filter({ hasText: tagOne }))
                    .toContainText(/verified/i);
            });

            await test.step("a discrepancy needs a reason before it can be saved", async () => {
                const sheet = page.getByTestId("audit-count-sheet");
                await sheet.getByRole("button", { name: `Flag ${tagTwo}` }).click();
                const save = page.getByTestId("audit-discrepancy-save");
                await expect(save).toBeDisabled();

                await page.getByLabel(/^Reason/).fill("Not at the desk it is booked to");
                await page.getByLabel(/^Type/).selectOption("WRONG_LOCATION");
                await expect(save).toBeEnabled();
                await save.click();
                await expect(page.getByTestId("audit-discrepancy-form")).toBeHidden({ timeout: STATUS_TIMEOUT });
            });

            await test.step("the flag shows on the item, the audit, and its status", async () => {
                const sheet = page.getByTestId("audit-count-sheet");
                await expect(page.getByTestId("audit-progress-label"))
                    .toContainText("1 discrepancy", { timeout: STATUS_TIMEOUT });
                await expect(sheet.getByTestId("audit-item-row").filter({ hasText: tagTwo }))
                    .toContainText(/wrong location/i);
                await page.keyboard.press("Escape");
                await expect(rowWith(page, remarks)).toContainText(/discrepancy found/i, { timeout: STATUS_TIMEOUT });
            });

            await test.step("a half-verified audit gets no seal", async () => {
                await page.goto(PATH);
                await expect(rowWith(page, remarks)).toContainText("1 / 2 verified");
                await expect(rowWith(page, remarks).getByLabel("Audit-verified")).toHaveCount(0);
            });

            await test.step("verifying the last item earns the seal", async () => {
                await rowWith(page, remarks).getByRole("button", { name: /^Open count sheet$/ }).click();
                const sheet = page.getByTestId("audit-count-sheet");
                await sheet.getByRole("button", { name: `Verify ${tagTwo}` }).click();
                await expect(page.getByTestId("audit-progress-label"))
                    .toContainText("2 / 2 verified", { timeout: STATUS_TIMEOUT });
                await expect(sheet.getByLabel("Audit-verified")).toBeVisible();
                await page.keyboard.press("Escape");

                await page.goto(PATH);
                await expect(rowWith(page, remarks).getByLabel("Audit-verified")).toBeVisible();
            });

            await test.step("filters narrow the sheet", async () => {
                await rowWith(page, remarks).getByRole("button", { name: /^Open count sheet$/ }).click();
                const sheet = page.getByTestId("audit-count-sheet");
                await sheet.getByTestId("audit-item-search").fill(tagOne);
                await expect(sheet.getByTestId("audit-item-row")).toHaveCount(1, { timeout: STATUS_TIMEOUT });
                await sheet.getByTestId("audit-item-search").fill("no-such-asset-tag");
                await expect(sheet.getByTestId("audit-items-empty")).toBeVisible({ timeout: STATUS_TIMEOUT });
                await page.keyboard.press("Escape");
            });

            await test.step("closing the audit freezes its sheet", async () => {
                // DISCREPANCY_FOUND -> RESOLVED -> COMPLETED, through the edit dialog
                // and then the row's Complete action.
                await page.goto(PATH);
                await rowWith(page, remarks).getByRole("button", { name: /^Edit audit status and remarks$/ }).click();
                const form = formModal(page);
                await expect(form).toBeVisible();
                await form.getByLabel(/^Status/).selectOption("RESOLVED");
                await form.locator('button[type="submit"]').last().click();
                await expect(form).toBeHidden({ timeout: STATUS_TIMEOUT });

                await page.goto(PATH);
                await rowWith(page, remarks).getByRole("button", { name: /Complete/ }).click();
                await expect(rowWith(page, remarks)).toContainText(/completed/i, { timeout: STATUS_TIMEOUT });

                await rowWith(page, remarks).getByRole("button", { name: /^Open count sheet$/ }).click();
                const sheet = page.getByTestId("audit-count-sheet");
                await expect(sheet).toContainText(/final record/i);
                await expect(sheet.getByTestId("audit-scan-input")).toHaveCount(0);
                await expect(sheet.getByRole("button", { name: `Verify ${tagOne}` })).toHaveCount(0);
                await page.keyboard.press("Escape");
            });
        } finally {
            // Audits are immutable compliance records: there is no delete. The
            // assets and department go, best-effort.
            for (const id of ids.assets) await dropAsset(api, id);
            await dropDepartment(api, ids.department);
        }
    });
});
