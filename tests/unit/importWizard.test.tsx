import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AssetsPage from "@/app/assets/page";
import SuppliersPage from "@/app/suppliers/page";

/**
 * The import wizard, rendered through the asset register and driven the way a
 * user drives it.
 *
 * The whole point of this feature is a spreadsheet that is somebody else's —
 * their headings, their column order, and their words inside the cells. So the
 * fixtures below are a ServiceNow-shaped export: a suggested mapping that is
 * right about some columns, wrong about one and silent about a required one; a
 * column AssetIQ has no field for; and an "Asset type" column that says
 * "Laptop" where our enum says HARDWARE.
 *
 * Four defects reached a customer through exactly the gap these tests cover,
 * and none of them is visible to a payload test: blank counters on the check
 * step, a green tick over "imported 0 rows", counts that contradicted the error
 * list below them, and a check that passed every row before an import that
 * failed on an enum value. Each one is a property of the rendered wizard.
 */

const imports = vi.hoisted(() => ({
    listTypes: vi.fn(),
    listFields: vi.fn(),
    downloadTemplate: vi.fn(),
    analyse: vi.fn(),
    preview: vi.fn(),
    commit: vi.fn(),
    listMappings: vi.fn(),
    saveMapping: vi.fn(),
    deleteMapping: vi.fn(),
}));
vi.mock("@/services/importService", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/services/importService")>();
    return { ...actual, importService: imports };
});

const importJobs = vi.hoisted(() => ({ getJobDetails: vi.fn(), importAssets: vi.fn() }));
vi.mock("@/services/importJobService", () => ({ importJobService: importJobs }));

// The asset register's own data. None of it matters here beyond letting the
// page render, so every list is empty.
vi.mock("@/services/assetService", () => ({
    assetService: {
        getPaged: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0, totalPages: 0 }),
        getStats: vi.fn().mockResolvedValue({ total: 0, assigned: 0, complete: true, missingRates: [] }),
        getAll: vi.fn().mockResolvedValue([]),
        get: vi.fn(),
        delete: vi.fn(),
    },
}));
const emptyList = vi.hoisted(() => () => ({ getAll: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/departmentService", () => ({ departmentService: emptyList() }));
vi.mock("@/services/organisationService", () => ({ organisationService: emptyList() }));
vi.mock("@/services/categoryService", () => ({ categoryService: emptyList() }));
vi.mock("@/services/locationService", () => ({ locationService: emptyList() }));
vi.mock("@/services/supplierService", () => ({ supplierService: emptyList() }));
vi.mock("@/services/purchaseOrderService", () => ({ purchaseOrderService: emptyList() }));
vi.mock("@/services/userService", () => ({ userService: emptyList() }));
vi.mock("@/services/bulkOperationService", () => ({ bulkOperationService: { exportSuppliers: vi.fn() } }));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/contexts/PermissionContext", () => ({
    usePermissions: () => ({ hasPermission: () => true, loading: false }),
}));
vi.mock("@/contexts/CurrencyContext", () => ({
    useCurrency: () => ({
        baseCurrency: "USD",
        availableCurrencies: ["USD"],
        format: (amount: number, currency = "USD") => `${currency} ${amount}`,
        sum: () => ({ total: 0, currency: "USD", complete: true, missingRates: [] }),
    }),
}));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.success = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIELDS = [
    { name: "name", label: "Asset name", required: true, dataType: "STRING", example: "Dell Latitude 5540" },
    { name: "assetTag", label: "Asset tag", required: true, dataType: "STRING" },
    { name: "serialNumber", label: "Serial number", required: false, dataType: "STRING" },
    { name: "purchaseCost", label: "Purchase cost", required: false, dataType: "DECIMAL" },
    { name: "assetType", label: "Asset type", required: false, dataType: "ENUM" },
];

/** A ServiceNow-style export: none of these headings are ours. */
const COLUMNS = [
    { index: 0, name: "Display Name", sampleValues: ["Latitude 5540", "ThinkPad X1"] },
    { index: 1, name: "Asset ID", sampleValues: ["AST-0001", "AST-0002"] },
    { index: 2, name: "Serial", sampleValues: ["5CG1234", "PF0ABCD"] },
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
    // An enum field no column feeds. It must render as "nothing to match", not
    // as an empty dropdown the user is expected to do something with.
    { field: "status", label: "Status", column: null, header: null, allowedValues: ["ACTIVE", "RETIRED"], values: [] },
];

