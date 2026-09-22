"use client";

import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AssetStats } from "@/services/assetService";
import { AssetCondition, AssetType, type Category, type Department, type Location } from "@/types";
import type { AssetFilters } from "@/features/assets/assetFilters";

const STATUS_TABS = (stats?: AssetStats) => [
  { key: "ALL", label: "All", count: stats?.total },
  { key: "PENDING_PROCUREMENT", label: "Pending procurement", count: stats?.pendingProcurement },
  { key: "IN_USE", label: "In use", count: stats?.inUse },
  { key: "IN_STOCK", label: "In stock", count: stats?.inStock },
  { key: "MAINTENANCE", label: "Maintenance", count: stats?.maintenance },
  { key: "UNDER_REPAIR", label: "Under repair", count: stats?.underRepair },
  { key: "RESERVED", label: "Reserved", count: stats?.reserved },
  { key: "RETIRED", label: "Retired", count: stats?.retired },
  { key: "DISPOSED", label: "Disposed", count: stats?.disposed },
  { key: "MISSING", label: "Missing", count: stats?.missing },
];

export function AssetFilterBar({
  stats,
  filters,
  setParam,
  clearAdvanced,
  hasAdvancedFilters,
  departments,
  locations,
  categories,
}: {
  stats?: AssetStats;
  filters: AssetFilters;
  setParam: (key: string, value: string | null) => void;
  clearAdvanced: () => void;
  hasAdvancedFilters: boolean;
  departments: Department[];
  locations: Location[];
  categories: Category[];
}) {
  return (
    <div className="space-y-3">
      {/* Status chips — the register's primary filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Filter className="mr-1 h-4 w-4 shrink-0 text-faint-fg" />
        {STATUS_TABS(stats).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setParam("status", tab.key)}
            className={cn(
              "ea-focus flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-xs font-semibold transition-colors",
              filters.status === tab.key
                ? "border-brand bg-brand-soft text-brand"
                : "border-edge bg-surface text-muted-fg hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="data-mono text-[10px] font-bold text-faint-fg">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <div className="grid grid-cols-2 gap-3 rounded-card border border-edge bg-surface p-3 md:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Category</label>
          <Select value={filters.categoryId} onChange={(e) => setParam("categoryId", e.target.value)} className="h-8 text-xs">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Type</label>
          <Select value={filters.assetType} onChange={(e) => setParam("assetType", e.target.value)} className="h-8 text-xs">
            <option value="">All types</option>
            {Object.values(AssetType).map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Condition</label>
          <Select value={filters.condition} onChange={(e) => setParam("condition", e.target.value)} className="h-8 text-xs">
            <option value="">All conditions</option>
            {Object.values(AssetCondition).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Department</label>
          <Select value={filters.departmentId} onChange={(e) => setParam("departmentId", e.target.value)} className="h-8 text-xs">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Location</label>
          <Select value={filters.locationId} onChange={(e) => setParam("locationId", e.target.value)} className="h-8 text-xs">
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Purchased from</label>
          <Input type="date" value={filters.purchaseDateFrom} onChange={(e) => setParam("purchaseDateFrom", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Purchased to</label>
          <Input type="date" value={filters.purchaseDateTo} onChange={(e) => setParam("purchaseDateTo", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Warranty ends before</label>
          <Input type="date" value={filters.warrantyExpiryBefore} onChange={(e) => setParam("warrantyExpiryBefore", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Assignment</label>
          <Select value={filters.assigned} onChange={(e) => setParam("assigned", e.target.value)} className="h-8 text-xs">
            <option value="">All</option>
            <option value="true">Assigned</option>
            <option value="false">Unassigned</option>
          </Select>
        </div>
        <div className="flex flex-col justify-end gap-1">
          {hasAdvancedFilters && (
            <button
              type="button"
              onClick={clearAdvanced}
              className="ea-focus rounded-sm text-left text-xs text-muted-fg underline underline-offset-2 hover:text-danger"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
