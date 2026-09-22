import type { Locator, Page } from "@playwright/test";
import { PREFIX, expect, uniq } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";
import { formModal, overLength, rowWith, type FieldSpec } from "../../fixtures/forms";
import { createDepartment, createEmployee, dropDepartment, dropEmployee, isoDate } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";

/**
 * Employee form (features/employees/EmployeeFormModal.tsx). Create is on the
 * list (/employees); edit is on the detail page (/employees/detail?id=...),
 * reached by clicking the row. There is no delete in the UI, so the record is
 * soft-deleted through the API (DELETE /employees/{id}).
 *
 * Another change may still be reshaping the people pages, so everything here is
 * found by role, label and placeholder text only.
 *
 * The manager picker lists ACTIVE employees (first 100), so the manager is
 * created ACTIVE. The linked-user picker is added only when some active user is
 * not yet linked to an employee (a user links to at most one).
 */

const PATH = "/employees";
const firstName = uniq("Emp-First");
const lastName = uniq("Emp-Last");
const editedLastName = uniq("Emp-Renamed");
const deptName = uniq("EmpDept");
const manager = { first: uniq("Mgr-First"), last: uniq("Mgr-Last") };

const created: { deptId?: string; managerId?: string } = {};

const fields: FieldSpec[] = [
    { label: "First name", type: "text", value: firstName, edit: uniq("Emp-First-edited") },
    { label: "Last name", type: "text", value: lastName, edit: editedLastName },
    { label: "Employee number", type: "text", value: uniq("EMPNO"), optional: true },
    { label: "Job title", type: "text", value: uniq("Field Engineer"), optional: true },
    { label: "Email", type: "text", value: `${PREFIX.toLowerCase()}employee@example.com`, optional: true },
    { label: "Phone", type: "text", value: "+233 20 000 0000", optional: true },
    { label: "Department", type: "select", value: deptName, optional: true },
    { label: "Hire date", type: "date", value: isoDate(-30), optional: true },
    { label: "Manager", type: "select", value: `${manager.first} ${manager.last}`, optional: true },
    { label: "Notes", type: "textarea", value: uniq("employee notes"), optional: true },
];

/** An active user not linked to any employee yet, or undefined when every one is taken. */
async function unlinkedUser(api: ApiClient): Promise<{ email: string } | undefined> {
    const users = await api.list<{ id: string; email?: string; status?: string }>("/users");
    const linked = new Set<string>();
    const PAGE_SIZE = 100;
    const MAX_PAGES = 20;
    for (let page = 0; page < MAX_PAGES; page++) {
        const body = await api.get<{ content?: { userId?: string }[]; totalPages?: number }>(
            `/employees?size=${PAGE_SIZE}&page=${page}`,
        );
        for (const e of body.content ?? []) if (e.userId) linked.add(e.userId);
        if (page + 1 >= (body.totalPages ?? 1)) break;
    }
    const free = users.find((u) => u.email && !linked.has(u.id) && (!u.status || u.status === "ACTIVE"));
    return free?.email ? { email: free.email } : undefined;
}

async function employeeIdsNamed(api: ApiClient, last: string): Promise<string[]> {
    const body = await api.get<{ content?: { id: string; lastName?: string }[] }>(
        `/employees?q=${encodeURIComponent(last)}&size=100`,
    );
    return (body.content ?? []).filter((e) => e.lastName === last).map((e) => e.id);
}

/** Search the list by last name, open the row's detail page, then its Edit dialog. */
async function openEdit(page: Page, key: string): Promise<Locator> {
    await page.getByPlaceholder(/Search name, number, or email/i).fill(key);
    const row = rowWith(page, key);
    await expect(row, `employee row "${key}"`).toBeVisible();
    await row.click();
    await page.waitForURL(/\/employees\/detail/);
    await page.getByRole("button", { name: /^Edit$/ }).click();
    const form = formModal(page);
    await expect(form.getByRole("heading", { name: "Edit employee" })).toBeVisible();
    return form;
}

describeRoundTrip({
    title: "Employees",
    path: PATH,
    key: lastName,
    editedKey: editedLastName,
    createButton: /^New employee$/,
    openEdit,
    setup: async ({ api }) => {
        created.deptId = (await createDepartment(api, deptName)).id;
        created.managerId = (await createEmployee(api, manager.first, manager.last, { status: "ACTIVE" })).id;
        const user = await unlinkedUser(api);
        if (user) {
            // Selected by e-mail: the option reads "First Last (email)".
            fields.splice(fields.length - 1, 0, {
                label: "Linked system user (optional)",
                type: "select",
                value: user.email,
                optional: true,
            });
        }
    },
    teardown: async ({ api }) => {
        for (const last of [lastName, editedLastName]) {
            for (const id of await employeeIdsNamed(api, last).catch(() => [])) await dropEmployee(api, id);
        }
        await dropEmployee(api, created.managerId);
        await dropDepartment(api, created.deptId);
    },
    fields,
    negative: [
        { field: "First name", value: overLength(255), error: /First name must be at most 255 characters/ },
        { field: "Employee number", value: overLength(100), error: /Employee number must be at most 100 characters/ },
    ],
    // No delete in the UI: soft-delete through the API, then the list must no longer find it.
    remove: async ({ page, api }, key) => {
        const ids = await employeeIdsNamed(api, key);
        expect(ids, `employee "${key}" to delete`).toHaveLength(1);
        await api.delete(`/employees/${ids[0]}`);
        await page.goto(PATH);
        await page.getByPlaceholder(/Search name, number, or email/i).fill(key);
        await expect(rowWith(page, key)).toBeHidden({ timeout: 20_000 });
    },
});
