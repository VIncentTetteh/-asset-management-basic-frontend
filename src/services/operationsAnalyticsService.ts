import api from "@/lib/axios";
import { FALLBACK_CURRENCY, normalizeCurrencyCode } from "@/lib/currency";
import type {
    EstateDimension,
    EstateGroup,
    EstateInsight,
    ExpiryBucket,
    ExpiryInsight,
    ExpiryItem,
    ExpiryStream,
    InsightFilter,
    InsightResourceType,
    SpendBudget,
    SpendInsight,
    TrendChange,
    TrendPoint,
    TrendsInsight,
    WasteFinding,
    WasteInsight,
    WasteItem,
} from "@/features/insights/types";

/**
 * The five operational analytics endpoints.
 *
 * The normalisers here exist for one reason: **to keep null and zero apart.**
 * `toNumber` in `analyticsService.ts` coerces a missing key to 0, which is the
 * right default for a count and a lie for money — the backend omits money keys
 * when the caller may not see valuations, and returns a null amount for a
 * record whose currency has no exchange rate. Both mean "unknown"; neither
 * means "free". So every money field here goes through {@link money}, which
 * returns null for anything that is not a finite number, and every renderer
 * downstream is written to show that as unknown rather than as a currency
 * symbol followed by 0.00.
 *
 * Counts go through {@link count}, which does default to 0, because a count the
 * backend did not send genuinely is "none found".
 */

const asRecord = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** A finite number, or null. Strings are parsed: BigDecimal often serialises as one. */
const money = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value.replace(/,/g, "").trim());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

/** A count. Absent or unusable means none. */
const count = (value: unknown): number => money(value) ?? 0;

/** A ratio. Absent means "not defined", which is not the same as 0%. */
const ratio = (value: unknown): number | null => money(value);

const text = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value : null;

const required = (value: unknown, fallback: string): string => text(value) ?? fallback;

const flag = (value: unknown, fallback = false): boolean =>
    typeof value === "boolean" ? value : fallback;

const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const records = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? value.map(asRecord) : [];

const RESOURCE_TYPES: readonly InsightResourceType[] = [
    "asset", "licence", "maintenance", "contract", "lease", "budget",
];

const resourceType = (value: unknown, fallback: InsightResourceType): InsightResourceType => {
    const raw = text(value)?.toLowerCase();
    return RESOURCE_TYPES.find((t) => t === raw) ?? fallback;
};

/**
 * The filter that opens the records behind a figure. A null value is kept as
 * null: it means "records with no value for this dimension", which is a real
 * set, not an absent filter.
 */
const filterOf = (value: unknown): InsightFilter => {
    const raw = asRecord(value);
    const out: Record<string, string | null> = {};
    for (const [key, entry] of Object.entries(raw)) {
        out[key] = entry == null ? null : String(entry);
    }
    return out;
};

/** True when the payload carried any of the money keys that permission gates. */
const carriesMoney = (raw: Record<string, unknown>, ...keys: string[]): boolean =>
    keys.some((key) => Object.prototype.hasOwnProperty.call(raw, key));

interface Envelope {
    asOf: string;
    currency: string;
    complete: boolean;
    missingRates: string[];
    withheldSections: string[];
    generatedAt: string;
}

const envelope = (raw: Record<string, unknown>): Envelope => ({
    asOf: required(raw.asOf, ""),
    currency: normalizeCurrencyCode(text(raw.currency)) ?? FALLBACK_CURRENCY,
    // Default true: a payload that says nothing about completeness has not
    // told us anything was dropped. `false` is the claim that needs evidence.
    complete: flag(raw.complete, true),
    missingRates: strings(raw.missingRates),
    withheldSections: strings(raw.withheldSections),
    generatedAt: required(raw.generatedAt, ""),
});

// ── Estate ───────────────────────────────────────────────────────────────────

const DIMENSIONS: readonly EstateDimension[] = ["department", "location", "category", "status", "condition"];

