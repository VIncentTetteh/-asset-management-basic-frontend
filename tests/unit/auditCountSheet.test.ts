import { describe, expect, it } from "vitest";
import {
    auditProgressLabel,
    auditProgressOf,
    canCountItems,
    DISCREPANCY_TYPES,
} from "@/features/audits/workflow";
import { AuditDiscrepancyType, AuditStatus } from "@/types";

describe("audit count-sheet progress", () => {
    it("counts what is verified, flagged and still to do", () => {
        expect(auditProgressOf({ totalItemCount: 10, verifiedItemCount: 6, discrepancyCount: 2 }))
            .toMatchObject({ total: 10, verified: 6, discrepancies: 2, pending: 2, percent: 60 });
    });

    it("is not verified when the sheet is empty", () => {
        const progress = auditProgressOf({});
        expect(progress).toMatchObject({ total: 0, percent: 0, allVerified: false });
        expect(auditProgressLabel(progress)).toBe("No count sheet yet");
    });

    it("trusts the server's allItemsVerified over its own arithmetic", () => {
        // The API is the authority on the seal; a stale count must not mint one.
        expect(auditProgressOf({ totalItemCount: 4, verifiedItemCount: 4, allItemsVerified: false }).allVerified)
            .toBe(false);
        expect(auditProgressOf({ totalItemCount: 4, verifiedItemCount: 2, allItemsVerified: true }).allVerified)
            .toBe(true);
    });

    it("falls back to its own arithmetic when the field is absent", () => {
        expect(auditProgressOf({ totalItemCount: 3, verifiedItemCount: 3 }).allVerified).toBe(true);
        expect(auditProgressOf({ totalItemCount: 3, verifiedItemCount: 2 }).allVerified).toBe(false);
    });

    it("never reports more verified than there are items, or negative counts", () => {
        expect(auditProgressOf({ totalItemCount: 2, verifiedItemCount: 9 }).verified).toBe(2);
        expect(auditProgressOf({ totalItemCount: -5, verifiedItemCount: -1 }))
            .toMatchObject({ total: 0, verified: 0, pending: 0 });
    });

    it("says how many discrepancies there are, in the singular when there is one", () => {
        expect(auditProgressLabel(auditProgressOf({ totalItemCount: 5, verifiedItemCount: 3 })))
            .toBe("3 / 5 verified");
        expect(auditProgressLabel(auditProgressOf({ totalItemCount: 5, verifiedItemCount: 3, discrepancyCount: 1 })))
            .toBe("3 / 5 verified · 1 discrepancy");
        expect(auditProgressLabel(auditProgressOf({ totalItemCount: 5, verifiedItemCount: 2, discrepancyCount: 2 })))
            .toBe("2 / 5 verified · 2 discrepancies");
    });
});

describe("when the count sheet can be written to", () => {
    it("is open until the audit becomes a final record", () => {
        expect(canCountItems(AuditStatus.PLANNED)).toBe(true);
        expect(canCountItems(AuditStatus.IN_PROGRESS)).toBe(true);
        expect(canCountItems(AuditStatus.DISCREPANCY_FOUND)).toBe(true);
        expect(canCountItems(AuditStatus.RESOLVED)).toBe(true);
        expect(canCountItems(AuditStatus.COMPLETED)).toBe(false);
        expect(canCountItems(AuditStatus.CANCELLED)).toBe(false);
    });

    it("treats a legacy audit with no status as planned, and therefore open", () => {
        expect(canCountItems(null)).toBe(true);
    });
});

describe("discrepancy types", () => {
    it("offers exactly the four the API accepts", () => {
        expect(DISCREPANCY_TYPES.map((t) => t.value)).toEqual([
            AuditDiscrepancyType.MISSING,
            AuditDiscrepancyType.WRONG_LOCATION,
            AuditDiscrepancyType.DAMAGED,
            AuditDiscrepancyType.UNEXPECTED,
        ]);
    });
});
