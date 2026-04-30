"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
    FileSignature, Plus, Pencil, Trash2, Clock, AlertTriangle,
    CheckCircle2, XCircle, Loader2, RefreshCw, Search, Calendar,
    DollarSign, ToggleLeft,
} from "lucide-react";

import { leaseRecordService, LeaseRecordDto, LeaseStatus } from "@/services/leaseRecordService";
import { assetService } from "@/services/assetService";
import { Asset } from "@/types";

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
    ACTIVE: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    EXPIRED: "bg-slate-100 text-slate-600 border border-slate-200",
    TERMINATED: "bg-red-100 text-red-700 border border-red-200",
    PENDING_RENEWAL: "bg-amber-100 text-amber-700 border border-amber-200",
};

const fmt = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const daysUntil = (d?: string) => {
    if (!d) return null;
    return Math.round((new Date(d).getTime() - Date.now()) / 86400000);
};

// ── Component ──────────────────────────────────────────────────────────────────

type FormData = Omit<LeaseRecordDto, "id" | "organisationId" | "createdAt" | "status">;

export default function LeasesPage() {
    const { format: fmtCurrency } = useCurrency();
    const [leases, setLeases] = useState<LeaseRecordDto[]>([]);
    const [expiring, setExpiring] = useState<LeaseRecordDto[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<LeaseStatus | "">("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<LeaseRecordDto | null>(null);
    const [terminatingId, setTerminatingId] = useState<string | null>(null);
    const [terminateReason, setTerminateReason] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>();
    const { confirm, ConfirmDialog } = useConfirm();

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const [leasesRes, expiringRes, assetsRes] = await Promise.allSettled([
                leaseRecordService.listAll(),
                leaseRecordService.listExpiringSoon(30),
                assetService.getAll(),
            ]);
            if (leasesRes.status === "fulfilled") setLeases(leasesRes.value);
            if (expiringRes.status === "fulfilled") setExpiring(expiringRes.value);
            if (assetsRes.status === "fulfilled") setAssets(assetsRes.value);
        } catch {
            toast.error("Failed to load lease records");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);

    const filtered = useMemo(() => {
        let list = [...leases];
        if (statusFilter) list = list.filter(l => l.status === statusFilter);
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(l =>
                (l.assetName || assetMap.get(l.assetId || "")?.name || "").toLowerCase().includes(q) ||
                (l.lessorName || "").toLowerCase().includes(q)
            );
        }
        return list;
    }, [leases, statusFilter, searchTerm, assetMap]);

    const active = leases.filter(l => l.status === "ACTIVE").length;
    const expiredCount = leases.filter(l => l.status === "EXPIRED").length;
    const totalMonthly = leases.filter(l => l.status === "ACTIVE").reduce((s, l) => s + (l.monthlyPayment || 0), 0);

    const openCreate = () => {
        setEditing(null);
        reset({
            assetId: "", lessorName: "", startDate: "", endDate: "",
            monthlyPayment: 0, currency: "USD", autoRenew: false,
            noticePeriodDays: 30, notes: "",
        });
        setIsModalOpen(true);
    };

    const openEdit = (lease: LeaseRecordDto) => {
        setEditing(lease);
        reset({
            assetId: lease.assetId || "",
            lessorName: lease.lessorName || "",
            startDate: lease.startDate?.split("T")[0] || "",
            endDate: lease.endDate?.split("T")[0] || "",
            monthlyPayment: lease.monthlyPayment || 0,
            currency: lease.currency || "USD",
            autoRenew: lease.autoRenew ?? false,
            noticePeriodDays: lease.noticePeriodDays || 30,
            notes: lease.notes || "",
        });
        setIsModalOpen(true);
    };

    const onSubmit = async (data: FormData) => {
        try {
            if (editing?.id) {
                await leaseRecordService.update(editing.id, data);
                toast.success("Lease updated");
            } else {
                await leaseRecordService.create(data);
                toast.success("Lease created");
            }
            setIsModalOpen(false);
            fetchAll();
        } catch {
            toast.error("Failed to save lease");
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ message: "Delete this lease record permanently?", variant: "danger" })) return;
        try {
            await leaseRecordService.delete(id);
            toast.success("Lease deleted");
            fetchAll();
        } catch {
            toast.error("Failed to delete lease");
        }
    };

    const handleTerminate = async () => {
        if (!terminatingId) return;
        try {
            await leaseRecordService.terminate(terminatingId, terminateReason || undefined);
            toast.success("Lease terminated");
            setTerminatingId(null);
            setTerminateReason("");
            fetchAll();
        } catch {
            toast.error("Failed to terminate lease");
        }
    };

    if (isLoading) return <PageSpinner />;

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Lease Records"
                subtitle="Manage asset lease agreements, renewal dates, and monthly obligations"
                actions={
                    <Button onClick={openCreate} className="gap-2">
                        <Plus className="h-4 w-4" /> New Lease
                    </Button>
                }
            />

            {/* Expiring soon banner */}
            {expiring.length > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-amber-800">
                            {expiring.length} lease{expiring.length > 1 ? "s" : ""} expiring within 30 days
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            {expiring.map(e => e.assetName || assetMap.get(e.assetId || "")?.name || "Unknown").join(", ")}
                        </p>
                    </div>
                </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{active}</p>
                                <p className="text-xs text-slate-500">Active Leases</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                <XCircle className="h-5 w-5 text-slate-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{expiredCount}</p>
                                <p className="text-xs text-slate-500">Expired</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                <DollarSign className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{fmtCurrency(totalMonthly)}</p>
                                <p className="text-xs text-slate-500">Monthly Obligations</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-sm">
                <CardContent className="pt-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search by asset or lessor…"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as LeaseStatus | "")} className="w-52">
                            <option value="">All Statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="TERMINATED">Terminated</option>
                            <option value="PENDING_RENEWAL">Pending Renewal</option>
                        </Select>
                        <Button variant="outline" size="icon" onClick={fetchAll}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-900">
                        Leases
                        <span className="ml-2 text-sm font-normal text-slate-400">({filtered.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <FileSignature className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No lease records found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Asset</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Lessor</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Start</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">End</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Monthly</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Auto-Renew</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map(lease => {
                                        const days = daysUntil(lease.endDate);
                                        return (
                                            <tr key={lease.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div>
                                                        <p className="font-medium text-slate-900">{lease.assetName || assetMap.get(lease.assetId || "")?.name || "Unknown"}</p>
                                                        {days !== null && days <= 30 && days > 0 && lease.status === "ACTIVE" && (
                                                            <p className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                                                                <Clock className="h-3 w-3" /> Expires in {days}d
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-700">{lease.lessorName || "—"}</td>
                                                <td className="py-3 px-4 text-slate-600">{fmt(lease.startDate)}</td>
                                                <td className="py-3 px-4 text-slate-600">{fmt(lease.endDate)}</td>
                                                <td className="py-3 px-4 font-medium text-slate-900">{fmtCurrency(lease.monthlyPayment)}</td>
                                                <td className="py-3 px-4">
                                                    {lease.autoRenew
                                                        ? <span className="text-emerald-600 text-xs font-medium">Yes</span>
                                                        : <span className="text-slate-400 text-xs">No</span>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[lease.status || "ACTIVE"] || "bg-slate-100 text-slate-600"}`}>
                                                        {lease.status || "—"}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex gap-1">
                                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(lease)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {lease.status === "ACTIVE" && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700"
                                                                onClick={() => { setTerminatingId(lease.id || ""); setTerminateReason(""); }}
                                                            >
                                                                <XCircle className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => handleDelete(lease.id || "")}>
                                                            <Trash2 className="h-3.5 w-3.5" />
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

            {/* Create / Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editing ? "Edit Lease" : "New Lease"}
                description="Record a lease agreement for an asset"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="l-asset">Asset *</Label>
                        <Select id="l-asset" {...register("assetId", { required: "Asset is required" })}>
                            <option value="">Select asset…</option>
                            {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>)}
                        </Select>
                        {errors.assetId && <p className="text-xs text-red-500 mt-1">{errors.assetId.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="l-lessor">Lessor Name *</Label>
                        <Input id="l-lessor" placeholder="Lessor company name" {...register("lessorName", { required: "Lessor is required" })} />
                        {errors.lessorName && <p className="text-xs text-red-500 mt-1">{errors.lessorName.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="l-start">Start Date *</Label>
                            <Input id="l-start" type="date" {...register("startDate", { required: "Start date required" })} />
                            {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="l-end">End Date *</Label>
                            <Input id="l-end" type="date" {...register("endDate", { required: "End date required" })} />
                            {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate.message}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="l-payment">Monthly Payment</Label>
                            <Input id="l-payment" type="number" step="0.01" min="0" {...register("monthlyPayment", { valueAsNumber: true })} />
                        </div>
                        <div>
                            <Label htmlFor="l-currency">Currency</Label>
                            <Select id="l-currency" {...register("currency")}>
                                <option value="USD">USD</option>
                                <option value="GHS">GHS</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="l-notice">Notice Period (days)</Label>
                            <Input id="l-notice" type="number" min="0" {...register("noticePeriodDays", { valueAsNumber: true })} />
                        </div>
                        <div className="flex items-end pb-1 gap-2">
                            <input type="checkbox" id="l-autorenew" {...register("autoRenew")} className="h-4 w-4 rounded border-slate-300" />
                            <Label htmlFor="l-autorenew" className="cursor-pointer">Auto-Renew</Label>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="l-notes">Notes</Label>
                        <Textarea id="l-notes" rows={2} placeholder="Optional notes…" {...register("notes")} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
                            {editing ? "Save Changes" : "Create Lease"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">Cancel</Button>
                    </div>
                </form>
            </Modal>

            {/* Terminate Modal */}
            <Modal
                isOpen={!!terminatingId}
                onClose={() => setTerminatingId(null)}
                title="Terminate Lease"
                description="This will mark the lease as TERMINATED. Provide an optional reason."
            >
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="t-reason">Reason (optional)</Label>
                        <Textarea id="t-reason" rows={3} value={terminateReason} onChange={e => setTerminateReason(e.target.value)} placeholder="Reason for early termination…" />
                    </div>
                    <div className="flex gap-3">
                        <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleTerminate}>Terminate</Button>
                        <Button variant="outline" className="flex-1" onClick={() => setTerminatingId(null)}>Cancel</Button>
                    </div>
                </div>
            </Modal>

            {ConfirmDialog}
        </div>
    );
}
