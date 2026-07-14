"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryClient";
import { dashboardService } from "@/services/dashboardService";
import { assetService } from "@/services/assetService";
import { userService } from "@/services/userService";
import { budgetService } from "@/services/budgetService";
import { assetTransferService } from "@/services/assetTransferService";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { licenseService } from "@/services/licenseService";
import { organisationService } from "@/services/organisationService";
import { authService } from "@/services/authService";
import {
  getOrganisationIdFromStorage,
  mergeStoredUser,
  verifyOrganisationContext,
} from "@/lib/authContext";
import type { AssetsByDepartment, DepreciationSummary, Organisation } from "@/types";
import {
  EMPTY_STATS,
  EMPTY_BUDGET_STATS,
  type AssetStatusBreakdownItem,
  type BudgetStats,
  type DashboardMaintenanceAlerts,
  type DashboardStats,
  computeBudgetStats,
  countExpiredLicenses,
  deriveStatsFromAssets,
  deriveStatsFromPurchaseOrders,
  deriveStatsFromStatusBreakdown,
  fillMissingStats,
  hasUsableSummary,
  normalizeAssetsByDepartment,
  normalizeAssetsByStatus,
  normalizeDashboardSummary,
  normalizeDepreciationSummary,
  normalizeMaintenanceAlerts,
} from "@/features/dashboard/lib";

export interface DashboardData {
  stats: DashboardStats;
  budgetStats: BudgetStats;
  myOrg: Organisation | null;
  assetStatusBreakdown: AssetStatusBreakdownItem[];
  assetsByDepartment: AssetsByDepartment | null;
  depreciationSummary: DepreciationSummary | null;
  maintenanceAlerts: DashboardMaintenanceAlerts | null;
}

/**
 * Loads the whole dashboard in one query. The backend summary endpoint is
 * authoritative when usable; every other endpoint fills gaps defensively
 * (allSettled) so one failing service degrades a tile instead of the page.
 */
async function loadDashboard(): Promise<DashboardData> {
  let resolvedOrgId = getOrganisationIdFromStorage();
  if (!resolvedOrgId) {
    try {
      const profile = await authService.getProfile();
      mergeStoredUser(profile);
      resolvedOrgId = verifyOrganisationContext(profile);
    } catch (error) {
      console.error("Failed to hydrate profile for dashboard:", error);
    }
  }
  if (!resolvedOrgId) {
    throw new Error("No verified organisation context for dashboard");
  }

  let myOrg: Organisation | null = null;
  try {
    myOrg = await organisationService.get(resolvedOrgId);
    mergeStoredUser({ organisationId: resolvedOrgId, organisationName: myOrg.name });
  } catch (error) {
    console.error("Failed to load organisation for dashboard:", error);
  }

  const summaryResult = await Promise.allSettled([dashboardService.getSummary(resolvedOrgId)]);
  const summary = summaryResult[0];
  const normalizedSummary =
    summary.status === "fulfilled" ? normalizeDashboardSummary(summary.value) : { ...EMPTY_STATS };
  const hasSummary = summary.status === "fulfilled";
  const summaryIsUsable = hasSummary && hasUsableSummary(normalizedSummary);
  let stats = { ...normalizedSummary };

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

  let assetStatusBreakdown: AssetStatusBreakdownItem[] = [];
  if (statusResult.status === "fulfilled") {
    assetStatusBreakdown = normalizeAssetsByStatus(statusResult.value);
    stats = fillMissingStats(stats, deriveStatsFromStatusBreakdown(assetStatusBreakdown), [
      "totalAssets",
      "activeAssets",
      "totalAssetValue",
    ]);
  }
  if (assetsResult.status === "fulfilled") {
    stats = fillMissingStats(stats, deriveStatsFromAssets(assetsResult.value), [
      "totalAssets",
      "activeAssets",
      "totalAssetValue",
    ]);
  }

  const assetsByDepartment =
    deptResult.status === "fulfilled" ? normalizeAssetsByDepartment(deptResult.value) : null;
  const depreciationSummary =
    depreciationResult.status === "fulfilled" ? normalizeDepreciationSummary(depreciationResult.value) : null;

  let maintenanceAlerts: DashboardMaintenanceAlerts | null = null;
  if (alertsResult.status === "fulfilled") {
    maintenanceAlerts = normalizeMaintenanceAlerts(alertsResult.value);
    if (maintenanceAlerts) {
      stats = fillMissingStats(
        stats,
        {
          overdueMaintenanceCount: maintenanceAlerts.critical,
          upcomingMaintenanceCount: maintenanceAlerts.scheduled,
        },
        ["overdueMaintenanceCount", "upcomingMaintenanceCount"],
      );
    }
  }

  if (usersResult.status === "fulfilled") {
    stats.totalUsers = usersResult.value.length;
  }

  const budgetStats =
    budgetsResult.status === "fulfilled" ? computeBudgetStats(budgetsResult.value) : { ...EMPTY_BUDGET_STATS };

  if (transfersResult.status === "fulfilled") {
    stats.pendingTransfers = transfersResult.value.filter((t) => {
      const status = String(t.status ?? "").toUpperCase();
      return status === "PENDING" || status === "REQUESTED";
    }).length;
  }
  if (purchaseOrdersResult.status === "fulfilled") {
    stats = fillMissingStats(stats, deriveStatsFromPurchaseOrders(purchaseOrdersResult.value), [
      "openPurchaseOrders",
      "pendingApprovals",
    ]);
  }
  if (licensesResult.status === "fulfilled") {
    stats = fillMissingStats(stats, { expiredLicenses: countExpiredLicenses(licensesResult.value) }, [
      "expiredLicenses",
    ]);
  }

  if (hasSummary && !summaryIsUsable) {
    console.warn("Dashboard summary fulfilled but missing expected metrics; using fallback merges.");
  }

  return { stats, budgetStats, myOrg, assetStatusBreakdown, assetsByDepartment, depreciationSummary, maintenanceAlerts };
}

export function useDashboardData() {
  return useQuery({
    queryKey: qk.dashboard.all,
    queryFn: loadDashboard,
    staleTime: 60_000,
  });
}
