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

describe("disposal list filters", () => {
    it("sends only the filters that are set, all together", async () => {
        const { disposalQueryParams, EMPTY_DISPOSAL_FILTERS, DISPOSAL_STATUS_FILTERS } = await import("@/features/disposals/workflow");
        expect(disposalQueryParams(EMPTY_DISPOSAL_FILTERS)).toEqual({});
        expect(disposalQueryParams({ status: "PENDING_APPROVAL", startDate: "2026-01-01", endDate: "" }))
            .toEqual({ status: "PENDING_APPROVAL", startDate: "2026-01-01" });
        expect(DISPOSAL_STATUS_FILTERS.find((f) => f.value === "PENDING_APPROVAL")?.label).toBe("Awaiting approval");
    });

    it("links a compliance document only when it is a web address", async () => {
        const { isDocumentLink } = await import("@/features/disposals/workflow");
        expect(isDocumentLink("https://docs.example.com/cert.pdf")).toBe(true);
        expect(isDocumentLink("Certificate #12345")).toBe(false);
        expect(isDocumentLink("javascript:alert(1)")).toBe(false);
    });
});

describe("disposal reject", () => {
    it("sends the reason in the body", async () => {
        const { vi } = await import("vitest");
        const post = vi.fn().mockResolvedValue({ data: { id: "d1", status: "REJECTED" } });
        vi.doMock("@/lib/axios", () => ({ default: { post } }));
        vi.resetModules();
        const { disposalService } = await import("@/services/disposalService");
        await disposalService.reject("d1", "Still under warranty");
        expect(post).toHaveBeenCalledWith("/disposals/d1/reject", { reason: "Still under warranty" });
        vi.doUnmock("@/lib/axios");
    });
});