const estateGroup = (raw: Record<string, unknown>): EstateGroup => ({
    id: text(raw.id),
    name: required(raw.name, "Unknown"),
    count: count(raw.count),
    countShare: ratio(raw.countShare),
    cost: money(raw.cost),
    accumulatedDepreciation: money(raw.accumulatedDepreciation),
    netBookValue: money(raw.netBookValue),
    monthlyDepreciation: money(raw.monthlyDepreciation),
    costShare: ratio(raw.costShare),
    assetsFullyDepreciated: money(raw.assetsFullyDepreciated),
    filter: filterOf(raw.filter),
});

const normalizeEstate = (payload: unknown): EstateInsight => {
    const raw = asRecord(payload);
    const groupBy = DIMENSIONS.find((d) => d === text(raw.groupBy)) ?? "department";
    return {
        ...envelope(raw),
        groupBy,
        assetCount: count(raw.assetCount),
        totalCost: money(raw.totalCost),
        accumulatedDepreciation: money(raw.accumulatedDepreciation),
        netBookValue: money(raw.netBookValue),
        monthlyDepreciation: money(raw.monthlyDepreciation),
        assetsFullyDepreciated: money(raw.assetsFullyDepreciated),
        assetsMissingDepreciationSetup: money(raw.assetsMissingDepreciationSetup),
        groups: records(raw.groups).map(estateGroup),
        showsMoney: carriesMoney(raw, "totalCost", "netBookValue", "accumulatedDepreciation"),
    };
};

// ── Cost & waste ─────────────────────────────────────────────────────────────

const wasteItem = (raw: Record<string, unknown>, fallbackType: InsightResourceType): WasteItem => ({
    id: required(raw.id, ""),
    name: required(raw.name, "Untitled"),
    reference: text(raw.reference),
    resourceType: resourceType(raw.resourceType, fallbackType),
    status: text(raw.status),
    departmentName: text(raw.departmentName),
    locationName: text(raw.locationName),
    cost: money(raw.cost),
    netBookValue: money(raw.netBookValue),
    amount: money(raw.amount),
    nativeCurrency: normalizeCurrencyCode(text(raw.nativeCurrency)),
    totalSeats: money(raw.totalSeats),
    usedSeats: money(raw.usedSeats),
    expiryDate: text(raw.expiryDate),
    detail: text(raw.detail),
});

const wasteFinding = (raw: Record<string, unknown>): WasteFinding => {
    const type = resourceType(raw.resourceType, "asset");
    return {
        key: required(raw.key, "UNKNOWN"),
        title: required(raw.title, "Finding"),
        explanation: required(raw.explanation, ""),
        resourceType: type,
        count: count(raw.count),
        originalCost: money(raw.originalCost),
        netBookValue: money(raw.netBookValue),
        annualCost: money(raw.annualCost),
        annualExposure: money(raw.annualExposure),
        unusedSeats: money(raw.unusedSeats),
        excessSeats: money(raw.excessSeats),
        filter: filterOf(raw.filter),
        items: records(raw.items).map((item) => wasteItem(item, type)),
        truncated: flag(raw.truncated),
    };
};

const normalizeWaste = (payload: unknown): WasteInsight => {
    const raw = asRecord(payload);
    return {
        ...envelope(raw),
        idleDays: count(raw.idleDays),
        distinctAssetsFlagged: count(raw.distinctAssetsFlagged),
        capitalTiedUp: money(raw.capitalTiedUp),
        licenceAnnualSavings: money(raw.licenceAnnualSavings),
        findings: records(raw.findings).map(wasteFinding),
        showsMoney: carriesMoney(raw, "capitalTiedUp", "licenceAnnualSavings"),
    };
};

// ── Expiring ─────────────────────────────────────────────────────────────────

const expiryBucket = (raw: Record<string, unknown>): ExpiryBucket => ({
    bucket: required(raw.bucket, ""),
    label: required(raw.label, ""),
    count: count(raw.count),
    value: money(raw.value),
    valueComplete: flag(raw.valueComplete, true),
});

