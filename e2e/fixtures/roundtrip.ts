import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./auth";
import type { ApiClient } from "./api";
import {
    DUPLICATE_TOAST,
    acceptConfirm,
    bypassNativeValidation,
    clickRowAction,
    expectForm,
    fieldControl,
    fillForm,
    formModal,
    rowWith,
    searchList,
    setControl,
    submitAndClose,
    toasts,
    type FieldSpec,
} from "./forms";

export interface Ctx {
    page: Page;
    api: ApiClient;
}

/** One out-of-range / over-length check on the create form. */
export interface NegativeCase {
    /** The field to break (label as in the field list, or a full spec for a field not in it). */
    field: string | RegExp | FieldSpec;
    /** The invalid value (e.g. overLength(255), or 6 for a 1-5 score). */
    value: string | number;
    /** The inline error react-hook-form shows (from limitRules' message). */
    error: RegExp;
}

export interface RoundTripConfig {
    /** Suite title, e.g. "Categories". */
    title: string;
    /** List page path, e.g. "/categories". */
    path: string;
    /** Every field on the form, in the order they should be filled. */
    fields: readonly FieldSpec[];
    /** Text that identifies the created row in the list (usually the name value). */
    key: string;
    /** Row text after the edit, when the edit changes the key field. Default: `key`. */
    editedKey?: string;
    /** Opens the create form; returns its scope. Default: click `createButton`, return the modal. */
    openCreate?: (page: Page) => Promise<Locator>;
    /** Button that opens the create form (default /^(New|Add|Create)\b/i). */
    createButton?: RegExp;
    /** Opens the edit form for the row showing `key`. Default: the row's `editButton`. */
    openEdit?: (page: Page, key: string) => Promise<Locator>;
    /** Row action that opens edit (default /edit/i). */
    editButton?: RegExp;
    /** Row selector (default "tr"). */
    rowSelector?: string;
    /** Placeholder of the list's search box, typed into before looking for the row. */
    searchPlaceholder?: RegExp;
    /** Submits the open form and waits for it to close. Default: its submit button. */
    submit?: (page: Page, scope: Locator) => Promise<void>;
    /** Deletes the record. Default: the row's `deleteButton`, then confirm. `false` = the UI cannot delete. */
    remove?: ((ctx: Ctx, key: string) => Promise<void>) | false;
    /** Row action that deletes (default /delete|remove/i). */
    deleteButton?: RegExp;
    /** Creates prerequisites (via `api`); runs once per suite, before the first test that needs them. */
    setup?: (ctx: Ctx) => Promise<void>;
    /** Removes prerequisites (best-effort) after the test. */
    teardown?: (ctx: Ctx) => Promise<void>;
    /** Extra steps after the edit round trip, before delete (e.g. submit a draft PO). */
    afterEdit?: (ctx: Ctx, key: string) => Promise<void>;
    /** Over-length / out-of-range checks on the create form. */
    negative?: readonly NegativeCase[];
    /** Why the round trip is skipped (e.g. needs a second user). */
    skip?: string;
}

async function defaultOpenCreate(page: Page, cfg: RoundTripConfig): Promise<Locator> {
    await page.getByRole("button", { name: cfg.createButton ?? /^(New|Add|Create)\b/i }).first().click();
    const scope = formModal(page);
    await expect(scope).toBeVisible();
    return scope;
}

async function defaultOpenEdit(page: Page, cfg: RoundTripConfig, key: string): Promise<Locator> {
    if (cfg.searchPlaceholder) await searchList(page, key, cfg.searchPlaceholder);
    await clickRowAction(page, key, cfg.editButton ?? /edit/i, cfg.rowSelector);
    const scope = formModal(page);
    await expect(scope).toBeVisible();
    return scope;
}

async function defaultRemove(page: Page, cfg: RoundTripConfig, key: string): Promise<void> {
    await page.goto(cfg.path);
    if (cfg.searchPlaceholder) await searchList(page, key, cfg.searchPlaceholder);
    await clickRowAction(page, key, cfg.deleteButton ?? /delete|remove/i, cfg.rowSelector);
    await acceptConfirm(page);
    await expect(rowWith(page, key, cfg.rowSelector)).toBeHidden({ timeout: 20_000 });
}

