import { describe, expect, it } from "vitest";
import { assetBookValue, buildAssetUpdate, editableAssetStatuses, normaliseAssetForm } from "@/features/assets/assetPayload";
import type { Asset, AssetDto } from "@/types";

const original: Asset = {
    id: "a1",
    name: "Laptop",
    purchaseCost: 1200,
    currency: "GHS",
    usefulLifeMonths: 36,
    departmentId: "d1",
    locationId: "l1",
    supplierId: "s1",
    purchaseOrderId: "po1",
    assignedUserId: "u1",
};

/** The form as AssetFormModal seeds it from `original` (relations as ids, numbers as-is). */
const untouchedForm = (): AssetDto => ({
    name: "Laptop",
    purchaseCost: "1200" as unknown as number,
    currency: "GHS",
    usefulLifeMonths: "36" as unknown as number,
    residualValue: "" as unknown as number,
    departmentId: "d1",
    locationId: "l1",
    supplierId: "s1",
    purchaseOrderId: "po1",
    assignedUserId: "u1",
});

describe("asset update payload", () => {
    it("sends nothing when the form is untouched (purchase order preserved)", () => {
        expect(buildAssetUpdate(original, untouchedForm())).toEqual({});
    });

    it("keeps the purchase order when another field changes", () => {
        const patch = buildAssetUpdate(original, { ...untouchedForm(), name: "Laptop 2" });
        expect(patch).toEqual({ name: "Laptop 2" });
        expect(patch).not.toHaveProperty("purchaseOrderId");
        expect(patch).not.toHaveProperty("clearFields");
    });

    it("sends explicit clears for emptied relation selects", () => {
        const patch = buildAssetUpdate(original, {
            ...untouchedForm(),
            departmentId: "",
            supplierId: "",
            purchaseOrderId: "",
        });
        expect(patch.clearFields).toEqual(["departmentId", "supplierId", "purchaseOrderId"]);
        expect(patch).not.toHaveProperty("departmentId");
    });

    it("does not clear a relation the asset never had", () => {
        const patch = buildAssetUpdate({ ...original, locationId: undefined }, { ...untouchedForm(), locationId: "" });
        expect(patch).not.toHaveProperty("clearFields");
    });

    it("sends a changed relation as a value, not a clear", () => {
        expect(buildAssetUpdate(original, { ...untouchedForm(), locationId: "l2" })).toEqual({ locationId: "l2" });
    });
});

describe("normaliseAssetForm", () => {
    it("converts numbers and drops blanks instead of sending 0 or NaN", () => {
        const out = normaliseAssetForm({
            name: "Desk",
            purchaseCost: "250.5" as unknown as number,
            usefulLifeMonths: "" as unknown as number,
            residualValue: undefined,
            depreciationMethod: "",
            departmentId: "",
        });
        expect(out).toEqual({ name: "Desk", purchaseCost: 250.5 });
    });
});

describe("asset TCO inputs", () => {
    it("sends the premium and downtime cost as numbers", () => {
        const out = normaliseAssetForm({
            name: "Server", insurancePremiumPerYear: "1200.50", downtimeCostPerDay: "300",
        } as unknown as AssetDto);
        expect(out.insurancePremiumPerYear).toBe(1200.5);
        expect(out.downtimeCostPerDay).toBe(300);
    });

    it("clears an emptied premium, even a stored 0", () => {
        const withTco: Asset = { ...original, insurancePremiumPerYear: 0, insurancePolicyExpiry: "2027-01-01" };
        const patch = buildAssetUpdate(withTco, {
            ...untouchedForm(), insurancePremiumPerYear: "" as unknown as number, insurancePolicyExpiry: "",
        });
        expect(patch.clearFields).toEqual(expect.arrayContaining(["insurancePremiumPerYear", "insurancePolicyExpiry"]));
    });
});

describe("editableAssetStatuses", () => {
    it("never offers DISPOSED: disposal goes through an approved request", () => {
        expect(editableAssetStatuses("IN_USE")).not.toContain("DISPOSED");
        expect(editableAssetStatuses("IN_USE")).toContain("RETIRED");
    });

    it("keeps a disposed asset's status final", () => {
        expect(editableAssetStatuses("DISPOSED")).toEqual(["DISPOSED"]);
    });
});

describe("assetBookValue", () => {
    it("shows the net book value, not the cost", () => {
        expect(assetBookValue({ purchaseCost: 1200, currentBookValue: 900 })).toBe(900);
        expect(assetBookValue({ purchaseCost: 1200, currentBookValue: 0 })).toBe(0);
        expect(assetBookValue({ purchaseCost: 1200 })).toBe(1200);
    });
});
