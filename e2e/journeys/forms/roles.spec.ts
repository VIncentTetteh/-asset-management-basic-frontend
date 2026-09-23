import { expect, test, uniq } from "../../fixtures/auth";
import { formModal, overLength } from "../../fixtures/forms";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { deleteRoleViaUi, openRoleEdit } from "./_admin-helpers";

// Roles are cards, not table rows, so edit and delete find the card by its title
// and then the button named for what it does ("Edit role <name>").
//
// The permission checkboxes are labelled with the plain-language wording the
// backend serves from GET /roles/permissions/catalogue ("See the asset
// register"), not the raw authority string ("VIEW_ASSETS"). The catalogue is
// generated from the same enum the authority checks use, so these labels are
// the product's own words for each permission and cannot drift from it.
describeRoundTrip({
    title: "Roles",
    path: "/roles",
    key: uniq("Role"),
    editedKey: uniq("Role-edited"),
    createButton: /^Create custom role$/i,
    openEdit: (page, key) => openRoleEdit(page, key),
    remove: ({ page }, key) => deleteRoleViaUi(page, key),
    fields: [
        { label: "Role Name", type: "text", value: uniq("Role"), edit: uniq("Role-edited") },
        { label: "Profile Description", type: "textarea", value: uniq("role description"), optional: true },
        // Granted on create, revoked on edit. (VIEW_ASSETS)
        { label: "See the asset register", type: "checkbox", value: true, edit: false },
        // Granted on create, cleared on edit (optional → unchecked). (VIEW_REPORTS)
        { label: "See reports", type: "checkbox", value: true, optional: true },
        // Granted on create and kept. (VIEW_COMPLIANCE)
        { label: "See compliance records", type: "checkbox", value: true },
        // Not granted on create, granted on edit. (VIEW_CONTRACTS, VIEW_SUPPLIERS)
        { label: "See contracts", type: "checkbox", value: false, edit: true },
        { label: "See suppliers", type: "checkbox", value: false, edit: true },
    ],
    negative: [{ field: "Role Name", value: overLength(255), error: /Name must be at most 255 characters/ }],
});

/**
 * Three permissions exist in the enum but no endpoint consults them. The picker
 * still lists them — a role that already carries one must not appear to have
 * been silently edited — but it badges them "Not enforced yet" and says so in
 * the summary. Granting one of these is not an ordinary grant, and the screen
 * must never let an administrator believe otherwise.
 */
test.describe("Roles: permissions that are not enforced yet", () => {
    const UNENFORCED = [
        "Escalate requests",   // ESCALATE_REQUESTS
        "Reissue asset QR codes", // REGENERATE_QR
        "Review access",       // REVIEW_ACCESS
    ];

    test("each says it does nothing yet, right where it is granted", async ({ page }) => {
        await page.goto("/roles");
        await page.getByRole("button", { name: /^Create custom role$/i }).first().click();
        const form = formModal(page);
        await expect(form).toBeVisible();

        for (const label of UNENFORCED) {
            const row = form.locator("div").filter({ has: page.getByLabel(label, { exact: true }) }).last();
            await expect(row, `"${label}" is listed`).toBeVisible();
            await expect(row.getByText("Not enforced yet"), `"${label}" is badged`).toBeVisible();
            await expect(row).toContainText(/Nothing checks this permission today/i);
        }

        // And an enforced one carries no such badge, so the badge means something.
        const enforced = form.locator("div").filter({ has: page.getByLabel("See contracts", { exact: true }) }).last();
        await expect(enforced.getByText("Not enforced yet")).toHaveCount(0);
    });
});