const COLUMN_PLAN = [
    { index: 0, header: "Display Name", action: "FIELD" as const, field: "name", canBeCustomField: false },
    { index: 1, header: "Asset ID", action: "IGNORE" as const, canBeCustomField: true },
    { index: 2, header: "Serial", action: "FIELD" as const, field: "serialNumber", canBeCustomField: false },
    { index: 3, header: "Cost (USD)", action: "FIELD" as const, field: "purchaseCost", canBeCustomField: false },
    {
        index: 4,
        header: "Assignment group",
        action: "IGNORE" as const,
        customFieldName: "Assignment group",
        inferredType: "TEXT",
        canBeCustomField: true,
    },
    { index: 5, header: "Type", action: "FIELD" as const, field: "assetType", canBeCustomField: false },
];

const ANALYSIS = {
    uploadId: "upload-9",
    detectedColumns: COLUMNS,
    // Right about the name, the cost and the type; wrong about the serial (it
    // picked the asset id); silent about the required asset tag.
    suggestedMapping: { name: 0, assetTag: null, serialNumber: 1, purchaseCost: 3, assetType: 5 },
    rowCount: 3,
    enumFields: ENUM_FIELDS,
    columnPlan: COLUMN_PLAN,
    customFieldsAvailable: true,
    createMissingReferencesDefault: true,
};

/** The check response for a file that is fine apart from one unreadable cost. */
const PARTIAL_PREVIEW = {
    totals: { valid: 2, invalid: 1, total: 3 },
    errors: [{ row: 4, message: "must be a number", field: "purchaseCost", column: "Cost (USD)" }],
    notes: [{ row: 3, message: "We left this blank — no match for it", field: "assetType", column: "Type", value: "Sundry" }],
    rowsChecked: 3,
    totalRowsInFile: 3,
    outcome: "PARTIAL",
    fatalError: null,
    wouldCreate: { department: ["Finance", "IT Ops"] },
    wouldCreateCustomFields: [],
};

const spreadsheet = () =>
    new File(["display name,asset id\n"], "servicenow-export.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

function renderAssetsPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <AssetsPage />
        </QueryClientProvider>,
    );
}

/** Opens the wizard from the register and gets as far as the mapping step. */
async function openMappingStep() {
    renderAssetsPage();
    fireEvent.click(await screen.findByRole("button", { name: /^Import$/ }));
    fireEvent.click(await screen.findByTestId("import-start-continue"));
    fireEvent.change(await screen.findByTestId("import-file-input"), { target: { files: [spreadsheet()] } });
    fireEvent.click(screen.getByTestId("import-analyse"));
    await screen.findByTestId("import-field-list");
}

/** Fills the required field the analyser had no suggestion for. */
function fillRequiredField() {
    fireEvent.change(select("assetTag"), { target: { value: "1" } });
}

const select = (field: string) => screen.getByTestId(`import-map-${field}`) as HTMLSelectElement;
const columnSelect = (index: number) => screen.getByTestId(`import-column-${index}`) as HTMLSelectElement;
const valueSelect = (field: string, value: string) =>
    screen.getByTestId(`import-value-${field}-${value}`) as HTMLSelectElement;

afterEach(cleanup);
beforeEach(() => {
    for (const fn of Object.values(imports)) fn.mockReset();
    importJobs.getJobDetails.mockReset();
    toastFns.mockClear();
    toastFns.error.mockClear();
    toastFns.success.mockClear();

    imports.listTypes.mockResolvedValue([{ type: "assets", label: "Assets", description: "Your asset register." }]);
    imports.listFields.mockResolvedValue(FIELDS);
    imports.listMappings.mockResolvedValue([]);
    imports.analyse.mockResolvedValue(ANALYSIS);
});

