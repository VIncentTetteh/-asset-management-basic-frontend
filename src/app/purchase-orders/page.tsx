"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ShoppingCart, ThumbsUp, XCircle, Download, Send, PackageCheck, Ban } from "lucide-react";
import { PurchaseOrder, POStatus } from "@/types";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { budgetService } from "@/services/budgetService";
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
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { reportApiError } from "@/lib/api-validation";
import { buildPurchaseOrderPayload, budgetAvailable, type PurchaseOrderForm } from "@/features/finance/payloads";
import { PO_ACTION_MESSAGES, poActionsFor, type PoWorkflowAction as WorkflowAction } from "@/features/finance/purchaseOrderWorkflow";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";
import { MissingRatesNotice } from "@/components/currency/MissingRatesNotice";
import { MoneyTotalValue } from "@/components/currency/MoneyTotalValue";

/** Backend may return legacy status names; fold them into the current enum. */
const normalizePoStatus = (status?: string): string | undefined => {
  if (!status) return undefined;
  if (status === "PENDING") return POStatus.SUBMITTED;
  if (status === "RECEIVED" || status === "ORDERED") return POStatus.DELIVERED;
  return status;
};

export default function PurchaseOrdersPage() {
  const { format, baseCurrency, sum } = useCurrency();
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

  const { data: budgets = [] } = useQuery({
    queryKey: qk.module("budgets").list(),
    queryFn: () => budgetService.getAll(),
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ordersKey.all });
    // Approve/receive/cancel/delete move budget commitments and spend.
    queryClient.invalidateQueries({ queryKey: qk.module("budgets").all });
  };

  const workflowAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: WorkflowAction }) => {
      const run: Record<WorkflowAction, (poId: string) => Promise<unknown>> = {
        submit: purchaseOrderService.submit,
        approve: purchaseOrderService.approve,
        reject: purchaseOrderService.reject,
        receive: purchaseOrderService.receive,
        cancel: purchaseOrderService.cancel,
        delete: purchaseOrderService.delete,
      };
      await run[action](id);
    },
    onSuccess: (_res, vars) => {
      toast.success(PO_ACTION_MESSAGES[vars.action]);
      invalidate();
    },
    // Surfaces the server's reason, e.g. "Insufficient funds in budget …" (409).
    onError: (err, vars) => reportApiError(err, { fallback: `Failed to ${vars.action} purchase order` }),
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { register, handleSubmit, reset, setError, watch, formState: { errors } } = useForm<PurchaseOrderForm>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            poNumber: editing.poNumber,
            totalAmount: editing.totalAmount,
            currency: editing.currency || baseCurrency,
            supplierId: editing.supplierId || "",
            departmentId: editing.departmentId || "",
            linkedBudgetId: editing.linkedBudgetId || "",
            remarks: editing.remarks || "",
          }
        : {
            poNumber: "",
            totalAmount: 0,
            currency: baseCurrency,
            remarks: "",
            supplierId: "",
            departmentId: "",
            linkedBudgetId: "",
          },
    );
  }, [isModalOpen, editing, reset, baseCurrency]);

  const lookups = useMemo(() => {
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));
    const budgetMap = new Map(budgets.map((b) => [b.id, b.name]));
    return {
      supplierName: (id?: string) => supplierMap.get(id ?? "") ?? "—",
      deptName: (id?: string) => deptMap.get(id ?? "") ?? "—",
      budgetName: (id?: string | null) => (id ? budgetMap.get(id) ?? "—" : "—"),
    };
  }, [suppliers, departments, budgets]);

  const watchedBudgetId = watch("linkedBudgetId");
  const watchedCurrency = watch("currency");
  const selectedBudget = budgets.find((b) => b.id === watchedBudgetId);
  const budgetCurrencyMismatch =
    !!selectedBudget?.currency && !!watchedCurrency && selectedBudget.currency !== watchedCurrency;

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

  const runAction = async (order: PurchaseOrder, action: WorkflowAction) => {
    const status = normalizePoStatus(order.status);
    const budgetEffect =
      order.linkedBudgetId && status === POStatus.APPROVED
        ? " Its budget commitment will be released."
        : order.linkedBudgetId && status === POStatus.DELIVERED
          ? " Its spend will be reversed on the budget."
          : "";
    if (action === "delete" || action === "cancel") {
      const verb = action === "delete" ? "Delete" : "Cancel";
      if (!(await confirm({ message: `${verb} PO ${order.poNumber}?${budgetEffect}`, variant: "danger" }))) return;
    }
    workflowAction.mutate({ id: order.id!, action });
  };

  const onSubmit = async (data: PurchaseOrderForm) => {
    const payload = buildPurchaseOrderPayload(data);
    if (budgetCurrencyMismatch) {
      setError("currency", { type: "budget", message: `Must match the budget's currency (${selectedBudget?.currency})` });
      return;
    }
    setIsSaving(true);
    try {
      const organisationId = editing?.organisationId || getOrganisationIdFromStorage();
      if (!organisationId) return void toast.error("Organisation ID is required");
      if (editing) {
        // Full replace (PUT) of a DRAFT: an emptied budget select unlinks the budget.
        await purchaseOrderService.replace(editing.id!, { ...payload, organisationId });
        toast.success("Purchase order updated");
      } else {
        await purchaseOrderService.create({ ...payload, organisationId });
        toast.success("Purchase order created as a draft — submit it for approval when ready");
      }
      setIsModalOpen(false);
      invalidate();
    } catch (error) {
      reportApiError(error, { fallback: "Failed to save purchase order", setError, labels: { linkedBudgetId: "Budget" } });
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
        id: "budget",
        header: "Budget",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{lookups.budgetName(row.original.linkedBudgetId)}</span>,
      },
      {
        accessorKey: "totalAmount",
        header: () => <span className="block text-right">Amount</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {format(row.original.totalAmount, row.original.currency || baseCurrency)}
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
          const status = normalizePoStatus(row.original.status) ?? POStatus.DRAFT;
          const allowed = poActionsFor(status);
          const busy = workflowAction.isPending;
          const button = (action: WorkflowAction, label: string, icon: ReactNode, className = "") =>
            allowed.includes(action) ? (
              <Button
                key={action}
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${className}`}
                title={label}
                aria-label={`${label} purchase order`}
                disabled={busy}
                onClick={() => runAction(row.original, action)}
              >
                {icon}
              </Button>
            ) : null;
          return (
            <div className="flex justify-end gap-0.5">
              {button("submit", "Submit for approval", <Send className="h-3.5 w-3.5" />, "text-brand")}
              {button("approve", "Approve", <ThumbsUp className="h-3.5 w-3.5" />, "text-ok")}
              {button("reject", "Reject", <XCircle className="h-3.5 w-3.5" />, "text-warn")}
              {button("receive", "Mark received", <PackageCheck className="h-3.5 w-3.5" />, "text-ok")}
              {status === POStatus.DRAFT && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Edit purchase order"
                  title="Edit (drafts only)"
                  onClick={() => {
                    setEditing(row.original);
                    setIsModalOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {button("cancel", "Cancel", <Ban className="h-3.5 w-3.5" />, "text-warn")}
              {button("delete", "Delete", <Trash2 className="h-3.5 w-3.5" />, "text-danger")}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookups, format, baseCurrency, workflowAction.isPending],
  );

  const pendingCount = orders.filter((o) => normalizePoStatus(o.status) === POStatus.SUBMITTED).length;
  // Each order is converted into the display currency; orders without a rate are excluded and flagged.
  const totalValue = useMemo(
    () => sum(orders.map((o) => ({ amount: o.totalAmount, currency: o.currency }))),
    [orders, sum],
  );

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
      <MissingRatesNotice incomplete={!totalValue.complete} missingRates={totalValue.missingRates} />

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
            Total value · <MoneyTotalValue total={totalValue} />
          </span>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit purchase order" : "New purchase order"}
        description="Orders start as drafts. Submit from the row actions; a different user approves, which commits the amount against the linked budget."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po-number">PO number <span className="text-danger">*</span></Label>
              <Input id="po-number" className="data-mono" placeholder="PO-2026-001" {...register("poNumber", { required: "PO number is required" })} />
              {errors.poNumber && <p className="text-sm text-danger">{errors.poNumber.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-budget">Budget</Label>
              <Select id="po-budget" {...register("linkedBudgetId")}>
                <option value="">No budget</option>
                {budgets
                  .filter((b) => b.status !== "CLOSED" || b.id === editing?.linkedBudgetId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.currency || baseCurrency})
                    </option>
                  ))}
              </Select>
              {selectedBudget ? (
                <p className="text-xs text-muted-fg">
                  Available ·{" "}
                  <span className="data-mono">{format(budgetAvailable(selectedBudget), selectedBudget.currency || baseCurrency)}</span>
                  {selectedBudget.status === "DRAFT" ? " · draft budgets cannot be committed against" : ""}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po-supplier">Supplier <span className="text-danger">*</span></Label>
              <Select id="po-supplier" {...register("supplierId", { required: "Supplier is required" })}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-dept">Department <span className="text-danger">*</span></Label>
              <Select id="po-dept" {...register("departmentId", { required: "Department is required" })}>
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
              <Input
                id="po-amount"
                type="number"
                step="0.01"
                min="0.01"
                {...register("totalAmount", {
                  required: "Total amount is required",
                  validate: (v) => Number(v) > 0 || "Must be greater than 0",
                })}
              />
              {errors.totalAmount && <p className="text-sm text-danger">{errors.totalAmount.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-currency">Currency</Label>
              <Select id="po-currency" {...register("currency")}>
                <CurrencyOptions current={editing?.currency} />
              </Select>
              {budgetCurrencyMismatch ? (
                <p className="text-sm text-danger">
                  The budget is in {selectedBudget?.currency}; the order must use the same currency.
                </p>
              ) : errors.currency ? (
                <p className="text-sm text-danger">{errors.currency.message as string}</p>
              ) : null}
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
