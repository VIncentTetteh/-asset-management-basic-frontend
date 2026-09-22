import { expect, test, uniq } from "../../fixtures/auth";
import { clickRowAction, fieldControl, formModal, overLength, rowWith, selectByText, submitAndClose, type FieldSpec } from "../../fixtures/forms";
import { createDepartment, dropDepartment, isoDate } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";

/**
 * Audit scheduling (app/audits/page.tsx). Audits are immutable compliance
 * records: the edit dialog changes only status and remarks (date, scope and
 * auditor are shown disabled and must still read back), and there is no delete.
 * After the round trip the audit is walked to a final state (RESOLVED, then the
 * row's Complete action) so it stops counting as open; the record itself stays.
 */

const PATH = "/audits";
const deptName = uniq("AuditDept");
const remarks = uniq("audit remarks");
const editedRemarks = uniq("audit remarks edited");
let deptId: string | undefined;

/** An active user to name as the auditor, picked in setup (the empty option means "Me"). */
const conductedBy: FieldSpec = { label: "Conducted by", type: "select", value: "" };

describeRoundTrip({
    title: "Audits",
    path: PATH,
    key: remarks,
    editedKey: editedRemarks,
    createButton: /^Schedule audit$/,
    editButton: /^Edit audit status and remarks$/,
    setup: async ({ api }) => {
        deptId = (await createDepartment(api, deptName)).id;
        const users = await api.list<{ firstName?: string; lastName?: string; status?: string }>("/users");
        const active = users.find((u) => u.firstName && u.lastName && (!u.status || u.status === "ACTIVE"));
        if (!active) throw new Error("No active user to name as the auditor");
        conductedBy.value = `${active.firstName} ${active.lastName}`;
    },
    teardown: async ({ api }) => {
        // The audit keeps its department reference; this only succeeds when the API allows it.
        await dropDepartment(api, deptId);
    },
    fields: [
        { label: "Audit date", type: "date", value: isoDate(7) },
        // Option text is the enum with spaces ("IN_PROGRESS" -> "IN PROGRESS"); no empty option.
        { label: "Status", type: "select", value: "IN PROGRESS", edit: "DISCREPANCY FOUND" },
        { label: "Department scope", type: "select", value: deptName },
        conductedBy,
        { label: "Remarks", type: "textarea", value: remarks, edit: editedRemarks },
    ],
    negative: [{ field: "Remarks", value: overLength(5000), error: /Remarks must be at most 5000 characters/ }],
    afterEdit: async ({ page }, key) => {
        await page.goto(PATH);
        await clickRowAction(page, key, /^Edit audit status and remarks$/);
        const form = formModal(page);
        await expect(form).toBeVisible();
        // The disabled fields cannot be edited once scheduled.
        for (const label of ["Audit date", "Department scope", "Conducted by"]) {
            await expect(await fieldControl(form, { label }), `${label} is locked`).toBeDisabled();
        }
        await selectByText(await fieldControl(form, { label: "Status" }), "RESOLVED");
        await submitAndClose(page, form);

        await page.goto(PATH);
        const row = rowWith(page, key);
        await expect(row).toContainText("Resolved");
        await row.getByRole("button", { name: /Complete/ }).click();
        await expect(rowWith(page, key)).toContainText("Completed", { timeout: 20_000 });
        // Final: no further actions offered.
        await expect(rowWith(page, key).getByRole("button", { name: /^Edit audit status and remarks$/ })).toHaveCount(0);
    },
    remove: false,
});

test.describe("Audits: initial status", () => {
    test("a new audit can only start PLANNED or IN PROGRESS", async ({ page }) => {
        await page.goto(PATH);
        await page.getByRole("button", { name: /^Schedule audit$/ }).first().click();
        const form = formModal(page);
        await expect(form).toBeVisible();
        const status = await fieldControl(form, { label: "Status" });
        const options = await status.locator("option").allInnerTexts();
        expect(options.map((o) => o.trim())).toEqual(["PLANNED", "IN PROGRESS"]);
    });
});
