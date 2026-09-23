import { describe, expect, it } from "vitest";
import type { DetectedColumn, ImportFieldDefinition } from "@/services/importService";
import {
    applySavedMapping,
    columnFor,
    describeColumn,
    duplicatedColumns,
    initialMapping,
    mappingPayload,
    missingRequiredFields,
    normaliseAnalysis,
    sampleValues,
} from "@/features/imports/mapping";
import { IMPORT_MAX_FILE_BYTES, formatBytes, rejectImportFile } from "@/features/imports/importFile";
import { failedRows, failedRowsCsv, failedRowsText, rowLabel } from "@/features/imports/failedRows";
import { importEntityType, mergeImportType } from "@/features/imports/importTypes";
import { importJobPollMs, importJobStatusLabel } from "@/features/imports/importJob";

const fields: ImportFieldDefinition[] = [
    { name: "name", label: "Asset name", required: true },
    { name: "assetTag", label: "Asset tag", required: true },
    { name: "serialNumber", label: "Serial number", required: false },
];

const columns: DetectedColumn[] = [
    { index: 0, name: "Display Name", sampleValues: ["Latitude 5540", "", "ThinkPad"] },
    { index: 1, name: "Asset ID", sampleValues: ["AST-1"] },
    { index: 2, name: "  ", sampleValues: [] },
];

describe("initialMapping", () => {
    it("takes the analyser's suggestion and leaves the rest unmapped", () => {
        expect(initialMapping(fields, { name: 0, assetTag: 1 }, columns)).toEqual({
            name: 0,
            assetTag: 1,
            serialNumber: null,
        });
    });

    it("drops a suggestion pointing at a column this file does not have", () => {
        // A stale saved mapping applied to a different sheet would otherwise
        // silently import whatever happens to sit at that index.
        expect(initialMapping(fields, { name: 0, assetTag: 9 }, columns).assetTag).toBeNull();
    });

    it("has an entry for every field even with no suggestion at all", () => {
        expect(initialMapping(fields, undefined, columns)).toEqual({ name: null, assetTag: null, serialNumber: null });
    });
});

describe("applySavedMapping", () => {
    it("clears fields the saved mapping does not mention", () => {
        const saved = applySavedMapping(fields, { name: 2 }, columns);
        expect(saved).toEqual({ name: 2, assetTag: null, serialNumber: null });
    });
});

describe("missingRequiredFields", () => {
    it("lists required fields with no column, and nothing else", () => {
        const missing = missingRequiredFields(fields, { name: 0, assetTag: null, serialNumber: null });
        expect(missing.map((f) => f.name)).toEqual(["assetTag"]);
    });
});

describe("duplicatedColumns", () => {
    it("reports one column feeding two fields", () => {
        const dupes = duplicatedColumns(fields, { name: 0, assetTag: 0, serialNumber: null }, columns);
        expect(dupes).toHaveLength(1);
        expect(dupes[0].fields.map((f) => f.name)).toEqual(["name", "assetTag"]);
    });

    it("says nothing when every column feeds at most one field", () => {
        expect(duplicatedColumns(fields, { name: 0, assetTag: 1, serialNumber: null }, columns)).toEqual([]);
    });
});

describe("mappingPayload", () => {
    it("sends only the fields that have a column", () => {
        expect(mappingPayload({ name: 0, assetTag: null, serialNumber: 2 })).toEqual({ name: 0, serialNumber: 2 });
    });

    it("keeps column zero, which is falsy but real", () => {
        expect(mappingPayload({ name: 0 })).toEqual({ name: 0 });
    });
});

describe("column descriptions", () => {
    it("pairs the heading with the first non-empty sample", () => {
        expect(describeColumn(columns[0])).toBe("Display Name — e.g. Latitude 5540");
    });

    it("falls back to a position when the heading is blank", () => {
        expect(describeColumn(columns[2])).toBe("Column 3");
    });

    it("skips blank samples", () => {
        expect(sampleValues(columns[0])).toEqual(["Latitude 5540", "ThinkPad"]);
        expect(sampleValues(undefined)).toEqual([]);
    });

    it("finds the column behind a field", () => {
        expect(columnFor(columns, { name: 1 }, "name")?.name).toBe("Asset ID");
        expect(columnFor(columns, { name: null }, "name")).toBeUndefined();
    });
});

describe("normaliseAnalysis", () => {
    it("survives an analyse response missing the parts the mapping step needs", () => {
        const analysis = normaliseAnalysis({
            uploadId: "u1",
        } as unknown as Parameters<typeof normaliseAnalysis>[0]);
        expect(analysis.detectedColumns).toEqual([]);
        expect(analysis.suggestedMapping).toEqual({});
        expect(analysis.rowCount).toBe(0);
    });
});