describe("import wizard — matching their words to ours", () => {
    it("offers a dropdown per value, pre-selected to what the server suggested, and sends the user's choices", async () => {
        imports.preview.mockResolvedValue(PARTIAL_PREVIEW);
        imports.commit.mockResolvedValue({ jobId: "job-1", status: "QUEUED" });
        importJobs.getJobDetails.mockResolvedValue({ jobId: "job-1", status: "QUEUED" });

        await openMappingStep();
        fillRequiredField();
        // The matching step now leads to values, not straight to the check.
        fireEvent.click(screen.getByTestId("import-to-preview"));
        await screen.findByTestId("import-value-fields");
        expect(imports.preview).not.toHaveBeenCalled();

        // "Laptop" is already HARDWARE — the thing the user asked for. "Sundry"
        // had no suggestion, so it is blank rather than guessed at.
        expect(valueSelect("assetType", "laptop").value).toBe("HARDWARE");
        expect(valueSelect("assetType", "sundry").value).toBe("");
        // The dropdown says which value of which field it is for.
        expect(
            screen.getByLabelText(/What does Laptop mean for Asset type\?/i),
        ).toBe(valueSelect("assetType", "laptop"));
        // How many rows a choice affects is on screen next to it.
        expect(screen.getByTestId("import-values-assetType").textContent).toMatch(/2 rows/);
        expect(screen.getByTestId("import-values-assetType-undecided").textContent).toMatch(/1 not matched yet/);
        // An enum field nothing feeds is named as such, not left as an empty form.
        expect(screen.getByTestId("import-values-unmapped").textContent).toMatch(/Status/);

        // The user decides the value we could not read should be left out.
        fireEvent.change(valueSelect("assetType", "sundry"), { target: { value: "__IGNORE__" } });
        fireEvent.click(screen.getByTestId("import-values-continue"));
        await screen.findByTestId("import-preview-counts");

        expect(imports.preview).toHaveBeenCalledWith("assets", {
            uploadId: "upload-9",
            mapping: { name: 0, assetTag: 1, serialNumber: 1, purchaseCost: 3, assetType: 5 },
            options: {
                skipInvalidRows: false,
                createMissingReferences: true,
                customFieldColumns: [],
                valueMappings: { assetType: { Laptop: "HARDWARE", Sundry: "__IGNORE__" } },
            },
        });

        // Commit is sent the identical body — that identity is why the check and
        // the import cannot disagree.
        fireEvent.click(screen.getByTestId("import-skip-invalid"));
        await waitFor(() => expect(imports.preview).toHaveBeenCalledTimes(2));
        await waitFor(() => expect((screen.getByTestId("import-commit") as HTMLButtonElement).disabled).toBe(false));
        fireEvent.click(screen.getByTestId("import-commit"));
        await screen.findByTestId("import-running");

        expect(imports.commit).toHaveBeenCalledWith("assets", {
            uploadId: "upload-9",
            mapping: { name: 0, assetTag: 1, serialNumber: 1, purchaseCost: 3, assetType: 5 },
            options: {
                skipInvalidRows: true,
                createMissingReferences: true,
                customFieldColumns: [],
                valueMappings: { assetType: { Laptop: "HARDWARE", Sundry: "__IGNORE__" } },
            },
        });
    }, 25_000);

    it("skips the value step entirely when the file has no values to decide about", async () => {
        imports.analyse.mockResolvedValue({ ...ANALYSIS, enumFields: [] });
        imports.preview.mockResolvedValue(PARTIAL_PREVIEW);

        await openMappingStep();
        fillRequiredField();
        expect(screen.getByTestId("import-to-preview").textContent).toMatch(/Check my rows/);
        fireEvent.click(screen.getByTestId("import-to-preview"));

        await screen.findByTestId("import-preview-counts");
        expect(screen.queryByTestId("import-value-fields")).toBeNull();
        expect(imports.preview.mock.calls[0][1].options.valueMappings).toEqual({});
    }, 25_000);
});

