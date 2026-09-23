"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Wallet, Receipt, History, Search, ListTree } from "lucide-react";
import { BUDGET_STATUSES, type Budget, type BudgetLedgerKind, type Expense } from "@/types";
import { budgetService } from "@/services/budgetService";
import { departmentService } from "@/services/departmentService";
import { reportApiError, reportFormErrors } from "@/lib/api-validation";
import { buildBudgetPayload, budgetAvailable, budgetCurrencyLocked, ledgerSourceLink, type BudgetForm } from "@/features/finance/payloads";
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
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";
import { MissingRatesNotice } from "@/components/currency/MissingRatesNotice";
import { MoneyTotalValue, moneyTotalText } from "@/components/currency/MoneyTotalValue";
import { formatLocalDate } from "@/lib/local-date";
import Link from "next/link";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";

const L = FIELD_LIMITS.budget;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft (not open for spend)",
  ACTIVE: "Active",
  EXCEEDED: "Exceeded (set automatically)",
  CLOSED: "Closed",
};

const LEDGER_LABELS: Record<BudgetLedgerKind, string> = {
  ADJUSTMENT: "Adjustment",
  PO_COMMIT: "PO approved — committed",
  PO_RELEASE: "PO cancelled — commitment released",
  PO_SPEND: "PO received — spent",
  PO_SPEND_REVERSAL: "PO deleted — spend reversed",
  EXPENSE_COMMIT: "Expense submitted — committed",
  EXPENSE_RELEASE: "Expense rejected/deleted — released",
  EXPENSE_SPEND: "Expense approved — spent",
  EXPENSE_SPEND_REVERSAL: "Expense deleted — spend reversed",
};

