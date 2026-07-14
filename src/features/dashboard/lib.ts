// Dashboard data model: types, constants, and response normalizers.
// Extracted verbatim from the legacy dashboard page (Phase 4 Batch A).

import { Hexagon, Wrench, ShoppingCart, DollarSign, ShieldCheck, Building2, RefreshCw, FileText, Users } from "lucide-react";
import type { Asset, AssetsByDepartment, Budget, DepreciationSummary, PurchaseOrder, SoftwareLicense } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardStats {
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

export interface BudgetStats {
    totalBudgetAmount: number;
    totalSpentAmount: number;
    activeBudgets: number;
    exceededBudgets: number;
    utilizationPct: number;
}

export interface AssetStatusBreakdownItem {
    key: string;
    label: string;
    count: number;
    value: number;
    percentage: number;
    color: string;
}

export interface DashboardMaintenanceAlerts {
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

export const QUICK_LINKS = [
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

export const EMPTY_STATS: DashboardStats = {
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

export const EMPTY_BUDGET_STATS: BudgetStats = {
    totalBudgetAmount: 0,
    totalSpentAmount: 0,
    activeBudgets: 0,
    exceededBudgets: 0,
    utilizationPct: 0,
};

export const STATUS_META: Record<string, { label: string; color: string }> = {
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

export const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

export const unwrapPayloadRecord = (value: unknown): Record<string, unknown> => {
    const direct = asRecord(value);
    if (!direct) return {};

    const wrapped = asRecord(direct.data) ?? asRecord(direct.content) ?? asRecord(direct.item);
    return wrapped ?? direct;
};

export const asNonEmptyString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

export const toNumber = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value.replace(/,/g, "").trim());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

export const formatLabel = (value: string) =>
    value
        .toLowerCase()
        .split("_")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

// ── Normalization ─────────────────────────────────────────────────────────────

export const normalizeDashboardSummary = (payload: unknown): DashboardStats => {
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

export const hasUsableSummary = (stats: DashboardStats): boolean =>
    stats.totalAssets > 0
    || stats.activeAssets > 0
    || stats.totalAssetValue > 0
    || stats.openPurchaseOrders > 0
    || stats.pendingApprovals > 0
    || stats.overdueMaintenanceCount > 0
    || stats.upcomingMaintenanceCount > 0
    || stats.expiredLicenses > 0
    || stats.totalUsers > 0;

export const fillMissingStats = (
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

export const normalizeAssetsByStatus = (payload: unknown): AssetStatusBreakdownItem[] => {
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

export const normalizeAssetsByDepartment = (payload: unknown): AssetsByDepartment | null => {
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

export const normalizeDepreciationSummary = (payload: unknown): DepreciationSummary | null => {
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

export const normalizeMaintenanceAlerts = (payload: unknown): DashboardMaintenanceAlerts | null => {
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

export const deriveStatsFromStatusBreakdown = (items: AssetStatusBreakdownItem[]): Pick<DashboardStats, "totalAssets" | "activeAssets" | "totalAssetValue"> => ({
    totalAssets: items.reduce((sum, item) => sum + item.count, 0),
    activeAssets: items
        .filter(item => item.key === "IN_USE")
        .reduce((sum, item) => sum + item.count, 0),
    totalAssetValue: items.reduce((sum, item) => sum + item.value, 0),
});

export const deriveStatsFromAssets = (assets: Asset[]): Pick<DashboardStats, "totalAssets" | "activeAssets" | "totalAssetValue"> => ({
    totalAssets: assets.length,
    activeAssets: assets.filter(asset => String(asset.status ?? "").toUpperCase() === "IN_USE").length,
    totalAssetValue: assets.reduce((sum, asset) => sum + (asset.purchaseCost ?? asset.currentBookValue ?? 0), 0),
});

export const deriveStatsFromPurchaseOrders = (purchaseOrders: PurchaseOrder[]): Pick<DashboardStats, "openPurchaseOrders" | "pendingApprovals"> => ({
    openPurchaseOrders: purchaseOrders.filter(order => {
        const status = String(order.status ?? "").toUpperCase();
        return !["DELIVERED", "REJECTED", "CANCELLED"].includes(status);
    }).length,
    pendingApprovals: purchaseOrders.filter(order => {
        const status = String(order.status ?? "").toUpperCase();
        return status === "SUBMITTED" || status === "PENDING";
    }).length,
});

export const countExpiredLicenses = (licenses: SoftwareLicense[]): number => {
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

export const computeBudgetStats = (budgets: Budget[]): BudgetStats => {
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

export const formatDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? value
        : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const formatCompactCurrency = (amount: number, currencyCode: string) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "narrowSymbol",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(amount);
