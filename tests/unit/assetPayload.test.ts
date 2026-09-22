import { describe, expect, it } from "vitest";
import {
    assetBookValue, assetDepreciationMethods, buildAssetUpdate, editableAssetStatuses, normaliseAssetForm,
} from "@/features/assets/assetPayload";
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

describe("clearing optional asset fields", () => {
    it("clears emptied identifiers, dates, cost, category and depreciation overrides", () => {
        const withValues: Asset = {
            ...original,
            categoryId: "c1",
            assetTag: "LT-1",
            serialNumber: "SN",
            manufacturer: "Dell",
            model: "XPS",
            description: "Spare",
            purchaseDate: "2024-01-01",
            warrantyExpiryDate: "2026-01-01",
            depreciationMethod: "DECLINING_BALANCE",
            costCenter: "CC-1",
            procurementType: "CAPEX",
            invoiceId: "INV-1",
        };
        const emptied = {
            ...untouchedForm(),
            categoryId: "", assetTag: "", serialNumber: "", manufacturer: "", model: "", description: "",
            purchaseDate: "", warrantyExpiryDate: "", depreciationMethod: "", usefulLifeMonths: "",
            purchaseCost: "", costCenter: "", procurementType: "", invoiceId: "",
        } as unknown as AssetDto;

        const patch = buildAssetUpdate(withValues, emptied);

        expect(new Set(patch.clearFields)).toEqual(new Set([
            "categoryId", "assetTag", "serialNumber", "manufacturer", "model", "description", "purchaseDate",
            "warrantyExpiryDate", "depreciationMethod", "usefulLifeMonths", "purchaseCost", "costCenter",
            "procurementType", "invoiceId",
        ]));
        expect(patch).not.toHaveProperty("purchaseCost");
    });

    it("creates an asset without a cost", () => {
        expect(normaliseAssetForm({ name: "Desk", purchaseCost: "" as unknown as number })).toEqual({ name: "Desk" });
    });
});

describe("asset depreciation methods", () => {
    it("hides units of production, which assets apply as straight-line", () => {
        expect(assetDepreciationMethods()).not.toContain("UNITS_OF_PRODUCTION");
    });

    it("keeps units of production for an asset that already has it", () => {
        expect(assetDepreciationMethods("UNITS_OF_PRODUCTION")).toContain("UNITS_OF_PRODUCTION");
    });
});

describe("residual value rule", () => {
    it("allows a residual up to the cost, and blanks", async () => {
        const { residualWithinCost } = await import("@/features/assets/assetPayload");
        expect(residualWithinCost("100", "1000")).toBe(true);
        expect(residualWithinCost("1000", "1000")).toBe(true);
        expect(residualWithinCost("1000.01", "1000")).toBe(false);
        expect(residualWithinCost("", "1000")).toBe(true);
        expect(residualWithinCost("5", "")).toBe(true);
    });
});
