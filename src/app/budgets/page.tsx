"use client";

import { useState, useEffect } from "react";
import { Budget, BudgetDto, BudgetSummary, Department, Expense } from "@/types";
import { budgetService } from "@/services/budgetService";
import { departmentService } from "@/services/departmentService";
import { auditEventService } from "@/services/auditEventService";
import { AuditEvent } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TableRowSkeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Wallet, TrendingUp, AlertTriangle, History, Search, DollarSign, PieChart, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";


export default function BudgetsPage() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSpendModalOpen, setIsSpendModalOpen] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [spendingBudgetId, setSpendingBudgetId] = useState<string>("");
    const [spendAmount, setSpendAmount] = useState<string>("");
    const [isSpendSubmitting, setIsSpendSubmitting] = useState(false);
    const [spendNote, setSpendNote] = useState<string>("");
    const [orgSummary, setOrgSummary] = useState<BudgetSummary | null>(null);

    // Drill-down states
    const [drillBudget, setDrillBudget] = useState<Budget | null>(null);
    const [drillExpenses, setDrillExpenses] = useState<Expense[]>([]);
    const [drillLoading, setDrillLoading] = useState(false);

    // History states
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [history, setHistory] = useState<AuditEvent[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [activeBudgetName, setActiveBudgetName] = useState("");
    const { confirm, ConfirmDialog } = useConfirm();

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<BudgetDto>();

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const [budgetsData, depsData, summaryData] = await Promise.allSettled([
                budgetService.getAll(),
                departmentService.getAll(),
                budgetService.getSummary(),
            ]);
            if (budgetsData.status === "fulfilled") setBudgets(budgetsData.value);
            if (depsData.status === "fulfilled") setDepartments(depsData.value);
            if (summaryData.status === "fulfilled") setOrgSummary(summaryData.value);
        } catch {
            toast.error("Failed to load budgets");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const totalAllocated = budgets.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const totalSpent = budgets.reduce((s, b) => s + (b.spentAmount || 0), 0);
    const totalRemaining = budgets.reduce((s, b) => s + (b.remainingAmount || 0), 0);

    const handleOpenCreate = () => {
        setEditingBudget(null);
        reset({ name: "", status: "ACTIVE", totalAmount: 0, currency: "USD" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (budget: Budget) => {
        setEditingBudget(budget);
        reset({
            name: budget.name,
            status: budget.status,
            totalAmount: budget.totalAmount,
            currency: budget.currency || "USD",
            fiscalYear: budget.fiscalYear || undefined,
            departmentId: budget.departmentId || "",
            periodStart: budget.periodStart || "",
            periodEnd: budget.periodEnd || "",
        });
        setIsModalOpen(true);
    };

    const handleOpenSpend = (id: string) => {
        setSpendingBudgetId(id);
        setSpendAmount("");
        setSpendNote("");
        setIsSpendModalOpen(true);
    };

    const handleOpenHistory = async (budget: Budget) => {
        setIsHistoryModalOpen(true);
        setIsLoadingHistory(true);
        setActiveBudgetName(budget.name);
        try {
            // Path filter for exactly this budget's spend endpoint
            const data = await auditEventService.getAll({ 
                path: `/budgets/${budget.id}/spend`,
                success: true 
            });
            setHistory(data);
        } catch {
            toast.error("Failed to load expenditure history");
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const openDrillDown = async (budget: Budget) => {
        setDrillBudget(budget);
        setDrillLoading(true);
        try {
            const result = await budgetService.getExpenses(budget.id);
            setDrillExpenses(result.items);
        } catch {
            toast.error("Failed to load expenses");
        } finally {
            setDrillLoading(false);
        }
    };

    const handleRecordSpend = async () => {
        const amount = parseFloat(spendAmount);
        if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
        if (!spendNote.trim()) { toast.error("Note is required"); return; }
        setIsSpendSubmitting(true);
        try {
            await budgetService.recordAdjustment(spendingBudgetId, { amount, note: spendNote.trim() });
            toast.success("Adjustment recorded");
            setIsSpendModalOpen(false);
            fetchAll();
        } catch {
            toast.error("Failed to record adjustment");
        } finally {
            setIsSpendSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ message: "Delete this budget?", variant: "danger" })) return;
        setDeletingId(id);
        try {
            await budgetService.delete(id);
            toast.success("Budget deleted");
            fetchAll();
        } catch {
            toast.error("Failed to delete budget");
        } finally {
            setDeletingId(null);
        }
    };

    const filteredBudgets = budgets.filter(b =>
        !searchTerm.trim() ||
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deptName(b.departmentId).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const onSubmit = async (data: BudgetDto) => {
        const payload = { ...data };
        (Object.keys(payload) as (keyof BudgetDto)[]).forEach((k) => {
            if (payload[k] === "" || payload[k] === undefined) delete (payload as Partial<BudgetDto>)[k];
        });
        try {
            if (editingBudget) {
                const patch = buildPatchPayload<BudgetDto>(editingBudget as unknown as Partial<BudgetDto>, payload);
                if (Object.keys(patch).length === 0) { toast("No changes"); return; }
                await budgetService.update(editingBudget.id, patch);
                toast.success("Budget updated");
            } else {
                await budgetService.create(payload);
                toast.success("Budget created");
            }
            setIsModalOpen(false);
            fetchAll();
        } catch {
            toast.error("Failed to save budget");
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case "ACTIVE": return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case "EXCEEDED": return "bg-red-100 text-red-700 border-red-200";
            case "CLOSED": return "bg-slate-100 text-slate-500 border-slate-200";
            case "DRAFT": return "bg-sky-100 text-sky-700 border-sky-200";
            default: return "bg-slate-100 text-slate-500 border-slate-200";
        }
    };

    const spendPct = (budget: Budget) => {
        if (!budget.totalAmount) return 0;
        return Math.min(100, (budget.spentAmount / budget.totalAmount) * 100);
    };

    const deptName = (id?: string | null) => departments.find(d => d.id === id)?.name || "—";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Budget Management</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Track department and project budgets in real time.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-purple-600 hover:bg-purple-700 shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Budget
                </Button>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
                ) : (
                    <>
                        {/* Card 1: Active Budgets */}
                        <Card className="border-slate-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-500 mb-1">Active Budgets</p>
                                        <p className="text-2xl font-bold text-slate-900 tabular-nums truncate">
                                            {budgets.filter(b => b.status === "ACTIVE").length}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-1">{budgets.length} total</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl shrink-0 bg-purple-100 text-purple-600">
                                        <Wallet className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        {/* Card 2: Total Allocated */}
                        <Card className="border-slate-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-500 mb-1">Total Allocated</p>
                                        <p className="text-2xl font-bold text-slate-900 tabular-nums truncate">
                                            {(orgSummary?.totalAllocated ?? 0).toLocaleString()}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-1">across all budgets</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl shrink-0 bg-blue-100 text-blue-600">
                                        <DollarSign className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        {/* Card 3: Total Spent */}
                        <Card className="border-slate-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-500 mb-1">Total Spent</p>
                                        <p className="text-2xl font-bold text-slate-900 tabular-nums truncate">
                                            {(orgSummary?.totalSpent ?? 0).toLocaleString()}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            {orgSummary?.totalAllocated
                                                ? `${((orgSummary.totalSpent / orgSummary.totalAllocated) * 100).toFixed(0)}% utilized`
                                                : "—"}
                                        </p>
                                    </div>
                                    <div className="p-2.5 rounded-xl shrink-0 bg-amber-100 text-amber-600">
                                        <TrendingUp className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        {/* Card 4: Committed (amber) */}
                        <Card className="border-slate-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                                            Committed
                                            <span
                                                className="cursor-default"
                                                title="Submitted expenses awaiting approval"
                                            >
                                                <AlertTriangle className="h-3 w-3 text-amber-400 inline" />
                                            </span>
                                        </p>
                                        <p className="text-2xl font-bold text-amber-600 tabular-nums truncate">
                                            {(orgSummary?.totalCommitted ?? 0).toLocaleString()}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-1">awaiting approval</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl shrink-0 bg-amber-100 text-amber-600">
                                        <PieChart className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        {/* Card 5: Available (green) */}
                        <Card className="border-slate-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-500 mb-1">Available</p>
                                        <p className="text-2xl font-bold text-emerald-600 tabular-nums truncate">
                                            {(orgSummary?.totalAvailable ?? 0).toLocaleString()}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-1">unencumbered funds</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl shrink-0 bg-emerald-100 text-emerald-600">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Overall utilization bar */}
            {!isLoading && totalAllocated > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <PieChart className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-semibold text-slate-700">Overall Budget Utilization</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                            {((totalSpent / totalAllocated) * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${
                                (totalSpent / totalAllocated) >= 1 ? "bg-red-500" :
                                (totalSpent / totalAllocated) >= 0.8 ? "bg-amber-500" :
                                "bg-gradient-to-r from-emerald-500 to-teal-500"
                            }`}
                            style={{ width: `${Math.min(100, (totalSpent / totalAllocated) * 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-slate-400">
                        <span>Spent: {totalSpent.toLocaleString()}</span>
                        <span>Allocated: {totalAllocated.toLocaleString()}</span>
                    </div>
                </div>
            )}

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
                    <CardTitle className="text-base font-semibold text-slate-700">
                        {filteredBudgets.length} budget{filteredBudgets.length !== 1 ? "s" : ""}
                        {searchTerm && ` matching "${searchTerm}"`}
                    </CardTitle>
                    <div className="relative w-56">
                        <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Filter budgets…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-8 h-8 text-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <table className="w-full text-sm">
                            <tbody>
                                {Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)}
                            </tbody>
                        </table>
                    ) : filteredBudgets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <Wallet className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No budgets found</h3>
                            <p className="text-slate-500 mt-1">Create budgets to track departmental spending.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/60">
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">FY</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Allocated</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[180px]">Utilization</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Remaining</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBudgets.map((b) => {
                                        const pct = spendPct(b);
                                        const exceeded = pct >= 100;
                                        const warning = pct >= 80 && pct < 100;
                                        return (
                                            <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors group">
                                                <td className="py-3.5 px-4 font-semibold text-slate-900">{b.name}</td>
                                                <td className="py-3.5 px-4 text-slate-600 text-sm">{deptName(b.departmentId)}</td>
                                                <td className="py-3.5 px-4 text-slate-500 text-sm">{b.fiscalYear || "—"}</td>
                                                <td className="py-3.5 px-4 text-slate-700 font-medium tabular-nums">
                                                    <span className="text-xs text-slate-400 mr-1">{b.currency || "USD"}</span>
                                                    {b.totalAmount.toLocaleString()}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className={`text-sm font-semibold tabular-nums ${exceeded ? "text-red-600" : warning ? "text-amber-600" : "text-slate-700"}`}>
                                                                {exceeded && <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />}
                                                                {b.spentAmount.toLocaleString()}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-400">{pct.toFixed(0)}%</span>
                                                        </div>
                                                        <div className="w-36 bg-slate-100 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${exceeded ? "bg-red-500" : warning ? "bg-amber-400" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`}
                                                                style={{ width: `${Math.min(100, pct)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-slate-700 font-medium tabular-nums">{b.remainingAmount.toLocaleString()}</td>
                                                <td className="py-3.5 px-4">
                                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusStyles(b.status)}`}>
                                                        {b.status}
                                                    </span>
                                                    {b.totalAmount > 0 &&
                                                     (b.spentAmount / b.totalAmount) * 100 >= (b.alertThresholdPct ?? 80) && (
                                                        <span className="ml-1 text-amber-500 text-xs font-medium" title="Approaching budget limit">
                                                            ⚠ {((b.spentAmount / b.totalAmount) * 100).toFixed(0)}%
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenSpend(b.id)} className="h-7 px-2.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-semibold">
                                                            + Spend
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => openDrillDown(b)} className="h-7 px-2.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 font-semibold">
                                                            Expenses
                                                        </Button>
                                                        <Button variant="outline" size="sm" title="Expenditure History" onClick={() => handleOpenHistory(b)} className="h-7 px-2 text-slate-500 hover:bg-slate-50">
                                                            <History className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(b)} className="h-7 px-2">
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" isLoading={deletingId === b.id} onClick={() => handleDelete(b.id)} className="h-7 px-2 text-red-500 hover:bg-red-50">
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Adjustment Modal */}
            <Modal
                isOpen={isSpendModalOpen}
                onClose={() => setIsSpendModalOpen(false)}
                title="Add Adjustment"
                description="For direct charges outside the expense workflow."
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="spendAmount">Amount <span className="text-red-500">*</span></Label>
                        <Input
                            id="spendAmount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            value={spendAmount}
                            onChange={e => setSpendAmount(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="spendNote">Note <span className="text-red-500">*</span></Label>
                        <Input
                            id="spendNote"
                            type="text"
                            placeholder="e.g. Direct vendor invoice #INV-001"
                            value={spendNote}
                            onChange={e => setSpendNote(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={() => setIsSpendModalOpen(false)}>Cancel</Button>
                        <Button isLoading={isSpendSubmitting} onClick={handleRecordSpend} className="bg-emerald-600 hover:bg-emerald-700">
                            Save Adjustment
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingBudget ? "Edit Budget" : "Add Budget"}
                description={editingBudget ? "Update budget details." : "Create a new budget."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                        <Input id="name" placeholder="e.g. IT Equipment FY2025" {...register("name", { required: "Name is required" })} />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="totalAmount">Allocated Amount <span className="text-red-500">*</span></Label>
                            <Input id="totalAmount" type="number" step="0.01" placeholder="0.00" {...register("totalAmount", { required: true, valueAsNumber: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Select id="currency" {...register("currency")}>
                                <option value="USD">USD</option>
                                <option value="GHS">GHS</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select id="status" {...register("status")}>
                                {["DRAFT", "ACTIVE", "EXCEEDED", "CLOSED"].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fiscalYear">Fiscal Year</Label>
                            <Input id="fiscalYear" type="number" placeholder="2025" {...register("fiscalYear", { valueAsNumber: true })} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="departmentId">Department</Label>
                        <Select id="departmentId" {...register("departmentId")}>
                            <option value="">— None —</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="periodStart">Start Date</Label>
                            <Input id="periodStart" type="date" {...register("periodStart")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="periodEnd">End Date</Label>
                            <Input id="periodEnd" type="date" {...register("periodEnd")} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                            {editingBudget ? "Save Changes" : "Add Budget"}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Expenditure History Modal */}
            <Modal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                title="Expenditure History"
                description={`Audit logs of spend activity for "${activeBudgetName}"`}
            >
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    {isLoadingHistory ? (
                        <div className="py-12 flex justify-center"><Spinner size="lg" className="text-purple-600" /></div>
                    ) : history.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 italic">No recorded expenditures found in audit logs.</div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((h) => (
                                <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                    <div className="mt-1 p-1 bg-emerald-100 rounded text-emerald-600"><TrendingUp className="h-3.5 w-3.5" /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <p className="text-sm font-medium text-slate-900 leading-tight">Expenditure Recorded</p>
                                            <span className="text-[10px] whitespace-nowrap text-slate-400 font-mono">{new Date(h.createdAt).toLocaleString()}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Recorded by: <span className="text-slate-700 font-medium">{h.actorEmail || 'System'}</span></p>
                                        {h.message && <p className="text-xs text-slate-600 mt-2 p-1.5 bg-white border border-slate-100 rounded italic">{h.message}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white">
                        <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>Close Activity Log</Button>
                    </div>
                </div>
            </Modal>
            {/* Expense Drill-Down Modal */}
            <Modal
                isOpen={drillBudget !== null}
                onClose={() => setDrillBudget(null)}
                title={drillBudget ? `Expenses — ${drillBudget.name}` : "Expenses"}
                description={drillBudget ? `Linked expenses for budget "${drillBudget.name}"` : undefined}
            >
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    {drillLoading ? (
                        <div className="py-12 flex justify-center"><Spinner size="lg" className="text-purple-600" /></div>
                    ) : drillExpenses.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 italic">No expenses linked to this budget.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/60">
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drillExpenses.map((exp) => (
                                        <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                                            <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">
                                                {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString() : exp.createdAt ? new Date(exp.createdAt).toLocaleDateString() : "—"}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-900 font-medium">{exp.title || "—"}</td>
                                            <td className="py-2.5 px-3 text-slate-700 tabular-nums">
                                                <span className="text-xs text-slate-400 mr-1">{exp.currency || "USD"}</span>
                                                {(exp.amount ?? 0).toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 text-xs">{exp.category || "—"}</td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${
                                                    exp.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                                    exp.status === "REJECTED" ? "bg-red-100 text-red-700 border-red-200" :
                                                    exp.status === "SUBMITTED" ? "bg-sky-100 text-sky-700 border-sky-200" :
                                                    "bg-slate-100 text-slate-500 border-slate-200"
                                                }`}>
                                                    {exp.status || "—"}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 text-xs">{exp.submittedByName || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white">
                        <Button variant="outline" onClick={() => setDrillBudget(null)}>Close</Button>
                    </div>
                </div>
            </Modal>
            {ConfirmDialog}
        </div>
    );
}
