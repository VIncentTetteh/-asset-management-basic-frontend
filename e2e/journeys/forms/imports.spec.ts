import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/auth";

/**
 * The import wizard, driven through the asset register.
 *
 * The `/imports/**` API is stubbed here rather than called for real. Two
 * reasons, in order: it is not deployed yet, and — even once it is — an
 * importer that runs for real against a tenant writes rows into somebody's
 * live register, which no journey in this suite does. What this spec is
 * actually for is the half the backend cannot check: that the analyser's
 * suggestion reaches the dropdowns, that a required field with no column stops
 * the user, and that the request the wizard finally posts carries exactly the
 * mapping left on screen. Swap the stubs for the real endpoints only if the
 * suite ever gets a disposable tenant to import into.
 *
 * Like every file here it needs E2E_BASE_URL and runs under
 * playwright.staging.config.ts; the auth fixture skips it otherwise.
 */

const UPLOAD_ID = "e2e-upload";
const JOB_ID = "e2e-job";

const FIELDS = [
    { name: "name", label: "Asset name", required: true, dataType: "STRING", example: "Dell Latitude 5540" },
    { name: "assetTag", label: "Asset tag", required: true, dataType: "STRING" },
    { name: "serialNumber", label: "Serial number", required: false, dataType: "STRING" },
    { name: "purchaseCost", label: "Purchase cost", required: false, dataType: "DECIMAL" },
    { name: "assetType", label: "Asset type", required: false, dataType: "ENUM" },
];

/** A foreign export: not one of these headings is ours. */
const DETECTED_COLUMNS = [
    { index: 0, name: "Display Name", sampleValues: ["Latitude 5540", "ThinkPad X1"] },
    { index: 1, name: "Asset ID", sampleValues: ["AST-0001"] },
    { index: 2, name: "Serial", sampleValues: ["5CG1234"] },
    { index: 3, name: "Cost (USD)", sampleValues: ["1200", "not-a-number"] },
    { index: 4, name: "Assignment group", sampleValues: ["IT Ops"] },
    { index: 5, name: "Type", sampleValues: ["Laptop", "Sundry"] },
];

/** Their words for our constants: "Laptop" is HARDWARE, "Sundry" is nothing we know. */
const ENUM_FIELDS = [
    {
        field: "assetType",
        label: "Asset type",
        column: 5,
        header: "Type",
        allowedValues: ["HARDWARE", "SOFTWARE", "FURNITURE"],
        values: [
            { value: "Laptop", suggested: "HARDWARE", exact: false, rowCount: 2 },
            { value: "Sundry", suggested: null, exact: false, rowCount: 1 },
        ],
    },
];

const COLUMN_PLAN = [
    { index: 0, header: "Display Name", action: "FIELD", field: "name", canBeCustomField: false },
    { index: 1, header: "Asset ID", action: "IGNORE", canBeCustomField: true },
    { index: 2, header: "Serial", action: "FIELD", field: "serialNumber", canBeCustomField: false },
    { index: 3, header: "Cost (USD)", action: "FIELD", field: "purchaseCost", canBeCustomField: false },
    {
        index: 4,
        header: "Assignment group",
        action: "IGNORE",
        customFieldName: "Assignment group",
        inferredType: "TEXT",
        canBeCustomField: true,
    },
    { index: 5, header: "Type", action: "FIELD", field: "assetType", canBeCustomField: false },
];

interface RunRequest {
    uploadId: string;
    mapping: Record<string, number>;
    options?: {
        skipInvalidRows?: boolean;
        createMissingReferences?: boolean;
        customFieldColumns?: number[];
        valueMappings?: Record<string, Record<string, string>>;
    };
}

interface Stubs {
    /** Bodies the wizard posted, in order. */
    previews: RunRequest[];
    commits: RunRequest[];
    jobPolls: number;
}

const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

/**
 * Serves the whole `/imports` surface from fixtures, and a job that starts
 * QUEUED so the wizard has to keep polling to reach a result.
 */