const expiryItem = (raw: Record<string, unknown>, fallbackType: InsightResourceType): ExpiryItem => ({
    id: required(raw.id, ""),
    name: required(raw.name, "Untitled"),
    reference: text(raw.reference),
    resourceType: resourceType(raw.resourceType, fallbackType),
    dueDate: required(raw.dueDate, ""),
    daysUntil: count(raw.daysUntil),
    overdue: flag(raw.overdue),
    relatedId: text(raw.relatedId),
    relatedName: text(raw.relatedName),
    value: money(raw.value),
    nativeCurrency: normalizeCurrencyCode(text(raw.nativeCurrency)),
});

const expiryStream = (raw: Record<string, unknown>): ExpiryStream => {
    const type = resourceType(raw.resourceType, "asset");
    return {
        key: required(raw.key, "UNKNOWN"),
        label: required(raw.label, "Stream"),
        resourceType: type,
        valueMeaning: required(raw.valueMeaning, ""),
        overdue: count(raw.overdue),
        dueWithinHorizon: count(raw.dueWithinHorizon),
        buckets: records(raw.buckets).map(expiryBucket),
        items: records(raw.items).map((item) => expiryItem(item, type)),
        truncated: flag(raw.truncated),
    };
};

const normalizeExpiry = (payload: unknown): ExpiryInsight => {
    const raw = asRecord(payload);
    const totals = asRecord(raw.totals);
    const streams = records(raw.streams).map(expiryStream);
    return {
        ...envelope(raw),
        horizonDays: count(raw.horizonDays),
        horizonEnd: required(raw.horizonEnd, ""),
        totals: { overdue: count(totals.overdue), dueWithinHorizon: count(totals.dueWithinHorizon) },
        streams,
        // Money on this surface lives on buckets and items, so the flag is read
        // from the first bucket that exists rather than a top-level key.
        showsMoney: streams.some((s) => s.buckets.some((b) => b.value !== null))
            || streams.some((s) => s.items.some((i) => i.value !== null)),
    };
};

// ── Spend ────────────────────────────────────────────────────────────────────

const spendBudget = (raw: Record<string, unknown>): SpendBudget => ({
    id: required(raw.id, ""),
    name: required(raw.name, "Untitled budget"),
    resourceType: resourceType(raw.resourceType, "budget"),
    status: text(raw.status),
    departmentId: text(raw.departmentId),
    periodStart: text(raw.periodStart),
    periodEnd: text(raw.periodEnd),
    fiscalYear: money(raw.fiscalYear),
    nativeCurrency: normalizeCurrencyCode(text(raw.nativeCurrency)),
    total: money(raw.total),
    spent: money(raw.spent),
    committed: money(raw.committed),
    available: money(raw.available),
    burnPercent: ratio(raw.burnPercent),
    elapsedPercent: ratio(raw.elapsedPercent),
    alertThresholdPct: ratio(raw.alertThresholdPct),
    overThreshold: flag(raw.overThreshold),
    filter: filterOf(raw.filter),
});

const normalizeSpend = (payload: unknown): SpendInsight => {
    const raw = asRecord(payload);
    return {
        ...envelope(raw),
        windowStart: required(raw.windowStart, ""),
        windowEnd: required(raw.windowEnd, ""),
        budgetCount: count(raw.budgetCount),
        totalBudget: money(raw.totalBudget),
        spent: money(raw.spent),
        committed: money(raw.committed),
        available: money(raw.available),
        spentPercent: ratio(raw.spentPercent),
        committedPercent: ratio(raw.committedPercent),
        burnPercent: ratio(raw.burnPercent),
        periodElapsedPercent: ratio(raw.periodElapsedPercent),
        pacePercentagePoints: ratio(raw.pacePercentagePoints),
        projectedSpendAtPeriodEnd: money(raw.projectedSpendAtPeriodEnd),
        budgetsOverThreshold: count(raw.budgetsOverThreshold),
        budgets: records(raw.budgets).map(spendBudget),
    };
};

// ── Trends ───────────────────────────────────────────────────────────────────

