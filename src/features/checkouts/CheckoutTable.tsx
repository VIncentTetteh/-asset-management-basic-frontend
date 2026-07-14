"use client";

import { useMemo } from "react";
import { PackageMinus } from "lucide-react";
import type { CheckoutRecordDto } from "@/services/checkoutService";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export const isOverdue = (record: CheckoutRecordDto) =>
  record.status === "ACTIVE" &&
  !!record.expectedReturnDate &&
  new Date(record.expectedReturnDate) < new Date();

export function CheckoutTable({
  records,
  isLoading,
  onCheckIn,
}: {
  records: CheckoutRecordDto[];
  isLoading: boolean;
  onCheckIn: (record: CheckoutRecordDto) => void;
}) {
  const columns = useMemo<ColumnDef<CheckoutRecordDto, unknown>[]>(
    () => [
      {
        accessorKey: "assetName",
        header: "Asset",
        cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.assetName || "Unknown"}</span>,
      },
      {
        id: "holder",
        header: "Issued to",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-fg">
            {row.original.employeeName || row.original.checkedOutByName || "—"}
          </span>
        ),
      },
      {
        accessorKey: "checkedOutAt",
        header: "Checked out",
        cell: ({ row }) => <span className="text-muted-fg">{fmt(row.original.checkedOutAt)}</span>,
      },
      {
        accessorKey: "expectedReturnDate",
        header: "Expected return",
        cell: ({ row }) =>
          row.original.expectedReturnDate ? (
            <span className={isOverdue(row.original) ? "font-semibold text-danger" : "text-muted-fg"}>
              {fmt(row.original.expectedReturnDate)}
            </span>
          ) : (
            <span className="text-faint-fg">—</span>
          ),
      },
      {
        accessorKey: "actualReturnDate",
        header: "Returned",
        cell: ({ row }) => <span className="text-muted-fg">{fmt(row.original.actualReturnDate)}</span>,
      },
      {
        id: "condition",
        header: "Condition",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-fg">
            {row.original.conditionOnReturn || row.original.conditionOnCheckout || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          isOverdue(row.original) ? (
            <StatusBadge status="OVERDUE" />
          ) : (
            <StatusBadge status={row.original.status ?? "ACTIVE"} />
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === "ACTIVE" ? (
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onCheckIn(row.original)}>
              <PackageMinus className="h-3.5 w-3.5" /> Check in
            </Button>
          ) : null,
      },
    ],
    [onCheckIn],
  );

  return (
    <DataTable
      columns={columns}
      data={records}
      isLoading={isLoading}
      emptyTitle="No checkout records"
      emptyDescription="When assets are issued to people, the custody trail shows up here."
    />
  );
}
