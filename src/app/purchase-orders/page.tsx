"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ShoppingCart, ThumbsUp, XCircle, Download } from "lucide-react";
import { PurchaseOrder, PurchaseOrderDto, POStatus } from "@/types";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { supplierService } from "@/services/supplierService";
import { departmentService } from "@/services/departmentService";
import { bulkOperationService } from "@/services/bulkOperationService";
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
import { buildPatchPayload } from "@/lib/patch";
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";

/** Backend may return legacy status names; fold them into the current enum. */
const normalizePoStatus = (status?: string): string | undefined => {
  if (!status) return undefined;
  if (status === "PENDING") return POStatus.SUBMITTED;
  if (status === "RECEIVED" || status === "ORDERED") return POStatus.DELIVERED;
  return status;
};

export default function PurchaseOrdersPage() {
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const ordersKey = qk.module("purchase-orders");
  const { confirm, ConfirmDialog } = useConfirm();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ordersKey.list(),
    queryFn: () => purchaseOrderService.getAll(),
  });
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ordersKey.all });

  const workflowAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" | "delete" }) => {
      if (action === "approve") await purchaseOrderService.approve(id);
      else if (action === "reject") await purchaseOrderService.reject(id);
      else await purchaseOrderService.delete(id);
    },
    onSuccess: (_res, vars) => {
      const messages = { approve: "Purchase order approved", reject: "Purchase order rejected", delete: "Purchase order deleted" } as const;
      toast.success(messages[vars.action]);
      invalidate();
    },
    onError: (_err, vars) => toast.error(`Failed to ${vars.action} purchase order`),
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { register, handleSubmit, reset } = useForm<PurchaseOrderDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            poNumber: editing.poNumber,
            totalAmount: editing.totalAmount,
            currency: editing.currency || "GHS",
            status: (normalizePoStatus(editing.status) || POStatus.DRAFT) as POStatus,
            supplierId: editing.supplierId || "",
            departmentId: editing.departmentId || "",
            remarks: editing.remarks || "",
          }
        : {
            poNumber: "",
            totalAmount: 0,
            currency: "GHS",
            status: POStatus.DRAFT,
            remarks: "",
            supplierId: "",
            departmentId: "",
          },
    );
  }, [isModalOpen, editing, reset]);

  const lookups = useMemo(() => {
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));
    return {
      supplierName: (id?: string) => supplierMap.get(id ?? "") ?? "—",
      deptName: (id?: string) => deptMap.get(id ?? "") ?? "—",
    };
  }, [suppliers, departments]);

  const handleExport = async (fmt: "CSV" | "EXCEL") => {
    setIsExporting(true);
    try {
      const filename = await bulkOperationService.exportPurchaseOrders({ format: fmt });
      toast.success(`Downloaded ${filename}`);
    } catch {
      toast.error("Failed to download export");
    } finally {
      setIsExporting(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (order: PurchaseOrder) => {
    if (!(await confirm({ message: `Delete PO ${order.poNumber}?`, variant: "danger" }))) return;
    workflowAction.mutate({ id: order.id!, action: "delete" });
  };

  const onSubmit = async (data: PurchaseOrderDto) => {
    const poNumber = data.poNumber?.trim();
    const totalAmount = Number(data.totalAmount);
    if (!poNumber) return void toast.error("PO number is required");
    if (!data.supplierId) return void toast.error("Supplier is required");
    if (!data.departmentId) return void toast.error("Department is required");
    if (!Number.isFinite(totalAmount) || totalAmount <= 0)
      return void toast.error("Total amount must be greater than 0");

    setIsSaving(true);
    try {
      const payload: Partial<PurchaseOrderDto> = { ...data, poNumber, totalAmount, status: normalizePoStatus(data.status) as POStatus };
      const mandatoryKeys: Array<keyof PurchaseOrderDto> = ["departmentId", "supplierId", "poNumber"];
      (Object.keys(payload) as (keyof PurchaseOrderDto)[]).forEach((k) => {
        if (payload[k] === "" && !mandatoryKeys.includes(k)) delete payload[k];
      });

      if (editing) {
        const currentStatus = normalizePoStatus(editing.status);
        const desiredStatus = normalizePoStatus(payload.status);
        const organisationId = editing.organisationId || getOrganisationIdFromStorage();
        if (!organisationId) return void toast.error("Organisation ID is required");

        const updatePayload: PurchaseOrderDto = {
          poNumber,
          totalAmount,
          currency: payload.currency,
          status: desiredStatus as POStatus,
          remarks: payload.remarks,
          supplierId: data.supplierId,
          departmentId: data.departmentId,
          organisationId,
        };

        const patch = buildPatchPayload<PurchaseOrderDto>(editing as unknown as Partial<PurchaseOrderDto>, updatePayload);
        if (Object.keys(patch).length === 0) {
          toast("No changes to update");
          return;
        }

        const updated = await purchaseOrderService.update(editing.id!, patch);
        let finalStatus = normalizePoStatus(updated.status);

        // Direct status edits may be ignored — go through workflow endpoints.
        if (desiredStatus && desiredStatus !== currentStatus && finalStatus !== desiredStatus) {
          if (desiredStatus === POStatus.APPROVED) {
            const approved = await purchaseOrderService.approve(editing.id!);
            finalStatus = normalizePoStatus(approved.status);
          } else if (desiredStatus === POStatus.REJECTED) {
            const rejected = await purchaseOrderService.reject(editing.id!);
            finalStatus = normalizePoStatus(rejected.status);
          } else {
            toast.error(`Status change to ${desiredStatus} was not applied by the backend workflow`);
          }
        }

        if (desiredStatus && finalStatus !== desiredStatus) {
          toast.error("Purchase order updated, but status did not change");
        } else {
          toast.success("Purchase order updated");
        }
      } else {
        const organisationId = getOrganisationIdFromStorage();
        if (!organisationId) return void toast.error("Organisation ID is required");
        await purchaseOrderService.create({ ...payload, organisationId } as PurchaseOrderDto);
        toast.success("Purchase order created");
      }
      setIsModalOpen(false);
      invalidate();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? "Failed to save purchase order");
    } finally {
      setIsSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<PurchaseOrder, unknown>[]>(
    () => [
      {
        accessorKey: "poNumber",
        header: "PO number",
        cell: ({ row }) => <span className="data-mono font-semibold text-foreground">{row.original.poNumber}</span>,
      },
      {
        id: "supplier",
        header: "Supplier",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{lookups.supplierName(row.original.supplierId)}</span>,
      },
      {
        id: "department",
        header: "Department",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{lookups.deptName(row.original.departmentId)}</span>,
      },
      {
        accessorKey: "totalAmount",
        header: () => <span className="block text-right">Amount</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {format(row.original.totalAmount, row.original.currency || "GHS")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={normalizePoStatus(row.original.status) ?? "DRAFT"} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const status = normalizePoStatus(row.original.status);
          return (
            <div className="flex justify-end gap-0.5">
              {status === POStatus.SUBMITTED && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-ok"
                    title="Approve"
                    aria-label="Approve purchase order"
                    onClick={() => workflowAction.mutate({ id: row.original.id!, action: "approve" })}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-warn"
                    title="Reject"
                    aria-label="Reject purchase order"
                    onClick={() => workflowAction.mutate({ id: row.original.id!, action: "reject" })}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Edit purchase order"
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
                aria-label="Delete purchase order"
                onClick={() => handleDelete(row.original)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookups, format],
  );

  const pendingCount = orders.filter((o) => normalizePoStatus(o.status) === POStatus.SUBMITTED).length;
  const totalValue = useMemo(() => orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0), [orders]);

  return (
    <ListPageTemplate
      title="Purchase orders"
      subtitle={isLoading ? "Loading orders…" : `${orders.length} orders · ${pendingCount} awaiting approval`}
      actions={
        <>
          <Button variant="outline" onClick={() => handleExport("EXCEL")} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New order
          </Button>
        </>
      }
    >
      <DataTable
        columns={columns}
        data={orders}
        isLoading={isLoading}
        emptyTitle="No purchase orders"
        emptyDescription="Raise procurement orders against suppliers with an approval workflow."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <ShoppingCart className="mr-1.5 h-4 w-4" /> New order
          </Button>
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
        title={editing ? "Edit purchase order" : "New purchase order"}
        description="Approve or reject submitted orders from the row actions."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po-number">PO number <span className="text-danger">*</span></Label>
              <Input id="po-number" className="data-mono" placeholder="PO-2026-001" {...register("poNumber", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-status">Status</Label>
              <Select id="po-status" {...register("status")}>
                {Object.values(POStatus).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po-supplier">Supplier <span className="text-danger">*</span></Label>
              <Select id="po-supplier" {...register("supplierId", { required: true })}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-dept">Department <span className="text-danger">*</span></Label>
              <Select id="po-dept" {...register("departmentId", { required: true })}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po-amount">Total amount <span className="text-danger">*</span></Label>
              <Input id="po-amount" type="number" step="0.01" min="0" {...register("totalAmount", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-currency">Currency</Label>
              <Select id="po-currency" {...register("currency")}>
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="po-remarks">Remarks</Label>
            <Textarea id="po-remarks" placeholder="Line items, delivery expectations…" {...register("remarks")} />
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>
              {editing ? "Save changes" : "Create order"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