async function stubImportsApi(page: Page): Promise<Stubs> {
    const stubs: Stubs = { previews: [], commits: [], jobPolls: 0 };

    await page.route(
        (url) => url.pathname.includes("/imports/") || url.pathname.endsWith("/imports/types"),
        async (route) => {
            const url = new URL(route.request().url());
            const { pathname } = url;
            const method = route.request().method();

            if (pathname.endsWith("/imports/types")) {
                return route.fulfill(json([{ type: "assets", label: "Assets", description: "Your asset register." }]));
            }
            if (pathname.endsWith("/fields")) return route.fulfill(json(FIELDS));
            if (pathname.endsWith("/mappings") && method === "GET") return route.fulfill(json([]));
            if (pathname.endsWith("/template")) {
                return route.fulfill({
                    status: 200,
                    contentType: "text/csv",
                    headers: { "content-disposition": 'attachment; filename="assets-import-template.csv"' },
                    body: "name,assetTag,serialNumber,purchaseCost\n",
                });
            }
            if (pathname.endsWith("/analyse")) {
                return route.fulfill(
                    json({
                        uploadId: UPLOAD_ID,
                        detectedColumns: DETECTED_COLUMNS,
                        // Right about the name, wrong about the serial, silent about the required tag.
                        suggestedMapping: { name: 0, assetTag: null, serialNumber: 1, purchaseCost: 3, assetType: 5 },
                        rowCount: 3,
                        enumFields: ENUM_FIELDS,
                        columnPlan: COLUMN_PLAN,
                        customFieldsAvailable: true,
                        createMissingReferencesDefault: true,
                    }),
                );
            }
            if (pathname.endsWith("/preview")) {
                stubs.previews.push(route.request().postDataJSON() as RunRequest);
                return route.fulfill(
                    json({
                        totals: { valid: 2, invalid: 1, total: 3 },
                        errors: [{ row: 4, message: "must be a number", field: "purchaseCost", column: "Cost (USD)" }],
                        notes: [
                            { row: 3, message: "We left this blank", field: "assetType", column: "Type", value: "Sundry" },
                        ],
                        rowsChecked: 3,
                        totalRowsInFile: 3,
                        outcome: "PARTIAL",
                        fatalError: null,
                        wouldCreate: { department: ["IT Ops"] },
                        wouldCreateCustomFields: ["Assignment group"],
                    }),
                );
            }
            if (pathname.endsWith("/commit")) {
                stubs.commits.push(route.request().postDataJSON() as RunRequest);
                return route.fulfill(json({ jobId: JOB_ID, status: "QUEUED" }));
            }
            return route.fallback();
        },
    );

    await page.route(
        (url) => url.pathname.endsWith(`/import-jobs/${JOB_ID}`),
        async (route) => {
            stubs.jobPolls += 1;
            if (stubs.jobPolls < 2) return route.fulfill(json({ jobId: JOB_ID, status: "QUEUED" }));
            if (stubs.jobPolls < 3) return route.fulfill(json({ jobId: JOB_ID, status: "PROCESSING" }));
            return route.fulfill(
                json({
                    jobId: JOB_ID,
                    status: "COMPLETED",
                    result: {
                        totalRows: 3,
                        imported: 2,
                        updated: 0,
                        skipped: 1,
                        failed: 1,
                        duplicatesSkipped: 0,
                        outcome: "PARTIAL",
                        stoppedReason: "We stopped at the end of the sheet.",
                        stoppedEarly: true,
                        errors: [{ row: 4, message: "must be a number", field: "purchaseCost", column: "Cost (USD)" }],
                        notes: [{ row: 3, message: "Asset type was left blank", field: "assetType", column: "Type", value: "Sundry" }],
                        createdReferences: { department: ["IT Ops"] },
                        createdCustomFields: ["Assignment group"],
                    },
                }),
            );
        },
    );

    return stubs;
}

/** Opens the wizard from the asset register and uploads a foreign spreadsheet. */
async function openWizardAndUpload(page: Page): Promise<void> {
    await page.goto("/assets");
    await page.getByRole("button", { name: /^Import$/ }).click();
    await page.getByTestId("import-start-continue").click();
    await page.getByTestId("import-file-input").setInputFiles({
        name: "servicenow-export.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("Display Name,Asset ID,Serial,Cost (USD),Assignment group\n"),
    });
    await page.getByTestId("import-analyse").click();
    await expect(page.getByTestId("import-field-list")).toBeVisible({ timeout: 30_000 });
}

