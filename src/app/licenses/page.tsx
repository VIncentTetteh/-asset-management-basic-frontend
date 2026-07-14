"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Key, AlertTriangle, Users } from "lucide-react";
import type { SoftwareLicense, SoftwareLicenseDto, LicenseType, LicenseStatus } from "@/types";
import { licenseService } from "@/services/licenseService";
import { supplierService } from "@/services/supplierService";
import { qk } from "@/lib/queryClient";
import { makeCrudHooks } from "@/features/shared/crudHooks";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

const LICENSE_TYPES: LicenseType[] = ["SUBSCRIPTION", "PERPETUAL", "VOLUME", "NODE_LOCKED", "OPEN_SOURCE", "TRIAL", "ENTERPRISE", "OEM"];
const LICENSE_STATUSES: LicenseStatus[] = ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "SUSPENDED", "CANCELLED"];

type ViewType = "all" | "expiring" | "over-allocated";

const licenses = makeCrudHooks<SoftwareLicense, SoftwareLicenseDto>("licenses", licenseService, { entity: "License" });

function SeatBar({ seats, allocated }: { seats: number; allocated: number }) {
  const pct = seats > 0 ? Math.min((allocated / seats) * 100, 100) : 0;
  const over = allocated > seats;
  return (
    <div className="min-w-28">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={cn("data-mono text-xs", over ? "font-bold text-danger" : "text-muted-fg")}>
          {allocated}/{seats}
        </span>
        {over && <AlertTriangle className="h-3 w-3 text-danger" />}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: over ? "var(--danger)" : "var(--primary)" }}
        />
      </div>
    </div>
  );
}

