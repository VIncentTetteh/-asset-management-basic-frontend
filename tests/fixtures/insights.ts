/**
 * Realistic payloads for the five operational analytics endpoints, exactly as
 * the backend serialises them.
 *
 * These are raw responses, not normalised objects, so anything that consumes
 * them goes through `operationsAnalyticsService`'s normalisers first — which is
 * the point: the tests exercise the parsing as well as the rendering.
 *
 * `tests/unit/operationsAnalytics.test.tsx` asserts against these, and the
 * screenshot pass that reviewed the surfaces on a real page served the same
 * bytes over a stubbed API, so the screen a human checked and the screen the
 * suite checks are the same screen.
 */

const ASOF = "2026-09-23";
const GENERATED = "2026-09-23T09:14:02Z";

// ── Estate ───────────────────────────────────────────────────────────────────

export const estateByDepartment = {
    asOf: ASOF,
    currency: "USD",
    complete: true,
    missingRates: [],
    withheldSections: [],
    groupBy: "department",
    assetCount: 1284,
    totalCost: 4182600.0,
    accumulatedDepreciation: 1974310.25,
    netBookValue: 2208289.75,
    monthlyDepreciation: 41230.5,
    assetsFullyDepreciated: 212,
    assetsMissingDepreciationSetup: 37,
    groups: [
        {
            id: "6f1a1d1e-0001-4f00-9a00-000000000001",
            name: "Engineering",
            count: 512,
            countShare: 39.9,
            cost: 2104880.0,
            accumulatedDepreciation: 1012440.0,
            netBookValue: 1092440.0,
            monthlyDepreciation: 21980.0,
            costShare: 50.3,
            assetsFullyDepreciated: 88,
            filter: { departmentId: "6f1a1d1e-0001-4f00-9a00-000000000001" },
        },
        {
            id: "6f1a1d1e-0002-4f00-9a00-000000000002",
            name: "Operations",
            count: 388,
            countShare: 30.2,
            cost: 1204120.0,
            accumulatedDepreciation: 602060.0,
            netBookValue: 602060.0,
            monthlyDepreciation: 12040.0,
            costShare: 28.8,
            assetsFullyDepreciated: 71,
            filter: { departmentId: "6f1a1d1e-0002-4f00-9a00-000000000002" },
        },
        {
            id: "6f1a1d1e-0003-4f00-9a00-000000000003",
            name: "Finance",
            count: 271,
            countShare: 21.1,
            cost: 706400.0,
            accumulatedDepreciation: 289810.25,
            netBookValue: 416589.75,
            monthlyDepreciation: 5910.5,
            costShare: 16.9,
            assetsFullyDepreciated: 42,
            filter: { departmentId: "6f1a1d1e-0003-4f00-9a00-000000000003" },
        },
        {
            // "Records with no value for this dimension": a real set, and one the
            // asset register has no way to ask for.
            id: null,
            name: "No department",
            count: 113,
            countShare: 8.8,
            cost: 167200.0,
            accumulatedDepreciation: 70000.0,
            netBookValue: 97200.0,
            monthlyDepreciation: 1300.0,
            costShare: 4.0,
            assetsFullyDepreciated: 11,
            filter: { departmentId: null },
        },
    ],
    generatedAt: GENERATED,
};

/** Same estate, but one currency could not be converted. */
export const estateIncomplete = {
    ...estateByDepartment,
    complete: false,
    missingRates: ["EUR->USD"],
    totalCost: 3980100.0,
};

/** A caller who may see assets but not their valuations. */
export const estateWithheldValuation = {
    asOf: ASOF,
    currency: "USD",
    complete: true,
    missingRates: [],
    withheldSections: ["asset valuations"],
    groupBy: "status",
    assetCount: 1284,
    groups: [
        { id: null, name: "IN_USE", count: 902, countShare: 70.2, filter: { status: "IN_USE" } },
        { id: null, name: "IN_STOCK", count: 382, countShare: 29.8, filter: { status: "IN_STOCK" } },
    ],
    generatedAt: GENERATED,
};

