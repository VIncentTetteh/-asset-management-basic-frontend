import { describe, expect, it } from "vitest";
import { auditStatusOf, auditStatusOptions, buildAuditPayload, isAuditFinal, nextAuditStatuses } from "@/features/audits/workflow";

describe("audit workflow", () => {
    it("sends no organisation and omits an empty scope/auditor", () => {
        expect(buildAuditPayload({ auditDate: "2026-10-01", departmentId: "", conductedById: "", status: "", remarks: " " })).toEqual({
            auditDate: "2026-10-01",
            departmentId: undefined,
            conductedById: undefined,
            status: "PLANNED",
            remarks: undefined,
        });
    });

    it("mirrors the API's status transitions", () => {
        expect(nextAuditStatuses("PLANNED")).toContain("CANCELLED");
        expect(nextAuditStatuses("DISCREPANCY_FOUND")).not.toContain("COMPLETED");
        expect(nextAuditStatuses("RESOLVED")).toEqual(["COMPLETED"]);
        expect(isAuditFinal("COMPLETED")).toBe(true);
        expect(isAuditFinal("CANCELLED")).toBe(true);
        expect(isAuditFinal(undefined)).toBe(false);
    });
});

describe("audit status guards", () => {
    it("reads a missing status as PLANNED instead of crashing", () => {
        expect(auditStatusOf({ status: null })).toBe("PLANNED");
        expect(auditStatusOptions({ status: null })).toEqual(["PLANNED", ...nextAuditStatuses("PLANNED")]);
        expect(auditStatusOptions({ status: null }).every((s) => typeof s === "string")).toBe(true);
    });

    it("offers only PLANNED and IN_PROGRESS for a new audit", () => {
        expect(auditStatusOptions(null)).toEqual(["PLANNED", "IN_PROGRESS"]);
    });

    it("never creates an audit in a later status", () => {
        expect(buildAuditPayload({ auditDate: "2026-10-01", status: "COMPLETED" }).status).toBe("PLANNED");
        expect(buildAuditPayload({ auditDate: "2026-10-01", status: "IN_PROGRESS" }).status).toBe("IN_PROGRESS");
    });
});
