"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Home, AlertTriangle, Ban, Search } from "lucide-react";
import { leaseRecordService, type LeaseRecordDto, type LeaseStatus } from "@/services/leaseRecordService";
import { assetService } from "@/services/assetService";
import { supplierService } from "@/services/supplierService";
import { reportApiError, reportFormErrors } from "@/lib/api-validation";
import { buildLeasePayload, leaseNoticePrefill, type LeaseForm } from "@/features/finance/payloads";
import { departmentService } from "@/services/departmentService";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { qk } from "@/lib/queryClient";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { AssetTag } from "@/components/ui/asset-tag";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";
import { MissingRatesNotice } from "@/components/currency/MissingRatesNotice";
import { MoneyTotalValue } from "@/components/currency/MoneyTotalValue";
import { formatLocalDate } from "@/lib/local-date";


const LEASE_STATUSES: LeaseStatus[] = ["ACTIVE", "PENDING_RENEWAL", "EXPIRED", "TERMINATED"];

const L = FIELD_LIMITS.lease;

export default function LeasesPage() {
  const { format, baseCurrency, sum } = useCurrency();
  const queryClient = useQueryClient();
  const leasesKey = qk.module("leases");
  const { confirm, ConfirmDialog } = useConfirm();

  const { data: leases = [], isLoading } = useQuery({
    queryKey: leasesKey.list(),
    queryFn: () => leaseRecordService.listAll(),
  });
  const { data: expiring = [] } = useQuery({
    queryKey: [...leasesKey.all, "expiring"],
    queryFn: () => leaseRecordService.listExpiringSoon(30),
  });
  const { data: assets = [] } = useQuery({
    queryKey: qk.module("assets-all").list(),
    queryFn: () => assetService.getAll(),
    staleTime: 300_000,
  });
  // The lessor is a supplier record, not free text: the API needs its id.
  const { data: suppliers = [] } = useQuery({
    queryKey: qk.module("suppliers").list(),
    queryFn: () => supplierService.getAll(),
    staleTime: 300_000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: qk.module("departments").list(),
    queryFn: () => departmentService.getAll(),
    staleTime: 300_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: leasesKey.all });

  const saveLease = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<LeaseRecordDto> }) =>
      id ? leaseRecordService.update(id, data) : leaseRecordService.create(data),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Lease updated" : "Lease created");
      invalidate();
    },
  });
  const deleteLease = useMutation({
    mutationFn: (id: string) => leaseRecordService.delete(id),
    onSuccess: () => {
      toast.success("Lease deleted");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to delete lease" }),
  });
  const terminateLease = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => leaseRecordService.terminate(id, reason),
    onSuccess: () => {
      toast.success("Lease terminated");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to terminate lease" }),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaseStatus | "">("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaseRecordDto | null>(null);
  const [terminating, setTerminating] = useState<LeaseRecordDto | null>(null);
  const [terminateReason, setTerminateReason] = useState("");

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<LeaseForm>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            assetId: editing.assetId || "",
            lessorId: editing.lessorId || "",
            startDate: editing.startDate?.split("T")[0] || "",
            endDate: editing.endDate?.split("T")[0] || "",
            monthlyPayment: editing.monthlyPayment ?? "",
            currency: editing.currency || baseCurrency,
            autoRenew: editing.autoRenew ?? false,
            noticePeriodDays: leaseNoticePrefill(editing.noticePeriodDays),
            departmentId: editing.departmentId || "",
            notes: editing.notes || "",
          }
        : {
            assetId: "",
            lessorId: "",
            startDate: "",
            endDate: "",
            monthlyPayment: "",
            currency: baseCurrency,
            autoRenew: false,
            noticePeriodDays: 30,
            departmentId: "",
            notes: "",
          },
    );
  }, [isModalOpen, editing, reset, baseCurrency]);

  const deptName = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.name]));
    return (id?: string | null) => (id ? map.get(id) ?? null : null);
  }, [departments]);

  const assetLookup = useMemo(() => {
    const map = new Map(assets.map((a) => [a.id, a]));
    return (id?: string) => map.get(id ?? "");
  }, [assets]);

  const filtered = useMemo(() => {
    let list = leases;
    if (statusFilter) list = list.filter((l) => l.status === statusFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (l) =>
          (l.lessorName || "").toLowerCase().includes(q) ||
          (l.assetName || assetLookup(l.assetId)?.name || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [leases, statusFilter, searchTerm, assetLookup]);

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (lease: LeaseRecordDto) => {
    if (!(await confirm({ message: "Delete this lease record permanently?", variant: "danger" }))) return;
    deleteLease.mutate(lease.id!);
  };

  const onSubmit = async (data: LeaseForm) => {
    try {
      await saveLease.mutateAsync({ id: editing?.id, data: buildLeasePayload(data) });
      setIsModalOpen(false);
    } catch (err) {
      reportApiError(err, { fallback: "Failed to save lease", setError, labels: { lessorId: "Lessor" } });
    }
  };

  const handleTerminate = async () => {
    if (!terminating?.id) return;
    try {
      await terminateLease.mutateAsync({ id: terminating.id, reason: terminateReason.trim() || undefined });
      setTerminating(null);
      setTerminateReason("");
    } catch {
      // The mutation toasts the server's reason (e.g. "Lease is already terminated.").
    }
  };

  const columns = useMemo<ColumnDef<LeaseRecordDto, unknown>[]>(
    () => [
      {
        id: "asset",
        header: "Asset",
        enableSorting: false,
        cell: ({ row }) => {
          const asset = assetLookup(row.original.assetId);
          const tag = asset?.assetTag;
          return (
            <div className="flex min-w-0 max-w-56 flex-col gap-1">
              <span className="truncate font-semibold text-foreground">
                {row.original.assetName || asset?.name || "—"}
              </span>
              {tag ? <AssetTag tag={tag} /> : null}
            </div>
          );
        },
      },
      {
        accessorKey: "lessorName",
        header: "Lessor",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-48">
            <p className="truncate text-muted-fg">{row.original.lessorName || "—"}</p>
            {deptName(row.original.departmentId) ? (
              <p className="truncate text-xs text-faint-fg">{deptName(row.original.departmentId)}</p>
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
            <p className="text-faint-fg">
              {row.original.noticePeriodDays ?? 30}-day notice
              {row.original.autoRenew ? " · auto-renews" : ""}
            </p>
            {row.original.notes ? (
              <p className="max-w-56 truncate" title={row.original.notes}>{row.original.notes}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "monthlyPayment",
        header: () => <span className="block text-right">Monthly</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {format(row.original.monthlyPayment, row.original.currency || baseCurrency)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status ?? "ACTIVE"}
            tone={
              row.original.status === "PENDING_RENEWAL"
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
            {row.original.status === "ACTIVE" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-warn"
                aria-label="Terminate lease"
                title="Terminate early"
                onClick={() => setTerminating(row.original)}
              >
                <Ban className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit lease"
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
              aria-label="Delete lease"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assetLookup, deptName, format, baseCurrency],
  );

  // Each active lease is converted into the display currency; leases without a rate are excluded and flagged.
  const monthlyTotal = useMemo(
    () =>
      sum(
        filtered
          .filter((l) => l.status === "ACTIVE")
          .map((l) => ({ amount: l.monthlyPayment, currency: l.currency })),
      ),
    [filtered, sum],
  );

  return (
    <ListPageTemplate
      title="Lease records"
      subtitle={isLoading ? "Loading leases…" : `${leases.length} leases · ${expiring.length} ending within 30 days`}
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New lease
        </Button>
      }
      toolbar={
        <>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
            <Input
              placeholder="Search asset or lessor…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeaseStatus | "")}
            className="w-44"
          >
            <option value="">All statuses</option>
            {LEASE_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </>
      }
    >
      <div className="space-y-4">
        <MissingRatesNotice incomplete={!monthlyTotal.complete} missingRates={monthlyTotal.missingRates} />

        {expiring.length > 0 && (
          <div className="flex items-start gap-3 rounded-card border border-warn/40 bg-warn-soft p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{expiring.length} lease{expiring.length === 1 ? "" : "s"}</span> end
              within 30 days — review renewal or termination notice periods.
            </p>
          </div>
        )}

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          emptyTitle="No lease records"
          emptyDescription="Track leased assets with monthly obligations, notice periods, and renewals."
          emptyAction={
            <Button size="sm" onClick={openCreate}>
              <Home className="mr-1.5 h-4 w-4" /> New lease
            </Button>
          }
          footerSummary={
            <span>
              Active monthly obligations · <MoneyTotalValue total={monthlyTotal} />
            </span>
          }
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit lease" : "New lease"}
        description="Lease agreements for assets you don't own outright."
      >
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="ls-asset">Asset <span className="text-danger">*</span></Label>
            <Select id="ls-asset" {...register("assetId", limitRules<LeaseForm, "assetId">(L.assetId, "Asset"))}>
              <option value="">Select asset</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "no tag"})</option>
              ))}
            </Select>
            <FieldError error={errors.assetId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ls-lessor">Lessor <span className="text-danger">*</span></Label>
            <Select id="ls-lessor" {...register("lessorId", { required: "Choose the supplier you lease from" })}>
              <option value="">Select supplier</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>{sup.name}</option>
              ))}
            </Select>
            {suppliers.length === 0 ? (
              <p className="text-xs text-muted-fg">Add the leasing company under Suppliers first.</p>
            ) : null}
            <FieldError error={errors.lessorId} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ls-start">Start date <span className="text-danger">*</span></Label>
              <Input id="ls-start" type="date" {...register("startDate", limitRules<LeaseForm, "startDate">(L.startDate, "Start date"))} />
              <FieldError error={errors.startDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ls-end">End date <span className="text-danger">*</span></Label>
              <Input
                id="ls-end"
                type="date"
                {...register("endDate", {
                  required: "End date is required",
                  validate: (end, form) =>
                    !end || !form.startDate || String(end) >= String(form.startDate) || "Must be on or after the start date",
                })}
              />
              <FieldError error={errors.endDate} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ls-payment">Monthly payment <span className="text-danger">*</span></Label>
              <Input id="ls-payment" type="number" {...limitInputProps(L.monthlyPayment)}
                {...register("monthlyPayment", limitRules<LeaseForm, "monthlyPayment">(L.monthlyPayment, "Monthly payment"))} />
              <FieldError error={errors.monthlyPayment} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ls-currency">Currency</Label>
              <Select id="ls-currency" {...register("currency")}>
                <CurrencyOptions current={editing?.currency} />
              </Select>
              <FieldError error={errors.currency} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ls-notice">Notice period (days)</Label>
              <Input id="ls-notice" type="number" {...limitInputProps(L.noticePeriodDays)}
                {...register("noticePeriodDays", limitRules<LeaseForm, "noticePeriodDays">(L.noticePeriodDays, "Notice period"))} />
              <FieldError error={errors.noticePeriodDays} />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                id="ls-renew"
                className="ea-focus rounded border-edge accent-[var(--primary)]"
                {...register("autoRenew")}
              />
              <Label htmlFor="ls-renew" className="cursor-pointer">Auto-renews</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ls-dept">Department</Label>
            <Select id="ls-dept" {...register("departmentId")}>
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            <FieldError error={errors.departmentId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ls-notes">Notes</Label>
            <Textarea id="ls-notes" placeholder="Payment terms, insurance, conditions…" {...register("notes")} />
            <p className="text-xs text-faint-fg">A termination reason is recorded here.</p>
            <FieldError error={errors.notes} />
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={saveLease.isPending}>
              {editing ? "Save changes" : "Create lease"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={terminating !== null}
        onClose={() => setTerminating(null)}
        title="Terminate lease early"
        description={terminating ? `End the lease on "${terminating.assetName || assetLookup(terminating.assetId)?.name || "asset"}" before its end date.` : ""}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ls-terminate-reason">Reason (optional)</Label>
            <Textarea
              id="ls-terminate-reason"
              placeholder="e.g. Asset returned to lessor after damage assessment"
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTerminating(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleTerminate} isLoading={terminateLease.isPending}>
              <Ban className="mr-1.5 h-4 w-4" /> Terminate lease
            </Button>
          </div>
        </div>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
