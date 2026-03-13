"use client";

import { useState, useEffect, useMemo } from "react";
import { Risk, RiskDto, RiskStatus, RiskTreatment, ComplianceFramework, User } from "@/types";
import { riskService } from "@/services/complianceService";
import { userService } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, AlertTriangle, Search, User as UserIcon, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";

const STATUSES: RiskStatus[] = ["OPEN", "IN_TREATMENT", "CLOSED", "ACCEPTED"];
const TREATMENTS: RiskTreatment[] = ["ACCEPT", "MITIGATE", "TRANSFER", "AVOID"];
const FRAMEWORKS: ComplianceFramework[] = ["ISO_27001", "SOC2", "PCI_DSS", "ICS", "BOG"];

const statusColor: Record<RiskStatus, string> = {
    OPEN: "bg-red-100 text-red-700 border-red-200",
    IN_TREATMENT: "bg-amber-100 text-amber-700 border-amber-200",
    CLOSED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ACCEPTED: "bg-slate-100 text-slate-600 border-slate-200",
};

const riskScoreBg = (score: number) => {
    if (score >= 15) return "bg-red-600 text-white";
    if (score >= 8) return "bg-amber-500 text-white";
    return "bg-emerald-500 text-white";
};

export default function RisksPage() {
    const [items, setItems] = useState<Risk[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Risk | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RiskDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [res, usersData] = await Promise.all([
                riskService.getAll({ status: (statusFilter as RiskStatus) || undefined, size: 100 }),
                userService.getAll(),
            ]);
            setItems(res.content ?? []);
            setUsers(usersData);
        } catch {
            toast.error("Failed to load risks");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [statusFilter]);

    const userMap = useMemo(() => new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`])), [users]);

    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter(i =>
            i.title.toLowerCase().includes(q) ||
            (i.riskId ?? "").toLowerCase().includes(q) ||
            (i.description ?? "").toLowerCase().includes(q)
        );
    }, [items, search]);

    const stats = useMemo(() => ({
        open: items.filter(i => i.status === "OPEN").length,
        inTreatment: items.filter(i => i.status === "IN_TREATMENT").length,
        closed: items.filter(i => i.status === "CLOSED").length,
        high: items.filter(i => i.riskScore >= 15).length,
    }), [items]);

    const handleOpenCreate = () => {
        setEditing(null);
        reset({ title: "", likelihood: 3, impact: 3, status: "OPEN", treatment: "MITIGATE" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: Risk) => {
        setEditing(item);
        reset({
            framework: item.framework ?? undefined,
            riskId: item.riskId ?? "",
            title: item.title,
            description: item.description ?? "",
            likelihood: item.likelihood,
            impact: item.impact,
            treatment: item.treatment ?? undefined,
            mitigationPlan: item.mitigationPlan ?? "",
            residualRisk: item.residualRisk ?? undefined,
            status: item.status,
            ownerId: item.ownerId ?? "",
            reviewDate: item.reviewDate ? item.reviewDate.split("T")[0] : "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this risk?")) return;
        try {
            await riskService.delete(id);
            toast.success("Risk deleted");
            fetchData();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const onSubmit = async (data: RiskDto) => {
        try {
            const normalized: RiskDto = {
                ...data,
                likelihood: Number(data.likelihood),
                impact: Number(data.impact),
                residualRisk: data.residualRisk !== undefined && data.residualRisk !== null && data.residualRisk !== ""
                    ? Number(data.residualRisk)
                    : undefined,
                reviewDate: data.reviewDate
                    ? new Date(`${data.reviewDate}T00:00:00Z`).toISOString()
                    : undefined,
            };
            const clean = Object.fromEntries(Object.entries(normalized).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as RiskDto;
            if (editing) {
                const editingNormalized: Partial<RiskDto> = {
                    ...(editing as unknown as Partial<RiskDto>),
                    reviewDate: editing.reviewDate ? new Date(editing.reviewDate).toISOString() : undefined,
                };
                const patch = buildPatchPayload<RiskDto>(editingNormalized, clean);
                if (!Object.keys(patch).length) { toast("No changes to save"); return; }
                await riskService.update(editing.id, patch);
                toast.success("Risk updated");
            } else {
                await riskService.create(clean);
                toast.success("Risk created");
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
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Risk Register</h1>
                    <p className="text-slate-500">Organisation-wide risk tracking with likelihood × impact scoring.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Risk
                </Button>
            </div>

            {!isLoading && items.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-red-700">{stats.open}</div>
                        <div className="text-xs text-red-600 font-semibold uppercase mt-1">Open</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-amber-700">{stats.inTreatment}</div>
                        <div className="text-xs text-amber-600 font-semibold uppercase mt-1">In Treatment</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-emerald-700">{stats.closed}</div>
                        <div className="text-xs text-emerald-600 font-semibold uppercase mt-1">Closed</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-slate-700">{stats.high}</div>
                        <div className="text-xs text-slate-500 font-semibold uppercase mt-1">High Risk (≥15)</div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search risks..."
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
                        <AlertTriangle className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">{search ? "No risks match your search" : "No risks found"}</h3>
                        <p className="text-slate-500 mt-1">Start logging organisational risks to manage them effectively.</p>
                        {!search && <Button onClick={handleOpenCreate} className="mt-6 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">Add Risk</Button>}
                    </div>
                ) : filtered.map(item => (
                    <Card key={item.id} className="group border-slate-200 hover:shadow-md transition-all flex flex-col">
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    {item.riskId && <span className="text-xs font-mono text-slate-400">{item.riskId}</span>}
                                    <CardTitle className="text-sm font-semibold text-slate-900 mt-0.5 line-clamp-2">{item.title}</CardTitle>
                                </div>
                                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wide ${statusColor[item.status]}`}>
                                    {item.status.replace(/_/g, " ")}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
                            <div className="flex-1 space-y-2">
                                {item.description && <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>}
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-slate-50 rounded-lg p-2">
                                        <div className="text-xs text-slate-400 uppercase tracking-wide">Likelihood</div>
                                        <div className="font-bold text-slate-800">{item.likelihood}/5</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-2">
                                        <div className="text-xs text-slate-400 uppercase tracking-wide">Impact</div>
                                        <div className="font-bold text-slate-800">{item.impact}/5</div>
                                    </div>
                                    <div className={`rounded-lg p-2 ${riskScoreBg(item.riskScore)}`}>
                                        <div className="text-xs uppercase tracking-wide opacity-80">Score</div>
                                        <div className="font-bold">{item.riskScore}</div>
                                    </div>
                                </div>
                                {item.treatment && <p className="text-xs text-slate-500">Treatment: <span className="font-medium text-slate-700">{item.treatment}</span></p>}
                                {item.ownerId && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <UserIcon className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span className="truncate">{userMap.get(item.ownerId) || item.ownerEmail || item.ownerId}</span>
                                    </div>
                                )}
                                {item.reviewDate && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span>Review {new Date(item.reviewDate).toLocaleDateString()}</span>
                                    </div>
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
                title={editing ? "Edit Risk" : "Add Risk"}
                description="Log a risk with likelihood and impact scoring.">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Risk ID</Label>
                            <Input {...register("riskId")} placeholder="RISK-001" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Framework</Label>
                            <Select {...register("framework")}>
                                <option value="">None</option>
                                {FRAMEWORKS.map(f => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Title <span className="text-red-500">*</span></Label>
                        <Input {...register("title", { required: true })} placeholder="Unauthorised access to customer data" />
                        {errors.title && <p className="text-xs text-red-500">Required</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea {...register("description")} placeholder="Describe the risk..." />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label>Likelihood (1–5) <span className="text-red-500">*</span></Label>
                            <Input type="number" min={1} max={5} {...register("likelihood", { required: true, min: 1, max: 5 })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Impact (1–5) <span className="text-red-500">*</span></Label>
                            <Input type="number" min={1} max={5} {...register("impact", { required: true, min: 1, max: 5 })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Residual Risk</Label>
                            <Input type="number" min={1} max={25} {...register("residualRisk")} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select {...register("status")}>
                                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Treatment</Label>
                            <Select {...register("treatment")}>
                                <option value="">None</option>
                                {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Mitigation Plan</Label>
                        <Textarea {...register("mitigationPlan")} placeholder="Steps to mitigate..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Risk Owner</Label>
                        <Select {...register("ownerId")}>
                            <option value="">— No owner assigned —</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                            ))}
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Review Date</Label>
                        <Input type="date" {...register("reviewDate")} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {editing ? "Save Changes" : "Create Risk"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
