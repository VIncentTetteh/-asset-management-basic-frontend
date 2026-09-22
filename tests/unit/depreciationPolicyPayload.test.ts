import { describe, expect, it } from "vitest";
import {
    DEPRECIATION_METHODS,
    buildDepreciationPolicyPayload,
    depreciationPolicyFormValues,
} from "@/features/depreciation/payload";

describe("buildDepreciationPolicyPayload", () => {
    it("sends a blank useful life and residual as null, not 0", () => {
        const p = buildDepreciationPolicyPayload({
            name: " IT ", method: "STRAIGHT_LINE", usefulLifeMonths: "", salvageValuePercent: "", description: " ",
        });
        expect(p).toEqual({
            name: "IT", method: "STRAIGHT_LINE", usefulLifeMonths: null, salvageValuePercent: null, description: null,
        });
    });

    it("never sends an organisation id (the API takes it from the session)", () => {
        const p = buildDepreciationPolicyPayload({ name: "x", method: "STRAIGHT_LINE", usefulLifeMonths: "36", salvageValuePercent: "10" });
        expect(p).not.toHaveProperty("organisationId");
        expect(p.usefulLifeMonths).toBe(36);
        expect(p.salvageValuePercent).toBe(10);
    });
});

describe("depreciationPolicyFormValues", () => {
    it("prefills stored values as they are, without a 36-month or 0% default", () => {
        const v = depreciationPolicyFormValues({ id: "p1", name: "Legacy", method: "DECLINING_BALANCE" } as never);
        expect(v.usefulLifeMonths).toBe("");
        expect(v.salvageValuePercent).toBe("");
        // Saving the untouched form keeps them empty.
        const p = buildDepreciationPolicyPayload(v);
        expect(p.usefulLifeMonths).toBeNull();
        expect(p.salvageValuePercent).toBeNull();
    });

    it("keeps a stored 0% residual", () => {
        const v = depreciationPolicyFormValues({ id: "p1", name: "x", method: "STRAIGHT_LINE", salvageValuePercent: 0 } as never);
        expect(buildDepreciationPolicyPayload(v).salvageValuePercent).toBe(0);
    });
});

it("offers every method the API accepts, including units of production", () => {
    expect(DEPRECIATION_METHODS).toEqual(["STRAIGHT_LINE", "DECLINING_BALANCE", "SUM_OF_YEARS_DIGITS", "UNITS_OF_PRODUCTION"]);
});
