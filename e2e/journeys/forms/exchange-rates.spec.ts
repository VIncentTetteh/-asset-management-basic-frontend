import type { Locator, Page } from "@playwright/test";
import { PREFIX, RUN_ID, expect, test, uniq } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";
import {
    DUPLICATE_TOAST,
    acceptConfirm,
    bypassNativeValidation,
    fieldControl,
    fillForm,
    formModal,
    overLength,
    rowWith,
    searchList,
    setControl,
    submitAndClose,
    toasts,
    type FieldSpec,
} from "../../fixtures/forms";
import { isoDate } from "../../fixtures/prereqs";
import { dropWhere } from "./_leases-licenses-helpers";

/**
 * src/app/exchange-rates/page.tsx: rates are create + delete only (no edit
 * action; a rate is replaced by deleting it and adding a new one), so this is
 * not a describeRoundTrip form. The round trip is: create with every field,
 * reload and check the row (and the stored record), delete.
 *
 * A pair no real tenant rates (ISK -> MNT) keeps the org's currency lists
 * untouched in practice; the effective date is derived from the run id so a
 * leftover from an earlier run cannot hit the "same pair and date" rule.
 */
const BASE = "ISK";
const TARGET = "MNT";
const RATE = "0.12345678";
const source = uniq("FX").slice(0, 50); // Source is at most 50 characters.
const runOffset = [...RUN_ID].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 1500;
const effectiveDate = isoDate(-(30 + runOffset));

interface RateRow {
    id?: string;
    baseCurrency?: string;
    targetCurrency?: string;
    rate?: number | string;
    effectiveDate?: string;
    source?: string;
}

const fields: readonly FieldSpec[] = [
    { label: "Base currency", type: "select", value: BASE },
    { label: "Target currency", type: "select", value: TARGET },
    { label: "Rate", type: "number", value: RATE },
    { label: "Effective date", type: "date", value: effectiveDate },
    { label: "Source", type: "text", value: source },
];

const negative: readonly { field: string; value: string; error: RegExp }[] = [
    { field: "Source", value: overLength(50), error: /Source must be at most 50 characters/ },
    { field: "Rate", value: "0.123456789", error: /Rate can have at most 8 decimal places/ },
    { field: "Rate", value: "0", error: /Rate must be greater than 0/ },
];

async function openCreate(page: Page): Promise<Locator> {
    await page.goto("/exchange-rates");
    await page.getByRole("button", { name: /^Add rate$/i }).first().click();
    const form = formModal(page);
    await expect(form).toBeVisible();
    return form;
}

/** Removes this suite's E2E rates on the ISK -> MNT pair (best-effort). */
async function dropE2eRates(api: ApiClient): Promise<void> {
    await dropWhere<RateRow>(
        api,
        "/exchange-rates",
        (r) => r.baseCurrency === BASE && r.targetCurrency === TARGET && (r.source ?? "").startsWith(PREFIX),
        (id) => `/exchange-rates/${id}`,
    );
}

test.describe("Exchange rates", () => {
    for (const [index, neg] of negative.entries()) {
        test(`e${index + 1}) inline error for invalid "${neg.field}"`, async ({ page }) => {
            const form = await openCreate(page);
            await fillForm(form, fields, "create");
            const spec = fields.find((f) => f.label === neg.field)!;
            const control = await fieldControl(form, spec);
            await bypassNativeValidation(form, control);
            await setControl(control, spec, neg.value);
            await form.locator('button[type="submit"]').last().click();

            await expect(form.getByRole("alert").filter({ hasText: neg.error }).first()).toBeVisible();
            await expect(form, "the form stays open").toBeVisible();
            await expect(toasts(page).filter({ hasText: DUPLICATE_TOAST })).toHaveCount(0);
        });
    }

    test("round trip: create, persist, delete", async ({ page, api }) => {
        await dropE2eRates(api);
        try {
            await test.step("a) create with every field filled", async () => {
                const form = await openCreate(page);
                await fillForm(form, fields, "create");
                await submitAndClose(page, form);
            });

            await test.step("b) reload: the row and the stored record carry every field", async () => {
                await page.goto("/exchange-rates");
                await searchList(page, BASE, /Filter by currency/i);
                const row = rowWith(page, source);
                await expect(row).toBeVisible();
                await expect(row).toContainText(BASE);
                await expect(row).toContainText(TARGET);
                await expect(row).toContainText(RATE);

                const stored = (await api.list<RateRow>("/exchange-rates")).find((r) => r.source === source);
                expect(stored, "the rate is stored").toBeTruthy();
                expect(stored!.baseCurrency).toBe(BASE);
                expect(stored!.targetCurrency).toBe(TARGET);
                expect(Number(stored!.rate)).toBe(Number(RATE));
                expect(String(stored!.effectiveDate).slice(0, 10)).toBe(effectiveDate);
            });

            await test.step("f) delete", async () => {
                await page.goto("/exchange-rates");
                await searchList(page, BASE, /Filter by currency/i);
                await rowWith(page, source).getByRole("button", { name: /^Delete rate$/i }).click();
                await acceptConfirm(page);
                await expect(rowWith(page, source)).toBeHidden({ timeout: 20_000 });
            });
        } finally {
            await dropE2eRates(api).catch(() => undefined);
        }
    });
});
