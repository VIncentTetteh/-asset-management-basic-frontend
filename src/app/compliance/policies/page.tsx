"use client";

import { useState, useEffect, useMemo } from "react";
import { SecurityPolicy, SecurityPolicyDto, PolicyStatus, User } from "@/types";
import { policyService } from "@/services/complianceService";
import { userService } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, FileText, Search, ExternalLink, User as UserIcon, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";
import DocumentAttachments from "@/components/DocumentAttachments";


const STATUSES: PolicyStatus[] = ["DRAFT", "UNDER_REVIEW", "APPROVED", "RETIRED"];

const statusColor: Record<PolicyStatus, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    UNDER_REVIEW: "bg-amber-100 text-amber-700 border-amber-200",
    APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    RETIRED: "bg-red-100 text-red-600 border-red-200",
};

export default function PoliciesPage() {
    const [items, setItems] = useState<SecurityPolicy[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<SecurityPolicy | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SecurityPolicyDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [data, usersData] = await Promise.all([
                policyService.getAll(),
                userService.getAll(),
            ]);
            setItems(data);
            setUsers(usersData);
        } catch {
            toast.error("Failed to load policies");
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
            (i.ownerEmail ?? "").toLowerCase().includes(q) ||
            (i.approvedByEmail ?? "").toLowerCase().includes(q)
        );
    }, [items, search, statusFilter]);

    const { confirm, ConfirmDialog } = useConfirm();
    const stats = useMemo(() => ({
        approved: items.filter(i => i.status === "APPROVED").length,
        underReview: items.filter(i => i.status === "UNDER_REVIEW").length,
        draft: items.filter(i => i.status === "DRAFT").length,
        retired: items.filter(i => i.status === "RETIRED").length,
    }), [items]);

    const handleOpenCreate = () => {
        setEditing(null);
        reset({ title: "", status: "DRAFT", version: "1.0" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: SecurityPolicy) => {
        setEditing(item);
        reset({
            title: item.title,
            version: item.version ?? "",
            documentUrl: item.documentUrl ?? "",
            ownerId: item.ownerId ?? "",
            reviewDueDate: item.reviewDueDate ? item.reviewDueDate.split("T")[0] : "",
            status: item.status,
            approvedByEmail: item.approvedByEmail ?? "",
            effectiveDate: item.effectiveDate ? item.effectiveDate.split("T")[0] : "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ message: "Delete this policy?", variant: "danger" })) return;
        try {
            await policyService.delete(id);
            toast.success("Deleted");
            fetchData();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const onSubmit = async (data: SecurityPolicyDto) => {
        try {
            const normalized: SecurityPolicyDto = {
                ...data,
                effectiveDate: data.effectiveDate
                    ? new Date(`${data.effectiveDate}T00:00:00Z`).toISOString()
                    : undefined,
                reviewDueDate: data.reviewDueDate
                    ? new Date(`${data.reviewDueDate}T00:00:00Z`).toISOString()
                    : undefined,
            };
            const clean = Object.fromEntries(Object.entries(normalized).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as SecurityPolicyDto;
            if (editing) {
                const editingNormalized: Partial<SecurityPolicyDto> = {
                    ...(editing as unknown as Partial<SecurityPolicyDto>),
                    effectiveDate: editing.effectiveDate ? new Date(editing.effectiveDate).toISOString() : undefined,
                    reviewDueDate: editing.reviewDueDate ? new Date(editing.reviewDueDate).toISOString() : undefined,
                };
                const patch = buildPatchPayload<SecurityPolicyDto>(editingNormalized, clean);
                if (!Object.keys(patch).length) { toast("No changes to save"); return; }
                await policyService.update(editing.id, patch);
                toast.success("Policy updated");
            } else {
                await policyService.create(clean);
                toast.success("Policy created");
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
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Security Policies</h1>
                    <p className="text-slate-500">Policy lifecycle management from draft through approval.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> New Policy
                </Button>
            </div>

            {!isLoading && items.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-emerald-700">{stats.approved}</div>
                        <div className="text-xs text-emerald-600 font-semibold uppercase mt-1">Approved</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-amber-700">{stats.underReview}</div>
                        <div className="text-xs text-amber-600 font-semibold uppercase mt-1">Under Review</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-slate-700">{stats.draft}</div>
                        <div className="text-xs text-slate-500 font-semibold uppercase mt-1">Draft</div>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">{stats.retired}</div>
                        <div className="text-xs text-red-500 font-semibold uppercase mt-1">Retired</div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search policies..."
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
                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <FileText className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">{search ? "No policies match your search" : "No policies found"}</h3>
                        <p className="text-slate-500 mt-1">Create and manage security policies for your organisation.</p>
                        {!search && <Button onClick={handleOpenCreate} className="mt-6 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">New Policy</Button>}
                    </div>
                ) : filtered.map(item => (
                    <Card key={item.id} className="group border-slate-200 hover:shadow-md transition-all flex flex-col">
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                    <FileText className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <CardTitle className="text-sm font-semibold text-slate-900 line-clamp-2">{item.title}</CardTitle>
                                        {item.version && <span className="text-xs text-slate-400">v{item.version}</span>}
                                    </div>
                                </div>
                                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wide ${statusColor[item.status]}`}>
                                    {item.status.replace(/_/g, " ")}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                            <div className="flex-1 space-y-2">
                                {item.ownerId && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <UserIcon className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span className="truncate">Owner: {userMap.get(item.ownerId) || item.ownerEmail}</span>
                                    </div>
                                )}
                                {item.approvedByEmail && <p className="text-xs text-slate-500">Approved by: <span className="font-medium">{item.approvedByEmail}</span></p>}
                                {item.effectiveDate && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span>Effective {new Date(item.effectiveDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                                {item.reviewDueDate && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span>Review due {new Date(item.reviewDueDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                                {item.documentUrl && (
                                    <a href={item.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
                                        <ExternalLink className="h-3 w-3" /> View Document
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
                title={editing ? "Edit Policy" : "New Policy"}
                description="Manage a security policy document lifecycle.">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-1.5">
                        <Label>Title <span className="text-red-500">*</span></Label>
                        <Input {...register("title", { required: true })} placeholder="Information Security Policy" />
                        {errors.title && <p className="text-xs text-red-500">Required</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Version</Label>
                            <Input {...register("version")} placeholder="1.0" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select {...register("status")}>
                                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                            </Select>
                        </div>
                    </div>
                    {editing && (
                        <div className="space-y-1.5">
                            <Label>Policy Documents</Label>
                            {editing.documentUrl && (
                                <p className="text-xs text-slate-500 mb-1">
                                    Legacy link:{" "}
                                    <a href={editing.documentUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
                                        {editing.documentUrl}
                                    </a>
                                </p>
                            )}
                            <DocumentAttachments entityType="SECURITY_POLICY" entityId={editing.id} />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label>Policy Owner</Label>
                        <Select {...register("ownerId")}>
                            <option value="">— No owner assigned —</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                            ))}
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Approved By (Email)</Label>
                        <Input {...register("approvedByEmail")} placeholder="approver@company.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Effective Date</Label>
                            <Input type="date" {...register("effectiveDate")} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Review Due Date</Label>
                            <Input type="date" {...register("reviewDueDate")} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {editing ? "Save Changes" : "Create Policy"}
                        </Button>
                    </div>
                </form>
        {ConfirmDialog}
            </Modal>
        </div>
    );
}
