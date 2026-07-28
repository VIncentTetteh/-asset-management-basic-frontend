"use client";

import Link from "next/link";
import {
  Hexagon, Wrench, Wallet, ShoppingCart, ArrowRightLeft, KeySquare,
  AlertTriangle, ChevronRight, TrendingDown, Landmark,
} from "lucide-react";
import { toneForStatus } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/patterns/EmptyState";
import { QUICK_LINKS, type AssetStatusBreakdownItem, type BudgetStats, type DashboardMaintenanceAlerts, type DashboardStats } from "@/features/dashboard/lib";
import type { AssetsByDepartment, DepreciationSummary } from "@/types";

const TONE_VAR: Record<string, string> = {
  "in-use": "var(--status-in-use)",
  "in-stock": "var(--status-in-stock)",
  reserved: "var(--status-reserved)",
  maintenance: "var(--status-maintenance)",
  flagged: "var(--status-flagged)",
  disposed: "var(--status-disposed)",
  retired: "var(--status-retired)",
};

const statusVar = (key: string) => TONE_VAR[toneForStatus(key)] ?? "var(--status-retired)";

// ── KPI row ───────────────────────────────────────────────────────────────────

export function KpiRow({
  stats,
  budgetStats,
  format,
}: {
  stats: DashboardStats;
  budgetStats: BudgetStats;
  format: (amount?: number, currency?: string) => string;
}) {
  const utilization = stats.totalAssets ? Math.round((stats.activeAssets / stats.totalAssets) * 100) : 0;
  const maintenanceLoad = stats.overdueMaintenanceCount + stats.upcomingMaintenanceCount;
  const budgetPct = Math.min(Math.round(budgetStats.utilizationPct), 999);
  const budgetBar =
    budgetStats.utilizationPct >= 100 ? "var(--danger)" : budgetStats.utilizationPct >= 80 ? "var(--warning)" : "var(--primary)";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Link href="/assets" className="ea-focus block rounded-card">
        <Card className="card-lift h-full">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Asset estate</p>
              <Hexagon className="h-4 w-4 text-brand" />
            </div>
            <p className="data-mono mt-1 text-2xl font-bold text-foreground">{stats.totalAssets.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-muted-fg">
              {stats.activeAssets.toLocaleString()} active · {utilization}% utilisation
            </p>
          </CardContent>
        </Card>
      </Link>

      <Card className="h-full">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Portfolio value</p>
            <Landmark className="h-4 w-4 text-brand" />
          </div>
          <p className="data-mono mt-1 truncate text-2xl font-bold text-foreground">
            {format(stats.totalAssetValue, "GHS")}
          </p>
          <p className="mt-0.5 text-xs text-muted-fg">{stats.totalUsers.toLocaleString()} users in workspace</p>
        </CardContent>
      </Card>

      <Link href="/maintenance" className="ea-focus block rounded-card">
        <Card className="card-lift h-full">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Maintenance load</p>
              <Wrench className="h-4 w-4" style={{ color: "var(--status-maintenance)" }} />
            </div>
            <p className="data-mono mt-1 text-2xl font-bold text-foreground">{maintenanceLoad}</p>
            <p className="mt-0.5 text-xs text-muted-fg">
              <span className={stats.overdueMaintenanceCount > 0 ? "font-semibold text-danger" : ""}>
                {stats.overdueMaintenanceCount} overdue
              </span>{" "}
              · {stats.upcomingMaintenanceCount} upcoming
            </p>
          </CardContent>
        </Card>
      </Link>

      <Link href="/budgets" className="ea-focus block rounded-card">
        <Card className="card-lift h-full">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Budget health</p>
              <Wallet className="h-4 w-4 text-brand" />
            </div>
            <p className="data-mono mt-1 text-2xl font-bold text-foreground">{budgetPct}%</p>
            <div className="progress-bar mt-2">
              <div className="progress-bar-fill" style={{ width: `${Math.min(budgetPct, 100)}%`, background: budgetBar }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-fg">
              <span className="data-mono">{format(budgetStats.totalSpentAmount, "GHS")}</span> of{" "}
              <span className="data-mono">{format(budgetStats.totalBudgetAmount, "GHS")}</span>
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

// ── Asset health ─────────────────────────────────────────────────────────────

export function AssetHealthCard({ breakdown }: { breakdown: AssetStatusBreakdownItem[] }) {
  const total = breakdown.reduce((s, i) => s + i.count, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Asset health</CardTitle>
      </CardHeader>
      <CardContent>
        {breakdown.length === 0 ? (
          <EmptyState title="No status data yet" description="Register assets to see the estate's health here." />
        ) : (
          <div className="space-y-3">
            {/* Composite bar */}
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken">
              {breakdown.map((item) => (
                <div
                  key={item.key}
                  title={`${item.label}: ${item.count}`}
                  style={{ width: `${total ? (item.count / total) * 100 : 0}%`, background: statusVar(item.key) }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {breakdown.map((item) => (
                <div key={item.key} className="flex items-center gap-2 text-[13px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusVar(item.key) }} />
                  <span className="truncate text-muted-fg">{item.label}</span>
                  <span className="data-mono ml-auto font-semibold text-foreground">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Action required ──────────────────────────────────────────────────────────

export function ActionRequiredCard({ stats }: { stats: DashboardStats }) {
  const actions = [
    { href: "/purchase-orders", label: "Open purchase orders", count: stats.openPurchaseOrders, icon: ShoppingCart },
    { href: "/transfers", label: "Transfers awaiting approval", count: stats.pendingTransfers, icon: ArrowRightLeft },
    { href: "/maintenance", label: "Overdue maintenance", count: stats.overdueMaintenanceCount, icon: Wrench, danger: stats.overdueMaintenanceCount > 0 },
    { href: "/licenses", label: "Expired software licenses", count: stats.expiredLicenses, icon: KeySquare, danger: stats.expiredLicenses > 0 },
  ];
  const open = actions.filter((a) => a.count > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Action required</CardTitle>
      </CardHeader>
      <CardContent>
        {open.length === 0 ? (
          <EmptyState title="All clear" description="Nothing is waiting on you right now." />
        ) : (
          <div className="divide-y divide-edge-subtle">
            {open.map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                className="ea-focus group flex items-center gap-3 rounded-sm py-2.5 first:pt-0 last:pb-0"
              >
                <a.icon className={`h-4 w-4 shrink-0 ${a.danger ? "text-danger" : "text-muted-fg"}`} />
                <span className="text-[13px] text-foreground">{a.label}</span>
                <span
                  className={`data-mono ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${
                    a.danger ? "bg-danger-soft text-danger" : "bg-surface-sunken text-muted-fg"
                  }`}
                >
                  {a.count}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-faint-fg transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Departments ──────────────────────────────────────────────────────────────

export function DepartmentsCard({
  assetsByDepartment,
  format,
}: {
  assetsByDepartment: AssetsByDepartment | null;
  format: (amount?: number, currency?: string) => string;
}) {
  const rows = assetsByDepartment?.data?.slice(0, 6) ?? [];
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Assets by department</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState title="No department data" description="Assign assets to departments to see the spread." />
        ) : (
          <div className="space-y-2.5">
            {rows.map((d, i) => (
              <div key={d.departmentId || d.departmentName || `dept-${i}`} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-foreground">{d.departmentName}</span>
                  <span className="data-mono shrink-0 text-xs text-muted-fg">
                    {d.count} · {format(d.value, "GHS")}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${(d.count / max) * 100}%`, opacity: 0.85 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Depreciation ─────────────────────────────────────────────────────────────

export function DepreciationCard({
  summary,
  format,
}: {
  summary: DepreciationSummary | null;
  format: (amount?: number, currency?: string) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Depreciation</CardTitle>
      </CardHeader>
      <CardContent>
        {!summary ? (
          <EmptyState title="No depreciation data" description="Set depreciation policies on assets to track book value." />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Net book value</p>
              <p className="data-mono mt-0.5 text-lg font-bold text-foreground">{format(summary.netBookValue, "GHS")}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Total depreciation</p>
              <p className="data-mono mt-0.5 flex items-center gap-1 text-lg font-bold text-foreground">
                <TrendingDown className="h-4 w-4 text-danger" />
                {format(summary.totalDepreciation, "GHS")}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Monthly charge</p>
              <p className="data-mono mt-0.5 text-lg font-bold text-foreground">{format(summary.monthlyDepreciation, "GHS")}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Fully depreciated</p>
              <p className="data-mono mt-0.5 text-lg font-bold text-foreground">{summary.assetsFullyDepreciated}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Maintenance alerts ───────────────────────────────────────────────────────

export function MaintenanceAlertsCard({ alerts }: { alerts: DashboardMaintenanceAlerts | null }) {
  const preview = alerts?.alerts?.slice(0, 3) ?? [];
  if (preview.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>Maintenance alerts</CardTitle>
        <Link href="/maintenance" className="ea-focus rounded-sm text-xs font-semibold text-brand hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-edge-subtle">
          {preview.map((a, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <AlertTriangle
                className="h-4 w-4 shrink-0"
                style={{ color: a.severity === "CRITICAL" ? "var(--danger)" : "var(--warning)" }}
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground">{a.assetName}</p>
                <p className="text-xs text-muted-fg">
                  {a.daysOverdue
                    ? `${a.daysOverdue} day${a.daysOverdue === 1 ? "" : "s"} overdue`
                    : a.nextDueDate
                      ? `Due ${new Date(a.nextDueDate).toLocaleDateString()}`
                      : a.severity}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Quick navigation ─────────────────────────────────────────────────────────

export function QuickNav() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Quick navigation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="ea-focus flex items-center gap-2.5 rounded-control border border-edge bg-surface px-3 py-2.5 text-[13px] font-medium text-muted-fg transition-colors hover:border-brand hover:text-brand"
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {link.label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
