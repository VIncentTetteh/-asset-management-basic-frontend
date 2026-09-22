import type { Locator, Page, Request } from "@playwright/test";
import { expect } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";
import { acceptConfirm, fieldControl, formModal, setControl, submitAndClose } from "../../fixtures/forms";

/**
 * Shared helpers for the people / admin / compliance form specs
 * (users, roles, organisations, compliance, DSAR, SSO, storage).
 */

/** The signed-in admin's email, used to pick "owner" / "assignee" options (labels end in "(email)"). */
export const ADMIN_EMAIL = (process.env.E2E_ADMIN_EMAIL ?? "").trim().toLowerCase();

/** The organisation the app pinned after login. */
export async function currentOrgId(page: Page): Promise<string> {
    if (page.url() === "about:blank") await page.goto("/");
    const id = await page.evaluate(() => localStorage.getItem("verifiedOrganisationId"));
    if (!id) throw new Error("No verifiedOrganisationId in localStorage: is the session signed in?");
    return id;
}

/**
 * Safety net for validate-only specs: aborts every non-GET request whose URL
 * matches `pattern`, and records it so the test can assert nothing tried to save.
 */
export async function blockWrites(page: Page, pattern: RegExp): Promise<Request[]> {
    const blocked: Request[] = [];
    await page.route(pattern, async (route) => {
        const request = route.request();
        if (request.method() === "GET" || request.method() === "OPTIONS") return route.fallback();
        blocked.push(request);
        return route.abort("blockedbyclient");
    });
    return blocked;
}

// ── Roles (cards, icon-only buttons) ────────────────────────────────────────────

/** The role card whose title is exactly `name` (the innermost element holding the title and its buttons). */
export function roleCard(page: Page, name: string): Locator {
    return page
        .locator("div")
        .filter({ has: page.getByText(name, { exact: true }) })
        .filter({ has: page.getByRole("button") })
        .last();
}

/** A card's edit button: by accessible name when it has one, else the first card button (pencil). */
export const roleEditButton = (card: Locator): Locator =>
    card.getByRole("button", { name: /edit/i }).or(card.getByRole("button").first()).first();

/** A card's delete button: by accessible name when it has one, else the last card button (trash). */
export const roleDeleteButton = (card: Locator): Locator =>
    card.getByRole("button", { name: /delete|remove/i }).or(card.getByRole("button").last()).last();

/** Opens the edit modal of the role named `name` on /roles. */
export async function openRoleEdit(page: Page, name: string): Promise<Locator> {
    const card = roleCard(page, name);
    await expect(card, `role card "${name}"`).toBeVisible({ timeout: 20_000 });
    await roleEditButton(card).click();
    const form = formModal(page);
    await expect(form).toBeVisible();
    return form;
}

/** Deletes the role named `name` through the UI and waits for its card to go. */
export async function deleteRoleViaUi(page: Page, name: string): Promise<void> {
    await page.goto("/roles");
    const card = roleCard(page, name);
    await expect(card, `role card "${name}"`).toBeVisible({ timeout: 20_000 });
    await roleDeleteButton(card).click();
    await acceptConfirm(page);
    await expect(page.getByText(name, { exact: true })).toHaveCount(0, { timeout: 20_000 });
}

interface RoleRow {
    id: string;
    name: string;
}

/**
 * Creates a custom role for a picker. The API first (fast); when it refuses (a
 * step-up the API client cannot answer, say) the UI, whose step-up prompt the
 * page fixture answers. Returns the role's id when it can be found.
 */
export async function createRole(page: Page, api: ApiClient, name: string, permissionLabels: string[]): Promise<string | undefined> {
    const permissions = permissionLabels.map((p) => p.replace(/ /g, "_"));
    try {
        const created = await api.post<RoleRow>(await api.withOrg("/roles"), { name, description: name, permissions });
        return created.id;
    } catch {
        await page.goto("/roles");
        await page.getByRole("button", { name: /Create custom role/i }).click();
        const form = formModal(page);
        await expect(form).toBeVisible();
        await setControl(await fieldControl(form, { label: "Role Name" }), { label: "Role Name", type: "text", value: name }, name);
        for (const label of permissionLabels) {
            await setControl(await fieldControl(form, { label }), { label, type: "checkbox", value: true }, true);
        }
        await submitAndClose(page, form);
        const roles = await api.list<RoleRow>(await api.withOrg("/roles")).catch(() => [] as RoleRow[]);
        return roles.find((r) => r.name === name)?.id;
    }
}
