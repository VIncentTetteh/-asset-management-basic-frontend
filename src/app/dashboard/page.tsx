"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    BarChart3,
    Building2,
    Clock,
    Cpu,
    FileText,
    Hash,
    Hexagon,
    Mail,
    MapPin,
    PackageCheck,
    Receipt,
    ScanLine,
    ShieldCheck,
    ShoppingCart,
    TrendingUp,
    Webhook,
    Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/contexts/CurrencyContext";
import { authService } from "@/services/authService";
import { dashboardService } from "@/services/dashboardService";
import { organisationService } from "@/services/organisationService";
import { userService } from "@/services/userService";
import { webhookService } from "@/services/webhookService";
import { AssetsByDepartment, DepreciationSummary, Organisation } from "@/types";

interface DashboardStats {
    totalAssets: number;
    activeAssets: number;
    totalAssetValue: number;
    pendingApprovals: number;
    overdueMaintenanceCount: number;
    upcomingMaintenanceCount: number;
    openPurchaseOrders: number;
    expiredLicenses: number;
    totalUsers: number;
    totalWebhooks: number;
    activeWebhooks: number;
}

interface AssetStatusBreakdownItem {
    key: string;
    label: string;
    count: number;
    value: number;
    percentage: number;
    color: string;
}

interface DashboardMaintenanceAlerts {
    critical: number;
    warning: number;
    scheduled: number;
    alerts: {
        assetName: string;
        severity: string;
        nextDueDate?: string;
        daysOverdue?: number;
    }[];
}

