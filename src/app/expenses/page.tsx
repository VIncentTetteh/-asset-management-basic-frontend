"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Receipt, ThumbsUp, XCircle, Search } from "lucide-react";
import type { Expense, ExpenseStatus } from "@/types";
import { expenseService, type ExpenseDto } from "@/services/expenseService";
import { assetService } from "@/services/assetService";
import { budgetService } from "@/services/budgetService";
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
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function ExpensesPage() {
  const { format } = useCurrency();
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
    onError: () => toast.error("Failed to submit expense"),
  });
  const approveExpense = useMutation({
    mutationFn: (id: string) => expenseService.approve(id),
    onSuccess: () => {
      toast.success("Expense approved");
      invalidate();
    },
    onError: () => toast.error("Failed to approve expense"),
  });
  const rejectExpense = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => expenseService.reject(id, reason),
    onSuccess: () => {
      toast.success("Expense rejected");
      invalidate();
    },
    onError: () => toast.error("Failed to reject expense"),
  });
  const deleteExpense = useMutation({
    mutationFn: (id: string) => expenseService.delete(id),
    onSuccess: () => {
      toast.success("Expense deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete expense"),
  });

  const { register, handleSubmit, reset, watch } = useForm<FormData>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset({
      title: "",
      description: "",
      amount: 0,
      currency: "GHS",
      category: "OTHER",
      linkedAssetId: "",
      linkedBudgetId: "",
      expenseDate: new Date().toISOString().split("T")[0],
    });
  }, [isModalOpen, reset]);

  const lookups = useMemo(() => {
    const assetMap = new Map(assets.map((a) => [a.id, a.name]));
    const budgetMap = new Map(budgets.map((b) => [b.id, b.name]));
    return {
      assetName: (id?: string) => (id ? assetMap.get(id) ?? "—" : "—"),
      budgetName: (id?: string) => (id ? budgetMap.get(id) ?? "—" : "—"),
    };
  }, [assets, budgets]);

  const watchedBudgetId = watch("linkedBudgetId");
  const selectedBudget = budgets.find((b) => b.id === watchedBudgetId);

  const onSubmit = async (data: FormData) => {
    const currentUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
    const payload: Partial<ExpenseDto> = {
      ...data,
      amount: Number(data.amount),
      submittedById: currentUser?.id,
      submittedByName: currentUser?.name,
    };
    (Object.keys(payload) as (keyof ExpenseDto)[]).forEach((k) => {
      if (payload[k] === "") delete payload[k];
    });
    await submitExpense.mutateAsync(payload);
    setIsModalOpen(false);
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
            </p>
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
          <span className="data-mono block text-right">{format(row.original.amount, row.original.currency || "GHS")}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "DRAFT"} />,
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
    [lookups, format],
  );

  const rows = paged?.items ?? [];
  const total = paged?.total ?? 0;
  const pageAmount = rows.reduce((s, e) => s + (e.amount || 0), 0);

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
            {(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as ExpenseStatus[]).map((s) => (
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
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        pageInfo={
          activeTab === "all"
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
            Page total · <span className="data-mono">{format(pageAmount, "GHS")}</span>
          </span>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Submit expense"
        description="Goes straight to the approval queue."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="ex-title">Title <span className="text-danger">*</span></Label>
            <Input id="ex-title" placeholder="Generator fuel — Kumasi branch" {...register("title", { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ex-amount">Amount <span className="text-danger">*</span></Label>
              <Input id="ex-amount" type="number" step="0.01" min="0.01" {...register("amount", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-currency">Currency</Label>
              <Select id="ex-currency" {...register("currency")}>
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ex-category">Category</Label>
              <Select id="ex-category" {...register("category")}>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-date">Expense date</Label>
              <Input id="ex-date" type="date" {...register("expenseDate")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ex-budget">Linked budget</Label>
              <Select id="ex-budget" {...register("linkedBudgetId")}>
                <option value="">None</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
              {selectedBudget ? (
                <p className="text-xs text-muted-fg">
                  Remaining ·{" "}
                  <span className="data-mono">
                    {format(selectedBudget.remainingAmount ?? (selectedBudget.totalAmount || 0) - (selectedBudget.spentAmount || 0), selectedBudget.currency || "GHS")}
                  </span>
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
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ex-description">Description</Label>
            <Textarea id="ex-description" placeholder="What was purchased and why…" {...register("description")} />
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
