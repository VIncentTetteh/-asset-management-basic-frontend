"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Wallet, Receipt, History, Search, ListTree } from "lucide-react";
import type { Budget, BudgetDto, Expense, AuditEvent } from "@/types";
import { budgetService } from "@/services/budgetService";
import { departmentService } from "@/services/departmentService";
import { auditEventService } from "@/services/auditEventService";
import { qk } from "@/lib/queryClient";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { EmptyState } from "@/components/patterns/EmptyState";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSpinner } from "@/components/ui/spinner";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";

function UtilisationBar({ budget }: { budget: Budget }) {
  const total = budget.totalAmount || 0;
  const spent = budget.spentAmount || 0;
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const threshold = budget.alertThresholdPct || 80;
  const color =
    spent > total ? "var(--danger)" : pct >= threshold ? "var(--warning)" : "var(--primary)";
  return (
    <div className="min-w-32">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="data-mono text-muted-fg">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const budgetsKey = qk.module("budgets");
  const { confirm, ConfirmDialog } = useConfirm();

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: budgetsKey.list(),
    queryFn: () => budgetService.getAll(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: qk.module("departments").list(),
    queryFn: () => departmentService.getAll(),
    staleTime: 300_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: budgetsKey.all });

  const saveBudget = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<BudgetDto> }) =>
      id ? budgetService.update(id, data) : budgetService.create(data as BudgetDto),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Budget updated" : "Budget created");
      invalidate();
    },
    onError: () => toast.error("Failed to save budget"),
  });
  const deleteBudget = useMutation({
    mutationFn: (id: string) => budgetService.delete(id),
    onSuccess: () => {
      toast.success("Budget deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete budget"),
  });
  const recordAdjustment = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note: string }) =>
      budgetService.recordAdjustment(id, { amount, note }),
    onSuccess: () => {
      toast.success("Adjustment recorded");
      invalidate();
    },
    onError: () => toast.error("Failed to record adjustment"),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [adjusting, setAdjusting] = useState<Budget | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  // Drill-down + history
  const [drillBudget, setDrillBudget] = useState<Budget | null>(null);
  const [historyBudget, setHistoryBudget] = useState<Budget | null>(null);

  const { data: drillExpenses = [], isLoading: drillLoading } = useQuery({
    queryKey: [...budgetsKey.all, "expenses", drillBudget?.id],
    queryFn: async () => (await budgetService.getExpenses(drillBudget!.id)).items as Expense[],
    enabled: !!drillBudget,
  });
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: [...budgetsKey.all, "history", historyBudget?.id],
    queryFn: () =>
      auditEventService.getAll({ path: `/budgets/${historyBudget!.id}/spend`, success: true }) as Promise<AuditEvent[]>,
    enabled: !!historyBudget,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BudgetDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            name: editing.name,
            status: editing.status,
            totalAmount: editing.totalAmount,
            currency: editing.currency || "GHS",
            fiscalYear: editing.fiscalYear || undefined,
            departmentId: editing.departmentId || "",
            periodStart: editing.periodStart || "",
            periodEnd: editing.periodEnd || "",
          }
        : { name: "", status: "ACTIVE", totalAmount: 0, currency: "GHS" },
    );
  }, [isModalOpen, editing, reset]);

  const deptName = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.name]));
    return (id?: string | null) => (id ? map.get(id) ?? "—" : "Organisation-wide");
  }, [departments]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return budgets;
    const q = searchTerm.toLowerCase();
    return budgets.filter(
      (b) => b.name.toLowerCase().includes(q) || deptName(b.departmentId).toLowerCase().includes(q),
    );
  }, [budgets, searchTerm, deptName]);

  const totals = useMemo(
    () => ({
      allocated: budgets.reduce((s, b) => s + (b.totalAmount || 0), 0),
      spent: budgets.reduce((s, b) => s + (b.spentAmount || 0), 0),
      remaining: budgets.reduce((s, b) => s + (b.remainingAmount || 0), 0),
    }),
    [budgets],
  );

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (budget: Budget) => {
    if (!(await confirm({ message: `Delete budget "${budget.name}"?`, variant: "danger" }))) return;
    deleteBudget.mutate(budget.id);
  };

  const handleAdjust = async () => {
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) return void toast.error("Enter a valid amount");
    if (!adjustNote.trim()) return void toast.error("Note is required");
    if (!adjusting) return;
    await recordAdjustment.mutateAsync({ id: adjusting.id, amount, note: adjustNote.trim() });
    setAdjusting(null);
    setAdjustAmount("");
    setAdjustNote("");
  };

  const onSubmit = async (data: BudgetDto) => {
    const payload = { ...data, totalAmount: Number(data.totalAmount) };
    (Object.keys(payload) as (keyof BudgetDto)[]).forEach((k) => {
      if (payload[k] === "" || payload[k] === undefined) delete (payload as Partial<BudgetDto>)[k];
    });
    if (editing) {
      const patch = buildPatchPayload<BudgetDto>(editing as unknown as Partial<BudgetDto>, payload);
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await saveBudget.mutateAsync({ id: editing.id, data: patch });
    } else {
      await saveBudget.mutateAsync({ data: payload });
    }
    setIsModalOpen(false);
  };

  const columns = useMemo<ColumnDef<Budget, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Budget",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">{row.original.name}</p>
            <p className="truncate text-xs text-faint-fg">
              {deptName(row.original.departmentId)}
              {row.original.fiscalYear ? ` · FY${row.original.fiscalYear}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "utilisation",
        header: "Utilisation",
        enableSorting: false,
        cell: ({ row }) => <UtilisationBar budget={row.original} />,
      },
      {
        accessorKey: "spentAmount",
        header: () => <span className="block text-right">Spent / allocated</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {format(row.original.spentAmount, row.original.currency || "GHS")}{" "}
            <span className="text-faint-fg">/ {format(row.original.totalAmount, row.original.currency || "GHS")}</span>
          </span>
        ),
      },
      {
        accessorKey: "remainingAmount",
        header: () => <span className="block text-right">Remaining</span>,
        cell: ({ row }) => (
          <span
            className={`data-mono block text-right ${(row.original.remainingAmount || 0) < 0 ? "font-bold text-danger" : ""}`}
          >
            {format(row.original.remainingAmount, row.original.currency || "GHS")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status ?? "ACTIVE"}
            tone={row.original.status === "EXCEEDED" ? "flagged" : row.original.status === "CLOSED" ? "retired" : undefined}
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
              title="Record adjustment"
              aria-label="Record adjustment"
              onClick={() => setAdjusting(row.original)}
            >
              <Receipt className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Linked expenses"
              aria-label="View linked expenses"
              onClick={() => setDrillBudget(row.original)}
            >
              <ListTree className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Expenditure history"
              aria-label="View expenditure history"
              onClick={() => setHistoryBudget(row.original)}
            >
              <History className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit budget"
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
              aria-label="Delete budget"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deptName, format],
  );

  return (
    <ListPageTemplate
      title="Budgets"
      subtitle={
        isLoading
          ? "Loading budgets…"
          : `${budgets.length} budgets · ${format(totals.spent, "GHS")} of ${format(totals.allocated, "GHS")} spent`
      }
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New budget
        </Button>
      }
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input
            placeholder="Search budget or department…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No budgets yet"
        emptyDescription="Allocate spending envelopes per department or org-wide; approved expenses draw them down."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Wallet className="mr-1.5 h-4 w-4" /> New budget
          </Button>
        }
        footerSummary={
          <span>
            Remaining · <span className="data-mono">{format(totals.remaining, "GHS")}</span>
          </span>
        }
      />

      {/* Create/edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit budget" : "New budget"}
        description="A spending envelope tracked against approved expenses and adjustments."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="bd-name">Name <span className="text-danger">*</span></Label>
            <Input id="bd-name" placeholder="IT hardware FY2026" {...register("name", { required: "Name is required" })} />
            {errors.name && <p className="text-sm text-danger">{errors.name.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bd-amount">Allocated amount <span className="text-danger">*</span></Label>
              <Input id="bd-amount" type="number" step="0.01" min="0" {...register("totalAmount", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bd-currency">Currency</Label>
              <Select id="bd-currency" {...register("currency")}>
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bd-dept">Department</Label>
              <Select id="bd-dept" {...register("departmentId")}>
                <option value="">Organisation-wide</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bd-fy">Fiscal year</Label>
              <Input id="bd-fy" type="number" min="2000" max="2100" placeholder="2026" {...register("fiscalYear")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bd-start">Period start</Label>
              <Input id="bd-start" type="date" {...register("periodStart")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bd-end">Period end</Label>
              <Input id="bd-end" type="date" {...register("periodEnd")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bd-status">Status</Label>
            <Select id="bd-status" {...register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="EXCEEDED">Exceeded</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={saveBudget.isPending}>
              {editing ? "Save changes" : "Create budget"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Adjustment */}
      <Modal
        isOpen={adjusting !== null}
        onClose={() => setAdjusting(null)}
        title="Record adjustment"
        description={adjusting ? `Draw down "${adjusting.name}" outside the expense workflow (with a note for the audit trail).` : ""}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bd-adj-amount">Amount <span className="text-danger">*</span></Label>
            <Input
              id="bd-adj-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bd-adj-note">Note <span className="text-danger">*</span></Label>
            <Textarea
              id="bd-adj-note"
              placeholder="e.g. Invoice #4512 settled outside expense workflow"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdjusting(null)}>Cancel</Button>
            <Button onClick={handleAdjust} isLoading={recordAdjustment.isPending}>Record adjustment</Button>
          </div>
        </div>
      </Modal>

      {/* Drill-down: linked expenses */}
      <Modal
        isOpen={drillBudget !== null}
        onClose={() => setDrillBudget(null)}
        title={drillBudget ? `Expenses — ${drillBudget.name}` : "Expenses"}
        description="Approved and pending expenses linked to this budget."
      >
        {drillLoading ? (
          <PageSpinner label="Loading expenses…" />
        ) : drillExpenses.length === 0 ? (
          <EmptyState title="No linked expenses" description="Expenses linked to this budget will appear here." />
        ) : (
          <div className="max-h-[50vh] divide-y divide-edge-subtle overflow-y-auto">
            {drillExpenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                  <p className="text-xs text-faint-fg">
                    {e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : "—"}
                    {e.submittedByName ? ` · ${e.submittedByName}` : ""}
                  </p>
                </div>
                <span className="data-mono text-sm">{format(e.amount, e.currency || "GHS")}</span>
                <StatusBadge status={e.status ?? "DRAFT"} />
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* History */}
      <Modal
        isOpen={historyBudget !== null}
        onClose={() => setHistoryBudget(null)}
        title={historyBudget ? `Expenditure history — ${historyBudget.name}` : "History"}
        description="Successful spend/adjustment calls from the audit log."
      >
        {historyLoading ? (
          <PageSpinner label="Loading history…" />
        ) : history.length === 0 ? (
          <EmptyState title="No recorded expenditure events" description="Adjustments recorded against this budget will appear here." />
        ) : (
          <div className="max-h-[50vh] divide-y divide-edge-subtle overflow-y-auto">
            {history.map((event) => (
              <div key={event.id} className="py-2.5">
                <p className="text-sm text-foreground">{event.actorEmail || "System"}</p>
                <p className="text-xs text-faint-fg">
                  {event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
