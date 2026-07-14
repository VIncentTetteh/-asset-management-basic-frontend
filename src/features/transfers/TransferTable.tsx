"use client";

import { useMemo } from "react";
import { ArrowRight, ThumbsUp, XCircle, CheckCircle2, Trash2, ArrowRightLeft } from "lucide-react";
import type { AssetTransfer } from "@/types";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { StatusBadge } from "@/components/ui/status-badge";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";

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
  lookups,
  onAction,
  onCreate,
}: {
  transfers: AssetTransfer[];
  isLoading: boolean;
  lookups: TransferLookups;
  onAction: (transfer: AssetTransfer, action: "approve" | "reject" | "complete" | "delete") => void;
  onCreate: () => void;
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
        accessorKey: "createdAt",
        header: "Requested",
        cell: ({ row }) => (
          <span className="text-muted-fg">
            {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : "—"}
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
          return (
            <div className="flex justify-end gap-0.5">
              {t.status === "REQUESTED" && (
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-ok" title="Approve" aria-label="Approve transfer" onClick={() => onAction(t, "approve")}>
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-warn" title="Reject" aria-label="Reject transfer" onClick={() => onAction(t, "reject")}>
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              {t.status === "APPROVED" && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-brand" title="Complete transfer" aria-label="Complete transfer" onClick={() => onAction(t, "complete")}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" title="Delete" aria-label="Delete transfer" onClick={() => onAction(t, "delete")}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [lookups, onAction],
  );

  return (
    <DataTable
      columns={columns}
      data={transfers}
      isLoading={isLoading}
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
