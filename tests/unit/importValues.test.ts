import { describe, expect, it } from "vitest";
import type { ImportEnumField, ImportFieldDefinition } from "@/services/importService";
import {
    enumFieldViews,
    hasValuesToMap,
    initialValueChoices,
    orderedValues,
    undecidedRowCount,
    valueMappingsPayload,
} from "@/features/imports/enumValues";
import {
    COLUMN_CUSTOM_FIELD,
    COLUMN_IGNORE,
    COLUMN_MULTIPLE,
    applyColumnChoice,
    applyFieldChoice,
    canBeCustomField,
    columnChoice,
    customFieldName,
    customFieldNames,
    initialCustomFieldColumns,
} from "@/features/imports/columnPlan";
import {
    canCommit,
    createdEntries,
    createdTypeLabel,
    importVerdict,
    normalisePreview,
    outcomeTone,
    previewHeadline,
    rowsThatWouldImport,
    verdictSummary,
    verdictTitle,
} from "@/features/imports/outcome";

const enumFields: ImportEnumField[] = [
    {
        field: "assetType",
        label: "Asset type",
        column: 5,
        header: "Type",
        allowedValues: ["HARDWARE", "SOFTWARE"],
        values: [
            { value: "Laptop", suggested: "HARDWARE", exact: false, rowCount: 2 },
            { value: "Sundry", suggested: null, exact: false, rowCount: 7 },
            { value: "SOFTWARE", suggested: "SOFTWARE", exact: true, rowCount: 1 },
        ],
    },
    { field: "status", label: "Status", column: null, header: null, allowedValues: ["ACTIVE"], values: [] },
];

describe("enum field views", () => {
    it("is ready when the field is still fed by the column we read it from", () => {
        const views = enumFieldViews(enumFields, { assetType: 5, status: null });
        expect(views.map((view) => view.state)).toEqual(["ready", "unmapped"]);
        expect(hasValuesToMap(views)).toBe(true);
    });

    it("refuses to offer stale values when the user re-pointed the field at another column", () => {
        // The value list belongs to column 5. Offering it for column 2 would be
        // a dropdown full of values that column does not contain.
        const views = enumFieldViews(enumFields, { assetType: 2 });
        expect(views[0].state).toBe("restated");
        expect(hasValuesToMap(views)).toBe(false);
    });

    it("has nothing to map when no column feeds the field", () => {
        expect(hasValuesToMap(enumFieldViews(enumFields, { assetType: null }))).toBe(false);
    });
});

describe("value choices", () => {
    const views = enumFieldViews(enumFields, { assetType: 5 });

    it("pre-selects a suggestion and leaves an explicit null blank rather than guessing", () => {
        expect(initialValueChoices(views)).toEqual({
            assetType: { Laptop: "HARDWARE", Sundry: "", SOFTWARE: "SOFTWARE" },
        });
    });

    it("sends only decided values — undecided is not the same as ignored", () => {
        const choices = initialValueChoices(views);
        expect(valueMappingsPayload(views, choices)).toEqual({
            assetType: { Laptop: "HARDWARE", SOFTWARE: "SOFTWARE" },
        });

        choices.assetType.Sundry = "__IGNORE__";
        expect(valueMappingsPayload(views, choices).assetType.Sundry).toBe("__IGNORE__");
    });

    it("sends nothing at all for a field whose column the user changed", () => {
        const restated = enumFieldViews(enumFields, { assetType: 2 });
        expect(valueMappingsPayload(restated, { assetType: { Laptop: "HARDWARE" } })).toEqual({});
    });

    it("counts the rows an undecided value leaves blank", () => {
        expect(undecidedRowCount(views[0], initialValueChoices(views))).toBe(7);
    });

    it("puts the values needing a decision first", () => {
        expect(orderedValues(views[0], initialValueChoices(views)).map((value) => value.value)).toEqual([
            "Sundry",
            "Laptop",
            "SOFTWARE",
        ]);
    });
});

