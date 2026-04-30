"use client";

import { useState, useEffect, useMemo } from "react";
import { PatchRecord, PatchRecordDto, PatchStatus } from "@/types";
import { patchRecordService } from "@/services/complianceService";
import { assetService } from "@/services/assetService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, PackageCheck, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";


const STATUSES: PatchStatus[] = ["PLANNED", "APPLIED", "FAILED", "ROLLED_BACK"];

const statusColor: Record<PatchStatus, string> = {
    PLANNED: "bg-blue-100 text-blue-700 border-blue-200",
    APPLIED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    FAILED: "bg-red-100 text-red-700 border-red-200",
    ROLLED_BACK: "bg-amber-100 text-amber-700 border-amber-200",
};

export default function PatchRecordsPage() {
    const [items, setItems] = useState<PatchRecord[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<PatchRecord | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PatchRecordDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [patchData, assetsData] = await Promise.all([
                patchRecordService.getAll({ size: 100 }),
                assetService.getAll(),
            ]);
            setItems(patchData.items ?? patchData.content ?? []);
            setAssets(assetsData);
        } catch {
            toast.error("Failed to load patch records");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a.name])), [assets]);

    const stats = useMemo(() => ({
        planned: items.filter(i => i.status === "PLANNED").length,
        applied: items.filter(i => i.status === "APPLIED").length,
        failed: items.filter(i => i.status === "FAILED").length,
        rolledBack: items.filter(i => i.status === "ROLLED_BACK").length,
    }), [items]);

    const { confirm, ConfirmDialog } = useConfirm();
    const filtered = useMemo(() => {
        const base = statusFilter ? items.filter(i => i.status === statusFilter) : items;
        if (!search.trim()) return base;
        const q = search.toLowerCase();
        return base.filter(i =>
            i.patchName.toLowerCase().includes(q) ||
            (i.assetName ?? assetMap.get(i.assetId) ?? "").toLowerCase().includes(q) ||
            (i.version ?? "").toLowerCase().includes(q) ||
            (i.appliedByEmail ?? "").toLowerCase().includes(q)
        );
    }, [items, search, statusFilter, assetMap]);

    const handleOpenCreate = () => {
        setEditing(null);
        reset({ assetId: "", patchName: "", status: "PLANNED", testEnvironmentValidated: false });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: PatchRecord) => {
        setEditing(item);
        reset({
            assetId: item.assetId,
            patchName: item.patchName,
            version: item.version ?? "",
            appliedAt: item.appliedAt ? item.appliedAt.split("T")[0] : "",
            appliedByEmail: item.appliedByEmail ?? "",
            testEnvironmentValidated: item.testEnvironmentValidated ?? false,
            rollbackPlan: item.rollbackPlan ?? "",
            status: item.status,
            notes: item.notes ?? "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ message: "Delete this patch record?", variant: "danger" })) return;
        try {
            await patchRecordService.delete(id);
            toast.success("Deleted");
            fetchData();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const onSubmit = async (data: PatchRecordDto) => {
        try {
            const normalized: PatchRecordDto = {
                ...data,
                appliedAt: data.appliedAt
                    ? new Date(`${data.appliedAt}T00:00:00Z`).toISOString()
                    : undefined,
            };
            const clean = Object.fromEntries(Object.entries(normalized).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as PatchRecordDto;
            if (editing) {
                const editingNormalized: Partial<PatchRecordDto> = {
                    ...(editing as unknown as Partial<PatchRecordDto>),
                    appliedAt: editing.appliedAt ? new Date(editing.appliedAt).toISOString() : undefined,
                };
                const patch = buildPatchPayload<PatchRecordDto>(editingNormalized, clean);
                if (!Object.keys(patch).length) { toast("No changes"); return; }
                await patchRecordService.update(editing.id, patch);
                toast.success("Updated");
            } else {
                await patchRecordService.create(clean);
                toast.success("Patch record created");
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
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Patch Records</h1>
                    <p className="text-slate-500">Firmware and software patch history for ICS assets (IEC 62443 / NERC CIP).</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Patch Record
                </Button>
            </div>

            {!isLoading && items.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">{stats.planned}</div>
                        <div className="text-xs text-blue-600 font-semibold uppercase mt-1">Planned</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-emerald-700">{stats.applied}</div>
                        <div className="text-xs text-emerald-600 font-semibold uppercase mt-1">Applied</div>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
                        <div className="text-xs text-red-600 font-semibold uppercase mt-1">Failed</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-amber-700">{stats.rolledBack}</div>
                        <div className="text-xs text-amber-600 font-semibold uppercase mt-1">Rolled Back</div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by patch name, asset, version..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700">
                    <option value="">All Statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 bg-slate-100 rounded-xl animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <PackageCheck className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">{search ? "No patch records match your search" : "No patch records found"}</h3>
                        <p className="text-slate-500 mt-1">Track firmware and software patches applied to ICS assets.</p>
                        {!search && <Button onClick={handleOpenCreate} className="mt-6 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">Add Patch Record</Button>}
                    </div>
                ) : filtered.map(item => (
                    <Card key={item.id} className="group border-slate-200 hover:shadow-md transition-all flex flex-col">
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <CardTitle className="text-sm font-semibold text-slate-900 line-clamp-2">{item.patchName}</CardTitle>
                                    <span className="text-xs text-slate-500">{item.assetName || assetMap.get(item.assetId) || "Unknown Asset"}</span>
                                </div>
                                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wide ${statusColor[item.status]}`}>
                                    {item.status.replace(/_/g, " ")}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                            <div className="flex-1 space-y-2">
                                {item.version && <p className="text-xs font-mono text-slate-600 bg-slate-50 rounded px-2 py-1 border border-slate-100">v{item.version}</p>}
                                {item.appliedAt && <p className="text-xs text-slate-500">Applied: <span className="font-medium">{new Date(item.appliedAt).toLocaleString()}</span></p>}
                                {item.appliedByEmail && <p className="text-xs text-slate-500">By: <span className="font-medium">{item.appliedByEmail}</span></p>}
                                <div className="flex gap-2 flex-wrap">
                                    {item.testEnvironmentValidated && <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 border border-emerald-200">Test validated</span>}
                                </div>
                                {item.rollbackPlan && <p className="text-xs text-slate-500 line-clamp-2">Rollback: {item.rollbackPlan}</p>}
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
                title={editing ? "Edit Patch Record" : "Add Patch Record"}
                description="Log a firmware or software patch applied to an ICS asset.">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-1.5">
                        <Label>Asset <span className="text-red-500">*</span></Label>
                        <Select {...register("assetId", { required: true })} disabled={!!editing}>
                            <option value="">— Select asset —</option>
                            {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "NO-TAG"})</option>)}
                        </Select>
                        {errors.assetId && <p className="text-xs text-red-500">Required</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label>Patch Name <span className="text-red-500">*</span></Label>
                        <Input {...register("patchName", { required: true })} placeholder="Firmware security patch March 2026" />
                        {errors.patchName && <p className="text-xs text-red-500">Required</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Version</Label>
                            <Input {...register("version")} placeholder="V3.3.0" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select {...register("status")}>
                                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Applied At</Label>
                            <Input type="date" {...register("appliedAt")} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Applied By (Email)</Label>
                            <Input {...register("appliedByEmail")} placeholder="ops@company.com" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Rollback Plan</Label>
                        <Textarea {...register("rollbackPlan")} placeholder="Steps to rollback if patch fails..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Textarea {...register("notes")} placeholder="Additional notes..." />
                    </div>
                    <div className="flex items-center gap-2 py-1">
                        <input type="checkbox" id="testValidated" {...register("testEnvironmentValidated")} className="h-4 w-4 accent-teal-600 rounded" />
                        <Label htmlFor="testValidated" className="cursor-pointer">Validated in test environment</Label>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {editing ? "Save Changes" : "Create"}
                        </Button>
                    </div>
                </form>
        {ConfirmDialog}
            </Modal>
        </div>
    );
}
