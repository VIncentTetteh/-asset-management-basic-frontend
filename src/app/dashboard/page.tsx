"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    Building2,
    CheckCircle2,
    Clock,
    DollarSign,
    FileText,
    Hash,
    Hexagon,
    Mail,
    MapPin,
    Receipt,
    RefreshCw,
    ShieldCheck,
    ShoppingCart,
    TrendingUp,
    Users,
    Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/contexts/CurrencyContext";
import { authService } from "@/services/authService";
import { assetService } from "@/services/assetService";
import { assetTransferService } from "@/services/assetTransferService";
import { budgetService } from "@/services/budgetService";
import { dashboardService } from "@/services/dashboardService";
import { licenseService } from "@/services/licenseService";
import { organisationService } from "@/services/organisationService";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { userService } from "@/services/userService";
import { Asset, AssetsByDepartment, Budget, DepreciationSummary, Organisation, PurchaseOrder, SoftwareLicense } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

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
    pendingTransfers: number;
}

interface BudgetStats {
    totalBudgetAmount: number;
    totalSpentAmount: number;
    activeBudgets: number;
    exceededBudgets: number;
    utilizationPct: number;
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

// ── Constants ─────────────────────────────────────────────────────────────────

const QUICK_LINKS = [
    { href: "/assets", label: "All Assets", icon: Hexagon, color: "text-indigo-600 bg-indigo-50" },
    { href: "/maintenance", label: "Maintenance", icon: Wrench, color: "text-amber-600 bg-amber-50" },
    { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, color: "text-sky-600 bg-sky-50" },
    { href: "/budgets", label: "Budgets", icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
    { href: "/licenses", label: "Licenses", icon: ShieldCheck, color: "text-violet-600 bg-violet-50" },
    { href: "/departments", label: "Departments", icon: Building2, color: "text-teal-600 bg-teal-50" },
    { href: "/transfers", label: "Transfers", icon: RefreshCw, color: "text-rose-600 bg-rose-50" },
    { href: "/reports", label: "Reports", icon: FileText, color: "text-slate-600 bg-slate-50" },
    { href: "/users", label: "Users", icon: Users, color: "text-blue-600 bg-blue-50" },
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
    pendingTransfers: 0,
};

const EMPTY_BUDGET_STATS: BudgetStats = {
    totalBudgetAmount: 0,
    totalSpentAmount: 0,
    activeBudgets: 0,
    exceededBudgets: 0,
    utilizationPct: 0,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const unwrapPayloadRecord = (value: unknown): Record<string, unknown> => {
    const direct = asRecord(value);
    if (!direct) return {};

    const wrapped = asRecord(direct.data) ?? asRecord(direct.content) ?? asRecord(direct.item);
    return wrapped ?? direct;
};

const asNonEmptyString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

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

const getProfileOrganisationId = (payload: unknown): string | undefined => {
    const raw = asRecord(payload) ?? {};
    return asNonEmptyString(raw.organisationId ?? raw.organizationId);
};

const persistResolvedUser = (payload: unknown, organisationId?: string) => {
    if (typeof window === "undefined") return;

    const profile = asRecord(payload);
    if (!profile && !organisationId) return;

    try {
        const current = JSON.parse(localStorage.getItem("user") || "{}") as Record<string, unknown>;
        const merged = {
            ...current,
            ...(profile ?? {}),
            ...(organisationId ? { organisationId } : {}),
        };
        localStorage.setItem("user", JSON.stringify(merged));
    } catch {
        if (!profile && !organisationId) return;
        const fallback = {
            ...(profile ?? {}),
            ...(organisationId ? { organisationId } : {}),
        };
        localStorage.setItem("user", JSON.stringify(fallback));
    }
};

const pickOrganisation = (organisations: Organisation[], organisationId?: string): Organisation | null => {
    if (!organisations.length) return null;
    if (organisationId) {
        return organisations.find(org => org.id === organisationId) ?? organisations[0];
    }
    return organisations[0];
};

// ── Normalization ─────────────────────────────────────────────────────────────

const normalizeDashboardSummary = (payload: unknown): DashboardStats => {
    const raw = unwrapPayloadRecord(payload);
    return {
        ...EMPTY_STATS,
        totalAssets: toNumber(raw.totalAssets),
        activeAssets: toNumber(raw.activeAssets ?? raw.assetsInUse),
        totalAssetValue: toNumber(raw.totalAssetValue),
        // pendingApprovals is distinct from openPurchaseOrders
        pendingApprovals: toNumber(raw.pendingApprovals),
        openPurchaseOrders: toNumber(raw.openPurchaseOrders ?? raw.pendingPurchaseOrders ?? raw.pendingPOs),
        overdueMaintenanceCount: toNumber(raw.overdueMaintenanceCount ?? raw.maintenanceAlerts),
        upcomingMaintenanceCount: toNumber(raw.upcomingMaintenanceCount ?? raw.scheduledMaintenance ?? raw.assetsNeedingMaintenance),
        expiredLicenses: toNumber(raw.expiredLicenses),
        totalUsers: toNumber(raw.totalUsers),
        pendingTransfers: 0, // populated separately
    };
};

const hasUsableSummary = (stats: DashboardStats): boolean =>
    stats.totalAssets > 0
    || stats.activeAssets > 0
    || stats.totalAssetValue > 0
    || stats.openPurchaseOrders > 0
    || stats.pendingApprovals > 0
    || stats.overdueMaintenanceCount > 0
    || stats.upcomingMaintenanceCount > 0
    || stats.expiredLicenses > 0
    || stats.totalUsers > 0;

const fillMissingStats = (
    base: DashboardStats,
    incoming: Partial<DashboardStats>,
    keys: Array<keyof DashboardStats>
): DashboardStats => {
    const next = { ...base };
    for (const key of keys) {
        const candidate = incoming[key];
        if (typeof candidate === "number" && candidate > 0 && next[key] === 0) {
            next[key] = candidate;
        }
    }
    return next;
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
            return {
                departmentId: String(entry.departmentId ?? ""),
                departmentName: String(entry.departmentName ?? "").trim() || "Unassigned",
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

    const data = Array.from(grouped.values()).sort((l, r) => r.count - l.count);
    if (data.length === 0) return null;

    return {
        data,
        total: toNumber(raw?.total) || data.reduce((s, i) => s + i.count, 0),
        totalValue: toNumber(raw?.totalValue) || data.reduce((s, i) => s + i.value, 0),
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

const deriveStatsFromStatusBreakdown = (items: AssetStatusBreakdownItem[]): Pick<DashboardStats, "totalAssets" | "activeAssets" | "totalAssetValue"> => ({
    totalAssets: items.reduce((sum, item) => sum + item.count, 0),
    activeAssets: items
        .filter(item => item.key === "IN_USE")
        .reduce((sum, item) => sum + item.count, 0),
    totalAssetValue: items.reduce((sum, item) => sum + item.value, 0),
});

const deriveStatsFromAssets = (assets: Asset[]): Pick<DashboardStats, "totalAssets" | "activeAssets" | "totalAssetValue"> => ({
    totalAssets: assets.length,
    activeAssets: assets.filter(asset => String(asset.status ?? "").toUpperCase() === "IN_USE").length,
    totalAssetValue: assets.reduce((sum, asset) => sum + (asset.purchaseCost ?? asset.currentBookValue ?? 0), 0),
});

const deriveStatsFromPurchaseOrders = (purchaseOrders: PurchaseOrder[]): Pick<DashboardStats, "openPurchaseOrders" | "pendingApprovals"> => ({
    openPurchaseOrders: purchaseOrders.filter(order => {
        const status = String(order.status ?? "").toUpperCase();
        return !["DELIVERED", "REJECTED", "CANCELLED"].includes(status);
    }).length,
    pendingApprovals: purchaseOrders.filter(order => {
        const status = String(order.status ?? "").toUpperCase();
        return status === "SUBMITTED" || status === "PENDING";
    }).length,
});

const countExpiredLicenses = (licenses: SoftwareLicense[]): number => {
    const now = Date.now();
    return licenses.filter(license => {
        const status = String(license.status ?? "").toUpperCase();
        if (status === "EXPIRED") return true;

        const expiryDate = asNonEmptyString(license.expiryDate);
        if (!expiryDate) return false;

        const parsed = new Date(expiryDate);
        return !Number.isNaN(parsed.getTime()) && parsed.getTime() < now;
    }).length;
};

const computeBudgetStats = (budgets: Budget[]): BudgetStats => {
    if (!budgets.length) return EMPTY_BUDGET_STATS;
    const activeStatuses = new Set(["ACTIVE", "OPEN", "APPROVED"]);
    const activeBudgets = budgets.filter(b => activeStatuses.has(String(b.status ?? "").toUpperCase()));
    const totalAmount = activeBudgets.reduce((s, b) => s + (b.totalAmount ?? 0), 0);
    const totalSpent = activeBudgets.reduce((s, b) => s + (b.spentAmount ?? 0), 0);
    return {
        totalBudgetAmount: totalAmount,
        totalSpentAmount: totalSpent,
        activeBudgets: activeBudgets.length,
        exceededBudgets: budgets.filter(b => String(b.status ?? "").toUpperCase() === "EXCEEDED").length,
        utilizationPct: totalAmount > 0 ? Math.round((totalSpent / totalAmount) * 100) : 0,
    };
};

// ── Formatters ────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { currency, format } = useCurrency();

    const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
    const [budgetStats, setBudgetStats] = useState<BudgetStats>(EMPTY_BUDGET_STATS);
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
                const [profileResult, organisationsResult] = await Promise.allSettled([
                    authService.getProfile(),
                    organisationService.getAll(),
                ]);

                if (!isActive) return;
                const profileOrgId = profileResult.status === "fulfilled"
                    ? getProfileOrganisationId(profileResult.value)
                    : undefined;
                const resolvedOrg = organisationsResult.status === "fulfilled"
                    ? pickOrganisation(organisationsResult.value, profileOrgId)
                    : null;
                const resolvedOrgId = profileOrgId || resolvedOrg?.id;

                if (organisationsResult.status === "fulfilled") {
                    setMyOrg(resolvedOrg);
                }
                if (profileResult.status === "fulfilled" || resolvedOrgId) {
                    persistResolvedUser(
                        profileResult.status === "fulfilled" ? profileResult.value : null,
                        resolvedOrgId
                    );
                }

                const summaryResult = await Promise.allSettled([
                    dashboardService.getSummary(resolvedOrgId),
                ]);
                const summary = summaryResult[0];

                const normalizedSummary = summary.status === "fulfilled"
                    ? normalizeDashboardSummary(summary.value)
                    : { ...EMPTY_STATS };
                const hasSummary = summary.status === "fulfilled";
                const summaryIsUsable = hasSummary && hasUsableSummary(normalizedSummary);
                let nextStats = { ...normalizedSummary };

                const [
                    statusResult,
                    assetsResult,
                    deptResult,
                    depreciationResult,
                    alertsResult,
                    usersResult,
                    budgetsResult,
                    transfersResult,
                    purchaseOrdersResult,
                    licensesResult,
                ] = await Promise.allSettled([
                    dashboardService.getAssetsByStatus(resolvedOrgId),
                    assetService.getAll(),
                    dashboardService.getAssetsByDepartment(resolvedOrgId),
                    dashboardService.getDepreciationSummary(resolvedOrgId),
                    dashboardService.getMaintenanceAlerts(resolvedOrgId),
                    userService.getAll(),
                    budgetService.getAll(),
                    assetTransferService.getAll(),
                    purchaseOrderService.getAll(),
                    licenseService.getAll(),
                ]);

                if (!isActive) return;

                if (statusResult.status === "fulfilled") {
                    const normalizedStatus = normalizeAssetsByStatus(statusResult.value);
                    setAssetStatusBreakdown(normalizedStatus);
                    nextStats = fillMissingStats(
                        nextStats,
                        deriveStatsFromStatusBreakdown(normalizedStatus),
                        ["totalAssets", "activeAssets", "totalAssetValue"]
                    );
                }
                if (assetsResult.status === "fulfilled") {
                    const assetStats = deriveStatsFromAssets(assetsResult.value);
                    nextStats = fillMissingStats(nextStats, assetStats, [
                        "totalAssets",
                        "activeAssets",
                        "totalAssetValue",
                    ]);
                }
                if (deptResult.status === "fulfilled") {
                    setAssetsByDepartment(normalizeAssetsByDepartment(deptResult.value));
                }
                if (depreciationResult.status === "fulfilled") {
                    setDepreciationSummary(normalizeDepreciationSummary(depreciationResult.value));
                }
                if (alertsResult.status === "fulfilled") {
                    const normalizedAlerts = normalizeMaintenanceAlerts(alertsResult.value);
                    setMaintenanceAlerts(normalizedAlerts);
                    if (normalizedAlerts) {
                        nextStats = fillMissingStats(nextStats, {
                            overdueMaintenanceCount: normalizedAlerts.critical,
                            upcomingMaintenanceCount: normalizedAlerts.scheduled,
                        }, ["overdueMaintenanceCount", "upcomingMaintenanceCount"]);
                    }
                }
                if (usersResult.status === "fulfilled") {
                    nextStats.totalUsers = usersResult.value.length;
                }
                if (budgetsResult.status === "fulfilled") {
                    setBudgetStats(computeBudgetStats(budgetsResult.value));
                }
                if (transfersResult.status === "fulfilled") {
                    const pending = transfersResult.value.filter(
                        t => {
                            const status = String(t.status ?? "").toUpperCase();
                            return status === "PENDING" || status === "REQUESTED";
                        }
                    ).length;
                    nextStats.pendingTransfers = pending;
                }
                if (purchaseOrdersResult.status === "fulfilled") {
                    nextStats = fillMissingStats(
                        nextStats,
                        deriveStatsFromPurchaseOrders(purchaseOrdersResult.value),
                        ["openPurchaseOrders", "pendingApprovals"]
                    );
                }
                if (licensesResult.status === "fulfilled") {
                    nextStats = fillMissingStats(nextStats, {
                        expiredLicenses: countExpiredLicenses(licensesResult.value),
                    }, ["expiredLicenses"]);
                }

                if (hasSummary && !summaryIsUsable) {
                    console.warn("Dashboard summary response fulfilled but missing expected metrics; using fallback data merges.");
                }

                setStats(nextStats);
            } catch (err) {
                console.error("Dashboard load failed:", err);
            } finally {
                if (isActive) setIsLoading(false);
            }
        };

        load();
        return () => { isActive = false; };
    }, []);

    // ── Derived values ────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-64 rounded-lg bg-slate-100 animate-pulse" />
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
                    <div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    const totalBreakdown = assetStatusBreakdown.reduce((s, i) => s + i.count, 0);
    const assetUtilization = stats.totalAssets ? Math.round((stats.activeAssets / stats.totalAssets) * 100) : 0;
    const maintenanceLoad = stats.overdueMaintenanceCount + stats.upcomingMaintenanceCount;
    const inactiveAssets = Math.max(stats.totalAssets - stats.activeAssets, 0);
    const topDepartments = assetsByDepartment?.data?.slice(0, 4) ?? [];
    const alertPreview = maintenanceAlerts?.alerts?.slice(0, 3) ?? [];
    const openActions = (stats.openPurchaseOrders ?? 0) + (stats.pendingTransfers ?? 0);

    const budgetBarColor =
        budgetStats.utilizationPct >= 100
            ? "bg-rose-500"
            : budgetStats.utilizationPct >= 80
                ? "bg-amber-500"
                : "bg-emerald-500";

    return (
        <div className="space-y-6">
            {/* ── Page Header ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        Asset<span className="text-teal-600">IQ</span>
                        {myOrg && <span className="font-normal text-slate-400"> | {myOrg.name}</span>}
                    </h1>
                    <p className="text-slate-500">
                        Live overview of your asset portfolio, maintenance status, and financial health.
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

            {/* ── Hero + Sidebar ───────────────────────────────────────────── */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">

                {/* Hero — dark gradient card */}
                <Card className="overflow-hidden border-0 shadow-sm">
                    <CardContent className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 p-6 text-white">
                        <div className="flex flex-col gap-6">
                            {/* Org name + meta + 3 mini-stats */}
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                                            <Building2 className="h-5 w-5 text-teal-300" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-200">
                                                Organisation Snapshot
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
                                    </div>
                                </div>

                                {/* 3 mini-stat chips */}
                                <div className="grid min-w-[220px] gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                                    <Link href="/users" className="rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">People</p>
                                        <p className="mt-1 text-2xl font-bold text-white">
                                            {stats.totalUsers.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-slate-400">registered users</p>
                                    </Link>
                                    <Link href="/budgets" className="rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Budgets</p>
                                        <p className="mt-1 text-2xl font-bold text-white">
                                            {budgetStats.activeBudgets}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {budgetStats.utilizationPct}% utilised
                                        </p>
                                    </Link>
                                    <Link href="/purchase-orders" className="rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Open Actions</p>
                                        <p className="mt-1 text-2xl font-bold text-white">
                                            {openActions.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {stats.openPurchaseOrders} POs · {stats.pendingTransfers} transfers
                                        </p>
                                    </Link>
                                </div>
                            </div>

                            {/* 4 hero metric tiles */}
                            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                                <Link href="/assets" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Portfolio Value</p>
                                    <p className="mt-2 text-[2rem] font-black leading-none text-white lg:text-[2.25rem]">
                                        {formatCompactCurrency(stats.totalAssetValue, currency)}
                                    </p>
                                    <p className="mt-2 text-xs text-slate-300">
                                        {stats.totalAssets.toLocaleString()} assets tracked
                                    </p>
                                </Link>
                                <Link href="/assets" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">In Service</p>
                                    <p className="mt-2 text-[2rem] font-black leading-none text-white lg:text-[2.25rem]">
                                        {assetUtilization}%
                                    </p>
                                    <p className="mt-2 text-xs text-slate-300">
                                        {stats.activeAssets.toLocaleString()} active · {inactiveAssets.toLocaleString()} idle
                                    </p>
                                </Link>
                                <Link href="/maintenance" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Maintenance Due</p>
                                    <p className={`mt-2 text-[2rem] font-black leading-none lg:text-[2.25rem] ${stats.overdueMaintenanceCount > 0 ? "text-rose-400" : "text-white"}`}>
                                        {maintenanceLoad.toLocaleString()}
                                    </p>
                                    <p className="mt-2 text-xs text-slate-300">
                                        {stats.overdueMaintenanceCount} overdue · {stats.upcomingMaintenanceCount} upcoming
                                    </p>
                                </Link>
                                <Link href="/purchase-orders" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">PO Approvals</p>
                                    <p className="mt-2 text-[2rem] font-black leading-none text-white lg:text-[2.25rem]">
                                        {stats.openPurchaseOrders.toLocaleString()}
                                    </p>
                                    <p className="mt-2 text-xs text-slate-300">
                                        {stats.pendingApprovals} pending approval
                                    </p>
                                </Link>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sidebar — org details + top departments */}
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
                        <CardTitle className="text-base font-semibold text-slate-800">Organisation Details</CardTitle>
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

                        {/* Top departments */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-slate-800">Top Departments</p>
                                <Link href="/departments">
                                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500">
                                        View All <ArrowRight className="h-3 w-3" />
                                    </Button>
                                </Link>
                            </div>
                            <div className="mt-3 space-y-3">
                                {topDepartments.length === 0 ? (
                                    <p className="text-sm text-slate-500">No department data yet. Assign assets to departments to see distribution.</p>
                                ) : topDepartments.map((dept, i) => {
                                    const pct = assetsByDepartment?.total
                                        ? Math.round((dept.count / assetsByDepartment.total) * 100)
                                        : 0;
                                    const deptLink = dept.departmentId
                                        ? `/assets?departmentId=${dept.departmentId}`
                                        : "/assets";
                                    return (
                                        <Link key={dept.departmentId || `${dept.departmentName}-${i}`} href={deptLink} className="block group">
                                            <div className="mb-1 flex items-center justify-between gap-3">
                                                <span className="truncate text-sm font-medium text-slate-700 group-hover:text-teal-700">
                                                    {dept.departmentName}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-500">
                                                    {dept.count.toLocaleString()} assets
                                                </span>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-200">
                                                <div className="h-2 rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── 4 KPI Cards ─────────────────────────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

                {/* Asset Estate */}
                <Link href="/assets">
                    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asset Estate</p>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                <Hexagon className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black text-slate-900">{stats.totalAssets.toLocaleString()}</div>
                            <p className="mt-1 text-xs text-slate-500">
                                {stats.activeAssets.toLocaleString()} active · {inactiveAssets.toLocaleString()} idle
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                {/* Portfolio Value */}
                <Link href="/assets">
                    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portfolio Value</p>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black text-slate-900">{format(stats.totalAssetValue)}</div>
                            <p className="mt-1 text-xs text-slate-500">
                                Net book value: {format(depreciationSummary?.netBookValue ?? 0)}
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                {/* Maintenance Load */}
                <Link href="/maintenance">
                    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Maintenance Load</p>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                <Wrench className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-3xl font-black ${stats.overdueMaintenanceCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
                                {maintenanceLoad.toLocaleString()}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                {stats.overdueMaintenanceCount} overdue · {stats.upcomingMaintenanceCount} upcoming
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                {/* Budget Health */}
                <Link href="/budgets">
                    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget Health</p>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <DollarSign className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-3xl font-black ${budgetStats.exceededBudgets > 0 ? "text-rose-600" : "text-slate-900"}`}>
                                {budgetStats.utilizationPct}%
                            </div>
                            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                                <div
                                    className={`h-1.5 rounded-full transition-all ${budgetBarColor}`}
                                    style={{ width: `${Math.min(budgetStats.utilizationPct, 100)}%` }}
                                />
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                {budgetStats.activeBudgets} active budgets
                                {budgetStats.exceededBudgets > 0 && (
                                    <span className="ml-1 font-semibold text-rose-600">· {budgetStats.exceededBudgets} exceeded</span>
                                )}
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* ── Asset Health + Action Required ───────────────────────────── */}
            <div className="grid gap-6 md:grid-cols-2">

                {/* Asset Health Breakdown */}
                <Card className="border-slate-200">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                <TrendingUp className="h-4 w-4 text-indigo-500" /> Asset Status Breakdown
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
                            <div className="py-8 text-center">
                                <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                                <p className="text-sm text-slate-400">No asset data available yet.</p>
                                <Link href="/assets">
                                    <Button variant="outline" size="sm" className="mt-3 text-xs">Add your first asset</Button>
                                </Link>
                            </div>
                        ) : assetStatusBreakdown.map(item => {
                            const pct = totalBreakdown ? Math.round((item.count / totalBreakdown) * 100) : Math.round(item.percentage);
                            return (
                                <Link key={item.key} href={`/assets?status=${item.key}`} className="block group">
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">{item.label}</span>
                                        <span className="text-sm font-bold text-slate-800">
                                            {item.count.toLocaleString()}{" "}
                                            <span className="text-xs font-normal text-slate-400">({pct}%)</span>
                                        </span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-slate-100">
                                        <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                    </div>
                                </Link>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* Action Required */}
                <Card className="border-slate-200">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                            <AlertTriangle className="h-4 w-4 text-amber-500" /> Action Required
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">

                            {/* Purchase Orders */}
                            <Link href="/purchase-orders" className="group flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-sky-100 p-2 text-sky-600">
                                        <ShoppingCart className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Purchase Orders</p>
                                        <p className="text-xs text-slate-500">
                                            {stats.openPurchaseOrders} open · {stats.pendingApprovals} awaiting approval
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xl font-bold ${stats.openPurchaseOrders > 0 ? "text-sky-600" : "text-slate-300"}`}>
                                        {stats.openPurchaseOrders}
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                                </div>
                            </Link>

                            {/* Maintenance */}
                            <Link href="/maintenance" className="group flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
                                        <Wrench className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Maintenance Alerts</p>
                                        <p className="text-xs text-slate-500">
                                            {maintenanceAlerts?.critical ?? stats.overdueMaintenanceCount} critical · {maintenanceAlerts?.scheduled ?? stats.upcomingMaintenanceCount} scheduled
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xl font-bold ${maintenanceLoad > 0 ? "text-amber-600" : "text-slate-300"}`}>
                                        {maintenanceLoad}
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                                </div>
                            </Link>

                            {/* License Renewals */}
                            <Link href="/licenses" className="group flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-violet-100 p-2 text-violet-600">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Expired Licenses</p>
                                        <p className="text-xs text-slate-500">
                                            {stats.expiredLicenses > 0 ? `${stats.expiredLicenses} licenses require renewal` : "All licenses are current"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xl font-bold ${stats.expiredLicenses > 0 ? "text-violet-600" : "text-slate-300"}`}>
                                        {stats.expiredLicenses}
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                                </div>
                            </Link>

                            {/* Pending Transfers */}
                            <Link href="/transfers" className="group flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-rose-100 p-2 text-rose-600">
                                        <RefreshCw className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Asset Transfers</p>
                                        <p className="text-xs text-slate-500">
                                            {stats.pendingTransfers > 0 ? `${stats.pendingTransfers} transfers awaiting approval` : "No pending transfers"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xl font-bold ${stats.pendingTransfers > 0 ? "text-rose-600" : "text-slate-300"}`}>
                                        {stats.pendingTransfers}
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                                </div>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Dept Chart + Depreciation ────────────────────────────────── */}
            {(assetsByDepartment || depreciationSummary) && (
                <div className="grid gap-6 md:grid-cols-2">

                    {assetsByDepartment && assetsByDepartment.data.length > 0 && (
                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                        <Building2 className="h-4 w-4 text-blue-500" /> Assets by Department
                                    </CardTitle>
                                    <Link href="/departments">
                                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500">
                                            Manage <ArrowRight className="h-3 w-3" />
                                        </Button>
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 p-5">
                                {assetsByDepartment.data.slice(0, 7).map((dept, i) => {
                                    const pct = assetsByDepartment.total
                                        ? Math.round((dept.count / assetsByDepartment.total) * 100)
                                        : 0;
                                    const link = dept.departmentId
                                        ? `/assets?departmentId=${dept.departmentId}`
                                        : "/assets";
                                    return (
                                        <Link key={dept.departmentId || `${dept.departmentName}-${i}`} href={link} className="block group">
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="max-w-[60%] truncate text-sm font-medium text-slate-600 group-hover:text-blue-700">
                                                    {dept.departmentName}
                                                </span>
                                                <span className="text-sm font-bold text-slate-800">
                                                    {dept.count.toLocaleString()}{" "}
                                                    <span className="text-xs font-normal text-slate-400">({pct}%)</span>
                                                </span>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-slate-100">
                                                <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {depreciationSummary && (
                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                        <TrendingUp className="h-4 w-4 text-purple-500" /> Depreciation Summary
                                    </CardTitle>
                                    <Link href="/depreciation-policies">
                                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500">
                                            Policies <ArrowRight className="h-3 w-3" />
                                        </Button>
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent className="p-5">
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: "Accumulated Depreciation", value: format(depreciationSummary.totalDepreciation) },
                                        { label: "Net Book Value", value: format(depreciationSummary.netBookValue) },
                                        { label: "Monthly Charge", value: format(depreciationSummary.monthlyDepreciation) },
                                        { label: "Fully Depreciated", value: (depreciationSummary.assetsFullyDepreciated ?? 0).toLocaleString() + " assets" },
                                    ].map(item => (
                                        <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                            <p className="mb-1 text-xs text-slate-500">{item.label}</p>
                                            <p className="text-lg font-bold text-slate-800">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* ── Budget Breakdown (if budgets exist) ─────────────────────── */}
            {budgetStats.activeBudgets > 0 && (
                <Card className="border-slate-200">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                <DollarSign className="h-4 w-4 text-emerald-500" /> Budget Overview
                            </CardTitle>
                            <Link href="/budgets">
                                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500">
                                    Manage <ArrowRight className="h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="p-5">
                        <div className="grid gap-4 sm:grid-cols-4">
                            {[
                                { label: "Total Budget", value: format(budgetStats.totalBudgetAmount), sub: `${budgetStats.activeBudgets} active budgets` },
                                { label: "Spent", value: format(budgetStats.totalSpentAmount), sub: `${budgetStats.utilizationPct}% of total` },
                                { label: "Remaining", value: format(Math.max(budgetStats.totalBudgetAmount - budgetStats.totalSpentAmount, 0)), sub: "available to allocate" },
                                {
                                    label: "Exceeded Budgets",
                                    value: budgetStats.exceededBudgets.toLocaleString(),
                                    sub: budgetStats.exceededBudgets > 0 ? "need review" : "all within limit",
                                    highlight: budgetStats.exceededBudgets > 0,
                                },
                            ].map(item => (
                                <div key={item.label} className={`rounded-lg border p-4 ${item.highlight ? "border-rose-200 bg-rose-50" : "border-slate-100 bg-slate-50"}`}>
                                    <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                                    <p className={`text-xl font-bold ${item.highlight ? "text-rose-700" : "text-slate-800"}`}>{item.value}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-slate-500">Overall utilisation</p>
                                <p className="text-xs font-semibold text-slate-700">{budgetStats.utilizationPct}%</p>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100">
                                <div
                                    className={`h-2 rounded-full transition-all ${budgetBarColor}`}
                                    style={{ width: `${Math.min(budgetStats.utilizationPct, 100)}%` }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Maintenance Alert Preview ────────────────────────────────── */}
            {alertPreview.length > 0 && (
                <Card className="border-slate-200">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold text-slate-800">
                                Maintenance Alerts
                            </CardTitle>
                            <Link href="/maintenance">
                                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500">
                                    View All <ArrowRight className="h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 md:grid-cols-3">
                        {alertPreview.map((alert, i) => (
                            <Link key={`${alert.assetName}-${i}`} href="/maintenance" className="block rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900 truncate">{alert.assetName}</p>
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                        alert.severity.toLowerCase() === "critical"
                                            ? "bg-rose-100 text-rose-700"
                                            : "bg-amber-100 text-amber-700"
                                    }`}>
                                        {alert.severity}
                                    </span>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                    {alert.daysOverdue && alert.daysOverdue > 0
                                        ? `${alert.daysOverdue} day${alert.daysOverdue === 1 ? "" : "s"} overdue`
                                        : "Upcoming maintenance"}
                                </p>
                                {alert.nextDueDate && (
                                    <p className="mt-1 text-xs text-slate-400">Due: {formatDate(alert.nextDueDate)}</p>
                                )}
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* ── Quick Navigation ─────────────────────────────────────────── */}
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
