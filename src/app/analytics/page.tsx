"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notify } from "@/lib/notify";
import { Alert } from "@/components/ui/alert";
import {
    AlertTriangle,
    ArrowUpRight,
    BarChart3,
    DollarSign,
    RefreshCw,
    ShoppingCart,
    TrendingUp,
    Wrench,
} from "lucide-react";
import Link from "next/link";
import { analyticsService } from "@/services/analyticsService";
import {
    AssetAnalytics,
    FinancialAnalytics,
    MaintenanceAnalytics,
    PurchaseOrderAnalytics,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { UpgradeCard } from "@/components/billing/UpgradeCard";
import { isPlanLimitError } from "@/lib/plan-limit";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import { mergeCompleteness } from "@/lib/currency";
import { MissingRatesNotice } from "@/components/currency/MissingRatesNotice";

/** Activity window: filters acquisitions, POs, maintenance and disposals, never portfolio value. */
type Period = "week" | "month" | "quarter" | "year" | "all";
type GroupBy = "status" | "department" | "condition";

type AnalyticsKey =
    | "asset analytics"
    | "financial analytics"
    | "purchase order analytics"
    | "maintenance analytics";

const PERIODS: { value: Period; label: string; description: string }[] = [
    { value: "week", label: "Last 7 days", description: "Activity in the last 7 days" },
    { value: "month", label: "This month", description: "Activity since the start of this month" },
    { value: "quarter", label: "Last 3 months", description: "Activity in the last 3 months" },
    { value: "year", label: "Last 12 months", description: "Activity in the last 12 months" },
    { value: "all", label: "All time", description: "All recorded activity" },
];

const DEFAULT_PERIOD: Period = "year";

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: "status", label: "Status" },
    { value: "department", label: "Department" },
    { value: "condition", label: "Condition" },
];

const BAR_COLORS = [
    "bg-teal-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-rose-500",
    "bg-orange-500",
];

const getErrorStatus = (reason: unknown): number | undefined => {
    if (typeof reason !== "object" || reason === null) return undefined;
    const response = (reason as { response?: { status?: number } }).response;
    return response?.status;
};

const titleCase = (value: string) =>
    value
        .toLowerCase()
        .split("_")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const EmptySection = ({ message }: { message: string }) => (
    <div className="flex min-h-44 items-center justify-center rounded-panel border border-dashed border-edge-subtle bg-surface-muted/70 p-6 text-center text-sm text-muted-fg">
        {message}
    </div>
);

