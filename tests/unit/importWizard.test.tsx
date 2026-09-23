import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AssetsPage from "@/app/assets/page";
import SuppliersPage from "@/app/suppliers/page";

/**
 * The import wizard, rendered through the asset register and driven the way a
 * user drives it.
 *
 * The whole point of this feature is a spreadsheet whose headings are somebody
 * else's — so the fixtures below are a ServiceNow-shaped export, with a
 * suggested mapping that is right about some columns, wrong about one, and
 * silent about a required one. None of that is visible to a payload test:
 * whether the wrong suggestion can be corrected, whether a missing required
 * field actually stops the user, and whether the mapping the user ended up
 * with is the mapping that gets posted, are all properties of the rendered
 * wizard. Two features shipped broken this week through exactly that gap.
 *
 * The job polling case ends on a job that starts QUEUED: a previous version of
 * this screen stopped polling on that status and every queued import looked
 * like it had hung forever.
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
vi.mock("@/services/importService", () => ({ importService: imports }));

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
];

/** A ServiceNow-style export: none of these headings are ours. */
const COLUMNS = [
    { index: 0, name: "Display Name", sampleValues: ["Latitude 5540", "ThinkPad X1"] },
    { index: 1, name: "Asset ID", sampleValues: ["AST-0001", "AST-0002"] },
    { index: 2, name: "Serial", sampleValues: ["5CG1234", "PF0ABCD"] },
    { index: 3, name: "Cost (USD)", sampleValues: ["1200", "not-a-number"] },
    { index: 4, name: "Assignment group", sampleValues: ["IT Ops"] },
];

