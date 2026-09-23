"use client";

import { ExternalLink as SafeExternalLink } from "@/components/ui/external-link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FileSignature, RefreshCw, AlertTriangle } from "lucide-react";
import type { Contract, ContractDto } from "@/types";
import { contractService } from "@/services/contractService";
import { supplierService } from "@/services/supplierService";
import { assetService } from "@/services/assetService";
import { qk } from "@/lib/queryClient";
import { makeCrudHooks } from "@/features/shared/crudHooks";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import { formPickersReady } from "@/lib/form-pickers";
import { PageSpinner } from "@/components/ui/spinner";
import { buildContractPayload, type ContractForm } from "@/features/finance/payloads";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";
import { MissingRatesNotice } from "@/components/currency/MissingRatesNotice";
import { MoneyTotalValue } from "@/components/currency/MoneyTotalValue";
import { formatLocalDate } from "@/lib/local-date";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { AttachmentField, attachAfterCreate, useAttachmentField } from "@/components/ui/attachment-field";
import { ImportButton } from "@/features/imports/ImportButton";

const CONTRACT_TYPES = ["PURCHASE", "LEASE", "MAINTENANCE", "SERVICE_LEVEL_AGREEMENT", "WARRANTY", "INSURANCE", "OTHER"];
const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED", "RENEWED"];

// Edits are a full-replace PUT so an unlinked supplier/asset or emptied field is saved
// (PATCH skips nulls). Fields the form does not show are all in the payload builder.
const contracts = makeCrudHooks<Contract, ContractDto>(
  "contracts",
  { ...contractService, update: (id, data) => contractService.replace(id, data as ContractDto) },
  {
    entity: "Contract",
    fields: {
      notes: "Key terms", startDate: "Start date", endDate: "End date", contractNumber: "Contract number",
      alertDaysBefore: "Alert days", documentUrl: "Document URL", assetId: "Linked asset", supplierId: "Supplier",
    },
  },
);
const L = FIELD_LIMITS.contract;

