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

describe("checkout recipient", () => {
    it("issues to an employee when that option is picked, else to the user", async () => {
        const { checkoutRecipient, NOTES_MAX_LENGTH } = await import("@/features/checkouts/payload");
        expect(checkoutRecipient({ recipientType: "employee", userId: "u1", employeeId: "e1" }))
            .toEqual({ kind: "employee", id: "e1" });
        expect(checkoutRecipient({ recipientType: "user", userId: "u1", employeeId: "e1" }))
            .toEqual({ kind: "user", id: "u1" });
        expect(NOTES_MAX_LENGTH).toBe(2000);
    });
});