const ANALYSIS = {
    uploadId: "upload-9",
    detectedColumns: COLUMNS,
    // Right about the name and the cost, wrong about the serial (it picked the
    // asset id), and silent about the required asset tag.
    suggestedMapping: { name: 0, assetTag: null, serialNumber: 1, purchaseCost: 3 },
    rowCount: 3,
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

const select = (field: string) => screen.getByTestId(`import-map-${field}`) as HTMLSelectElement;

afterEach(cleanup);
beforeEach(() => {
    for (const fn of Object.values(imports)) fn.mockReset();
    importJobs.getJobDetails.mockReset();
    toastFns.error.mockClear();
    toastFns.success.mockClear();

    imports.listTypes.mockResolvedValue([{ type: "assets", label: "Assets", description: "Your asset register." }]);
    imports.listFields.mockResolvedValue(FIELDS);
    imports.listMappings.mockResolvedValue([]);
    imports.analyse.mockResolvedValue(ANALYSIS);
});

describe("import wizard", () => {
    it("carries a foreign spreadsheet from upload to a finished job, posting the mapping the user ended up with", async () => {
        imports.preview.mockResolvedValue({
            total: 3,
            valid: 2,
            invalid: 1,
            rows: [{ rowNumber: 4, errors: [{ column: "Cost (USD)", message: "must be a number" }] }],
        });
        imports.commit.mockResolvedValue({ jobId: "job-1", status: "QUEUED" });
        importJobs.getJobDetails
            .mockResolvedValueOnce({ jobId: "job-1", status: "QUEUED" })
            .mockResolvedValueOnce({ jobId: "job-1", status: "PROCESSING" })
            .mockResolvedValue({
                jobId: "job-1",
                status: "COMPLETED",
                result: { totalRows: 3, imported: 2, skipped: 1, errors: [{ row: 4, message: "must be a number" }] },
            });

        await openMappingStep();
        expect(imports.analyse).toHaveBeenCalledWith("assets", expect.any(File));

        // The analyser's suggestion is pre-filled, headings and all.
        expect(select("name").value).toBe("0");
        expect(select("serialNumber").value).toBe("1");
        expect(select("purchaseCost").value).toBe("3");
        expect(select("assetTag").value).toBe("");
        // Each column is offered with a sample from their own file beside it.
        expect(
            within(select("name")).getAllByRole("option", { name: /Display Name — e\.g\. Latitude 5540/ }),
        ).toHaveLength(1);

        // A required field with no column is called out and stops the user.
        expect(screen.getByTestId("import-missing-required").textContent).toMatch(/Asset tag/);
        fireEvent.click(screen.getByTestId("import-to-preview"));
        expect(imports.preview).not.toHaveBeenCalled();
        expect(toastFns.error).toHaveBeenCalledWith(expect.stringContaining("Asset tag"));

        // Their columns that nothing reads are named.
        expect(screen.getByTestId("import-ignored-columns").textContent).toMatch(/Assignment group/);

        // The user fixes the wrong guess and fills the gap.
        fireEvent.change(select("serialNumber"), { target: { value: "2" } });
        fireEvent.change(select("assetTag"), { target: { value: "1" } });
        await waitFor(() => expect(screen.queryByTestId("import-missing-required")).toBeNull());

        fireEvent.click(screen.getByTestId("import-to-preview"));
        await screen.findByTestId("import-preview-counts");
        expect(imports.preview).toHaveBeenCalledWith("assets", {
            uploadId: "upload-9",
            mapping: { name: 0, assetTag: 1, serialNumber: 2, purchaseCost: 3 },
            options: { skipInvalidRows: false },
        });

        // Preview errors name the row and the column as *they* labelled it.
        expect(screen.getByTestId("import-preview-valid").textContent).toBe("2");
        expect(screen.getByTestId("import-preview-invalid").textContent).toBe("1");
        const errors = within(screen.getByTestId("import-preview-errors"));
        expect(errors.getByText("Row 4")).toBeTruthy();
        expect(errors.getByText("Cost (USD)")).toBeTruthy();
        expect(errors.getByText("must be a number")).toBeTruthy();

        // Bad rows block the import until the user says to skip them.
        expect((screen.getByTestId("import-commit") as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByTestId("import-preview-blocked")).toBeTruthy();
        fireEvent.click(screen.getByTestId("import-skip-invalid"));
        await waitFor(() => expect((screen.getByTestId("import-commit") as HTMLButtonElement).disabled).toBe(false));

        fireEvent.click(screen.getByTestId("import-commit"));
        await screen.findByTestId("import-running");
        expect(imports.commit).toHaveBeenCalledWith("assets", {
            uploadId: "upload-9",
            mapping: { name: 0, assetTag: 1, serialNumber: 2, purchaseCost: 3 },
            options: { skipInvalidRows: true },
        });

        // QUEUED is a running state — the wizard must keep polling through it.
        expect(screen.getByTestId("import-job-status").textContent).toMatch(/Queued/i);
        await waitFor(() => expect(importJobs.getJobDetails).toHaveBeenCalledWith("job-1"), { timeout: 4000 });

        const outcome = await screen.findByTestId("import-outcome", {}, { timeout: 6000 });
        expect(outcome.getAttribute("data-phase")).toBe("completed");
        expect(screen.getByTestId("import-result-imported").textContent).toBe("2");
        expect(screen.getByTestId("import-result-skipped").textContent).toBe("1");
        expect(screen.getByTestId("import-failed-rows").textContent).toMatch(/Row 4/);
        expect(toastFns.success).toHaveBeenCalledWith(expect.stringContaining("Imported 2"));
    }, 20_000);

    it("keeps polling a job that is still queued rather than reporting it finished", async () => {
        imports.preview.mockResolvedValue({ total: 1, valid: 1, invalid: 0, rows: [] });
        imports.commit.mockResolvedValue({ jobId: "job-2", status: "QUEUED" });
        importJobs.getJobDetails.mockResolvedValue({ jobId: "job-2", status: "QUEUED" });

        await openMappingStep();
        fireEvent.change(select("assetTag"), { target: { value: "1" } });
        fireEvent.click(screen.getByTestId("import-to-preview"));
        await screen.findByTestId("import-preview-clean");
        fireEvent.click(screen.getByTestId("import-commit"));

        await screen.findByTestId("import-running");
        await waitFor(() => expect(importJobs.getJobDetails.mock.calls.length).toBeGreaterThanOrEqual(2), {
            timeout: 4000,
        });
        // Still running, so no outcome and — above all — no success claim.
        expect(screen.queryByTestId("import-outcome")).toBeNull();
        expect(toastFns.success).not.toHaveBeenCalled();
    }, 20_000);

    it("reports a cancelled job as cancelled", async () => {
        imports.preview.mockResolvedValue({ total: 1, valid: 1, invalid: 0, rows: [] });
        imports.commit.mockResolvedValue({ jobId: "job-3", status: "QUEUED" });
        importJobs.getJobDetails.mockResolvedValue({ jobId: "job-3", status: "CANCELLED" });

        await openMappingStep();
        fireEvent.change(select("assetTag"), { target: { value: "1" } });
        fireEvent.click(screen.getByTestId("import-to-preview"));
        await screen.findByTestId("import-preview-clean");
        fireEvent.click(screen.getByTestId("import-commit"));

        const outcome = await screen.findByTestId("import-outcome", {}, { timeout: 6000 });
        expect(outcome.getAttribute("data-phase")).toBe("cancelled");
        expect(screen.getByTestId("import-summary").textContent).toMatch(/cancelled/i);
        expect(toastFns.success).not.toHaveBeenCalled();
        expect(toastFns.error).toHaveBeenCalledWith(expect.stringContaining("cancelled"));
    }, 20_000);

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
            }),
        );
    }, 20_000);

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

        await waitFor(() => expect(toastFns.error).toHaveBeenCalledWith("We could not find a header row"));
        expect(screen.queryByTestId("import-field-list")).toBeNull();
        expect(screen.getByRole("alert").textContent).toMatch(/could not find a header row/);
    });

    it("is the same wizard on another module, scoped to that module's fields", async () => {
        // The reuse claim is only worth anything if a second page really gets
        // the wizard and really asks for *its* type's fields.
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
        await waitFor(() => expect(toastFns.success).toHaveBeenCalledWith("Saved assets-import-template.csv"));
    });
});
