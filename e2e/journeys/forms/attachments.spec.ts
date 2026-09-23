import { expect, test, uniq } from "../../fixtures/auth";
import { formModal, searchList, submitAndClose, visibleFeedback } from "../../fixtures/forms";
import { isoDate } from "../../fixtures/prereqs";
import { createContract, dropContract } from "./_finance-helpers";

/**
 * The document uploader, end to end on one form.
 *
 * Contracts stand in for all nine converted fields: they share one control
 * (components/ui/attachment-field.tsx) and one endpoint, so what differs
 * between the forms is only the entityType they pass. This walks the cycle a
 * customer actually needs — attach a file, see it listed with its size, get it
 * back out, take it off again — because each step is a different endpoint and
 * the list is the only place a half-finished upload would show.
 *
 * Attachments are gated by the API's `commercial.document-attachments` flag,
 * which is off by default (it is waiting on malware scanning). When the flag is
 * off the form shows the legacy URL input instead, so the spec skips with that
 * reason rather than failing on an environment that is behaving correctly.
 */

const CONTRACT = uniq("ATT-Contract");
const FILE_NAME = "e2e-contract-evidence.txt";
const FILE_BODY = "AssetIQ e2e attachment fixture — safe to delete.\n";

let contractId: string | undefined;

test.describe("Contract document attachments", () => {
    test.afterEach(async ({ api }) => {
        await dropContract(api, contractId);
        contractId = undefined;
    });

    test("attach, list, download and remove a document", async ({ page, api }) => {
        contractId = (await createContract(api, CONTRACT)).id;

        await page.goto("/contracts");
        await searchList(page, CONTRACT);
        const row = page.locator("tr").filter({ hasText: CONTRACT }).first();
        await expect(row, `row "${CONTRACT}"`).toBeVisible();
        await row.getByRole("button", { name: /^Edit contract$/i }).first().click();

        const form = formModal(page);
        await expect(form).toBeVisible();

        const picker = form.locator('input[type="file"]');
        test.skip(
            (await picker.count()) === 0,
            "document attachments are off for this tenant (commercial.document-attachments); the form shows the legacy URL field",
        );

        // ── Attach ────────────────────────────────────────────────────────────
        await picker.setInputFiles({
            name: FILE_NAME,
            mimeType: "text/plain",
            buffer: Buffer.from(FILE_BODY, "utf8"),
        });

        // ── List ──────────────────────────────────────────────────────────────
        const list = form.getByTestId("attachment-list");
        try {
            await expect(list).toBeVisible({ timeout: 30_000 });
            await expect(list).toContainText(FILE_NAME);
        } catch {
            throw new Error(`Upload did not appear in the list: ${await visibleFeedback(page)}`);
        }
        // The size comes back from the server, not from the browser's File object.
        await expect(list).toContainText(`${Buffer.byteLength(FILE_BODY, "utf8")} B`);

        // ── Download ──────────────────────────────────────────────────────────
        // With S3 configured this is a presigned URL opened in a new tab; without
        // it, the backend streams the bytes and the page saves them. Either is a
        // pass — what must not happen is neither.
        const downloadButton = list.getByRole("button", { name: new RegExp(`Download ${FILE_NAME}`) });
        const popup = page.waitForEvent("popup", { timeout: 15_000 }).catch(() => null);
        const download = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
        await downloadButton.click();
        const [openedTab, savedFile] = await Promise.all([popup, download]);
        expect(
            openedTab !== null || savedFile !== null,
            `Download produced neither a tab nor a file: ${await visibleFeedback(page)}`,
        ).toBeTruthy();
        if (savedFile) expect(savedFile.suggestedFilename()).toContain(FILE_NAME);
        await openedTab?.close();

        // ── Remove ────────────────────────────────────────────────────────────
        await list.getByRole("button", { name: new RegExp(`Remove ${FILE_NAME}`) }).click();
        // The control confirms inline before it deletes anything.
        await form.getByRole("button", { name: /^Remove$/ }).click();
        await expect(form.getByText(FILE_NAME)).toBeHidden({ timeout: 30_000 });
        await expect(form.getByText(/No files attached yet/i)).toBeVisible();
    });

    /**
     * The create path, which no round-trip spec reaches: on a form for a record
     * that does not exist yet the file has nowhere to go, so it is held and
     * uploaded once the POST returns an id. That ordering is the one thing in
     * this feature that can silently attach to the wrong record — or to nothing
     * at all — so it is checked against a contract created through the form.
     */
    test("holds a file chosen before the contract exists, then attaches it to the new record", async ({ page, api }) => {
        const title = `${CONTRACT}-created`;
        await page.goto("/contracts");
        await page.getByRole("button", { name: /New contract/i }).first().click();

        const form = formModal(page);
        await expect(form).toBeVisible();
        const picker = form.locator('input[type="file"]');
        test.skip((await picker.count()) === 0, "document attachments are off for this tenant");

        await form.getByLabel(/^Title\s*\*?$/).fill(title);
        await form.getByLabel(/^Start date\s*\*?$/).fill(isoDate(0));
        await form.getByLabel(/^End date\s*\*?$/).fill(isoDate(365));
        await picker.setInputFiles({
            name: FILE_NAME,
            mimeType: "text/plain",
            buffer: Buffer.from(FILE_BODY, "utf8"),
        });
        // Nothing is uploaded yet: the contract it would hang off does not exist.
        await expect(form.getByText(/will be attached when this is saved/i)).toBeVisible();

        await submitAndClose(page, form);

        // Find what the form created, so the cleanup can remove it and the
        // assertion below is about that record rather than any other.
        const created = (await api.list<{ id: string; title: string }>("/contracts"))
            .find((row) => row.title === title);
        expect(created, `contract "${title}" via the API`).toBeTruthy();
        contractId = created!.id;

        // Reopening the record is the only proof the upload used the id the
        // create returned: the list is read back from the server by entityId.
        await searchList(page, title);
        await page.locator("tr").filter({ hasText: title }).first()
            .getByRole("button", { name: /^Edit contract$/i }).first().click();
        const reopened = formModal(page);
        await expect(reopened.getByTestId("attachment-list")).toContainText(FILE_NAME, { timeout: 30_000 });
    });

    test("refuses a file type the API would reject, before sending it", async ({ page, api }) => {
        contractId = (await createContract(api, CONTRACT)).id;

        await page.goto("/contracts");
        await searchList(page, CONTRACT);
        await page.locator("tr").filter({ hasText: CONTRACT }).first()
            .getByRole("button", { name: /^Edit contract$/i }).first().click();

        const form = formModal(page);
        await expect(form).toBeVisible();
        const picker = form.locator('input[type="file"]');
        test.skip((await picker.count()) === 0, "document attachments are off for this tenant");

        await picker.setInputFiles({
            name: "logo.svg",
            mimeType: "image/svg+xml",
            buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>", "utf8"),
        });

        // SVG carries script, so it is refused client-side and never uploaded.
        await expect(form.getByRole("alert").filter({ hasText: /cannot be attached/i })).toBeVisible();
        await expect(form.getByTestId("attachment-list")).toBeHidden();
    });
});