describe("import wizard — what happens to their columns", () => {
    it("keeps a column AssetIQ has no field for as a custom field, and says so before committing", async () => {
        imports.preview.mockResolvedValue({ ...PARTIAL_PREVIEW, wouldCreateCustomFields: ["Assignment group"] });

        await openMappingStep();
        fillRequiredField();

        // The column nothing reads is a choice, not a silent drop.
        expect(columnSelect(4).value).toBe("__ignore__");
        fireEvent.change(columnSelect(4), { target: { value: "__custom_field__" } });
        await waitFor(() =>
            expect(screen.getByTestId("import-custom-fields-planned").textContent).toMatch(/Assignment group/),
        );

        fireEvent.click(screen.getByTestId("import-to-preview"));
        fireEvent.click(await screen.findByTestId("import-values-continue"));
        await screen.findByTestId("import-preview-counts");

        expect(imports.preview.mock.calls[0][1].options.customFieldColumns).toEqual([4]);
        expect(screen.getByTestId("import-would-create-custom-fields").textContent).toMatch(/Assignment group/);
    }, 25_000);

    it("offers only ignore when the tenant cannot have custom fields, and says why", async () => {
        imports.analyse.mockResolvedValue({
            ...ANALYSIS,
            customFieldsAvailable: false,
            customFieldsUnavailableReason: "Custom fields are not part of your plan.",
            columnPlan: COLUMN_PLAN.map((plan) => (plan.index === 4 ? { ...plan, action: "CUSTOM_FIELD" as const } : plan)),
        });

        await openMappingStep();

        const options = within(columnSelect(4)).getAllByRole("option").map((option) => option.textContent ?? "");
        expect(options.some((label) => /custom field/i.test(label))).toBe(false);
        expect(options[0]).toMatch(/Ignore this column/);
        expect(screen.getByTestId("import-custom-fields-unavailable").textContent).toMatch(/not part of your plan/);
        // And the analyser's own CUSTOM_FIELD proposal is not honoured either.
        expect(columnSelect(4).value).toBe("__ignore__");
    }, 25_000);

    it("moves a column between a field and a custom field rather than letting it be both", async () => {
        imports.preview.mockResolvedValue(PARTIAL_PREVIEW);

        await openMappingStep();
        fillRequiredField();
        fireEvent.change(columnSelect(4), { target: { value: "__custom_field__" } });
        await waitFor(() => expect(columnSelect(4).value).toBe("__custom_field__"));

        // Point a field at the same column from the field list: it stops being a custom field.
        fireEvent.change(select("serialNumber"), { target: { value: "4" } });
        await waitFor(() => expect(columnSelect(4).value).toBe("serialNumber"));
        expect(screen.queryByTestId("import-custom-fields-planned")).toBeNull();
    }, 25_000);
});

