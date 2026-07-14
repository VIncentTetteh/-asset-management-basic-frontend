"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Home, AlertTriangle, Ban, Search } from "lucide-react";
import { leaseRecordService, type LeaseRecordDto, type LeaseStatus } from "@/services/leaseRecordService";
import { assetService } from "@/services/assetService";
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

type FormData = Omit<LeaseRecordDto, "id" | "organisationId" | "createdAt" | "status">;

const LEASE_STATUSES: LeaseStatus[] = ["ACTIVE", "PENDING_RENEWAL", "EXPIRED", "TERMINATED"];

export default function LeasesPage() {
  const { format } = useCurrency();
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: leasesKey.all });

  const saveLease = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: FormData }) =>
      id ? leaseRecordService.update(id, data) : leaseRecordService.create(data),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Lease updated" : "Lease created");
      invalidate();
    },
    onError: () => toast.error("Failed to save lease"),
  });
  const deleteLease = useMutation({
    mutationFn: (id: string) => leaseRecordService.delete(id),
    onSuccess: () => {
      toast.success("Lease deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete lease"),
  });
  const terminateLease = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => leaseRecordService.terminate(id, reason),
    onSuccess: () => {
      toast.success("Lease terminated");
      invalidate();
    },
    onError: () => toast.error("Failed to terminate lease"),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaseStatus | "">("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaseRecordDto | null>(null);
  const [terminating, setTerminating] = useState<LeaseRecordDto | null>(null);
  const [terminateReason, setTerminateReason] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            assetId: editing.assetId || "",
            lessorName: editing.lessorName || "",
            startDate: editing.startDate?.split("T")[0] || "",
            endDate: editing.endDate?.split("T")[0] || "",
            monthlyPayment: editing.monthlyPayment || 0,
            currency: editing.currency || "GHS",
            autoRenew: editing.autoRenew ?? false,
            noticePeriodDays: editing.noticePeriodDays || 30,
            notes: editing.notes || "",
          }
        : {
            assetId: "",
            lessorName: "",
            startDate: "",
            endDate: "",
            monthlyPayment: 0,
            currency: "GHS",
            autoRenew: false,
            noticePeriodDays: 30,
            notes: "",
          },
    );
  }, [isModalOpen, editing, reset]);

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

  const onSubmit = async (data: FormData) => {
    await saveLease.mutateAsync({
      id: editing?.id,
      data: { ...data, monthlyPayment: Number(data.monthlyPayment), noticePeriodDays: Number(data.noticePeriodDays) },
    });
    setIsModalOpen(false);
  };

  const handleTerminate = async () => {
    if (!terminating?.id) return;
    await terminateLease.mutateAsync({ id: terminating.id, reason: terminateReason || undefined });
    setTerminating(null);
    setTerminateReason("");
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
        cell: ({ row }) => <span className="text-muted-fg">{row.original.lessorName || "—"}</span>,
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
        accessorKey: "monthlyPayment",
        header: () => <span className="block text-right">Monthly</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {format(row.original.monthlyPayment, row.original.currency || "GHS")}
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
    [assetLookup, format],
  );

  const monthlyTotal = useMemo(
    () => filtered.reduce((sum, l) => sum + (l.status === "ACTIVE" ? l.monthlyPayment || 0 : 0), 0),
    [filtered],
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
              Active monthly obligations · <span className="data-mono">{format(monthlyTotal, "GHS")}</span>
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
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="ls-asset">Asset <span className="text-danger">*</span></Label>
            <Select id="ls-asset" {...register("assetId", { required: "Asset is required" })}>
              <option value="">Select asset</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "no tag"})</option>
              ))}
            </Select>
            {errors.assetId && <p className="text-sm text-danger">{errors.assetId.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ls-lessor">Lessor <span className="text-danger">*</span></Label>
            <Input id="ls-lessor" placeholder="Leasing company name" {...register("lessorName", { required: "Lessor is required" })} />
            {errors.lessorName && <p className="text-sm text-danger">{errors.lessorName.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ls-start">Start date <span className="text-danger">*</span></Label>
              <Input id="ls-start" type="date" {...register("startDate", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ls-end">End date <span className="text-danger">*</span></Label>
              <Input id="ls-end" type="date" {...register("endDate", { required: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ls-payment">Monthly payment</Label>
              <Input id="ls-payment" type="number" step="0.01" min="0" {...register("monthlyPayment")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ls-currency">Currency</Label>
              <Select id="ls-currency" {...register("currency")}>
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ls-notice">Notice period (days)</Label>
              <Input id="ls-notice" type="number" min="0" {...register("noticePeriodDays")} />
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
            <Label htmlFor="ls-notes">Notes</Label>
            <Textarea id="ls-notes" placeholder="Payment terms, insurance, conditions…" {...register("notes")} />
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
