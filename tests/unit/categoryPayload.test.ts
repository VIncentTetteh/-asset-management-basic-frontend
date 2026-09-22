import { describe, expect, it } from "vitest";
import { buildCategoryUpdate, normaliseCategoryForm } from "@/features/categories/categoryPayload";
import type { Category, CategoryDto } from "@/types";

const original: Category = {
    id: "c1",
    name: "Laptops",
    description: "Portable computers",
    assetPrefixCode: "LT",
    defaultWarrantyPeriodMonths: 24,
    parentCategoryId: "p1",
    depreciationPolicyId: "dp1",
} as Category;

const form = (overrides: Record<string, unknown> = {}): CategoryDto => ({
    name: "Laptops",
    description: "Portable computers",
    assetPrefixCode: "LT",
    defaultWarrantyPeriodMonths: "24" as unknown as number,
    parentCategoryId: "p1",
    depreciationPolicyId: "dp1",
    ...overrides,
}) as CategoryDto;

describe("category update payload", () => {
    it("sends nothing when untouched", () => {
        expect(buildCategoryUpdate(original, form())).toEqual({});
    });

    it("clears emptied description, prefix and warranty", () => {
        const patch = buildCategoryUpdate(original, form({ description: "", assetPrefixCode: "", defaultWarrantyPeriodMonths: "" }));
        expect(patch.clearFields).toEqual(["description", "assetPrefixCode", "defaultWarrantyPeriodMonths"]);
        expect(patch).not.toHaveProperty("assetPrefixCode");
    });

    it("keeps a zero warranty as a value", () => {
        expect(normaliseCategoryForm(form({ defaultWarrantyPeriodMonths: "0" })).defaultWarrantyPeriodMonths).toBe(0);
    });
});