/**
 * Registers the standard round trip for one form:
 *   a) create with every field filled; b) reopen (after a reload) and assert the
 *   prefill; c) change fields and clear every optional one; d) reopen and assert;
 *   f) delete. The (e) negative cases run first, one test each, and never save.
 */
export function describeRoundTrip(cfg: RoundTripConfig): void {
    test.describe(cfg.title, () => {
        // Prerequisites are created once per suite (the worker is shared) and
        // removed after the round trip, which runs last.
        let prepared = false;
        const prepare = async (ctx: Ctx): Promise<void> => {
            if (prepared || !cfg.setup) return;
            await cfg.setup(ctx);
            prepared = true;
        };

        for (const [index, neg] of (cfg.negative ?? []).entries()) {
            const label = typeof neg.field === "object" && !(neg.field instanceof RegExp) ? neg.field.label : neg.field;
            test(`e${index + 1}) inline error for invalid "${String(label)}"`, async ({ page, api }) => {
                test.skip(Boolean(cfg.skip), cfg.skip);
                const ctx: Ctx = { page, api };
                const openCreate = cfg.openCreate ?? ((p: Page) => defaultOpenCreate(p, cfg));
                await prepare(ctx);
                await page.goto(cfg.path);
                const form = await openCreate(page);
                await fillForm(form, cfg.fields, "create");
                const spec: FieldSpec =
                    typeof neg.field === "object" && !(neg.field instanceof RegExp)
                        ? neg.field
                        : cfg.fields.find((f) => String(f.label) === String(neg.field))
                          ?? { label: neg.field as string | RegExp, type: "text", value: "" };
                const control = await fieldControl(form, spec);
                await bypassNativeValidation(form, control);
                await setControl(control, spec.type === "select" ? { ...spec, type: "text" } : spec, neg.value);
                await form.locator('button[type="submit"]').last().click();

                await expect(form.getByRole("alert").filter({ hasText: neg.error }).first()).toBeVisible();
                await expect(form, "the form stays open").toBeVisible();
                await expect(toasts(page).filter({ hasText: DUPLICATE_TOAST })).toHaveCount(0);
            });
        }

        test("round trip: create, prefill, edit + clear, persist, delete", async ({ page, api }) => {
            test.skip(Boolean(cfg.skip), cfg.skip);
            const ctx: Ctx = { page, api };
            const openCreate = cfg.openCreate ?? ((p: Page) => defaultOpenCreate(p, cfg));
            const openEdit = cfg.openEdit ?? ((p: Page, k: string) => defaultOpenEdit(p, cfg, k));
            const submit = cfg.submit ?? ((p: Page, s: Locator) => submitAndClose(p, s));
            const editedKey = cfg.editedKey ?? cfg.key;
            let created = false;
            try {
                await test.step("prerequisites", () => prepare(ctx));

                await test.step("a) create with every field filled", async () => {
                    await page.goto(cfg.path);
                    const form = await openCreate(page);
                    await fillForm(form, cfg.fields, "create");
                    await submit(page, form);
                    created = true;
                });

                await test.step("b) reopen edit: every field prefilled", async () => {
                    await page.goto(cfg.path);
                    const form = await openEdit(page, cfg.key);
                    await expectForm(form, cfg.fields, "created");
                    await fillForm(form, cfg.fields, "edit");
                    await test.step("c) change fields, clear every optional one, save", () => submit(page, form));
                });

                await test.step("d) reopen: changes and clears persisted", async () => {
                    await page.goto(cfg.path);
                    const form = await openEdit(page, editedKey);
                    await expectForm(form, cfg.fields, "edited");
                    await page.keyboard.press("Escape");
                });

                if (cfg.afterEdit) await test.step("workflow", () => cfg.afterEdit!(ctx, editedKey));

                if (cfg.remove !== false) {
                    await test.step("f) delete", async () => {
                        if (cfg.remove) await cfg.remove(ctx, editedKey);
                        else await defaultRemove(page, cfg, editedKey);
                        created = false;
                    });
                }
            } finally {
                if (created && cfg.remove === false) {
                    test.info().annotations.push({ type: "leftover", description: `${cfg.title}: ${editedKey}` });
                }
                if (cfg.teardown) await cfg.teardown(ctx).catch(() => undefined);
            }
        });

    });
}
