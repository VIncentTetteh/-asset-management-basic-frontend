import { describe, expect, it } from "vitest";
import { buildAssetUpdate, normaliseAssetForm } from "@/features/assets/assetPayload";
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