const trendPoint = (raw: Record<string, unknown>): TrendPoint => ({
    date: required(raw.date, ""),
    assetCount: count(raw.assetCount),
    activeAssetCount: count(raw.activeAssetCount),
    notSeenAssetCount: count(raw.notSeenAssetCount),
    unassignedInUseCount: count(raw.unassignedInUseCount),
    fullyDepreciatedCount: count(raw.fullyDepreciatedCount),
    overdueMaintenanceCount: count(raw.overdueMaintenanceCount),
    licenceSeatsTotal: count(raw.licenceSeatsTotal),
    licenceSeatsUsed: count(raw.licenceSeatsUsed),
    totalCost: money(raw.totalCost),
    netBookValue: money(raw.netBookValue),
    accumulatedDepreciation: money(raw.accumulatedDepreciation),
    monthlyDepreciation: money(raw.monthlyDepreciation),
    currency: normalizeCurrencyCode(text(raw.currency)),
    complete: flag(raw.complete, true),
});

const trendChange = (raw: Record<string, unknown>): TrendChange => ({
    comparable: flag(raw.comparable),
    from: text(raw.from),
    to: text(raw.to),
    assetCount: money(raw.assetCount),
    activeAssetCount: money(raw.activeAssetCount),
    notSeenAssetCount: money(raw.notSeenAssetCount),
    unassignedInUseCount: money(raw.unassignedInUseCount),
    overdueMaintenanceCount: money(raw.overdueMaintenanceCount),
    licenceSeatsUsed: money(raw.licenceSeatsUsed),
    totalCost: money(raw.totalCost),
    netBookValue: money(raw.netBookValue),
    currency: normalizeCurrencyCode(text(raw.currency)),
    moneyComparable: flag(raw.moneyComparable, true),
    note: text(raw.note),
});

const normalizeTrends = (payload: unknown): TrendsInsight => {
    const raw = asRecord(payload);
    const points = records(raw.points).map(trendPoint);
    const currencies = strings(raw.currencies);
    return {
        asOf: required(raw.asOf, ""),
        days: count(raw.days),
        withheldSections: strings(raw.withheldSections),
        generatedAt: required(raw.generatedAt, ""),
        firstSnapshot: text(raw.firstSnapshot),
        historyDays: count(raw.historyDays),
        pointCount: count(raw.pointCount),
        sufficientHistory: flag(raw.sufficientHistory),
        note: text(raw.note),
        currencies,
        currency: normalizeCurrencyCode(text(raw.currency)),
        currencyChanged: flag(raw.currencyChanged, currencies.length > 1),
        anyIncomplete: flag(raw.anyIncomplete),
        points,
        change: trendChange(asRecord(raw.change)),
    };
};

// ── Requests ─────────────────────────────────────────────────────────────────

export interface ExpiryParams {
    horizonDays?: number;
    limit?: number;
}

export interface WasteParams {
    idleDays?: number;
    limit?: number;
}

export interface SpendParams {
    /** `YYYY-MM-DD`; defaults server-side to the current calendar year. */
    from?: string;
    to?: string;
}

export const operationsAnalyticsService = {
    getEstate: async (groupBy: EstateDimension): Promise<EstateInsight> => {
        const response = await api.get("/analytics/estate", { params: { groupBy } });
        return normalizeEstate(response.data);
    },
    getCostWaste: async (params?: WasteParams): Promise<WasteInsight> => {
        const response = await api.get("/analytics/cost-waste", { params });
        return normalizeWaste(response.data);
    },
    getExpiring: async (params?: ExpiryParams): Promise<ExpiryInsight> => {
        const response = await api.get("/analytics/expiring", { params });
        return normalizeExpiry(response.data);
    },
    getSpend: async (params?: SpendParams): Promise<SpendInsight> => {
        const response = await api.get("/analytics/spend", { params });
        return normalizeSpend(response.data);
    },
    getTrends: async (days?: number): Promise<TrendsInsight> => {
        const response = await api.get("/analytics/trends", { params: days ? { days } : undefined });
        return normalizeTrends(response.data);
    },
};

/** Exported for tests: the normalisers, without going through axios. */
export const __normalisers = {
    normalizeEstate,
    normalizeWaste,
    normalizeExpiry,
    normalizeSpend,
    normalizeTrends,
};