describe("import wizard — the check step", () => {
    it("renders the counts the server sent and keeps notes apart from errors", async () => {
        imports.preview.mockResolvedValue(PARTIAL_PREVIEW);

        await openMappingStep();
        fillRequiredField();
        fireEvent.click(screen.getByTestId("import-to-preview"));
        fireEvent.click(await screen.findByTestId("import-values-continue"));
        await screen.findByTestId("import-preview-counts");

        // The boxes that shipped blank.
        expect(screen.getByTestId("import-preview-total").textContent).toBe("3");
        expect(screen.getByTestId("import-preview-valid").textContent).toBe("2");
        expect(screen.getByTestId("import-preview-invalid").textContent).toBe("1");

        // The verdict is the server's word, and PARTIAL is never "every row passed".
        const verdict = screen.getByTestId("import-preview-verdict");
        expect(verdict.getAttribute("data-outcome")).toBe("PARTIAL");
        expect(verdict.textContent).not.toMatch(/Every row passed/i);
        expect(verdict.textContent).toMatch(/2 of 3 rows are ready/);

        // An error blocks its row; a note does not, and they are not in one list.
        const errors = within(screen.getByTestId("import-preview-errors"));
        expect(errors.getByText("Row 4")).toBeTruthy();
        expect(errors.getByText("Cost (USD)")).toBeTruthy();
        const notes = within(screen.getByTestId("import-preview-notes"));
        expect(notes.getByText("Row 3")).toBeTruthy();
        expect(notes.getByText(/left this blank/)).toBeTruthy();
        expect(screen.getByTestId("import-preview-errors").textContent).not.toMatch(/left this blank/);

        // Records this import would create in the user's tenant are named first.
        expect(screen.getByTestId("import-would-create").textContent).toMatch(/Finance, IT Ops/);
        expect((screen.getByTestId("import-create-missing-references") as HTMLInputElement).checked).toBe(true);
    }, 25_000);

    it("says every row passed only when the server says so", async () => {
        imports.preview.mockResolvedValue({
            totals: { valid: 3, invalid: 0, total: 3 },
            errors: [],
            notes: [],
            rowsChecked: 3,
            totalRowsInFile: 3,
            outcome: "SUCCESS",
            wouldCreate: {},
            wouldCreateCustomFields: [],
        });

        await openMappingStep();
        fillRequiredField();
        fireEvent.click(screen.getByTestId("import-to-preview"));
        fireEvent.click(await screen.findByTestId("import-values-continue"));

        const verdict = await screen.findByTestId("import-preview-verdict");
        expect(verdict.getAttribute("data-outcome")).toBe("SUCCESS");
        expect(verdict.textContent).toMatch(/Every row passed/);
        expect(screen.getByTestId("import-would-create-nothing")).toBeTruthy();
    }, 25_000);

    it("refuses to offer an import when the server found nothing to import", async () => {
        imports.preview.mockResolvedValue({
            totals: { valid: 0, invalid: 0, total: 0 },
            errors: [],
            notes: [],
            rowsChecked: 0,
            totalRowsInFile: 0,
            outcome: "NOTHING_TO_IMPORT",
            wouldCreate: {},
            wouldCreateCustomFields: [],
        });

        await openMappingStep();
        fillRequiredField();
        fireEvent.click(screen.getByTestId("import-to-preview"));
        fireEvent.click(await screen.findByTestId("import-values-continue"));

        const verdict = await screen.findByTestId("import-preview-verdict");
        expect(verdict.getAttribute("data-outcome")).toBe("NOTHING_TO_IMPORT");
        expect(verdict.getAttribute("data-tone")).toBe("danger");
        expect((screen.getByTestId("import-commit") as HTMLButtonElement).disabled).toBe(true);
    }, 25_000);

    it("re-checks when an option changes, so the check always describes the run about to happen", async () => {
        imports.preview.mockResolvedValue(PARTIAL_PREVIEW);

        await openMappingStep();
        fillRequiredField();
        fireEvent.click(screen.getByTestId("import-to-preview"));
        fireEvent.click(await screen.findByTestId("import-values-continue"));
        await screen.findByTestId("import-preview-counts");

        fireEvent.click(screen.getByTestId("import-create-missing-references"));
        await waitFor(() => expect(imports.preview).toHaveBeenCalledTimes(2));
        expect(imports.preview.mock.calls[1][1].options.createMissingReferences).toBe(false);
    }, 25_000);

    it("shows a whole-file problem as one message instead of a row that failed", async () => {
        imports.preview.mockResolvedValue({
            totals: { valid: 0, invalid: 0, total: 0 },
            errors: [],
            notes: [],
            rowsChecked: 0,
            totalRowsInFile: 12,
            outcome: "FAILED",
            fatalError: "Asset tag is required but no column feeds it.",
            wouldCreate: {},
            wouldCreateCustomFields: [],
        });

        await openMappingStep();
        fillRequiredField();
        fireEvent.click(screen.getByTestId("import-to-preview"));
        fireEvent.click(await screen.findByTestId("import-values-continue"));

        const fatal = await screen.findByTestId("import-preview-fatal");
        expect(fatal.textContent).toMatch(/no column feeds it/);
        expect(screen.queryByTestId("import-preview-errors")).toBeNull();
        expect((screen.getByTestId("import-commit") as HTMLButtonElement).disabled).toBe(true);
    }, 25_000);
});

