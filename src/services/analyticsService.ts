import api from "@/lib/axios";
import {
    AssetAnalytics,
    DepreciationTrend,
    FinancialAnalytics,
    MaintenanceAnalytics,
    PurchaseOrderAnalytics,
} from "@/types";

export interface AnalyticsFilterParams {
    period?: "week" | "month" | "quarter" | "year";
    groupBy?: "status" | "department" | "condition";
}

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

/**
 * Unwraps common API response envelopes like { data: { ... } }, { content: { ... } },
 * { result: { ... } } so normalizers can access the actual payload fields directly.
 * If `value.data` is a non-array object it is treated as the inner payload.
 * If `value.data` is an array (items list) or absent, the outer object is returned as-is.
 */
const unwrapPayload = (value: unknown): Record<string, unknown> => {
    const outer = asRecord(value);
    if (!outer) return {};
    const inner = outer.data ?? outer.content ?? outer.result;
    if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
        return inner as Record<string, unknown>;
    }
    return outer;
};

const getOptionalNumber = (raw: Record<string, unknown>, ...keys: string[]): number | undefined => {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] != null) {
            return toNumber(raw[key]);
        }
    }
    return undefined;
};

const normalizeAssetAnalytics = (payload: unknown): AssetAnalytics => {
    const raw = unwrapPayload(payload);
    const outer = asRecord(payload) ?? {};
    const breakdown = asRecord(raw.breakdown);
    const data = Array.isArray(raw.data)
        ? raw.data
        : Array.isArray(outer.data)
            ? outer.data
            : breakdown
                ? Object.entries(breakdown).map(([name, value]) => {
                    const item = asRecord(value) ?? {};
                    return {
                        name,
                        count: toNumber(item.count),
                        value: toNumber(item.value),
                        percentage: 0,
                    };
                })
                : [];

    const normalizedData = data
        .map(item => {
            const entry = asRecord(item) ?? {};
            return {
                name: String(entry.name ?? "Unknown"),
                count: toNumber(entry.count),
                value: toNumber(entry.value),
                percentage: toNumber(entry.percentage),
            };
        })
        .filter(item => item.count > 0 || item.value > 0);

    const total = toNumber(raw.total ?? raw.totalAssets ?? outer.total ?? outer.totalAssets) || normalizedData.reduce((sum, item) => sum + item.count, 0);
    const totalValue = toNumber(raw.totalValue ?? outer.totalValue) || normalizedData.reduce((sum, item) => sum + item.value, 0);

    return {
        period: String(raw.period ?? ""),
        groupBy: String(raw.groupBy ?? ""),
        total,
        totalValue,
        data: normalizedData.map(item => ({
            ...item,
            percentage: item.percentage > 0 ? item.percentage : total ? (item.count / total) * 100 : 0,
        })),
    };
};

const normalizeFinancialAnalytics = (payload: unknown): FinancialAnalytics => {
    const raw = unwrapPayload(payload);
    const byCategory = asRecord(asRecord(raw.breakdown)?.byCategory) ?? asRecord(raw.byCategory) ?? {};

    const categoryEntries = Object.entries(byCategory).reduce<NonNullable<FinancialAnalytics["breakdown"]>["byCategory"]>((acc, [name, value]) => {
        const item = asRecord(value) ?? {};
        acc[name] = {
            count: toNumber(item.count),
            value: toNumber(item.value),
            monthlyDepreciation: toNumber(item.monthlyDepreciation ?? item.depreciation),
        };
        return acc;
    }, {});

    const totalBudget = getOptionalNumber(raw, "totalBudget");
    const totalActualSpend = getOptionalNumber(raw, "totalActualSpend");

    return {
        period: String(raw.period ?? ""),
        totalAssetValue: toNumber(raw.totalAssetValue ?? raw.totalPurchaseValue),
        totalDepreciation: toNumber(raw.totalDepreciation),
        netBookValue: toNumber(raw.netBookValue ?? raw.totalCurrentBookValue),
        totalAcquisition: getOptionalNumber(raw, "totalAcquisition"),
        totalDisposal: getOptionalNumber(raw, "totalDisposal"),
        totalMaintenance: getOptionalNumber(raw, "totalMaintenance"),
        totalBudget,
        totalActualSpend,
        budgetUtilization: getOptionalNumber(raw, "budgetUtilization") ?? (
            totalBudget && totalActualSpend != null && totalBudget > 0
                ? (totalActualSpend / totalBudget) * 100
                : undefined
        ),
        assetTurnover: getOptionalNumber(raw, "assetTurnover"),
        averageAssetAge: getOptionalNumber(raw, "averageAssetAge", "averageAssetAgeMonths"),
        depreciationMethod: typeof raw.depreciationMethod === "string" ? raw.depreciationMethod : undefined,
        assetsFullyDepreciated: getOptionalNumber(raw, "assetsFullyDepreciated"),
        monthlyDepreciation: getOptionalNumber(raw, "monthlyDepreciation"),
        breakdown: {
            byCategory: categoryEntries,
        },
    };
};

