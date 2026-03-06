"use client";

import { useState, useEffect } from "react";
import { reportService } from "@/services/reportService";
import { ReportHistory, ReportRequest, ReportResponse } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "react-hot-toast";

export default function ReportsPage() {
    const [history, setHistory] = useState<ReportHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<"" | "assets" | "financial" | "maintenance">("");
    const [downloadingId, setDownloadingId] = useState<string>("");
    const [format, setFormat] = useState("PDF");

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const data = await reportService.getReportHistory();
            setHistory(data);
        } catch (e) {
            toast.error("Failed to fetch reports");
        } finally {
            setLoading(false);
        }
    };

    const buildRequest = (): ReportRequest => ({
        format,
        includeDetails: true,
        filters: {},
        columns: ["name", "assetTag", "status", "departmentId", "currentBookValue"],
    });

    const triggerDownload = (blob: Blob, suggestedName: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    };

    const generateReport = async (type: "assets" | "financial" | "maintenance") => {
        try {
            setGenerating(type);
            let generated: ReportResponse;
            if (type === "assets") {
                generated = await reportService.generateAssetReport(buildRequest());
            } else if (type === "financial") {
                generated = await reportService.generateFinancialReport(buildRequest());
            } else {
                generated = await reportService.generateMaintenanceReport(buildRequest());
            }
            if ((generated.status || "").toUpperCase() === "COMPLETED") {
                toast.success(`${type[0].toUpperCase()}${type.slice(1)} report generated`);
            } else {
                toast.success(`${type[0].toUpperCase()}${type.slice(1)} report queued. Refresh history in a few seconds.`);
            }
            await fetchHistory();
        } catch (e) {
            toast.error("Report generation failed");
            console.error(e);
        } finally {
            setGenerating("");
        }
    };

    const handleDownload = async (report: ReportResponse) => {
        const id = report.reportId || report.downloadUrl || "report";
        try {
            setDownloadingId(id);
            let result: { blob: Blob; fileName?: string };
            if (report.reportId) {
                result = await reportService.downloadReport(report.reportId, report.format);
            } else if (report.downloadUrl) {
                result = await reportService.downloadFromUrl(report.downloadUrl, report.format);
            } else {
                toast.error("Download reference missing");
                return;
            }

            const extension = report.format?.toLowerCase() === "excel" ? "xlsx" : report.format?.toLowerCase() === "csv" ? "csv" : "pdf";
            const fallbackName = `${(report.type || "report").toLowerCase()}-${report.reportId || Date.now()}.${extension}`;
            triggerDownload(result.blob, result.fileName || fallbackName);
            toast.success("Download started");
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Download failed";
            toast.error(msg);
            console.error(e);
        } finally {
            setDownloadingId("");
        }
    };

    if (loading) return <div className="flex p-10 justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <PageHeader
                title="Reports"
                subtitle="Generate and securely download operational and compliance reports."
                actions={
                    <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                        <option value="PDF">PDF</option>
                        <option value="EXCEL">EXCEL</option>
                        <option value="CSV">CSV</option>
                    </Select>
                }
            />

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-slate-200">
                    <CardContent className="p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-slate-700"><FileText className="h-4 w-4" /> Asset Report</div>
                        <p className="text-sm text-slate-500">Portfolio inventory, status, and value snapshot.</p>
                        <Button onClick={() => generateReport("assets")} disabled={generating !== ""} className="bg-slate-900 hover:bg-black">
                            {generating === "assets" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Generate
                        </Button>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-slate-700"><FileSpreadsheet className="h-4 w-4" /> Financial Report</div>
                        <p className="text-sm text-slate-500">Depreciation, acquisition, and net book value movement.</p>
                        <Button onClick={() => generateReport("financial")} disabled={generating !== ""} className="bg-slate-900 hover:bg-black">
                            {generating === "financial" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Generate
                        </Button>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-slate-700"><ShieldCheck className="h-4 w-4" /> Maintenance Report</div>
                        <p className="text-sm text-slate-500">Service records, costs, and maintenance execution trends.</p>
                        <Button onClick={() => generateReport("maintenance")} disabled={generating !== ""} className="bg-slate-900 hover:bg-black">
                            {generating === "maintenance" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Generate
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Generated Reports History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-muted text-muted-foreground">
                                <tr>
                                    <th className="px-6 py-3">Report ID</th>
                                    <th className="px-6 py-3">Format</th>
                                    <th className="px-6 py-3">Generated At</th>
                                    <th className="px-6 py-3">Rows</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Download</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history?.reports?.map((r, i) => (
                                    <tr key={r.reportId || `${r.downloadUrl}-${i}`} className="border-b">
                                        <td className="px-6 py-4 font-mono text-xs">{r.reportId || r.downloadUrl}</td>
                                        <td className="px-6 py-4">{r.format || "N/A"}</td>
                                        <td className="px-6 py-4">{new Date(r.generatedAt).toLocaleString()}</td>
                                        <td className="px-6 py-4">{r.rowCount ?? "-"}</td>
                                        <td className="px-6 py-4">{r.type || "Asset"}</td>
                                        <td className="px-6 py-4">
                                            {r.status && r.status !== "COMPLETED" ? (
                                                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                                    {r.status}
                                                </span>
                                            ) : null}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={Boolean(r.status && r.status !== "COMPLETED") || downloadingId === (r.reportId || r.downloadUrl || "")}
                                                onClick={() => handleDownload(r)}
                                            >
                                                {downloadingId === (r.reportId || r.downloadUrl || "") ? (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Download className="w-4 h-4 mr-2" />
                                                )}
                                                Download
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {!history?.reports?.length && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-muted-foreground">No reports generated yet</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