export default function AnalyticsPage() {
    const { format: formatCurrency, formatCompact } = useCurrency();
    const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
    const [groupBy, setGroupBy] = useState<GroupBy>("status");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [paywall, setPaywall] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [unavailableSections, setUnavailableSections] = useState<AnalyticsKey[]>([]);
    const [assetAnalytics, setAssetAnalytics] = useState<AssetAnalytics | null>(null);
    const [financialAnalytics, setFinancialAnalytics] = useState<FinancialAnalytics | null>(null);
    const [poAnalytics, setPOAnalytics] = useState<PurchaseOrderAnalytics | null>(null);
    const [maintenanceAnalytics, setMaintenanceAnalytics] = useState<MaintenanceAnalytics | null>(null);

    const fetchData = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const results = await Promise.allSettled([
                analyticsService.getAssetAnalytics({ period, groupBy }),
                analyticsService.getFinancialAnalytics({ period }),
                analyticsService.getPurchaseOrderAnalytics({ period }),
                analyticsService.getMaintenanceAnalytics({ period }),
            ]);

            const [
                assetResult,
                financialResult,
                purchaseOrderResult,
                maintenanceResult,
            ] = results;

            const requiredResults = [assetResult, financialResult, purchaseOrderResult];
            // A plan-limit 403 (Freemium) swaps the charts for an inline upgrade
            // card; a permission 403 falls through to per-section "unavailable".
            const required403 = requiredResults.every(
                result => result.status === "rejected" && getErrorStatus(result.reason) === 403
            );
            const planLimited = requiredResults.some(
                result => result.status === "rejected" && isPlanLimitError(result.reason)
            );

            if (required403 && planLimited) {
                setPaywall(true);
                return;
            }

            setPaywall(false);

            const unavailable: AnalyticsKey[] = [];

            if (assetResult.status === "fulfilled") setAssetAnalytics(assetResult.value);
            else {
                setAssetAnalytics(null);
                unavailable.push("asset analytics");
            }

            if (financialResult.status === "fulfilled") setFinancialAnalytics(financialResult.value);
            else {
                setFinancialAnalytics(null);
                unavailable.push("financial analytics");
            }

            if (purchaseOrderResult.status === "fulfilled") setPOAnalytics(purchaseOrderResult.value);
            else {
                setPOAnalytics(null);
                unavailable.push("purchase order analytics");
            }

            if (maintenanceResult.status === "fulfilled") setMaintenanceAnalytics(maintenanceResult.value);
            else {
                setMaintenanceAnalytics(null);
                unavailable.push("maintenance analytics");
            }

            setUnavailableSections(unavailable);
            setLastUpdated(new Date());

        } catch {
            // Defensive only: every request above is inside allSettled, so this
            // runs for a bug in this function, not for a failed request. The
            // per-section Alert above is what reports a failed request.
            notify.error("Something went wrong while building this page.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [groupBy, period]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const assetBreakdown = useMemo(() => assetAnalytics?.data ?? [], [assetAnalytics]);
    const maxAssetCount = useMemo(
        () => Math.max(...assetBreakdown.map(item => item.count), 1),
        [assetBreakdown]
    );

    const categoryBreakdown = useMemo(() => {
        const categories = financialAnalytics?.breakdown?.byCategory;
        if (!categories) return [];

        return Object.entries(categories)
            .map(([name, value]) => ({ name, ...value }))
            .sort((left, right) => right.value - left.value)
            .slice(0, 6);
    }, [financialAnalytics]);

    const maintenanceTypes = useMemo(() => {
        const byType = maintenanceAnalytics?.byType;
        if (!byType) return [];

        return Object.entries(byType)
            .map(([type, value]) => ({ type, ...value }))
            .sort((left, right) => right.count - left.count);
    }, [maintenanceAnalytics]);

    const maxMaintenanceTypeCount = useMemo(
        () => Math.max(...maintenanceTypes.map(item => item.count), 1),
        [maintenanceTypes]
    );

    const procurementStatuses = useMemo(() => {
        if (!poAnalytics) return [];

        return [
            { label: "Total Orders", value: poAnalytics.totalPOs, color: "text-foreground" },
            { label: "Approved", value: poAnalytics.approvedPOs, color: "text-ok" },
            { label: "Draft", value: poAnalytics.draftPOs, color: "text-warn" },
            { label: "Rejected", value: poAnalytics.rejectedPOs, color: "text-danger" },
        ];
    }, [poAnalytics]);

    // Every section reports its money already converted server-side into the
    // org's base currency (`response.currency`). Each formatter converts from
    // that currency into the viewer's display currency, so figures from
    // different sections stay consistent with each other.
    const fmtAsset = (amount?: number | null) => formatCurrency(amount, assetAnalytics?.currency);
    const fmtFin = (amount?: number | null) => formatCurrency(amount, financialAnalytics?.currency);
    const fmtPo = (amount?: number | null) => formatCurrency(amount, poAnalytics?.currency);
    const fmtMaint = (amount?: number | null) => formatCurrency(amount, maintenanceAnalytics?.currency);

    const heroAssetValue = financialAnalytics
        ? formatCompact(financialAnalytics.totalAssetValue, financialAnalytics.currency)
        : formatCompact(assetAnalytics?.totalValue ?? 0, assetAnalytics?.currency);
    const heroBookValue = formatCompact(financialAnalytics?.netBookValue ?? 0, financialAnalytics?.currency);
    const heroPoValue = formatCompact(poAnalytics?.totalPOValue ?? 0, poAnalytics?.currency);
    const heroMaintenanceCost = formatCompact(maintenanceAnalytics?.totalMaintenanceCost ?? 0, maintenanceAnalytics?.currency);
    const completeness = mergeCompleteness(
        assetAnalytics, financialAnalytics, poAnalytics, maintenanceAnalytics,
    );

    const currentPeriod = PERIODS.find(item => item.value === period);
    const currentGroup = GROUP_BY_OPTIONS.find(item => item.value === groupBy);
    const hasAnyData = Boolean(
        assetAnalytics ||
        financialAnalytics ||
        poAnalytics ||
        maintenanceAnalytics
    );

    if (paywall) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Analytics"
                    subtitle="Portfolio, finance, procurement, maintenance, and depreciation insights."
                />
                <UpgradeCard
                    title="Analytics is available on paid plans"
                    body="Upgrade to unlock analytics for assets, finance, procurement, maintenance, and depreciation trends. Everything else in your workspace keeps working on your current plan."
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Analytics"
                subtitle="Portfolio value, book value and depreciation are as of today across all non-disposed assets. The activity period filters acquisitions, purchase orders, maintenance and disposals."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void fetchData(true)}
                        disabled={refreshing}
                        className="h-9 gap-1.5 text-xs"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh
                    </Button>
                }
            />
            <div className="-mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-fg">
                <span className="rounded-full border border-edge-subtle bg-surface px-2.5 py-1 font-medium">
                    Activity: {currentPeriod?.label}
                </span>
                <span className="rounded-full border border-edge-subtle bg-surface px-2.5 py-1 font-medium">
                    Grouped by: {currentGroup?.label}
                </span>
                {lastUpdated && (
                    <span className="rounded-full border border-edge-subtle bg-surface px-2.5 py-1 font-medium">
                        Updated {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                )}
            </div>

            <MissingRatesNotice incomplete={completeness.incomplete} missingRates={completeness.missingRates} />

            <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                <Card className="overflow-hidden border-0 shadow-sm">
                    <CardContent className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 p-6 text-white">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
                            <div className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-200">
                                    Analytics Overview
                                </p>
                                <h2 className="text-2xl font-semibold">
                                    Portfolio today, activity for {currentPeriod?.label.toLowerCase()}
                                </h2>
                                <p className="max-w-2xl text-sm leading-6 text-slate-300">
                                    Asset and book values cover every asset still on the books. {currentPeriod?.description} drives the
                                    acquisition, procurement and maintenance panels.
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Portfolio Value</p>
                                    <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-black leading-tight sm:text-2xl">{heroAssetValue}</p>
                                    <p className="mt-1 text-xs text-slate-300">
                                        Full value: {financialAnalytics ? fmtFin(financialAnalytics.totalAssetValue) : fmtAsset(assetAnalytics?.totalValue)} · {financialAnalytics?.totalAssets?.toLocaleString() ?? "—"} assets on the books
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Book Value</p>
                                    <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-black leading-tight sm:text-2xl">{heroBookValue}</p>
                                    <p className="mt-1 text-xs text-slate-300">
                                        Depreciation: {fmtFin(financialAnalytics?.totalDepreciation)}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">PO Volume</p>
                                    <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-black leading-tight sm:text-2xl">{heroPoValue}</p>
                                    <p className="mt-1 text-xs text-slate-300">
                                        {poAnalytics?.totalPOs?.toLocaleString() ?? "—"} purchase orders
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Maintenance Cost</p>
                                    <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-black leading-tight sm:text-2xl">{heroMaintenanceCost}</p>
                                    <p className="mt-1 text-xs text-slate-300">
                                        {maintenanceAnalytics?.overdueCount?.toLocaleString() ?? "—"} overdue records
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="border-b border-edge-subtle bg-surface-muted/60 pb-3">
                        <CardTitle className="text-base font-semibold text-foreground">Filters</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-5">
                        <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint-fg">Activity period</p>
                            <p className="mb-2 text-xs text-muted-fg">
                                Filters acquisitions, purchase orders, maintenance and disposals. Portfolio and book values are always as of today.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {PERIODS.map(item => (
                                    <button
                                        key={item.value}
                                        onClick={() => setPeriod(item.value)}
                                        className={cn(
                                            "rounded-full px-3 py-2 text-sm font-medium transition-colors",
                                            period === item.value
                                                ? "bg-brand text-white"
                                                : "border border-edge-subtle bg-surface text-muted-fg hover:bg-surface-muted",
                                        )}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint-fg">Asset grouping</p>
                            <div className="flex flex-wrap gap-2">
                                {GROUP_BY_OPTIONS.map(item => (
                                    <button
                                        key={item.value}
                                        onClick={() => setGroupBy(item.value)}
                                        className={cn(
                                            "rounded-full px-3 py-2 text-sm font-medium transition-colors",
                                            groupBy === item.value
                                                ? "bg-foreground text-[var(--surface)]"
                                                : "border border-edge-subtle bg-surface text-muted-fg hover:bg-surface-muted",
                                        )}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/*
                          This page already told the truth about a partial
                          failure - it is the only one in the app that did. What
                          it lacked was a way to act on it: the notice was a
                          neutral grey box with no retry, so an "unavailable"
                          section stayed unavailable until the user thought to
                          reload. It is now an Alert when something is missing
                          (tone + icon, so it does not read as a caption) and
                          stays a plain line when everything responded.
                        */}
                        {unavailableSections.length === 0 ? (
                            <div className="rounded-panel border border-edge-subtle bg-surface-muted p-4">
                                <p className="text-sm font-semibold text-foreground">Data availability</p>
                                <p className="mt-1 text-sm text-muted-fg">
                                    All configured analytics services responded successfully.
                                </p>
                            </div>
                        ) : (
                            <Alert
                                tone="warn"
                                title="Some analytics could not be loaded"
                                action={
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        isLoading={refreshing || loading}
                                        onClick={() => void fetchData(true)}
                                    >
                                        Try again
                                    </Button>
                                }
                            >
                                {`Unavailable right now: ${unavailableSections.join(", ")}. Everything else on this page is up to date.`}
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            </div>

            {loading ? (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="h-32 animate-pulse rounded-panel bg-surface-muted" />
                        ))}
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
                        <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
                        <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
                    </div>
                </div>
            ) : !hasAnyData ? (
                <EmptySection message="No analytics data is available from the backend services yet." />
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Card className="shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-faint-fg">Asset Coverage</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-control bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                                    <BarChart3 className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="data-mono text-3xl font-black text-foreground">{assetAnalytics?.total?.toLocaleString() ?? "—"}</div>
                                <p className="mt-1 text-xs text-faint-fg">Tracked value: {fmtAsset(assetAnalytics?.totalValue)}</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-faint-fg">Current Book Value</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-control bg-ok-soft text-ok">
                                    <DollarSign className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold text-foreground sm:text-xl">{fmtFin(financialAnalytics?.netBookValue)}</div>
                                <p className="mt-1 text-xs text-faint-fg">
                                    Avg age: {financialAnalytics?.averageAssetAge != null ? financialAnalytics.averageAssetAge.toFixed(1) : "Not reported"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-faint-fg">Procurement Value</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-control bg-info-soft text-info">
                                    <ShoppingCart className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold text-foreground sm:text-xl">{fmtPo(poAnalytics?.totalPOValue)}</div>
                                <p className="mt-1 text-xs text-faint-fg">{poAnalytics?.approvedPOs ?? 0} approved orders</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-faint-fg">Maintenance Pressure</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-control bg-warn-soft text-warn">
                                    <Wrench className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="data-mono text-3xl font-black text-foreground">{maintenanceAnalytics?.overdueCount?.toLocaleString() ?? "—"}</div>
                                <p className="mt-1 text-xs text-faint-fg">
                                    {maintenanceAnalytics?.totalRecords?.toLocaleString() ?? "—"} maintenance records
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold text-foreground">
                                        Asset Breakdown by {currentGroup?.label}
                                    </CardTitle>
                                    <span className="text-xs text-faint-fg">Acquired: {currentPeriod?.label}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 p-5">
                                {assetBreakdown.length === 0 ? (
                                    <EmptySection message={`No assets were acquired in this period (${currentPeriod?.label.toLowerCase()}). Try a longer period.`} />
                                ) : assetBreakdown.map((item, index) => {
                                    const width = Math.round((item.count / maxAssetCount) * 100);
                                    return (
                                        <div key={`${item.name}-${index}`}>
                                            <div className="mb-1 flex items-center justify-between gap-3">
                                                <span className="truncate text-sm font-medium text-muted-fg">
                                                    {titleCase(item.name || "Unknown")}
                                                </span>
                                                <div className="shrink-0 text-right">
                                                    <span className="data-mono text-sm font-bold text-foreground">{item.count.toLocaleString()}</span>
                                                    <span className="ml-2 text-xs text-faint-fg">{formatPercent(item.percentage)}</span>
                                                </div>
                                            </div>
                                            <div className="h-2.5 w-full rounded-full bg-surface-muted">
                                                <div
                                                    className={cn(BAR_COLORS[index % BAR_COLORS.length], "h-2.5 rounded-full transition-all")}
                                                    style={{ width: `${width}%` }}
                                                />
                                            </div>
                                            <p className="mt-1 text-xs text-faint-fg">{fmtAsset(item.value)}</p>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <TrendingUp className="h-4 w-4 text-brand" /> Financial Highlights
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 p-5">
                                {!financialAnalytics ? (
                                    <EmptySection message="The financial analytics service did not return data." />
                                ) : (
                                    <>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {[
                                                { label: "Total Asset Value", value: fmtFin(financialAnalytics.totalAssetValue) },
                                                { label: "Net Book Value", value: fmtFin(financialAnalytics.netBookValue) },
                                                { label: "Total Depreciation", value: fmtFin(financialAnalytics.totalDepreciation) },
                                                { label: "Average Asset Age", value: financialAnalytics.averageAssetAge != null ? `${financialAnalytics.averageAssetAge.toFixed(1)} months` : "Not reported" },
                                                {
                                                    label: `Acquired (${currentPeriod?.label.toLowerCase()})`,
                                                    value: `${fmtFin(financialAnalytics.totalAcquisition)} · ${financialAnalytics.acquisitionsInPeriod?.toLocaleString() ?? "—"} assets`,
                                                },
                                                { label: "Monthly Depreciation", value: fmtFin(financialAnalytics.monthlyDepreciation) },
                                            ].map(item => (
                                                <div key={item.label} className="rounded-panel border border-edge-subtle bg-surface-muted p-4">
                                                    <p className="text-xs uppercase tracking-wide text-faint-fg">{item.label}</p>
                                                    <p className="mt-2 text-xl font-bold text-foreground">{item.value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {financialAnalytics.assetsMissingDepreciationSetup ? (
                                            <p className="rounded-panel border border-edge-subtle bg-surface-muted p-3 text-xs text-muted-fg">
                                                {financialAnalytics.assetsMissingDepreciationSetup.toLocaleString()} asset(s) have no useful life set and
                                                are carried at cost. Assign a depreciation policy on the Categories page or set a useful life on the asset.
                                            </p>
                                        ) : null}

                                        {categoryBreakdown.length > 0 && (
                                            <div className="space-y-3 rounded-panel border border-edge-subtle bg-surface p-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-semibold text-foreground">Top Categories</p>
                                                    <span className="text-xs text-faint-fg">By cost, assets on the books</span>
                                                </div>
                                                {categoryBreakdown.map((category, index) => (
                                                    <div key={category.name} className="flex items-center justify-between gap-3">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <div className={cn("h-2.5 w-2.5 rounded-full", BAR_COLORS[index % BAR_COLORS.length])} />
                                                            <span className="truncate text-sm font-medium text-muted-fg">{category.name}</span>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <p className="text-sm font-bold text-foreground">{fmtFin(category.value)}</p>
                                                            <p className="text-xs text-faint-fg">
                                                                {category.count.toLocaleString()} assets
                                                                {category.netBookValue != null ? ` · NBV ${fmtFin(category.netBookValue)}` : ""}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <ShoppingCart className="h-4 w-4 text-info" /> Procurement Pulse
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 p-5">
                                {!poAnalytics ? (
                                    <EmptySection message="The procurement analytics service did not return data." />
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            {procurementStatuses.map(status => (
                                                <div key={status.label} className="rounded-panel border border-edge-subtle bg-surface-muted p-4 text-center">
                                                    <p className={cn("data-mono text-2xl font-black", status.color)}>{status.value.toLocaleString()}</p>
                                                    <p className="mt-1 text-xs uppercase tracking-wide text-faint-fg">{status.label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-panel border border-edge-subtle bg-surface p-4">
                                                <p className="text-xs uppercase tracking-wide text-faint-fg">Average Order Value</p>
                                                <p className="mt-2 text-xl font-bold text-foreground">{fmtPo(poAnalytics.averagePOValue)}</p>
                                            </div>
                                            <div className="rounded-panel border border-edge-subtle bg-surface p-4">
                                                <p className="text-xs uppercase tracking-wide text-faint-fg">Largest Recorded Order</p>
                                                <p className="mt-2 text-xl font-bold text-foreground">
                                                    {poAnalytics.largestPO != null ? fmtPo(poAnalytics.largestPO) : "Not reported"}
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <ArrowUpRight className="h-4 w-4 text-brand" /> Supplier Leaderboard
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {!poAnalytics?.topSuppliers?.length ? (
                                    <EmptySection message="No supplier ranking came back from the purchase order analytics service." />
                                ) : (
                                    <div className="divide-y divide-[var(--border-subtle)]">
                                        {poAnalytics.topSuppliers.slice(0, 6).map((supplier, index) => (
                                            <div key={`${supplier.supplier}-${index}`} className="flex items-center justify-between gap-3 px-5 py-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-muted-fg">
                                                        {index + 1}
                                                    </span>
                                                    <span className="truncate text-sm font-medium text-foreground">{supplier.supplier}</span>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-sm font-bold text-brand">{fmtPo(supplier.totalValue)}</p>
                                                    <p className="text-xs text-faint-fg">{supplier.poCount.toLocaleString()} orders</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <Wrench className="h-4 w-4 text-warn" /> Maintenance Operations
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 p-5">
                                {!maintenanceAnalytics ? (
                                    <EmptySection message="The maintenance analytics service is unavailable right now." />
                                ) : (
                                    <>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-panel border border-edge-subtle bg-surface-muted p-4">
                                                <p className="text-xs uppercase tracking-wide text-faint-fg">Total Cost</p>
                                                <p className="mt-2 text-xl font-bold text-foreground">{fmtMaint(maintenanceAnalytics.totalMaintenanceCost)}</p>
                                            </div>
                                            <div className="rounded-panel border border-edge-subtle bg-surface-muted p-4">
                                                <p className="text-xs uppercase tracking-wide text-faint-fg">Average Cost</p>
                                                <p className="mt-2 text-xl font-bold text-foreground">{fmtMaint(maintenanceAnalytics.averageCost)}</p>
                                            </div>
                                            <div className="rounded-panel border border-danger/30 bg-danger-soft p-4">
                                                <p className="text-xs uppercase tracking-wide text-faint-fg">Overdue</p>
                                                <p className="mt-2 text-xl font-bold text-danger">{maintenanceAnalytics.overdueCount.toLocaleString()}</p>
                                            </div>
                                            <div className="rounded-panel border border-edge-subtle bg-surface p-4">
                                                <p className="text-xs uppercase tracking-wide text-faint-fg">Total Records</p>
                                                <p className="mt-2 text-xl font-bold text-foreground">{(maintenanceAnalytics.totalRecords ?? 0).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {maintenanceTypes.length > 0 && (
                                            <div className="space-y-3 rounded-panel border border-edge-subtle bg-surface p-4">
                                                <p className="text-sm font-semibold text-foreground">By maintenance type</p>
                                                {maintenanceTypes.map((item, index) => (
                                                    <div key={item.type}>
                                                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                                            <span className="font-medium text-muted-fg">{titleCase(item.type)}</span>
                                                            <span className="text-faint-fg">
                                                                {item.count.toLocaleString()}
                                                                {item.cost > 0 ? ` · ${fmtMaint(item.cost)}` : ""}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 rounded-full bg-surface-muted">
                                                            <div
                                                                className={cn(BAR_COLORS[index % BAR_COLORS.length], "h-2 rounded-full")}
                                                                style={{ width: `${Math.round((item.count / maxMaintenanceTypeCount) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/*
                          The depreciation trend card that lived here was
                          reconstructed: it took today's asset set and revalued
                          it backwards month by month. That is right for
                          depreciation and wrong as a trend - an asset added
                          last week appeared in last year's figures, and a
                          disposal retroactively erased its own history.
                          /operations?view=trends reads recorded daily
                          snapshots instead, and says out loud when a tenant
                          has too little history to draw.
                        */}
                        <Card>
                            <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <TrendingUp className="h-4 w-4 text-brand" /> Trends
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5">
                                <p className="text-sm text-muted-fg">
                                    Trends now come from recorded daily snapshots rather than from revaluing today&apos;s
                                    assets backwards, so what you see actually happened.
                                </p>
                                <Link
                                    href="/operations?view=trends"
                                    className="ea-focus mt-3 inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-brand underline-offset-2 hover:underline"
                                >
                                    Open Operations · Trends <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </Link>
                            </CardContent>
                        </Card>
                    </div>

                    {/*
                      "Financial Breakdown by Category" stood here and rendered
                      the same `categoryBreakdown` array as the Top Categories
                      list a few hundred pixels above it - the same six rows,
                      the same numbers, neither of them clickable. The version
                      that survives is the one you can interrogate:
                      /operations?view=estate grouped by category, where every
                      row opens the assets behind it.
                    */}
                    {unavailableSections.length > 0 && (
                        <Card className="border-warn/40 bg-warn-soft/80">
                            <CardContent className="flex items-start gap-3 p-4">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                                <div>
                                    <p className="text-sm font-semibold text-warn">Partial analytics loaded</p>
                                    <p className="mt-1 text-sm text-warn">
                                        The following backend services did not respond for this view: {unavailableSections.join(", ")}.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