test.describe("Import wizard", () => {
    test("maps a foreign spreadsheet, matches its words to ours, and imports what was mapped", async ({ page }) => {
        const stubs = await stubImportsApi(page);
        await openWizardAndUpload(page);

        // The analyser's suggestion is pre-filled, and each column is offered
        // with a sample from the user's own file beside it.
        await expect(page.getByTestId("import-map-name")).toHaveValue("0");
        await expect(page.getByTestId("import-map-serialNumber")).toHaveValue("1");
        await expect(page.getByTestId("import-map-assetTag")).toHaveValue("");
        await expect(page.getByTestId("import-map-name")).toContainText("Display Name — e.g. Latitude 5540");

        // A required field with no column is impossible to miss and blocks the step.
        await expect(page.getByTestId("import-missing-required")).toContainText("Asset tag");
        await page.getByTestId("import-to-preview").click();
        await expect(page.getByTestId("import-field-list")).toBeVisible();
        expect(stubs.previews).toHaveLength(0);

        // Every column has a stated fate, and one AssetIQ has no field for can
        // be kept rather than silently dropped.
        await expect(page.getByTestId("import-column-4")).toHaveValue("__ignore__");
        await page.getByTestId("import-column-4").selectOption("__custom_field__");
        await expect(page.getByTestId("import-custom-fields-planned")).toContainText("Assignment group");

        // Correct the wrong guess, fill the gap, and go on to the value step.
        await page.getByTestId("import-map-serialNumber").selectOption("2");
        await page.getByTestId("import-map-assetTag").selectOption("1");
        await expect(page.getByTestId("import-missing-required")).toHaveCount(0);
        await page.getByTestId("import-to-preview").click();

        // "Laptop" is mappable to HARDWARE here, not in their spreadsheet.
        await expect(page.getByTestId("import-value-fields")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("import-value-assetType-laptop")).toHaveValue("HARDWARE");
        await expect(page.getByTestId("import-value-assetType-sundry")).toHaveValue("");
        await page.getByTestId("import-value-assetType-sundry").selectOption("__IGNORE__");
        await page.getByTestId("import-values-continue").click();

        await expect(page.getByTestId("import-preview-counts")).toBeVisible({ timeout: 30_000 });
        expect(stubs.previews.at(-1)?.mapping).toEqual({
            name: 0,
            assetTag: 1,
            serialNumber: 2,
            purchaseCost: 3,
            assetType: 5,
        });
        expect(stubs.previews.at(-1)?.options).toEqual({
            skipInvalidRows: false,
            createMissingReferences: true,
            customFieldColumns: [4],
            valueMappings: { assetType: { Laptop: "HARDWARE", Sundry: "__IGNORE__" } },
        });

        // The counters the deployed build rendered blank.
        await expect(page.getByTestId("import-preview-total")).toHaveText("3");
        await expect(page.getByTestId("import-preview-valid")).toHaveText("2");
        await expect(page.getByTestId("import-preview-invalid")).toHaveText("1");
        await expect(page.getByTestId("import-preview-verdict")).toHaveAttribute("data-outcome", "PARTIAL");
        await expect(page.getByTestId("import-preview-verdict")).not.toContainText("Every row passed");

        // Errors block a row; notes do not, and they are not one list.
        await expect(page.getByTestId("import-preview-errors")).toContainText("Row 4");
        await expect(page.getByTestId("import-preview-errors")).toContainText("Cost (USD)");
        await expect(page.getByTestId("import-preview-notes")).toContainText("Row 3");

        // Records this import would create in the tenant are named before it runs.
        await expect(page.getByTestId("import-would-create")).toContainText("IT Ops");
        await expect(page.getByTestId("import-would-create-custom-fields")).toContainText("Assignment group");
        await expect(page.getByTestId("import-create-missing-references")).toBeChecked();

        // Bad rows block the import until the user chooses to skip them, and
        // that choice re-runs the check so the two cannot describe different runs.
        await expect(page.getByTestId("import-commit")).toBeDisabled();
        await page.getByTestId("import-skip-invalid").check();
        await expect(page.getByTestId("import-commit")).toBeEnabled();
        await page.getByTestId("import-commit").click();

        // QUEUED is a running state: the wizard must poll through it.
        await expect(page.getByTestId("import-job-status")).toContainText(/Queued/i);
        expect(stubs.commits.at(-1)?.options).toEqual({
            skipInvalidRows: true,
            createMissingReferences: true,
            customFieldColumns: [4],
            valueMappings: { assetType: { Laptop: "HARDWARE", Sundry: "__IGNORE__" } },
        });

        const outcome = page.getByTestId("import-outcome");
        await expect(outcome).toBeVisible({ timeout: 30_000 });
        // The server's own verdict, not one derived from the counts.
        await expect(outcome).toHaveAttribute("data-verdict", "PARTIAL");
        await expect(page.getByTestId("import-verdict")).toHaveAttribute("data-tone", "warn");
        await expect(page.getByTestId("import-result-total")).toHaveText("3");
        await expect(page.getByTestId("import-result-imported")).toHaveText("2");
        await expect(page.getByTestId("import-result-updated")).toHaveText("0");
        await expect(page.getByTestId("import-result-skipped")).toHaveText("1");
        // An early stop is its own line, not another failed row.
        await expect(page.getByTestId("import-stopped-reason")).toContainText("stopped early");
        await expect(page.getByTestId("import-failed-rows")).toContainText("1 row was not imported");
        await expect(page.getByTestId("import-failed-rows")).not.toContainText("Row 0");
        await expect(page.getByTestId("import-created")).toContainText("IT Ops");
        await expect(page.getByTestId("import-created-custom-fields")).toContainText("Assignment group");
    });

    test("refuses a file it cannot read and never uploads it", async ({ page }) => {
        const stubs = await stubImportsApi(page);
        await page.goto("/assets");
        await page.getByRole("button", { name: /^Import$/ }).click();
        await page.getByTestId("import-start-continue").click();

        await page.getByTestId("import-file-input").setInputFiles({
            name: "legacy.xls",
            mimeType: "application/vnd.ms-excel",
            buffer: Buffer.from("not really an xls"),
        });

        await expect(page.getByRole("alert").filter({ hasText: /Save As/ })).toBeVisible();
        await expect(page.getByTestId("import-analyse")).toBeDisabled();
        expect(stubs.previews).toHaveLength(0);
    });

    test("offers a template to download before any file is chosen", async ({ page }) => {
        await stubImportsApi(page);
        await page.goto("/assets");
        await page.getByRole("button", { name: /^Import$/ }).click();

        const download = page.waitForEvent("download", { timeout: 30_000 });
        await page.getByRole("button", { name: /CSV \(\.csv\)/ }).click();
        expect((await download).suggestedFilename()).toBe("assets-import-template.csv");
    });
});