/** A tenant on day one. Zeros are honest; ratios are blank, not 0%. */
export const estateEmpty = {
    asOf: ASOF,
    currency: "USD",
    complete: true,
    missingRates: [],
    withheldSections: [],
    groupBy: "department",
    assetCount: 0,
    totalCost: 0,
    accumulatedDepreciation: 0,
    netBookValue: 0,
    monthlyDepreciation: 0,
    assetsFullyDepreciated: 0,
    assetsMissingDepreciationSetup: 0,
    groups: [],
    generatedAt: GENERATED,
};

// ── Cost & waste ─────────────────────────────────────────────────────────────

const wasteAssetItem = (n: number, detail: string) => ({
    id: `a0000000-0000-4000-8000-00000000000${n}`,
    name: `Dell Latitude 545${n}`,
    reference: `AST-01${n}`,
    resourceType: "asset",
    status: "IN_STOCK",
    departmentId: "6f1a1d1e-0002-4f00-9a00-000000000002",
    departmentName: "Operations",
    locationId: null,
    locationName: "Accra HQ",
    cost: 1200.0,
    netBookValue: 480.0,
    nativeCurrency: "USD",
    detail,
});

export const costWaste = {
    asOf: ASOF,
    currency: "USD",
    complete: true,
    missingRates: [],
    withheldSections: [],
    idleDays: 180,
    distinctAssetsFlagged: 96,
    capitalTiedUp: 184320.0,
    licenceAnnualSavings: 21400.0,
    findings: [
        {
            key: "FULLY_DEPRECIATED_ACTIVE",
            title: "Fully depreciated but still in service",
            explanation:
                "Assets whose useful life has elapsed and which are still in use, in stock or reserved. They have no "
                + "book value left to lose, so the next failure is an unplanned purchase rather than a planned one.",
            resourceType: "asset",
            count: 212,
            originalCost: 612400.0,
            netBookValue: 0.0,
            filter: { fullyDepreciated: "true" },
            items: [wasteAssetItem(1, "Useful life ended 2024-03-01")],
            truncated: true,
        },
        {
            key: "NOT_SEEN_IN_STOCK",
            title: "In stock or reserved and not seen for 180+ days",
            explanation:
                "Assets held in stock or reserved that nobody is recorded as having seen for 180 days. A sighting "
                + "means a scan, a checkout or check-in, or a physical audit verification — somebody was in the same "
                + "room as the asset. Editing the record is not a sighting and does not count here. AssetIQ records no "
                + "usage telemetry, so this says 'nobody has seen it', never 'nobody is using it'. Assets with no "
                + "sighting at all are included only once their record has existed for at least this long, so a tenant "
                + "who has just imported their stock is not told it has gone missing.",
            resourceType: "asset",
            count: 24,
            originalCost: 38400.0,
            netBookValue: 15360.0,
            filter: { status: "IN_STOCK" },
            items: [
                wasteAssetItem(2, "Last scanned 241 days ago"),
                // No sighting at all: the record's age is a lower bound on the
                // gap, and is reported as exactly that.
                wasteAssetItem(3, "Never scanned, checked out or audited; record unchanged for 198 days"),
            ],
            truncated: true,
        },
        {
            key: "UNASSIGNED_IN_USE",
            title: "Marked in use with nobody assigned",
            explanation:
                "Assets whose status says they are in use but which have no assigned holder. Either someone has them "
                + "and the register is wrong, or nobody does and they are idle.",
            resourceType: "asset",
            count: 31,
            originalCost: 52700.0,
            netBookValue: 28900.0,
            filter: { status: "IN_USE", assigned: "false" },
            items: [wasteAssetItem(4, "No assigned holder")],
            truncated: true,
        },
        {
            key: "MISSING",
            title: "Missing and still on the books",
            explanation:
                "Assets marked missing that have not been written off. Their remaining book value is an unrecognised "
                + "loss sitting in the fixed asset register.",
            resourceType: "asset",
            count: 4,
            originalCost: 9600.0,
            netBookValue: 4100.0,
            filter: { status: "MISSING" },
            items: [wasteAssetItem(5, "Marked missing")],
            truncated: false,
        },
        {
            key: "UNUSABLE_CONDITION",
            title: "Damaged or scrap, still carried",
            explanation:
                "Assets in damaged or scrap condition that have not been disposed of. They carry book value, may carry "
                + "insurance, and are almost certainly not working.",
            resourceType: "asset",
            count: 0,
            originalCost: 0.0,
            netBookValue: 0.0,
            filter: { condition: "DAMAGED" },
            items: [],
            truncated: false,
        },
        {
            key: "LICENCE_UNUSED_SEATS",
            title: "Software seats paid for and not used",
            explanation:
                "Active licences with fewer seats in use than purchased. The cost shown is the annual renewal cost "
                + "apportioned per seat over the unused seats.",
            resourceType: "licence",
            count: 6,
            unusedSeats: 214,
            annualCost: 21400.0,
            filter: { underUtilised: "true" },
            items: [
                {
                    id: "b0000000-0000-4000-8000-000000000001",
                    name: "Figma Organisation",
                    reference: "Figma",
                    resourceType: "licence",
                    totalSeats: 250,
                    usedSeats: 96,
                    expiryDate: "2027-01-31",
                    amount: 15400.0,
                    nativeCurrency: "USD",
                    detail: "154 of 250 seats unused",
                },
                {
                    id: "b0000000-0000-4000-8000-000000000002",
                    name: "Atlassian Confluence",
                    reference: "Atlassian",
                    resourceType: "licence",
                    totalSeats: 120,
                    usedSeats: 60,
                    expiryDate: "2026-11-30",
                    // Held in a currency with no rate: unknown, not free.
                    amount: null,
                    nativeCurrency: "EUR",
                    detail: "60 of 120 seats unused",
                },
            ],
            truncated: false,
        },
        {
            key: "LICENCE_OVER_ALLOCATED",
            title: "Software in use beyond the seats purchased",
            explanation:
                "Active licences with more seats in use than purchased. This is a compliance exposure, not a saving.",
            resourceType: "licence",
            count: 1,
            excessSeats: 12,
            annualExposure: 3600.0,
            filter: { overAllocated: "true" },
            items: [
                {
                    id: "b0000000-0000-4000-8000-000000000003",
                    name: "Adobe Creative Cloud",
                    reference: "Adobe",
                    resourceType: "licence",
                    totalSeats: 40,
                    usedSeats: 52,
                    expiryDate: "2026-12-15",
                    amount: 3600.0,
                    nativeCurrency: "USD",
                    detail: "12 seats beyond the 40 purchased",
                },
            ],
            truncated: false,
        },
    ],
    generatedAt: GENERATED,
};

