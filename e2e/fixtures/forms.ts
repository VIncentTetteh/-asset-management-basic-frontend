import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Data-driven form helpers: a spec lists each field once, and the same list
 * fills the create form, asserts the edit form's prefill, applies the edit
 * (changes + clears) and asserts the result after a reload.
 */

export type FieldType = "text" | "number" | "date" | "select" | "checkbox" | "textarea";
export type FieldValue = string | number | boolean;

export interface FieldSpec {
    /** Visible label text (a trailing required "*" is ignored), or a RegExp over the label text. */
    label: string | RegExp;
    type: FieldType;
    /** Create value. For a select: the option's visible text (exact, else first option containing it). */
    value: FieldValue;
    /**
     * Value applied in the edit step. When omitted: optional fields are cleared,
     * required fields are left unchanged.
     */
    edit?: FieldValue;
    /** An optional field: the edit step clears it (unless `edit` is given). */
    optional?: boolean;
    /** Expected select text after a clear (default: the empty-value option is selected). */
    clearedText?: string;
    /** Only on the create form (e.g. the password on an invite, a field locked after create). */
    createOnly?: boolean;
    /** Written but never read back (secrets); prefill is not asserted. */
    writeOnly?: boolean;
    /** Locate the control yourself when the label is not associated or is ambiguous. */
    locate?: (scope: Locator) => Locator;
    /** Which match to use when the same label appears several times (default 0). */
    nth?: number;
}

/** Sentinel for "this field was cleared". */
export const CLEARED = Symbol("cleared");
type Expected = FieldValue | typeof CLEARED;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches a label's full text, ignoring a trailing "*" and surrounding whitespace. */
export function labelMatcher(label: string | RegExp): RegExp {
    if (label instanceof RegExp) return label;
    return new RegExp(`^\\s*${escapeRegExp(label)}\\s*\\*?\\s*$`, "i");
}

const CONTROL = "input:not([type=hidden]), select, textarea";

/**
 * The control a label names. Tries, in order: the label's `for` target, a
 * control nested in the label, then the first control in the label's parent
 * (the `<div><Label/><Input/></div>` pattern used across the app).
 */
export async function fieldControl(scope: Locator, spec: Pick<FieldSpec, "label" | "locate" | "nth">): Promise<Locator> {
    if (spec.locate) return spec.locate(scope);
    const label = scope.locator("label").filter({ hasText: labelMatcher(spec.label) }).nth(spec.nth ?? 0);
    await expect(label, `label ${String(spec.label)}`).toBeVisible();
    const htmlFor = await label.getAttribute("for");
    if (htmlFor) {
        const target = scope.page().locator(`[id="${htmlFor}"]`);
        if ((await target.count()) === 1) return target;
    }
    const nested = label.locator(CONTROL);
    if ((await nested.count()) > 0) return nested.first();
    return label.locator("xpath=..").locator(CONTROL).first();
}

/** Selects the option whose visible text equals `text`, else the first that contains it. */
export async function selectByText(select: Locator, text: string): Promise<void> {
    let value: string | null = null;
    await expect
        .poll(
            async () => {
                value = await select.evaluate((el, wanted) => {
                    const options = Array.from((el as HTMLSelectElement).options);
                    const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
                    const hit =
                        options.find((o) => norm(o.text) === norm(wanted))
                        ?? options.find((o) => norm(o.text).includes(norm(wanted)));
                    return hit ? hit.value : null;
                }, text);
                return value;
            },
            { message: `option "${text}" to load`, timeout: 20_000 },
        )
        .not.toBeNull();
    await select.selectOption(value as unknown as string);
}

async function clearControl(control: Locator, spec: FieldSpec): Promise<void> {
    switch (spec.type) {
        case "checkbox":
            await control.setChecked(false);
            return;
        case "select": {
            const hasEmpty = await control.evaluate((el) =>
                Array.from((el as HTMLSelectElement).options).some((o) => o.value === ""),
            );
            if (!hasEmpty) throw new Error(`Select ${String(spec.label)} has no empty option to clear to`);
            await control.selectOption("");
            return;
        }
        default:
            await control.fill("");
    }
}

/** Writes one value into a control of the given type. */
export async function setControl(control: Locator, spec: FieldSpec, value: FieldValue): Promise<void> {
    switch (spec.type) {
        case "checkbox":
            await control.setChecked(Boolean(value));
            return;
        case "select":
            await selectByText(control, String(value));
            return;
        case "date": {
            const inputType = await control.getAttribute("type");
            const text = String(value);
            await control.fill(inputType === "datetime-local" && text.length === 10 ? `${text}T09:00` : text);
            return;
        }
        default:
            await control.fill(String(value));
    }
}

/** Fills every field with its create value (or its edit value / clear when `phase` is "edit"). */
export async function fillForm(scope: Locator, fields: readonly FieldSpec[], phase: "create" | "edit" = "create"): Promise<void> {
    for (const spec of fields) {
        if (phase === "edit" && spec.createOnly) continue;
        const control = await fieldControl(scope, spec);
        if (phase === "create") {
            await setControl(control, spec, spec.value);
            continue;
        }
        if (spec.edit !== undefined) await setControl(control, spec, spec.edit);
        else if (spec.optional) await clearControl(control, spec);
    }
}

/** What each field should show: after create, or after the edit step. */
export function expectedValue(spec: FieldSpec, phase: "created" | "edited"): Expected {
    if (phase === "created") return spec.value;
    if (spec.edit !== undefined) return spec.edit;
    return spec.optional ? CLEARED : spec.value;
}

const normaliseNumber = (value: string): string => {
    if (value.trim() === "") return "";
    const n = Number(value.replace(/,/g, ""));
    return Number.isNaN(n) ? value.trim() : String(n);
};

