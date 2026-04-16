"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
    AlertTriangle,
    ArrowUpRight,
    BarChart3,
    DollarSign,
    Lock,
    RefreshCw,
    ShoppingCart,
    TrendingUp,
    Wrench,
} from "lucide-react";
import { analyticsService } from "@/services/analyticsService";
import {
    AssetAnalytics,
    DepreciationTrend,
    FinancialAnalytics,
    MaintenanceAnalytics,
    PurchaseOrderAnalytics,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/CurrencyContext";

type Period = "week" | "month" | "quarter" | "year";
type GroupBy = "status" | "department" | "condition";

type AnalyticsKey =
    | "asset analytics"
    | "financial analytics"
    | "purchase order analytics"
    | "maintenance analytics"
    | "depreciation trends";

const PERIODS: { value: Period; label: string; description: string }[] = [
    { value: "week", label: "This Week", description: "Most recent operational shifts" },
    { value: "month", label: "This Month", description: "Short-term portfolio movement" },
    { value: "quarter", label: "This Quarter", description: "Broader finance and procurement view" },
    { value: "year", label: "This Year", description: "Long-range asset and spend trends" },
];

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

const formatMonth = (value: string) => {
    const parsed = new Date(`${value}-01`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatCompactCurrency = (amount: number, currencyCode: string) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "narrowSymbol",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(amount);

const EmptySection = ({ message }: { message: string }) => (
    <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500">
        {message}
    </div>
);

export default function AnalyticsPage() {
    const { currency, format: formatCurrency } = useCurrency();
    const router = useRouter();
    const [period, setPeriod] = useState<Period>("month");
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
    const [depreciationTrend, setDepreciationTrend] = useState<DepreciationTrend | null>(null);

    const fetchData = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const results = await Promise.allSettled([
                analyticsService.getAssetAnalytics({ period, groupBy }),
                analyticsService.getFinancialAnalytics({ period }),
                analyticsService.getPurchaseOrderAnalytics({ period }),
                analyticsService.getMaintenanceAnalytics({ period }),
                analyticsService.getDepreciationTrends({ months: 12 }),
            ]);

            const [
                assetResult,
                financialResult,
                purchaseOrderResult,
                maintenanceResult,
                depreciationResult,
            ] = results;

            const requiredResults = [assetResult, financialResult, purchaseOrderResult];
            const required403 = requiredResults.every(
                result => result.status === "rejected" && getErrorStatus(result.reason) === 403
            );

            if (required403) {
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

            if (depreciationResult.status === "fulfilled") setDepreciationTrend(depreciationResult.value);
            else {
                setDepreciationTrend(null);
                unavailable.push("depreciation trends");
            }

            setUnavailableSections(unavailable);
            setLastUpdated(new Date());

        } catch {
            toast.error("Failed to load analytics");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        void fetchData();
    }, [period, groupBy]);

    const assetBreakdown = assetAnalytics?.data ?? [];
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
            { label: "Total Orders", value: poAnalytics.totalPOs, color: "text-slate-900" },
            { label: "Approved", value: poAnalytics.approvedPOs, color: "text-emerald-600" },
            { label: "Draft", value: poAnalytics.draftPOs, color: "text-amber-600" },
            { label: "Rejected", value: poAnalytics.rejectedPOs, color: "text-rose-600" },
        ];
    }, [poAnalytics]);

    const trendRows = depreciationTrend?.data?.slice(-12) ?? [];
    const heroAssetValue = formatCompactCurrency(financialAnalytics?.totalAssetValue ?? assetAnalytics?.totalValue ?? 0, currency);
    const heroBookValue = formatCompactCurrency(financialAnalytics?.netBookValue ?? 0, currency);
    const heroPoValue = formatCompactCurrency(poAnalytics?.totalPOValue ?? 0, currency);
    const heroMaintenanceCost = formatCompactCurrency(maintenanceAnalytics?.totalMaintenanceCost ?? 0, currency);

    const currentPeriod = PERIODS.find(item => item.value === period);
    const currentGroup = GROUP_BY_OPTIONS.find(item => item.value === groupBy);
    const hasAnyData = Boolean(
        assetAnalytics ||
        financialAnalytics ||
        poAnalytics ||
        maintenanceAnalytics ||
        depreciationTrend
    );

    if (paywall) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Card className="max-w-md border-amber-200 bg-amber-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-900">
                            <Lock className="h-5 w-5" /> Analytics requires a paid plan
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-amber-800">
                            Upgrade your plan to unlock backend analytics for assets, finance, procurement, and trends.
                        </p>
                        <Button onClick={() => router.push("/billing")} className="bg-amber-600 hover:bg-amber-700">
                            Go to Billing
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Analytics</h1>
                    <p className="max-w-3xl text-slate-500">
                        Backend-driven portfolio, finance, procurement, maintenance, and depreciation insights for the selected period.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium">
                            Period: {currentPeriod?.label}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium">
                            Grouped by: {currentGroup?.label}
                        </span>
                        {lastUpdated && (
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium">
                                Updated {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </span>
                        )}
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchData(true)}
                    disabled={refreshing}
                    className="h-9 gap-1.5 text-xs"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                <Card className="overflow-hidden border-0 shadow-sm">
                    <CardContent className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 p-6 text-white">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
                            <div className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-200">
                                    Analytics Overview
                                </p>
                                <h2 className="text-2xl font-semibold">
                                    {currentPeriod?.label} performance across asset, finance, and procurement services
                                </h2>
                                <p className="max-w-2xl text-sm leading-6 text-slate-300">
                                    {currentPeriod?.description}. Each panel below is populated from its matching backend analytics service, with partial
                                    availability handled section by section instead of failing the whole dashboard.
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Asset Value</p>
                                    <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-black leading-tight sm:text-2xl">{heroAssetValue}</p>
                                    <p className="mt-1 text-xs text-slate-300">
                                        Full value: {formatCurrency(financialAnalytics?.totalAssetValue ?? assetAnalytics?.totalValue)} · {assetAnalytics?.total?.toLocaleString() ?? "—"} assets in analysis
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Book Value</p>
                                    <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-black leading-tight sm:text-2xl">{heroBookValue}</p>
                                    <p className="mt-1 text-xs text-slate-300">
                                        Depreciation: {formatCurrency(financialAnalytics?.totalDepreciation)}
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

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
                        <CardTitle className="text-base font-semibold text-slate-800">Filters</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-5">
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Period</p>
                            <div className="flex flex-wrap gap-2">
                                {PERIODS.map(item => (
                                    <button
                                        key={item.value}
                                        onClick={() => setPeriod(item.value)}
                                        className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                            period === item.value
                                                ? "bg-teal-600 text-white"
                                                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Asset grouping</p>
                            <div className="flex flex-wrap gap-2">
                                {GROUP_BY_OPTIONS.map(item => (
                                    <button
                                        key={item.value}
                                        onClick={() => setGroupBy(item.value)}
                                        className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                            groupBy === item.value
                                                ? "bg-slate-900 text-white"
                                                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-800">Data availability</p>
                            <p className="mt-1 text-sm text-slate-500">
                                {unavailableSections.length === 0
                                    ? "All configured analytics services responded successfully."
                                    : `Unavailable right now: ${unavailableSections.join(", ")}.`}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {loading ? (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="h-32 rounded-xl bg-slate-100 animate-pulse" />
                        ))}
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
                        <div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
                        <div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
                    </div>
                </div>
            ) : !hasAnyData ? (
                <EmptySection message="No analytics data is available from the backend services yet." />
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asset Coverage</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                    <BarChart3 className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-slate-900">{assetAnalytics?.total?.toLocaleString() ?? "—"}</div>
                                <p className="mt-1 text-xs text-slate-500">Tracked value: {formatCurrency(assetAnalytics?.totalValue)}</p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Book Value</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                    <DollarSign className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold text-slate-900 sm:text-xl">{formatCurrency(financialAnalytics?.netBookValue)}</div>
                                <p className="mt-1 text-xs text-slate-500">
                                    Avg age: {financialAnalytics?.averageAssetAge != null ? financialAnalytics.averageAssetAge.toFixed(1) : "Not reported"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Procurement Value</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                    <ShoppingCart className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold text-slate-900 sm:text-xl">{formatCurrency(poAnalytics?.totalPOValue)}</div>
                                <p className="mt-1 text-xs text-slate-500">{poAnalytics?.approvedPOs ?? 0} approved orders</p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Maintenance Pressure</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                    <Wrench className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-slate-900">{maintenanceAnalytics?.overdueCount?.toLocaleString() ?? "—"}</div>
                                <p className="mt-1 text-xs text-slate-500">
                                    {maintenanceAnalytics?.totalRecords?.toLocaleString() ?? "—"} maintenance records
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold text-slate-800">
                                        Asset Breakdown by {currentGroup?.label}
                                    </CardTitle>
                                    <span className="text-xs text-slate-400">{currentPeriod?.label}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 p-5">
                                {assetBreakdown.length === 0 ? (
                                    <EmptySection message="The backend did not return asset breakdown data for this selection." />
                                ) : assetBreakdown.map((item, index) => {
                                    const width = Math.round((item.count / maxAssetCount) * 100);
                                    return (
                                        <div key={`${item.name}-${index}`}>
                                            <div className="mb-1 flex items-center justify-between gap-3">
                                                <span className="truncate text-sm font-medium text-slate-700">
                                                    {titleCase(item.name || "Unknown")}
                                                </span>
                                                <div className="shrink-0 text-right">
                                                    <span className="text-sm font-bold text-slate-900">{item.count.toLocaleString()}</span>
                                                    <span className="ml-2 text-xs text-slate-400">{formatPercent(item.percentage)}</span>
                                                </div>
                                            </div>
                                            <div className="h-2.5 w-full rounded-full bg-slate-100">
                                                <div
                                                    className={`${BAR_COLORS[index % BAR_COLORS.length]} h-2.5 rounded-full transition-all`}
                                                    style={{ width: `${width}%` }}
                                                />
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">{formatCurrency(item.value)}</p>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <TrendingUp className="h-4 w-4 text-teal-600" /> Financial Highlights
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 p-5">
                                {!financialAnalytics ? (
                                    <EmptySection message="The financial analytics service did not return data." />
                                ) : (
                                    <>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {[
                                                { label: "Total Asset Value", value: formatCurrency(financialAnalytics.totalAssetValue) },
                                                { label: "Net Book Value", value: formatCurrency(financialAnalytics.netBookValue) },
                                                { label: "Total Depreciation", value: formatCurrency(financialAnalytics.totalDepreciation) },
                                                { label: "Average Asset Age", value: financialAnalytics.averageAssetAge != null ? financialAnalytics.averageAssetAge.toFixed(1) : "Not reported" },
                                            ].map(item => (
                                                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                    <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                                                    <p className="mt-2 text-xl font-bold text-slate-900">{item.value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {categoryBreakdown.length > 0 && (
                                            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-semibold text-slate-800">Top Categories</p>
                                                    <span className="text-xs text-slate-400">By backend category values</span>
                                                </div>
                                                {categoryBreakdown.map((category, index) => (
                                                    <div key={category.name} className="flex items-center justify-between gap-3">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <div className={`h-2.5 w-2.5 rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`} />
                                                            <span className="truncate text-sm font-medium text-slate-700">{category.name}</span>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <p className="text-sm font-bold text-slate-900">{formatCurrency(category.value)}</p>
                                                            <p className="text-xs text-slate-500">{category.count.toLocaleString()} assets</p>
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
                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <ShoppingCart className="h-4 w-4 text-blue-600" /> Procurement Pulse
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 p-5">
                                {!poAnalytics ? (
                                    <EmptySection message="The procurement analytics service did not return data." />
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            {procurementStatuses.map(status => (
                                                <div key={status.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                                                    <p className={`text-2xl font-black ${status.color}`}>{status.value.toLocaleString()}</p>
                                                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{status.label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">Average Order Value</p>
                                                <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(poAnalytics.averagePOValue)}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">Largest Recorded Order</p>
                                                <p className="mt-2 text-xl font-bold text-slate-900">
                                                    {poAnalytics.largestPO != null ? formatCurrency(poAnalytics.largestPO) : "Not reported"}
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <ArrowUpRight className="h-4 w-4 text-teal-600" /> Supplier Leaderboard
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {!poAnalytics?.topSuppliers?.length ? (
                                    <EmptySection message="No supplier ranking came back from the purchase order analytics service." />
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {poAnalytics.topSuppliers.slice(0, 6).map((supplier, index) => (
                                            <div key={`${supplier.supplier}-${index}`} className="flex items-center justify-between gap-3 px-5 py-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                                        {index + 1}
                                                    </span>
                                                    <span className="truncate text-sm font-medium text-slate-800">{supplier.supplier}</span>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-sm font-bold text-teal-700">{formatCurrency(supplier.totalValue)}</p>
                                                    <p className="text-xs text-slate-500">{supplier.poCount.toLocaleString()} orders</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Wrench className="h-4 w-4 text-amber-600" /> Maintenance Operations
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 p-5">
                                {!maintenanceAnalytics ? (
                                    <EmptySection message="The maintenance analytics service is unavailable right now." />
                                ) : (
                                    <>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">Total Cost</p>
                                                <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(maintenanceAnalytics.totalMaintenanceCost)}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">Average Cost</p>
                                                <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(maintenanceAnalytics.averageCost)}</p>
                                            </div>
                                            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">Overdue</p>
                                                <p className="mt-2 text-xl font-bold text-red-700">{maintenanceAnalytics.overdueCount.toLocaleString()}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">Total Records</p>
                                                <p className="mt-2 text-xl font-bold text-slate-900">{(maintenanceAnalytics.totalRecords ?? 0).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {maintenanceTypes.length > 0 && (
                                            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                                <p className="text-sm font-semibold text-slate-800">By maintenance type</p>
                                                {maintenanceTypes.map((item, index) => (
                                                    <div key={item.type}>
                                                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                                            <span className="font-medium text-slate-700">{titleCase(item.type)}</span>
                                                            <span className="text-slate-500">
                                                                {item.count.toLocaleString()}
                                                                {item.cost > 0 ? ` · ${formatCurrency(item.cost)}` : ""}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 rounded-full bg-slate-100">
                                                            <div
                                                                className={`${BAR_COLORS[index % BAR_COLORS.length]} h-2 rounded-full`}
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

                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <TrendingUp className="h-4 w-4 text-purple-600" /> Depreciation Trend
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {trendRows.length === 0 ? (
                                    <EmptySection message="No depreciation trend data was returned for the selected window." />
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {trendRows.map((row, index) => (
                                            <div key={`${row.month}-${index}`} className="flex items-center justify-between gap-4 px-5 py-4">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{formatMonth(row.month)}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Charge: {formatCurrency(row.newDepreciation ?? row.totalDepreciation)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-slate-900">{formatCurrency(row.netBookValue)}</p>
                                                    <p className="text-xs text-slate-500">Book value</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {categoryBreakdown.length > 0 && (
                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold text-slate-800">Financial Breakdown by Category</CardTitle>
                                    <span className="text-xs text-slate-400">Backend category payload</span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Assets</th>
                                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Value</th>
                                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly Depr.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {categoryBreakdown.map((category, index) => (
                                                <tr key={`${category.name}-${index}`} className="hover:bg-slate-50/50">
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`h-2.5 w-2.5 rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`} />
                                                            <span className="font-medium text-slate-800">{category.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-right text-slate-600">{category.count.toLocaleString()}</td>
                                                    <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(category.value)}</td>
                                                    <td className="px-5 py-3 text-right text-amber-700">
                                                        {category.monthlyDepreciation > 0 ? formatCurrency(category.monthlyDepreciation) : "Not provided"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {unavailableSections.length > 0 && (
                        <Card className="border-amber-200 bg-amber-50/80">
                            <CardContent className="flex items-start gap-3 p-4">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-900">Partial analytics loaded</p>
                                    <p className="mt-1 text-sm text-amber-800">
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
