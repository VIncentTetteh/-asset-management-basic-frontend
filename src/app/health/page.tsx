"use client";

import { useEffect, useMemo, useState } from "react";
import { healthService } from "@/services/healthService";
import { DetailedHealth, ApiMetrics, DatabaseMetrics } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Activity, Server, Clock, Database, Cpu } from "lucide-react";
import { toast } from "react-hot-toast";

const formatBytes = (value?: number): string => {
    if (!value) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size.toFixed(size >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const formatPercent = (value?: number): string => {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    const normalized = value <= 1 ? value * 100 : value;
    return `${normalized.toFixed(normalized >= 10 ? 0 : 1)}%`;
};

const hasTrafficMetrics = (metrics: ApiMetrics | null): boolean =>
    Boolean(metrics && (metrics.totalRequests > 0 || metrics.successfulRequests > 0 || metrics.failedRequests > 0));

export default function HealthPage() {
    const [health, setHealth] = useState<DetailedHealth | null>(null);
    const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
    const [databaseMetrics, setDatabaseMetrics] = useState<DatabaseMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            healthService.getDetailedHealth().catch(() => null),
            healthService.getMetrics().catch(() => null),
            healthService.getDatabaseMetrics().catch(() => null),
        ])
            .then(([healthResponse, metricsResponse, databaseResponse]) => {
                setHealth(healthResponse);
                setMetrics(metricsResponse);
                setDatabaseMetrics(databaseResponse || metricsResponse?.database || null);
            })
            .catch(() => {
                toast.error("Failed to load health dashboard");
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const topCards = useMemo(() => {
        const jvm = metrics?.jvm;
        return [
            {
                title: "Global Status",
                value: health?.status || "UNKNOWN",
                meta: health?.version || "No version reported",
                icon: Activity,
                accent: health?.status === "UP" ? "text-emerald-600" : "text-red-600",
            },
            {
                title: "Uptime",
                value: health?.uptime || metrics?.uptime || "—",
                meta: metrics?.timestamp ? `Updated ${new Date(metrics.timestamp).toLocaleString()}` : "No metrics timestamp",
                icon: Clock,
                accent: "text-blue-600",
            },
            {
                title: "JVM Heap Used",
                value: formatBytes(jvm?.heapUsedBytes),
                meta: jvm?.heapMaxBytes ? `${formatPercent((jvm.heapUsedBytes || 0) / jvm.heapMaxBytes)} of heap max` : "Heap max unavailable",
                icon: Cpu,
                accent: "text-amber-600",
            },
            {
                title: "Database Pool",
                value: databaseMetrics?.status || "Unknown",
                meta: databaseMetrics?.totalConnections !== undefined
                    ? `${databaseMetrics.activeConnections || 0}/${databaseMetrics.totalConnections} active`
                    : "Connection pool details unavailable",
                icon: Database,
                accent: databaseMetrics?.status?.toUpperCase() === "UP" ? "text-emerald-600" : "text-slate-600",
            },
        ];
    }, [databaseMetrics, health, metrics]);

    if (loading) {
        return <div className="flex p-10 justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-slate-900">
                    <Activity className="text-blue-500" /> System Health Monitoring
                </h1>
                <p className="text-slate-500 mt-1">Operational status, JVM resource usage, database pool health, and API activity where available.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {topCards.map((card) => (
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

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5" /> Status Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-slate-500">Global Status</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${health?.status === "UP" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {health?.status || "UNKNOWN"}
                            </span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-slate-500">Uptime</span>
                            <span>{health?.uptime || metrics?.uptime || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-500">Version</span>
                            <span className="font-mono">{health?.version || "v1"}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Cpu className="w-5 h-5" /> JVM Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-slate-500">Heap Used</span>
                            <span>{formatBytes(metrics?.jvm?.heapUsedBytes)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-slate-500">Heap Max</span>
                            <span>{formatBytes(metrics?.jvm?.heapMaxBytes)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-slate-500">Non-Heap Used</span>
                            <span>{formatBytes(metrics?.jvm?.nonHeapUsedBytes)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-500">CPU Load</span>
                            <span>{formatPercent(metrics?.jvm?.processCpuLoad)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Database Pool</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-slate-500">Status</span>
                            <span>{databaseMetrics?.status || "Unknown"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-slate-500">Active Connections</span>
                            <span>{databaseMetrics?.activeConnections ?? "—"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-slate-500">Idle Connections</span>
                            <span>{databaseMetrics?.idleConnections ?? "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-500">Pool Utilization</span>
                            <span>{formatPercent(databaseMetrics?.usagePercent)}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> API Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        {hasTrafficMetrics(metrics) ? (
                            <>
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="font-medium text-slate-500">Total Requests</span>
                                    <span>{metrics?.totalRequests.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="font-medium text-slate-500">Success Rate</span>
                                    <span className="text-emerald-600 font-bold">{metrics?.successRate || "0%"}</span>
                                </div>
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="font-medium text-slate-500">Average Latency</span>
                                    <span>{metrics?.averageLatency || 0} ms</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-slate-500">Failed Requests</span>
                                    <span>{metrics?.failedRequests || 0}</span>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-slate-500">
                                Request and latency counters are not currently being reported by the backend, so this dashboard is prioritizing uptime and JVM health instead.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <h2 className="text-xl font-bold mt-8 text-slate-900">Component Status Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {health?.components && Object.entries(health.components).map(([name, detail]) => {
                    const component = (detail && typeof detail === "object" ? detail : {}) as Record<string, unknown>;
                    return (
                        <Card key={name}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg capitalize">{name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Status:</span>
                                        <span className={component.status === "UP" ? "text-green-600" : "text-red-600"}>
                                            {String(component.status || "UNKNOWN")}
                                        </span>
                                    </div>
                                    {Object.entries(component).filter(([key]) => key !== "status").map(([key, value]) => (
                                        <div key={key} className="flex justify-between gap-4">
                                            <span className="text-slate-500">{key}:</span>
                                            <span className="font-mono text-xs text-right">{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
