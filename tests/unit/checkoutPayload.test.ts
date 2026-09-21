import { describe, expect, it } from "vitest";
import { buildCheckInPayload, buildCheckOutPayload } from "@/features/checkouts/payload";

describe("checkout payloads", () => {
    it("omits blank inputs instead of sending empty strings", () => {
        expect(buildCheckOutPayload({ expectedReturnDate: "", conditionOnCheckout: "  ", notes: "" })).toEqual({
            expectedReturnDate: undefined,
            conditionOnCheckout: undefined,
            notes: undefined,
        });
    });

    it("trims and keeps given values", () => {
        expect(buildCheckOutPayload({ expectedReturnDate: "2026-10-01", conditionOnCheckout: " Good ", notes: "Charger" })).toEqual({
            expectedReturnDate: "2026-10-01",
            conditionOnCheckout: "Good",
            notes: "Charger",
        });
    });

    it("sends the return notes on check-in", () => {
        expect(buildCheckInPayload({ conditionOnReturn: "Damaged", notes: "Screen cracked" })).toEqual({
            conditionOnReturn: "Damaged",
            notes: "Screen cracked",
        });
    });
});
