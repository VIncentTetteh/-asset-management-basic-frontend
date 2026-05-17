"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
    ShieldCheck, Download, RefreshCw, Loader2, Plus, Pencil,
    CheckCircle2, AlertTriangle, XCircle, Clock, BarChart3, FileText,
    Building2, ChevronRight,
} from "lucide-react";

import {
    bogReportService,
    BogReport,
    BogReportDomain,
    bogControlService,
} from "@/services/complianceService";
import { BOGControl, BOGControlDto, ControlStatus } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import DocumentAttachments from "@/components/DocumentAttachments";

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ControlStatus, string> = {
    IMPLEMENTED:    "bg-emerald-100 text-emerald-700 border border-emerald-200",
    PARTIAL:        "bg-amber-100 text-amber-700 border border-amber-200",
    NOT_IMPLEMENTED:"bg-red-100 text-red-700 border border-red-200",
    NOT_APPLICABLE: "bg-slate-100 text-slate-500 border border-slate-200",
};

const STATUS_ICON: Record<ControlStatus, React.ReactNode> = {
    IMPLEMENTED:    <CheckCircle2 className="h-3.5 w-3.5" />,
    PARTIAL:        <Clock className="h-3.5 w-3.5" />,
    NOT_IMPLEMENTED:<XCircle className="h-3.5 w-3.5" />,
    NOT_APPLICABLE: <AlertTriangle className="h-3.5 w-3.5" />,
};

const STATUSES: ControlStatus[] = ["IMPLEMENTED", "PARTIAL", "NOT_IMPLEMENTED", "NOT_APPLICABLE"];

const fmt = (d?: string) =>
    d ? new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

// ── Domain progress bar ────────────────────────────────────────────────────────

function DomainBar({ domain }: { domain: BogReportDomain }) {
    const pct = Math.round(domain.compliancePercent ?? 0);
    const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
    const text  = pct >= 80 ? "text-emerald-700" : pct >= 50 ? "text-amber-700" : "text-red-700";
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-slate-800">{domain.domain}</span>
                <span className={`font-bold ${text}`}>{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex gap-3 text-xs text-slate-400">
                <span className="text-emerald-600">{domain.implemented} done</span>
                <span className="text-amber-600">{domain.partial} partial</span>
                <span className="text-red-500">{domain.notImplemented} missing</span>
                <span className="text-slate-400">{domain.totalControls} total</span>
            </div>
        </div>
    );
}

// ── Compliance ring ────────────────────────────────────────────────────────────

function ComplianceRing({ pct }: { pct: number }) {
    const r = 52, c = 2 * Math.PI * r;
    const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
    return (
        <svg width="136" height="136" viewBox="0 0 136 136">
            <circle cx="68" cy="68" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
            <circle
                cx="68" cy="68" r={r} fill="none"
                stroke={color} strokeWidth="12"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct / 100)}
                strokeLinecap="round"
                transform="rotate(-90 68 68)"
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
            <text x="68" y="68" textAnchor="middle" dominantBaseline="middle"
                fontSize="22" fontWeight="700" fill={color}>{Math.round(pct)}%</text>
            <text x="68" y="86" textAnchor="middle" fontSize="11" fill="#94a3b8">compliant</text>
        </svg>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type UpsertForm = BOGControlDto;

