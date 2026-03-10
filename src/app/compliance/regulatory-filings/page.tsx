"use client";

import { useState, useEffect, useMemo } from "react";
import { RegulatoryFiling, RegulatoryFilingDto, FilingStatus } from "@/types";
import { regulatoryFilingService } from "@/services/complianceService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, FileClock, Search, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";

const STATUSES: FilingStatus[] = ["PENDING", "SUBMITTED", "OVERDUE", "ACKNOWLEDGED", "REJECTED"];

const statusColor: Record<FilingStatus, string> = {
    PENDING: "bg-blue-100 text-blue-700 border-blue-200",
    SUBMITTED: "bg-teal-100 text-teal-700 border-teal-200",
    OVERDUE: "bg-red-100 text-red-700 border-red-200",
    ACKNOWLEDGED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    REJECTED: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function RegulatoryFilingsPage() {
    const [items, setItems] = useState<RegulatoryFiling[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<RegulatoryFiling | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RegulatoryFilingDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const data = await regulatoryFilingService.getAll({ status: (statusFilter as FilingStatus) || undefined });
            setItems(data);
        } catch {
            toast.error("Failed to load regulatory filings");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [statusFilter]);

    const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

    const stats = useMemo(() => ({
        pending: items.filter(i => i.status === "PENDING").length,
        submitted: items.filter(i => i.status === "SUBMITTED").length,
        overdue: items.filter(i => i.status === "OVERDUE" || (i.status === "PENDING" && isOverdue(i.dueDate))).length,
        acknowledged: items.filter(i => i.status === "ACKNOWLEDGED").length,
    }), [items]);

    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter(i =>
            i.filingType.toLowerCase().includes(q) ||
            i.regulator.toLowerCase().includes(q) ||
            (i.reference ?? "").toLowerCase().includes(q) ||
            (i.notes ?? "").toLowerCase().includes(q)
        );
    }, [items, search]);

    const handleOpenCreate = () => {
        setEditing(null);
        reset({ filingType: "", regulator: "", dueDate: "", status: "PENDING" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: RegulatoryFiling) => {
        setEditing(item);
        reset({
            filingType: item.filingType,
            regulator: item.regulator,
            dueDate: item.dueDate ? item.dueDate.split("T")[0] : "",
            status: item.status,
            submittedAt: item.submittedAt ? item.submittedAt.split("T")[0] : "",
            reference: item.reference ?? "",
            notes: item.notes ?? "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this filing?")) return;
        try {
            await regulatoryFilingService.delete(id);
            toast.success("Deleted");
            fetchData();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const onSubmit = async (data: RegulatoryFilingDto) => {
        try {
            const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "")) as RegulatoryFilingDto;
            if (editing) {
                const patch = buildPatchPayload<RegulatoryFilingDto>(editing as unknown as Partial<RegulatoryFilingDto>, clean);
                if (!Object.keys(patch).length) { toast("No changes"); return; }
                await regulatoryFilingService.update(editing.id, patch);
                toast.success("Updated");
            } else {
                await regulatoryFilingService.create(clean);
                toast.success("Filing created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch {
            toast.error("Failed to save");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Regulatory Filings</h1>
                    <p className="text-slate-500">Regulatory submission tracking for BOG, SEC, NCA, and other regulators.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Filing
                </Button>
            </div>

            {!isLoading && items.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">{stats.pending}</div>
                        <div className="text-xs text-blue-600 font-semibold uppercase mt-1">Pending</div>
                    </div>
                    <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-teal-700">{stats.submitted}</div>
                        <div className="text-xs text-teal-600 font-semibold uppercase mt-1">Submitted</div>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-red-700">{stats.overdue}</div>
                        <div className="text-xs text-red-600 font-semibold uppercase mt-1">Overdue</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-emerald-700">{stats.acknowledged}</div>
                        <div className="text-xs text-emerald-600 font-semibold uppercase mt-1">Acknowledged</div>
                    </div>
                </div>
            )}

            {!isLoading && stats.overdue > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <span className="text-sm font-semibold text-red-700">{stats.overdue} filing{stats.overdue !== 1 ? "s" : ""} overdue — immediate attention required</span>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by filing type, regulator, reference..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700">
                    <option value="">All Statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <FileClock className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">{search ? "No filings match your search" : "No regulatory filings found"}</h3>
                        <p className="text-slate-500 mt-1">Track submission deadlines for BOG, SEC, NCA and other regulators.</p>
                        {!search && <Button onClick={handleOpenCreate} className="mt-6 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">Add Filing</Button>}
                    </div>
                ) : filtered.map(item => (
                    <Card key={item.id} className={`group border-slate-200 hover:shadow-md transition-all flex flex-col ${item.status === "PENDING" && isOverdue(item.dueDate) ? "border-red-200 bg-red-50/30" : ""}`}>
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">{item.regulator}</span>
                                    <CardTitle className="text-sm font-semibold text-slate-900 mt-0.5 line-clamp-2">{item.filingType}</CardTitle>
                                </div>
                                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wide ${statusColor[item.status]}`}>
                                    {item.status}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                            <div className="flex-1 space-y-2">
                                <p className="text-xs text-slate-500">Due: <span className={`font-medium ${item.status === "PENDING" && isOverdue(item.dueDate) ? "text-red-600" : "text-slate-700"}`}>{new Date(item.dueDate).toLocaleDateString()}</span></p>
                                {item.submittedAt && <p className="text-xs text-slate-500">Submitted: <span className="font-medium text-emerald-700">{new Date(item.submittedAt).toLocaleDateString()}</span></p>}
                                {item.reference && <p className="text-xs font-mono text-slate-600 bg-slate-50 rounded px-2 py-1 border border-slate-100">{item.reference}</p>}
                                {item.notes && <p className="text-xs text-slate-500 line-clamp-2">{item.notes}</p>}
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="outline" size="sm" onClick={() => handleOpenEdit(item)} className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
                title={editing ? "Edit Regulatory Filing" : "Add Regulatory Filing"}
                description="Track a regulatory submission deadline and its status.">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-1.5">
                        <Label>Filing Type <span className="text-red-500">*</span></Label>
                        <Input {...register("filingType", { required: true })} placeholder="Quarterly ICT Risk Report" />
                        {errors.filingType && <p className="text-xs text-red-500">Required</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Regulator <span className="text-red-500">*</span></Label>
                            <Input {...register("regulator", { required: true })} placeholder="BOG, SEC, NCA..." />
                            {errors.regulator && <p className="text-xs text-red-500">Required</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select {...register("status")}>
                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Due Date <span className="text-red-500">*</span></Label>
                            <Input type="date" {...register("dueDate", { required: true })} />
                            {errors.dueDate && <p className="text-xs text-red-500">Required</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Submitted At</Label>
                            <Input type="date" {...register("submittedAt")} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Reference Number</Label>
                        <Input {...register("reference")} placeholder="BOG-ICT-2026-Q1-0042" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Input {...register("notes")} placeholder="Filing notes..." />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {editing ? "Save Changes" : "Create Filing"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
