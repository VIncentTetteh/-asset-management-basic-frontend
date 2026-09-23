/**
 * The five operational analytics payloads, as the backend actually sends them.
 *
 * Two conventions run through every type here and they are the whole point:
 *
 *   1. **A money key that is absent means "you may not see valuations", not
 *      zero.** The backend omits money entirely when the caller lacks the
 *      VALUATION section and names it in `withheldSections`. These types model
 *      that as `number | null` after normalisation, and every renderer must
 *      treat null as unknown — never format it as 0.
 *
 *   2. **A ratio is null when its denominator is zero.** A new tenant has no
 *      estate, so "what share is IT?" has no answer. Printing 0% or "—%" for
 *      that is a claim nothing supports.
 *
 * `/trends` deliberately has a different envelope: it reports recorded history,
 * so it carries how much history exists rather than a currency completeness
 * flag per aggregate.
 */

/**
 * The query to send to `/api/v1/assets` (or the owning register) to show the
 * rows behind a number.
 *
 * A `null` value is not a missing filter — it means "the records with no value
 * for this dimension", e.g. `{ departmentId: null }` is "assets in no
 * department". See `insightFilterLink` for what the register can and cannot
 * actually express.
 */
export type InsightFilter = Readonly<Record<string, string | null>>;

/** The envelope every insight but `/trends` carries. */
export interface InsightEnvelope {
    /** The date the figures describe (`YYYY-MM-DD`). */
    asOf: string;
    /** The currency every converted money figure in the payload is in. */
    currency: string;
    /**
     * False when at least one amount was excluded from a total for want of an
     * exchange rate. The total is then a floor, not the answer.
     */
    complete: boolean;
    /** Directed pairs that blocked a conversion, e.g. `["EUR->USD"]`. */
    missingRates: string[];
    /** Human labels of the sections the caller may not read, e.g. `["software licences"]`. */
    withheldSections: string[];
    generatedAt: string;
}

// ── 1. Estate ────────────────────────────────────────────────────────────────

export type EstateDimension = "department" | "location" | "category" | "status" | "condition";

export const ESTATE_DIMENSIONS: readonly EstateDimension[] = [
    "department",
    "location",
    "category",
    "status",
    "condition",
] as const;

export interface EstateGroup {
    /** The entity id to link on, or null for "records with no value here". */
    id: string | null;
    name: string;
    count: number;
    /** Share of the estate by count; null when the estate is empty. */
    countShare: number | null;
    cost: number | null;
    accumulatedDepreciation: number | null;
    netBookValue: number | null;
    monthlyDepreciation: number | null;
    costShare: number | null;
    assetsFullyDepreciated: number | null;
    filter: InsightFilter;
}

export interface EstateInsight extends InsightEnvelope {
    groupBy: EstateDimension;
    assetCount: number;
    /** Null when the caller may not see valuations — never render as zero. */
    totalCost: number | null;
    accumulatedDepreciation: number | null;
    netBookValue: number | null;
    monthlyDepreciation: number | null;
    assetsFullyDepreciated: number | null;
    assetsMissingDepreciationSetup: number | null;
    groups: EstateGroup[];
    /** True when the payload carried money at all (i.e. valuations are visible). */
    showsMoney: boolean;
}

// ── 2. Cost & waste ──────────────────────────────────────────────────────────

export type WasteFindingKey =
    | "FULLY_DEPRECIATED_ACTIVE"
    | "NOT_SEEN_IN_STOCK"
    | "UNASSIGNED_IN_USE"
    | "MISSING"
    | "UNUSABLE_CONDITION"
    | "LICENCE_UNUSED_SEATS"
    | "LICENCE_OVER_ALLOCATED";

export type InsightResourceType = "asset" | "licence" | "maintenance" | "contract" | "lease" | "budget";

export interface WasteItem {
    id: string;
    name: string;
    /** Asset tag, vendor — whatever identifies the record to a human. */
    reference: string | null;
    resourceType: InsightResourceType;
    status: string | null;
    departmentName: string | null;
    locationName: string | null;
    /** Converted into the response currency; null when no rate existed. */
    cost: number | null;
    netBookValue: number | null;
    /** Licence findings report one amount rather than cost/NBV. */
    amount: number | null;
    /** The currency the record is actually held in. */
    nativeCurrency: string | null;
    totalSeats: number | null;
    usedSeats: number | null;
    expiryDate: string | null;
    /** Why this record is in this finding, in words. */
    detail: string | null;
}

export interface WasteFinding {
    key: WasteFindingKey | string;
    title: string;
    /** What was actually counted. Always shown — the rule is arguable and the user may disagree. */
    explanation: string;
    resourceType: InsightResourceType;
    count: number;
    originalCost: number | null;
    netBookValue: number | null;
    annualCost: number | null;
    annualExposure: number | null;
    unusedSeats: number | null;
    excessSeats: number | null;
    filter: InsightFilter;
    items: WasteItem[];
    /** True when there are more records than `items` lists. */
    truncated: boolean;
}