describe("column plan", () => {
    const fields: ImportFieldDefinition[] = [
        { name: "name", label: "Asset name", required: true },
        { name: "notes", label: "Notes", required: false },
    ];

    it("reads a column's current fate from the mapping it is in", () => {
        expect(columnChoice(fields, { name: 0, notes: null }, [], 0)).toBe("name");
        expect(columnChoice(fields, { name: null, notes: null }, [1], 1)).toBe(COLUMN_CUSTOM_FIELD);
        expect(columnChoice(fields, { name: null, notes: null }, [], 2)).toBe(COLUMN_IGNORE);
        expect(columnChoice(fields, { name: 0, notes: 0 }, [], 0)).toBe(COLUMN_MULTIPLE);
    });

    it("moves a column rather than leaving it in two places at once", () => {
        const start = { mapping: { name: 3, notes: null }, customFieldColumns: [] as number[] };
        const custom = applyColumnChoice(start, 3, COLUMN_CUSTOM_FIELD);
        expect(custom).toEqual({ mapping: { name: null, notes: null }, customFieldColumns: [3] });

        const backToField = applyColumnChoice(custom, 3, "notes");
        expect(backToField).toEqual({ mapping: { name: null, notes: 3 }, customFieldColumns: [] });
    });

    it("takes a column back from the custom fields when a field claims it", () => {
        const state = { mapping: { name: null, notes: null }, customFieldColumns: [4] };
        expect(applyFieldChoice(state, "name", 4)).toEqual({
            mapping: { name: 4, notes: null },
            customFieldColumns: [],
        });
    });

    it("leaves a column two fields share alone rather than silently picking one", () => {
        const state = { mapping: { name: 0, notes: 0 }, customFieldColumns: [] };
        expect(applyColumnChoice(state, 0, COLUMN_MULTIPLE)).toBe(state);
    });

    it("never proposes a custom field where the tenant cannot have one", () => {
        const plan = [{ index: 4, header: "Team", action: "CUSTOM_FIELD" as const, canBeCustomField: true }];
        expect(initialCustomFieldColumns(plan, false, {})).toEqual([]);
        expect(initialCustomFieldColumns(plan, true, {})).toEqual([4]);
        // A column a field already fills is not also kept as a custom field.
        expect(initialCustomFieldColumns(plan, true, { name: 4 })).toEqual([]);
        expect(canBeCustomField(plan, false, 4)).toBe(false);
        expect(canBeCustomField(plan, true, 4)).toBe(true);
        expect(canBeCustomField([{ ...plan[0], canBeCustomField: false }], true, 4)).toBe(false);
    });

    it("names a custom field the way the analyser would, falling back to their heading", () => {
        const plan = [{ index: 4, header: "Team", action: "IGNORE" as const, customFieldName: "Team", canBeCustomField: true }];
        expect(customFieldName(plan, { index: 4, name: "Assignment group" })).toBe("Team");
        expect(customFieldName([], { index: 4, name: "Assignment group" })).toBe("Assignment group");
        expect(customFieldName([], { index: 4, name: "  " })).toBe("Column 5");
        expect(customFieldNames([{ index: 4, name: "Assignment group" }], [], [4])).toEqual(["Assignment group"]);
    });
});

