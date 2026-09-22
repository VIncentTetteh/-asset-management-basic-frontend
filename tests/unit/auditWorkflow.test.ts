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

describe("audit list and edits", () => {
    it("names the scope from the API and only calls a department-less audit organisation-wide", async () => {
        const { auditScopeLabel } = await import("@/features/audits/workflow");
        expect(auditScopeLabel({ departmentId: null })).toBe("Whole organisation");
        expect(auditScopeLabel({ departmentId: "d1", departmentName: "IT" })).toBe("IT");
        expect(auditScopeLabel({ departmentId: "d9" }, () => undefined)).toBe("Unknown department");
    });

    it("sends combinable filters, omitting blanks", async () => {
        const { auditQueryParams, EMPTY_AUDIT_FILTERS } = await import("@/features/audits/workflow");
        expect(auditQueryParams(EMPTY_AUDIT_FILTERS)).toEqual({});
        expect(auditQueryParams({ ...EMPTY_AUDIT_FILTERS, status: "DISCREPANCY_FOUND", departmentId: "d1" }))
            .toEqual({ status: "DISCREPANCY_FOUND", departmentId: "d1" });
    });

    it("saves changed remarks and status on an open audit, nothing on a final one", async () => {
        const { auditEditChanges } = await import("@/features/audits/workflow");
        expect(auditEditChanges({ status: "IN_PROGRESS", remarks: "a" }, { status: "DISCREPANCY_FOUND", remarks: " b " }))
            .toEqual({ remarks: "b", status: "DISCREPANCY_FOUND" });
        expect(auditEditChanges({ status: "IN_PROGRESS", remarks: "a" }, { status: "IN_PROGRESS", remarks: "" }))
            .toEqual({ remarks: null });
        expect(auditEditChanges({ status: "COMPLETED", remarks: "a" }, { status: "COMPLETED", remarks: "b" })).toEqual({});
    });

    it("flags a discrepancy", async () => {
        const { toneForStatus } = await import("@/components/ui/status-badge");
        expect(toneForStatus("DISCREPANCY_FOUND")).toBe("flagged");
    });
});
