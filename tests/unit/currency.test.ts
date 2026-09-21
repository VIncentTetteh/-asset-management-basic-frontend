import { describe, expect, it } from "vitest";
import {
    buildRateMap,
    convertAmount,
    hasConversionPath,
    mergeCompleteness,
    normalizeCurrencyCode,
    resolveRate,
    sumMoney,
} from "@/lib/currency";

const AS_OF = new Date("2026-06-30T12:00:00Z");

describe("buildRateMap", () => {
    it("keeps the latest effective rate per pair and ignores future-dated, invalid and self rates", () => {
        const rates = buildRateMap(
            [
                { baseCurrency: "USD", targetCurrency: "GHS", rate: 10, effectiveDate: "2026-01-01" },
                { baseCurrency: "usd", targetCurrency: "ghs", rate: 12, effectiveDate: "2026-06-01" },
                { baseCurrency: "USD", targetCurrency: "GHS", rate: 99, effectiveDate: "2026-12-01" },
                { baseCurrency: "EUR", targetCurrency: "GHS", rate: 0, effectiveDate: "2026-01-01" },
                { baseCurrency: "GHS", targetCurrency: "GHS", rate: 1 },
            ],
            AS_OF,
        );
        expect(rates.get("USD->GHS")).toBe(12);
        expect(rates.has("EUR->GHS")).toBe(false);
        expect(rates.size).toBe(1);
    });
});

describe("resolveRate / convertAmount", () => {
    const rates = buildRateMap(
        [
            { baseCurrency: "USD", targetCurrency: "GHS", rate: 10, effectiveDate: "2026-01-01" },
            { baseCurrency: "GHS", targetCurrency: "EUR", rate: 0.08, effectiveDate: "2026-01-01" },
        ],
        AS_OF,
    );

    it("uses the direct rate", () => {
        expect(convertAmount(5, "USD", "GHS", rates)).toBe(50);
    });

    it("uses the inverse rate when only the opposite pair exists", () => {
        expect(convertAmount(50, "GHS", "USD", rates)).toBeCloseTo(5);
    });

    it("triangulates through intermediate currencies with or without a pivot", () => {
        expect(resolveRate("USD", "EUR", rates)).toBeCloseTo(0.8);
        expect(resolveRate("USD", "EUR", rates, "GHS")).toBeCloseTo(0.8);
    });

    it("returns null — never a guess — when no rate exists", () => {
        expect(convertAmount(100, "JPY", "GHS", rates, "GHS")).toBeNull();
    });

    it("treats same-currency conversion as identity", () => {
        expect(convertAmount(42, "ghs", "GHS", rates)).toBe(42);
    });
});

describe("sumMoney", () => {
    const rates = buildRateMap([{ baseCurrency: "USD", targetCurrency: "GHS", rate: 10 }], AS_OF);

    it("converts mixed currencies into the target", () => {
        const total = sumMoney(
            [
                { amount: 100, currency: "GHS" },
                { amount: 5, currency: "USD" },
                { amount: 20, currency: null }, // falls back to the base currency
            ],
            "GHS",
            rates,
            { fallbackCurrency: "GHS" },
        );
        expect(total).toMatchObject({ total: 170, currency: "GHS", complete: true, missingRates: [] });
        expect(total.byCurrency).toEqual({ GHS: 120, USD: 5 });
    });

    it("excludes lines without a rate and reports the total as partial", () => {
        const total = sumMoney(
            [
                { amount: 100, currency: "GHS" },
                { amount: 7, currency: "EUR" },
                { amount: 3, currency: "EUR" },
                { amount: undefined, currency: "USD" },
            ],
            "GHS",
            rates,
            { fallbackCurrency: "GHS" },
        );
        expect(total.total).toBe(100); // EUR is NOT added raw
        expect(total.complete).toBe(false);
        expect(total.missingRates).toEqual(["EUR->GHS"]);
        expect(total.byCurrency).toEqual({ GHS: 100, EUR: 10 });
    });
});

describe("mergeCompleteness", () => {
    it("flags any incomplete aggregate and dedupes pairs", () => {
        expect(
            mergeCompleteness(
                { complete: true },
                { complete: false, missingRates: ["USD->GHS"] },
                { complete: false, missingRates: ["USD->GHS", "EUR->GHS"] },
                null,
            ),
        ).toEqual({ incomplete: true, missingRates: ["USD->GHS", "EUR->GHS"] });
        expect(mergeCompleteness({ complete: true }, {})).toEqual({ incomplete: false, missingRates: [] });
    });
});

describe("normalizeCurrencyCode", () => {
    it("accepts ISO-4217 shapes only", () => {
        expect(normalizeCurrencyCode(" ghs ")).toBe("GHS");
        expect(normalizeCurrencyCode("CEDI")).toBeNull();
        expect(normalizeCurrencyCode(undefined)).toBeNull();
    });
});

describe("resolveRate multi-hop graph search", () => {
    const rates = buildRateMap(
        [
            { baseCurrency: "USD", targetCurrency: "GHS", rate: 10, effectiveDate: "2026-01-01" },
            { baseCurrency: "EUR", targetCurrency: "GHS", rate: 12, effectiveDate: "2026-01-01" },
            { baseCurrency: "GBP", targetCurrency: "EUR", rate: 1.2, effectiveDate: "2026-01-01" },
            // Future-dated: must not create a JPY path.
            { baseCurrency: "JPY", targetCurrency: "GHS", rate: 0.07, effectiveDate: "2026-12-01" },
        ],
        AS_OF,
    );

    it("converts EUR to USD via GHS when only USD->GHS and EUR->GHS exist", () => {
        // 1 EUR = 12 GHS; 1 GHS = 0.1 USD  =>  1 EUR = 1.2 USD
        expect(resolveRate("EUR", "USD", rates)).toBeCloseTo(1.2);
        expect(resolveRate("USD", "EUR", rates)).toBeCloseTo(10 / 12);
    });

    it("walks more than two hops", () => {
        // 1 GBP = 1.2 EUR = 14.4 GHS = 1.44 USD
        expect(resolveRate("GBP", "USD", rates)).toBeCloseTo(1.44);
    });

    it("uses the inverse edge", () => {
        expect(resolveRate("GHS", "EUR", rates)).toBeCloseTo(1 / 12);
    });

    it("returns null when the currencies are not connected", () => {
        expect(resolveRate("USD", "CHF", rates)).toBeNull();
        expect(hasConversionPath("USD", "CHF", rates)).toBe(false);
        expect(hasConversionPath("USD", "GBP", rates)).toBe(true);
    });

    it("ignores future-dated rates", () => {
        expect(resolveRate("JPY", "USD", rates)).toBeNull();
    });
});