describe("import wizard — the result screen", () => {
    /** Walks a job to its finished state and hands back the outcome panel. */
    async function runToResult(result: Record<string, unknown>, status = "COMPLETED") {
        imports.preview.mockResolvedValue(PARTIAL_PREVIEW);
        imports.commit.mockResolvedValue({ jobId: "job-x", status: "QUEUED" });
        importJobs.getJobDetails.mockResolvedValue({ jobId: "job-x", status, result });

        await openMappingStep();
        fillRequiredField();
        fireEvent.click(screen.getByTestId("import-to-preview"));
        fireEvent.click(await screen.findByTestId("import-values-continue"));
        await screen.findByTestId("import-preview-counts");
        fireEvent.click(screen.getByTestId("import-skip-invalid"));
        await waitFor(() => expect((screen.getByTestId("import-commit") as HTMLButtonElement).disabled).toBe(false));
        fireEvent.click(screen.getByTestId("import-commit"));
        return screen.findByTestId("import-outcome", {}, { timeout: 8000 });
    }

    it("reports a partial import as partial, with every count the server sent adding up", async () => {
        const outcome = await runToResult({
            totalRows: 3,
            imported: 2,
            updated: 0,
            skipped: 1,
            failed: 1,
            duplicatesSkipped: 0,
            outcome: "PARTIAL",
            errors: [{ row: 4, message: "must be a number", field: "purchaseCost", column: "Cost (USD)" }],
            notes: [{ row: 3, message: "Left Asset type blank", field: "assetType", column: "Type", value: "Sundry" }],
            createdReferences: { department: ["Finance"] },
            createdCustomFields: ["Assignment group"],
        });

        expect(outcome.getAttribute("data-verdict")).toBe("PARTIAL");
        expect(screen.getByTestId("import-verdict").getAttribute("data-tone")).toBe("warn");

        // totalRows === imported + updated + skipped, on screen.
        const total = Number(screen.getByTestId("import-result-total").textContent);
        const added = Number(screen.getByTestId("import-result-imported").textContent);
        const updated = Number(screen.getByTestId("import-result-updated").textContent);
        const skipped = Number(screen.getByTestId("import-result-skipped").textContent);
        expect(added + updated + skipped).toBe(total);

        // errors.length === failed, on screen: one row listed, one row skipped for a problem.
        expect(screen.getByTestId("import-failed-rows").textContent).toMatch(/1 row was not imported/);
        expect(screen.getByTestId("import-skipped-breakdown").textContent).toMatch(/1 had problems/);
        // No phantom row 0 anywhere in the list.
        expect(screen.getByTestId("import-failed-rows").textContent).not.toMatch(/Row 0/);

        // Notes are their own list, and what was created is reported as fact.
        expect(screen.getByTestId("import-notes").textContent).toMatch(/Left Asset type blank/);
        expect(screen.getByTestId("import-created").textContent).toMatch(/Finance/);
        expect(screen.getByTestId("import-created-custom-fields").textContent).toMatch(/Assignment group/);
        expect(toastFns.success).not.toHaveBeenCalled();
    }, 25_000);

    it("never puts a success over an import that wrote nothing", async () => {
        const outcome = await runToResult({
            totalRows: 0,
            imported: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            outcome: "NOTHING_TO_IMPORT",
            errors: [],
            notes: [],
        });

        expect(outcome.getAttribute("data-verdict")).toBe("NOTHING_TO_IMPORT");
        expect(screen.getByTestId("import-verdict").getAttribute("data-tone")).toBe("danger");
        expect(screen.getByTestId("import-summary").textContent).toMatch(/nothing was saved/i);
        expect(screen.queryByTestId("import-failed-rows")).toBeNull();
        expect(toastFns.success).not.toHaveBeenCalled();
        expect(toastFns.error).toHaveBeenCalledWith(expect.stringContaining("Nothing was imported"), expect.anything());
    }, 25_000);

    it("renders an early stop as its own line, not as another failed row", async () => {
        await runToResult({
            totalRows: 2,
            imported: 1,
            updated: 0,
            skipped: 1,
            failed: 1,
            outcome: "PARTIAL",
            stoppedEarly: true,
            stoppedReason: "Row 5 failed and 'skip invalid rows' was off, so we stopped there.",
            errors: [{ row: 5, message: "Asset tag is required", field: "assetTag", column: "Asset ID" }],
            notes: [],
        });

        const stopped = screen.getByTestId("import-stopped-reason");
        expect(stopped.textContent).toMatch(/stopped early/i);
        expect(stopped.textContent).toMatch(/skip invalid rows/);
        // One row failed, so exactly one row is listed — the stop is not a second one.
        expect(screen.getByTestId("import-failed-rows").textContent).toMatch(/1 row was not imported/);
        expect(within(screen.getByTestId("import-failed-rows")).getAllByRole("listitem")).toHaveLength(1);
    }, 25_000);

    it("does not claim success for a completed job that reported no verdict", async () => {
        const outcome = await runToResult({ totalRows: 1, imported: 1, updated: 0, skipped: 0, errors: [] });

        expect(outcome.getAttribute("data-verdict")).toBe("UNKNOWN");
        expect(screen.getByTestId("import-verdict").getAttribute("data-tone")).toBe("danger");
        expect(toastFns.success).not.toHaveBeenCalled();
    }, 25_000);
});

