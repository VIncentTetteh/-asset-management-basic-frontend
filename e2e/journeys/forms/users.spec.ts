import { expect, RUN_ID, uniq } from "../../fixtures/auth";
import { acceptConfirm, overLength, rowWith, searchList } from "../../fixtures/forms";
import { createDepartment, dropDepartment } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { createRole } from "./_admin-helpers";

// Users are provisioned (not invited): the create form sets a temporary password.
// The API has no user delete, so cleanup deactivates the user (it stays, prefixed
// and inactive). The role picker can now be cleared ("None" removes the role);
// this journey changes it instead, so the role edit stays covered.
const email = `e2e-${RUN_ID.toLowerCase()}-user@example.com`;
const department = uniq("UserDept");
const roleA = uniq("UserRoleA");
const roleB = uniq("UserRoleB");
const SEARCH = /Search name, email, or title/i;
let departmentId: string | undefined;
const roleIds: (string | undefined)[] = [];

describeRoundTrip({
    title: "Users",
    path: "/users",
    key: email,
    createButton: /^Provision user$/i,
    editButton: /^Edit user$/i,
    searchPlaceholder: SEARCH,
    setup: async ({ page, api }) => {
        departmentId = (await createDepartment(api, department)).id;
        roleIds.push(await createRole(page, api, roleA, ["VIEW ASSETS"]));
        roleIds.push(await createRole(page, api, roleB, ["VIEW ASSETS", "VIEW REPORTS"]));
    },
    teardown: async ({ api }) => {
        // Roles still assigned to the (deactivated) user are refused with 409: they stay, prefixed.
        for (const id of roleIds) if (id) await api.tryDelete(`/roles/${id}`);
        await dropDepartment(api, departmentId);
    },
    fields: [
        { label: "First name", type: "text", value: uniq("First"), edit: uniq("First-edited") },
        { label: "Last name", type: "text", value: uniq("Last"), edit: uniq("Last-edited") },
        // Disabled on edit (the login cannot change); the prefill is still asserted.
        { label: "Email", type: "text", value: email },
        { label: "Temporary password", type: "text", value: `E2e!${RUN_ID}Pw9`, createOnly: true, writeOnly: true },
        { label: "Phone", type: "text", value: "+233200000123", optional: true },
        { label: "Job title", type: "text", value: uniq("Job title"), optional: true },
        { label: "Department", type: "select", value: department, optional: true },
        // "None" removes the role (DELETE /users/{id}/role); this step changes it instead.
        { label: "Role", type: "select", value: roleA, edit: roleB },
    ],
    negative: [
        { field: "First name", value: overLength(255), error: /First name must be at most 255 characters/ },
        { field: "Job title", value: overLength(255), error: /Job title must be at most 255 characters/ },
        { field: "Temporary password", value: "short", error: /Password must be at least 8 characters/ },
    ],
    // No delete: deactivate through the row action and assert the status flips.
    remove: async ({ page }, key) => {
        await page.goto("/users");
        await searchList(page, key, SEARCH);
        const row = rowWith(page, key);
        await row.getByRole("button", { name: /^Deactivate user$/i }).click();
        await acceptConfirm(page);
        await expect(row.getByRole("button", { name: /^Reactivate user$/i })).toBeVisible({ timeout: 20_000 });
        await expect(row).toContainText(/inactive/i);
    },
});