/** A caller with no licence permission: the licence findings are gone, not zeroed. */
export const costWasteLicencesWithheld = {
    ...costWaste,
    withheldSections: ["software licences"],
    licenceAnnualSavings: 0,
    findings: costWaste.findings.filter((f) => !f.key.startsWith("LICENCE_")),
};

// ── Expiring ─────────────────────────────────────────────────────────────────

/**
 * Bucket keys are derived from `horizonDays` server-side. At a 90-day horizon
 * the backend emits OVERDUE, DUE_0_29, DUE_30_59, DUE_60_90 — and a trailing
 * DUE_90_90 that nothing can ever land in, because `bucketFor` matches the
 * first bucket containing the day. It is reproduced here exactly so the UI's
 * handling of it is what the tests check.
 */
export const expiring90 = {
    asOf: ASOF,
    currency: "USD",
    complete: false,
    missingRates: ["GBP->USD"],
    withheldSections: ["leases"],
    horizonDays: 90,
    horizonEnd: "2026-12-22",
    totals: { overdue: 7, dueWithinHorizon: 34 },
    streams: [
        {
            key: "WARRANTY",
            label: "Asset warranties",
            resourceType: "asset",
            valueMeaning: "original purchase cost of the asset losing cover",
            overdue: 5,
            dueWithinHorizon: 18,
            buckets: [
                { bucket: "OVERDUE", label: "Already past due", count: 5, value: 14200.0, valueComplete: true },
                { bucket: "DUE_0_29", label: "Due in 0-29 days", count: 9, value: 21600.0, valueComplete: true },
                { bucket: "DUE_30_59", label: "Due in 30-59 days", count: 6, value: 14400.0, valueComplete: false },
                { bucket: "DUE_60_90", label: "Due in 60-90 days", count: 3, value: 7200.0, valueComplete: true },
                { bucket: "DUE_90_90", label: "Due in 90-90 days", count: 0, value: 0.0, valueComplete: true },
            ],
            items: [
                {
                    id: "a0000000-0000-4000-8000-000000000011",
                    name: "ThinkPad X1 Carbon",
                    reference: "AST-0442",
                    resourceType: "asset",
                    dueDate: "2026-09-10",
                    daysUntil: -13,
                    overdue: true,
                    relatedId: null,
                    relatedName: "Engineering",
                    value: 2400.0,
                    nativeCurrency: "USD",
                },
                {
                    id: "a0000000-0000-4000-8000-000000000012",
                    name: "HP ProDesk 600",
                    reference: "AST-0519",
                    resourceType: "asset",
                    dueDate: "2026-10-04",
                    daysUntil: 11,
                    overdue: false,
                    relatedId: null,
                    relatedName: "Finance",
                    value: null,
                    nativeCurrency: "GBP",
                },
            ],
            truncated: true,
        },
        {
            key: "CONTRACT",
            label: "Supplier contracts",
            resourceType: "contract",
            valueMeaning: "total contract value",
            overdue: 2,
            dueWithinHorizon: 16,
            buckets: [
                { bucket: "OVERDUE", label: "Already past due", count: 2, value: 96000.0, valueComplete: true },
                { bucket: "DUE_0_29", label: "Due in 0-29 days", count: 7, value: 180000.0, valueComplete: true },
                { bucket: "DUE_30_59", label: "Due in 30-59 days", count: 5, value: 120000.0, valueComplete: true },
                { bucket: "DUE_60_90", label: "Due in 60-90 days", count: 4, value: 88000.0, valueComplete: true },
                { bucket: "DUE_90_90", label: "Due in 90-90 days", count: 0, value: 0.0, valueComplete: true },
            ],
            items: [
                {
                    id: "c0000000-0000-4000-8000-000000000001",
                    name: "Datacentre colocation",
                    reference: "CTR-2024-07",
                    resourceType: "contract",
                    dueDate: "2026-10-31",
                    daysUntil: 38,
                    overdue: false,
                    relatedId: null,
                    relatedName: "Equinix",
                    value: 48000.0,
                    nativeCurrency: "USD",
                },
            ],
            truncated: true,
        },
        {
            key: "MAINTENANCE",
            label: "Scheduled maintenance",
            resourceType: "maintenance",
            valueMeaning: "cost of the maintenance job as scheduled",
            overdue: 0,
            dueWithinHorizon: 0,
            buckets: [
                { bucket: "OVERDUE", label: "Already past due", count: 0, value: 0.0, valueComplete: true },
                { bucket: "DUE_0_29", label: "Due in 0-29 days", count: 0, value: 0.0, valueComplete: true },
                { bucket: "DUE_30_59", label: "Due in 30-59 days", count: 0, value: 0.0, valueComplete: true },
                { bucket: "DUE_60_90", label: "Due in 60-90 days", count: 0, value: 0.0, valueComplete: true },
                { bucket: "DUE_90_90", label: "Due in 90-90 days", count: 0, value: 0.0, valueComplete: true },
            ],
            items: [],
            truncated: false,
        },
    ],
    generatedAt: GENERATED,
};

