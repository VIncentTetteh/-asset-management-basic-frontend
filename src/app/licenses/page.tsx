"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Key, AlertTriangle, Users } from "lucide-react";
import { LICENSE_TYPES, type SoftwareLicense, type SoftwareLicenseDto, type LicenseStatus } from "@/types";
import { licenseService } from "@/services/licenseService";
import { applyApiFieldErrors } from "@/lib/api-validation";
import { buildLicensePayload, type LicenseForm } from "@/features/finance/payloads";
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
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";
import { cn } from "@/lib/utils";

const LICENSE_STATUSES: LicenseStatus[] = ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "SUSPENDED", "CANCELLED"];

type ViewType = "all" | "expiring" | "over-allocated";

// Edits are a full PUT (replace) so emptied fields clear; see licenseService.update.
const licenses = makeCrudHooks<SoftwareLicense, SoftwareLicenseDto>("licenses", {
  ...licenseService,
  update: (id, data) => licenseService.replace(id, data as SoftwareLicenseDto),
}, {
  entity: "License",
  fields: { name: "License name", totalSeats: "Total seats", usedSeats: "Seats in use" },
});

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
  const { format, baseCurrency } = useCurrency();
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
  const rows = view === "expiring" ? expiringRows : view === "over-allocated" ? overRows : allRows;
  const isLoading = view === "expiring" ? expLoading : view === "over-allocated" ? overLoading : allLoading;

  const save = licenses.useSave();
  const remove = licenses.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<SoftwareLicense | null>(null);

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<LicenseForm>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            name: editing.name,
            vendor: editing.vendor || "",
            productName: editing.productName || "",
            version: editing.version || "",
            licenseType: editing.licenseType,
            status: editing.status,
            totalSeats: editing.totalSeats ?? "",
            usedSeats: editing.usedSeats ?? "",
            purchaseDate: editing.purchaseDate || "",
            expiryDate: editing.expiryDate || "",
            renewalDate: editing.renewalDate || "",
            purchaseCost: editing.purchaseCost ?? "",
            annualRenewalCost: editing.annualRenewalCost ?? "",
            currency: editing.currency || baseCurrency,
            autoRenew: editing.autoRenew ?? false,
            // Not edited here, but carried so the full PUT does not clear them.
            licenseDocumentUrl: editing.licenseDocumentUrl || "",
            notes: editing.notes || "",
          }
        : {
            name: "",
            vendor: "",
            productName: "",
            licenseType: "SUBSCRIPTION",
            status: "ACTIVE",
            totalSeats: 1,
            usedSeats: 0,
            currency: baseCurrency,
            autoRenew: false,
          },
    );
  }, [isModalOpen, editing, reset, baseCurrency]);

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (license: SoftwareLicense) => {
    if (!(await confirm({ message: `Delete "${license.name}"?`, variant: "danger" }))) return;
    remove.mutate(license.id);
  };

  const onSubmit = async (data: LicenseForm) => {
    try {
      await save.mutateAsync({ id: editing?.id, data: buildLicensePayload(data) });
      setIsModalOpen(false);
    } catch (err) {
      applyApiFieldErrors(err, setError); // the save hook already toasted the field list
    }
  };

  const columns = useMemo<ColumnDef<SoftwareLicense, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "License",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">{row.original.name}</p>
            <p className="truncate text-xs text-faint-fg">
              {row.original.vendor || "—"}
              {row.original.productName ? ` · ${row.original.productName}` : ""} ·{" "}
              {String(row.original.licenseType ?? "").replace(/_/g, " ").toLowerCase()}
            </p>
          </div>
        ),
      },
      {
        id: "seats",
        header: "Seats",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.totalSeats != null ? (
            <SeatBar seats={row.original.totalSeats} allocated={row.original.usedSeats ?? 0} />
          ) : (
            <span className="text-faint-fg">—</span>
          ),
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
        accessorKey: "annualRenewalCost",
        header: () => <span className="block text-right">Annual renewal</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {row.original.annualRenewalCost != null
              ? format(row.original.annualRenewalCost, row.original.currency || baseCurrency)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "purchaseCost",
        header: () => <span className="block text-right">Purchase cost</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right text-muted-fg">
            {row.original.purchaseCost != null ? format(row.original.purchaseCost, row.original.currency || baseCurrency) : "—"}
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
    [format, baseCurrency],
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
                <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Seats in use / total</p>
                <p className="data-mono text-lg font-bold text-foreground">
                  {utilization.usedSeats} / {utilization.totalSeats}
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
            <Label htmlFor="lic-name">License name <span className="text-danger">*</span></Label>
            <Input id="lic-name" placeholder="Microsoft 365 E3 — Finance" {...register("name", { required: "License name is required" })} />
            {errors.name && <p className="text-sm text-danger">{errors.name.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lic-vendor">Vendor <span className="text-danger">*</span></Label>
              <Input id="lic-vendor" placeholder="Microsoft" {...register("vendor", { required: "Vendor is required" })} />
              {errors.vendor && <p className="text-sm text-danger">{errors.vendor.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-product">Product</Label>
              <Input id="lic-product" placeholder="Microsoft 365 E3" {...register("productName")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lic-type">Type <span className="text-danger">*</span></Label>
              <Select id="lic-type" {...register("licenseType", { required: "License type is required" })}>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lic-seats">Total seats</Label>
              <Input id="lic-seats" type="number" min="0" {...register("totalSeats", { min: { value: 0, message: "Cannot be negative" } })} />
              {errors.totalSeats && <p className="text-sm text-danger">{errors.totalSeats.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-used">Seats in use</Label>
              <Input id="lic-used" type="number" min="0" {...register("usedSeats", { min: { value: 0, message: "Cannot be negative" } })} />
              {errors.usedSeats && <p className="text-sm text-danger">{errors.usedSeats.message as string}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lic-purchase">Purchase date</Label>
              <Input id="lic-purchase" type="date" {...register("purchaseDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-expiry">Expiry date</Label>
              <Input id="lic-expiry" type="date" {...register("expiryDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-renewal">Renewal date</Label>
              <Input id="lic-renewal" type="date" {...register("renewalDate")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lic-cost">Purchase cost</Label>
              <Input id="lic-cost" type="number" step="0.01" min="0" {...register("purchaseCost")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-renewal-cost">Annual renewal</Label>
              <Input id="lic-renewal-cost" type="number" step="0.01" min="0" {...register("annualRenewalCost")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-currency">Currency</Label>
              <Select id="lic-currency" {...register("currency")}>
                <CurrencyOptions current={editing?.currency} />
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="lic-autorenew"
              className="ea-focus rounded border-edge accent-[var(--primary)]"
              {...register("autoRenew")}
            />
            <Label htmlFor="lic-autorenew" className="cursor-pointer">Auto-renews</Label>
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
