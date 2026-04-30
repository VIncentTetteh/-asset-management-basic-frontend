"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
    FileText, Plus, RefreshCw, Search, Loader2, CheckCircle2, XCircle,
    Clock, AlertTriangle, ChevronRight, User,
} from "lucide-react";

import {
    dsarService,
    DsarDto,
    DsarType,
    DsarStatus,
    DsarStatusUpdate,
} from "@/services/dsarService";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";

// ── Constants ──────────────────────────────────────────────────────────────────

const REQUEST_TYPES: { value: DsarType; label: string; description: string }[] = [
    { value: "ACCESS", label: "Access", description: "Request a copy of personal data held" },
    { value: "ERASURE", label: "Erasure (Right to be Forgotten)", description: "Request deletion of personal data" },
    { value: "RECTIFICATION", label: "Rectification", description: "Correct inaccurate personal data" },
    { value: "PORTABILITY", label: "Portability", description: "Receive data in a portable format" },
    { value: "RESTRICTION", label: "Restriction", description: "Restrict processing of personal data" },
    { value: "OBJECTION", label: "Objection", description: "Object to processing of personal data" },
];

const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700 border border-amber-200",
    IN_PROGRESS: "bg-blue-100 text-blue-700 border border-blue-200",
    COMPLETED: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    REJECTED: "bg-red-100 text-red-700 border border-red-200",
    CANCELLED: "bg-slate-100 text-slate-600 border border-slate-200",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
    PENDING: <Clock className="h-3.5 w-3.5" />,
    IN_PROGRESS: <RefreshCw className="h-3.5 w-3.5" />,
    COMPLETED: <CheckCircle2 className="h-3.5 w-3.5" />,
    REJECTED: <XCircle className="h-3.5 w-3.5" />,
    CANCELLED: <XCircle className="h-3.5 w-3.5" />,
};

const fmt = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const daysLeft = (d?: string) => {
    if (!d) return null;
    const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
    return diff;
};

// ── Component ──────────────────────────────────────────────────────────────────

type SubmitForm = Pick<DsarDto, "requestType" | "subjectEmail" | "subjectName" | "subjectId" | "description">;