/** Spent (solid) and committed (lighter) against the allocation. */
function UtilisationBar({ budget }: { budget: Budget }) {
  const total = budget.totalAmount || 0;
  const spent = budget.spentAmount || 0;
  const committed = budget.committedAmount || 0;
  const spentPct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const committedPct = total > 0 ? Math.min((committed / total) * 100, 100 - spentPct) : 0;
  const usedPct = total > 0 ? ((spent + committed) / total) * 100 : 0;
  const threshold = budget.alertThresholdPct || 80;
  const color =
    spent > total ? "var(--danger)" : spentPct >= threshold ? "var(--warning)" : "var(--primary)";
  return (
    <div className="min-w-32" title={`${spentPct.toFixed(0)}% spent, ${committedPct.toFixed(0)}% committed`}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="data-mono text-muted-fg">{usedPct.toFixed(0)}%</span>
        {committed > 0 ? <span className="text-faint-fg">incl. committed</span> : null}
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full" style={{ width: `${spentPct}%`, background: color }} />
        <div className="h-full opacity-40" style={{ width: `${committedPct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const { format, baseCurrency, sum } = useCurrency();
  const queryClient = useQueryClient();
  const budgetsKey = qk.module("budgets");
  const { confirm, ConfirmDialog } = useConfirm();

  const { data: budgets = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: budgetsKey.list(),
    queryFn: () => budgetService.getAll(),
  });
  // Server totals are converted into the base currency and flag budgets
  // without an exchange rate; they are preferred over any client-side sum.
  const { data: summary } = useQuery({
    queryKey: [...budgetsKey.all, "summary"],
    queryFn: () => budgetService.getSummary(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: qk.module("departments").list(),
    queryFn: () => departmentService.getAll(),
    staleTime: 300_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: budgetsKey.all });

  // Edits are a full PUT: spent/committed are never sent (the ledger owns them),
  // so a replace cannot disturb them, and emptied fields really clear.
  const saveBudget = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: ReturnType<typeof buildBudgetPayload> }) =>
      id ? budgetService.replace(id, data) : budgetService.create(data),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Budget updated" : "Budget created");
      invalidate();
    },
  });
  const deleteBudget = useMutation({
    mutationFn: (id: string) => budgetService.delete(id),
    onSuccess: () => {
      toast.success("Budget deleted");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to delete budget" }),
  });
  const recordAdjustment = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note: string }) =>
      budgetService.recordAdjustment(id, { amount, note }),
    onSuccess: () => {
      toast.success("Adjustment recorded");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to record adjustment" }),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const currencyLocked = budgetCurrencyLocked(editing);
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
    queryKey: [...budgetsKey.all, "ledger", historyBudget?.id],
    queryFn: () => budgetService.getLedger(historyBudget!.id),
    enabled: !!historyBudget,
  });

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<BudgetForm>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            name: editing.name,
            description: editing.description || "",
            status: editing.status,
            totalAmount: editing.totalAmount,
            currency: editing.currency || baseCurrency,
            fiscalYear: editing.fiscalYear || undefined,
            departmentId: editing.departmentId || "",
            periodStart: editing.periodStart || "",
            periodEnd: editing.periodEnd || "",
            alertThresholdPct: editing.alertThresholdPct ?? 80,
          }
        : {
            name: "",
            status: "ACTIVE",
            totalAmount: 0,
            currency: baseCurrency,
            departmentId: "",
            periodStart: "",
            periodEnd: "",
            alertThresholdPct: 80,
          },
    );
  }, [isModalOpen, editing, reset, baseCurrency]);

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

  // Fallback only (summary unavailable): each budget is converted into the
  // display currency; budgets without a rate are excluded and flagged.
  const clientTotals = useMemo(
    () => ({
      allocated: sum(budgets.map((b) => ({ amount: b.totalAmount, currency: b.currency }))),
      spent: sum(budgets.map((b) => ({ amount: b.spentAmount, currency: b.currency }))),
      available: sum(budgets.map((b) => ({ amount: budgetAvailable(b), currency: b.currency }))),
    }),
    [budgets, sum],
  );
  const totalsSubtitle = summary
    ? `${format(summary.totalSpent, summary.currency)} of ${format(summary.totalAllocated, summary.currency)} spent${summary.complete === false ? " (partial)" : ""}`
    : `${moneyTotalText(clientTotals.spent)} of ${moneyTotalText(clientTotals.allocated)} spent`;
  const totalsIncomplete = summary ? summary.complete === false : !clientTotals.allocated.complete;
  const totalsMissingRates = summary
    ? summary.missingRates ?? []
    : Array.from(new Set([...clientTotals.allocated.missingRates, ...clientTotals.spent.missingRates]));

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
    try {
      await recordAdjustment.mutateAsync({ id: adjusting.id, amount, note: adjustNote.trim() });
    } catch {
      return; // reported by the mutation
    }
    setAdjusting(null);
    setAdjustAmount("");
    setAdjustNote("");
  };

  const onSubmit = async (data: BudgetForm) => {
    const payload = buildBudgetPayload(data);
    try {
      await saveBudget.mutateAsync({ id: editing?.id, data: payload });
      setIsModalOpen(false);
    } catch (err) {
      reportApiError(err, { fallback: "Failed to save budget", setError });
    }
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
            <p className="truncate text-xs text-faint-fg">
              {formatLocalDate(row.original.periodStart)} – {formatLocalDate(row.original.periodEnd)}
            </p>
            {row.original.description ? (
              <p className="truncate text-xs text-muted-fg" title={row.original.description}>{row.original.description}</p>
            ) : null}
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
            {format(row.original.spentAmount, row.original.currency || baseCurrency)}{" "}
            <span className="text-faint-fg">/ {format(row.original.totalAmount, row.original.currency || baseCurrency)}</span>
          </span>
        ),
      },
      {
        accessorKey: "forecastedSpend",
        header: () => <span className="block text-right" title="Spend so far projected over the whole period">Forecast</span>,
        cell: ({ row }) => {
          const forecast = row.original.forecastedSpend;
          if (forecast == null) return <span className="block text-right text-faint-fg">—</span>;
          const over = forecast > (row.original.totalAmount || 0);
          return (
            <span className={`data-mono block text-right ${over ? "text-warn" : "text-muted-fg"}`}
              title={over ? "On current pace the budget will be overspent" : undefined}>
              {format(forecast, row.original.currency || baseCurrency)}
            </span>
          );
        },
      },
      {
        accessorKey: "committedAmount",
        header: () => <span className="block text-right">Committed</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right text-muted-fg">
            {format(row.original.committedAmount || 0, row.original.currency || baseCurrency)}
          </span>
        ),
      },
      {
        id: "available",
        accessorFn: (b) => budgetAvailable(b),
        header: () => <span className="block text-right">Available</span>,
        cell: ({ row }) => {
          const available = budgetAvailable(row.original);
          return (
            <span className={`data-mono block text-right ${available < 0 ? "font-bold text-danger" : ""}`}>
              {format(available, row.original.currency || baseCurrency)}
            </span>
          );
        },
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
              title="Budget ledger"
              aria-label="View budget ledger"
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
    [deptName, format, baseCurrency],
  );

  return (
    <ListPageTemplate
      title="Budgets"
      subtitle={
        isLoading
          ? "Loading budgets…"
          : `${budgets.length} budgets · ${totalsSubtitle}`
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
      <MissingRatesNotice incomplete={totalsIncomplete} missingRates={totalsMissingRates} />

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        isRetrying={isFetching}
        errorWhat="your budgets"
        emptyTitle="No budgets yet"
        emptyDescription="Allocate spending envelopes per department or org-wide; approved expenses draw them down."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Wallet className="mr-1.5 h-4 w-4" /> New budget
          </Button>
        }
        footerSummary={
          summary ? (
            <span>
              Available after commitments ·{" "}
              <span className="data-mono">{format(summary.totalAvailable, summary.currency)}</span>
            </span>
          ) : (
            <span>
              Available after commitments · <MoneyTotalValue total={clientTotals.available} />
            </span>
          )
        }
      />

      {/* Create/edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit budget" : "New budget"}
        description="A spending envelope. Approved purchase orders and submitted expenses commit against it; receipts, approvals and adjustments spend it."
      >
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="bd-name">Name <span className="text-danger">*</span></Label>
            <Input id="bd-name" placeholder="IT hardware FY2026" {...limitInputProps(L.name)}
              {...register("name", limitRules<BudgetForm, "name">(L.name, "Name"))} />
            <FieldError error={errors.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bd-description">Description</Label>
            <Textarea id="bd-description" rows={2} placeholder="What this envelope covers" {...register("description")} />
            <FieldError error={errors.description} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bd-amount">Allocated amount <span className="text-danger">*</span></Label>
              <Input
                id="bd-amount"
                type="number"
                {...limitInputProps(L.totalAmount)}
                {...register("totalAmount", limitRules<BudgetForm, "totalAmount">(L.totalAmount, "Allocated amount"))}
              />
              <FieldError error={errors.totalAmount} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bd-currency">Currency</Label>
              <Select
                id="bd-currency"
                disabled={currencyLocked}
                title={currencyLocked ? "Locked: spend or commitments are recorded in this currency" : undefined}
                {...register("currency")}
              >
                <CurrencyOptions current={editing?.currency} />
              </Select>
              {currencyLocked ? (
                <p className="text-xs text-muted-fg">
                  Locked: this budget already has spend or commitments in {editing?.currency}.
                </p>
              ) : null}
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
              <Label htmlFor="bd-start">Period start <span className="text-danger">*</span></Label>
              <Input id="bd-start" type="date" {...register("periodStart", limitRules<BudgetForm, "periodStart">(L.periodStart, "Period start"))} />
              <FieldError error={errors.periodStart} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bd-end">Period end <span className="text-danger">*</span></Label>
              <Input
                id="bd-end"
                type="date"
                {...register("periodEnd", {
                  ...limitRules<BudgetForm, "periodEnd">(L.periodEnd, "Period end"),
                  validate: (end, form) =>
                    !end || !form.periodStart || String(end) >= String(form.periodStart) || "Must be on or after the start",
                })}
              />
              <FieldError error={errors.periodEnd} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bd-status">Status</Label>
              <Select id="bd-status" {...register("status")}>
                {BUDGET_STATUSES.map((s) => (
                  // EXCEEDED follows the figures; it can be kept but not chosen.
                  <option key={s} value={s} disabled={s === "EXCEEDED" && editing?.status !== "EXCEEDED"}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bd-threshold">Alert at % spent</Label>
              <Input
                id="bd-threshold"
                type="number"
                {...limitInputProps(L.alertThresholdPct)}
                {...register("alertThresholdPct", limitRules<BudgetForm, "alertThresholdPct">(L.alertThresholdPct, "Alert threshold"))}
              />
              <FieldError error={errors.alertThresholdPct} />
            </div>
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
                    {formatLocalDate(e.expenseDate)}
                    {e.submittedByName ? ` · ${e.submittedByName}` : ""}
                  </p>
                </div>
                <span className="data-mono text-sm">{format(e.amount, e.currency || baseCurrency)}</span>
                <StatusBadge status={e.status ?? "DRAFT"} />
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Ledger */}
      <Modal
        isOpen={historyBudget !== null}
        onClose={() => setHistoryBudget(null)}
        title={historyBudget ? `Budget ledger — ${historyBudget.name}` : "Budget ledger"}
        description="Every commitment, spend, release and adjustment, oldest first. Movements made before the ledger existed are not itemised."
      >
        {historyLoading ? (
          <PageSpinner label="Loading ledger…" />
        ) : history.length === 0 ? (
          <EmptyState title="No ledger entries yet" description="Adjustments, purchase orders and expenses against this budget will appear here." />
        ) : (
          <div className="max-h-[50vh] divide-y divide-edge-subtle overflow-y-auto">
            {history.map((entry) => {
              const delta = entry.spentDelta !== 0 ? entry.spentDelta : entry.committedDelta;
              return (
                <div key={entry.id} className="flex items-start gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{LEDGER_LABELS[entry.kind] ?? entry.kind}</p>
                    <p className="truncate text-xs text-faint-fg">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
                      {entry.actorEmail ? ` · ${entry.actorEmail}` : ""}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                    {(() => {
                      const source = ledgerSourceLink(entry);
                      return source ? (
                        <Link href={source.href} className="text-xs text-brand underline-offset-2 hover:underline">
                          {source.label}
                        </Link>
                      ) : null;
                    })()}
                  </div>
                  <div className="text-right">
                    <p className={`data-mono text-sm ${delta < 0 ? "text-ok" : ""}`}>
                      {delta < 0 ? "−" : "+"}
                      {format(entry.amount, entry.currency || historyBudget?.currency || baseCurrency)}
                    </p>
                    <p className="data-mono text-xs text-faint-fg">
                      spent {format(entry.spentAfter, entry.currency || baseCurrency)} · committed{" "}
                      {format(entry.committedAfter, entry.currency || baseCurrency)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
