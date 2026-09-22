import type { Locator, Page } from "@playwright/test";
import { test, expect, RUN_ID, uniq } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";
import {
    bypassNativeValidation,
    expectForm,
    fieldControl,
    fillForm,
    formModal,
    overLength,
    rowWith,
    setControl,
    submitAndClose,
    type FieldSpec,
} from "../../fixtures/forms";
import { blockWrites, currentOrgId } from "./_admin-helpers";

/**
 * The organisation form edits the REAL tenant the suite signs in to. Only the
 * low-risk profile fields are changed (never the name, time zone, country or
 * data residency, which drive login, scheduling and storage), every value is
 * captured first, and the originals are always restored in `finally`.
 * The UI cannot create organisations, so there is no create or delete here.
 */

/** Organisation fields the round trip touches, by API key → form label. */
const SAFE_FIELDS = {
    industry: "Industry",
    contactEmail: "Contact email",
    contactPhone: "Contact phone",
    address: "Address",
    registrationNumber: "Registration number",
    taxId: "Tax ID",
    dpoName: "Data protection officer",
    dpoEmail: "DPO email",
} as const;
type SafeKey = keyof typeof SAFE_FIELDS;

interface OrgRecord {
    id: string;
    name: string;
    [key: string]: unknown;
}

const tag = RUN_ID.toLowerCase();
const EDIT_VALUES: Record<SafeKey, string> = {
    industry: uniq("Industry"),
    contactEmail: `e2e-${tag}-contact@example.com`,
    contactPhone: "+233200000456",
    address: uniq("1 Test Street, Accra"),
    registrationNumber: uniq("REG"),
    taxId: uniq("TIN"),
    dpoName: uniq("DPO"),
    dpoEmail: `e2e-${tag}-dpo@example.com`,
};

const text = (value: unknown): string => (value == null ? "" : String(value));

async function loadOrg(page: Page, api: ApiClient): Promise<OrgRecord> {
    const id = await currentOrgId(page);
    return api.get<OrgRecord>(`/organisations/${id}`);
}

async function openOrgEdit(page: Page, orgName: string): Promise<Locator> {
    await page.goto("/organisations");
    const row = rowWith(page, orgName);
    await expect(row, `organisation row "${orgName}"`).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: /^Edit organisation$/i }).click();
    const form = formModal(page);
    await expect(form).toBeVisible();
    return form;
}

/** Puts the captured values back: the API first, the form (step-up answered by the fixture) when the API refuses. */
async function restore(page: Page, api: ApiClient, original: OrgRecord): Promise<void> {
    const patch = Object.fromEntries((Object.keys(SAFE_FIELDS) as SafeKey[]).map((k) => [k, text(original[k])]));
    try {
        await api.patch(`/organisations/${original.id}`, patch);
    } catch {
        const form = await openOrgEdit(page, original.name);
        for (const key of Object.keys(SAFE_FIELDS) as SafeKey[]) {
            const spec: FieldSpec = { label: SAFE_FIELDS[key], type: key === "address" ? "textarea" : "text", value: "" };
            await setControl(await fieldControl(form, spec), spec, text(original[key]));
        }
        await submitAndClose(page, form);
    }
    const after = await api.get<OrgRecord>(`/organisations/${original.id}`);
    for (const key of Object.keys(SAFE_FIELDS) as SafeKey[]) {
        expect(text(after[key]), `restored ${key}`).toBe(text(original[key]));
    }
    expect(after.name, "name untouched").toBe(original.name);
}

test.describe("Organisation profile (real tenant, restored)", () => {
    test("e1) inline errors for over-length name and malformed emails; nothing saved", async ({ page, api }) => {
        const original = await loadOrg(page, api);
        const blocked = await blockWrites(page, /\/organisations\/[^/?]+(\?|$)/);
        const form = await openOrgEdit(page, original.name);

        const name = await fieldControl(form, { label: "Name" });
        await bypassNativeValidation(form, name);
        await name.fill(overLength(255));
        const contactEmail = await fieldControl(form, { label: "Contact email" });
        await contactEmail.fill("not-an-email");
        const dpoEmail = await fieldControl(form, { label: "DPO email" });
        await dpoEmail.fill("dpo@");
        await form.getByRole("button", { name: /^Save changes$/ }).click();

        const alerts = form.getByRole("alert");
        await expect(alerts.filter({ hasText: /Name must be at most 255 characters/ }).first()).toBeVisible();
        await expect(alerts.filter({ hasText: /Contact email must be a valid email address/ }).first()).toBeVisible();
        await expect(alerts.filter({ hasText: /DPO email must be a valid email address/ }).first()).toBeVisible();
        await expect(form, "the form stays open").toBeVisible();
        expect(blocked, "no organisation write was attempted").toHaveLength(0);

        await page.reload();
        const after = await loadOrg(page, api);
        expect(after.name).toBe(original.name);
    });

    test("round trip: safe fields persist, clear, and the originals are restored", async ({ page, api }) => {
        const original = await loadOrg(page, api);
        const keys = Object.keys(SAFE_FIELDS) as SafeKey[];
        // Every safe field gets a prefixed value, then is cleared; the name is asserted, never changed.
        const fields: FieldSpec[] = [
            { label: "Name", type: "text", value: original.name },
            ...keys.map<FieldSpec>((k) => ({
                label: SAFE_FIELDS[k],
                type: k === "address" ? "textarea" : "text",
                value: EDIT_VALUES[k],
                optional: true,
            })),
        ];
        const editable = fields.slice(1);
        try {
            await test.step("a) set every safe field", async () => {
                const form = await openOrgEdit(page, original.name);
                await expectForm(form, [fields[0]], "created");
                await fillForm(form, editable, "create");
                await submitAndClose(page, form);
            });

            await test.step("b) reload, reopen: values persisted", async () => {
                const form = await openOrgEdit(page, original.name);
                await expectForm(form, fields, "created");
                await test.step("c) clear every safe field, save", async () => {
                    await fillForm(form, editable, "edit");
                    await submitAndClose(page, form);
                });
            });

            await test.step("d) reload, reopen: clears persisted", async () => {
                const form = await openOrgEdit(page, original.name);
                await expectForm(form, fields, "edited");
                await page.keyboard.press("Escape");
            });
        } finally {
            await test.step("restore the original organisation profile", () => restore(page, api, original));
        }
    });
});

test.describe("Organisation base currency (validate only)", () => {
    test("a change asks for confirmation; cancelling keeps the base currency", async ({ page }) => {
        const blocked = await blockWrites(page, /\/currency\/settings/);
        await page.goto("/organisations");
        const select = page.getByLabel("Change base currency");
        const editable = await select.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false);
        test.skip(!editable, "The signed-in user cannot edit the base currency");
        // Let the settings load settle (the select starts on a provisional value).
        await expect(page.getByText(/Base currency:/).first()).not.toContainText("…");

        const current = await select.inputValue();
        const other = await select.evaluate(
            (el, cur) => Array.from((el as HTMLSelectElement).options).find((o) => o.value !== cur)?.value ?? null,
            current,
        );
        test.skip(!other, "Only one currency is available");
        await select.selectOption(other as string);
        await page.getByRole("button", { name: /^Save base currency$/ }).click();

        await expect(page.getByText(`Change base currency to ${other}?`)).toBeVisible();
        await page.getByRole("button", { name: /^Cancel$/ }).last().click();
        await expect(page.getByText(`Change base currency to ${other}?`)).toBeHidden();
        expect(blocked, "no currency write was attempted").toHaveLength(0);

        await page.reload();
        await expect(page.getByLabel("Change base currency")).toHaveValue(current);
    });
});