const normalizePurchaseOrderAnalytics = (payload: unknown): PurchaseOrderAnalytics => {
    const raw = unwrapPayload(payload);
    const byStatus = asRecord(raw.byStatus) ?? {};
    const topSuppliers = Array.isArray(raw.topSuppliers) ? raw.topSuppliers : [];

    return {
        period: String(raw.period ?? ""),
        totalPOs: toNumber(raw.totalPOs ?? raw.totalOrders),
        draftPOs: toNumber(raw.draftPOs ?? byStatus.DRAFT),
        approvedPOs: toNumber(raw.approvedPOs ?? byStatus.APPROVED),
        rejectedPOs: toNumber(raw.rejectedPOs ?? byStatus.REJECTED),
        totalPOValue: toNumber(raw.totalPOValue ?? raw.totalValue),
        averagePOValue: toNumber(raw.averagePOValue ?? raw.averageOrderValue),
        largestPO: getOptionalNumber(raw, "largestPO"),
        smallestPO: getOptionalNumber(raw, "smallestPO"),
        averageApprovalTime: getOptionalNumber(raw, "averageApprovalTime"),
        averageDeliveryTime: getOptionalNumber(raw, "averageDeliveryTime"),
        topSuppliers: topSuppliers.map(item => {
            const entry = asRecord(item) ?? {};
            return {
                supplier: String(entry.supplier ?? entry.name ?? "Unknown Supplier"),
                poCount: toNumber(entry.poCount ?? entry.orderCount),
                totalValue: toNumber(entry.totalValue),
            };
        }),
    };
};

const normalizeMaintenanceAnalytics = (payload: unknown): MaintenanceAnalytics => {
    const raw = unwrapPayload(payload);
    const byType = asRecord(raw.byType) ?? {};
    const totalRecords = toNumber(raw.totalRecords);
    const totalCost = toNumber(raw.totalMaintenanceCost ?? raw.totalCost);

    return {
        period: typeof raw.period === "string" ? raw.period : undefined,
        totalRecords,
        totalMaintenanceCost: totalCost,
        averageCost: toNumber(raw.averageCost) || (totalRecords > 0 ? totalCost / totalRecords : 0),
        completionRate: getOptionalNumber(raw, "completionRate"),
        overdueCount: toNumber(raw.overdueCount),
        byType: Object.entries(byType).reduce<MaintenanceAnalytics["byType"]>((acc, [type, value]) => {
            const item = asRecord(value);
            acc[type] = item
                ? {
                    count: toNumber(item.count),
                    cost: toNumber(item.cost),
                }
                : {
                    count: toNumber(value),
                    cost: 0,
                };
            return acc;
        }, {}),
    };
};

const normalizeDepreciationTrend = (payload: unknown): DepreciationTrend => {
    const raw = unwrapPayload(payload);
    const items = Array.isArray(raw.data)
        ? raw.data
        : Array.isArray(raw.trend)
            ? raw.trend
            : [];

    return {
        period: typeof raw.period === "string" ? raw.period : undefined,
        data: items.map(item => {
            const entry = asRecord(item) ?? {};
            return {
                month: String(entry.month ?? ""),
                totalDepreciation: toNumber(entry.totalDepreciation ?? entry.depreciationCharge),
                netBookValue: toNumber(entry.netBookValue ?? entry.bookValue),
                newDepreciation: toNumber(entry.newDepreciation ?? entry.depreciationCharge),
            };
        }),
    };
};

export const analyticsService = {
    getAssetAnalytics: async (params?: AnalyticsFilterParams): Promise<AssetAnalytics> => {
        const response = await api.get("/analytics/assets", { params });
        return normalizeAssetAnalytics(response.data);
    },
    getFinancialAnalytics: async (params?: { period?: AnalyticsFilterParams["period"] }): Promise<FinancialAnalytics> => {
        const response = await api.get("/analytics/financial", { params });
        return normalizeFinancialAnalytics(response.data);
    },
    getPurchaseOrderAnalytics: async (params?: { period?: AnalyticsFilterParams["period"] }): Promise<PurchaseOrderAnalytics> => {
        const response = await api.get("/analytics/purchase-orders", { params });
        return normalizePurchaseOrderAnalytics(response.data);
    },
    getMaintenanceAnalytics: async (params?: { period?: AnalyticsFilterParams["period"] }): Promise<MaintenanceAnalytics> => {
        const response = await api.get("/analytics/maintenance", { params });
        return normalizeMaintenanceAnalytics(response.data);
    },
    getDepreciationTrends: async (params?: { months?: number }): Promise<DepreciationTrend> => {
        const response = await api.get("/analytics/depreciation-trends", { params });
        return normalizeDepreciationTrend(response.data);
    },
};