export default function LicensesPage() {
  const { format } = useCurrency();
  const [view, setView] = useState<ViewType>("all");

  const { data: allRows = [], isLoading: allLoading } = licenses.useList();
  const { data: expiringRows = [], isLoading: expLoading } = useQuery({
    queryKey: [...licenses.key.all, "expiring"],
    queryFn: () => licenseService.getExpiringSoon(30),
    enabled: view === "expiring",
  });
  const { data: overRows = [], isLoading: overLoading } = useQuery({
    queryKey: [...licenses.key.all, "over-allocated"],
    queryFn: () => licenseService.getOverAllocated(),
    enabled: view === "over-allocated",
  });
  const { data: utilization } = useQuery({
    queryKey: [...licenses.key.all, "utilization"],
    queryFn: () => licenseService.getUtilization(),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: qk.module("suppliers").list(),
    queryFn: () => supplierService.getAll(),
    staleTime: 300_000,
  });

  const rows = view === "expiring" ? expiringRows : view === "over-allocated" ? overRows : allRows;
  const isLoading = view === "expiring" ? expLoading : view === "over-allocated" ? overLoading : allLoading;

  const save = licenses.useSave();
  const remove = licenses.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<SoftwareLicense | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SoftwareLicenseDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            productName: editing.productName,
            licenseType: editing.licenseType,
            status: editing.status,
            licenseKey: editing.licenseKey || "",
            vendor: editing.vendor || "",
            seats: editing.seats,
            allocatedSeats: editing.allocatedSeats,
            purchaseDate: editing.purchaseDate || "",
            expiryDate: editing.expiryDate || "",
            monthlyCost: editing.monthlyCost ?? undefined,
            currency: editing.currency || "GHS",
            supplierId: editing.supplierId || "",
          }
        : { productName: "", licenseType: "SUBSCRIPTION", status: "ACTIVE", seats: 1, allocatedSeats: 0, currency: "GHS" },
    );
  }, [isModalOpen, editing, reset]);

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (license: SoftwareLicense) => {
    if (!(await confirm({ message: `Delete "${license.productName}"?`, variant: "danger" }))) return;
    remove.mutate(license.id);
  };

  const onSubmit = async (data: SoftwareLicenseDto) => {
    const payload: SoftwareLicenseDto = {
      ...data,
      seats: Number(data.seats),
      allocatedSeats: Number(data.allocatedSeats),
      monthlyCost: data.monthlyCost != null && String(data.monthlyCost) !== "" ? Number(data.monthlyCost) : undefined,
    };
    (Object.keys(payload) as (keyof SoftwareLicenseDto)[]).forEach((k) => {
      if (payload[k] === "") delete (payload as unknown as Record<string, unknown>)[k];
    });

    if (editing) {
      const patch = buildPatchPayload<SoftwareLicenseDto>(editing as unknown as Partial<SoftwareLicenseDto>, payload);
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await save.mutateAsync({ id: editing.id, data: patch as SoftwareLicenseDto });
    } else {
      await save.mutateAsync({ data: payload });
    }
    setIsModalOpen(false);
  };

  const columns = useMemo<ColumnDef<SoftwareLicense, unknown>[]>(
    () => [
      {
        accessorKey: "productName",
        header: "Product",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">{row.original.productName}</p>
            <p className="truncate text-xs text-faint-fg">
              {row.original.vendor || "—"} · {String(row.original.licenseType ?? "").replace(/_/g, " ").toLowerCase()}
            </p>
          </div>
        ),
      },
      {
        id: "seats",
        header: "Seats",
        enableSorting: false,
        cell: ({ row }) => <SeatBar seats={row.original.seats} allocated={row.original.allocatedSeats} />,
      },
      {
        accessorKey: "expiryDate",
        header: "Expires",
        cell: ({ row }) => (
          <span className="text-muted-fg">
            {row.original.expiryDate ? new Date(row.original.expiryDate).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        accessorKey: "monthlyCost",
        header: () => <span className="block text-right">Monthly</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {row.original.monthlyCost != null ? format(row.original.monthlyCost, row.original.currency || "GHS") : "—"}
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
              row.original.status === "EXPIRING_SOON"
                ? "maintenance"
                : row.original.status === "EXPIRED" || row.original.status === "SUSPENDED"
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
              aria-label="Edit license"
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
              aria-label="Delete license"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [format],
  );

  return (
    <ListPageTemplate
      title="Software licenses"
      subtitle={isLoading ? "Loading licenses…" : `${rows.length} licenses in view`}
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New license
        </Button>
      }
      toolbar={
        <div className="flex gap-1.5">
          {(
            [
              ["all", "All"],
              ["expiring", "Expiring 30d"],
              ["over-allocated", "Over-allocated"],
            ] as [ViewType, string][]
          ).map(([key, label]) => (
            <Button key={key} variant={view === key ? "default" : "outline"} size="sm" onClick={() => setView(key)}>
              {label}
            </Button>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        {utilization ? (
          <Card>
            <CardContent className="flex flex-wrap items-center gap-8 pt-5">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-brand" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Seat utilisation</p>
                  <p className="data-mono text-lg font-bold text-foreground">
                    {utilization.utilizationPct?.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Allocated / total seats</p>
                <p className="data-mono text-lg font-bold text-foreground">
                  {utilization.totalAllocated} / {utilization.totalSeats}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyTitle={view === "all" ? "No software licenses" : "Nothing in this view"}
          emptyDescription="Track subscriptions and perpetual licenses, seat allocation, and renewal dates."
          emptyAction={
            view === "all" ? (
              <Button size="sm" onClick={openCreate}>
                <Key className="mr-1.5 h-4 w-4" /> New license
              </Button>
            ) : undefined
          }
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit license" : "New license"}
        description="Seats, costs, and renewal tracking for software entitlements."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="lic-name">Product name <span className="text-danger">*</span></Label>
            <Input id="lic-name" placeholder="Microsoft 365 E3" {...register("productName", { required: "Product name is required" })} />
            {errors.productName && <p className="text-sm text-danger">{errors.productName.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lic-type">Type</Label>
              <Select id="lic-type" {...register("licenseType")}>
                {LICENSE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-status">Status</Label>
              <Select id="lic-status" {...register("status")}>
                {LICENSE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lic-key">License key</Label>
            <Input id="lic-key" className="data-mono" placeholder="XXXX-XXXX-XXXX" {...register("licenseKey")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lic-vendor">Vendor</Label>
              <Input id="lic-vendor" placeholder="Microsoft" {...register("vendor")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-supplier">Supplier</Label>
              <Select id="lic-supplier" {...register("supplierId")}>
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lic-seats">Total seats</Label>
              <Input id="lic-seats" type="number" min="1" {...register("seats", { required: true, min: 1 })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-alloc">Allocated seats</Label>
              <Input id="lic-alloc" type="number" min="0" {...register("allocatedSeats", { min: 0 })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lic-purchase">Purchase date</Label>
              <Input id="lic-purchase" type="date" {...register("purchaseDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-expiry">Expiry date</Label>
              <Input id="lic-expiry" type="date" {...register("expiryDate")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lic-cost">Monthly cost</Label>
              <Input id="lic-cost" type="number" step="0.01" min="0" {...register("monthlyCost")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-currency">Currency</Label>
              <Select id="lic-currency" {...register("currency")}>
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={save.isPending}>
              {editing ? "Save changes" : "Create license"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
