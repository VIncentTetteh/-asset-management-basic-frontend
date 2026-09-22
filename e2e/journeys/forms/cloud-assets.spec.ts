import type { Locator, Page } from "@playwright/test";
import { expect, uniq } from "../../fixtures/auth";
import type { ApiClient } from "../../fixtures/api";
import {
    OVERLAY,
    acceptConfirm,
    fieldControl,
    formModal,
    overLength,
    rowWith,
    submitAndClose,
    type FieldSpec,
} from "../../fixtures/forms";
import { isoDate } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { baseCurrency } from "./_workflow-helpers";

/**
 * Cloud asset form (app/cloud-assets/page.tsx), every field including the
 * key/value tag editor (features/cloud/TagEditor.tsx), plus "record cost" on
 * the created asset and its cost history (features/cloud/CloudCostHistoryModal.tsx).
 *
 * The list is server-paged (20 a page) with no search box, so rows are found by
 * narrowing the provider filter to the rarely used providers this spec writes.
 * Tags are not a plain control: the create submit adds them, the first edit
 * reopen asserts and replaces them, the second reopen asserts the replacement.
 */

const PATH = "/cloud-assets";
const name = uniq("Cloud");
const editedName = uniq("Cloud-edited");
const PROVIDER = "IBM_CLOUD";
const EDITED_PROVIDER = "ORACLE_CLOUD";

interface Tag {
    key: string;
    value: string;
}
const CREATED_TAGS: Tag[] = [
    { key: "owner", value: uniq("team") },
    { key: "cost-center", value: "CC-42" },
];
const EDITED_TAGS: Tag[] = [
    { key: "owner", value: uniq("team-edited") },
    { key: "project", value: "e2e" },
];

const cost = {
    month: isoDate(0).slice(0, 7),
    amount: "123.45",
    service: uniq("svc"),
};

/** "2026-09" as the history shows it ("Sep 2026"), mirroring formatBillingMonth. */
function monthLabel(month: string): string {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [year, m] = month.split("-");
    return `${names[Number(m) - 1]} ${year}`;
}

const currency: FieldSpec = { label: "Currency", type: "select", value: "USD" };

// ── Tag editor ──────────────────────────────────────────────────────────────────

const tagName = (scope: Locator, i: number) => scope.getByRole("textbox", { name: `Tag ${i + 1} name`, exact: true });
const tagValue = (scope: Locator, i: number) => scope.getByRole("textbox", { name: `Tag ${i + 1} value`, exact: true });

async function readTags(scope: Locator): Promise<Tag[]> {
    const count = await scope.getByRole("textbox", { name: /^Tag \d+ name$/ }).count();
    const tags: Tag[] = [];
    for (let i = 0; i < count; i++) {
        tags.push({ key: await tagName(scope, i).inputValue(), value: await tagValue(scope, i).inputValue() });
    }
    return tags;
}

/** Removes every tag row, then adds `tags` one by one. */
async function writeTags(scope: Locator, tags: readonly Tag[]): Promise<void> {
    while ((await scope.getByRole("button", { name: /^Remove tag \d+$/ }).count()) > 0) {
        await scope.getByRole("button", { name: "Remove tag 1", exact: true }).click();
    }
    for (const [i, tag] of tags.entries()) {
        await scope.getByRole("button", { name: /Add tag/ }).click();
        await tagName(scope, i).fill(tag.key);
        await tagValue(scope, i).fill(tag.value);
    }
}

/** Edit-form opens since the last create: the first (step b) asserts and replaces the tags, later ones assert the replacement. */
let editOpens = 0;

// ── List ────────────────────────────────────────────────────────────────────────

/**
 * The row for `text`: on the first page when it is there, else under the
 * provider filters this spec writes (before and after the edit).
 */
async function findRow(page: Page, text: string): Promise<Locator> {
    const row = rowWith(page, text);
    const providerFilter = page.locator("select").filter({ has: page.locator("option", { hasText: "All Providers" }) });
    for (const provider of ["", PROVIDER, EDITED_PROVIDER]) {
        if (provider) await providerFilter.selectOption(provider);
        const shown = await row.waitFor({ state: "visible", timeout: 10_000 }).then(() => true, () => false);
        if (shown) return row;
    }
    throw new Error(`Cloud asset row "${text}" not found on the first page of any provider filter`);
}