describe("preview normalisation", () => {
    it("reads the counts out of totals, which is where they moved to", () => {
        const preview = normalisePreview({
            totals: { valid: 2, invalid: 1, total: 3 },
            errors: [{ row: 4, message: "bad" }],
            notes: [],
            rowsChecked: 3,
            totalRowsInFile: 3,
            outcome: "PARTIAL",
        });
        expect(preview.totals).toEqual({ valid: 2, invalid: 1, total: 3 });
        expect(preview.outcome).toBe("PARTIAL");
        expect(preview.outcomeReported).toBe(true);
    });

    it("still shows real numbers for a response in the older flat shape", () => {
        // Three blank counter boxes is exactly what a customer saw. A response
        // that predates `totals` must still fill them.
        const preview = normalisePreview({
            total: 3,
            valid: 2,
            invalid: 1,
            rows: [{ rowNumber: 4, errors: [{ column: "Cost", message: "bad" }] }],
        });
        expect(preview.totals).toEqual({ valid: 2, invalid: 1, total: 3 });
        expect(preview.errors).toEqual([
            { row: 4, message: "bad", field: null, column: "Cost", value: null },
        ]);
    });

    it("does not claim every row passed when nothing told it so", () => {
        const preview = normalisePreview({ total: 3, valid: 3, invalid: 0, rows: [] });
        expect(preview.outcomeReported).toBe(false);
        expect(previewHeadline(preview, "assets")).toBe("3 of 3 rows are ready to import");
    });

    it("says every row passed when the server said SUCCESS", () => {
        const preview = normalisePreview({
            totals: { valid: 3, invalid: 0, total: 3 },
            outcome: "SUCCESS",
            errors: [],
            notes: [],
        });
        expect(previewHeadline(preview, "assets")).toMatch(/^Every row passed/);
    });

    it("refuses a commit that would write nothing", () => {
        const nothing = normalisePreview({ totals: { valid: 0, invalid: 0, total: 0 }, outcome: "NOTHING_TO_IMPORT" });
        expect(canCommit(nothing, true)).toBe(false);
        expect(previewHeadline(nothing, "assets")).toBe("There are no rows to import");

        const fatal = normalisePreview({
            totals: { valid: 4, invalid: 0, total: 4 },
            outcome: "FAILED",
            fatalError: "No column feeds Asset tag",
        });
        expect(canCommit(fatal, true)).toBe(false);
        expect(rowsThatWouldImport(fatal, true)).toBe(0);
    });

    it("only offers the ready rows once the user has agreed to skip the rest", () => {
        const partial = normalisePreview({ totals: { valid: 2, invalid: 1, total: 3 }, outcome: "PARTIAL" });
        expect(rowsThatWouldImport(partial, false)).toBe(0);
        expect(canCommit(partial, false)).toBe(false);
        expect(rowsThatWouldImport(partial, true)).toBe(2);
        expect(canCommit(partial, true)).toBe(true);
    });
});

describe("the verdict on a finished job", () => {
    it("renders the server's outcome rather than deriving one", () => {
        expect(importVerdict("completed", { outcome: "PARTIAL" })).toBe("PARTIAL");
        expect(importVerdict("completed", { outcome: "NOTHING_TO_IMPORT" })).toBe("NOTHING_TO_IMPORT");
        expect(outcomeTone("SUCCESS")).toBe("ok");
        expect(outcomeTone("PARTIAL")).toBe("warn");
        expect(outcomeTone("NOTHING_TO_IMPORT")).toBe("danger");
    });

    it("never turns a completed job with no verdict into a success", () => {
        // "Import completed" with a green tick over "imported 0 rows" is the
        // exact screen this guards against.
        expect(importVerdict("completed", { totalRows: 1, imported: 0, skipped: 1 })).toBe("UNKNOWN");
        expect(outcomeTone(importVerdict("completed", undefined))).toBe("danger");
    });

    it("never shows a failed or cancelled job as a success, whatever the body says", () => {
        expect(importVerdict("failed", { outcome: "SUCCESS" })).toBe("FAILED");
        expect(importVerdict("cancelled", { outcome: "SUCCESS" })).toBe("CANCELLED");
    });

    it("describes a run only in numbers it was given", () => {
        expect(verdictTitle("PARTIAL", false)).toBe("Import partly completed");
        expect(verdictTitle("SUCCESS", true)).toBe("Dry run completed");
        expect(verdictSummary("PARTIAL", { imported: 2, updated: 1, skipped: 1 }, "assets")).toBe(
            "3 rows of assets were saved. 1 row was not.",
        );
        expect(verdictSummary("NOTHING_TO_IMPORT", { totalRows: 0 }, "assets")).toMatch(/no rows to read/);
        expect(verdictSummary("UNKNOWN", undefined, "assets")).toMatch(/did not say what it did/);
    });

    it("lists what was created, by type, in words a user reads", () => {
        expect(createdEntries({ department: ["Finance"], category: [] })).toEqual([
            { type: "department", names: ["Finance"] },
        ]);
        expect(createdTypeLabel("department")).toBe("Departments");
        expect(createdTypeLabel("category")).toBe("Categories");
        expect(createdTypeLabel("premises")).toBe("Premises");
    });
});
