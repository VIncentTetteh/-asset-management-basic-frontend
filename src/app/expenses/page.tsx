"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
    Receipt, Plus, Trash2, CheckCircle2, XCircle, Clock, Loader2,
    RefreshCw, Search, DollarSign, ThumbsUp, ThumbsDown,
} from "lucide-react";

import { expenseService, ExpenseDto, ExpenseCategory, ExpenseStatus, PagedExpenses } from "@/services/expenseService";
import { assetService } from "@/services/assetService";
import { budgetService } from "@/services/budgetService";
import { Asset, Budget, Expense } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useConfirm } from "@/hooks/useConfirm";

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border border-slate-200",
    SUBMITTED: "bg-blue-100 text-blue-700 border border-blue-200",
    APPROVED: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    REJECTED: "bg-red-100 text-red-700 border border-red-200",
};

const CATEGORY_LABELS: Record<string, string> = {
    MAINTENANCE: "Maintenance",
    TRAVEL: "Travel",
    SUPPLIES: "Supplies",
    SOFTWARE: "Software",
    HARDWARE: "Hardware",
    INSURANCE: "Insurance",
    OTHER: "Other",
};

const fmt = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

// ── Component ──────────────────────────────────────────────────────────────────

type FormData = Omit<ExpenseDto, "id" | "organisationId" | "status" | "approvedAt" | "approvedById" | "submittedById" | "submittedByName">;