async function openEdit(page: Page, key: string): Promise<Locator> {
    const row = await findRow(page, key);
    await row.getByRole("button", { name: "Edit cloud asset" }).click();
    const form = formModal(page);
    await expect(form.getByRole("heading", { name: "Edit Cloud Asset" })).toBeVisible();
    editOpens += 1;
    const tags = await readTags(form);
    if (editOpens === 1) {
        // Step b: the created tags came back; replace them for the edit.
        expect(tags, "tags after create").toEqual(CREATED_TAGS);
        await writeTags(form, EDITED_TAGS);
    } else {
        // Step d: the edited tags must have persisted.
        expect(tags, "tags after the edit").toEqual(EDITED_TAGS);
    }
    return form;
}

async function submit(page: Page, form: Locator): Promise<void> {
    if ((await form.getByRole("heading", { name: "Add Cloud Asset" }).count()) > 0) {
        await writeTags(form, CREATED_TAGS);
        editOpens = 0;
    }
    await submitAndClose(page, form);
}

async function recordCostAndCheckHistory(page: Page, key: string): Promise<void> {
    await page.goto(PATH);
    let row = await findRow(page, key);
    await row.getByRole("button", { name: "Cost", exact: true }).click();
    const form = formModal(page);
    await expect(form.getByRole("heading", { name: "Record Monthly Cost" })).toBeVisible();
    await (await fieldControl(form, { label: "Billing Month" })).fill(cost.month);
    await (await fieldControl(form, { label: "Amount" })).fill(cost.amount);
    await (await fieldControl(form, { label: "Service Name" })).fill(cost.service);
    await submitAndClose(page, form);

    row = await findRow(page, key);
    await row.getByRole("button", { name: "History", exact: true }).click();
    const history = page.locator(OVERLAY).filter({ has: page.getByRole("heading", { name: /^Cost history/ }) }).last();
    await expect(history.getByRole("heading", { name: `Cost history — ${key}` })).toBeVisible();
    const entry = history.locator("tr").filter({ hasText: cost.service });
    await expect(entry, "the recorded cost is in the history").toBeVisible();
    await expect(entry).toContainText(monthLabel(cost.month));
    await expect(entry).toContainText(cost.amount);
    await page.keyboard.press("Escape");
}

async function remove(page: Page, key: string): Promise<void> {
    await page.goto(PATH);
    const row = await findRow(page, key);
    await row.getByRole("button", { name: "Delete cloud asset" }).click();
    await acceptConfirm(page);
    await expect(rowWith(page, key)).toBeHidden({ timeout: 20_000 });
}

/** Best-effort API cleanup of anything this spec left (e.g. after a failed step). */
async function dropLeftovers(api: ApiClient): Promise<void> {
    for (const provider of [PROVIDER, EDITED_PROVIDER]) {
        const rows = await api
            .list<{ id: string; name?: string }>(await api.withOrg(`/cloud-assets?provider=${provider}&size=100`))
            .catch(() => []);
        for (const row of rows.filter((r) => r.name === name || r.name === editedName)) {
            await api.tryDelete(await api.withOrg(`/cloud-assets/${row.id}`));
        }
    }
}

describeRoundTrip({
    title: "Cloud assets",
    path: PATH,
    key: name,
    editedKey: editedName,
    createButton: /^Add Cloud Asset$/,
    openEdit,
    submit,
    setup: async ({ api }) => {
        currency.value = await baseCurrency(api);
    },
    teardown: async ({ api }) => dropLeftovers(api),
    fields: [
        { label: "Name", type: "text", value: name, edit: editedName },
        { label: "Provider", type: "select", value: PROVIDER, edit: EDITED_PROVIDER },
        { label: "Environment", type: "select", value: "STAGING", optional: true },
        // Option text is the enum with spaces; no empty option.
        { label: "Resource Type", type: "select", value: "KUBERNETES CLUSTER", edit: "MESSAGE QUEUE" },
        { label: "Status", type: "select", value: "STOPPED", edit: "PENDING" },
        { label: "Region", type: "text", value: "eu-central-1", edit: "eu-west-1" },
        { label: "Account ID", type: "text", value: "123456789012", optional: true },
        { label: "Resource ID", type: "text", value: `arn:aws:e2e:::${uniq("resource")}`, edit: `arn:aws:e2e:::${uniq("resource-edited")}` },
        { label: "Monthly Cost Estimate", type: "number", value: 42.5, optional: true },
        currency,
        { label: "Description", type: "textarea", value: uniq("cloud description"), optional: true },
    ],
    negative: [
        { field: "Name", value: overLength(200), error: /Name must be at most 200 characters/ },
        { field: "Resource ID", value: overLength(500), error: /Resource ID must be at most 500 characters/ },
        { field: "Monthly Cost Estimate", value: -1, error: /Monthly cost estimate must be at least 0/ },
    ],
    afterEdit: ({ page }, key) => recordCostAndCheckHistory(page, key),
    remove: ({ page }, key) => remove(page, key),
});
