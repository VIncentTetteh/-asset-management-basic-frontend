/**
 * Currency primitives shared by CurrencyContext, pages that total records,
 * and the tests. Pure functions only — no React, no network.
 *
 * Ground rules (these are what keep totals honest):
 *   - A conversion is only ever done with a real, tenant-governed rate. When no
 *     rate exists the conversion returns null; callers must never fall back to
 *     adding the raw amount into a total of another currency.
 *   - A total that had to skip lines is reported as incomplete, together with
 *     the missing pairs, so the UI can say so.
 */

import type { MoneyAggregateMeta } from "@/types";

/** Used only while the organisation's base currency is still loading. */
export const FALLBACK_CURRENCY = "USD";

/** Directed pair key, matching the backend's `missingRates` format: "USD->GHS". */
export type RatePair = `${string}->${string}`;

/** Latest effective rate per directed pair: 1 FROM = rate TO. */
export type RateMap = ReadonlyMap<RatePair, number>;

export interface ExchangeRateLike {
    baseCurrency?: string | null;
    targetCurrency?: string | null;
    rate?: number | null;
    effectiveDate?: string | null;
}

export interface MoneyLine {
    amount: number | null | undefined;
    currency?: string | null;
}

export interface MoneyTotal {
    /** Sum of every line that could be converted into `currency`. */
    total: number;
    currency: string;
    /** False when at least one line was excluded for lack of a rate. */
    complete: boolean;
    /** Unique missing pairs, e.g. ["USD->GHS"]. */
    missingRates: RatePair[];
    /** Unconverted per-currency subtotals — a fallback breakdown for the UI. */
    byCurrency: Record<string, number>;
}

const ISO_CODE = /^[A-Z]{3}$/;

/** Upper-cases and validates an ISO-4217 code; null when unusable. */
export const normalizeCurrencyCode = (code?: string | null): string | null => {
    const trimmed = code?.trim().toUpperCase();
    return trimmed && ISO_CODE.test(trimmed) ? trimmed : null;
};

export const ratePair = (from: string, to: string): RatePair => `${from}->${to}`;

/** "USD->GHS" → "USD→GHS" for display. */
export const describeRatePair = (pair: string): string => pair.replace("->", "→");

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Builds the latest-effective rate for every directed pair. Rates dated in the
 * future (relative to `asOf`) are ignored; undated rates rank oldest.
 */
export function buildRateMap(rates: readonly ExchangeRateLike[], asOf: Date = new Date()): Map<RatePair, number> {
    const today = isoDay(asOf);
    const best = new Map<RatePair, { rate: number; effective: string }>();
    for (const entry of rates) {
        const from = normalizeCurrencyCode(entry.baseCurrency);
        const to = normalizeCurrencyCode(entry.targetCurrency);
        const rate = entry.rate;
        if (!from || !to || from === to || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) continue;
        const effective = (entry.effectiveDate ?? "").slice(0, 10);
        if (effective && effective > today) continue;
        const key = ratePair(from, to);
        const current = best.get(key);
        if (!current || effective > current.effective) best.set(key, { rate, effective });
    }
    return new Map(Array.from(best, ([key, value]) => [key, value.rate]));
}

const directOrInverse = (from: string, to: string, rates: RateMap): number | null => {
    if (from === to) return 1;
    const direct = rates.get(ratePair(from, to));
    if (direct != null) return direct;
    const inverse = rates.get(ratePair(to, from));
    return inverse != null ? 1 / inverse : null;
};

/**
 * Rate for 1 `from` in `to`: direct, else inverse, else (when a pivot — the
 * org's base currency — is given) triangulated through it, since every
 * available currency has a rate to/from the base.
 */
export function resolveRate(from: string, to: string, rates: RateMap, pivot?: string | null): number | null {
    const source = normalizeCurrencyCode(from);
    const target = normalizeCurrencyCode(to);
    if (!source || !target) return null;
    const simple = directOrInverse(source, target, rates);
    if (simple != null) return simple;
    const via = normalizeCurrencyCode(pivot);
    if (!via || via === source || via === target) return null;
    const leg1 = directOrInverse(source, via, rates);
    const leg2 = directOrInverse(via, target, rates);
    return leg1 != null && leg2 != null ? leg1 * leg2 : null;
}