// ── Spend ────────────────────────────────────────────────────────────────────

export const spendCurrentYear = {
    asOf: ASOF,
    currency: "USD",
    complete: false,
    missingRates: ["GHS->USD"],
    withheldSections: [],
    windowStart: "2026-01-01",
    windowEnd: "2026-12-31",
    budgetCount: 3,
    totalBudget: 1400000.0,
    spent: 812000.0,
    committed: 265000.0,
    available: 323000.0,
    spentPercent: 58.0,
    committedPercent: 18.9,
    burnPercent: 76.9,
    periodElapsedPercent: 72.3,
    pacePercentagePoints: 4.6,
    projectedSpendAtPeriodEnd: 1489626.55,
    budgetsOverThreshold: 1,
    budgets: [
        {
            id: "d0000000-0000-4000-8000-000000000001",
            name: "IT hardware refresh",
            resourceType: "budget",
            status: "ACTIVE",
            departmentId: "6f1a1d1e-0001-4f00-9a00-000000000001",
            periodStart: "2026-01-01",
            periodEnd: "2026-12-31",
            fiscalYear: 2026,
            nativeCurrency: "USD",
            total: 800000.0,
            spent: 560000.0,
            committed: 180000.0,
            available: 60000.0,
            burnPercent: 92.5,
            elapsedPercent: 72.3,
            alertThresholdPct: 85,
            overThreshold: true,
            filter: { budgetId: "d0000000-0000-4000-8000-000000000001" },
        },
        {
            id: "d0000000-0000-4000-8000-000000000002",
            name: "Facilities",
            resourceType: "budget",
            status: "ACTIVE",
            departmentId: null,
            periodStart: "2026-01-01",
            periodEnd: "2026-12-31",
            fiscalYear: 2026,
            nativeCurrency: "USD",
            total: 600000.0,
            spent: 252000.0,
            committed: 85000.0,
            available: 263000.0,
            burnPercent: 56.2,
            elapsedPercent: 72.3,
            alertThresholdPct: 90,
            overThreshold: false,
            filter: { budgetId: "d0000000-0000-4000-8000-000000000002" },
        },
        {
            // No USD rate for GHS: money is null, but the ratio is computed in
            // the budget's own currency and is exactly right.
            id: "d0000000-0000-4000-8000-000000000003",
            name: "Accra office fit-out",
            resourceType: "budget",
            status: "ACTIVE",
            departmentId: null,
            periodStart: "2026-04-01",
            periodEnd: "2026-12-31",
            fiscalYear: 2026,
            nativeCurrency: "GHS",
            total: null,
            spent: null,
            committed: null,
            available: null,
            burnPercent: 41.8,
            elapsedPercent: 64.2,
            alertThresholdPct: 80,
            overThreshold: false,
            filter: { budgetId: "d0000000-0000-4000-8000-000000000003" },
        },
    ],
    generatedAt: GENERATED,
};

