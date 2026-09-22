import { describe, expect, it } from "vitest";
import { buildDsarStatusUpdate, dsarNextStatuses, isDsarClosed } from "@/features/dpa/dsar";

describe("DSAR status moves", () => {
    it("treats completed and rejected as final", () => {
        expect(isDsarClosed("COMPLETED")).toBe(true);
        expect(isDsarClosed("REJECTED")).toBe(true);
        expect(dsarNextStatuses("COMPLETED")).toEqual([]);
    });

    it("lets an open request move to any other API status", () => {
        expect(dsarNextStatuses("PENDING")).toEqual(["IN_PROGRESS", "COMPLETED", "REJECTED"]);
        expect(dsarNextStatuses("IN_PROGRESS")).toEqual(["PENDING", "COMPLETED", "REJECTED"]);
    });
});

describe("DSAR update body", () => {
    it("sends the summary (blank clears it) and a chosen assignee", () => {
        expect(buildDsarStatusUpdate({ status: "IN_PROGRESS", responseSummary: "  ", assignedToUserId: "u1" }, {}))
            .toEqual({ status: "IN_PROGRESS", responseSummary: "", assignedToUserId: "u1" });
    });

    it("emptying the assignee picker removes the assignee", () => {
        expect(buildDsarStatusUpdate({ status: "PENDING", assignedToUserId: "" }, { assignedToUserId: "u1" }))
            .toMatchObject({ clearAssignee: true });
        expect(buildDsarStatusUpdate({ status: "PENDING", assignedToUserId: "" }, {})).not.toHaveProperty("clearAssignee");
    });
});
