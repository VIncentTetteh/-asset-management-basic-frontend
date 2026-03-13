"use client";

import { useState, useEffect } from "react";
import { Budget, BudgetDto, Department } from "@/types";
import { budgetService } from "@/services/budgetService";
import { departmentService } from "@/services/departmentService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Wallet, TrendingUp, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";

export default function BudgetsPage() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSpendModalOpen, setIsSpendModalOpen] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [spendingBudgetId, setSpendingBudgetId] = useState<string>("");
    const [spendAmount, setSpendAmount] = useState<string>("");
    const [isSpendSubmitting, setIsSpendSubmitting] = useState(false);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<BudgetDto>();

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const [budgetsData, depsData] = await Promise.allSettled([
                budgetService.getAll(),
                departmentService.getAll(),
            ]);
            if (budgetsData.status === "fulfilled") setBudgets(budgetsData.value);
            if (depsData.status === "fulfilled") setDepartments(depsData.value);
        } catch {
            toast.error("Failed to load budgets");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const totalAllocated = budgets.reduce((s, b) => s + (b.allocatedAmount || 0), 0);
    const totalSpent = budgets.reduce((s, b) => s + (b.spentAmount || 0), 0);
    const totalRemaining = budgets.reduce((s, b) => s + (b.remainingAmount || 0), 0);

    const handleOpenCreate = () => {
        setEditingBudget(null);
        reset({ name: "", status: "ACTIVE", allocatedAmount: 0, currency: "USD" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (budget: Budget) => {
        setEditingBudget(budget);
        reset({
            name: budget.name,
            status: budget.status,
            allocatedAmount: budget.allocatedAmount,
            currency: budget.currency || "USD",
            fiscalYear: budget.fiscalYear || undefined,
            departmentId: budget.departmentId || "",
            startDate: budget.startDate || "",
            endDate: budget.endDate || "",
        });
        setIsModalOpen(true);
    };

    const handleOpenSpend = (id: string) => {
        setSpendingBudgetId(id);
        setSpendAmount("");
        setIsSpendModalOpen(true);
    };

    const handleRecordSpend = async () => {
        const amount = parseFloat(spendAmount);
        if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
        setIsSpendSubmitting(true);
        try {
            await budgetService.recordSpend(spendingBudgetId, { amount });
            toast.success("Spend recorded");
            setIsSpendModalOpen(false);
            fetchAll();
        } catch {
            toast.error("Failed to record spend");
        } finally {
            setIsSpendSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this budget?")) return;
        try {
            await budgetService.delete(id);
            toast.success("Budget deleted");
            fetchAll();
        } catch {
            toast.error("Failed to delete budget");
        }
    };

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
        if (!budget.allocatedAmount) return 0;
        return Math.min(100, (budget.spentAmount / budget.allocatedAmount) * 100);
    };

    const deptName = (id?: string | null) => departments.find(d => d.id === id)?.name || "—";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Budgets</h1>
                    <p className="text-slate-500">Track department and project budgets.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Budget
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg"><Wallet className="h-5 w-5 text-blue-600" /></div>
                        <div>
                            <p className="text-xs text-slate-500">Total Budgets</p>
                            <p className="text-xl font-bold text-slate-900">{budgets.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg"><TrendingUp className="h-5 w-5 text-purple-600" /></div>
                        <div>
                            <p className="text-xs text-slate-500">Total Allocated</p>
                            <p className="text-xl font-bold text-slate-900">{totalAllocated.toLocaleString()}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg"><TrendingUp className="h-5 w-5 text-amber-600" /></div>
                        <div>
                            <p className="text-xs text-slate-500">Total Spent</p>
                            <p className="text-xl font-bold text-slate-900">{totalSpent.toLocaleString()}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg"><Wallet className="h-5 w-5 text-emerald-600" /></div>
                        <div>
                            <p className="text-xs text-slate-500">Total Remaining</p>
                            <p className="text-xl font-bold text-slate-900">{totalRemaining.toLocaleString()}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200">
                <CardHeader className="pb-0">
                    <CardTitle className="text-base font-semibold text-slate-700">
                        {budgets.length} budget{budgets.length !== 1 ? "s" : ""}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="h-40 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                        </div>
                    ) : budgets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <Wallet className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No budgets found</h3>
                            <p className="text-slate-500 mt-1">Create budgets to track departmental spending.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Name</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Department</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">FY</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Allocated</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600 min-w-[160px]">Spent</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Remaining</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                        <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {budgets.map((b) => {
                                        const pct = spendPct(b);
                                        const exceeded = pct >= 100;
                                        return (
                                            <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-4 font-medium text-slate-900">{b.name}</td>
                                                <td className="py-3 px-4 text-slate-600">{deptName(b.departmentId)}</td>
                                                <td className="py-3 px-4 text-slate-600">{b.fiscalYear || "—"}</td>
                                                <td className="py-3 px-4 text-slate-700">{(b.currency || "USD")} {b.allocatedAmount.toLocaleString()}</td>
                                                <td className="py-3 px-4">
                                                    <div className="space-y-1">
                                                        <div className={`flex items-center gap-1 ${exceeded ? "text-red-600" : "text-slate-700"}`}>
                                                            {exceeded && <AlertTriangle className="h-3.5 w-3.5" />}
                                                            {b.spentAmount.toLocaleString()}
                                                        </div>
                                                        <div className="w-32 bg-slate-100 rounded-full h-1.5">
                                                            <div
                                                                className={`h-1.5 rounded-full ${exceeded ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-slate-400">{pct.toFixed(0)}%</p>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-700">{b.remainingAmount.toLocaleString()}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${getStatusStyles(b.status)}`}>
                                                        {b.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenSpend(b.id)} className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                                            Spend
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(b)} className="h-7 px-2">
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(b.id)} className="h-7 px-2 text-red-600 hover:bg-red-50">
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

            {/* Record Spend Modal */}
            <Modal
                isOpen={isSpendModalOpen}
                onClose={() => setIsSpendModalOpen(false)}
                title="Record Expenditure"
                description="Record an expenditure against this budget."
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
                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={() => setIsSpendModalOpen(false)}>Cancel</Button>
                        <Button isLoading={isSpendSubmitting} onClick={handleRecordSpend} className="bg-emerald-600 hover:bg-emerald-700">
                            Record Spend
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
                            <Label htmlFor="allocatedAmount">Allocated Amount <span className="text-red-500">*</span></Label>
                            <Input id="allocatedAmount" type="number" step="0.01" placeholder="0.00" {...register("allocatedAmount", { required: true, valueAsNumber: true })} />
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
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input id="startDate" type="date" {...register("startDate")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">End Date</Label>
                            <Input id="endDate" type="date" {...register("endDate")} />
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
        </div>
    );
}
