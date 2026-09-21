"use client";

import { useMemo, useState } from "react";
import { Trash, Pencil, Trash2, ThumbsUp, XCircle } from "lucide-react";
import type { DisposalRecord } from "@/types";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Button } from "@/components/ui/button";
import { AssetTag } from "@/components/ui/asset-tag";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { MissingRatesNotice } from "@/components/currency/MissingRatesNotice";
import { MoneyTotalValue } from "@/components/currency/MoneyTotalValue";
import { useDisposals, useDisposalAssets, useDeleteDisposal, useDisposalDecision } from "@/features/disposals/hooks";
import { disposalActionsFor, disposalStatusOf } from "@/features/disposals/workflow";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/contexts/AuthContext";
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
  const { format, baseCurrency, sum } = useCurrency();
  const { data: disposals = [], isLoading } = useDisposals();
  const assets = useDisposalAssets();
  const remove = useDeleteDisposal();
  const decide = useDisposalDecision();
  const { user } = useAuth();
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
        message: "Delete this disposal request? The asset is not affected.",
        variant: "danger",
      }))
    )
      return;
    remove.mutate(record.id!);
  };

  const handleApprove = async (record: DisposalRecord) => {
    if (
      !(await confirm({
        message: `Approve disposing "${lookups.assetName(record.assetId)}"? The asset will be marked disposed and its value locked.`,
        variant: "danger",
      }))
    )
      return;
    decide.mutate({ id: record.id!, decision: "approve" });
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
            {row.original.saleValue ? format(row.original.saleValue, row.original.currency || baseCurrency) : "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={disposalStatusOf(row.original)} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const actions = disposalActionsFor(row.original, user?.id);
          return (
            <div className="flex justify-end gap-0.5">
              {actions.includes("approve") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-ok"
                  title="Approve and dispose"
                  aria-label="Approve disposal"
                  onClick={() => handleApprove(row.original)}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
              )}
              {actions.includes("reject") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-warn"
                  title="Reject"
                  aria-label="Reject disposal"
                  onClick={() => decide.mutate({ id: row.original.id!, decision: "reject" })}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              {actions.includes("edit") && (
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
              )}
              {actions.includes("delete") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-danger"
                  aria-label="Delete disposal"
                  onClick={() => handleDelete(row.original)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookups, format, baseCurrency, user?.id],
  );

  // Sale values are recorded in the disposal's currency (base currency when unset).
  // Only approved disposals have recovered anything.
  const recovered = useMemo(
    () =>
      sum(
        disposals
          .filter((d) => disposalStatusOf(d) === "APPROVED")
          .map((d) => ({ amount: d.saleValue, currency: d.currency })),
      ),
    [disposals, sum],
  );
  const pendingCount = disposals.filter((d) => disposalStatusOf(d) === "PENDING_APPROVAL").length;

  return (
    <ListPageTemplate
      title="Disposals"
      subtitle={isLoading ? "Loading records…" : `${disposals.length} disposals · ${pendingCount} awaiting approval`}
      actions={
        <Button variant="destructive" onClick={openCreate}>
          <Trash className="mr-2 h-4 w-4" /> Request disposal
        </Button>
      }
    >
      <MissingRatesNotice incomplete={!recovered.complete} missingRates={recovered.missingRates} />

      <DataTable
        columns={columns}
        data={disposals}
        isLoading={isLoading}
        emptyTitle="No disposals yet"
        emptyDescription="Disposal requests and approvals are recorded here with method, reason, and recovered value."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Trash className="mr-1.5 h-4 w-4" /> Request disposal
          </Button>
        }
        footerSummary={
          <span>
            Total recovered · <MoneyTotalValue total={recovered} />
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