/** Asserts one control shows `expected` (dates as YYYY-MM-DD, numbers numerically). */
export async function expectControl(control: Locator, spec: FieldSpec, expected: Expected): Promise<void> {
    const what = `field "${String(spec.label)}"`;
    switch (spec.type) {
        case "checkbox":
            if (expected === CLEARED || expected === false) await expect(control, what).not.toBeChecked();
            else await expect(control, what).toBeChecked();
            return;
        case "select": {
            const selected = () =>
                control.evaluate((el) => {
                    const s = el as HTMLSelectElement;
                    const o = s.selectedOptions[0];
                    return { value: s.value, text: (o?.text ?? "").replace(/\s+/g, " ").trim() };
                });
            if (expected === CLEARED) {
                if (spec.clearedText) {
                    await expect.poll(async () => (await selected()).text, { message: what }).toContain(spec.clearedText);
                } else {
                    await expect.poll(async () => (await selected()).value, { message: what }).toBe("");
                }
            } else {
                await expect
                    .poll(async () => (await selected()).text.toLowerCase(), { message: what })
                    .toContain(String(expected).toLowerCase());
            }
            return;
        }
        case "number": {
            const want = expected === CLEARED ? "" : normaliseNumber(String(expected));
            await expect.poll(async () => normaliseNumber(await control.inputValue()), { message: what }).toBe(want);
            return;
        }
        case "date": {
            const want = expected === CLEARED ? "" : String(expected).slice(0, 10);
            await expect.poll(async () => (await control.inputValue()).slice(0, 10), { message: what }).toBe(want);
            return;
        }
        default:
            await expect(control, what).toHaveValue(expected === CLEARED ? "" : String(expected));
    }
}

/** Asserts every field of an open form against the created or edited values. */
export async function expectForm(scope: Locator, fields: readonly FieldSpec[], phase: "created" | "edited"): Promise<void> {
    for (const spec of fields) {
        if (spec.writeOnly) continue;
        if (phase === "edited" && spec.createOnly) continue;
        const control = await fieldControl(scope, spec);
        await expectControl(control, spec, expectedValue(spec, phase));
    }
}

// ── Modals, tables, toasts ─────────────────────────────────────────────────────

/** The app's modal overlay (components/ui/modal.tsx has no dialog role). */
export const OVERLAY = "div.fixed.inset-0.z-50";

/** The top-most open modal that contains a form. */
export const formModal = (page: Page): Locator =>
    page.locator(OVERLAY).filter({ has: page.locator("form") }).last();

/** react-hot-toast messages currently on screen. */
export const toasts = (page: Page): Locator => page.locator('[role="status"]');

export const DUPLICATE_TOAST = /already exists|duplicate/i;

/** Visible toast and inline error text, for failure messages. */
export async function visibleFeedback(page: Page): Promise<string> {
    const texts = [
        ...(await toasts(page).allInnerTexts()),
        ...(await page.getByRole("alert").allInnerTexts()),
    ].map((t) => t.trim()).filter(Boolean);
    return texts.join(" | ") || "(no toast or inline error)";
}

/**
 * Submits a form and waits for its modal to close. On failure the assertion
 * message carries whatever the app said (toast / inline errors).
 */
export async function submitAndClose(page: Page, scope: Locator, submit?: Locator): Promise<void> {
    const button = submit ?? scope.locator('button[type="submit"]').last();
    await button.click();
    try {
        await expect(scope).toBeHidden({ timeout: 30_000 });
    } catch {
        throw new Error(`Form did not close after submit: ${await visibleFeedback(page)}`);
    }
}

/** The table row (or card) that shows `text`. */
export function rowWith(page: Page, text: string, rowSelector = "tr"): Locator {
    return page.locator(rowSelector).filter({ hasText: text }).first();
}

/** Types into a list page's search box when it has one (matched by placeholder). */
export async function searchList(page: Page, text: string, placeholder: RegExp = /search/i): Promise<void> {
    const box = page.getByPlaceholder(placeholder).first();
    if ((await box.count()) > 0 && (await box.isVisible())) await box.fill(text);
}

/** Clicks the button named `name` in the row showing `text`, e.g. "Edit category". */
export async function clickRowAction(page: Page, text: string, name: RegExp, rowSelector = "tr"): Promise<void> {
    const row = rowWith(page, text, rowSelector);
    await expect(row, `row "${text}"`).toBeVisible();
    await row.getByRole("button", { name }).first().click();
}

/** Accepts the app's confirm dialog (components/ui/confirm-modal.tsx). */
export async function acceptConfirm(page: Page, name: RegExp = /^(Delete|Confirm|Yes|Remove|Continue|OK)\b/i): Promise<void> {
    const overlay = page.locator(OVERLAY).last();
    await overlay.getByRole("button", { name }).last().click();
}

/**
 * Makes the browser's own constraint validation step aside (maxlength / min /
 * max / required), so the value reaches react-hook-form and its inline error is
 * what the user sees. Mirrors a paste or autofill that bypasses the attributes.
 */
export async function bypassNativeValidation(scope: Locator, control?: Locator): Promise<void> {
    // The scope may be the form itself (e.g. one of several forms on a page) or a
    // container around it.
    const isForm = await scope.evaluate((el) => el.tagName === "FORM");
    const form = isForm ? scope : scope.locator("form").first();
    await form.evaluate((el) => {
        (el as HTMLFormElement).noValidate = true;
    });
    if (control) {
        await control.evaluate((el) => {
            for (const attr of ["maxlength", "minlength", "min", "max", "step", "pattern"]) el.removeAttribute(attr);
        });
    }
}

/** A string one character over `max`. */
export const overLength = (max: number, seed = "X"): string => seed.repeat(max + 1);
