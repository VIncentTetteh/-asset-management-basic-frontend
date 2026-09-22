import { describe, expect, it } from "vitest";
import { lineTotalOf, netOf, orderTotalOf, roundTo, taxOf } from "@/features/finance/lineTotals";
import { buildPoLineItems, buildPurchaseOrderPayload } from "@/features/finance/payloads";

/**
 * The frontend arithmetic has to agree with PurchaseOrderTotals on the server,
 * because the running total shown while typing is compared, by eye, against the
 * total that comes back. The cases below are the same ones the backend's
 * PurchaseOrderTotalsTest pins.
 */
describe("purchase order line arithmetic", () => {
    it("nets quantity against unit price at four decimals", () => {
        expect(netOf(3, 12.5)).toBe(37.5);
        expect(netOf("3", "12.5")).toBe(37.5);
    });

    it("treats a blank quantity or price as zero rather than NaN", () => {
        expect(netOf("", 10)).toBe(0);
        expect(netOf(10, "")).toBe(0);
        expect(netOf("abc", 10)).toBe(0);
    });

    it("lets a tax rate win over a typed tax amount, as the server does", () => {
        expect(taxOf(100, 12.5, 999)).toBe(12.5);
    });

    it("takes an explicit tax amount when there is no rate", () => {
        expect(taxOf(100, "", 7.25)).toBe(7.25);
        expect(taxOf(100, null, null)).toBe(0);
    });

    it("adds tax to the net for the line total", () => {
        expect(lineTotalOf({ quantity: 2, unitPrice: 50, taxRate: 10 })).toBe(110);
        expect(lineTotalOf({ quantity: 2, unitPrice: "1200.00", taxRate: "12.5" })).toBe(2700);
    });

    it("sums the lines and rounds once, to two decimals", () => {
        const thirds = [
            { quantity: 1, unitPrice: 0.3333 },
            { quantity: 1, unitPrice: 0.3333 },
            { quantity: 1, unitPrice: 0.3333 },
        ];
        expect(orderTotalOf(thirds)).toBe(1);
        expect(orderTotalOf([])).toBe(0);
        expect(orderTotalOf([{ quantity: 2, unitPrice: 100, taxRate: 12.5 }, { quantity: 1, unitPrice: 50 }]))
            .toBe(275);
    });

    it("rounds half up rather than to even", () => {
        expect(roundTo(1.005, 2)).toBe(1.01);
        expect(roundTo(2.675, 2)).toBe(2.68);
        expect(roundTo(-1.005, 2)).toBe(-1.01);
    });
});

describe("purchase order line payload", () => {
    const line = {
        description: "  Dell Latitude 5450  ",
        supplierPartNumber: " LAT-5450 ",
        categoryId: "cat-1",
        quantity: "2",
        unitPrice: "1200.00",
        taxRate: "12.5",
    };

    it("trims text, converts numbers and derives nothing the server owns", () => {
        expect(buildPoLineItems([line])).toEqual([{
            description: "Dell Latitude 5450",
            supplierPartNumber: "LAT-5450",
            categoryId: "cat-1",
            quantity: 2,
            unitPrice: 1200,
            taxRate: 12.5,
            taxAmount: null,
        }]);
    });

    it("never sends a tax amount alongside a rate", () => {
        const [withRate] = buildPoLineItems([{ ...line, taxAmount: "999" }]);
        expect(withRate.taxAmount).toBeNull();
        const [withoutRate] = buildPoLineItems([{ ...line, taxRate: "", taxAmount: "7.25" }]);
        expect(withoutRate.taxAmount).toBe(7.25);
        expect(withoutRate.taxRate).toBeNull();
    });

    it("sends null for blank optional fields so a PUT clears them", () => {
        const [only] = buildPoLineItems([{ description: "Cable", quantity: "1", unitPrice: "5" }]);
        expect(only.supplierPartNumber).toBeNull();
        expect(only.categoryId).toBeNull();
        expect(only.taxRate).toBeNull();
    });

    it("drops a row the user added and left empty", () => {
        expect(buildPoLineItems([
            line,
            { description: "", supplierPartNumber: "", categoryId: "", quantity: "", unitPrice: "", taxRate: "" },
        ])).toHaveLength(1);
    });

    it("keeps a partly filled row so the server can report the missing field", () => {
        expect(buildPoLineItems([{ description: "Half typed", quantity: "", unitPrice: "" }])).toHaveLength(1);
    });
});

describe("purchase order payload with lines", () => {
    const base = { poNumber: "PO-9", departmentId: "d1", supplierId: "s1", totalAmount: "1" };

    it("derives the total from the lines and ignores the typed one", () => {
        const payload = buildPurchaseOrderPayload({
            ...base,
            lineItems: [
                { description: "A", quantity: "2", unitPrice: "1200.00", taxRate: "12.5" },
                { description: "B", quantity: "2", unitPrice: "150.00" },
            ],
        });
        expect(payload.totalAmount).toBe(3000);
        expect(payload.lineItems).toHaveLength(2);
    });

    it("leaves the typed total alone when the order is a lump sum", () => {
        expect(buildPurchaseOrderPayload({ ...base, totalAmount: "250.5" }).totalAmount).toBe(250.5);
        expect(buildPurchaseOrderPayload({ ...base, totalAmount: "250.5" }).lineItems).toEqual([]);
    });

    it("always sends the array, so a PUT that removes every line clears them", () => {
        const payload = buildPurchaseOrderPayload({ ...base, lineItems: [] });
        expect(payload.lineItems).toEqual([]);
    });
});
