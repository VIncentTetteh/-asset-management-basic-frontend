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
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";

const suppliers = makeCrudHooks<Supplier, SupplierDto>("suppliers", supplierService, { entity: "Supplier" });

export default function SuppliersPage() {
  const { data: rows = [], isLoading } = suppliers.useList();
  const save = suppliers.useSave();
  const remove = suppliers.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierDto>();

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
            bankDetails: editing.bankDetails || "",
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
            bankDetails: "",
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
    const name = data.name.trim();
    if (!name) {
      toast.error("Company name is required");
      return;
    }
    const payload: SupplierDto = { ...data, name };
    (Object.keys(payload) as (keyof SupplierDto)[]).forEach((k) => {
      if (payload[k] === "") delete (payload as unknown as Record<string, unknown>)[k];
    });

    if (editing) {
      const patch = buildPatchPayload<SupplierDto>(editing as unknown as Partial<SupplierDto>, payload);
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await save.mutateAsync({ id: editing.id!, data: patch as SupplierDto });
    } else {
      await save.mutateAsync({ data: payload });
    }
    setIsModalOpen(false);
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
            <Input id="sup-name" placeholder="Acme Supplies Ltd" {...register("name", { required: "Name is required" })} />
            {errors.name && <p className="text-sm text-danger">{errors.name.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sup-email">Email</Label>
              <Input id="sup-email" type="email" {...register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-phone">Phone</Label>
              <Input id="sup-phone" {...register("phone")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sup-contact">Contact person</Label>
              <Input id="sup-contact" {...register("contactPerson")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-status">Status</Label>
              <Select id="sup-status" {...register("status")}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="BLACKLISTED">Blacklisted</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sup-tax">Tax ID</Label>
              <Input id="sup-tax" className="data-mono" {...register("taxId")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-reg">Registration number</Label>
              <Input id="sup-reg" className="data-mono" {...register("registrationNumber")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sup-address">Address</Label>
            <Textarea id="sup-address" {...register("address")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sup-bank">Bank details</Label>
            <Textarea id="sup-bank" placeholder="Bank, account name, account number…" {...register("bankDetails")} />
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
