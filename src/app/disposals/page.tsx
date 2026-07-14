"use client";

import { useMemo, useState } from "react";
import { Trash, Pencil, Trash2 } from "lucide-react";
import type { DisposalRecord } from "@/types";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Button } from "@/components/ui/button";
import { AssetTag } from "@/components/ui/asset-tag";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useDisposals, useDisposalAssets, useDeleteDisposal } from "@/features/disposals/hooks";
import { DisposalFormModal } from "@/features/disposals/DisposalFormModal";

const METHOD_LABEL: Record<string, string> = {
  SALE: "Sale",
  SCRAP: "Scrap",
  DONATION: "Donation",
  RECYCLING: "Recycling",
  TRADE_IN: "Trade-in",
  RETURN: "Return",
};

export default function DisposalsPage() {
  const { format } = useCurrency();
  const { data: disposals = [], isLoading } = useDisposals();
  const assets = useDisposalAssets();
  const remove = useDeleteDisposal();
  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDisposal, setEditingDisposal] = useState<DisposalRecord | null>(null);

  const lookups = useMemo(() => {
    const byId = new Map(assets.map((a) => [a.id, a]));
    return {
      assetName: (id?: string) => byId.get(id ?? "")?.name ?? "Unknown asset",
      assetTag: (id?: string) => byId.get(id ?? "")?.assetTag,
    };
  }, [assets]);

  const openCreate = () => {
    setEditingDisposal(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (record: DisposalRecord) => {
    if (
      !(await confirm({
        message: "Delete this disposal record? The asset's state will need reverting manually.",
        variant: "danger",
      }))
    )
      return;
    remove.mutate(record.id!);
  };

  const columns = useMemo<ColumnDef<DisposalRecord, unknown>[]>(
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
        accessorKey: "disposalMethod",
        header: "Method",
        cell: ({ row }) => (
          <span className="text-muted-fg">{METHOD_LABEL[row.original.disposalMethod ?? ""] ?? row.original.disposalMethod ?? "—"}</span>
        ),
      },
      {
        accessorKey: "disposalDate",
        header: "Disposed",
        cell: ({ row }) => (
          <span className="text-muted-fg">
            {row.original.disposalDate ? new Date(row.original.disposalDate).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        id: "reason",
        header: "Reason",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-64 truncate text-muted-fg" title={row.original.reason}>
            {row.original.reason || "—"}
          </span>
        ),
      },
      {
        accessorKey: "saleValue",
        header: () => <span className="block text-right">Recovered</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {row.original.saleValue ? format(row.original.saleValue, "GHS") : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit disposal"
              onClick={() => {
                setEditingDisposal(row.original);
                setIsModalOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Delete disposal"
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

  const recovered = useMemo(
    () => disposals.reduce((sum, d) => sum + (d.saleValue || 0), 0),
    [disposals],
  );

  return (
    <ListPageTemplate
      title="Disposals"
      subtitle={isLoading ? "Loading records…" : `${disposals.length} disposals recorded`}
      actions={
        <Button variant="destructive" onClick={openCreate}>
          <Trash className="mr-2 h-4 w-4" /> Decommission asset
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={disposals}
        isLoading={isLoading}
        emptyTitle="No disposals yet"
        emptyDescription="Assets you decommission are recorded here with method, reason, and recovered value."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Trash className="mr-1.5 h-4 w-4" /> Record disposal
          </Button>
        }
        footerSummary={
          <span>
            Total recovered · <span className="data-mono">{format(recovered, "GHS")}</span>
          </span>
        }
      />

      <DisposalFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingDisposal={editingDisposal}
        assets={assets}
      />
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
