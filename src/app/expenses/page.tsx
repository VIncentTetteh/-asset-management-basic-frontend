"use client";

import { ExternalLink as SafeExternalLink } from "@/components/ui/external-link";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { reportApiError, reportFormErrors } from "@/lib/api-validation";
import {
  budgetAvailable,
  buildExpensePayload,
  EXPENSE_FILTER_STATUSES,
  expenseCurrencyFor,
  expenseFundsError,
} from "@/features/finance/payloads";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Receipt, ThumbsUp, XCircle, Search } from "lucide-react";
import type { Expense, ExpenseStatus } from "@/types";
import { expenseService, type ExpenseDto } from "@/services/expenseService";
import { assetService } from "@/services/assetService";
import { budgetService } from "@/services/budgetService";
import { departmentService } from "@/services/departmentService";
import { PageSpinner } from "@/components/ui/spinner";
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
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";
import { MissingRatesNotice } from "@/components/currency/MissingRatesNotice";
import { MoneyTotalValue } from "@/components/currency/MoneyTotalValue";
import { formatLocalDate, todayLocal } from "@/lib/local-date";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { AttachmentField, attachAfterCreate, useAttachmentField } from "@/components/ui/attachment-field";
import { FieldError } from "@/components/ui/field-error";

const CATEGORY_LABELS: Record<string, string> = {
  MAINTENANCE: "Maintenance",
  TRAVEL: "Travel",
  SUPPLIES: "Supplies",
  SOFTWARE: "Software",
  HARDWARE: "Hardware",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

type FormData = Omit<
  ExpenseDto,
  "id" | "organisationId" | "status" | "approvedAt" | "approvedById" | "submittedById" | "submittedByName"
>;

const fmtDate = (d?: string) =>
  formatLocalDate(d, { locale: "en-US", month: "short", day: "numeric", year: "numeric" });

const L = FIELD_LIMITS.expense;

export default function ExpensesPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<PageSpinner label="Loading expenses…" />}>
      <ExpensesContent />
    </Suspense>
  );
}

