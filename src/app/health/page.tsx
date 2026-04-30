"use client";

import { useEffect, useMemo, useState } from "react";
import { healthService } from "@/services/healthService";
import {
    DetailedHealth, ApiMetrics, DatabaseMetrics,
    EndpointMetric, ThroughputMetric, ErrorMetric,
} from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Activity, Server, Clock, Database, Cpu, RefreshCw, BarChart3, AlertOctagon, Zap } from "lucide-react";
import { toast } from "react-hot-toast";

// ── Formatters ─────────────────────────────────────────────────────────────────

const formatBytes = (value?: number): string => {
    if (!value) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value, unit = 0;
    while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
    return `${size.toFixed(size >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const formatPercent = (value?: number): string => {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    const n = value <= 1 ? value * 100 : value;
    return `${n.toFixed(n >= 10 ? 0 : 1)}%`;
};

const hasTrafficMetrics = (m: ApiMetrics | null) =>
    Boolean(m && (m.totalRequests > 0 || m.successfulRequests > 0 || m.failedRequests > 0));

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
    const up = (status ?? "").toUpperCase() === "UP";
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            {status || "UNKNOWN"}
        </span>
    );
}

function LatencyBar({ ms, max }: { ms: number; max: number }) {
    const pct = max > 0 ? Math.min((ms / max) * 100, 100) : 0;
    const color = ms > 500 ? "bg-red-400" : ms > 200 ? "bg-amber-400" : "bg-emerald-400";
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-mono w-14 text-right text-slate-700">{ms} ms</span>
        </div>
    );
}

type Tab = "overview" | "endpoints" | "throughput" | "errors";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HealthPage() {
    const [health,          setHealth]          = useState<DetailedHealth | null>(null);
    const [metrics,         setMetrics]         = useState<ApiMetrics | null>(null);
    const [dbMetrics,       setDbMetrics]       = useState<DatabaseMetrics | null>(null);
    const [endpointMetrics, setEndpointMetrics] = useState<EndpointMetric[]>([]);
    const [throughput,      setThroughput]      = useState<ThroughputMetric[]>([]);
    const [errorMetrics,    setErrorMetrics]    = useState<ErrorMetric[]>([]);
    const [loading,         setLoading]         = useState(true);
    const [activeTab,       setActiveTab]       = useState<Tab>("overview");
    const [sortBy,          setSortBy]          = useState<"latency" | "requests" | "errorRate">("latency");

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [h, m, db, ep, tp, err] = await Promise.allSettled([
                healthService.getDetailedHealth(),
                healthService.getMetrics(),
                healthService.getDatabaseMetrics(),
                // GET /metrics/endpoints — per-endpoint latency & call counts
                healthService.getEndpointMetrics({ sortBy }),
                // GET /metrics/throughput — hourly request throughput (last 24 h)
                healthService.getThroughputMetrics({ hours: 24 }),
                // GET /metrics/errors — error breakdown by code / type
                healthService.getErrorMetrics(),
            ]);
            if (h.status   === "fulfilled") setHealth(h.value);
            if (m.status   === "fulfilled") setMetrics(m.value);
            if (db.status  === "fulfilled") setDbMetrics(db.value ?? null);
            else if (m.status === "fulfilled") setDbMetrics(m.value?.database ?? null);
            if (ep.status  === "fulfilled") setEndpointMetrics(ep.value?.endpoints ?? []);
            if (tp.status  === "fulfilled") setThroughput(tp.value?.throughput ?? []);
            if (err.status === "fulfilled") setErrorMetrics(err.value?.errors ?? []);
        } catch {
            toast.error("Failed to load health data");
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchAll(); }, []);

    const topCards = useMemo(() => {
        const jvm = metrics?.jvm;
        return [
            { title: "Global Status", value: health?.status || "UNKNOWN",            meta: health?.version || "—",           icon: Activity, accent: health?.status === "UP" ? "text-emerald-600" : "text-red-600" },
            { title: "Uptime",        value: health?.uptime || metrics?.uptime || "—", meta: metrics?.timestamp ? `Polled ${new Date(metrics.timestamp).toLocaleTimeString()}` : "No timestamp", icon: Clock, accent: "text-blue-600" },
            { title: "JVM Heap",      value: formatBytes(jvm?.heapUsedBytes),         meta: jvm?.heapMaxBytes ? `${formatPercent((jvm.heapUsedBytes||0)/jvm.heapMaxBytes)} of max` : "—", icon: Cpu, accent: "text-amber-600" },
            { title: "DB Pool",       value: dbMetrics?.status || "—",               meta: dbMetrics?.totalConnections != null ? `${dbMetrics.activeConnections||0}/${dbMetrics.totalConnections} active` : "—", icon: Database, accent: (dbMetrics?.status||"").toUpperCase()==="UP" ? "text-emerald-600" : "text-slate-500" },
        ];
    }, [health, metrics, dbMetrics]);

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "overview",   label: "Overview",                              icon: <Activity  className="h-3.5 w-3.5" /> },
        { id: "endpoints",  label: `Endpoints (${endpointMetrics.length})`, icon: <Zap       className="h-3.5 w-3.5" /> },
        { id: "throughput", label: "Throughput",                            icon: <BarChart3  className="h-3.5 w-3.5" /> },
        { id: "errors",     label: `Errors (${errorMetrics.length})`,       icon: <AlertOctagon className="h-3.5 w-3.5" /> },
    ];

    const maxLatency = endpointMetrics.reduce((m, e) => Math.max(m, e.averageLatency), 0);
    const maxRPM     = throughput.reduce((m, t) => Math.max(m, t.requestCount), 0);

    if (loading) return (
        <div className="flex p-10 justify-center"><Loader2 className="animate-spin w-8 h-8 text-slate-400" /></div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-slate-900">
                        <Activity className="text-blue-500" /> System Health Monitoring
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        Live operational status, JVM resources, database pool, endpoint latency, throughput, and error breakdown.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchAll} className="gap-2 shrink-0">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
            </div>

            {/* KPI row */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {topCards.map(card => (
                    <Card key={card.title} className="border-slate-200">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wide text-slate-500">{card.title}</p>
                                <card.icon className={`h-4 w-4 ${card.accent}`} />
                            </div>
                            <p className={`mt-3 text-2xl font-bold ${card.accent}`}>{card.value}</p>
                            <p className="mt-2 text-xs text-slate-500">{card.meta}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-100">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? "border-blue-600 text-blue-700"
                                : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Overview ── */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Server className="w-5 h-5" /> Status Overview</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {([
                                    ["Global Status",  <StatusBadge key="s" status={health?.status} />],
                                    ["Uptime",         health?.uptime || metrics?.uptime || "N/A"],
                                    ["Version",        <span key="v" className="font-mono">{health?.version || "v1"}</span>],
                                ] as [string, React.ReactNode][]).map(([label, val]) => (
                                    <div key={label} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                                        <span className="font-medium text-slate-500">{label}</span>
                                        <span>{val}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="w-5 h-5" /> JVM Stats</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {([
                                    ["Heap Used",     formatBytes(metrics?.jvm?.heapUsedBytes)],
                                    ["Heap Max",      formatBytes(metrics?.jvm?.heapMaxBytes)],
                                    ["Non-Heap Used", formatBytes(metrics?.jvm?.nonHeapUsedBytes)],
                                    ["CPU Load",      formatPercent(metrics?.jvm?.processCpuLoad)],
                                    ["Threads",       String(metrics?.jvm?.threadCount ?? "—")],
                                ] as [string, string][]).map(([label, val]) => (
                                    <div key={label} className="flex justify-between border-b pb-2 last:border-0 last:pb-0">
                                        <span className="text-slate-500">{label}</span>
                                        <span>{val}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Database Pool</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {([
                                    ["Status",             <StatusBadge key="dbs" status={dbMetrics?.status} />],
                                    ["Active Connections", String(dbMetrics?.activeConnections ?? "—")],
                                    ["Idle Connections",   String(dbMetrics?.idleConnections   ?? "—")],
                                    ["Max Pool Size",      String(dbMetrics?.maxConnections    ?? "—")],
                                    ["Utilisation",        formatPercent(dbMetrics?.usagePercent)],
                                    ["Avg Response",       dbMetrics?.responseTimeMs != null ? `${dbMetrics.responseTimeMs} ms` : "—"],
                                ] as [string, React.ReactNode][]).map(([label, val]) => (
                                    <div key={label} className="flex justify-between border-b pb-2 last:border-0 last:pb-0">
                                        <span className="text-slate-500">{label}</span>
                                        <span>{val}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> API Activity</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {hasTrafficMetrics(metrics) ? (
                                    ([
                                        ["Total Requests", metrics!.totalRequests.toLocaleString()],
                                        ["Success Rate",   metrics!.successRate || "0%"],
                                        ["Error Rate",     metrics!.errorRate   || "0%"],
                                        ["Avg Latency",    `${metrics!.averageLatency || 0} ms`],
                                        ["p95 Latency",    metrics!.p95Latency != null ? `${metrics!.p95Latency} ms` : "—"],
                                        ["Failed Requests", String(metrics!.failedRequests || 0)],
                                    ] as [string, string][]).map(([label, val]) => (
                                        <div key={label} className="flex justify-between border-b pb-2 last:border-0 last:pb-0">
                                            <span className="text-slate-500">{label}</span>
                                            <span className={label === "Success Rate" ? "text-emerald-600 font-bold" : label === "Error Rate" ? "text-red-600 font-bold" : ""}>{val}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-slate-400 text-sm">Traffic counters not yet reported by the backend.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {health?.components && Object.keys(health.components).length > 0 && (
                        <>
                            <h2 className="text-lg font-bold text-slate-900">Component Status Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {Object.entries(health.components).map(([name, detail]) => {
                                    const c = (detail && typeof detail === "object" ? detail : {}) as Record<string, unknown>;
                                    return (
                                        <Card key={name}>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base capitalize flex items-center justify-between">
                                                    {name}
                                                    <StatusBadge status={String(c.status || "UNKNOWN")} />
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-sm space-y-2">
                                                {Object.entries(c).filter(([k]) => k !== "status").map(([k, v]) => (
                                                    <div key={k} className="flex justify-between gap-4">
                                                        <span className="text-slate-500">{k}</span>
                                                        <span className="font-mono text-xs text-right">{String(v)}</span>
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Endpoints tab — GET /metrics/endpoints ── */}
            {activeTab === "endpoints" && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-600" /> Per-Endpoint Latency &amp; Calls
                        </CardTitle>
                        <select
                            value={sortBy}
                            onChange={e => { setSortBy(e.target.value as typeof sortBy); fetchAll(); }}
                            className="text-sm border border-slate-200 rounded-md px-2 py-1 focus:outline-none"
                        >
                            <option value="latency">Sort: Latency</option>
                            <option value="requests">Sort: Requests</option>
                            <option value="errorRate">Sort: Error Rate</option>
                        </select>
                    </CardHeader>
                    <CardContent className="p-0">
                        {endpointMetrics.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                                <Zap className="h-10 w-10 opacity-30" />
                                <p className="text-sm">No endpoint metrics available yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50">
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Endpoint</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Method</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Requests</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600 w-56">Avg Latency</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Success</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Errors</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {endpointMetrics.map((ep, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4 font-mono text-xs text-slate-800">{ep.endpoint}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                        ep.method === "GET"    ? "bg-blue-100 text-blue-700"    :
                                                        ep.method === "POST"   ? "bg-emerald-100 text-emerald-700" :
                                                        ep.method === "DELETE" ? "bg-red-100 text-red-700"      :
                                                        "bg-amber-100 text-amber-700"
                                                    }`}>{ep.method}</span>
                                                </td>
                                                <td className="py-3 px-4 text-slate-700">{ep.requests.toLocaleString()}</td>
                                                <td className="py-3 px-4 w-56">
                                                    <LatencyBar ms={ep.averageLatency} max={maxLatency} />
                                                </td>
                                                <td className="py-3 px-4 text-emerald-600 font-medium">{ep.successRate}</td>
                                                <td className="py-3 px-4">
                                                    <span className={parseFloat(ep.errorRate) > 5 ? "text-red-600 font-medium" : "text-slate-500"}>
                                                        {ep.errorRate}
                                                    </span>
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

            {/* ── Throughput tab — GET /metrics/throughput ── */}
            {activeTab === "throughput" && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-blue-600" /> Request Throughput — Last 24 Hours
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {throughput.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                                <BarChart3 className="h-10 w-10 opacity-30" />
                                <p className="text-sm">No throughput data available yet</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-end gap-1 h-40 mb-4">
                                    {throughput.map((t, i) => {
                                        const pct    = maxRPM > 0 ? (t.requestCount / maxRPM) * 100 : 0;
                                        const errPct = t.requestCount > 0 ? (t.errorCount / t.requestCount) * 100 : 0;
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center group relative" style={{ height: "100%" }}>
                                                <div className="w-full flex flex-col justify-end" style={{ height: "100%" }}>
                                                    <div className="w-full rounded-t overflow-hidden" style={{ height: `${pct}%` }}>
                                                        <div className="w-full bg-red-300"  style={{ height: `${errPct}%` }} />
                                                        <div className="w-full bg-blue-400" style={{ height: `${100 - errPct}%` }} />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10">
                                                    <div className="bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                                        {t.requestCount} req · {t.errorCount} err · {t.averageLatency}ms
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-4 text-xs text-slate-500 mb-4">
                                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400 inline-block" /> Successful</span>
                                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-300 inline-block" /> Errors</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50">
                                                <th className="text-left py-2 px-3 font-medium text-slate-600">Hour</th>
                                                <th className="text-left py-2 px-3 font-medium text-slate-600">Requests</th>
                                                <th className="text-left py-2 px-3 font-medium text-slate-600">Success</th>
                                                <th className="text-left py-2 px-3 font-medium text-slate-600">Errors</th>
                                                <th className="text-left py-2 px-3 font-medium text-slate-600">Avg Latency</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {throughput.map((t, i) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="py-2 px-3 font-mono text-xs text-slate-600">{t.hour || `Hour ${i + 1}`}</td>
                                                    <td className="py-2 px-3">{t.requestCount.toLocaleString()}</td>
                                                    <td className="py-2 px-3 text-emerald-600">{t.successCount.toLocaleString()}</td>
                                                    <td className="py-2 px-3 text-red-600">{t.errorCount.toLocaleString()}</td>
                                                    <td className="py-2 px-3">{t.averageLatency} ms</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── Errors tab — GET /metrics/errors ── */}
            {activeTab === "errors" && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <AlertOctagon className="h-4 w-4 text-red-600" /> Error Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {errorMetrics.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                                <AlertOctagon className="h-10 w-10 opacity-30" />
                                <p className="text-sm">No error metrics — this is a good sign!</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50">
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Error Code</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Count</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Share</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Last Seen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {errorMetrics.map((e, i) => {
                                            const code = parseInt(e.errorCode, 10);
                                            const badge = code >= 500 ? "bg-red-100 text-red-700" : code >= 400 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
                                            return (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badge}`}>{e.errorCode}</span>
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-700">{e.errorType}</td>
                                                    <td className="py-3 px-4 font-mono font-medium">{e.count.toLocaleString()}</td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                                                                <div className="h-full rounded-full bg-red-400" style={{ width: e.percentage }} />
                                                            </div>
                                                            <span className="text-xs text-slate-600">{e.percentage}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-xs text-slate-500">
                                                        {e.lastOccurrence ? new Date(e.lastOccurrence).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—"}
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
            )}
        </div>
    );
}
