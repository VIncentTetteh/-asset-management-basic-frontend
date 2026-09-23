"use client";

import { useMemo } from "react";
import { ArrowRight, ThumbsUp, XCircle, CheckCircle2, Trash2, ArrowRightLeft } from "lucide-react";
import type { AssetTransfer } from "@/types";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { StatusBadge } from "@/components/ui/status-badge";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";
import { transferActionsFor, type TransferAction } from "@/features/transfers/workflow";
import { formatLocalDate } from "@/lib/local-date";

export interface TransferLookups {
  assetName: (id?: string) => string;
  assetTag: (id?: string) => string | undefined;
  deptName: (id?: string) => string;
  locName: (id?: string) => string;
}

function Movement({ dept, loc }: { dept: string; loc: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] text-foreground">{dept}</p>
      <p className="truncate text-xs text-faint-fg">{loc}</p>
    </div>
  );
}

export function TransferTable({
  transfers,
  isLoading,
  error,
  onRetry,
  isRetrying,
  lookups,
  onAction,
  onCreate,
  currentUserId,
  canManage,
}: {
  transfers: AssetTransfer[];
  isLoading: boolean;
  /** The transfer query's failure, if it failed. */
  error?: unknown;
  onRetry?: () => void | Promise<unknown>;
  isRetrying?: boolean;
  lookups: TransferLookups;
  onAction: (transfer: AssetTransfer, action: TransferAction) => void;
  onCreate: () => void;
  /** Hides Approve on the viewer's own requests. */
  currentUserId?: string;
  /** Holds TRANSFER_ASSET: approve, reject, complete and delete. */
  canManage: boolean;
}) {
  const columns = useMemo<ColumnDef<AssetTransfer, unknown>[]>(
    () => [
      {
        id: "asset",
        header: "Asset",
        enableSorting: false,
        cell: ({ row }) => {
          const tag = lookups.assetTag(row.original.assetId);
          return (
            <div className="flex min-w-0 max-w-56 flex-col gap-1">
              <span className="truncate font-semibold text-foreground">
                {lookups.assetName(row.original.assetId)}
              </span>
              {tag ? <AssetTag tag={tag} /> : null}
            </div>
          );
        },
      },
      {
        id: "from",
        header: "From",
        enableSorting: false,
        cell: ({ row }) => (
          <Movement
            dept={lookups.deptName(row.original.fromDepartmentId)}
            loc={lookups.locName(row.original.fromLocationId)}
          />
        ),
      },
      {
        id: "arrow",
        header: "",
        enableSorting: false,
        cell: () => <ArrowRight className="h-3.5 w-3.5 text-faint-fg" />,
      },
      {
        id: "to",
        header: "To",
        enableSorting: false,
        cell: ({ row }) => (
          <Movement
            dept={lookups.deptName(row.original.toDepartmentId)}
            loc={lookups.locName(row.original.toLocationId)}
          />
        ),
      },
      {
        id: "reason",
        header: "Reason",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.reason ? (
            <span className="block max-w-56 truncate text-xs text-muted-fg" title={row.original.reason}>
              {row.original.reason}
            </span>
          ) : (
            <span className="text-faint-fg">—</span>
          ),
      },
      {
        accessorKey: "createdAt",
        header: "Requested",
        cell: ({ row }) => (
          <span className="text-muted-fg">
            {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : "—"}
            {row.original.requestedByName ? (
              <span className="block text-xs text-faint-fg">by {row.original.requestedByName}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: "approvedBy",
        header: "Approved by",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{row.original.approvedByName || "—"}</span>,
      },
      {
        accessorKey: "transferDate",
        header: "Completed",
        cell: ({ row }) => (
          <span className="text-muted-fg">
            {formatLocalDate(row.original.transferDate)}
            {row.original.completedByName ? (
              <span className="block text-xs text-faint-fg">by {row.original.completedByName}</span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "REQUESTED"} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const t = row.original;
          const actions = transferActionsFor(t, currentUserId, canManage);
          return (
            <div className="flex justify-end gap-0.5">
              {actions.includes("approve") && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-ok" title="Approve" aria-label="Approve transfer" onClick={() => onAction(t, "approve")}>
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
              )}
              {actions.includes("complete") && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-brand" title="Complete transfer" aria-label="Complete transfer" onClick={() => onAction(t, "complete")}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {actions.includes("reject") && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-warn" title="Reject" aria-label="Reject transfer" onClick={() => onAction(t, "reject")}>
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              {actions.includes("delete") && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" title="Delete" aria-label="Delete transfer" onClick={() => onAction(t, "delete")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [lookups, onAction, currentUserId, canManage],
  );

  return (
    <DataTable
      columns={columns}
      data={transfers}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isRetrying={isRetrying}
      errorWhat="your transfers"
      emptyTitle="No transfers yet"
      emptyDescription="Move assets between departments or locations with an approval trail."
      emptyAction={
        <Button size="sm" onClick={onCreate}>
          <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Request transfer
        </Button>
      }
    />
  );
}
