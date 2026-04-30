"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
    PackageCheck, PackageMinus, AlertTriangle, Clock, User, Search,
    RefreshCw, CheckCircle2, XCircle, Loader2, Package, Filter,
} from "lucide-react";

import { checkoutService, CheckoutRecordDto, CheckInDto } from "@/services/checkoutService";
import { assetService } from "@/services/assetService";
import { userService } from "@/services/userService";
import { Asset, User as UserType } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { useConfirm } from "@/hooks/useConfirm";

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
    ACTIVE: "bg-blue-100 text-blue-700 border border-blue-200",
    RETURNED: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    OVERDUE: "bg-red-100 text-red-700 border border-red-200",
};

const fmt = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const isOverdue = (record: CheckoutRecordDto) =>
    record.status === "ACTIVE" &&
    record.expectedReturnDate &&
    new Date(record.expectedReturnDate) < new Date();

// ── Component ──────────────────────────────────────────────────────────────────

export default function CheckoutsPage() {
    const [records, setRecords] = useState<CheckoutRecordDto[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [users, setUsers] = useState<UserType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "RETURNED" | "OVERDUE">("");
    const [view, setView] = useState<"all" | "overdue">("all");

    // Checkout modal
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    // Check-in modal
    const [checkInTarget, setCheckInTarget] = useState<CheckoutRecordDto | null>(null);

    const { register: regCo, handleSubmit: hsCo, reset: resetCo, formState: { errors: errCo, isSubmitting: subCo } } =
        useForm<{ assetId: string; userId: string; expectedReturnDate?: string; conditionOnCheckout?: string; notes?: string }>();

    const { register: regCi, handleSubmit: hsCi, reset: resetCi, formState: { isSubmitting: subCi } } =
        useForm<CheckInDto>();

    const { confirm, ConfirmDialog } = useConfirm();

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const [recs, assetList, userList] = await Promise.allSettled([
                view === "overdue" ? checkoutService.listOverdue() : checkoutService.listAll(),
                assetService.getAll(),
                userService.getAll(),
            ]);
            if (recs.status === "fulfilled") setRecords(recs.value);
            if (assetList.status === "fulfilled") setAssets(assetList.value);
            if (userList.status === "fulfilled") setUsers(userList.value);
        } catch {
            toast.error("Failed to load checkout records");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, [view]);

    const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);
    const userMap = useMemo(() => new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`])), [users]);

    // Stats
    const active = records.filter(r => r.status === "ACTIVE").length;
    const overdue = records.filter(r => r.status === "OVERDUE" || isOverdue(r)).length;
    const returned = records.filter(r => r.status === "RETURNED").length;

    const filtered = useMemo(() => {
        let list = [...records];
        if (statusFilter) list = list.filter(r => r.status === statusFilter);
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(r =>
                (r.assetName || "").toLowerCase().includes(q) ||
                (r.checkedOutByName || "").toLowerCase().includes(q)
            );
        }
        return list;
    }, [records, statusFilter, searchTerm]);

    const handleCheckout = async (data: { assetId: string; userId: string; expectedReturnDate?: string; conditionOnCheckout?: string; notes?: string }) => {
        try {
            await checkoutService.checkOut(data.assetId, data.userId, {
                expectedReturnDate: data.expectedReturnDate,
                conditionOnCheckout: data.conditionOnCheckout,
                notes: data.notes,
            });
            toast.success("Asset checked out successfully");
            setIsCheckoutOpen(false);
            resetCo();
            fetchAll();
        } catch {
            toast.error("Failed to check out asset");
        }
    };

    const handleCheckIn = async (data: CheckInDto) => {
        if (!checkInTarget?.id) return;
        try {
            await checkoutService.checkIn(checkInTarget.id, data);
            toast.success("Asset checked in successfully");
            setCheckInTarget(null);
            resetCi();
            fetchAll();
        } catch {
            toast.error("Failed to check in asset");
        }
    };

    const openCheckout = () => {
        resetCo({ assetId: "", userId: "", expectedReturnDate: "", conditionOnCheckout: "", notes: "" });
        setIsCheckoutOpen(true);
    };

    const openCheckIn = (rec: CheckoutRecordDto) => {
        setCheckInTarget(rec);
        resetCi({ conditionOnReturn: "", notes: "" });
    };

    if (isLoading) return <PageSpinner />;

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Asset Checkouts"
                subtitle="Track which assets are checked out, by whom, and when they're due back"
                actions={
                    <Button onClick={openCheckout} className="gap-2">
                        <PackageCheck className="h-4 w-4" /> Check Out Asset
                    </Button>
                }
            />

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{active}</p>
                                <p className="text-xs text-slate-500">Active Checkouts</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-red-600">{overdue}</p>
                                <p className="text-xs text-slate-500">Overdue</p>
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
                                <p className="text-2xl font-bold text-slate-900">{returned}</p>
                                <p className="text-xs text-slate-500">Returned</p>
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
                                placeholder="Search by asset or user..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                            className="w-44"
                        >
                            <option value="">All Statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="RETURNED">Returned</option>
                            <option value="OVERDUE">Overdue</option>
                        </Select>
                        <div className="flex gap-2">
                            <Button
                                variant={view === "all" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setView("all")}
                            >All</Button>
                            <Button
                                variant={view === "overdue" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setView("overdue")}
                                className="gap-1"
                            >
                                <AlertTriangle className="h-3.5 w-3.5" /> Overdue
                            </Button>
                        </div>
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
                        Checkout Records
                        <span className="ml-2 text-sm font-normal text-slate-400">({filtered.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <PackageCheck className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No checkout records found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Asset</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Checked Out By</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Checked Out</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Expected Return</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Actual Return</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Condition</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map(rec => (
                                        <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                                        <Package className="h-4 w-4 text-slate-500" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900">{rec.assetName || assetMap.get(rec.assetId || "")?.name || "Unknown"}</p>
                                                        <p className="text-xs text-slate-400">{rec.assetId?.slice(0, 8)}…</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center">
                                                        <User className="h-3.5 w-3.5 text-indigo-600" />
                                                    </div>
                                                    <span className="text-slate-700">{rec.checkedOutByName || userMap.get(rec.checkedOutById || "") || "—"}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-slate-600">{fmt(rec.checkedOutAt)}</td>
                                            <td className="py-3 px-4">
                                                {rec.expectedReturnDate ? (
                                                    <span className={new Date(rec.expectedReturnDate) < new Date() && rec.status === "ACTIVE" ? "text-red-600 font-medium" : "text-slate-600"}>
                                                        {fmt(rec.expectedReturnDate)}
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600">{fmt(rec.actualReturnDate)}</td>
                                            <td className="py-3 px-4 text-slate-600 text-xs">{rec.conditionOnCheckout || "—"}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[rec.status || "ACTIVE"] || "bg-slate-100 text-slate-600"}`}>
                                                    {rec.status || "ACTIVE"}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                {rec.status === "ACTIVE" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="gap-1 text-xs"
                                                        onClick={() => openCheckIn(rec)}
                                                    >
                                                        <PackageMinus className="h-3.5 w-3.5" /> Check In
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Checkout Modal */}
            <Modal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                title="Check Out Asset"
                description="Assign an asset to a user with an optional return date"
            >
                <form onSubmit={hsCo(handleCheckout)} className="space-y-4">
                    <div>
                        <Label htmlFor="co-asset">Asset *</Label>
                        <Select id="co-asset" {...regCo("assetId", { required: "Asset is required" })}>
                            <option value="">Select asset…</option>
                            {assets.filter(a => (a.status === "ACTIVE" || a.status === "AVAILABLE")).map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>
                            ))}
                        </Select>
                        {errCo.assetId && <p className="text-xs text-red-500 mt-1">{errCo.assetId.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="co-user">User *</Label>
                        <Select id="co-user" {...regCo("userId", { required: "User is required" })}>
                            <option value="">Select user…</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                            ))}
                        </Select>
                        {errCo.userId && <p className="text-xs text-red-500 mt-1">{errCo.userId.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="co-return">Expected Return Date</Label>
                        <Input id="co-return" type="date" {...regCo("expectedReturnDate")} />
                    </div>
                    <div>
                        <Label htmlFor="co-condition">Condition on Checkout</Label>
                        <Input id="co-condition" placeholder="e.g. Good, Minor scratches…" {...regCo("conditionOnCheckout")} />
                    </div>
                    <div>
                        <Label htmlFor="co-notes">Notes</Label>
                        <Input id="co-notes" placeholder="Optional notes…" {...regCo("notes")} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={subCo} className="flex-1 gap-2">
                            {subCo ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                            Check Out
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsCheckoutOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Check-in Modal */}
            <Modal
                isOpen={!!checkInTarget}
                onClose={() => setCheckInTarget(null)}
                title="Check In Asset"
                description={`Return "${checkInTarget?.assetName || "asset"}" from ${checkInTarget?.checkedOutByName || "user"}`}
            >
                <form onSubmit={hsCi(handleCheckIn)} className="space-y-4">
                    <div>
                        <Label htmlFor="ci-condition">Condition on Return</Label>
                        <Input id="ci-condition" placeholder="e.g. Good, Damaged screen…" {...regCi("conditionOnReturn")} />
                    </div>
                    <div>
                        <Label htmlFor="ci-notes">Notes</Label>
                        <Input id="ci-notes" placeholder="Optional return notes…" {...regCi("notes")} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={subCi} className="flex-1 gap-2">
                            {subCi ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Confirm Return
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setCheckInTarget(null)} className="flex-1">
                            Cancel
                        </Button>
                    </div>
                </form>
            </Modal>

            {ConfirmDialog}
        </div>
    );
}