export default function ExpensesPage() {
    const { format: fmtCurrency } = useCurrency();
    const [pagedResult, setPagedResult] = useState<PagedExpenses>({ total: 0, limit: 20, offset: 0, items: [] });
    const [currentPage, setCurrentPage] = useState(0);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "">("");
    const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<Expense | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>();
    const { confirm, ConfirmDialog } = useConfirm();

    // Debounce ref for search
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce search changes
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(0);
        }, 300);
        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [searchTerm]);

    // Reset page when filter changes
    useEffect(() => {
        setCurrentPage(0);
    }, [statusFilter, activeTab]);

    // Fetch assets and budgets (static data — no need to re-fetch on every page change)
    const fetchStaticData = async () => {
        const [assetRes, budgetRes] = await Promise.allSettled([
            assetService.getAll(),
            budgetService.getAll(),
        ]);
        if (assetRes.status === "fulfilled") setAssets(assetRes.value);
        if (budgetRes.status === "fulfilled") setBudgets(budgetRes.value);
    };

    // Fetch paginated expenses
    const fetchExpenses = async () => {
        setIsLoading(true);
        if (activeTab === "pending") {
            // Pending tab still uses the dedicated endpoint (returns all pending)
            try {
                const items = await expenseService.listPending();
                setPagedResult({ total: items.length, limit: 20, offset: 0, items: items as unknown as Expense[] });
            } catch {
                toast.error("Failed to load expenses");
            } finally {
                setIsLoading(false);
            }
        } else {
            expenseService.getPaged({
                search: debouncedSearch || undefined,
                status: statusFilter || undefined,
                page: currentPage,
                size: 20,
            })
                .then(r => setPagedResult(r))
                .catch(() => toast.error("Failed to load expenses"))
                .finally(() => setIsLoading(false));
        }
    };

    // Initial static data load
    useEffect(() => { fetchStaticData(); }, []);

    // Re-fetch expenses whenever page, filters, debounced search, or tab changes
    useEffect(() => { fetchExpenses(); }, [currentPage, debouncedSearch, statusFilter, activeTab]);

    const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a.name])), [assets]);
    const budgetMap = useMemo(() => new Map(budgets.map(b => [b.id, b.name])), [budgets]);

    const expenses = pagedResult.items;
    const totalPages = Math.ceil(pagedResult.total / 20);

    // Stats derived from current page items (approximate; full stats would require a separate summary endpoint)
    const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const approved = expenses.filter(e => e.status === "APPROVED").length;
    const pending = expenses.filter(e => e.status === "SUBMITTED").length;
    const rejected = expenses.filter(e => e.status === "REJECTED").length;

    // Budget remaining hint
    const watchedBudgetId = watch("linkedBudgetId");
    const selectedBudget = budgets.find(b => b.id === watchedBudgetId);

    const openCreate = () => {
        reset({
            title: "", description: "", amount: 0, currency: "USD",
            category: "OTHER", receiptUrl: "", linkedAssetId: "", linkedBudgetId: "",
            expenseDate: new Date().toISOString().split("T")[0],
        });
        setIsModalOpen(true);
    };

    const onSubmit = async (data: FormData) => {
        try {
            const currentUser = typeof window !== "undefined"
                ? JSON.parse(localStorage.getItem("user") || "{}") : {};
            await expenseService.submit({
                ...data,
                submittedById: currentUser?.id,
                submittedByName: currentUser?.name,
            });
            toast.success("Expense submitted for approval");
            setIsModalOpen(false);
            fetchExpenses();
        } catch {
            toast.error("Failed to submit expense");
        }
    };

    const handleApprove = async (id: string) => {
        try {
            await expenseService.approve(id);
            toast.success("Expense approved");
            fetchExpenses();
        } catch {
            toast.error("Failed to approve expense");
        }
    };

    const handleReject = async () => {
        if (!rejectTarget?.id) return;
        try {
            await expenseService.reject(rejectTarget.id, rejectReason || undefined);
            toast.success("Expense rejected");
            setRejectTarget(null);
            setRejectReason("");
            fetchExpenses();
        } catch {
            toast.error("Failed to reject expense");
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ message: "Delete this expense permanently?", variant: "danger" })) return;
        try {
            await expenseService.delete(id);
            toast.success("Expense deleted");
            fetchExpenses();
        } catch {
            toast.error("Failed to delete expense");
        }
    };

    if (isLoading && expenses.length === 0) return <PageSpinner />;

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Expenses"
                subtitle="Submit, review, and approve organisational expense claims"
                actions={
                    <Button onClick={openCreate} className="gap-2">
                        <Plus className="h-4 w-4" /> New Expense
                    </Button>
                }
            />

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                <DollarSign className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-slate-900">{fmtCurrency(totalAmount)}</p>
                                <p className="text-xs text-slate-500">Total</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-slate-900">{pending}</p>
                                <p className="text-xs text-slate-500">Pending Approval</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-slate-900">{approved}</p>
                                <p className="text-xs text-slate-500">Approved</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                                <XCircle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-slate-900">{rejected}</p>
                                <p className="text-xs text-slate-500">Rejected</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs + Filters */}
            <Card className="border-0 shadow-sm">
                <CardContent className="pt-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex gap-2">
                            <Button variant={activeTab === "all" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("all")}>All</Button>
                            <Button variant={activeTab === "pending" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("pending")} className="gap-1">
                                <Clock className="h-3.5 w-3.5" /> Pending ({pending})
                            </Button>
                        </div>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search expenses…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                        </div>
                        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ExpenseStatus | "")} className="w-44">
                            <option value="">All Statuses</option>
                            <option value="DRAFT">Draft</option>
                            <option value="SUBMITTED">Submitted</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </Select>
                        <Button variant="outline" size="icon" onClick={fetchExpenses} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-900">
                        Expense Claims
                        <span className="ml-2 text-sm font-normal text-slate-400">({pagedResult.total})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {expenses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <Receipt className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No expense records found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Title</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Submitted By</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Category</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Amount</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {expenses.map(exp => (
                                        <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4">
                                                <p className="font-medium text-slate-900">{exp.title || "—"}</p>
                                                {exp.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{exp.description}</p>}
                                                {exp.rejectionReason && (
                                                    <p className="text-xs text-red-500 mt-0.5">Reason: {exp.rejectionReason}</p>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-slate-700">{exp.submittedByName || "—"}</td>
                                            <td className="py-3 px-4">
                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                    {CATEGORY_LABELS[exp.category || ""] || exp.category || "—"}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 font-medium text-slate-900">{fmtCurrency(exp.amount)}</td>
                                            <td className="py-3 px-4 text-slate-600">{fmt(exp.expenseDate || exp.createdAt)}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[exp.status || "DRAFT"] || "bg-slate-100 text-slate-600"}`}>
                                                    {exp.status || "DRAFT"}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex gap-1">
                                                    {exp.status === "SUBMITTED" && (
                                                        <>
                                                            <Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-600 hover:text-emerald-700 gap-1" onClick={() => handleApprove(exp.id || "")}>
                                                                <ThumbsUp className="h-3.5 w-3.5" /> Approve
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="h-8 px-2 text-red-500 hover:text-red-600 gap-1" onClick={() => { setRejectTarget(exp); setRejectReason(""); }}>
                                                                <ThumbsDown className="h-3.5 w-3.5" /> Reject
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => handleDelete(exp.id || "")}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center pt-4 pb-4 px-4 border-t">
                            <span className="text-sm text-slate-500">
                                {pagedResult.offset + 1}–{Math.min(pagedResult.offset + pagedResult.limit, pagedResult.total)} of {pagedResult.total}
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={currentPage === 0}
                                    onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
                                <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1}
                                    onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Submit Expense Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Submit Expense" description="Fill in the details for your expense claim">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="e-title">Title *</Label>
                        <Input id="e-title" placeholder="Brief description of expense" {...register("title", { required: "Title is required" })} />
                        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="e-desc">Description</Label>
                        <Textarea id="e-desc" rows={2} placeholder="More detail…" {...register("description")} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="e-amount">Amount *</Label>
                            <Input id="e-amount" type="number" step="0.01" min="0" {...register("amount", { required: "Amount is required", valueAsNumber: true })} />
                            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="e-currency">Currency</Label>
                            <Select id="e-currency" {...register("currency")}>
                                <option value="USD">USD</option>
                                <option value="GHS">GHS</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="e-cat">Category</Label>
                        <Select id="e-cat" {...register("category")}>
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="e-date">Expense Date *</Label>
                        <Input
                            id="e-date"
                            type="date"
                            {...register("expenseDate", { required: "Expense date is required" })}
                        />
                        {errors.expenseDate && <p className="text-xs text-red-500 mt-1">{errors.expenseDate.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="e-asset">Linked Asset (optional)</Label>
                        <Select id="e-asset" {...register("linkedAssetId")}>
                            <option value="">None</option>
                            {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="e-budget">Linked Budget (optional)</Label>
                        <Select id="e-budget" {...register("linkedBudgetId")}>
                            <option value="">None</option>
                            {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </Select>
                        {selectedBudget && (
                            <p className="text-xs text-slate-500 mt-1">
                                Available:{" "}
                                <span className={selectedBudget.availableAmount < 0 ? "text-red-500 font-medium" : "text-emerald-600 font-medium"}>
                                    {fmtCurrency(selectedBudget.availableAmount)}
                                </span>
                                {selectedBudget.committedAmount > 0 && (
                                    <span className="ml-2 text-amber-500">
                                        ({fmtCurrency(selectedBudget.committedAmount)} committed)
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="e-receipt">Receipt URL</Label>
                        <Input id="e-receipt" placeholder="https://…" {...register("receiptUrl")} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                            Submit Expense
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">Cancel</Button>
                    </div>
                </form>
            </Modal>

            {/* Reject Modal */}
            <Modal isOpen={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Expense" description={`Reject "${rejectTarget?.title}"?`}>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="r-reason">Rejection Reason (optional)</Label>
                        <Textarea id="r-reason" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain why this expense is being rejected…" />
                    </div>
                    <div className="flex gap-3">
                        <Button className="flex-1 bg-red-600 hover:bg-red-700 gap-2" onClick={handleReject}>
                            <ThumbsDown className="h-4 w-4" /> Reject
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={() => setRejectTarget(null)}>Cancel</Button>
                    </div>
                </div>
            </Modal>

            {ConfirmDialog}
        </div>
    );
}
