import { describe, expect, it } from "vitest";
import { buildCompliancePayload, dateToInstant } from "@/features/compliance/payload";

const fields = [
    { name: "filingType", type: "text" as const },
    { name: "notes", type: "textarea" as const },
    { name: "dueDate", type: "date" as const },
    { name: "status", type: "select" as const },
    { name: "criticalCount", type: "number" as const },
    { name: "isolated", type: "checkbox" as const },
];

describe("compliance payload", () => {
    it("sends dates as instants the API can read", () => {
        expect(dateToInstant("2026-09-30")).toBe("2026-09-30T12:00:00Z");
        expect(dateToInstant("2026-09-30T00:00:00Z")).toBe("2026-09-30T00:00:00Z");
        expect(buildCompliancePayload(fields, { dueDate: "2026-09-30" })).toEqual({ dueDate: "2026-09-30T12:00:00Z" });
    });

    it("coerces numbers, trims text, keeps booleans and drops blanks on create", () => {
        expect(
            buildCompliancePayload(fields, { filingType: " Return ", criticalCount: "3", isolated: false, status: "", notes: "" }),
        ).toEqual({ filingType: "Return", criticalCount: 3, isolated: false });
    });

    it("clears a text field that had a value when editing, but not selects or dates", () => {
        const editing = { notes: "old", status: "PENDING", dueDate: "2026-09-30T12:00:00Z" };
        expect(buildCompliancePayload(fields, { notes: "", status: "", dueDate: "" }, editing)).toEqual({ notes: "" });
    });
});
