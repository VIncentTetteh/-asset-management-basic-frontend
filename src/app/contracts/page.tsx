"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FileSignature, RefreshCw, AlertTriangle } from "lucide-react";
import type { Contract, ContractDto } from "@/types";
import { contractService } from "@/services/contractService";
import { supplierService } from "@/services/supplierService";
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
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";

const CONTRACT_TYPES = ["PURCHASE", "LEASE", "MAINTENANCE", "SERVICE_LEVEL_AGREEMENT", "WARRANTY", "INSURANCE", "OTHER"];
const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED", "RENEWED"];

const contracts = makeCrudHooks<Contract, ContractDto>("contracts", contractService, { entity: "Contract" });

export default function ContractsPage() {
  const { format } = useCurrency();
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

  const { data: suppliers = [] } = useQuery({
    queryKey: qk.module("suppliers").list(),
    queryFn: () => supplierService.getAll(),
    staleTime: 300_000,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContractDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            title: editing.title,
            contractType: editing.contractType,
            status: editing.status,
            supplierId: editing.supplierId || "",
            startDate: editing.startDate || "",
            endDate: editing.endDate || "",
            value: editing.value,
            currency: editing.currency || "GHS",
            autoRenew: editing.autoRenew,
            terms: editing.terms || "",
          }
        : { title: "", contractType: "MAINTENANCE", status: "DRAFT", value: 0, currency: "GHS", autoRenew: false },
    );
  }, [isModalOpen, editing, reset]);

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

  const onSubmit = async (data: ContractDto) => {
    const payload = { ...data, value: Number(data.value) };
    (Object.keys(payload) as (keyof ContractDto)[]).forEach((k) => {
      if (payload[k] === "") delete (payload as Partial<ContractDto>)[k];
    });
    if (editing) {
      const patch = buildPatchPayload<ContractDto>(editing as unknown as Partial<ContractDto>, payload);
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await save.mutateAsync({ id: editing.id, data: patch as ContractDto });
    } else {
      await save.mutateAsync({ data: payload });
    }
    setIsModalOpen(false);
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
              {String(row.original.contractType ?? "").replace(/_/g, " ")}
              {row.original.autoRenew ? " · auto-renews" : ""}
            </p>
          </div>
        ),
      },
      {
        id: "supplier",
        header: "Supplier",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{supplierName(row.original.supplierId ?? undefined)}</span>,
      },
      {
        id: "period",
        header: "Period",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-fg">
            {row.original.startDate ? new Date(row.original.startDate).toLocaleDateString() : "—"}
            {" – "}
            {row.original.endDate ? new Date(row.original.endDate).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        accessorKey: "value",
        header: () => <span className="block text-right">Value</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">{format(row.original.value, row.original.currency || "GHS")}</span>
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
    [supplierName, format],
  );

  const totalValue = useMemo(() => rows.reduce((sum, c) => sum + (c.value || 0), 0), [rows]);

  return (
    <ListPageTemplate
      title="Contracts"
      subtitle={isLoading ? "Loading contracts…" : `${rows.length} agreements ${view === "expiring" ? "expiring soon" : "on file"}`}
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New contract
        </Button>
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
            Total value · <span className="data-mono">{format(totalValue, "GHS")}</span>
          </span>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit contract" : "New contract"}
        description="Supplier agreements with lifecycle and value tracking."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="ct-title">Title <span className="text-danger">*</span></Label>
            <Input id="ct-title" placeholder="Annual maintenance — ATM fleet" {...register("title", { required: "Title is required" })} />
            {errors.title && <p className="text-sm text-danger">{errors.title.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ct-type">Type</Label>
              <Select id="ct-type" {...register("contractType")}>
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-status">Status</Label>
              <Select id="ct-status" {...register("status")}>
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ct-supplier">Supplier</Label>
            <Select id="ct-supplier" {...register("supplierId")}>
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ct-start">Start date</Label>
              <Input id="ct-start" type="date" {...register("startDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-end">End date</Label>
              <Input id="ct-end" type="date" {...register("endDate")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ct-value">Value</Label>
              <Input id="ct-value" type="number" step="0.01" min="0" {...register("value")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-currency">Currency</Label>
              <Select id="ct-currency" {...register("currency")}>
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
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

          <div className="space-y-2">
            <Label htmlFor="ct-terms">Key terms</Label>
            <Textarea id="ct-terms" placeholder="Coverage, exclusions, notice period…" {...register("terms")} />
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={save.isPending}>
              {editing ? "Save changes" : "Create contract"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
