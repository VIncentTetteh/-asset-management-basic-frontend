"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
    ShieldCheck, Plus, Trash2, RefreshCw, Search, Loader2,
    CheckCircle2, XCircle, AlertTriangle, HelpCircle,
} from "lucide-react";

import {
    dpaConsentService,
    ConsentRecordDto,
    ConsentPurpose,
} from "@/services/dpaConsentService";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { useConfirm } from "@/hooks/useConfirm";

// ── Constants ──────────────────────────────────────────────────────────────────

const PURPOSES: { value: ConsentPurpose; label: string }[] = [
    { value: "MARKETING", label: "Marketing" },
    { value: "ANALYTICS", label: "Analytics" },
    { value: "DATA_SHARING", label: "Data Sharing" },
    { value: "PROFILING", label: "Profiling" },
    { value: "THIRD_PARTY", label: "Third Party" },
    { value: "COMMUNICATIONS", label: "Communications" },
    { value: "OTHER", label: "Other" },
];

const fmt = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

// ── Check Consent Modal ────────────────────────────────────────────────────────

function ConsentChecker() {
    const [subjectId, setSubjectId] = useState("");
    const [purpose, setPurpose] = useState<ConsentPurpose>("MARKETING");
    const [result, setResult] = useState<{ granted: boolean; expiresAt?: string } | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    const handleCheck = async () => {
        if (!subjectId.trim()) { toast.error("Subject ID is required"); return; }
        setIsChecking(true);
        try {
            const res = await dpaConsentService.check(subjectId, purpose);
            setResult(res);
        } catch {
            toast.error("Consent check failed");
            setResult(null);
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <Card className="border-0 shadow-sm bg-slate-50">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-blue-600" /> Check Consent Status
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1">
                        <Label htmlFor="chk-subject">Subject ID</Label>
                        <Input id="chk-subject" placeholder="User or subject ID…" value={subjectId} onChange={e => { setSubjectId(e.target.value); setResult(null); }} />
                    </div>
                    <div>
                        <Label htmlFor="chk-purpose">Purpose</Label>
                        <Select id="chk-purpose" value={purpose} onChange={e => { setPurpose(e.target.value as ConsentPurpose); setResult(null); }} className="w-44">
                            {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </Select>
                    </div>
                    <Button onClick={handleCheck} disabled={isChecking} className="gap-2">
                        {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Check
                    </Button>
                </div>
                {result !== null && (
                    <div className={`mt-4 rounded-lg p-3 flex items-center gap-3 border ${result.granted ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                        {result.granted
                            ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                            : <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                        }
                        <div>
                            <p className={`text-sm font-medium ${result.granted ? "text-emerald-800" : "text-red-800"}`}>
                                Consent {result.granted ? "GRANTED" : "NOT GRANTED"} for {purpose}
                            </p>
                            {result.expiresAt && (
                                <p className="text-xs text-slate-500 mt-0.5">Expires: {fmt(result.expiresAt)}</p>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type FormData = Omit<ConsentRecordDto, "id" | "organisationId" | "createdAt" | "revokedAt">;

export default function DpaConsentPage() {
    const [consents, setConsents] = useState<ConsentRecordDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>();
    const { confirm, ConfirmDialog } = useConfirm();

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const data = await dpaConsentService.listAll();
            setConsents(data);
        } catch {
            toast.error("Failed to load consent records");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const filtered = useMemo(() => {
        if (!searchTerm) return consents;
        const q = searchTerm.toLowerCase();
        return consents.filter(c =>
            (c.subjectEmail || "").toLowerCase().includes(q) ||
            (c.subjectName || "").toLowerCase().includes(q) ||
            (c.purpose || "").toLowerCase().includes(q)
        );
    }, [consents, searchTerm]);

    const granted = consents.filter(c => c.granted).length;
    const revoked = consents.filter(c => !c.granted || c.revokedAt).length;

    const openCreate = () => {
        reset({
            subjectId: "", subjectEmail: "", subjectName: "",
            purpose: "MARKETING", granted: true,
            consentText: "", expiresAt: "", ipAddress: "", userAgent: "",
        });
        setIsModalOpen(true);
    };

    const onSubmit = async (data: FormData) => {
        try {
            await dpaConsentService.record(data);
            toast.success("Consent recorded");
            setIsModalOpen(false);
            fetchAll();
        } catch {
            toast.error("Failed to record consent");
        }
    };

    const handleRevoke = async (consent: ConsentRecordDto) => {
        if (!consent.purpose || !consent.subjectId) return;
        if (!await confirm({
            message: `Revoke ${consent.purpose} consent for ${consent.subjectEmail || consent.subjectId}?`,
            variant: "warning",
        })) return;
        try {
            await dpaConsentService.revoke(consent.purpose, consent.subjectId);
            toast.success("Consent revoked");
            fetchAll();
        } catch {
            toast.error("Failed to revoke consent");
        }
    };

    if (isLoading) return <PageSpinner />;

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Data Processing Consent"
                subtitle="GDPR/NDPA compliance — manage data subject consent records and processing purposes"
                actions={
                    <Button onClick={openCreate} className="gap-2">
                        <Plus className="h-4 w-4" /> Record Consent
                    </Button>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                <ShieldCheck className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{consents.length}</p>
                                <p className="text-xs text-slate-500">Total Records</p>
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
                                <p className="text-2xl font-bold text-slate-900">{granted}</p>
                                <p className="text-xs text-slate-500">Granted</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                                <XCircle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{revoked}</p>
                                <p className="text-xs text-slate-500">Revoked / Denied</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Consent Checker */}
            <ConsentChecker />

            {/* Filters */}
            <Card className="border-0 shadow-sm">
                <CardContent className="pt-5">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search by subject or purpose…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                        </div>
                        <Button variant="outline" size="icon" onClick={fetchAll}><RefreshCw className="h-4 w-4" /></Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-900">
                        Consent Records
                        <span className="ml-2 text-sm font-normal text-slate-400">({filtered.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <ShieldCheck className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No consent records found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Subject</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Purpose</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Recorded</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Expires</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Revoked</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map((c, i) => (
                                        <tr key={c.id || i} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4">
                                                <p className="font-medium text-slate-900">{c.subjectName || c.subjectEmail || c.subjectId || "—"}</p>
                                                {c.subjectEmail && <p className="text-xs text-slate-400">{c.subjectEmail}</p>}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                                                    {PURPOSES.find(p => p.value === c.purpose)?.label || c.purpose || "—"}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                {c.granted
                                                    ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Granted</span>
                                                    : <span className="flex items-center gap-1 text-red-600 text-xs font-medium"><XCircle className="h-3.5 w-3.5" /> Denied</span>
                                                }
                                            </td>
                                            <td className="py-3 px-4 text-slate-600">{fmt(c.createdAt)}</td>
                                            <td className="py-3 px-4 text-slate-600">{fmt(c.expiresAt)}</td>
                                            <td className="py-3 px-4 text-slate-600">{fmt(c.revokedAt)}</td>
                                            <td className="py-3 px-4">
                                                {c.granted && !c.revokedAt && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 px-2 text-red-500 hover:text-red-600 gap-1 text-xs"
                                                        onClick={() => handleRevoke(c)}
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" /> Revoke
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

            {/* Record Consent Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Consent" description="Document a data subject's consent for a specific processing purpose">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="c-name">Subject Name</Label>
                            <Input id="c-name" placeholder="Full name…" {...register("subjectName")} />
                        </div>
                        <div>
                            <Label htmlFor="c-email">Subject Email</Label>
                            <Input id="c-email" type="email" placeholder="email@example.com" {...register("subjectEmail")} />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="c-sid">Subject ID *</Label>
                        <Input id="c-sid" placeholder="Internal user/subject ID" {...register("subjectId", { required: "Subject ID required" })} />
                        {errors.subjectId && <p className="text-xs text-red-500 mt-1">{errors.subjectId.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="c-purpose">Purpose *</Label>
                        <Select id="c-purpose" {...register("purpose", { required: "Purpose required" })}>
                            {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="c-granted" {...register("granted")} className="h-4 w-4 rounded border-slate-300" defaultChecked />
                        <Label htmlFor="c-granted" className="cursor-pointer">Consent granted (uncheck if recording a denial)</Label>
                    </div>
                    <div>
                        <Label htmlFor="c-text">Consent Text / Statement</Label>
                        <Textarea id="c-text" rows={2} placeholder="The exact wording of the consent statement shown to the subject…" {...register("consentText")} />
                    </div>
                    <div>
                        <Label htmlFor="c-expires">Expiry Date</Label>
                        <Input id="c-expires" type="date" {...register("expiresAt")} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            Record Consent
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">Cancel</Button>
                    </div>
                </form>
            </Modal>

            {ConfirmDialog}
        </div>
    );
}
