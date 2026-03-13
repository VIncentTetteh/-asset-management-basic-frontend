"use client";

import { useState, useEffect, useMemo } from "react";
import { SecurityIncident, SecurityIncidentDto, IncidentStatus, IncidentSeverity, User } from "@/types";
import { incidentService } from "@/services/complianceService";
import { userService } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Siren, Search, User as UserIcon, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";

const STATUSES: IncidentStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const SEVERITIES: IncidentSeverity[] = ["P1_CRITICAL", "P2_HIGH", "P3_MEDIUM", "P4_LOW"];

const statusColor: Record<IncidentStatus, string> = {
    OPEN: "bg-red-100 text-red-700 border-red-200",
    IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",
    RESOLVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
};

const severityColor: Record<IncidentSeverity, string> = {
    P1_CRITICAL: "bg-red-600 text-white",
    P2_HIGH: "bg-orange-500 text-white",
    P3_MEDIUM: "bg-amber-400 text-white",
    P4_LOW: "bg-emerald-500 text-white",
};

export default function IncidentsPage() {
    const [items, setItems] = useState<SecurityIncident[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<SecurityIncident | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SecurityIncidentDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [res, usersData] = await Promise.all([
                incidentService.getAll({ size: 100 }),
                userService.getAll(),
            ]);
            setItems(res.content ?? []);
            setUsers(usersData);
        } catch {
            toast.error("Failed to load incidents");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const userMap = useMemo(() => new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`])), [users]);

    const filtered = useMemo(() => {
        const base = statusFilter ? items.filter(i => i.status === statusFilter) : items;
        if (!search.trim()) return base;
        const q = search.toLowerCase();
        return base.filter(i =>
            i.title.toLowerCase().includes(q) ||
            (i.category ?? "").toLowerCase().includes(q) ||
            (i.description ?? "").toLowerCase().includes(q)
        );
    }, [items, search, statusFilter]);

    const stats = useMemo(() => ({
        open: items.filter(i => i.status === "OPEN").length,
        inProgress: items.filter(i => i.status === "IN_PROGRESS").length,
        p1p2: items.filter(i => i.severity === "P1_CRITICAL" || i.severity === "P2_HIGH").length,
    }), [items]);

    const handleOpenCreate = () => {
        setEditing(null);
        reset({ title: "", severity: "P3_MEDIUM", status: "OPEN" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: SecurityIncident) => {
        setEditing(item);
        reset({
            title: item.title,
            description: item.description ?? "",
            severity: item.severity,
            category: item.category ?? "",
            reportedById: item.reportedById ?? "",
            assignedToId: item.assignedToId ?? "",
            detectedAt: item.detectedAt ? item.detectedAt.split("T")[0] : "",
            status: item.status,
            resolvedAt: item.resolvedAt ? item.resolvedAt.split("T")[0] : "",
            rootCause: item.rootCause ?? "",
            lessonsLearned: item.lessonsLearned ?? "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this incident?")) return;
        try {
            await incidentService.delete(id);
            toast.success("Deleted");
            fetchData();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const onSubmit = async (data: SecurityIncidentDto) => {
        try {
            const normalized: SecurityIncidentDto = {
                ...data,
                detectedAt: data.detectedAt
                    ? new Date(`${data.detectedAt}T00:00:00Z`).toISOString()
                    : undefined,
                resolvedAt: data.resolvedAt
                    ? new Date(`${data.resolvedAt}T00:00:00Z`).toISOString()
                    : undefined,
            };
            const clean = Object.fromEntries(Object.entries(normalized).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as SecurityIncidentDto;
            if (editing) {
                const editingNormalized: Partial<SecurityIncidentDto> = {
                    ...(editing as unknown as Partial<SecurityIncidentDto>),
                    detectedAt: editing.detectedAt ? new Date(editing.detectedAt).toISOString() : undefined,
                    resolvedAt: editing.resolvedAt ? new Date(editing.resolvedAt).toISOString() : undefined,
                };
                const patch = buildPatchPayload<SecurityIncidentDto>(editingNormalized, clean);
                if (!Object.keys(patch).length) { toast("No changes to save"); return; }
                await incidentService.update(editing.id, patch);
                toast.success("Incident updated");
            } else {
                await incidentService.create(clean);
                toast.success("Incident created");
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
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Security Incidents</h1>
                    <p className="text-slate-500">Incident management with severity triage and lifecycle tracking.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> Log Incident
                </Button>
            </div>

            {!isLoading && items.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-red-700">{stats.open}</div>
                        <div className="text-xs text-red-600 font-semibold uppercase mt-1">Open</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-amber-700">{stats.inProgress}</div>
                        <div className="text-xs text-amber-600 font-semibold uppercase mt-1">In Progress</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-orange-700">{stats.p1p2}</div>
                        <div className="text-xs text-orange-600 font-semibold uppercase mt-1">P1/P2 Severity</div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search incidents..."
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
                        <Siren className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">{search ? "No incidents match your search" : "No incidents logged"}</h3>
                        <p className="text-slate-500 mt-1">Record security incidents for tracking and post-mortem analysis.</p>
                        {!search && <Button onClick={handleOpenCreate} className="mt-6 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">Log Incident</Button>}
                    </div>
                ) : filtered.map(item => (
                    <Card key={item.id} className="group border-slate-200 hover:shadow-md transition-all flex flex-col">
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md mb-1.5 ${severityColor[item.severity]}`}>
                                        {item.severity.replace("_", " ")}
                                    </span>
                                    <CardTitle className="text-sm font-semibold text-slate-900 line-clamp-2">{item.title}</CardTitle>
                                </div>
                                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wide ${statusColor[item.status]}`}>
                                    {item.status.replace(/_/g, " ")}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                            <div className="flex-1 space-y-2">
                                {item.description && <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>}
                                {item.category && <p className="text-xs text-slate-500">Category: <span className="font-medium">{item.category}</span></p>}
                                {item.reportedById && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <UserIcon className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span className="truncate">Reported by: {userMap.get(item.reportedById) || item.reportedByEmail}</span>
                                    </div>
                                )}
                                {item.assignedToId && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <UserIcon className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span className="truncate">Assigned to: {userMap.get(item.assignedToId) || item.assignedToEmail}</span>
                                    </div>
                                )}
                                {item.detectedAt && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Clock className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span>Detected {new Date(item.detectedAt).toLocaleString()}</span>
                                    </div>
                                )}
                                {item.resolvedAt && <p className="text-xs text-emerald-600 font-medium">Resolved {new Date(item.resolvedAt).toLocaleDateString()}</p>}
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
                title={editing ? "Edit Incident" : "Log Incident"}
                description="Record a security incident for investigation and tracking.">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-1.5">
                        <Label>Title <span className="text-red-500">*</span></Label>
                        <Input {...register("title", { required: true })} placeholder="Incident title..." />
                        {errors.title && <p className="text-xs text-red-500">Required</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea {...register("description")} placeholder="Describe what happened..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Severity <span className="text-red-500">*</span></Label>
                            <Select {...register("severity", { required: true })}>
                                {SEVERITIES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select {...register("status")}>
                                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Category</Label>
                        <Input {...register("category")} placeholder="e.g. Phishing, Malware, Data Breach" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Reported By</Label>
                        <Select {...register("reportedById")}>
                            <option value="">— Select reporter —</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                            ))}
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Assigned To</Label>
                        <Select {...register("assignedToId")}>
                            <option value="">— Unassigned —</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                            ))}
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Detected At</Label>
                            <Input type="date" {...register("detectedAt")} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Resolved At</Label>
                            <Input type="date" {...register("resolvedAt")} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Root Cause</Label>
                        <Textarea {...register("rootCause")} placeholder="Root cause analysis..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Lessons Learned</Label>
                        <Textarea {...register("lessonsLearned")} placeholder="What was learned..." />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {editing ? "Save Changes" : "Log Incident"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
