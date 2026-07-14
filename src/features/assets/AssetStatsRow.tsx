"use client";

import { Package, PackageCheck, CheckCircle2, Wrench, TrendingDown } from "lucide-react";
import type { AssetStats } from "@/services/assetService";
import { Skeleton } from "@/components/ui/skeleton";

/** Compact KPI strip above the register. */
export function AssetStatsRow({
  stats,
  totalValueLabel,
}: {
  stats: AssetStats | undefined;
  totalValueLabel: string;
}) {
  const items = [
    { label: "Total assets", value: stats?.total, icon: Package, tone: "text-muted-fg" },
    { label: "In use", value: stats?.inUse, icon: PackageCheck, tone: "text-[var(--status-in-use)]" },
    { label: "In stock", value: stats?.inStock, icon: CheckCircle2, tone: "text-[var(--status-in-stock)]" },
    { label: "Maintenance", value: stats?.maintenance, icon: Wrench, tone: "text-[var(--status-maintenance)]" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((s) => (
        <div key={s.label} className="flex items-center gap-3 rounded-card border border-edge bg-surface p-3.5">
          <s.icon className={`h-4.5 w-4.5 shrink-0 ${s.tone}`} />
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-[0.06em] text-faint-fg">{s.label}</p>
            {s.value === undefined ? (
              <Skeleton className="mt-1 h-5 w-14" />
            ) : (
              <p className="data-mono text-lg font-bold leading-6 text-foreground">{s.value.toLocaleString()}</p>
            )}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 rounded-card border border-edge bg-surface p-3.5">
        <TrendingDown className="h-4.5 w-4.5 shrink-0 text-brand" />
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-[0.06em] text-faint-fg">Page value</p>
          <p className="data-mono truncate text-lg font-bold leading-6 text-foreground">{totalValueLabel}</p>
        </div>
      </div>
    </div>
  );
}