const QUICK_LINKS = [
    { href: "/assets", label: "All Assets", icon: Hexagon, color: "text-indigo-600 bg-indigo-50" },
    { href: "/compliance/controls", label: "Controls", icon: ShieldCheck, color: "text-teal-600 bg-teal-50" },
    { href: "/compliance/risks", label: "Risk Register", icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
    { href: "/compliance/incidents", label: "Incidents", icon: Activity, color: "text-red-600 bg-red-50" },
    { href: "/compliance/patch-records", label: "Patch Records", icon: PackageCheck, color: "text-blue-600 bg-blue-50" },
    { href: "/compliance/vulnerability-scans", label: "Vuln Scans", icon: ScanLine, color: "text-purple-600 bg-purple-50" },
    { href: "/compliance/ics-assets", label: "ICS Assets", icon: Cpu, color: "text-orange-600 bg-orange-50" },
    { href: "/analytics", label: "Analytics", icon: BarChart3, color: "text-emerald-600 bg-emerald-50" },
    { href: "/reports", label: "Reports", icon: FileText, color: "text-slate-600 bg-slate-50" },
];

const EMPTY_STATS: DashboardStats = {
    totalAssets: 0,
    activeAssets: 0,
    totalAssetValue: 0,
    pendingApprovals: 0,
    overdueMaintenanceCount: 0,
    upcomingMaintenanceCount: 0,
    openPurchaseOrders: 0,
    expiredLicenses: 0,
    totalUsers: 0,
    totalWebhooks: 0,
    activeWebhooks: 0,
};

const STATUS_META: Record<string, { label: string; color: string }> = {
    IN_USE: { label: "In Use", color: "bg-emerald-500" },
    IN_STOCK: { label: "In Stock", color: "bg-blue-500" },
    UNDER_MAINTENANCE: { label: "Maintenance", color: "bg-amber-500" },
    MAINTENANCE: { label: "Maintenance", color: "bg-amber-500" },
    DISPOSED: { label: "Disposed", color: "bg-rose-500" },
    RETIRED: { label: "Retired", color: "bg-slate-400" },
    RESERVED: { label: "Reserved", color: "bg-violet-500" },
    PENDING_PROCUREMENT: { label: "Pending Procurement", color: "bg-cyan-500" },
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const toNumber = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value.replace(/,/g, "").trim());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const formatLabel = (value: string) =>
    value
        .toLowerCase()
        .split("_")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

const normalizeDashboardSummary = (payload: unknown): DashboardStats => {
    const raw = asRecord(payload) ?? {};

    return {
        ...EMPTY_STATS,
        totalAssets: toNumber(raw.totalAssets),
        activeAssets: toNumber(raw.activeAssets ?? raw.assetsInUse),
        totalAssetValue: toNumber(raw.totalAssetValue),
        pendingApprovals: toNumber(raw.pendingApprovals ?? raw.pendingPurchaseOrders ?? raw.pendingPOs),
        overdueMaintenanceCount: toNumber(raw.overdueMaintenanceCount ?? raw.maintenanceAlerts),
        upcomingMaintenanceCount: toNumber(raw.upcomingMaintenanceCount ?? raw.scheduledMaintenance ?? raw.assetsNeedingMaintenance),
        openPurchaseOrders: toNumber(raw.openPurchaseOrders ?? raw.pendingPurchaseOrders ?? raw.pendingPOs),
        expiredLicenses: toNumber(raw.expiredLicenses ?? raw.deprecatedAssets),
        // Use summary totals as baseline; separate API calls will override these if successful
        totalUsers: toNumber(raw.totalUsers),
        totalWebhooks: toNumber(raw.totalWebhooks),
        activeWebhooks: toNumber(raw.activeWebhooks),
    };
};

const normalizeAssetsByStatus = (payload: unknown): AssetStatusBreakdownItem[] => {
    const raw = asRecord(payload);
    const items = Array.isArray(payload)
        ? payload
        : Array.isArray(raw?.data)
            ? raw.data
            : [];

    const normalized = items
        .map(item => {
            const entry = asRecord(item) ?? {};
            const key = String(entry.status ?? entry.name ?? "UNKNOWN").toUpperCase();
            const meta = STATUS_META[key];

            return {
                key,
                label: meta?.label ?? formatLabel(key),
                count: toNumber(entry.count),
                value: toNumber(entry.value),
                percentage: toNumber(entry.percentage),
                color: meta?.color ?? "bg-slate-300",
            };
        })
        .filter(item => item.count > 0 || item.value > 0);

    const total = normalized.reduce((sum, item) => sum + item.count, 0);

    return normalized.map(item => ({
        ...item,
        percentage: item.percentage > 0 ? item.percentage : total ? (item.count / total) * 100 : 0,
    }));
};

const normalizeAssetsByDepartment = (payload: unknown): AssetsByDepartment | null => {
    const raw = asRecord(payload);
    const items = Array.isArray(payload)
        ? payload
        : Array.isArray(raw?.data)
            ? raw.data
            : [];

    const grouped = items
        .map(item => {
            const entry = asRecord(item) ?? {};
            const departmentName = String(entry.departmentName ?? "").trim() || "Unassigned";

            return {
                departmentId: String(entry.departmentId ?? ""),
                departmentName,
                count: toNumber(entry.count),
                value: toNumber(entry.value),
                percentage: toNumber(entry.percentage),
            };
        })
        .filter(item => item.count > 0 || item.value > 0)
        .reduce<Map<string, AssetsByDepartment["data"][number]>>((acc, item) => {
            const key = item.departmentId || item.departmentName.toLowerCase();
            const existing = acc.get(key);

            if (existing) {
                existing.count += item.count;
                existing.value += item.value;
                existing.percentage = (existing.percentage ?? 0) + (item.percentage ?? 0);
                return acc;
            }

            acc.set(key, { ...item });
            return acc;
        }, new Map());

    const data = Array.from(grouped.values()).sort((left, right) => right.count - left.count);

    if (data.length === 0) return null;

    return {
        data,
        total: toNumber(raw?.total) || data.reduce((sum, item) => sum + item.count, 0),
        totalValue: toNumber(raw?.totalValue) || data.reduce((sum, item) => sum + item.value, 0),
    };
};

const normalizeDepreciationSummary = (payload: unknown): DepreciationSummary | null => {
    const raw = asRecord(payload);
    if (!raw) return null;

    return {
        totalDepreciation: toNumber(raw.totalDepreciation ?? raw.accumulatedDepreciation),
        netBookValue: toNumber(raw.netBookValue),
        assetsFullyDepreciated: toNumber(raw.assetsFullyDepreciated ?? raw.fullyDepreciatedCount),
        monthlyDepreciation: toNumber(raw.monthlyDepreciation ?? raw.depreciationThisYear),
        byMethod: raw.byMethod as DepreciationSummary["byMethod"],
    };
};

const normalizeMaintenanceAlerts = (payload: unknown): DashboardMaintenanceAlerts | null => {
    const raw = asRecord(payload);
    if (!raw) return null;

    const alerts = Array.isArray(raw.alerts)
        ? raw.alerts.map(item => {
            const entry = asRecord(item) ?? {};
            return {
                assetName: String(entry.assetName ?? "Asset"),
                severity: String(entry.severity ?? "warning"),
                nextDueDate: typeof entry.nextDueDate === "string" ? entry.nextDueDate : undefined,
                daysOverdue: entry.daysOverdue == null ? undefined : toNumber(entry.daysOverdue),
            };
        })
        : [];

    return {
        critical: toNumber(raw.critical ?? raw.criticalCount),
        warning: toNumber(raw.warning ?? raw.warningCount),
        scheduled: toNumber(raw.scheduled ?? raw.scheduledCount),
        alerts,
    };
};

const formatDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? value
        : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatCompactCurrency = (amount: number, currencyCode: string) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "narrowSymbol",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(amount);

export default function DashboardPage() {
    const { currency, format } = useCurrency();
    const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
    const [myOrg, setMyOrg] = useState<Organisation | null>(null);
    const [assetStatusBreakdown, setAssetStatusBreakdown] = useState<AssetStatusBreakdownItem[]>([]);
    const [assetsByDepartment, setAssetsByDepartment] = useState<AssetsByDepartment | null>(null);
    const [depreciationSummary, setDepreciationSummary] = useState<DepreciationSummary | null>(null);
    const [maintenanceAlerts, setMaintenanceAlerts] = useState<DashboardMaintenanceAlerts | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isActive = true;

        const load = async () => {
            try {
                const profile = await authService.getProfile();
                const orgId = asRecord(profile)?.organisationId;

                const [summary, profileOrg] = await Promise.all([
                    dashboardService.getSummary(),
                    typeof orgId === "string" && orgId ? organisationService.get(orgId) : Promise.resolve(null),
                ]);

                if (!isActive) return;

                if (profileOrg) setMyOrg(profileOrg);

                const baseStats = normalizeDashboardSummary(summary);

                const [
                    statusResult,
                    deptResult,
                    depreciationResult,
                    alertsResult,
                    usersResult,
                    webhooksResult,
                ] = await Promise.allSettled([
                    dashboardService.getAssetsByStatus(),
                    dashboardService.getAssetsByDepartment(),
                    dashboardService.getDepreciationSummary(),
                    dashboardService.getMaintenanceAlerts(),
                    userService.getAll(),
                    webhookService.list(),
                ]);

                if (!isActive) return;

                const nextStats = { ...baseStats };

                if (statusResult.status === "fulfilled") {
                    setAssetStatusBreakdown(normalizeAssetsByStatus(statusResult.value));
                }

                if (deptResult.status === "fulfilled") {
                    setAssetsByDepartment(normalizeAssetsByDepartment(deptResult.value));
                }

                if (depreciationResult.status === "fulfilled") {
                    setDepreciationSummary(normalizeDepreciationSummary(depreciationResult.value));
                }

                if (alertsResult.status === "fulfilled") {
                    setMaintenanceAlerts(normalizeMaintenanceAlerts(alertsResult.value));
                }

                if (usersResult.status === "fulfilled") {
                    nextStats.totalUsers = usersResult.value.length;
                }

                if (webhooksResult.status === "fulfilled") {
                    nextStats.totalWebhooks = toNumber(webhooksResult.value.totalWebhooks);
                    nextStats.activeWebhooks = toNumber(webhooksResult.value.activeWebhooks);
                }

                setStats(nextStats);
            } catch (err) {
                console.error("Dashboard load failed:", err);
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };

        load();

        return () => {
            isActive = false;
        };
    }, []);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-64 rounded-lg bg-slate-100 animate-pulse" />
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
                    <div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-32 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    const totalBreakdown = assetStatusBreakdown.reduce((sum, item) => sum + item.count, 0);
    const assetUtilization = stats.totalAssets ? Math.round((stats.activeAssets / stats.totalAssets) * 100) : 0;
    const maintenanceLoad = stats.overdueMaintenanceCount + stats.upcomingMaintenanceCount;
    const inactiveAssets = Math.max(stats.totalAssets - stats.activeAssets, 0);
    const topDepartments = assetsByDepartment?.data?.slice(0, 4) ?? [];
    const activeAlertPreview = maintenanceAlerts?.alerts?.slice(0, 3) ?? [];
    const heroPortfolioValue = formatCompactCurrency(stats.totalAssetValue, currency);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        Asset<span className="text-teal-600">IQ</span>
                        {myOrg && <span className="font-normal text-slate-400"> | {myOrg.name}</span>}
                    </h1>
                    <p className="text-slate-500">
                        Company overview with portfolio value, maintenance pressure, approvals, and asset distribution.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/analytics">
                        <Button variant="outline" className="gap-2">
                            <BarChart3 className="h-4 w-4" /> Analytics
                        </Button>
                    </Link>
                    <Link href="/reports">
                        <Button className="gap-2 bg-teal-600 hover:bg-teal-700">
                            <FileText className="h-4 w-4" /> Reports
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
                <Card className="overflow-hidden border-0 shadow-sm">
                    <CardContent className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 p-6 text-white">
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                                            <Building2 className="h-5 w-5 text-teal-300" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-200">
                                                Company Snapshot
                                            </p>
                                            <h2 className="text-2xl font-semibold text-white">
                                                {myOrg?.name || "Your Organisation"}
                                            </h2>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                                        <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                            {myOrg?.status || "Active"}
                                        </span>
                                        {myOrg?.industry && <span>{myOrg.industry}</span>}
                                        {myOrg?.country && (
                                            <>
                                                <span className="text-slate-500">•</span>
                                                <span>{myOrg.country}</span>
                                            </>
                                        )}
                                        {myOrg?.timezone && (
                                            <>
                                                <span className="text-slate-500">•</span>
                                                <span>{myOrg.timezone}</span>
                                            </>
                                        )}
                                    </div>
                                    <p className="max-w-2xl text-sm leading-6 text-slate-300">
                                        The dashboard now highlights the shape of your company at a glance: how much value
                                        is under management, where maintenance is stacking up, and what needs attention
                                        next.
                                    </p>
                                </div>

                                <div className="grid min-w-[220px] gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">People</p>
                                        <p className="mt-1 text-2xl font-bold text-white">{stats.totalUsers?.toLocaleString() ?? "0"}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Webhooks</p>
                                        <p className="mt-1 text-2xl font-bold text-white">{stats.activeWebhooks?.toLocaleString() ?? "0"}</p>
                                        <p className="text-xs text-slate-400">{stats.totalWebhooks?.toLocaleString() ?? "0"} configured</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Alerts</p>
                                        <p className="mt-1 text-2xl font-bold text-white">{maintenanceLoad?.toLocaleString() ?? "0"}</p>
                                        <p className="text-xs text-slate-400">{stats.expiredLicenses?.toLocaleString() ?? "0"} expired licenses</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Portfolio Value</p>
                                    <p className="mt-2 text-[2rem] font-black leading-none text-white lg:text-[2.25rem]">
                                        {heroPortfolioValue}
                                    </p>
                                    <p className="mt-2 text-xs text-slate-300">
                                        Full value: {format(stats.totalAssetValue)} · {stats.totalAssets?.toLocaleString() ?? "0"} tracked assets
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assets In Service</p>
                                    <p className="mt-2 text-[2rem] font-black leading-none text-white lg:text-[2.25rem]">{assetUtilization}%</p>
                                    <p className="mt-1 text-xs text-slate-300">
                                        {stats.activeAssets?.toLocaleString() ?? "0"} active · {inactiveAssets?.toLocaleString() ?? "0"} not active
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Approval Queue</p>
                                    <p className="mt-2 text-[2rem] font-black leading-none text-white lg:text-[2.25rem]">
                                        {stats.pendingApprovals?.toLocaleString() ?? "0"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-300">
                                        {stats.openPurchaseOrders?.toLocaleString() ?? "0"} open purchase orders
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Maintenance Pressure</p>
                                    <p className="mt-2 text-[2rem] font-black leading-none text-white lg:text-[2.25rem]">
                                        {maintenanceLoad?.toLocaleString() ?? "0"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-300">
                                        {stats.overdueMaintenanceCount?.toLocaleString() ?? "0"} overdue · {stats.upcomingMaintenanceCount?.toLocaleString() ?? "0"} upcoming
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
                        <CardTitle className="text-base font-semibold text-slate-800">Company Snapshot</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5">
                        <div className="grid gap-4">
                            <div className="flex items-start gap-3">
                                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Primary Contact</p>
                                    <p className="truncate text-sm font-medium text-slate-800">{myOrg?.contactEmail || "Not set"}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">{myOrg?.contactPhone || "Phone not set"}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Location</p>
                                    <p className="text-sm font-medium text-slate-800">{myOrg?.address || "Address not set"}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        {[myOrg?.country, myOrg?.timezone].filter(Boolean).join(" · ") || "Country and timezone not set"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Hash className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Registration</p>
                                    <p className="text-sm font-medium text-slate-800">{myOrg?.registrationNumber || "Not set"}</p>
                                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                        <Receipt className="h-3 w-3" />
                                        {myOrg?.taxId ? `Tax ID: ${myOrg.taxId}` : "Tax ID not set"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-slate-800">Top departments</p>
                                <Link href="/departments">
                                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500">
                                        View <ArrowRight className="h-3 w-3" />
                                    </Button>
                                </Link>
                            </div>
                            <div className="mt-3 space-y-3">
                                {topDepartments.length === 0 ? (
                                    <p className="text-sm text-slate-500">Department-level asset distribution will appear here once data is available.</p>
                                ) : topDepartments.map((department, index) => {
                                    const pct = assetsByDepartment?.total
                                        ? Math.round((department.count / assetsByDepartment.total) * 100)
                                        : 0;

                                    return (
                                        <div key={department.departmentId || `${department.departmentName}-${index}`}>
                                            <div className="mb-1 flex items-center justify-between gap-3">
                                                <span className="truncate text-sm font-medium text-slate-700">
                                                    {department.departmentName}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-500">
                                                    {department.count?.toLocaleString() ?? "0"} assets
                                                </span>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-200">
                                                <div className="h-2 rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asset Estate</p>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <Hexagon className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900">{stats.totalAssets?.toLocaleString() ?? "0"}</div>
                        <p className="mt-1 text-xs text-slate-500">
                            {stats.activeAssets?.toLocaleString() ?? "0"} active · {inactiveAssets?.toLocaleString() ?? "0"} inactive
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portfolio Value</p>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900">{format(stats.totalAssetValue || 0)}</div>
                        <p className="mt-1 text-xs text-slate-500">
                            Net book value: {format(depreciationSummary?.netBookValue ?? 0)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Maintenance Load</p>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                            <Wrench className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900">{maintenanceLoad?.toLocaleString() ?? "0"}</div>
                        <p className="mt-1 text-xs text-slate-500">
                            {stats.overdueMaintenanceCount?.toLocaleString() ?? "0"} overdue · {stats.upcomingMaintenanceCount?.toLocaleString() ?? "0"} upcoming
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Governance Watch</p>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900">{stats.expiredLicenses?.toLocaleString() ?? "0"}</div>
                        <p className="mt-1 text-xs text-slate-500">
                            {stats.activeWebhooks?.toLocaleString() ?? "0"} active webhooks · {stats.totalUsers?.toLocaleString() ?? "0"} users
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-slate-200">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                <TrendingUp className="h-4 w-4 text-indigo-500" /> Asset Health Breakdown
                            </CardTitle>
                            <Link href="/assets">
                                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500">
                                    View All <ArrowRight className="h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 p-5">
                        {assetStatusBreakdown.length === 0 ? (
                            <p className="py-8 text-center text-sm text-slate-400">No asset data available</p>
                        ) : assetStatusBreakdown.map(item => {
                            const pct = totalBreakdown ? Math.round((item.count / totalBreakdown) * 100) : Math.round(item.percentage);
                            return (
                                <div key={item.key}>
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-600">{item.label}</span>
                                        <span className="text-sm font-bold text-slate-800">
                                            {item.count?.toLocaleString() ?? "0"}{" "}
                                            <span className="text-xs font-normal text-slate-400">({pct}%)</span>
                                        </span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-slate-100">
                                        <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <Card className="border-slate-200">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                            <AlertTriangle className="h-4 w-4 text-amber-500" /> Action Required
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            <Link href="/purchase-orders" className="group flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-sky-100 p-2 text-sky-600">
                                        <ShoppingCart className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Purchase Orders</p>
                                        <p className="text-xs text-slate-500">
                                            {stats.pendingApprovals?.toLocaleString() ?? "0"} pending approvals · {stats.openPurchaseOrders?.toLocaleString() ?? "0"} open
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-sky-600">{stats.openPurchaseOrders?.toLocaleString() ?? "0"}</span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                                </div>
                            </Link>

                            <Link href="/maintenance" className="group flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-teal-100 p-2 text-teal-600">
                                        <Wrench className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Maintenance Alerts</p>
                                        <p className="text-xs text-slate-500">
                                            {(maintenanceAlerts?.critical ?? stats.overdueMaintenanceCount)?.toLocaleString() ?? "0"} critical ·{" "}
                                            {(maintenanceAlerts?.scheduled ?? stats.upcomingMaintenanceCount)?.toLocaleString() ?? "0"} scheduled
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-teal-600">{maintenanceLoad?.toLocaleString() ?? "0"}</span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                                </div>
                            </Link>

                            <Link href="/licenses" className="group flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">License Renewals</p>
                                        <p className="text-xs text-slate-500">
                                            {stats.expiredLicenses?.toLocaleString() ?? "0"} expired licenses need review
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-amber-600">{stats.expiredLicenses?.toLocaleString() ?? "0"}</span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                                </div>
                            </Link>

                            <Link href="/webhooks" className="group flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                                        <Webhook className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Automation & Integrations</p>
                                        <p className="text-xs text-slate-500">
                                            {stats.activeWebhooks?.toLocaleString() ?? "0"} active · {stats.totalWebhooks?.toLocaleString() ?? "0"} configured
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {(assetsByDepartment || depreciationSummary) && (
                <div className="grid gap-6 md:grid-cols-2">
                    {assetsByDepartment && assetsByDepartment.data.length > 0 && (
                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                        <Building2 className="h-4 w-4 text-blue-500" /> Assets by Department
                                    </CardTitle>
                                    <Link href="/assets">
                                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500">
                                            View All <ArrowRight className="h-3 w-3" />
                                        </Button>
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 p-5">
                                {assetsByDepartment.data.slice(0, 6).map((department, index) => {
                                    const pct = assetsByDepartment.total
                                        ? Math.round((department.count / assetsByDepartment.total) * 100)
                                        : 0;

                                    return (
                                        <div key={department.departmentId || `${department.departmentName}-${index}`}>
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="max-w-[60%] truncate text-sm font-medium text-slate-600">
                                                    {department.departmentName}
                                                </span>
                                                <span className="text-sm font-bold text-slate-800">
                                                    {department.count?.toLocaleString() ?? "0"}{" "}
                                                    <span className="text-xs font-normal text-slate-400">({pct}%)</span>
                                                </span>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-slate-100">
                                                <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {depreciationSummary && (
                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                    <TrendingUp className="h-4 w-4 text-purple-500" /> Depreciation Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5">
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: "Total Depreciation", value: depreciationSummary.totalDepreciation },
                                        { label: "Net Book Value", value: depreciationSummary.netBookValue },
                                        { label: "Current Depreciation", value: depreciationSummary.monthlyDepreciation },
                                        { label: "Fully Depreciated", value: depreciationSummary.assetsFullyDepreciated, isNumeric: true },
                                    ].map(item => (
                                        <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                            <p className="mb-1 text-xs text-slate-500">{item.label}</p>
                                            <p className="text-lg font-bold text-slate-800">
                                                {item.isNumeric ? item.value?.toLocaleString() ?? "0" : format(item.value || 0)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {activeAlertPreview.length > 0 && (
                <Card className="border-slate-200">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                        <CardTitle className="text-base font-semibold text-slate-800">Maintenance Alert Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 md:grid-cols-3">
                        {activeAlertPreview.map((alert, index) => (
                            <div key={`${alert.assetName}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900">{alert.assetName}</p>
                                    <span
                                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                            alert.severity.toLowerCase() === "critical"
                                                ? "bg-rose-100 text-rose-700"
                                                : "bg-amber-100 text-amber-700"
                                        }`}
                                    >
                                        {alert.severity}
                                    </span>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                    {alert.daysOverdue && alert.daysOverdue > 0
                                        ? `${alert.daysOverdue} day${alert.daysOverdue === 1 ? "" : "s"} overdue`
                                        : "Upcoming maintenance"}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {formatDate(alert.nextDueDate) || "Due date not available"}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800">Quick Navigation</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
                        {QUICK_LINKS.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="group flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors hover:bg-slate-50"
                            >
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${link.color}`}>
                                    <link.icon className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-medium leading-tight text-slate-600 group-hover:text-slate-900">
                                    {link.label}
                                </span>
                            </Link>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