describe("import wizard — the rest of the journey", () => {
    it("stops a required field with no column, and posts the mapping the user ended up with", async () => {
        imports.preview.mockResolvedValue(PARTIAL_PREVIEW);

        await openMappingStep();
        expect(imports.analyse).toHaveBeenCalledWith("assets", expect.any(File));

        // The analyser's suggestion is pre-filled, headings and all.
        expect(select("name").value).toBe("0");
        expect(select("serialNumber").value).toBe("1");
        expect(select("assetTag").value).toBe("");
        expect(
            within(select("name")).getAllByRole("option", { name: /Display Name — e\.g\. Latitude 5540/ }),
        ).toHaveLength(1);

        // A required field with no column is called out and stops the user.
        expect(screen.getByTestId("import-missing-required").textContent).toMatch(/Asset tag/);
        fireEvent.click(screen.getByTestId("import-to-preview"));
        expect(screen.queryByTestId("import-value-fields")).toBeNull();
        expect(toastFns.error).toHaveBeenCalledWith(expect.stringContaining("Asset tag"));

        // The user fixes the wrong guess and fills the gap.
        fireEvent.change(select("serialNumber"), { target: { value: "2" } });
        fireEvent.change(select("assetTag"), { target: { value: "1" } });
        await waitFor(() => expect(screen.queryByTestId("import-missing-required")).toBeNull());

        fireEvent.click(screen.getByTestId("import-to-preview"));
        fireEvent.click(await screen.findByTestId("import-values-continue"));
        await screen.findByTestId("import-preview-counts");
        expect(imports.preview.mock.calls[0][1].mapping).toEqual({
            name: 0,
            assetTag: 1,
            serialNumber: 2,
            purchaseCost: 3,
            assetType: 5,
        });
    }, 25_000);

    it("keeps polling a job that is still queued rather than reporting it finished", async () => {
        imports.preview.mockResolvedValue(PARTIAL_PREVIEW);
        imports.commit.mockResolvedValue({ jobId: "job-2", status: "QUEUED" });
        importJobs.getJobDetails.mockResolvedValue({ jobId: "job-2", status: "QUEUED" });

        await openMappingStep();
        fillRequiredField();
        fireEvent.click(screen.getByTestId("import-to-preview"));
        fireEvent.click(await screen.findByTestId("import-values-continue"));
        await screen.findByTestId("import-preview-counts");
        fireEvent.click(screen.getByTestId("import-skip-invalid"));
        await waitFor(() => expect((screen.getByTestId("import-commit") as HTMLButtonElement).disabled).toBe(false));
        fireEvent.click(screen.getByTestId("import-commit"));

        await screen.findByTestId("import-running");
        expect(screen.getByTestId("import-job-status").textContent).toMatch(/Queued/i);
        await waitFor(() => expect(importJobs.getJobDetails.mock.calls.length).toBeGreaterThanOrEqual(2), {
            timeout: 4000,
        });
        expect(screen.queryByTestId("import-outcome")).toBeNull();
        expect(toastFns.success).not.toHaveBeenCalled();
    }, 25_000);

    it("reports a cancelled job as cancelled", async () => {
        imports.preview.mockResolvedValue(PARTIAL_PREVIEW);
        imports.commit.mockResolvedValue({ jobId: "job-3", status: "QUEUED" });
        importJobs.getJobDetails.mockResolvedValue({ jobId: "job-3", status: "CANCELLED" });

        await openMappingStep();
        fillRequiredField();
        fireEvent.click(screen.getByTestId("import-to-preview"));
        fireEvent.click(await screen.findByTestId("import-values-continue"));
        await screen.findByTestId("import-preview-counts");
        fireEvent.click(screen.getByTestId("import-skip-invalid"));
        await waitFor(() => expect((screen.getByTestId("import-commit") as HTMLButtonElement).disabled).toBe(false));
        fireEvent.click(screen.getByTestId("import-commit"));

        const outcome = await screen.findByTestId("import-outcome", {}, { timeout: 8000 });
        expect(outcome.getAttribute("data-verdict")).toBe("CANCELLED");
        expect(screen.getByTestId("import-summary").textContent).toMatch(/cancelled/i);
        expect(toastFns.success).not.toHaveBeenCalled();
    }, 25_000);

    it("applies a saved mapping and saves a new one under its name", async () => {
        imports.listMappings.mockResolvedValue([
            { id: "map-1", name: "ServiceNow export", mapping: { name: 0, assetTag: 1, serialNumber: 2 } },
        ]);
        imports.saveMapping.mockResolvedValue({ id: "map-2", name: "My sheet", mapping: {} });

        await openMappingStep();
        fireEvent.change(await screen.findByTestId("import-saved-mapping"), { target: { value: "map-1" } });
        await waitFor(() => expect(select("assetTag").value).toBe("1"));
        expect(select("serialNumber").value).toBe("2");
        // A field the saved mapping does not mention is cleared, not left stale.
        expect(select("purchaseCost").value).toBe("");

        fireEvent.change(screen.getByTestId("import-mapping-name"), { target: { value: "My sheet" } });
        fireEvent.click(screen.getByTestId("import-save-mapping"));
        await waitFor(() =>
            expect(imports.saveMapping).toHaveBeenCalledWith("assets", "My sheet", {
                name: 0,
                assetTag: 1,
                serialNumber: 2,
                purchaseCost: null,
                assetType: null,
            }),
        );
    }, 25_000);

    it("refuses a file the backend could not read and says what to do instead", async () => {
        renderAssetsPage();
        fireEvent.click(await screen.findByRole("button", { name: /^Import$/ }));
        fireEvent.click(await screen.findByTestId("import-start-continue"));

        const input = await screen.findByTestId("import-file-input");
        fireEvent.change(input, { target: { files: [new File(["x"], "legacy.xls", { type: "application/vnd.ms-excel" })] } });

        expect(screen.getByRole("alert").textContent).toMatch(/Save As/);
        expect((screen.getByTestId("import-analyse") as HTMLButtonElement).disabled).toBe(true);
        expect(imports.analyse).not.toHaveBeenCalled();
    });

    it("surfaces an analyser failure instead of moving on", async () => {
        imports.analyse.mockRejectedValue(new Error("We could not find a header row"));

        renderAssetsPage();
        fireEvent.click(await screen.findByRole("button", { name: /^Import$/ }));
        fireEvent.click(await screen.findByTestId("import-start-continue"));
        fireEvent.change(await screen.findByTestId("import-file-input"), { target: { files: [spreadsheet()] } });
        fireEvent.click(screen.getByTestId("import-analyse"));

        await waitFor(() =>
            expect(toastFns.error).toHaveBeenCalledWith("We could not find a header row", expect.anything()),
        );
        expect(screen.queryByTestId("import-field-list")).toBeNull();
        expect(screen.getByRole("alert").textContent).toMatch(/could not find a header row/);
    });

    it("is the same wizard on another module, scoped to that module's fields", async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <SuppliersPage />
            </QueryClientProvider>,
        );

        fireEvent.click(await screen.findByTestId("import-open-suppliers"));
        expect(await screen.findByRole("heading", { name: /Import suppliers/i })).toBeTruthy();
        await waitFor(() => expect(imports.listFields).toHaveBeenCalledWith("suppliers"));
        expect(imports.listFields).not.toHaveBeenCalledWith("assets");
    });

    it("downloads the template in the format the user asked for", async () => {
        imports.downloadTemplate.mockResolvedValue("assets-import-template.csv");

        renderAssetsPage();
        fireEvent.click(await screen.findByRole("button", { name: /^Import$/ }));
        fireEvent.click(await screen.findByRole("button", { name: /CSV \(\.csv\)/ }));

        await waitFor(() => expect(imports.downloadTemplate).toHaveBeenCalledWith("assets", "csv"));
        await waitFor(() =>
            expect(toastFns.success).toHaveBeenCalledWith("Saved assets-import-template.csv", expect.anything()),
        );
    });
});
