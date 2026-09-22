import { describe, expect, it } from "vitest";
import { buildBogControlPayload, buildCompliancePayload, buildComplianceReplacePayload, dateToInstant } from "@/features/compliance/payload";
import { userOptions } from "@/features/compliance/useComplianceUserOptions";
import type { User } from "@/types";

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

describe("buildBogControlPayload", () => {
    it("sends the target date as an instant the API can parse", () => {
        expect(buildBogControlPayload({ directiveRef: "BoG/ICT/1.2", requirement: "x", targetDate: "2026-12-31" }).targetDate)
            .toBe("2026-12-31T12:00:00Z");
    });

    it("sends blank optional fields as null so an edit clears them", () => {
        const p = buildBogControlPayload({ directiveRef: " A ", requirement: "r", targetDate: "", gapDescription: " ", evidenceUrl: "" });
        expect(p).toMatchObject({ directiveRef: "A", targetDate: null, gapDescription: null, evidenceUrl: null });
    });
});

describe("buildComplianceReplacePayload (PUT edits)", () => {
    it("sends every field, blanks as null so dates, numbers and selects clear", () => {
        expect(buildComplianceReplacePayload(fields, {
            filingType: " Return ", notes: "", dueDate: "", status: "", criticalCount: "", isolated: undefined,
        })).toEqual({
            filingType: "Return", notes: null, dueDate: null, status: null, criticalCount: null, isolated: false,
        });
    });

    it("converts values and keeps fixed fields from the record", () => {
        const withAsset = [...fields, { name: "assetId", type: "select" as const }];
        expect(buildComplianceReplacePayload(withAsset, { dueDate: "2026-01-02", criticalCount: "4", assetId: undefined },
            { assetId: "a-1" })).toMatchObject({ dueDate: "2026-01-02T12:00:00Z", criticalCount: 4, assetId: "a-1" });
    });
});

describe("compliance owner options", () => {
    it("offers active users by id and by email", () => {
        const users = [
            { id: "u1", firstName: "Ama", lastName: "M", email: "ama@x.com", status: "ACTIVE" },
            { id: "u2", firstName: "Old", lastName: "U", email: "old@x.com", status: "INACTIVE" },
        ] as User[];
        const { byId, byEmail } = userOptions(users);
        expect(byId).toEqual([{ value: "u1", label: "Ama M (ama@x.com)" }]);
        expect(byEmail[0].value).toBe("ama@x.com");
    });
});