/** No approved budget covers the window: every ratio is null, not 0%. */
export const spendNoBudgets = {
    asOf: ASOF,
    currency: "USD",
    complete: true,
    missingRates: [],
    withheldSections: [],
    windowStart: "2026-01-01",
    windowEnd: "2026-12-31",
    budgetCount: 0,
    totalBudget: 0.0,
    spent: 0.0,
    committed: 0.0,
    available: 0.0,
    spentPercent: null,
    committedPercent: null,
    burnPercent: null,
    periodElapsedPercent: 72.3,
    pacePercentagePoints: null,
    projectedSpendAtPeriodEnd: null,
    budgetsOverThreshold: 0,
    budgets: [],
    generatedAt: GENERATED,
};

/** Early in a period: the projection is withheld on purpose. */
export const spendEarlyInPeriod = {
    ...spendCurrentYear,
    windowStart: "2026-09-01",
    windowEnd: "2027-08-31",
    periodElapsedPercent: 3.1,
    pacePercentagePoints: 73.8,
    projectedSpendAtPeriodEnd: null,
};

// ── Trends ───────────────────────────────────────────────────────────────────

const trendPoint = (date: string, index: number, currency: string) => ({
    date,
    assetCount: 1200 + index * 3,
    activeAssetCount: 860 + index * 2,
    notSeenAssetCount: 60 - Math.round(index / 3),
    unassignedInUseCount: 34 - Math.round(index / 6),
    fullyDepreciatedCount: 200 + index,
    overdueMaintenanceCount: 12 + (index % 5),
    licenceSeatsTotal: 640,
    licenceSeatsUsed: 410 + index * 2,
    totalCost: 4_000_000 + index * 6_000,
    netBookValue: 2_200_000 + index * 2_400,
    accumulatedDepreciation: 1_800_000 + index * 3_600,
    monthlyDepreciation: 41_000 + index * 20,
    currency,
    complete: true,
});

