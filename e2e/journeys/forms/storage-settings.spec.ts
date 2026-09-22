import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../fixtures/auth";
import { overLength } from "../../fixtures/forms";
import { blockWrites } from "./_admin-helpers";

/**
 * /settings/storage is the REAL tenant's S3 configuration: VALIDATE ONLY. The
 * form is a plain controlled form (no react-hook-form): the presign TTL error
 * shows live as a role=alert, and the bucket name is capped by maxlength (63,
 * the S3 limit). Save is never clicked; every write to the storage-config
 * endpoints is aborted as a second guard, and a reload discards the edits.
 */

const STORAGE_WRITES = /\/organisations\/[^/]+\/storage-config/;
const BUCKET_MAX = 63;
const TTL_ERROR = /Enter whole minutes from 1 to 720/;

/** The storage card: the innermost element holding both the TTL input and the save button. */
async function openStorage(page: Page): Promise<Locator> {
    await page.goto("/settings/storage");
    const save = page.getByRole("button", { name: /^Save Storage Settings$/ });
    await expect(save).toBeVisible({ timeout: 30_000 });
    // The S3 fields only render while the toggle is on; turning it on here is local state only.
    await page.getByLabel("Enable S3 storage for this organisation").setChecked(true);
    const ttl = page.getByLabel("Presigned URL TTL (minutes)");
    await expect(ttl).toBeVisible();
    return page.locator("div").filter({ has: save }).filter({ has: ttl }).last();
}

test.describe("Storage settings (validate only, never saved)", () => {
    for (const value of ["0", "721", "1.5", "-5"]) {
        test(`presign TTL ${value} shows the range error; a valid value clears it`, async ({ page }) => {
            const blocked = await blockWrites(page, STORAGE_WRITES);
            const card = await openStorage(page);
            const ttl = page.getByLabel("Presigned URL TTL (minutes)");

            await ttl.fill(value);
            await expect(card.getByRole("alert").filter({ hasText: TTL_ERROR })).toBeVisible();
            await expect(ttl).toHaveAttribute("aria-invalid", "true");

            await ttl.fill("15");
            await expect(card.getByRole("alert").filter({ hasText: TTL_ERROR })).toHaveCount(0);

            await page.reload();
            expect(blocked, "no storage write was attempted").toHaveLength(0);
        });
    }

    test("the bucket name cannot exceed 63 characters", async ({ page }) => {
        const blocked = await blockWrites(page, STORAGE_WRITES);
        await openStorage(page);
        const bucket = page.getByLabel("S3 bucket override");
        await expect(bucket).toHaveAttribute("maxlength", String(BUCKET_MAX));

        // Typed like a user (maxlength applies to typing): the 64th character is refused.
        await bucket.fill("");
        await bucket.pressSequentially(overLength(BUCKET_MAX, "b"));
        await expect.poll(async () => (await bucket.inputValue()).length).toBe(BUCKET_MAX);

        await page.reload();
        expect(blocked, "no storage write was attempted").toHaveLength(0);
    });
});
