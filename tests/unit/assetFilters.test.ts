import { describe, expect, it } from "vitest";
import {
    assetQueryParams, hasAdvancedAssetFilters, readAssetFilters, sortParamToState, sortStateToParam,
} from "@/features/assets/assetFilters";

const params = (entries: Record<string, string>) => (key: string) => entries[key] ?? null;

describe("asset register filters", () => {
    it("sends condition, type, category and warranty filters together with the rest", () => {
        const filters = readAssetFilters(params({
            status: "UNDER_REPAIR",
            condition: "POOR",
            assetType: "VEHICLE",
            categoryId: "c1",
            warrantyExpiryBefore: "2026-12-31",
            assigned: "false",
        }));

        expect(assetQueryParams(filters, "van")).toEqual({
            search: "van",
            status: "UNDER_REPAIR",
            condition: "POOR",
            assetType: "VEHICLE",
            categoryId: "c1",
            departmentId: undefined,
            locationId: undefined,
            purchaseDateFrom: undefined,
            purchaseDateTo: undefined,
            warrantyExpiryBefore: "2026-12-31",
            assigned: false,
            page: 0,
            size: 20,
            sort: "name,asc",
        });
        expect(hasAdvancedAssetFilters(filters)).toBe(true);
    });

    it("omits the ALL status and blank filters", () => {
        const q = assetQueryParams(readAssetFilters(params({})), "");
        expect(q.status).toBeUndefined();
        expect(q.condition).toBeUndefined();
        expect(hasAdvancedAssetFilters(readAssetFilters(params({})))).toBe(false);
    });
});

describe("asset register sort", () => {
    it("maps the book value column to the API's currentBookValue", () => {
        expect(sortStateToParam([{ id: "bookValue", desc: true }])).toBe("currentBookValue,desc");
        expect(sortParamToState("currentBookValue,desc")).toEqual([{ id: "bookValue", desc: true }]);
    });

    it("falls back to name ascending when no sortable column is chosen", () => {
        expect(sortStateToParam([])).toBe("name,asc");
        expect(sortStateToParam([{ id: "department", desc: false }])).toBe("name,asc");
        expect(sortParamToState("unknown,asc")).toEqual([]);
    });
});