export default function BogReportPage() {
    const [report, setReport] = useState<BogReport | null>(null);
    const [controls, setControls] = useState<BOGControl[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "controls">("overview");
    const [isUpsertOpen, setIsUpsertOpen] = useState(false);
    const [editControl, setEditControl] = useState<BOGControl | null>(null);
    const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UpsertForm>();

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const [reportRes, controlsRes] = await Promise.allSettled([
                bogReportService.getReport(),
                bogControlService.getAll(),
            ]);
            if (reportRes.status === "fulfilled") setReport(reportRes.value);
            if (controlsRes.status === "fulfilled") setControls(controlsRes.value);
        } catch {
            toast.error("Failed to load BOG compliance report");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleDownloadPdf = async () => {
        setIsDownloadingPdf(true);
        try {
            const blob = await bogReportService.downloadPdf();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `BOG_Compliance_Report_${new Date().toISOString().split("T")[0]}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("PDF downloaded");
        } catch {
            toast.error("Failed to download PDF");
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const openUpsert = (ctrl?: BOGControl) => {
        setEditControl(ctrl || null);
        reset({
            directiveRef: ctrl?.directiveRef || "",
            requirement: ctrl?.requirement || "",
            status: ctrl?.status || "NOT_IMPLEMENTED",
            gapDescription: ctrl?.gapDescription || "",
            remediationPlan: ctrl?.remediationPlan || "",
            targetDate: ctrl?.targetDate?.split("T")[0] || "",
            evidenceUrl: ctrl?.evidenceUrl || "",
        });
        setIsUpsertOpen(true);
    };

    const onUpsert = async (data: UpsertForm) => {
        try {
            await bogReportService.upsertControl(data);
            toast.success(editControl ? "Control updated" : "Control upserted");
            setIsUpsertOpen(false);
            fetchAll();
        } catch {
            toast.error("Failed to save control");
        }
    };

    const handleStatusUpdate = async (id: string, status: string) => {
        setStatusUpdating(id);
        try {
            await bogReportService.updateControlStatus(id, status);
            toast.success("Status updated");
            fetchAll();
        } catch {
            toast.error("Failed to update status");
        } finally {
            setStatusUpdating(null);
        }
    };

    if (isLoading) return <PageSpinner />;

    const summary = report?.summary;
    const pct = summary?.compliancePercent ?? 0;
    const overallColor =
        pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="BOG ICT Directive Compliance"
                subtitle={`Compliance report for ${report?.organisationName ?? "your organisation"} — generated ${fmt(report?.generatedAt)}`}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchAll} className="gap-2">
                            <RefreshCw className="h-4 w-4" /> Refresh
                        </Button>
                        <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="gap-2">
                            {isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Download PDF
                        </Button>
                        <Button onClick={() => openUpsert()} className="gap-2">
                            <Plus className="h-4 w-4" /> Add / Update Control
                        </Button>
                    </div>
                }
            />

            {/* Overall status banner */}
            {summary && (
                <div className={`flex items-center gap-3 rounded-lg px-5 py-3 border ${
                    pct >= 80 ? "bg-emerald-50 border-emerald-200" :
                    pct >= 50 ? "bg-amber-50 border-amber-200" :
                    "bg-red-50 border-red-200"
                }`}>
                    <ShieldCheck className={`h-5 w-5 shrink-0 ${overallColor}`} />
                    <p className={`text-sm font-medium ${overallColor}`}>
                        Overall status: <strong>{summary.overallStatus}</strong> — {Math.round(pct)}% of controls implemented
                    </p>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-100">
                {(["overview", "controls"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                            activeTab === tab
                                ? "border-blue-600 text-blue-700"
                                : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        {tab === "overview" ? "Overview" : `Controls (${controls.length})`}
                    </button>
                ))}
            </div>

            {/* ── Overview Tab ── */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    {/* Summary cards + ring */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Ring */}
                        <Card className="border-0 shadow-sm flex items-center justify-center py-6">
                            <ComplianceRing pct={pct} />
                        </Card>

                        {/* Stats grid */}
                        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: "Total Controls", value: summary?.totalControls ?? 0, color: "text-slate-900", bg: "bg-slate-50" },
                                { label: "Implemented",    value: summary?.implemented ?? 0,   color: "text-emerald-700", bg: "bg-emerald-50" },
                                { label: "Partial",        value: summary?.partial ?? 0,        color: "text-amber-700",   bg: "bg-amber-50" },
                                { label: "Not Implemented",value: summary?.notImplemented ?? 0, color: "text-red-700",     bg: "bg-red-50" },
                            ].map(s => (
                                <Card key={s.label} className="border-0 shadow-sm">
                                    <CardContent className="pt-5 pb-4">
                                        <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                                            <BarChart3 className={`h-4 w-4 ${s.color}`} />
                                        </div>
                                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Domain breakdown */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-blue-600" />
                                Compliance by Domain
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {(report?.domains ?? []).length === 0 ? (
                                <p className="text-sm text-slate-400">No domain data available in report.</p>
                            ) : (
                                (report?.domains ?? []).map((d, i) => (
                                    <DomainBar key={i} domain={d} />
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Controls Tab ── */}
            {activeTab === "controls" && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold text-slate-900">
                            BOG Control Register
                            <span className="ml-2 text-sm font-normal text-slate-400">({controls.length} controls)</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {controls.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                                <FileText className="h-10 w-10 opacity-30" />
                                <p className="text-sm">No controls recorded yet</p>
                                <Button variant="outline" size="sm" onClick={() => openUpsert()} className="mt-2 gap-1">
                                    <Plus className="h-3.5 w-3.5" /> Add First Control
                                </Button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50">
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Ref</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Requirement</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Gap</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Target Date</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Change Status</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Edit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {controls.map(ctrl => (
                                            <tr key={ctrl.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4">
                                                    <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                                                        {ctrl.directiveRef}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 max-w-[280px]">
                                                    <p className="text-slate-800 truncate">{ctrl.requirement}</p>
                                                    {ctrl.evidenceUrl && (
                                                        <a href={ctrl.evidenceUrl} target="_blank" rel="noopener noreferrer"
                                                            className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                                                            Evidence <ChevronRight className="h-3 w-3" />
                                                        </a>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[ctrl.status]}`}>
                                                        {STATUS_ICON[ctrl.status]}
                                                        {ctrl.status.replace(/_/g, " ")}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 max-w-[200px]">
                                                    <p className="text-xs text-slate-500 truncate">{ctrl.gapDescription || "—"}</p>
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 text-xs whitespace-nowrap">
                                                    {ctrl.targetDate ? new Date(ctrl.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-1">
                                                        <Select
                                                            value={ctrl.status}
                                                            onChange={e => handleStatusUpdate(ctrl.id, e.target.value)}
                                                            className="text-xs h-8 w-40 py-0"
                                                            disabled={statusUpdating === ctrl.id}
                                                        >
                                                            {STATUSES.map(s => (
                                                                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                                                            ))}
                                                        </Select>
                                                        {statusUpdating === ctrl.id && (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openUpsert(ctrl)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Upsert Modal */}
            <Modal
                isOpen={isUpsertOpen}
                onClose={() => setIsUpsertOpen(false)}
                title={editControl ? "Update BOG Control" : "Add BOG Control"}
                description="Upsert a control by directive reference. If a control with the same directiveRef exists it will be updated."
            >
                <form onSubmit={handleSubmit(onUpsert)} className="space-y-4">
                    <div>
                        <Label htmlFor="b-ref">Directive Reference *</Label>
                        <Input
                            id="b-ref"
                            placeholder="e.g. BOG-ICT-2.1.3"
                            {...register("directiveRef", { required: "Directive ref is required" })}
                        />
                        {errors.directiveRef && <p className="text-xs text-red-500 mt-1">{errors.directiveRef.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="b-req">Requirement *</Label>
                        <Textarea
                            id="b-req"
                            rows={2}
                            placeholder="Describe the BOG requirement…"
                            {...register("requirement", { required: "Requirement is required" })}
                        />
                        {errors.requirement && <p className="text-xs text-red-500 mt-1">{errors.requirement.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="b-status">Status</Label>
                        <Select id="b-status" {...register("status")}>
                            {STATUSES.map(s => (
                                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="b-gap">Gap Description</Label>
                        <Textarea id="b-gap" rows={2} placeholder="What is missing or incomplete?" {...register("gapDescription")} />
                    </div>
                    <div>
                        <Label htmlFor="b-plan">Remediation Plan</Label>
                        <Textarea id="b-plan" rows={2} placeholder="Steps to achieve compliance…" {...register("remediationPlan")} />
                    </div>
                    <div>
                        <Label htmlFor="b-date">Target Date</Label>
                        <Input id="b-date" type="date" {...register("targetDate")} />
                    </div>
                    {editControl && (
                        <div className="space-y-1.5">
                            <Label>Evidence Documents</Label>
                            {editControl.evidenceUrl && (
                                <p className="text-xs text-slate-500 mb-1">
                                    Legacy link:{" "}
                                    <a href={editControl.evidenceUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
                                        {editControl.evidenceUrl}
                                    </a>
                                </p>
                            )}
                            <DocumentAttachments entityType="BOG_CONTROL" entityId={editControl.id} />
                        </div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            {editControl ? "Update Control" : "Save Control"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsUpsertOpen(false)} className="flex-1">Cancel</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
