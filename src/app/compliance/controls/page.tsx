"use client";

import { useState, useEffect, useMemo } from "react";
import { ComplianceControl, ComplianceControlDto, ComplianceFramework, ControlStatus, User } from "@/types";
import { complianceControlService } from "@/services/complianceService";
import { userService } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, ShieldCheck, Search, ExternalLink, User as UserIcon, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";


const FRAMEWORKS: ComplianceFramework[] = ["ISO_27001", "SOC2", "PCI_DSS", "ICS", "BOG"];
const STATUSES: ControlStatus[] = ["NOT_IMPLEMENTED", "PARTIAL", "IMPLEMENTED", "NOT_APPLICABLE"];

const statusColor: Record<ControlStatus, string> = {
    NOT_IMPLEMENTED: "bg-red-100 text-red-700 border-red-200",
    PARTIAL: "bg-amber-100 text-amber-700 border-amber-200",
    IMPLEMENTED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    NOT_APPLICABLE: "bg-slate-100 text-slate-500 border-slate-200",
};

const frameworkBadge: Record<ComplianceFramework, string> = {
    ISO_27001: "bg-blue-50 text-blue-700",
    SOC2: "bg-purple-50 text-purple-700",
    PCI_DSS: "bg-orange-50 text-orange-700",
    ICS: "bg-teal-50 text-teal-700",
    BOG: "bg-slate-100 text-slate-700",
};

