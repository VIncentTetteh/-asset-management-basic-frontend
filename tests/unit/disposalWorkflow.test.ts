import { describe, expect, it } from "vitest";
import { buildDisposalPayload, disposalActionsFor, disposalTermsLocked } from "@/features/disposals/workflow";
import type { DisposalRecord } from "@/types";

const approved: DisposalRecord = {
    id: "d1",
    assetId: "a1",
    disposalMethod: "SALE",
    disposalDate: "2026-09-01",
    saleValue: 500,
    currency: "GHS",
    status: "APPROVED",
};

describe("disposal workflow", () => {
    it("never offers approve to the requester", () => {
        expect(disposalActionsFor({ status: "PENDING_APPROVAL", requestedById: "u1" }, "u1")).not.toContain("approve");
        expect(disposalActionsFor({ status: "PENDING_APPROVAL", requestedById: "u1" }, "u2")).toContain("approve");
    });

    it("keeps approved disposals (edit notes only, no delete) and closes rejected ones", () => {
        expect(disposalActionsFor({ status: "APPROVED" }, "u2")).toEqual(["edit"]);
        expect(disposalActionsFor({ status: "REJECTED" }, "u2")).toEqual(["delete"]);
        // legacy rows without a status were effective at once
        expect(disposalActionsFor({}, "u2")).toEqual(["edit"]);
        expect(disposalTermsLocked({})).toBe(true);
    });

    it("sends the full record, nulling cleared optional fields", () => {
        expect(
            buildDisposalPayload({
                assetId: "a1",
                disposalMethod: "SCRAP",
                disposalDate: "2026-09-02",
                saleValue: "",
                currency: "",
                reason: "End of life",
                complianceDocumentUrl: " ",
            }),
        ).toEqual({
            assetId: "a1",
            disposalMethod: "SCRAP",
            disposalDate: "2026-09-02",
            saleValue: null,
            currency: null,
            reason: "End of life",
            complianceDocumentUrl: null,
        });
    });

    it("takes locked terms from an approved record so a notes edit cannot change them", () => {
        const body = buildDisposalPayload(
            { assetId: "a1", disposalMethod: "", disposalDate: "", saleValue: undefined, reason: "Cert attached", complianceDocumentUrl: "CERT-1" },
            approved,
        );
        expect(body).toMatchObject({ disposalMethod: "SALE", disposalDate: "2026-09-01", saleValue: 500, currency: "GHS", reason: "Cert attached", complianceDocumentUrl: "CERT-1" });
    });
});
