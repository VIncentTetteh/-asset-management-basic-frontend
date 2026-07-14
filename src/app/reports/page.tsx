"use client";

import { useState, useEffect } from "react";
import { reportService } from "@/services/reportService";
import { ReportHistory, ReportRequest, ReportResponse } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "react-hot-toast";
import {
    Loader2, Download, FileText, FileSpreadsheet, Wrench,
    BarChart3, Clock, CheckCircle2, AlertCircle, RefreshCw,
    FileDown, Trash2
} from "lucide-react";
import { formatRelativeTime } from "@/lib/time";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";

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
        accentClass: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/15 dark:border-indigo-500/30",
    },
    {
        type: "financial",
        label: "Financial Report",
        description: "Depreciation schedules, acquisition costs, net book value movement, and disposal summaries.",
        icon: BarChart3,
        accentClass: "text-ok bg-ok-soft border-ok/30",
    },
    {
        type: "maintenance",
        label: "Maintenance Report",
        description: "Service history, scheduled tasks, downtime records, maintenance costs, and technician assignments.",
        icon: Wrench,
        accentClass: "text-warn bg-warn-soft border-warn/30",
    },
];

function StatusBadge({ status }: { status?: string }) {
    if (!status) return null;
    const s = status.toUpperCase();
    if (s === "COMPLETED") return (
        <span className="inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok-soft px-2 py-0.5 text-[10px] font-bold text-ok">
            <CheckCircle2 className="h-2.5 w-2.5" /> DONE
        </span>
    );
    if (s === "FAILED") return (
        <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger">
            <AlertCircle className="h-2.5 w-2.5" /> FAILED
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-warn/30 bg-warn-soft px-2 py-0.5 text-[10px] font-bold text-warn">
            <Clock className="h-2.5 w-2.5" /> {s}
        </span>
    );
}

function FormatBadge({ format }: { format?: string }) {
    const f = (format || "").toUpperCase();
    const colors: Record<string, string> = {
        PDF: "bg-danger-soft text-danger border-danger/30",
        EXCEL: "bg-ok-soft text-ok border-ok/30",
        CSV: "bg-info-soft text-info border-info/30",
    };
    const label: Record<string, string> = { PDF: "PDF", EXCEL: "XLS", CSV: "CSV" };
    return (
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", colors[f] || "border-edge-subtle bg-surface-muted text-muted-fg")}>
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
    const { confirm, ConfirmDialog } = useConfirm();

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
        if (!await confirm({ message: "Are you sure you want to delete this report?", variant: "danger" })) return;
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
            <PageHeader
                title="Reports"
                subtitle="Generate and download operational and compliance reports in PDF, Excel, or CSV."
                actions={
                    <Button variant="outline" size="sm" onClick={() => fetchHistory()} disabled={historyLoading} className="h-8 gap-1.5 text-xs">
                        <RefreshCw className={cn("h-3.5 w-3.5", historyLoading && "animate-spin")} /> Refresh History
                    </Button>
                }
            />

            <div className="grid gap-4 md:grid-cols-3">
                {REPORT_CONFIGS.map(config => (
                    <Card key={config.type} className="flex flex-col transition-all hover:shadow-md">
                        <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-3">
                            <div className={cn("inline-flex w-fit items-center gap-2 rounded-control border px-2.5 py-1.5 text-sm font-semibold", config.accentClass)}>
                                <config.icon className="h-4 w-4" />
                                {config.label}
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-4 p-5">
                            <p className="flex-1 text-sm leading-relaxed text-muted-fg">{config.description}</p>

                            <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint-fg">Output Format</p>
                                <div className="flex gap-1.5">
                                    {FORMAT_OPTIONS.map(f => (
                                        <button key={f} onClick={() => setFormats(prev => ({ ...prev, [config.type]: f }))}
                                            className={cn(
                                                "rounded-control border px-3 py-1.5 text-xs font-bold transition-colors",
                                                formats[config.type] === f
                                                    ? "border-brand bg-brand text-white"
                                                    : "border-edge-subtle bg-surface text-muted-fg hover:border-brand/40 hover:text-brand",
                                            )}>
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={() => generateReport(config.type)}
                                disabled={generating !== ""}
                                className="w-full gap-2"
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

            <Card>
                <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                            <Clock className="h-4 w-4 text-faint-fg" /> Generated Reports History
                        </CardTitle>
                        {history && <span className="text-xs text-faint-fg">{history.totalReports} total</span>}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {historyLoading ? (
                        <div className="space-y-2 p-4">
                            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-control bg-surface-muted" />)}
                        </div>
                    ) : !history?.reports?.length ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FileSpreadsheet className="mb-3 h-12 w-12 text-faint-fg" />
                            <p className="text-sm font-medium text-muted-fg">No reports generated yet</p>
                            <p className="mt-1 text-xs text-faint-fg">Generate a report above and it will appear here</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-edge-subtle">
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-faint-fg">Report</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-faint-fg">Format</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-faint-fg">Generated</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-faint-fg">Rows</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-faint-fg">Status</th>
                                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-faint-fg">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                    {history.reports.map((r, i) => {
                                        const rowId = r.reportId || r.downloadUrl || `row-${i}`;
                                        const isDownloadable = !r.status || r.status.toUpperCase() === "COMPLETED";
                                        const isDownloading = downloadingId === rowId;
                                        return (
                                            <tr key={rowId} className="transition-colors hover:bg-surface-muted/50">
                                                <td className="px-5 py-3">
                                                    <div className="font-medium text-foreground">{r.type || r.reportType || "Asset Report"}</div>
                                                    <div className="data-mono max-w-[200px] truncate text-xs text-faint-fg">{r.reportId || r.downloadUrl || "—"}</div>
                                                </td>
                                                <td className="px-5 py-3"><FormatBadge format={r.format} /></td>
                                                <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-fg">
                                                    <div>{new Date(r.generatedAt).toLocaleString()}</div>
                                                    <div className="text-faint-fg">{formatRelativeTime(r.generatedAt)}</div>
                                                </td>
                                                <td className="px-5 py-3 text-muted-fg">{r.rowCount ?? "—"}</td>
                                                <td className="px-5 py-3"><StatusBadge status={r.status || "COMPLETED"} /></td>
                                                <td className="px-5 py-3 text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={!isDownloadable || isDownloading}
                                                        onClick={() => handleDownload(r)}
                                                        className="h-7 gap-1.5 text-xs"
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
                                                        className="ml-1 h-7 w-7 p-0 text-faint-fg hover:bg-danger-soft hover:text-danger"
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
            {ConfirmDialog}
        </div>
    );
}