export interface WasteInsight extends InsightEnvelope {
    idleDays: number;
    /** De-duplicated across findings, which overlap by design. */
    distinctAssetsFlagged: number;
    capitalTiedUp: number | null;
    licenceAnnualSavings: number | null;
    findings: WasteFinding[];
    showsMoney: boolean;
}

// ── 3. Expiring ──────────────────────────────────────────────────────────────

export type ExpiryStreamKey = "WARRANTY" | "INSURANCE" | "MAINTENANCE" | "CONTRACT" | "LICENCE" | "LEASE";

export interface ExpiryBucket {
    /** Derived from `horizonDays` server-side: read it, never hardcode it. */
    bucket: string;
    label: string;
    count: number;
    value: number | null;
    /** False when this bucket's value excluded an unconvertible amount. */
    valueComplete: boolean;
}

export interface ExpiryItem {
    id: string;
    name: string;
    reference: string | null;
    resourceType: InsightResourceType;
    dueDate: string;
    daysUntil: number;
    overdue: boolean;
    relatedId: string | null;
    relatedName: string | null;
    value: number | null;
    nativeCurrency: string | null;
}

export interface ExpiryStream {
    key: ExpiryStreamKey | string;
    label: string;
    resourceType: InsightResourceType;
    /** What this stream's money figure means. Shown, not guessed at. */
    valueMeaning: string;
    overdue: number;
    dueWithinHorizon: number;
    buckets: ExpiryBucket[];
    items: ExpiryItem[];
    truncated: boolean;
}

export interface ExpiryInsight extends InsightEnvelope {
    horizonDays: number;
    horizonEnd: string;
    totals: { overdue: number; dueWithinHorizon: number };
    /** A withheld stream is absent here and named in `withheldSections`. */
    streams: ExpiryStream[];
    showsMoney: boolean;
}

// ── 4. Spend ─────────────────────────────────────────────────────────────────

export interface SpendBudget {
    id: string;
    name: string;
    resourceType: InsightResourceType;
    status: string | null;
    departmentId: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    fiscalYear: number | null;
    nativeCurrency: string | null;
    /** Converted; null when this budget's currency has no rate. */
    total: number | null;
    spent: number | null;
    committed: number | null;
    available: number | null;
    /** Computed in the budget's own currency, so a missing rate cannot distort it. */
    burnPercent: number | null;
    elapsedPercent: number | null;
    alertThresholdPct: number | null;
    overThreshold: boolean;
    filter: InsightFilter;
}

export interface SpendInsight extends InsightEnvelope {
    windowStart: string;
    windowEnd: string;
    budgetCount: number;
    totalBudget: number | null;
    spent: number | null;
    committed: number | null;
    available: number | null;
    /** Null when there is no budget to be a percentage of. */
    spentPercent: number | null;
    committedPercent: number | null;
    burnPercent: number | null;
    periodElapsedPercent: number | null;
    /** Burn minus elapsed. Positive = spending ahead of the calendar. */
    pacePercentagePoints: number | null;
    /** Deliberately null in the first 5% of a period. */
    projectedSpendAtPeriodEnd: number | null;
    budgetsOverThreshold: number;
    budgets: SpendBudget[];
}

// ── 5. Trends ────────────────────────────────────────────────────────────────

export interface TrendPoint {
    date: string;
    assetCount: number;
    activeAssetCount: number;
    notSeenAssetCount: number;
    unassignedInUseCount: number;
    fullyDepreciatedCount: number;
    overdueMaintenanceCount: number;
    licenceSeatsTotal: number;
    licenceSeatsUsed: number;
    totalCost: number | null;
    netBookValue: number | null;
    accumulatedDepreciation: number | null;
    monthlyDepreciation: number | null;
    /** The base currency on the day this point was recorded. */
    currency: string | null;
    complete: boolean;
}

export interface TrendChange {
    comparable: boolean;
    from: string | null;
    to: string | null;
    assetCount: number | null;
    activeAssetCount: number | null;
    notSeenAssetCount: number | null;
    unassignedInUseCount: number | null;
    overdueMaintenanceCount: number | null;
    licenceSeatsUsed: number | null;
    totalCost: number | null;
    netBookValue: number | null;
    currency: string | null;
    /** False when the base currency changed, so money deltas are meaningless. */
    moneyComparable: boolean;
    note: string | null;
}

/** `/trends` has its own envelope: history, not a converted aggregate. */
export interface TrendsInsight {
    asOf: string;
    days: number;
    withheldSections: string[];
    generatedAt: string;
    /** Date of the very first snapshot ever recorded, or null if there is none. */
    firstSnapshot: string | null;
    historyDays: number;
    pointCount: number;
    /** False when there are too few points to call it a trend. Render `note` instead of a chart. */
    sufficientHistory: boolean;
    /** The backend's own words about why there is little or no history. */
    note: string | null;
    currencies: string[];
    /** Null when the series spans more than one base currency. */
    currency: string | null;
    /** True when the tenant changed base currency mid-series: break the line. */
    currencyChanged: boolean;
    /** True when any point excluded an amount for want of a rate. */
    anyIncomplete: boolean;
    points: TrendPoint[];
    change: TrendChange;
}
