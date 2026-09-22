import { describe, expect, it } from "vitest";
import { buildTransferRequest, transferActionsFor } from "@/features/transfers/workflow";

describe("transfer row actions", () => {
    it("offers approve/reject on a request from someone else", () => {
        expect(transferActionsFor({ status: "REQUESTED", requestedById: "u1" }, "u2")).toEqual(["approve", "reject", "delete"]);
    });

    it("never offers approve to the requester", () => {
        expect(transferActionsFor({ status: "REQUESTED", requestedById: "u1" }, "u1")).not.toContain("approve");
    });

    it("completes or stops an approved transfer", () => {
        expect(transferActionsFor({ status: "APPROVED" }, "u2")).toEqual(["complete", "reject", "delete"]);
    });

    it("offers nothing on a completed transfer and only delete on closed ones", () => {
        expect(transferActionsFor({ status: "COMPLETED" }, "u2")).toEqual([]);
        expect(transferActionsFor({ status: "REJECTED" }, "u2")).toEqual(["delete"]);
        expect(transferActionsFor({ status: "CANCELLED" }, "u2")).toEqual(["delete"]);
    });
});

describe("buildTransferRequest", () => {
    it("never sends an origin: the API derives it from the asset", () => {
        const r = buildTransferRequest({ assetId: "a1", toDepartmentId: "it", reason: "  move " }, { departmentId: "fin" });
        expect(r).toEqual({ body: { assetId: "a1", toDepartmentId: "it", toLocationId: undefined, reason: "move" } });
    });

    it("allows an asset with no department", () => {
        expect("body" in buildTransferRequest({ assetId: "a1", toDepartmentId: "it" }, { departmentId: null })).toBe(true);
    });

    it("refuses the asset's own department", () => {
        expect(buildTransferRequest({ assetId: "a1", toDepartmentId: "fin" }, { departmentId: "fin" })).toHaveProperty("error");
    });

    it("allows keeping the same location (department-only move)", () => {
        const r = buildTransferRequest({ assetId: "a1", toDepartmentId: "it", toLocationId: "hq" }, { departmentId: "fin" });
        expect(r).toHaveProperty("body.toLocationId", "hq");
    });
});
