"use client";

import { useMemo } from "react";
import { Pencil, Trash2, UserPlus, PackagePlus } from "lucide-react";
import type { Asset } from "@/types";
import type { PagedAssets } from "@/services/assetService";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { AssetTag } from "@/components/ui/asset-tag";
import { LifecycleTrail } from "@/components/ui/lifecycle-trail";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

/**
 * The asset register — direction A's reference surface. A compact table
 * (not cards): mono tag chips, lifecycle trails, dot statuses, money right-
 * aligned in mono, and a page money total in the footer.
 */
export function AssetRegisterTable({
  paged,
  isLoading,
  page,
  onPageChange,
  lookups,
  format,
  onView,
  onAssign,
  onEdit,
  onDelete,
  onCreate,
  canCreate,
}: {
  paged: PagedAssets | undefined;
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  lookups: {
    deptName: (id?: string) => string;
    locName: (id?: string) => string;
    userName: (id?: string) => string;
  };
  format: (amount?: number, currency?: string) => string;
  onView: (asset: Asset) => void;
  onAssign: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onCreate: () => void;
  canCreate: boolean;
}) {
  const items = paged?.items ?? [];

  const pageValue = useMemo(
    () => items.reduce((sum, a) => sum + (a.purchaseCost || 0), 0),
    [items],
  );

  const columns = useMemo<ColumnDef<Asset, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Asset",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">{row.original.name}</p>
            <p className="truncate text-xs text-faint-fg">
              {[row.original.manufacturer, row.original.model].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "assetTag",
        header: "Tag",
        cell: ({ row }) =>
          row.original.assetTag ? <AssetTag tag={row.original.assetTag} /> : <span className="text-faint-fg">—</span>,
      },
      {
        id: "lifecycle",
        header: "Lifecycle",
        enableSorting: false,
        cell: ({ row }) => <LifecycleTrail status={row.original.status ?? "IN_STOCK"} />,
      },
      {
        id: "department",
        header: "Department",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{lookups.deptName(row.original.departmentId)}</span>,
      },
      {
        id: "location",
        header: "Location",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{lookups.locName(row.original.locationId)}</span>,
      },
      {
        id: "assigned",
        header: "Assigned to",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-fg">{lookups.userName(row.original.assignedUserId)}</span>
        ),
      },
      {
        accessorKey: "purchaseCost",
        header: () => <span className="block text-right">Book value</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {format(row.original.purchaseCost, row.original.currency || "GHS")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "IN_STOCK"} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Assign asset" onClick={() => onAssign(row.original)}>
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit asset" onClick={() => onEdit(row.original)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger hover:text-danger"
              aria-label="Delete asset"
              onClick={() => onDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [lookups, format, onAssign, onEdit, onDelete],
  );

  const total = paged?.total ?? 0;
  const size = paged?.limit ?? 20;

  return (
    <DataTable
      columns={columns}
      data={items}
      isLoading={isLoading}
      onRowClick={onView}
      pageInfo={{ page, size, totalElements: total, totalPages: Math.max(1, Math.ceil(total / size)) }}
      onPageChange={(p) => onPageChange(p)}
      emptyTitle="No assets found"
      emptyDescription="Try widening your search or filters — or register your first asset."
      emptyAction={
        canCreate ? (
          <Button size="sm" onClick={onCreate}>
            <PackagePlus className="mr-1.5 h-4 w-4" />
            Add asset
          </Button>
        ) : undefined
      }
      footerSummary={
        <span>
          Page total · <span className="data-mono">{format(pageValue, "GHS")}</span>
        </span>
      }
    />
  );
}
