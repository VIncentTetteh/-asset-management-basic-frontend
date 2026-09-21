import { describe, expect, it } from "vitest";
import { transferActionsFor } from "@/features/transfers/workflow";

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