const day = (offsetFromStart: number): string => {
    const base = Date.UTC(2026, 5, 25);
    return new Date(base + offsetFromStart * 86_400_000).toISOString().slice(0, 10);
};

const ninetyDays = Array.from({ length: 30 }, (_, i) => trendPoint(day(i * 3), i, "USD"));

export const trendsHealthy = {
    asOf: ASOF,
    days: 90,
    withheldSections: [],
    firstSnapshot: "2025-11-02",
    historyDays: 326,
    pointCount: ninetyDays.length,
    sufficientHistory: true,
    currencies: ["USD"],
    currency: "USD",
    currencyChanged: false,
    anyIncomplete: false,
    points: ninetyDays,
    change: {
        comparable: true,
        from: ninetyDays[0].date,
        to: ninetyDays[ninetyDays.length - 1].date,
        assetCount: 87,
        activeAssetCount: 58,
        notSeenAssetCount: -9,
        unassignedInUseCount: -4,
        overdueMaintenanceCount: 2,
        licenceSeatsUsed: 58,
        totalCost: 174000.0,
        netBookValue: 69600.0,
        currency: "USD",
    },
    generatedAt: GENERATED,
};

/** A tenant installed four days ago. There is no trend and the API says so. */
export const trendsThinHistory = {
    asOf: ASOF,
    days: 90,
    withheldSections: [],
    firstSnapshot: "2026-09-20",
    historyDays: 4,
    pointCount: 3,
    sufficientHistory: false,
    note:
        "Only 3 day(s) of history exist, so this shows the points recorded so far rather than a trend. Nothing has "
        + "been estimated or filled in.",
    currencies: ["USD"],
    currency: "USD",
    currencyChanged: false,
    anyIncomplete: false,
    points: [trendPoint("2026-09-20", 0, "USD"), trendPoint("2026-09-21", 1, "USD"), trendPoint("2026-09-22", 2, "USD")],
    change: {
        comparable: true,
        from: "2026-09-20",
        to: "2026-09-22",
        assetCount: 6,
        activeAssetCount: 4,
        notSeenAssetCount: -1,
        unassignedInUseCount: 0,
        overdueMaintenanceCount: 1,
        licenceSeatsUsed: 4,
        totalCost: 12000.0,
        netBookValue: 4800.0,
        currency: "USD",
    },
    generatedAt: GENERATED,
};

/** Nothing recorded at all: render the note, never a flat line at zero. */
export const trendsNoHistory = {
    asOf: ASOF,
    days: 90,
    withheldSections: [],
    firstSnapshot: null,
    historyDays: 0,
    pointCount: 0,
    sufficientHistory: false,
    note:
        "No history has been recorded yet. The first snapshot is taken overnight; trends appear from the following "
        + "day.",
    currencies: [],
    currency: null,
    currencyChanged: false,
    anyIncomplete: false,
    points: [],
    change: { comparable: false },
    generatedAt: GENERATED,
};

/** The tenant changed base currency mid-series: the line must break. */
export const trendsCurrencyChanged = {
    ...trendsHealthy,
    currencies: ["USD", "GHS"],
    currency: null,
    currencyChanged: true,
    anyIncomplete: true,
    points: ninetyDays.map((point, index) =>
        index < 15 ? point : { ...point, currency: "GHS", complete: index % 7 !== 0 },
    ),
    change: {
        comparable: true,
        from: ninetyDays[0].date,
        to: ninetyDays[ninetyDays.length - 1].date,
        assetCount: 87,
        activeAssetCount: 58,
        notSeenAssetCount: -9,
        unassignedInUseCount: -4,
        overdueMaintenanceCount: 2,
        licenceSeatsUsed: 58,
        moneyComparable: false,
        note: "The base currency changed during this window, so money cannot be compared.",
    },
};