export default function ContractsPage() {
  const { format, baseCurrency, sum } = useCurrency();
  const [view, setView] = useState<"all" | "expiring">("all");
  const { data: allRows = [], isLoading: allLoading } = contracts.useList();
  const { data: expiringRows = [], isLoading: expiringLoading } = useQuery({
    queryKey: [...contracts.key.all, "expiring"],
    queryFn: () => contractService.getExpiringSoon(),
    enabled: view === "expiring",
  });
  const rows = view === "expiring" ? expiringRows : allRows;
  const isLoading = view === "expiring" ? expiringLoading : allLoading;

  const save = contracts.useSave();
  const remove = contracts.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();

  const suppliersQuery = useQuery({
    queryKey: qk.module("suppliers").list(),
    queryFn: () => supplierService.getAll(),
    staleTime: 300_000,
  });
  const { data: suppliers = [] } = suppliersQuery;

  const assetsQuery = useQuery({
    queryKey: qk.module("assets-all").list(),
    queryFn: () => assetService.getAll(),
    staleTime: 300_000,
  });
  const { data: assets = [] } = assetsQuery;

  // The supplier and asset pickers must exist before the form prefills itself.
  const pickersReady = formPickersReady(suppliersQuery, assetsQuery);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);

  const { register, handleSubmit, reset, setError, setValue, watch, formState: { errors } } = useForm<ContractForm>();
  // Documents are uploaded, not linked. An existing contract attaches straight
  // away; a new one holds the file until the create returns its id.
  const attachments = useAttachmentField({ entityType: "CONTRACT", entityId: editing?.id ?? null });

  useEffect(() => {
    if (!isModalOpen || !pickersReady) return;
    attachments.reset();
    reset(
      editing
        ? {
            title: editing.title,
            contractNumber: editing.contractNumber || "",
            contractType: editing.contractType,
            status: editing.status,
            supplierId: editing.supplierId || "",
            assetId: editing.assetId || "",
            startDate: editing.startDate || "",
            endDate: editing.endDate || "",
            alertDaysBefore: editing.alertDaysBefore ?? "",
            value: editing.value ?? "",
            currency: editing.currency || baseCurrency,
            autoRenew: editing.autoRenew,
            documentUrl: editing.documentUrl || "",
            notes: editing.notes || "",
          }
        : {
            title: "",
            contractType: "MAINTENANCE",
            status: "DRAFT",
            contractNumber: "",
            supplierId: "",
            assetId: "",
            value: "",
            currency: baseCurrency,
            autoRenew: false,
            startDate: "",
            endDate: "",
            alertDaysBefore: 30,
            documentUrl: "",
            notes: "",
          },
    );
    // `attachments.reset` only clears local picker state; it is stable per modal open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, editing, reset, baseCurrency, pickersReady]);

  const supplierName = useMemo(() => {
    const map = new Map(suppliers.map((s) => [s.id, s.name]));
    return (id?: string) => map.get(id ?? "") ?? "—";
  }, [suppliers]);

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (contract: Contract) => {
    if (!(await confirm({ message: `Delete "${contract.title}"?`, variant: "danger" }))) return;
    remove.mutate(contract.id);
  };

  const onSubmit = async (data: ContractForm) => {
    const payload = buildContractPayload(data);
    try {
      const saved = await save.mutateAsync(editing ? { id: editing.id, data: payload } : { data: payload });
      // The record exists now, so the held file finally has something to hang off.
      // A failure here says so; it never passes for a clean save.
      if (!editing) await attachAfterCreate(attachments, saved?.id, "contract");
      setIsModalOpen(false);
    } catch (err) {
      applyApiFieldErrors(err, setError); // the save hook already toasted the field list
    }
  };

  const columns = useMemo<ColumnDef<Contract, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Contract",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-64">
            <p className="truncate font-semibold text-foreground">{row.original.title}</p>
            <p className="truncate text-xs text-faint-fg">
              {row.original.contractNumber ? <span className="data-mono">{row.original.contractNumber} · </span> : null}
              {String(row.original.contractType ?? "").replace(/_/g, " ")}
              {row.original.autoRenew ? " · auto-renews" : ""}
            </p>
            {row.original.notes ? (
              <p className="truncate text-xs text-muted-fg" title={row.original.notes}>{row.original.notes}</p>
            ) : null}
            {row.original.documentUrl ? (
              <SafeExternalLink href={row.original.documentUrl} className="text-xs text-brand underline-offset-2 hover:underline">
                Document
              </SafeExternalLink>
            ) : null}
          </div>
        ),
      },
      {
        id: "supplier",
        header: "Supplier",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0 max-w-48">
            <p className="truncate text-muted-fg">
              {row.original.supplierName || supplierName(row.original.supplierId ?? undefined)}
            </p>
            {row.original.assetName ? (
              <p className="truncate text-xs text-faint-fg">Asset · {row.original.assetName}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "period",
        header: "Period",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-xs text-muted-fg">
            <p>
              {formatLocalDate(row.original.startDate)}
              {" – "}
              {formatLocalDate(row.original.endDate)}
            </p>
            {typeof row.original.daysUntilExpiry === "number" ? (
              <p className={row.original.daysUntilExpiry < 0 ? "text-danger" : "text-faint-fg"}>
                {row.original.daysUntilExpiry < 0
                  ? `Ended ${-row.original.daysUntilExpiry} day(s) ago`
                  : `${row.original.daysUntilExpiry} day(s) left · alert ${row.original.alertDaysBefore ?? 30}d before`}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "value",
        header: () => <span className="block text-right">Value</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {row.original.value == null ? "—" : format(row.original.value, row.original.currency || baseCurrency)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status ?? "DRAFT"}
            tone={
              row.original.status === "EXPIRING_SOON"
                ? "maintenance"
                : row.original.status === "EXPIRED"
                  ? "flagged"
                  : undefined
            }
          />
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
              aria-label="Edit contract"
              onClick={() => {
                setEditing(row.original);
                setIsModalOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Delete contract"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supplierName, format, baseCurrency],
  );

  // Each contract is converted into the display currency; contracts without a rate are excluded and flagged.
  const totalValue = useMemo(
    () => sum(rows.filter((c) => c.value != null).map((c) => ({ amount: c.value ?? 0, currency: c.currency }))),
    [rows, sum],
  );

  return (
    <ListPageTemplate
      title="Contracts"
      subtitle={isLoading ? "Loading contracts…" : `${rows.length} agreements ${view === "expiring" ? "expiring soon" : "on file"}`}
      actions={
        <>
          <ImportButton type="contracts" />
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New contract
          </Button>
        </>
      }
      toolbar={
        <div className="flex gap-1.5">
          <Button variant={view === "all" ? "default" : "outline"} size="sm" onClick={() => setView("all")}>
            All
          </Button>
          <Button
            variant={view === "expiring" ? "default" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => setView("expiring")}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Expiring soon
          </Button>
        </div>
      }
    >
      <MissingRatesNotice incomplete={!totalValue.complete} missingRates={totalValue.missingRates} />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyTitle={view === "expiring" ? "Nothing expiring soon" : "No contracts yet"}
        emptyDescription="Track supplier agreements — SLAs, warranties, leases — with renewal dates and value."
        emptyAction={
          view === "all" ? (
            <Button size="sm" onClick={openCreate}>
              <FileSignature className="mr-1.5 h-4 w-4" /> New contract
            </Button>
          ) : undefined
        }
        footerSummary={
          <span>
            Total value · <MoneyTotalValue total={totalValue} />
          </span>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit contract" : "New contract"}
        description="Supplier agreements with lifecycle and value tracking."
      >
        {!pickersReady ? (
          <PageSpinner label="Loading suppliers…" />
        ) : (
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="ct-title">Title <span className="text-danger">*</span></Label>
              <Input id="ct-title" placeholder="Annual maintenance — ATM fleet" {...limitInputProps(L.title)}
                {...register("title", limitRules<ContractForm, "title">(L.title, "Title"))} />
              <FieldError error={errors.title} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-number">Contract number</Label>
              <Input id="ct-number" className="data-mono" {...limitInputProps(L.contractNumber)}
                {...register("contractNumber", limitRules<ContractForm, "contractNumber">(L.contractNumber, "Contract number"))} />
              <FieldError error={errors.contractNumber} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ct-type">Type</Label>
              <Select id="ct-type" {...register("contractType", limitRules<ContractForm, "contractType">(L.contractType, "Type"))}>
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </Select>
              <FieldError error={errors.contractType} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-status">Status</Label>
              <Select id="ct-status" {...register("status")}>
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
              <FieldError error={errors.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ct-supplier">Supplier</Label>
              <Select id="ct-supplier" {...register("supplierId")}>
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <FieldError error={errors.supplierId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-asset">Linked asset</Label>
              <Select id="ct-asset" {...register("assetId")}>
                <option value="">— None —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.assetTag ? `${a.name} (${a.assetTag})` : a.name}</option>
                ))}
              </Select>
              <FieldError error={errors.assetId} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ct-start">Start date <span className="text-danger">*</span></Label>
              <Input id="ct-start" type="date" {...register("startDate", limitRules<ContractForm, "startDate">(L.startDate, "Start date"))} />
              <FieldError error={errors.startDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-end">End date <span className="text-danger">*</span></Label>
              <Input
                id="ct-end"
                type="date"
                {...register("endDate", {
                  ...limitRules<ContractForm, "endDate">(L.endDate, "End date"),
                  validate: (end, form) =>
                    !end || !form.startDate || String(end) >= String(form.startDate) || "Must be on or after the start date",
                })}
              />
              <FieldError error={errors.endDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-alert">Alert days before end</Label>
              <Input id="ct-alert" type="number" {...limitInputProps(L.alertDaysBefore)}
                {...register("alertDaysBefore", limitRules<ContractForm, "alertDaysBefore">(L.alertDaysBefore, "Alert days"))} />
              <FieldError error={errors.alertDaysBefore} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ct-value">Value</Label>
              <Input id="ct-value" type="number" placeholder="Unknown" {...limitInputProps(L.value)}
                {...register("value", limitRules<ContractForm, "value">(L.value, "Value"))} />
              <FieldError error={errors.value} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-currency">Currency</Label>
              <Select id="ct-currency" {...register("currency")}>
                <CurrencyOptions current={editing?.currency} />
              </Select>
              <FieldError error={errors.currency} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ct-renew"
              className="ea-focus rounded border-edge accent-[var(--primary)]"
              {...register("autoRenew")}
            />
            <Label htmlFor="ct-renew" className="flex cursor-pointer items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-muted-fg" /> Auto-renews at end date
            </Label>
          </div>

          {/* The stored URL is carried through untouched so a legacy link is never cleared. */}
          {attachments.enabled ? <input type="hidden" {...register("documentUrl")} /> : null}
          <AttachmentField
            state={attachments}
            label="Contract document"
            // From form state, not the loaded record: a cleared link must stay
            // cleared on the next render rather than re-appearing from `editing`.
            legacyUrl={watch("documentUrl")}
            onClearLegacy={() => setValue("documentUrl", "", { shouldDirty: true })}
            fallback={
              <div className="space-y-2">
                <Label htmlFor="ct-doc">Document URL</Label>
                <Input id="ct-doc" type="url" placeholder="https://…" {...limitInputProps(L.documentUrl)}
                  {...register("documentUrl", limitRules<ContractForm, "documentUrl">(L.documentUrl, "Document URL"))} />
                <FieldError error={errors.documentUrl} />
              </div>
            }
          />

          <div className="space-y-2">
            <Label htmlFor="ct-terms">Key terms</Label>
            <Textarea id="ct-terms" placeholder="Coverage, exclusions, notice period…" {...register("notes")} />
            <FieldError error={errors.notes} />
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={save.isPending}>
              {editing ? "Save changes" : "Create contract"}
            </Button>
          </div>
        </form>
        )}
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
