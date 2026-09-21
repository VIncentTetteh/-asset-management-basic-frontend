import { describe, expect, it } from "vitest";
import { buildAuditPayload, isAuditFinal, nextAuditStatuses } from "@/features/audits/workflow";

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
