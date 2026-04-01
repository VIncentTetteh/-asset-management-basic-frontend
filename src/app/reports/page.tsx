"use client";

import { useState, useEffect } from "react";
import { reportService } from "@/services/reportService";
import { ReportHistory, ReportRequest, ReportResponse } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import {
    Loader2, Download, FileText, FileSpreadsheet, Wrench,
    BarChart3, Clock, CheckCircle2, AlertCircle, RefreshCw,
    FileDown, Trash2
} from "lucide-react";
import { formatRelativeTime } from "@/lib/time";

type Format = "PDF" | "EXCEL" | "CSV";
type ReportType = "assets" | "financial" | "maintenance";

const FORMAT_OPTIONS: Format[] = ["PDF", "EXCEL", "CSV"];

const FORMAT_EXT: Record<Format, string> = { PDF: "pdf", EXCEL: "xlsx", CSV: "csv" };

const REPORT_CONFIGS: {
    type: ReportType;
    label: string;
    description: string;
    icon: React.ElementType;
    accentClass: string;
}[] = [
    {
        type: "assets",
        label: "Asset Report",
        description: "Complete portfolio inventory with asset status, department assignment, locations, and current book values.",
        icon: FileText,
        accentClass: "text-indigo-600 bg-indigo-50 border-indigo-100",
    },
    {
        type: "financial",
        label: "Financial Report",
        description: "Depreciation schedules, acquisition costs, net book value movement, and disposal summaries.",
        icon: BarChart3,
        accentClass: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
        type: "maintenance",
        label: "Maintenance Report",
        description: "Service history, scheduled tasks, downtime records, maintenance costs, and technician assignments.",
        icon: Wrench,
        accentClass: "text-amber-600 bg-amber-50 border-amber-100",
    },
];

function StatusBadge({ status }: { status?: string }) {
    if (!status) return null;
    const s = status.toUpperCase();
    if (s === "COMPLETED") return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-2.5 w-2.5" /> DONE
        </span>
    );
    if (s === "FAILED") return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-700 border border-red-200">
            <AlertCircle className="h-2.5 w-2.5" /> FAILED
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200">
            <Clock className="h-2.5 w-2.5" /> {s}
        </span>
    );
}

