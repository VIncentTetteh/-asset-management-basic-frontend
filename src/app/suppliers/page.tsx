"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Truck, Download } from "lucide-react";
import type { Supplier, SupplierDto } from "@/types";
import { supplierService } from "@/services/supplierService";
import { bulkOperationService } from "@/services/bulkOperationService";
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
import { useConfirm } from "@/hooks/useConfirm";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { applyApiFieldErrors } from "@/lib/api-validation";
import { buildSupplierPayload, SUPPLIER_STATUSES } from "@/features/finance/payloads";

// Edits are a full-replace PUT so a field the user empties is cleared (PATCH skips nulls).
const suppliers = makeCrudHooks<Supplier, SupplierDto>(
  "suppliers",
  { ...supplierService, update: (id, data) => supplierService.replace(id, data as SupplierDto) },
  { entity: "Supplier", fields: { registrationNumber: "Registration number", taxId: "Tax ID" } },
);
const L = FIELD_LIMITS.supplier;

export default function SuppliersPage() {
  const { data: rows = [], isLoading } = suppliers.useList();
  const save = suppliers.useSave();
  const remove = suppliers.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<SupplierDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            name: editing.name,
            email: editing.email || "",
            phone: editing.phone || "",
            address: editing.address || "",
            contactPerson: editing.contactPerson || "",
            taxId: editing.taxId || "",
            registrationNumber: editing.registrationNumber || "",
            status: editing.status || "ACTIVE",
          }
        : {
            name: "",
            email: "",
            phone: "",
            address: "",
            contactPerson: "",
            taxId: "",
            registrationNumber: "",
            status: "ACTIVE",
          },
    );
  }, [isModalOpen, editing, reset]);

  const handleExport = async (format: "CSV" | "EXCEL") => {
    setIsExporting(true);
    try {
      const filename = await bulkOperationService.exportSuppliers({ format });
      toast.success(`Downloaded ${filename}`);
    } catch {
      toast.error("Failed to download supplier export");
    } finally {
      setIsExporting(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!(await confirm({ message: `Delete "${supplier.name}"?`, variant: "danger" }))) return;
    remove.mutate(supplier.id!);
  };

  const onSubmit = async (data: SupplierDto) => {
    const payload = buildSupplierPayload(data);
    try {
      await save.mutateAsync(editing ? { id: editing.id!, data: payload } : { data: payload });
      setIsModalOpen(false);
    } catch (error) {
      // The save hook toasts; a duplicate email / tax ID / registration number, or a
      // validation failure, is also marked on its field.
      applyApiFieldErrors(error, setError);
    }
  };

  const columns = useMemo<ColumnDef<Supplier, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Supplier",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">{row.original.name}</p>
            <p className="truncate text-xs text-faint-fg">{row.original.contactPerson || "—"}</p>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => <span className="text-muted-fg">{row.original.email || "—"}</span>,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => <span className="data-mono text-xs text-muted-fg">{row.original.phone || "—"}</span>,
      },
      {
        accessorKey: "taxId",
        header: "Tax ID",
        cell: ({ row }) =>
          row.original.taxId ? (
            <span className="data-mono text-xs">{row.original.taxId}</span>
          ) : (
            <span className="text-faint-fg">—</span>
          ),
      },
      {
        accessorKey: "registrationNumber",
        header: "Registration",
        cell: ({ row }) =>
          row.original.registrationNumber ? (
            <span className="data-mono text-xs">{row.original.registrationNumber}</span>
          ) : (
            <span className="text-faint-fg">—</span>
          ),
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ row }) => (
          <span className="block max-w-56 truncate text-xs text-muted-fg" title={row.original.address ?? undefined}>
            {row.original.address || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "ACTIVE"} />,
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
              aria-label="Edit supplier"
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
              aria-label="Delete supplier"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <ListPageTemplate
      title="Suppliers"
      subtitle={isLoading ? "Loading suppliers…" : `${rows.length} vendors on file`}
      actions={
        <>
          <Button variant="outline" onClick={() => handleExport("EXCEL")} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New supplier
          </Button>
        </>
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyTitle="No suppliers yet"
        emptyDescription="Vendors you procure from — linked to purchase orders, contracts, and reviews."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Truck className="mr-1.5 h-4 w-4" /> New supplier
          </Button>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit supplier" : "New supplier"}
        description="Company identity, contacts, and statutory identifiers."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="sup-name">Company name <span className="text-danger">*</span></Label>
            <Input id="sup-name" placeholder="Acme Supplies Ltd" {...limitInputProps(L.name)}
              {...register("name", limitRules<SupplierDto, "name">(L.name, "Company name"))} />
            <FieldError error={errors.name} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sup-email">Email</Label>
              <Input id="sup-email" type="email" {...limitInputProps(L.email)}
                {...register("email", limitRules<SupplierDto, "email">(L.email, "Email"))} />
              <FieldError error={errors.email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-phone">Phone</Label>
              <Input id="sup-phone" {...limitInputProps(L.phone)}
                {...register("phone", limitRules<SupplierDto, "phone">(L.phone, "Phone"))} />
              <FieldError error={errors.phone} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sup-contact">Contact person</Label>
              <Input id="sup-contact" {...limitInputProps(L.contactPerson)}
                {...register("contactPerson", limitRules<SupplierDto, "contactPerson">(L.contactPerson, "Contact person"))} />
              <FieldError error={errors.contactPerson} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-status">Status</Label>
              <Select id="sup-status" {...register("status")}>
                {SUPPLIER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
              <FieldError error={errors.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sup-tax">Tax ID</Label>
              <Input id="sup-tax" className="data-mono" {...limitInputProps(L.taxId)}
                {...register("taxId", limitRules<SupplierDto, "taxId">(L.taxId, "Tax ID"))} />
              <FieldError error={errors.taxId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-reg">Registration number</Label>
              <Input id="sup-reg" className="data-mono" {...limitInputProps(L.registrationNumber)}
                {...register("registrationNumber", limitRules<SupplierDto, "registrationNumber">(L.registrationNumber, "Registration number"))} />
              <FieldError error={errors.registrationNumber} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sup-address">Address</Label>
            <Textarea id="sup-address" {...register("address")} />
            <FieldError error={errors.address} />
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={save.isPending}>
              {editing ? "Save changes" : "Create supplier"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
