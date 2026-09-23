"use client";

import { ExternalLink as SafeExternalLink } from "@/components/ui/external-link";
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
import { useDisposals, useDeleteDisposal, useDisposalDecision } from "@/features/disposals/hooks";
import {
  disposalActionsFor, disposalQueryParams, disposalStatusOf, DISPOSAL_STATUS_FILTERS, EMPTY_DISPOSAL_FILTERS,
  isDocumentLink, type DisposalFilters,
} from "@/features/disposals/workflow";
import { RejectDisposalModal } from "@/features/disposals/RejectDisposalModal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/contexts/AuthContext";
import { DisposalFormModal } from "@/features/disposals/DisposalFormModal";
import { formatLocalDate } from "@/lib/local-date";

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
  const [filters, setFilters] = useState<DisposalFilters>(EMPTY_DISPOSAL_FILTERS);
  const { data: disposals = [], isLoading, error, refetch, isFetching } = useDisposals(disposalQueryParams(filters));
  const [rejecting, setRejecting] = useState<DisposalRecord | null>(null);
  const remove = useDeleteDisposal();
  const decide = useDisposalDecision();
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDisposal, setEditingDisposal] = useState<DisposalRecord | null>(null);


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
        message: `Approve disposing "${record.assetName ?? "this asset"}"? The asset will be marked disposed and its value locked.`,
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
          const tag = row.original.assetTag;
          return (
            <div className="flex min-w-0 max-w-56 flex-col gap-1">
              <span className="truncate font-semibold text-foreground">{row.original.assetName ?? "Unknown asset"}</span>
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
            {formatLocalDate(row.original.disposalDate)}
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
            {row.original.saleValue != null ? format(row.original.saleValue, row.original.currency || baseCurrency) : "—"}
          </span>
        ),
      },
      {
        id: "document",
        header: "Document",
        enableSorting: false,
        cell: ({ row }) => {
          const doc = row.original.complianceDocumentUrl;
          if (!doc) return <span className="text-faint-fg">—</span>;
          return isDocumentLink(doc) ? (
            <SafeExternalLink
              href={doc}
              className="ea-focus block max-w-40 truncate rounded-sm text-xs font-semibold text-brand hover:underline"
              title={doc}
            >
              Open document
            </SafeExternalLink>
          ) : (
            <span className="block max-w-40 truncate text-xs text-muted-fg" title={doc}>{doc}</span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={disposalStatusOf(row.original)} />,
      },
      {
        id: "trail",
        header: "Approval trail",
        enableSorting: false,
        cell: ({ row }) => {
          const d = row.original;
          const when = (at?: string) => (at ? new Date(at).toLocaleDateString() : "");
          return (
            <div className="max-w-56 space-y-0.5 text-xs text-muted-fg">
              {d.requestedByName ? <p className="truncate">Requested by {d.requestedByName}</p> : null}
              {d.approvedByName ? (
                <p className="truncate">Approved by {d.approvedByName} {when(d.approvedAt)}</p>
              ) : null}
              {d.rejectedByName ? (
                <p className="truncate" title={d.rejectionReason ?? undefined}>
                  Rejected by {d.rejectedByName} {when(d.rejectedAt)}
                  {d.rejectionReason ? `: ${d.rejectionReason}` : ""}
                </p>
              ) : null}
              {!d.requestedByName && !d.approvedByName && !d.rejectedByName ? <p>—</p> : null}
            </div>
          );
        },
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
                  onClick={() => setRejecting(row.original)}
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
    [format, baseCurrency, user?.id],
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="dp-filter-status" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Status</label>
          <Select
            id="dp-filter-status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as DisposalFilters["status"] })}
            className="h-8 w-44 text-xs"
          >
            {DISPOSAL_STATUS_FILTERS.map((f) => (
              <option key={f.value || "all"} value={f.value}>{f.label}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dp-filter-from" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Disposed from</label>
          <Input id="dp-filter-from" type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="h-8 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dp-filter-to" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Disposed to</label>
          <Input id="dp-filter-to" type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="h-8 text-xs" />
        </div>
        {filters.status || filters.startDate || filters.endDate ? (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_DISPOSAL_FILTERS)}
            className="ea-focus mb-1.5 rounded-sm text-xs text-muted-fg underline underline-offset-2 hover:text-danger"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={disposals}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        isRetrying={isFetching}
        errorWhat="your disposal records"
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
      />
      <RejectDisposalModal
        record={rejecting}
        withdrawing={!!rejecting && !!user?.id && rejecting.requestedById === user.id}
        onClose={() => setRejecting(null)}
      />
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
