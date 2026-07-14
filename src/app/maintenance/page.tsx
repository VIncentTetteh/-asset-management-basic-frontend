"use client";

import { useMemo, useState } from "react";
import { Wrench, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import type { MaintenanceRecord } from "@/types";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { AssetTag } from "@/components/ui/asset-tag";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  useMaintenanceRecords,
  useMaintenanceMasterData,
  useCompleteMaintenance,
  useDeleteMaintenance,
} from "@/features/maintenance/hooks";
import { MaintenanceFormModal } from "@/features/maintenance/MaintenanceFormModal";

export default function MaintenancePage() {
  const { format } = useCurrency();
  const { data: records = [], isLoading } = useMaintenanceRecords();
  const master = useMaintenanceMasterData();
  const complete = useCompleteMaintenance();
  const remove = useDeleteMaintenance();
  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

  const lookups = useMemo(() => {
    const byId = new Map(master.assets.map((a) => [a.id, a]));
    return {
      assetName: (id?: string) => byId.get(id ?? "")?.name ?? "Unknown asset",
      assetTag: (id?: string) => byId.get(id ?? "")?.assetTag,
    };
  }, [master.assets]);

  const openCreate = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (record: MaintenanceRecord) => {
    if (!(await confirm({ message: "Delete this maintenance log?", variant: "danger" }))) return;
    remove.mutate(record.id!);
  };

  const columns = useMemo<ColumnDef<MaintenanceRecord, unknown>[]>(
    () => [
      {
        id: "asset",
        header: "Asset",
        enableSorting: false,
        cell: ({ row }) => {
          const tag = lookups.assetTag(row.original.assetId);
          return (
            <div className="flex min-w-0 max-w-56 flex-col gap-1">
              <span className="truncate font-semibold text-foreground">{lookups.assetName(row.original.assetId)}</span>
              {tag ? <AssetTag tag={tag} /> : null}
            </div>
          );
        },
      },
      {
        accessorKey: "maintenanceType",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-muted-fg">{String(row.original.maintenanceType ?? "").replace("_", " ")}</span>
        ),
      },
      {
        id: "description",
        header: "Task",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-64 truncate text-muted-fg" title={row.original.description}>
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        accessorKey: "scheduledDate",
        header: "Scheduled",
        cell: ({ row }) => (
          <span className="text-muted-fg">
            {row.original.scheduledDate ? new Date(row.original.scheduledDate).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        accessorKey: "cost",
        header: () => <span className="block text-right">Cost</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">{format(row.original.cost, row.original.currency || "GHS")}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "SCHEDULED"} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            {row.original.status !== "COMPLETED" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-brand"
                onClick={() => complete.mutate(row.original.id!)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark done
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit maintenance"
              onClick={() => {
                setEditingRecord(row.original);
                setIsModalOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Delete maintenance"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookups, format],
  );

  const openCount = records.filter((r) => r.status !== "COMPLETED" && r.status !== "CANCELLED").length;

  return (
    <ListPageTemplate
      title="Maintenance"
      subtitle={isLoading ? "Loading records…" : `${records.length} records · ${openCount} open`}
      actions={
        <Button onClick={openCreate}>
          <Wrench className="mr-2 h-4 w-4" /> Log maintenance
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={records}
        isLoading={isLoading}
        emptyTitle="No maintenance records"
        emptyDescription="Schedule preventive maintenance or log repair work for your assets."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Wrench className="mr-1.5 h-4 w-4" /> Log maintenance
          </Button>
        }
      />

      <MaintenanceFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingRecord={editingRecord}
        assets={master.assets}
        suppliers={master.suppliers}
      />
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