export default function ComplianceControlsPage() {
    const [items, setItems] = useState<ComplianceControl[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<ComplianceControl | null>(null);
    const [search, setSearch] = useState("");
    const [frameworkFilter, setFrameworkFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ComplianceControlDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [data, usersData] = await Promise.all([
                complianceControlService.getAll({
                    framework: frameworkFilter || undefined,
                    status: (statusFilter as ControlStatus) || undefined,
                }),
                userService.getAll(),
            ]);
            setItems(data);
            setUsers(usersData);
        } catch {
            toast.error("Failed to load compliance controls");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [frameworkFilter, statusFilter]);

    const userMap = useMemo(() => new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`])), [users]);

    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter(i =>
            i.controlName.toLowerCase().includes(q) ||
            i.controlRef.toLowerCase().includes(q) ||
            i.framework.toLowerCase().includes(q) ||
            (i.ownerEmail ?? "").toLowerCase().includes(q)
        );
    }, [items, search]);

    const { confirm, ConfirmDialog } = useConfirm();
    const stats = useMemo(() => ({
        implemented: items.filter(i => i.status === "IMPLEMENTED").length,
        partial: items.filter(i => i.status === "PARTIAL").length,
        notImpl: items.filter(i => i.status === "NOT_IMPLEMENTED").length,
    }), [items]);

    const handleOpenCreate = () => {
        setEditing(null);
        reset({ framework: "ISO_27001", controlRef: "", controlName: "", status: "NOT_IMPLEMENTED" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: ComplianceControl) => {
        setEditing(item);
        reset({
            framework: item.framework,
            controlRef: item.controlRef,
            controlName: item.controlName,
            controlDescription: item.controlDescription ?? "",
            status: item.status,
            justification: item.justification ?? "",
            evidenceUrl: item.evidenceUrl ?? "",
            gapDescription: item.gapDescription ?? "",
            remediationPlan: item.remediationPlan ?? "",
            ownerId: item.ownerId ?? "",
            reviewDueDate: item.reviewDueDate ? item.reviewDueDate.split("T")[0] : "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ message: "Delete this control?", variant: "danger" })) return;
        try {
            await complianceControlService.delete(id);
            toast.success("Control deleted");
            fetchData();
        } catch {
            toast.error("Failed to delete control");
        }
    };

    const onSubmit = async (data: ComplianceControlDto) => {
        try {
            const normalized: ComplianceControlDto = {
                ...data,
                reviewDueDate: data.reviewDueDate
                    ? new Date(`${data.reviewDueDate}T00:00:00Z`).toISOString()
                    : undefined,
            };
            const clean = Object.fromEntries(Object.entries(normalized).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as ComplianceControlDto;
            if (editing) {
                const editingNormalized: Partial<ComplianceControlDto> = {
                    ...(editing as unknown as Partial<ComplianceControlDto>),
                    reviewDueDate: editing.reviewDueDate ? new Date(editing.reviewDueDate).toISOString() : undefined,
                };
                const patch = buildPatchPayload<ComplianceControlDto>(editingNormalized, clean);
                if (!Object.keys(patch).length) { toast("No changes to save"); return; }
                await complianceControlService.update(editing.id, patch);
                toast.success("Control updated");
            } else {
                await complianceControlService.create(clean);
                toast.success("Control created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch {
            toast.error("Failed to save control");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Compliance Controls</h1>
                    <p className="text-slate-500">Multi-framework control tracking — ISO 27001, SOC 2, PCI-DSS, ICS, BOG.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Control
                </Button>
            </div>

            {!isLoading && items.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-emerald-700">{stats.implemented}</div>
                        <div className="text-xs text-emerald-600 font-semibold uppercase mt-1">Implemented</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-amber-700">{stats.partial}</div>
                        <div className="text-xs text-amber-600 font-semibold uppercase mt-1">Partial</div>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-red-700">{stats.notImpl}</div>
                        <div className="text-xs text-red-600 font-semibold uppercase mt-1">Not Implemented</div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, ref, framework..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <select value={frameworkFilter} onChange={e => setFrameworkFilter(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700">
                    <option value="">All Frameworks</option>
                    {FRAMEWORKS.map(f => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700">
                    <option value="">All Statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <ShieldCheck className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">{search ? "No controls match your search" : "No controls found"}</h3>
                        <p className="text-slate-500 mt-1">Add your first compliance control to get started.</p>
                        {!search && <Button onClick={handleOpenCreate} className="mt-6 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">Add Control</Button>}
                    </div>
                ) : filtered.map(item => (
                    <Card key={item.id} className="group border-slate-200 hover:shadow-md transition-all flex flex-col">
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${frameworkBadge[item.framework]}`}>
                                            {item.framework.replace("_", " ")}
                                        </span>
                                        <span className="text-xs font-mono text-slate-500">{item.controlRef}</span>
                                    </div>
                                    <CardTitle className="text-sm font-semibold text-slate-900 line-clamp-2">{item.controlName}</CardTitle>
                                </div>
                                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wide ${statusColor[item.status]}`}>
                                    {item.status.replace(/_/g, " ")}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                            <div className="flex-1 space-y-2">
                                {item.controlDescription && <p className="text-xs text-slate-500 line-clamp-2">{item.controlDescription}</p>}
                                {item.ownerId && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <UserIcon className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span className="truncate">{userMap.get(item.ownerId) || item.ownerEmail || item.ownerId}</span>
                                    </div>
                                )}
                                {item.reviewDueDate && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span>Review {new Date(item.reviewDueDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                                {item.gapDescription && (
                                    <div className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1.5 border border-amber-100 line-clamp-2">
                                        <span className="font-semibold">Gap: </span>{item.gapDescription}
                                    </div>
                                )}
                                {item.evidenceUrl && (
                                    <a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
                                        <ExternalLink className="h-3 w-3" /> View Evidence
                                    </a>
                                )}
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
                title={editing ? "Edit Control" : "Add Control"}
                description="Define a compliance control for your framework.">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Framework <span className="text-red-500">*</span></Label>
                            <Select {...register("framework", { required: true })}>
                                {FRAMEWORKS.map(f => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
                            </Select>
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
                            <Label>Control Ref <span className="text-red-500">*</span></Label>
                            <Input {...register("controlRef", { required: true })} placeholder="A.9.1.1" />
                            {errors.controlRef && <p className="text-xs text-red-500">Required</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Review Due Date</Label>
                            <Input type="date" {...register("reviewDueDate")} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Control Name <span className="text-red-500">*</span></Label>
                        <Input {...register("controlName", { required: true })} placeholder="Access Control Policy" />
                        {errors.controlName && <p className="text-xs text-red-500">Required</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea {...register("controlDescription")} placeholder="Brief description of the control..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Control Owner</Label>
                        <Select {...register("ownerId")}>
                            <option value="">— No owner assigned —</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                            ))}
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Justification</Label>
                        <Textarea {...register("justification")} placeholder="Justification for current status..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Evidence URL</Label>
                        <Input {...register("evidenceUrl")} placeholder="https://drive.example.com/..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Gap Description</Label>
                        <Textarea {...register("gapDescription")} placeholder="Describe any gaps in implementation..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Remediation Plan</Label>
                        <Textarea {...register("remediationPlan")} placeholder="Steps and timeline to remediate..." />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {editing ? "Save Changes" : "Create Control"}
                        </Button>
                    </div>
                </form>
        {ConfirmDialog}
            </Modal>
        </div>
    );
}