/** Converts `amount`; null (never a guess) when no rate is available. */
export function convertAmount(
    amount: number,
    from: string,
    to: string,
    rates: RateMap,
    pivot?: string | null,
): number | null {
    const rate = resolveRate(from, to, rates, pivot);
    return rate == null ? null : amount * rate;
}

/** Locale currency formatting that survives an unknown code instead of throwing. */
export function formatMoney(amount: number, currency: string, options: { compact?: boolean } = {}): string {
    try {
        return new Intl.NumberFormat("en-US", options.compact
            ? { style: "currency", currency, currencyDisplay: "narrowSymbol", notation: "compact", maximumFractionDigits: 1 }
            : { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 },
        ).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

/** Narrow symbol for a code ("$", "₵", "€"), or the code itself. */
export function currencySymbol(currency: string): string {
    try {
        const part = new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol" })
            .formatToParts(0)
            .find((p) => p.type === "currency");
        return part?.value ?? currency;
    } catch {
        return currency;
    }
}

/** Display name ("Ghana Cedi") where the runtime knows it. */
export function currencyName(currency: string): string {
    try {
        return new Intl.DisplayNames(["en"], { type: "currency" }).of(currency) ?? currency;
    } catch {
        return currency;
    }
}

/**
 * Sums money lines into `target`. Lines without a usable rate are excluded
 * (not added raw) and reported through `complete` / `missingRates`.
 */
export function sumMoney(
    lines: readonly MoneyLine[],
    target: string,
    rates: RateMap,
    options: { fallbackCurrency: string; pivot?: string | null },
): MoneyTotal {
    const byCurrency: Record<string, number> = {};
    const missing = new Set<RatePair>();
    let total = 0;
    for (const line of lines) {
        const amount = line.amount;
        if (typeof amount !== "number" || !Number.isFinite(amount)) continue;
        const currency = normalizeCurrencyCode(line.currency) ?? options.fallbackCurrency;
        byCurrency[currency] = (byCurrency[currency] ?? 0) + amount;
        const converted = convertAmount(amount, currency, target, rates, options.pivot);
        if (converted == null) missing.add(ratePair(currency, target));
        else total += converted;
    }
    return { total, currency: target, complete: missing.size === 0, missingRates: Array.from(missing), byCurrency };
}

/** Reads the backend's currency/complete/missingRates fields from a raw payload. */
export function readMoneyMeta(raw: Record<string, unknown> | null | undefined): MoneyAggregateMeta {
    if (!raw) return {};
    const currency = typeof raw.currency === "string" ? normalizeCurrencyCode(raw.currency) ?? undefined : undefined;
    const complete = typeof raw.complete === "boolean" ? raw.complete : undefined;
    const missingRates = Array.isArray(raw.missingRates)
        ? raw.missingRates.filter((r): r is string => typeof r === "string")
        : undefined;
    return { currency, complete, missingRates };
}

export interface CompletenessSummary {
    incomplete: boolean;
    missingRates: string[];
}

/** Merges completeness across several aggregates (pairs deduplicated). */
export function mergeCompleteness(
    ...metas: ReadonlyArray<Pick<MoneyAggregateMeta, "complete" | "missingRates"> | null | undefined>
): CompletenessSummary {
    const missing = new Set<string>();
    let incomplete = false;
    for (const meta of metas) {
        if (!meta || meta.complete !== false) continue;
        incomplete = true;
        for (const pair of meta.missingRates ?? []) missing.add(pair);
    }
    return { incomplete, missingRates: Array.from(missing) };
}

/** Used when the runtime cannot enumerate ISO-4217 codes. */
const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "GHS", "NGN", "KES", "ZAR", "XOF", "XAF", "EGP", "MAD", "CAD", "AUD", "JPY", "CNY", "INR", "AED", "CHF"];

/** Every ISO-4217 code the runtime knows, `preferred` codes first. */
export function isoCurrencyCodes(preferred: readonly string[] = []): string[] {
    let all: string[] = COMMON_CURRENCIES;
    try {
        const supported = Intl.supportedValuesOf("currency");
        if (supported.length > 0) all = supported;
    } catch {
        // Older runtimes: fall back to the common list.
    }
    const head = preferred.map((c) => normalizeCurrencyCode(c)).filter((c): c is string => c !== null);
    return Array.from(new Set([...head, ...all]));
}