function FormatBadge({ format }: { format?: string }) {
    const f = (format || "").toUpperCase();
    const colors: Record<string, string> = {
        PDF: "bg-red-50 text-red-700 border-red-200",
        EXCEL: "bg-green-50 text-green-700 border-green-200",
        CSV: "bg-blue-50 text-blue-700 border-blue-200",
    };
    const label: Record<string, string> = { PDF: "PDF", EXCEL: "XLS", CSV: "CSV" };
    return (
        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${colors[f] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {label[f] || f}
        </span>
    );
}

export default function ReportsPage() {
    const [history, setHistory] = useState<ReportHistory | null>(null);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [generating, setGenerating] = useState<ReportType | "">("");
    const [downloadingId, setDownloadingId] = useState("");
    const [deletingId, setDeletingId] = useState("");
    const [formats, setFormats] = useState<Record<ReportType, Format>>({
        assets: "PDF", financial: "PDF", maintenance: "PDF",
    });

    const fetchHistory = async (quiet = false) => {
        try {
            if (!quiet) setHistoryLoading(true);
            const data = await reportService.getReportHistory({ limit: 50 });
            setHistory(data);
        } catch {
            toast.error("Failed to load report history");
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => { fetchHistory(); }, []);

    const triggerDownload = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    };

    const buildRequest = (type: ReportType): ReportRequest => ({
        format: formats[type],
    });

    const handleDownload = async (report: ReportResponse) => {
        const id = report.reportId || report.downloadUrl || "report";
        try {
            setDownloadingId(id);
            let result: { blob: Blob; fileName?: string };
            const reportType = String(report.type || report.reportType || "").toLowerCase();
            if (report.reportId && reportType === "assets") {
                result = await reportService.downloadAssetReport(report.reportId, report.format);
            } else if (report.reportId && reportType === "financial") {
                result = await reportService.downloadFinancialReport(report.reportId, report.format);
            } else if (report.reportId && reportType === "maintenance") {
                result = await reportService.downloadMaintenanceReport(report.reportId, report.format);
            } else if (report.downloadUrl) {
                result = await reportService.downloadFromUrl(report.downloadUrl, report.format);
            } else if (report.reportId) {
                result = await reportService.downloadReport(report.reportId, report.format);
            } else {
                toast.error("No download reference available");
                return;
            }
            const ext = FORMAT_EXT[(report.format?.toUpperCase() as Format)] || "pdf";
            const name = result.fileName || `${(report.type || "report").toLowerCase()}-${report.reportId || Date.now()}.${ext}`;
            triggerDownload(result.blob, name);
            toast.success("Download started");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Download failed");
        } finally {
            setDownloadingId("");
        }
    };

    const handleDeleteReport = async (id: string) => {
        if (!confirm("Are you sure you want to delete this report?")) return;
        try {
            setDeletingId(id);
            await reportService.deleteReport(id);
            toast.success("Report deleted");
            fetchHistory(true);
        } catch {
            toast.error("Failed to delete report");
        } finally {
            setDeletingId("");
        }
    };

    const generateReport = async (type: ReportType) => {
        try {
            setGenerating(type);
            let generated: ReportResponse;
            if (type === "assets") generated = await reportService.generateAssetReport(buildRequest(type));
            else if (type === "financial") generated = await reportService.generateFinancialReport(buildRequest(type));
            else generated = await reportService.generateMaintenanceReport(buildRequest(type));

            const isComplete = (generated.status || "").toUpperCase() === "COMPLETED";
            toast.success(isComplete ? "Report ready — downloading…" : "Report queued — check history shortly");

            // Optimistically add to history immediately so it shows up without delay
            const normalizedGenerated: ReportResponse = {
                ...generated,
                type: generated.reportType || generated.type || type,
            };
            setHistory(prev => prev
                ? { ...prev, totalReports: prev.totalReports + 1, reports: [normalizedGenerated, ...prev.reports] }
                : { totalReports: 1, limit: 50, offset: 0, reports: [normalizedGenerated] }
            );

            if (isComplete && (generated.reportId || generated.downloadUrl)) {
                await handleDownload(generated);
            }
            // Refresh after short delay to let backend commit
            setTimeout(() => fetchHistory(true), 1500);
        } catch {
            toast.error("Report generation failed");
        } finally {
            setGenerating("");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reports</h1>
                    <p className="text-slate-500">Generate and download operational and compliance reports in PDF, Excel, or CSV.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchHistory()} disabled={historyLoading} className="gap-1.5 text-xs h-8">
                    <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? "animate-spin" : ""}`} /> Refresh History
                </Button>
            </div>

            {/* Report cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {REPORT_CONFIGS.map(config => (
                    <Card key={config.type} className="border-slate-200 flex flex-col hover:shadow-md transition-all">
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border w-fit text-sm font-semibold ${config.accentClass}`}>
                                <config.icon className="h-4 w-4" />
                                {config.label}
                            </div>
                        </CardHeader>
                        <CardContent className="p-5 flex flex-col gap-4 flex-1">
                            <p className="text-sm text-slate-500 leading-relaxed flex-1">{config.description}</p>

                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Output Format</p>
                                <div className="flex gap-1.5">
                                    {FORMAT_OPTIONS.map(f => (
                                        <button key={f} onClick={() => setFormats(prev => ({ ...prev, [config.type]: f }))}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${formats[config.type] === f
                                                ? "bg-teal-600 text-white border-teal-600"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-700"
                                            }`}>
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={() => generateReport(config.type)}
                                disabled={generating !== ""}
                                className="bg-teal-600 hover:bg-teal-700 w-full gap-2"
                            >
                                {generating === config.type ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                                ) : (
                                    <><FileDown className="h-4 w-4" /> Generate & Download</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* History table */}
            <Card className="border-slate-200">
                <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-500" /> Generated Reports History
                        </CardTitle>
                        {history && <span className="text-xs text-slate-400">{history.totalReports} total</span>}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {historyLoading ? (
                        <div className="space-y-2 p-4">
                            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
                        </div>
                    ) : !history?.reports?.length ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FileSpreadsheet className="h-12 w-12 text-slate-200 mb-3" />
                            <p className="text-sm font-medium text-slate-500">No reports generated yet</p>
                            <p className="text-xs text-slate-400 mt-1">Generate a report above and it will appear here</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Report</th>
                                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Format</th>
                                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Generated</th>
                                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Rows</th>
                                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Status</th>
                                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {history.reports.map((r, i) => {
                                        const rowId = r.reportId || r.downloadUrl || `row-${i}`;
                                        const isDownloadable = !r.status || r.status.toUpperCase() === "COMPLETED";
                                        const isDownloading = downloadingId === rowId;
                                        return (
                                            <tr key={rowId} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="font-medium text-slate-800">{r.type || r.reportType || "Asset Report"}</div>
                                                    <div className="text-xs font-mono text-slate-400 truncate max-w-[200px]">{r.reportId || r.downloadUrl || "—"}</div>
                                                </td>
                                                <td className="px-5 py-3"><FormatBadge format={r.format} /></td>
                                                <td className="px-5 py-3 text-slate-600 text-xs whitespace-nowrap">
                                                    <div>{new Date(r.generatedAt).toLocaleString()}</div>
                                                    <div className="text-slate-400">{formatRelativeTime(r.generatedAt)}</div>
                                                </td>
                                                <td className="px-5 py-3 text-slate-600">{r.rowCount ?? "—"}</td>
                                                <td className="px-5 py-3"><StatusBadge status={r.status || "COMPLETED"} /></td>
                                                <td className="px-5 py-3 text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={!isDownloadable || isDownloading}
                                                        onClick={() => handleDownload(r)}
                                                        className="gap-1.5 h-7 text-xs"
                                                    >
                                                        {isDownloading
                                                            ? <><Loader2 className="h-3 w-3 animate-spin" /> Downloading</>
                                                            : <><Download className="h-3 w-3" /> Download</>
                                                        }
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        disabled={!r.reportId}
                                                        onClick={() => handleDeleteReport(r.reportId!)}
                                                        isLoading={deletingId === r.reportId}
                                                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 ml-1"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
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
        </div>
    );
}