export default function DsarPage() {
    const [requests, setRequests] = useState<DsarDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<DsarStatus | "">("");
    const [isSubmitOpen, setIsSubmitOpen] = useState(false);
    const [updateTarget, setUpdateTarget] = useState<DsarDto | null>(null);
    const [detailTarget, setDetailTarget] = useState<DsarDto | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SubmitForm>();
    const { register: regU, handleSubmit: hsU, reset: resetU, formState: { isSubmitting: subU } } = useForm<DsarStatusUpdate>();

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const data = await dsarService.listAll();
            setRequests(data);
        } catch {
            toast.error("Failed to load DSAR requests");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const filtered = useMemo(() => {
        let list = [...requests];
        if (statusFilter) list = list.filter(r => r.status === statusFilter);
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(r =>
                (r.subjectEmail || "").toLowerCase().includes(q) ||
                (r.subjectName || "").toLowerCase().includes(q) ||
                (r.requestType || "").toLowerCase().includes(q)
            );
        }
        return list;
    }, [requests, statusFilter, searchTerm]);

    const pending = requests.filter(r => r.status === "PENDING").length;
    const inProgress = requests.filter(r => r.status === "IN_PROGRESS").length;
    const completed = requests.filter(r => r.status === "COMPLETED").length;

    const onSubmit = async (data: SubmitForm) => {
        try {
            await dsarService.submit(data);
            toast.success("DSAR submitted successfully");
            setIsSubmitOpen(false);
            reset();
            fetchAll();
        } catch {
            toast.error("Failed to submit DSAR");
        }
    };

    const onUpdateStatus = async (data: DsarStatusUpdate) => {
        if (!updateTarget?.id) return;
        try {
            await dsarService.updateStatus(updateTarget.id, data);
            toast.success("Status updated");
            setUpdateTarget(null);
            resetU();
            fetchAll();
        } catch {
            toast.error("Failed to update status");
        }
    };

    const openUpdate = (req: DsarDto) => {
        setUpdateTarget(req);
        resetU({ status: req.status as DsarStatus, responseNotes: req.responseNotes || "" });
    };

    if (isLoading) return <PageSpinner />;

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Data Subject Access Requests"
                subtitle="Manage GDPR/NDPA requests from data subjects — access, erasure, rectification, and more"
                actions={
                    <Button onClick={() => { reset({ requestType: "ACCESS" }); setIsSubmitOpen(true); }} className="gap-2">
                        <Plus className="h-4 w-4" /> New DSAR
                    </Button>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{pending}</p>
                                <p className="text-xs text-slate-500">Pending</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                <RefreshCw className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{inProgress}</p>
                                <p className="text-xs text-slate-500">In Progress</p>
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
                                <p className="text-2xl font-bold text-slate-900">{completed}</p>
                                <p className="text-xs text-slate-500">Completed</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Regulatory note */}
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-blue-800">Regulatory Deadlines</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                        GDPR requires responses within 30 days. NDPA (Ghana) allows up to 21 days. Mark requests as IN_PROGRESS immediately upon receipt and track due dates carefully.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-sm">
                <CardContent className="pt-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search by subject or request type…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                        </div>
                        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as DsarStatus | "")} className="w-44">
                            <option value="">All Statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="CANCELLED">Cancelled</option>
                        </Select>
                        <Button variant="outline" size="icon" onClick={fetchAll}><RefreshCw className="h-4 w-4" /></Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-900">
                        DSAR Requests
                        <span className="ml-2 text-sm font-normal text-slate-400">({filtered.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <FileText className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No DSAR requests found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Subject</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Request Type</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Submitted</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Due Date</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map((req, i) => {
                                        const days = daysLeft(req.dueDate);
                                        const isUrgent = days !== null && days <= 7 && req.status !== "COMPLETED" && req.status !== "REJECTED";
                                        return (
                                            <tr key={req.id || i} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                            <User className="h-4 w-4 text-slate-500" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-900">{req.subjectName || "—"}</p>
                                                            <p className="text-xs text-slate-400">{req.subjectEmail || req.subjectId || "—"}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                                                        {REQUEST_TYPES.find(t => t.value === req.requestType)?.label || req.requestType || "—"}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STATUS_STYLES[req.status || "PENDING"] || "bg-slate-100 text-slate-600"}`}>
                                                        {STATUS_ICON[req.status || "PENDING"]}
                                                        {req.status || "PENDING"}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-slate-600">{fmt(req.createdAt)}</td>
                                                <td className="py-3 px-4">
                                                    {req.dueDate ? (
                                                        <div>
                                                            <p className={isUrgent ? "text-red-600 font-medium" : "text-slate-600"}>{fmt(req.dueDate)}</p>
                                                            {isUrgent && days !== null && (
                                                                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                                                                    <AlertTriangle className="h-3 w-3" />
                                                                    {days <= 0 ? "OVERDUE" : `${days}d left`}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : "—"}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 px-2 text-xs gap-1"
                                                            onClick={() => setDetailTarget(req)}
                                                        >
                                                            View
                                                        </Button>
                                                        {req.status !== "COMPLETED" && req.status !== "CANCELLED" && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 px-2 text-xs gap-1"
                                                                onClick={() => openUpdate(req)}
                                                            >
                                                                Update Status
                                                            </Button>
                                                        )}
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

            {/* Submit DSAR Modal */}
            <Modal isOpen={isSubmitOpen} onClose={() => setIsSubmitOpen(false)} title="Submit Data Subject Access Request" description="Record a new request from a data subject">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="d-type">Request Type *</Label>
                        <Select id="d-type" {...register("requestType", { required: "Request type required" })}>
                            {REQUEST_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </Select>
                        {errors.requestType && <p className="text-xs text-red-500 mt-1">{errors.requestType.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="d-name">Subject Name</Label>
                            <Input id="d-name" placeholder="Full name…" {...register("subjectName")} />
                        </div>
                        <div>
                            <Label htmlFor="d-email">Subject Email</Label>
                            <Input id="d-email" type="email" placeholder="email@example.com" {...register("subjectEmail")} />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="d-sid">Subject ID *</Label>
                        <Input id="d-sid" placeholder="Internal user/customer ID" {...register("subjectId", { required: "Subject ID required" })} />
                        {errors.subjectId && <p className="text-xs text-red-500 mt-1">{errors.subjectId.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="d-desc">Description / Request Details</Label>
                        <Textarea id="d-desc" rows={3} placeholder="What specific data is the subject requesting access to or deletion of?" {...register("description")} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                            Submit DSAR
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsSubmitOpen(false)} className="flex-1">Cancel</Button>
                    </div>
                </form>
            </Modal>

            {/* Update Status Modal */}
            <Modal
                isOpen={!!updateTarget}
                onClose={() => setUpdateTarget(null)}
                title="Update DSAR Status"
                description={`${updateTarget?.subjectName || updateTarget?.subjectEmail || "Request"} — ${updateTarget?.requestType}`}
            >
                <form onSubmit={hsU(onUpdateStatus)} className="space-y-4">
                    <div>
                        <Label htmlFor="u-status">New Status *</Label>
                        <Select id="u-status" {...regU("status", { required: "Status required" })}>
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="CANCELLED">Cancelled</option>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="u-notes">Response Notes</Label>
                        <Textarea id="u-notes" rows={3} placeholder="Internal notes on how the request was handled…" {...regU("responseNotes")} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={subU} className="flex-1 gap-2">
                            {subU ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Update Status
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setUpdateTarget(null)} className="flex-1">Cancel</Button>
                    </div>
                </form>
            </Modal>

            {/* Detail Modal */}
            <Modal isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} title="DSAR Detail" description={`ID: ${detailTarget?.id?.slice(0, 16) || "—"}`}>
                {detailTarget && (
                    <div className="space-y-3 text-sm">
                        {[
                            ["Subject", detailTarget.subjectName || "—"],
                            ["Email", detailTarget.subjectEmail || "—"],
                            ["Subject ID", detailTarget.subjectId || "—"],
                            ["Request Type", REQUEST_TYPES.find(t => t.value === detailTarget.requestType)?.label || detailTarget.requestType || "—"],
                            ["Status", detailTarget.status || "—"],
                            ["Submitted", fmt(detailTarget.createdAt)],
                            ["Due Date", fmt(detailTarget.dueDate)],
                            ["Completed", fmt(detailTarget.completedAt)],
                        ].map(([label, value]) => (
                            <div key={label} className="flex justify-between border-b border-slate-50 pb-2">
                                <span className="text-slate-500">{label}</span>
                                <span className="text-slate-900 font-medium text-right max-w-[60%]">{value}</span>
                            </div>
                        ))}
                        {detailTarget.description && (
                            <div>
                                <p className="text-slate-500 mb-1">Description</p>
                                <p className="text-slate-700 bg-slate-50 rounded p-2 text-xs">{detailTarget.description}</p>
                            </div>
                        )}
                        {detailTarget.responseNotes && (
                            <div>
                                <p className="text-slate-500 mb-1">Response Notes</p>
                                <p className="text-slate-700 bg-slate-50 rounded p-2 text-xs">{detailTarget.responseNotes}</p>
                            </div>
                        )}
                        <Button className="w-full mt-2" variant="outline" onClick={() => setDetailTarget(null)}>Close</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
}
