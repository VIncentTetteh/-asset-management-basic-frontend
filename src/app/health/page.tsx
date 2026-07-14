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
import { cn } from "@/lib/utils";

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
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", up ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
            {status || "UNKNOWN"}
        </span>
    );
}

function LatencyBar({ ms, max }: { ms: number; max: number }) {
    const pct = max > 0 ? Math.min((ms / max) * 100, 100) : 0;
    const color = ms > 500 ? "bg-danger" : ms > 200 ? "bg-warn" : "bg-ok";
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-surface-muted">
                <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="data-mono w-14 text-right text-xs text-muted-fg">{ms} ms</span>
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
            { title: "Global Status", value: health?.status || "UNKNOWN",            meta: health?.version || "—",           icon: Activity, accent: health?.status === "UP" ? "text-ok" : "text-danger" },
            { title: "Uptime",        value: health?.uptime || metrics?.uptime || "—", meta: metrics?.timestamp ? `Polled ${new Date(metrics.timestamp).toLocaleTimeString()}` : "No timestamp", icon: Clock, accent: "text-info" },
            { title: "JVM Heap",      value: formatBytes(jvm?.heapUsedBytes),         meta: jvm?.heapMaxBytes ? `${formatPercent((jvm.heapUsedBytes||0)/jvm.heapMaxBytes)} of max` : "—", icon: Cpu, accent: "text-warn" },
            { title: "DB Pool",       value: dbMetrics?.status || "—",               meta: dbMetrics?.totalConnections != null ? `${dbMetrics.activeConnections||0}/${dbMetrics.totalConnections} active` : "—", icon: Database, accent: (dbMetrics?.status||"").toUpperCase()==="UP" ? "text-ok" : "text-faint-fg" },
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
        <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-faint-fg" /></div>
    );

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-3 text-[22px] font-extrabold tracking-tight text-foreground">
                        <Activity className="text-brand" /> System Health Monitoring
                    </h1>
                    <p className="mt-1 text-[13px] text-muted-fg">
                        Live operational status, JVM resources, database pool, endpoint latency, throughput, and error breakdown.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchAll} className="shrink-0 gap-2">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {topCards.map(card => (
                    <Card key={card.title}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wide text-faint-fg">{card.title}</p>
                                <card.icon className={cn("h-4 w-4", card.accent)} />
                            </div>
                            <p className={cn("mt-3 text-2xl font-bold", card.accent)}>{card.value}</p>
                            <p className="mt-2 text-xs text-faint-fg">{card.meta}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex gap-1 border-b border-edge-subtle">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                            activeTab === tab.id ? "border-brand text-brand" : "border-transparent text-muted-fg hover:text-foreground",
                        )}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "overview" && (
                <div className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-faint-fg" /> Status Overview</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {([
                                    ["Global Status",  <StatusBadge key="s" status={health?.status} />],
                                    ["Uptime",         health?.uptime || metrics?.uptime || "N/A"],
                                    ["Version",        <span key="v" className="data-mono">{health?.version || "v1"}</span>],
                                ] as [string, React.ReactNode][]).map(([label, val]) => (
                                    <div key={label} className="flex items-center justify-between border-b border-edge-subtle pb-2 last:border-0 last:pb-0">
                                        <span className="font-medium text-faint-fg">{label}</span>
                                        <span className="text-foreground">{val}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5 text-faint-fg" /> JVM Stats</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {([
                                    ["Heap Used",     formatBytes(metrics?.jvm?.heapUsedBytes)],
                                    ["Heap Max",      formatBytes(metrics?.jvm?.heapMaxBytes)],
                                    ["Non-Heap Used", formatBytes(metrics?.jvm?.nonHeapUsedBytes)],
                                    ["CPU Load",      formatPercent(metrics?.jvm?.processCpuLoad)],
                                    ["Threads",       String(metrics?.jvm?.threadCount ?? "—")],
                                ] as [string, string][]).map(([label, val]) => (
                                    <div key={label} className="flex justify-between border-b border-edge-subtle pb-2 last:border-0 last:pb-0">
                                        <span className="text-faint-fg">{label}</span>
                                        <span className="text-foreground">{val}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-faint-fg" /> Database Pool</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {([
                                    ["Status",             <StatusBadge key="dbs" status={dbMetrics?.status} />],
                                    ["Active Connections", String(dbMetrics?.activeConnections ?? "—")],
                                    ["Idle Connections",   String(dbMetrics?.idleConnections   ?? "—")],
                                    ["Max Pool Size",      String(dbMetrics?.maxConnections    ?? "—")],
                                    ["Utilisation",        formatPercent(dbMetrics?.usagePercent)],
                                    ["Avg Response",       dbMetrics?.responseTimeMs != null ? `${dbMetrics.responseTimeMs} ms` : "—"],
                                ] as [string, React.ReactNode][]).map(([label, val]) => (
                                    <div key={label} className="flex justify-between border-b border-edge-subtle pb-2 last:border-0 last:pb-0">
                                        <span className="text-faint-fg">{label}</span>
                                        <span className="text-foreground">{val}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-faint-fg" /> API Activity</CardTitle></CardHeader>
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
                                        <div key={label} className="flex justify-between border-b border-edge-subtle pb-2 last:border-0 last:pb-0">
                                            <span className="text-faint-fg">{label}</span>
                                            <span className={cn(label === "Success Rate" && "font-bold text-ok", label === "Error Rate" && "font-bold text-danger", label !== "Success Rate" && label !== "Error Rate" && "text-foreground")}>{val}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-faint-fg">Traffic counters not yet reported by the backend.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {health?.components && Object.keys(health.components).length > 0 && (
                        <>
                            <h2 className="text-lg font-bold text-foreground">Component Status Details</h2>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                {Object.entries(health.components).map(([name, detail]) => {
                                    const c = (detail && typeof detail === "object" ? detail : {}) as Record<string, unknown>;
                                    return (
                                        <Card key={name}>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="flex items-center justify-between text-base capitalize">
                                                    {name}
                                                    <StatusBadge status={String(c.status || "UNKNOWN")} />
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2 text-sm">
                                                {Object.entries(c).filter(([k]) => k !== "status").map(([k, v]) => (
                                                    <div key={k} className="flex justify-between gap-4">
                                                        <span className="text-faint-fg">{k}</span>
                                                        <span className="data-mono text-right text-xs text-muted-fg">{String(v)}</span>
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

            {activeTab === "endpoints" && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                            <Zap className="h-4 w-4 text-brand" /> Per-Endpoint Latency &amp; Calls
                        </CardTitle>
                        <select
                            value={sortBy}
                            onChange={e => { setSortBy(e.target.value as typeof sortBy); fetchAll(); }}
                            className="ea-focus rounded-control border border-edge bg-surface px-2 py-1 text-sm text-foreground"
                        >
                            <option value="latency">Sort: Latency</option>
                            <option value="requests">Sort: Requests</option>
                            <option value="errorRate">Sort: Error Rate</option>
                        </select>
                    </CardHeader>
                    <CardContent className="p-0">
                        {endpointMetrics.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-faint-fg">
                                <Zap className="h-10 w-10 opacity-30" />
                                <p className="text-sm">No endpoint metrics available yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-edge-subtle bg-surface-muted">
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Endpoint</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Method</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Requests</th>
                                            <th className="w-56 px-4 py-3 text-left font-medium text-muted-fg">Avg Latency</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Success</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Errors</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-subtle)]">
                                        {endpointMetrics.map((ep, i) => (
                                            <tr key={i} className="transition-colors hover:bg-surface-muted">
                                                <td className="data-mono px-4 py-3 text-xs text-foreground">{ep.endpoint}</td>
                                                <td className="px-4 py-3">
                                                    <span className={cn("rounded px-2 py-0.5 text-xs font-bold",
                                                        ep.method === "GET"    ? "bg-info-soft text-info"    :
                                                        ep.method === "POST"   ? "bg-ok-soft text-ok" :
                                                        ep.method === "DELETE" ? "bg-danger-soft text-danger"      :
                                                        "bg-warn-soft text-warn"
                                                    )}>{ep.method}</span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-fg">{ep.requests.toLocaleString()}</td>
                                                <td className="w-56 px-4 py-3">
                                                    <LatencyBar ms={ep.averageLatency} max={maxLatency} />
                                                </td>
                                                <td className="px-4 py-3 font-medium text-ok">{ep.successRate}</td>
                                                <td className="px-4 py-3">
                                                    <span className={parseFloat(ep.errorRate) > 5 ? "font-medium text-danger" : "text-faint-fg"}>
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

            {activeTab === "throughput" && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                            <BarChart3 className="h-4 w-4 text-brand" /> Request Throughput — Last 24 Hours
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {throughput.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-faint-fg">
                                <BarChart3 className="h-10 w-10 opacity-30" />
                                <p className="text-sm">No throughput data available yet</p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-4 flex h-40 items-end gap-1">
                                    {throughput.map((t, i) => {
                                        const pct    = maxRPM > 0 ? (t.requestCount / maxRPM) * 100 : 0;
                                        const errPct = t.requestCount > 0 ? (t.errorCount / t.requestCount) * 100 : 0;
                                        return (
                                            <div key={i} className="group relative flex flex-1 flex-col items-center" style={{ height: "100%" }}>
                                                <div className="flex w-full flex-col justify-end" style={{ height: "100%" }}>
                                                    <div className="w-full overflow-hidden rounded-t" style={{ height: `${pct}%` }}>
                                                        <div className="w-full bg-danger/50"  style={{ height: `${errPct}%` }} />
                                                        <div className="w-full bg-info" style={{ height: `${100 - errPct}%` }} />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-full z-10 mb-1 hidden flex-col items-center group-hover:flex">
                                                    <div className="whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white">
                                                        {t.requestCount} req · {t.errorCount} err · {t.averageLatency}ms
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mb-4 flex gap-4 text-xs text-faint-fg">
                                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-info" /> Successful</span>
                                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-danger/50" /> Errors</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-edge-subtle bg-surface-muted">
                                                <th className="px-3 py-2 text-left font-medium text-muted-fg">Hour</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-fg">Requests</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-fg">Success</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-fg">Errors</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-fg">Avg Latency</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-subtle)]">
                                            {throughput.map((t, i) => (
                                                <tr key={i} className="hover:bg-surface-muted">
                                                    <td className="data-mono px-3 py-2 text-xs text-muted-fg">{t.hour || `Hour ${i + 1}`}</td>
                                                    <td className="px-3 py-2 text-foreground">{t.requestCount.toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-ok">{t.successCount.toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-danger">{t.errorCount.toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-foreground">{t.averageLatency} ms</td>
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

            {activeTab === "errors" && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                            <AlertOctagon className="h-4 w-4 text-danger" /> Error Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {errorMetrics.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-faint-fg">
                                <AlertOctagon className="h-10 w-10 opacity-30" />
                                <p className="text-sm">No error metrics — this is a good sign!</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-edge-subtle bg-surface-muted">
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Error Code</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Type</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Count</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Share</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Last Seen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-subtle)]">
                                        {errorMetrics.map((e, i) => {
                                            const code = parseInt(e.errorCode, 10);
                                            const badge = code >= 500 ? "bg-danger-soft text-danger" : code >= 400 ? "bg-warn-soft text-warn" : "bg-surface-muted text-muted-fg";
                                            return (
                                                <tr key={i} className="transition-colors hover:bg-surface-muted">
                                                    <td className="px-4 py-3">
                                                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", badge)}>{e.errorCode}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-fg">{e.errorType}</td>
                                                    <td className="data-mono px-4 py-3 font-medium text-foreground">{e.count.toLocaleString()}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted">
                                                                <div className="h-full rounded-full bg-danger" style={{ width: e.percentage }} />
                                                            </div>
                                                            <span className="text-xs text-muted-fg">{e.percentage}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-faint-fg">
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