function ExpensesContent() {
  const { format, baseCurrency, sum } = useCurrency();
  // ?id=… (e.g. from a budget ledger entry) shows just that expense.
  const focusId = useSearchParams().get("id");
  const queryClient = useQueryClient();
  const expensesKey = qk.module("expenses");
  const { confirm, ConfirmDialog } = useConfirm();

  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "">("");
  const [page, setPage] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: paged, isLoading } = useQuery({
    queryKey: [...expensesKey.list(), activeTab, debouncedSearch, statusFilter, page],
    queryFn: async () => {
      if (activeTab === "pending") {
        const items = await expenseService.listPending();
        return { total: items.length, limit: 20, offset: 0, items: items as unknown as Expense[] };
      }
      return expenseService.getPaged({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        page,
        size: 20,
      });
    },
    placeholderData: (prev) => prev,
  });

  const { data: focused, isLoading: focusLoading } = useQuery({
    queryKey: [...expensesKey.all, "one", focusId],
    queryFn: () => expenseService.getById(focusId!),
    enabled: !!focusId,
  });
  const { data: departments = [] } = useQuery({
    queryKey: qk.module("departments").list(),
    queryFn: () => departmentService.getAll(),
    staleTime: 300_000,
  });
  const { data: assets = [] } = useQuery({
    queryKey: qk.module("assets-all").list(),
    queryFn: () => assetService.getAll(),
    staleTime: 300_000,
  });
  const { data: budgets = [] } = useQuery({
    queryKey: qk.module("budgets").list(),
    queryFn: () => budgetService.getAll(),
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: expensesKey.all });
    // Approvals draw down budgets.
    queryClient.invalidateQueries({ queryKey: qk.module("budgets").all });
  };

  const submitExpense = useMutation({
    mutationFn: (data: Partial<ExpenseDto>) => expenseService.submit(data),
    onSuccess: () => {
      toast.success("Expense submitted for approval");
      invalidate();
    },
  });
  const approveExpense = useMutation({
    mutationFn: (id: string) => expenseService.approve(id),
    onSuccess: () => {
      toast.success("Expense approved");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to approve expense" }),
  });
  const rejectExpense = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => expenseService.reject(id, reason),
    onSuccess: () => {
      toast.success("Expense rejected");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to reject expense" }),
  });
  const deleteExpense = useMutation({
    mutationFn: (id: string) => expenseService.delete(id),
    onSuccess: () => {
      toast.success("Expense deleted");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to delete expense" }),
  });

  const { register, handleSubmit, reset, watch, setValue, setError, formState: { errors } } = useForm<FormData>();
  // Receipts are uploaded, not linked. The form only ever creates, so the file
  // is held until the expense is saved (see attachAfterCreate in onSubmit).
  const attachments = useAttachmentField({ entityType: "EXPENSE" });

  useEffect(() => {
    if (!isModalOpen) return;
    attachments.reset();
    reset({
      title: "",
      description: "",
      amount: 0,
      currency: baseCurrency,
      category: "OTHER",
      linkedAssetId: "",
      linkedBudgetId: "",
      departmentId: "",
      receiptUrl: "",
      expenseDate: todayLocal(),
    });
    // `attachments.reset` only clears local picker state; it is stable per modal open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, reset, baseCurrency]);

  const lookups = useMemo(() => {
    const assetMap = new Map(assets.map((a) => [a.id, a.name]));
    const budgetMap = new Map(budgets.map((b) => [b.id, b.name]));
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));
    return {
      assetName: (id?: string) => (id ? assetMap.get(id) ?? null : null),
      budgetName: (id?: string) => (id ? budgetMap.get(id) ?? "—" : "—"),
      deptName: (id?: string) => (id ? deptMap.get(id) ?? null : null),
    };
  }, [assets, budgets, departments]);

  const watchedBudgetId = watch("linkedBudgetId");
  const selectedBudget = budgets.find((b) => b.id === watchedBudgetId);
  const fundsError = expenseFundsError(selectedBudget, watch("amount"));

  // A budget's committed/spent figures stay in its own currency, so an expense
  // linked to it must use that currency: pre-fill and lock the select.
  useEffect(() => {
    if (selectedBudget?.currency) setValue("currency", selectedBudget.currency);
  }, [selectedBudget?.currency, setValue]);

  const onSubmit = async (data: FormData) => {
    const { currency, error } = expenseCurrencyFor(selectedBudget, data.currency);
    if (error) {
      setError("currency", { type: "budget", message: error });
      return;
    }
    // The API refuses (409) an expense larger than the linked budget's available amount.
    const overBudget = expenseFundsError(selectedBudget, data.amount);
    if (overBudget) {
      setError("amount", { type: "funds", message: overBudget });
      return;
    }
    const payload = buildExpensePayload(data, currency) as Partial<ExpenseDto>;
    try {
      const saved = await submitExpense.mutateAsync(payload);
      // The expense exists now, so the held receipt finally has something to hang
      // off. A failure here says so rather than passing for a clean submission.
      await attachAfterCreate(attachments, saved?.id, "expense");
      setIsModalOpen(false);
    } catch (err) {
      reportApiError(err, { fallback: "Failed to submit expense", setError, labels: { linkedBudgetId: "Linked budget" } });
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (!(await confirm({ message: `Delete expense "${expense.title}"?`, variant: "danger" }))) return;
    deleteExpense.mutate(expense.id!);
  };

  const handleReject = async () => {
    if (!rejectTarget?.id) return;
    await rejectExpense.mutateAsync({ id: rejectTarget.id, reason: rejectReason || undefined });
    setRejectTarget(null);
    setRejectReason("");
  };

  const columns = useMemo<ColumnDef<Expense, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Expense",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">{row.original.title}</p>
            <p className="truncate text-xs text-faint-fg">
              {CATEGORY_LABELS[row.original.category ?? ""] ?? row.original.category ?? "—"}
              {row.original.submittedByName ? ` · ${row.original.submittedByName}` : ""}
              {lookups.deptName(row.original.departmentId) ? ` · ${lookups.deptName(row.original.departmentId)}` : ""}
            </p>
            {row.original.description ? (
              <p className="truncate text-xs text-muted-fg" title={row.original.description}>{row.original.description}</p>
            ) : null}
            {lookups.assetName(row.original.linkedAssetId) ? (
              <p className="truncate text-xs text-faint-fg">Asset · {lookups.assetName(row.original.linkedAssetId)}</p>
            ) : null}
            {row.original.receiptUrl ? (
              <SafeExternalLink href={row.original.receiptUrl} className="text-xs text-brand underline-offset-2 hover:underline">
                Receipt
              </SafeExternalLink>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "expenseDate",
        header: "Date",
        cell: ({ row }) => <span className="text-muted-fg">{fmtDate(row.original.expenseDate)}</span>,
      },
      {
        id: "budget",
        header: "Budget",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{lookups.budgetName(row.original.linkedBudgetId)}</span>,
      },
      {
        accessorKey: "amount",
        header: () => <span className="block text-right">Amount</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">{format(row.original.amount, row.original.currency || baseCurrency)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-48 space-y-0.5">
            <StatusBadge status={row.original.status ?? "SUBMITTED"} />
            {row.original.status === "REJECTED" && row.original.rejectionReason ? (
              <p className="truncate text-xs text-warn" title={row.original.rejectionReason}>
                {row.original.rejectionReason}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            {row.original.status === "SUBMITTED" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-ok"
                  title="Approve"
                  aria-label="Approve expense"
                  onClick={() => approveExpense.mutate(row.original.id!)}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-warn"
                  title="Reject"
                  aria-label="Reject expense"
                  onClick={() => setRejectTarget(row.original)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Delete expense"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookups, format, baseCurrency],
  );

  const rows = focusId ? (focused ? [focused as unknown as Expense] : []) : paged?.items ?? [];
  const total = focusId ? rows.length : paged?.total ?? 0;
  // Each expense is converted into the display currency; expenses without a rate are excluded and flagged.
  const pageAmount = sum(rows.map((e) => ({ amount: e.amount, currency: e.currency })));

  return (
    <ListPageTemplate
      title="Expenses"
      subtitle={isLoading ? "Loading expenses…" : `${total.toLocaleString()} expenses · submit → approve workflow`}
      actions={
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Submit expense
        </Button>
      }
      toolbar={
        <>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
            <Input
              placeholder="Search title or description…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ExpenseStatus | "");
              setPage(0);
            }}
            className="w-40"
          >
            <option value="">All statuses</option>
            {EXPENSE_FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <div className="flex gap-1.5">
            <Button variant={activeTab === "all" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("all")}>
              All
            </Button>
            <Button
              variant={activeTab === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("pending")}
            >
              Awaiting approval
            </Button>
          </div>
        </>
      }
    >
      <MissingRatesNotice incomplete={!pageAmount.complete} missingRates={pageAmount.missingRates} />

      {focusId ? (
        <p className="mb-3 text-sm text-muted-fg">
          Showing one expense.{" "}
          <Link href="/expenses" className="text-brand underline-offset-2 hover:underline">Show all</Link>
        </p>
      ) : null}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={focusId ? focusLoading : isLoading}
        pageInfo={
          activeTab === "all" && !focusId
            ? { page, size: 20, totalElements: total, totalPages: Math.max(1, Math.ceil(total / 20)) }
            : undefined
        }
        onPageChange={setPage}
        emptyTitle={activeTab === "pending" ? "Nothing awaiting approval" : "No expenses yet"}
        emptyDescription="Submitted expenses flow through approval and draw down their linked budget."
        emptyAction={
          activeTab === "all" ? (
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              <Receipt className="mr-1.5 h-4 w-4" /> Submit expense
            </Button>
          ) : undefined
        }
        footerSummary={
          <span>
            Page total · <MoneyTotalValue total={pageAmount} />
          </span>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Submit expense"
        description="Goes straight to the approval queue."
      >
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="ex-title">Title <span className="text-danger">*</span></Label>
            <Input
              id="ex-title"
              placeholder="Generator fuel — Kumasi branch"
              {...limitInputProps(FIELD_LIMITS.expense.title)}
              {...register("title", limitRules<FormData, "title">(FIELD_LIMITS.expense.title, "Title"))}
            />
            <FieldError error={errors.title} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ex-amount">Amount <span className="text-danger">*</span></Label>
              <Input
                id="ex-amount"
                type="number"
                {...limitInputProps(FIELD_LIMITS.expense.amount)}
                {...register("amount", limitRules<FormData, "amount">(FIELD_LIMITS.expense.amount, "Amount"))}
              />
              <FieldError error={errors.amount} />
              {!errors.amount && fundsError ? <p className="text-xs text-warn">{fundsError}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-currency">Currency</Label>
              <Select
                id="ex-currency"
                disabled={!!selectedBudget?.currency}
                title={selectedBudget?.currency ? `Locked to the budget's currency (${selectedBudget.currency})` : undefined}
                {...register("currency")}
              >
                <CurrencyOptions current={selectedBudget?.currency ?? undefined} />
              </Select>
              {selectedBudget?.currency ? (
                <p className="text-xs text-muted-fg">Locked to the budget&apos;s currency.</p>
              ) : null}
              <FieldError error={errors.currency} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ex-category">Category <span className="text-danger">*</span></Label>
              <Select id="ex-category" {...register("category", { required: "Category is required" })}>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <FieldError error={errors.category} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-date">Expense date</Label>
              <Input id="ex-date" type="date" {...register("expenseDate")} />
              <FieldError error={errors.expenseDate} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ex-budget">Linked budget</Label>
              <Select id="ex-budget" {...register("linkedBudgetId")}>
                <option value="">None</option>
                {budgets
                  .filter((b) => b.status === "ACTIVE" || b.status === "EXCEEDED")
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.currency || baseCurrency})
                    </option>
                  ))}
              </Select>
              <FieldError error={errors.linkedBudgetId} />
              {selectedBudget ? (
                <p className="text-xs text-muted-fg">
                  Available after commitments ·{" "}
                  <span className="data-mono">
                    {format(budgetAvailable(selectedBudget), selectedBudget.currency || baseCurrency)}
                  </span>
                  {selectedBudget.committedAmount ? (
                    <>
                      {" "}· committed{" "}
                      <span className="data-mono">
                        {format(selectedBudget.committedAmount, selectedBudget.currency || baseCurrency)}
                      </span>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-asset">Linked asset</Label>
              <Select id="ex-asset" {...register("linkedAssetId")}>
                <option value="">None</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
              <FieldError error={errors.linkedAssetId} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ex-dept">Department</Label>
              <Select id="ex-dept" {...register("departmentId")}>
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
              <FieldError error={errors.departmentId} />
            </div>
            <div className="space-y-2">
              <AttachmentField
                state={attachments}
                label="Receipt"
                hint="Attach the receipt — it uploads once the expense is submitted."
                fallback={
                  <>
                    <Label htmlFor="ex-receipt">Receipt URL</Label>
                    <Input id="ex-receipt" type="url" placeholder="https://…" {...limitInputProps(L.receiptUrl)}
                      {...register("receiptUrl", limitRules<FormData, "receiptUrl">(L.receiptUrl, "Receipt URL"))} />
                    <FieldError error={errors.receiptUrl} />
                  </>
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ex-description">Description</Label>
            <Textarea id="ex-description" placeholder="What was purchased and why…" {...register("description")} />
            <FieldError error={errors.description} />
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={submitExpense.isPending}>Submit for approval</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title="Reject expense"
        description={rejectTarget ? `Reject "${rejectTarget.title}" with an optional reason.` : ""}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ex-reject-reason">Reason</Label>
            <Textarea
              id="ex-reject-reason"
              placeholder="e.g. Missing receipt, over policy limit…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} isLoading={rejectExpense.isPending}>
              <XCircle className="mr-1.5 h-4 w-4" /> Reject expense
            </Button>
          </div>
        </div>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