describe("rejectImportFile", () => {
    const file = (name: string, size: number): File => {
        const f = new File(["x"], name);
        Object.defineProperty(f, "size", { value: size });
        return f;
    };

    it("accepts xlsx and csv", () => {
        expect(rejectImportFile(file("register.xlsx", 2048))).toBeNull();
        expect(rejectImportFile(file("register.CSV", 2048))).toBeNull();
    });

    it("tells an .xls user exactly what to do", () => {
        expect(rejectImportFile(file("old.xls", 2048))).toMatch(/Save As/);
    });

    it("refuses other file types, an empty file, and one over the backend's cap", () => {
        expect(rejectImportFile(file("notes.pdf", 2048))).toMatch(/\.xlsx or \.csv/);
        expect(rejectImportFile(file("blank.csv", 0))).toMatch(/empty/);
        expect(rejectImportFile(file("huge.xlsx", IMPORT_MAX_FILE_BYTES + 1))).toMatch(/limit is 25\.0 MB/);
    });

    it("formats sizes the way the messages read them", () => {
        expect(formatBytes(512)).toBe("512 bytes");
        expect(formatBytes(2048)).toBe("2 KB");
        expect(formatBytes(IMPORT_MAX_FILE_BYTES)).toBe("25.0 MB");
    });
});

describe("failed rows", () => {
    it("keeps the row, the user's own heading and the reason the server gave", () => {
        expect(failedRows([{ row: 4, message: "must be a number", field: "purchaseCost", column: "Cost (USD)" }])).toEqual([
            { rowNumber: 4, column: "Cost (USD)", message: "must be a number" },
        ]);
    });

    it("never renders a blank reason", () => {
        expect(failedRows([{ row: 7, message: "" }])[0].message).toBe("Rejected without a reason given");
    });

    it("refuses to label a row 0, which is a row nobody can go and find", () => {
        // The API guarantees it never sends one. If one ever arrives, the user
        // gets the reason without being sent hunting for a row that is not there.
        expect(rowLabel(0)).toBeNull();
        expect(rowLabel(4)).toBe("Row 4");
        expect(failedRowsCsv([{ rowNumber: 0, message: "no row" }]).split("\r\n")[1]).toBe(',"","no row"');
    });

    it("quotes a message containing a comma or a quote so the CSV stays readable", () => {
        const csv = failedRowsCsv([{ rowNumber: 3, column: 'Cost, "net"', message: "must be a number, not text" }]);
        expect(csv.split("\r\n")[0]).toBe("Row,Column,Problem");
        expect(csv).toContain('"Cost, ""net"""');
        expect(csv).toContain('"must be a number, not text"');
    });

    it("writes one readable line per row as text", () => {
        expect(failedRowsText([{ rowNumber: 3, column: "Cost", message: "bad" }, { rowNumber: 4, message: "bad" }])).toBe(
            "Row 3 · Cost · bad\nRow 4 · bad",
        );
    });
});

describe("import entity types", () => {
    it("knows every module the wizard is wired up for", () => {
        for (const type of ["assets", "suppliers", "employees", "locations", "departments", "categories", "licenses", "contracts"]) {
            expect(importEntityType(type).queryKey).toBeTruthy();
            expect(importEntityType(type).plural).not.toBe("");
        }
    });

    it("still names an unknown type rather than rendering a blank wizard", () => {
        expect(importEntityType("cost-centres").label).toBe("cost centres");
    });

    it("lets the API's label and description win when it answers", () => {
        const merged = mergeImportType("assets", { type: "assets", label: "Asset register", description: "From the API" });
        expect(merged.label).toBe("Asset register");
        expect(merged.description).toBe("From the API");
        // …and keeps the local one when it does not.
        expect(mergeImportType("assets", undefined).label).toBe("Assets");
    });
});

describe("job polling cadence", () => {
    it("checks quickly at first, then backs off", () => {
        expect(importJobPollMs(0)).toBe(500);
        expect(importJobPollMs(5)).toBe(500);
        expect(importJobPollMs(6)).toBe(2500);
        expect(importJobPollMs(50)).toBe(2500);
    });

    it("says what a queued job is doing, rather than showing a raw enum", () => {
        expect(importJobStatusLabel("QUEUED")).toMatch(/Queued/);
        expect(importJobStatusLabel("PROCESSING")).toMatch(/Importing/);
        expect(importJobStatusLabel(undefined)).toBe("Starting…");
        expect(importJobStatusLabel("SOME_NEW_STATE")).toBe("some new state");
    });
});
