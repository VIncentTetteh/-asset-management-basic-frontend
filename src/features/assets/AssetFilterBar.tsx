"use client";

import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AssetStats } from "@/services/assetService";
import type { Department, Location } from "@/types";

const STATUS_TABS = (stats?: AssetStats) => [
  { key: "ALL", label: "All", count: stats?.total },
  { key: "IN_USE", label: "In use", count: stats?.inUse },
  { key: "IN_STOCK", label: "In stock", count: stats?.inStock },
  { key: "MAINTENANCE", label: "Maintenance", count: stats?.maintenance },
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
}: {
  stats?: AssetStats;
  filters: {
    status: string;
    departmentId: string;
    locationId: string;
    purchaseDateFrom: string;
    purchaseDateTo: string;
    assigned: string;
  };
  setParam: (key: string, value: string | null) => void;
  clearAdvanced: () => void;
  hasAdvancedFilters: boolean;
  departments: Department[];
  locations: Location[];
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
      <div className="grid grid-cols-2 gap-3 rounded-card border border-edge bg-surface p-3 md:grid-cols-3 lg:grid-cols-6">
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
