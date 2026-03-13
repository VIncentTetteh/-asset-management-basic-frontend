"use client";

import { useEffect, useState, useMemo } from "react";
import { analyticsService } from "@/services/analyticsService";
import { AssetAnalytics, FinancialAnalytics, PurchaseOrderAnalytics, MaintenanceAnalytics, DepreciationTrend } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, TrendingUp, DollarSign, ShoppingCart, BarChart3, Wrench, ArrowUpRight, RefreshCw } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

type Period = "month" | "quarter" | "year";
type GroupBy = "status" | "department" | "category" | "condition";

const PERIODS: { value: Period; label: string }[] = [
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
];

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: "status", label: "Status" },
    { value: "category", label: "Category" },
    { value: "department", label: "Department" },
    { value: "condition", label: "Condition" },
];


const BAR_COLORS = [
    "bg-teal-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500",
    "bg-amber-500", "bg-emerald-500", "bg-rose-500", "bg-orange-500",
];

export default function AnalyticsPage() {
    const { format: formatCurrency } = useCurrency();
    const router = useRouter();
    const [period, setPeriod] = useState<Period>("year");
    const [groupBy, setGroupBy] = useState<GroupBy>("status");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [paywall, setPaywall] = useState(false);
    const [assetAnalytics, setAssetAnalytics] = useState<AssetAnalytics | null>(null);
    const [financialAnalytics, setFinancialAnalytics] = useState<FinancialAnalytics | null>(null);
    const [poAnalytics, setPOAnalytics] = useState<PurchaseOrderAnalytics | null>(null);
    const [maintenanceAnalytics, setMaintenanceAnalytics] = useState<MaintenanceAnalytics | null>(null);
    const [depreciationTrend, setDepreciationTrend] = useState<DepreciationTrend | null>(null);

    const fetchData = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const [asset, financial, po, maint, deprTrend] = await Promise.all([
                analyticsService.getAssetAnalytics({ period, groupBy }),
                analyticsService.getFinancialAnalytics({ period }),
                analyticsService.getPurchaseOrderAnalytics({ period }),
                analyticsService.getMaintenanceAnalytics({ period }).catch(() => null),
                analyticsService.getDepreciationTrends({ months: 12 }).catch(() => null),
            ]);
            setAssetAnalytics(asset);
            setFinancialAnalytics(financial);
            setPOAnalytics(po);
            setMaintenanceAnalytics(maint);
            setDepreciationTrend(deprTrend);
        } catch (err: any) {
            if (err?.response?.status === 403) { setPaywall(true); return; }
            toast.error("Failed to load analytics");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchData(); }, [period, groupBy]);

    const maxAssetValue = useMemo(
        () => Math.max(...(assetAnalytics?.data?.map(d => d.count) ?? [0]), 1),
        [assetAnalytics]
    );

    const categoryBreakdown = useMemo(() => {
        if (!financialAnalytics?.breakdown?.byCategory) return [];
        return Object.entries(financialAnalytics.breakdown.byCategory)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [financialAnalytics]);

    if (paywall) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md border-amber-200 bg-amber-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-900">
                            <Lock className="h-5 w-5" /> Analytics requires a paid plan
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-amber-800">Upgrade your plan to unlock asset analytics, financial insights, and procurement reporting.</p>
                        <Button onClick={() => router.push("/billing")} className="bg-amber-600 hover:bg-amber-700">Go to Billing</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Analytics</h1>
                    <p className="text-slate-500">Asset portfolio, financial performance, and procurement insights.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="gap-1.5 h-8 text-xs">
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
                    {PERIODS.map(p => (
                        <button key={p.value} onClick={() => setPeriod(p.value)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${period === p.value ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
                    {GROUP_BY_OPTIONS.map(g => (
                        <button key={g.value} onClick={() => setGroupBy(g.value)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${groupBy === g.value ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                            {g.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="h-80 bg-slate-100 rounded-xl animate-pulse" />
                        <div className="h-80 bg-slate-100 rounded-xl animate-pulse" />
                    </div>
                </div>
            ) : (
                <>
                    {/* Asset KPI cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="border-slate-200">
                            <CardHeader className="pb-2 pt-4 px-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Total Assets</p>
                                    <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                                        <BarChart3 className="h-4 w-4 text-indigo-600" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-5 pb-4">
                                <div className="text-3xl font-black text-slate-900">{assetAnalytics?.total?.toLocaleString() ?? "—"}</div>
                                <p className="text-xs text-slate-500 mt-1">Total value: {formatCurrency(assetAnalytics?.totalValue)}</p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                            <CardHeader className="pb-2 pt-4 px-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Net Book Value</p>
                                    <div className="h-8 w-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                                        <DollarSign className="h-4 w-4 text-emerald-600" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-5 pb-4">
                                <div className="text-3xl font-black text-slate-900">{formatCurrency(financialAnalytics?.netBookValue)}</div>
                                <p className="text-xs text-slate-500 mt-1">Depreciated: {formatCurrency(financialAnalytics?.totalDepreciation)}</p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                            <CardHeader className="pb-2 pt-4 px-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Total PO Value</p>
                                    <div className="h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-5 pb-4">
                                <div className="text-3xl font-black text-slate-900">{formatCurrency(poAnalytics?.totalPOValue)}</div>
                                <p className="text-xs text-slate-500 mt-1">{poAnalytics?.totalPOs ?? 0} purchase orders</p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                            <CardHeader className="pb-2 pt-4 px-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Maintenance Cost</p>
                                    <div className="h-8 w-8 bg-amber-50 rounded-lg flex items-center justify-center">
                                        <Wrench className="h-4 w-4 text-amber-600" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-5 pb-4">
                                <div className="text-3xl font-black text-slate-900">{formatCurrency(financialAnalytics?.totalMaintenance)}</div>
                                <p className="text-xs text-slate-500 mt-1">Monthly depr: {formatCurrency(financialAnalytics?.monthlyDepreciation)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Asset breakdown bar chart */}
                        <Card className="border-slate-200">
                            <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold text-slate-800">
                                        Assets by {GROUP_BY_OPTIONS.find(g => g.value === groupBy)?.label}
                                    </CardTitle>
                                    <span className="text-xs text-slate-400">{PERIODS.find(p => p.value === period)?.label}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-5">
                                {!assetAnalytics?.data?.length ? (
                                    <p className="text-sm text-slate-400 text-center py-10">No data available</p>
                                ) : (
                                    <div className="space-y-3">
                                        {assetAnalytics.data.map((item, idx) => (
                                            <div key={item.name}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm text-slate-700 font-medium">{item.name || "Unknown"}</span>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span className="font-bold text-slate-800">{item.count}</span>
                                                        <span>·</span>
                                                        <span>{item.percentage}%</span>
                                                        <span>·</span>
                                                        <span>{formatCurrency(item.value)}</span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2.5">
                                                    <div
                                                        className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-2.5 rounded-full transition-all`}
                                                        style={{ width: `${Math.round(item.count / maxAssetValue * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Financial summary */}
                        <Card className="border-slate-200">
                            <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-teal-600" /> Financial Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {!financialAnalytics ? (
                                    <p className="text-sm text-slate-400 text-center py-10">No financial data</p>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {[
                                            { label: "Total Asset Value", value: financialAnalytics.totalAssetValue, color: "text-indigo-600" },
                                            { label: "Total Acquisition", value: financialAnalytics.totalAcquisition, color: "text-blue-600" },
                                            { label: "Total Depreciation", value: financialAnalytics.totalDepreciation, color: "text-amber-600" },
                                            { label: "Net Book Value", value: financialAnalytics.netBookValue, color: "text-emerald-600" },
                                            { label: "Total Disposal Value", value: financialAnalytics.totalDisposal, color: "text-slate-600" },
                                            { label: "Maintenance Spend", value: financialAnalytics.totalMaintenance, color: "text-orange-600" },
                                        ].map(row => (
                                            <div key={row.label} className="flex items-center justify-between px-5 py-3">
                                                <span className="text-sm text-slate-600">{row.label}</span>
                                                <span className={`text-sm font-bold ${row.color}`}>{formatCurrency(row.value)}</span>
                                            </div>
                                        ))}
                                        {financialAnalytics.averageAssetAge != null && (
                                            <div className="flex items-center justify-between px-5 py-3">
                                                <span className="text-sm text-slate-600">Average Asset Age</span>
                                                <span className="text-sm font-bold text-slate-700">{financialAnalytics.averageAssetAge.toFixed(1)} yrs</span>
                                            </div>
                                        )}
                                        {financialAnalytics.assetsFullyDepreciated != null && (
                                            <div className="flex items-center justify-between px-5 py-3">
                                                <span className="text-sm text-slate-600">Fully Depreciated Assets</span>
                                                <span className="text-sm font-bold text-red-600">{financialAnalytics.assetsFullyDepreciated}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* PO Analytics */}
                        <Card className="border-slate-200">
                            <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                    <ShoppingCart className="h-4 w-4 text-blue-600" /> Purchase Order Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {!poAnalytics ? (
                                    <p className="text-sm text-slate-400 text-center py-10">No PO data</p>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                                            {[
                                                { label: "Total", value: poAnalytics.totalPOs, color: "text-slate-800" },
                                                { label: "Approved", value: poAnalytics.approvedPOs, color: "text-emerald-600" },
                                                { label: "Draft", value: poAnalytics.draftPOs, color: "text-amber-600" },
                                                { label: "Rejected", value: poAnalytics.rejectedPOs, color: "text-red-600" },
                                            ].map(s => (
                                                <div key={s.label} className="py-3 text-center">
                                                    <div className={`text-xl font-black ${s.color}`}>{s.value ?? 0}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {[
                                                { label: "Average PO Value", value: formatCurrency(poAnalytics.averagePOValue) },
                                                { label: "Largest PO", value: formatCurrency(poAnalytics.largestPO) },
                                                { label: "Avg Approval Time", value: poAnalytics.averageApprovalTime != null ? `${poAnalytics.averageApprovalTime.toFixed(1)} days` : "—" },
                                                { label: "Avg Delivery Time", value: poAnalytics.averageDeliveryTime != null ? `${poAnalytics.averageDeliveryTime.toFixed(1)} days` : "—" },
                                            ].map(row => (
                                                <div key={row.label} className="flex items-center justify-between px-5 py-3">
                                                    <span className="text-sm text-slate-600">{row.label}</span>
                                                    <span className="text-sm font-bold text-slate-800">{row.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Top Suppliers */}
                        <Card className="border-slate-200">
                            <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                    <ArrowUpRight className="h-4 w-4 text-teal-600" /> Top Suppliers
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {!poAnalytics?.topSuppliers?.length ? (
                                    <p className="text-sm text-slate-400 text-center py-10">No supplier data</p>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {poAnalytics.topSuppliers.slice(0, 8).map((s, idx) => (
                                            <div key={s.supplier} className="flex items-center justify-between px-5 py-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                                                    <span className="text-sm text-slate-700 font-medium truncate">{s.supplier}</span>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0 text-right">
                                                    <span className="text-xs text-slate-400">{s.poCount} POs</span>
                                                    <span className="text-sm font-bold text-teal-700">{formatCurrency(s.totalValue)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Maintenance Analytics */}
                    {maintenanceAnalytics && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card className="border-slate-200">
                                <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                        <Wrench className="h-4 w-4 text-teal-500" /> Maintenance Analytics
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5 space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <p className="text-xs text-slate-500">Total Cost</p>
                                            <p className="text-lg font-bold text-slate-800">{formatCurrency(maintenanceAnalytics.totalMaintenanceCost)}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <p className="text-xs text-slate-500">Avg Cost</p>
                                            <p className="text-lg font-bold text-slate-800">{formatCurrency(maintenanceAnalytics.averageCost)}</p>
                                        </div>
                                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                            <p className="text-xs text-slate-500">Completion Rate</p>
                                            <p className="text-lg font-bold text-emerald-700">{(maintenanceAnalytics.completionRate * 100).toFixed(1)}%</p>
                                        </div>
                                        <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                            <p className="text-xs text-slate-500">Overdue</p>
                                            <p className="text-lg font-bold text-red-700">{maintenanceAnalytics.overdueCount}</p>
                                        </div>
                                    </div>
                                    {maintenanceAnalytics.byType && Object.keys(maintenanceAnalytics.byType).length > 0 && (
                                        <div className="space-y-2 pt-2 border-t border-slate-100">
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">By Type</p>
                                            {Object.entries(maintenanceAnalytics.byType).map(([type, data], idx) => {
                                                const maxCount = Math.max(...Object.values(maintenanceAnalytics.byType).map(d => d.count), 1);
                                                return (
                                                    <div key={type}>
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="text-slate-600 font-medium">{type}</span>
                                                            <span className="text-slate-500">{data.count} · {formatCurrency(data.cost)}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                            <div className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-1.5 rounded-full`} style={{ width: `${Math.round(data.count / maxCount * 100)}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Depreciation Trends */}
                            {depreciationTrend && depreciationTrend.data?.length > 0 && (
                                <Card className="border-slate-200">
                                    <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-purple-500" /> Depreciation Trends (12 months)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2">Month</th>
                                                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2">Depreciation</th>
                                                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2">Net Book Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {depreciationTrend.data.slice(0, 12).map((row) => (
                                                        <tr key={row.month} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-2 text-slate-700 font-medium">{row.month}</td>
                                                            <td className="px-4 py-2 text-right text-amber-700">{formatCurrency(row.totalDepreciation)}</td>
                                                            <td className="px-4 py-2 text-right font-semibold text-slate-800">{formatCurrency(row.netBookValue)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* Financial breakdown by category */}
                    {categoryBreakdown.length > 0 && (
                        <Card className="border-slate-200">
                            <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-sm font-semibold text-slate-800">Financial Breakdown by Category</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Category</th>
                                                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Assets</th>
                                                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Total Value</th>
                                                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Monthly Depr.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {categoryBreakdown.map((cat, idx) => (
                                                <tr key={cat.name} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`h-2.5 w-2.5 rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]}`} />
                                                            <span className="font-medium text-slate-800">{cat.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-right text-slate-600">{cat.count}</td>
                                                    <td className="px-5 py-3 text-right font-semibold text-slate-800">{formatCurrency(cat.value)}</td>
                                                    <td className="px-5 py-3 text-right text-amber-700">{formatCurrency(cat.monthlyDepreciation)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
