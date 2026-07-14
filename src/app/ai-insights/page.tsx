"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PredictiveInsight, InsightSummary, InsightType, InsightSeverity } from "@/types";
import { aiInsightsService } from "@/services/aiInsightsService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import {
    Brain, CheckCircle2, AlertTriangle, Calendar, Clock,
    TrendingUp, Wrench, ShieldAlert, Zap, BarChart3, ChevronRight,
    Activity, Package, FileWarning, Cpu, ArrowRight,
} from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";

// ── Meta ──────────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
    CRITICAL: "bg-danger-soft text-danger border-danger/30",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
    MEDIUM: "bg-warn-soft text-warn border-warn/30",
    LOW: "bg-surface-muted text-faint-fg border-edge-subtle",
};

const SEVERITY_DOT: Record<InsightSeverity, string> = {
    CRITICAL: "bg-danger",
    HIGH: "bg-orange-500",
    MEDIUM: "bg-warn",
    LOW: "bg-faint-fg",
};

const SEVERITY_BAR: Record<InsightSeverity, string> = {
    CRITICAL: "bg-danger",
    HIGH: "bg-orange-400",
    MEDIUM: "bg-warn",
    LOW: "bg-faint-fg",
};

const INSIGHT_META: Record<InsightType, { label: string; color: string; icon: React.ReactNode; action: string }> = {
    MAINTENANCE_DUE: { label: "Maintenance Due", color: "bg-info-soft text-info", icon: <Wrench className="h-4 w-4" />, action: "Schedule maintenance" },
    FAILURE_RISK: { label: "Failure Risk", color: "bg-danger-soft text-danger", icon: <ShieldAlert className="h-4 w-4" />, action: "Inspect asset immediately" },
    WARRANTY_EXPIRY: { label: "Warranty Expiry", color: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300", icon: <FileWarning className="h-4 w-4" />, action: "Review warranty renewal" },
    DEPRECIATION_COMPLETE: { label: "Fully Depreciated", color: "bg-warn-soft text-warn", icon: <TrendingUp className="h-4 w-4" />, action: "Plan replacement or disposal" },
    ASSET_AGING: { label: "Asset Aging", color: "bg-surface-muted text-muted-fg", icon: <Clock className="h-4 w-4" />, action: "Assess replacement timeline" },
    ANOMALY: { label: "Anomaly Detected", color: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300", icon: <Zap className="h-4 w-4" />, action: "Investigate immediately" },
    UNDERUTILIZED: { label: "Underutilized", color: "bg-ok-soft text-ok", icon: <Activity className="h-4 w-4" />, action: "Reallocate or retire" },
    LICENSE_EXPIRY: { label: "License Expiry", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", icon: <Package className="h-4 w-4" />, action: "Renew license" },
};

const SEVERITY_ORDER: InsightSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const INSIGHT_TYPES: InsightType[] = ["MAINTENANCE_DUE", "FAILURE_RISK", "WARRANTY_EXPIRY", "DEPRECIATION_COMPLETE", "ASSET_AGING", "ANOMALY", "UNDERUTILIZED", "LICENSE_EXPIRY"];

const daysBetween = (dateStr: string) => {
    const now = new Date();
    const target = new Date(dateStr);
    return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ── Health Score ──────────────────────────────────────────────────────────────

const computeHealthScore = (insights: PredictiveInsight[]): number => {
    if (!insights.length) return 100;
    const unresolved = insights.filter(i => !i.resolved);
    if (!unresolved.length) return 100;
    const deductions = unresolved.reduce((sum, i) => {
        const weight = { CRITICAL: 25, HIGH: 12, MEDIUM: 5, LOW: 2 }[i.severity] ?? 2;
        const conf = i.confidence ?? 0.5;
        return sum + weight * conf;
    }, 0);
    return Math.max(0, Math.round(100 - deductions));
};

const healthColor = (score: number) =>
    score >= 80 ? "text-ok" : score >= 60 ? "text-warn" : "text-danger";

const healthBg = (score: number) =>
    score >= 80 ? "bg-ok" : score >= 60 ? "bg-warn" : "bg-danger";

const healthLabel = (score: number) =>
    score >= 80 ? "Healthy" : score >= 60 ? "Needs Attention" : "At Risk";

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiInsightsPage() {
    const [insights, setInsights] = useState<PredictiveInsight[]>([]);
    const [summary, setSummary] = useState<InsightSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [filterType, setFilterType] = useState<InsightType | "">("");
    const [filterSeverity, setFilterSeverity] = useState<InsightSeverity | "">("");
    const [unresolvedOnly, setUnresolvedOnly] = useState(true);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<"timeline" | "priority" | "byType" | "list">("priority");

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const [insightsResult, summaryResult] = await Promise.allSettled([
                aiInsightsService.getAll({
                    type: filterType || undefined,
                    severity: filterSeverity || undefined,
                    unresolvedOnly,
                }),
                aiInsightsService.getSummary(),
            ]);
            if (insightsResult.status === "fulfilled") setInsights(insightsResult.value);
            if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
        } catch {
            toast.error("Failed to load insights");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, [filterType, filterSeverity, unresolvedOnly]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const res = await aiInsightsService.generate();
            const count = Array.isArray(res) ? res.length : 0;
            toast.success(count > 0
                ? `AI generated ${count} insight${count !== 1 ? "s" : ""} for your portfolio`
                : "AI has re-analysed your asset portfolio");
            fetchAll();
        } catch {
            toast.error("Failed to generate insights");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleResolve = async (id: string) => {
        if (!await confirm({ message: "Mark this insight as resolved?", variant: "danger" })) return;
        setResolvingId(id);
        try {
            await aiInsightsService.resolve(id);
            toast.success("Insight resolved");
            fetchAll();
        } catch {
            toast.error("Failed to resolve insight");
        } finally {
            setResolvingId(null);
        }
    };

    // ── Derived data ─────────────────────────────────────────────────────────

    const healthScore = useMemo(() => computeHealthScore(insights), [insights]);

    const upcoming30 = useMemo(() =>
        insights
            .filter(i => !i.resolved && i.predictedDate)
            .map(i => ({ ...i, daysAway: daysBetween(i.predictedDate!) }))
            .filter(i => i.daysAway >= 0 && i.daysAway <= 30)
            .sort((a, b) => a.daysAway - b.daysAway),
        [insights]);

    const overdue = useMemo(() =>
        insights
            .filter(i => !i.resolved && i.predictedDate && daysBetween(i.predictedDate) < 0)
            .sort((a, b) => daysBetween(a.predictedDate!) - daysBetween(b.predictedDate!)),
        [insights]);

    const prioritized = useMemo(() =>
        [...insights]
            .filter(i => !i.resolved)
            .sort((a, b) => {
                const sevScore = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
                const diff = (sevScore[b.severity] ?? 0) - (sevScore[a.severity] ?? 0);
                if (diff !== 0) return diff;
                return (b.confidence ?? 0) - (a.confidence ?? 0);
            }),
        [insights]);

    const { confirm, ConfirmDialog } = useConfirm();
    const byType = useMemo(() => {
        const map = new Map<InsightType, PredictiveInsight[]>();
        insights.filter(i => !i.resolved).forEach(i => {
            const arr = map.get(i.insightType) ?? [];
            arr.push(i);
            map.set(i.insightType, arr);
        });
        return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
    }, [insights]);

    const unresolvedCount = insights.filter(i => !i.resolved).length;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            <PageHeader
                title="AI Predictive Insights"
                subtitle="AI-powered predictions for asset maintenance, failure risk, and lifecycle events."
                actions={
                    <Button onClick={handleGenerate} isLoading={isGenerating} className="gap-2">
                        <Brain className="h-4 w-4" /> {isGenerating ? "Analysing…" : "Re-Analyse Portfolio"}
                    </Button>
                }
            />

            <div className="grid gap-4 md:grid-cols-6">
                <Card className="md:col-span-2">
                    <CardContent className="p-5">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint-fg">Portfolio Health Score</p>
                        <div className="flex items-end gap-3">
                            <span className={cn("text-5xl font-black leading-none", healthColor(healthScore))}>{healthScore}</span>
                            <span className="mb-1 text-lg text-faint-fg">/100</span>
                        </div>
                        <div className="mt-3 h-2 w-full rounded-full bg-surface-muted">
                            <div className={cn("h-2 rounded-full transition-all", healthBg(healthScore))} style={{ width: `${healthScore}%` }} />
                        </div>
                        <p className={cn("mt-2 text-sm font-semibold", healthColor(healthScore))}>{healthLabel(healthScore)}</p>
                        <p className="mt-1 text-xs text-faint-fg">
                            Based on {unresolvedCount} unresolved insight{unresolvedCount !== 1 ? "s" : ""} · weighted by severity and confidence
                        </p>
                    </CardContent>
                </Card>

                {SEVERITY_ORDER.map(sev => (
                    <Card key={sev} className="cursor-pointer transition-shadow hover:shadow-sm"
                        onClick={() => setFilterSeverity(filterSeverity === sev ? "" : sev)}>
                        <CardContent className="p-4">
                            <div className="mb-2 flex items-center justify-between">
                                <span className={cn("inline-block h-2 w-2 rounded-full", SEVERITY_DOT[sev])} />
                                <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", SEVERITY_STYLES[sev])}>
                                    {sev.toLowerCase()}
                                </span>
                            </div>
                            <p className="data-mono text-3xl font-black text-foreground">{summary?.bySeverity?.[sev] ?? 0}</p>
                            <p className="mt-1 text-xs text-faint-fg">unresolved</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {(overdue.length > 0 || upcoming30.length > 0) && (
                <div className="grid gap-4 md:grid-cols-2">
                    {overdue.length > 0 && (
                        <Card className="border-danger/30 bg-danger-soft/40">
                            <CardHeader className="px-4 pb-2 pt-4">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-danger">
                                    <AlertTriangle className="h-4 w-4" /> {overdue.length} Overdue Prediction{overdue.length !== 1 ? "s" : ""}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 px-4 pb-4">
                                {overdue.slice(0, 4).map(insight => (
                                    <div key={insight.id} className="flex items-center justify-between gap-3 rounded-control border border-danger/20 bg-surface p-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-foreground">{insight.assetName || insight.assetId}</p>
                                            <p className="text-xs font-medium text-danger">
                                                {INSIGHT_META[insight.insightType]?.label} · {Math.abs(daysBetween(insight.predictedDate!))}d overdue
                                            </p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => handleResolve(insight.id)}
                                            isLoading={resolvingId === insight.id}
                                            className="h-7 shrink-0 border-danger/30 px-2 text-xs text-danger hover:bg-danger-soft">
                                            Resolve
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {upcoming30.length > 0 && (
                        <Card className="border-warn/30 bg-warn-soft/40">
                            <CardHeader className="px-4 pb-2 pt-4">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-warn">
                                    <Calendar className="h-4 w-4" /> {upcoming30.length} Event{upcoming30.length !== 1 ? "s" : ""} in Next 30 Days
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 px-4 pb-4">
                                {upcoming30.slice(0, 4).map(insight => (
                                    <div key={insight.id} className="flex items-center justify-between gap-3 rounded-control border border-warn/20 bg-surface p-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground">{insight.assetName || insight.assetId}</p>
                                            <p className="text-xs font-medium text-warn">
                                                {INSIGHT_META[insight.insightType]?.label} · in {insight.daysAway}d ({formatDate(insight.predictedDate!)})
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", SEVERITY_STYLES[insight.severity])}>
                                                {insight.severity}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1 rounded-control border border-edge-subtle bg-surface-muted p-1">
                    {(["priority", "timeline", "byType", "list"] as const).map(v => (
                        <button key={v} onClick={() => setActiveView(v)}
                            className={cn(
                                "rounded-control px-3 py-1.5 text-xs font-semibold transition-colors",
                                activeView === v ? "bg-surface text-foreground shadow-sm" : "text-muted-fg hover:text-foreground",
                            )}>
                            {v === "priority" ? "Priority" : v === "timeline" ? "Timeline" : v === "byType" ? "By Type" : "All Insights"}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Select value={filterType} onChange={e => setFilterType(e.target.value as InsightType | "")} className="w-48 text-sm">
                        <option value="">All Types</option>
                        {INSIGHT_TYPES.map(t => <option key={t} value={t}>{INSIGHT_META[t]?.label}</option>)}
                    </Select>
                    <Select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as InsightSeverity | "")} className="w-36 text-sm">
                        <option value="">All Severities</option>
                        {SEVERITY_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                    <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-fg">
                        <input type="checkbox" checked={unresolvedOnly} onChange={e => setUnresolvedOnly(e.target.checked)}
                            className="h-4 w-4 rounded border-edge accent-[var(--primary)]" />
                        Unresolved only
                    </label>
                </div>
            </div>

            {isLoading ? (
                <Card>
                    <CardContent className="flex h-64 items-center justify-center">
                        <PageSpinner />
                    </CardContent>
                </Card>
            ) : insights.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-16 text-center">
                        <Brain className="mb-4 h-14 w-14 text-faint-fg" />
                        <h3 className="text-lg font-semibold text-foreground">No insights found</h3>
                        <p className="mt-1 max-w-sm text-muted-fg">
                            {unresolvedOnly ? "All insights are resolved — your portfolio is in good shape." : 'Click "Re-Analyse Portfolio" to generate AI predictions for your assets.'}
                        </p>
                        <Button onClick={handleGenerate} isLoading={isGenerating} className="mt-4 gap-2">
                            <Brain className="h-4 w-4" /> Analyse Now
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {activeView === "priority" && (
                        <div className="space-y-3">
                            {prioritized.slice(0, 20).map((insight, idx) => {
                                const meta = INSIGHT_META[insight.insightType];
                                const daysAway = insight.predictedDate ? daysBetween(insight.predictedDate) : null;
                                return (
                                    <Card key={insight.id} className="transition-shadow hover:shadow-sm">
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-4">
                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-faint-fg">
                                                    {idx + 1}
                                                </div>

                                                <div className={cn("shrink-0 rounded-control p-2", meta?.color ?? "bg-surface-muted text-muted-fg")}>
                                                    {meta?.icon ?? <Cpu className="h-4 w-4" />}
                                                </div>

                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", SEVERITY_STYLES[insight.severity])}>
                                                            {insight.severity}
                                                        </span>
                                                        <span className={cn("rounded px-2 py-0.5 text-xs font-medium", meta?.color ?? "bg-surface-muted text-muted-fg")}>
                                                            {meta?.label}
                                                        </span>
                                                        {insight.resolved && (
                                                            <span className="flex items-center gap-1 text-xs font-medium text-ok">
                                                                <CheckCircle2 className="h-3 w-3" /> Resolved
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="font-semibold text-foreground">{insight.title}</p>
                                                    <p className="text-sm text-muted-fg">{insight.description}</p>

                                                    <div className="flex flex-wrap gap-4 pt-1">
                                                        <span className="text-xs text-faint-fg">
                                                            Asset: <span className="font-medium text-muted-fg">{insight.assetName || insight.assetId}</span>
                                                        </span>
                                                        {insight.assetTag && (
                                                            <span className="text-xs text-faint-fg">
                                                                Tag: <span className="data-mono text-faint-fg">{insight.assetTag}</span>
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-1.5 text-xs text-faint-fg">
                                                            <BarChart3 className="h-3 w-3" />
                                                            Confidence:
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
                                                                    <span className={cn("block h-full rounded-full", SEVERITY_BAR[insight.severity])}
                                                                        style={{ width: `${(insight.confidence ?? 0) * 100}%` }} />
                                                                </span>
                                                                <span className="font-medium text-muted-fg">{Math.round((insight.confidence ?? 0) * 100)}%</span>
                                                            </span>
                                                        </span>
                                                        {daysAway !== null && (
                                                            <span className={cn("text-xs font-medium", daysAway < 0 ? "text-danger" : daysAway <= 7 ? "text-orange-600 dark:text-orange-300" : "text-faint-fg")}>
                                                                {daysAway < 0 ? `${Math.abs(daysAway)}d overdue` : daysAway === 0 ? "Today" : `In ${daysAway} days`}
                                                                {insight.predictedDate ? ` (${formatDate(insight.predictedDate)})` : ""}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {meta?.action && (
                                                        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand">
                                                            <ChevronRight className="h-3 w-3" />
                                                            Recommended: {meta.action}
                                                        </div>
                                                    )}
                                                </div>

                                                {!insight.resolved && (
                                                    <Button variant="outline" size="sm" onClick={() => handleResolve(insight.id)}
                                                        isLoading={resolvingId === insight.id}
                                                        className="h-8 shrink-0 border-ok/30 px-3 text-xs text-ok hover:bg-ok-soft">
                                                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Resolve
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {activeView === "timeline" && (
                        <Card>
                            <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                                    <Calendar className="h-4 w-4 text-brand" /> Predicted Event Timeline
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {insights.filter(i => i.predictedDate && !i.resolved).length === 0 ? (
                                    <p className="p-8 text-center text-sm text-faint-fg">No predicted dates available for current insights.</p>
                                ) : (
                                    <div className="divide-y divide-[var(--border-subtle)]">
                                        {[...insights]
                                            .filter(i => i.predictedDate && !i.resolved)
                                            .sort((a, b) => new Date(a.predictedDate!).getTime() - new Date(b.predictedDate!).getTime())
                                            .map(insight => {
                                                const meta = INSIGHT_META[insight.insightType];
                                                const daysAway = daysBetween(insight.predictedDate!);
                                                return (
                                                    <div key={insight.id} className="flex items-start gap-4 p-4 hover:bg-surface-muted/50">
                                                        <div className="w-24 shrink-0 text-right">
                                                            <p className={cn("text-sm font-bold", daysAway < 0 ? "text-danger" : daysAway <= 7 ? "text-orange-600 dark:text-orange-300" : "text-muted-fg")}>
                                                                {formatDate(insight.predictedDate!)}
                                                            </p>
                                                            <p className={cn("mt-0.5 text-xs", daysAway < 0 ? "text-danger" : "text-faint-fg")}>
                                                                {daysAway < 0 ? `${Math.abs(daysAway)}d overdue` : daysAway === 0 ? "Today" : `${daysAway}d`}
                                                            </p>
                                                        </div>

                                                        <div className="flex shrink-0 flex-col items-center pt-1.5">
                                                            <div className={cn("h-3 w-3 rounded-full border-2 border-[var(--surface)] ring-2", daysAway < 0 ? "bg-danger ring-danger/30" : "bg-brand ring-brand/30")} />
                                                        </div>

                                                        <div className="min-w-0 flex-1 space-y-1 pb-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", SEVERITY_STYLES[insight.severity])}>
                                                                    {insight.severity}
                                                                </span>
                                                                <span className={cn("rounded px-2 py-0.5 text-xs", meta?.color)}>{meta?.label}</span>
                                                            </div>
                                                            <p className="font-medium text-foreground">{insight.title}</p>
                                                            <p className="text-xs text-faint-fg">
                                                                {insight.assetName || insight.assetId}
                                                                {insight.assetTag ? ` · ${insight.assetTag}` : ""}
                                                                {" · "}
                                                                <span className="font-medium">{Math.round((insight.confidence ?? 0) * 100)}% confidence</span>
                                                            </p>
                                                            {meta?.action && (
                                                                <p className="text-xs font-medium text-brand">{meta.action}</p>
                                                            )}
                                                        </div>

                                                        <Button variant="outline" size="sm" onClick={() => handleResolve(insight.id)}
                                                            isLoading={resolvingId === insight.id}
                                                            className="h-7 shrink-0 border-ok/30 px-2 text-xs text-ok hover:bg-ok-soft">
                                                            <CheckCircle2 className="mr-1 h-3 w-3" /> Done
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {activeView === "byType" && (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {byType.map(([type, typeInsights]) => {
                                const meta = INSIGHT_META[type];
                                const critical = typeInsights.filter(i => i.severity === "CRITICAL").length;
                                const high = typeInsights.filter(i => i.severity === "HIGH").length;
                                return (
                                    <Card key={type} className="transition-shadow hover:shadow-sm">
                                        <CardHeader className="pb-2 pt-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("rounded-control p-1.5", meta?.color ?? "bg-surface-muted text-muted-fg")}>
                                                        {meta?.icon ?? <Cpu className="h-4 w-4" />}
                                                    </div>
                                                    <CardTitle className="text-sm font-semibold text-foreground">{meta?.label}</CardTitle>
                                                </div>
                                                <span className="data-mono text-2xl font-black text-foreground">{typeInsights.length}</span>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-2 pt-0">
                                            <div className="flex h-2 gap-1">
                                                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as InsightSeverity[]).map(sev => {
                                                    const count = typeInsights.filter(i => i.severity === sev).length;
                                                    const pct = typeInsights.length ? (count / typeInsights.length) * 100 : 0;
                                                    return pct > 0 ? (
                                                        <div key={sev} className={cn("h-2 rounded-full", SEVERITY_BAR[sev])} style={{ width: `${pct}%` }} title={`${sev}: ${count}`} />
                                                    ) : null;
                                                })}
                                            </div>
                                            <p className="text-xs text-faint-fg">
                                                {critical > 0 && <span className="font-semibold text-danger">{critical} critical</span>}
                                                {critical > 0 && high > 0 && <span className="mx-1">·</span>}
                                                {high > 0 && <span className="font-semibold text-orange-600 dark:text-orange-300">{high} high</span>}
                                                {critical === 0 && high === 0 && "No critical or high severity"}
                                            </p>
                                            <div className="space-y-1 border-t border-edge-subtle pt-1">
                                                {typeInsights.slice(0, 2).map(i => (
                                                    <div key={i.id} className="flex items-center justify-between gap-2 text-xs">
                                                        <span className="truncate text-muted-fg">{i.assetName || i.assetId}</span>
                                                        <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-bold", SEVERITY_STYLES[i.severity])}>{i.severity[0]}</span>
                                                    </div>
                                                ))}
                                                {typeInsights.length > 2 && (
                                                    <button onClick={() => { setFilterType(type); setActiveView("list"); }}
                                                        className="text-xs font-medium text-brand hover:underline">
                                                        +{typeInsights.length - 2} more →
                                                    </button>
                                                )}
                                            </div>
                                            {meta?.action && (
                                                <div className="flex items-center gap-1 border-t border-edge-subtle pt-1 text-xs font-medium text-brand">
                                                    <ArrowRight className="h-3 w-3 shrink-0" />
                                                    {meta.action}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {activeView === "list" && (
                        <Card>
                            <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-2 pt-4">
                                <CardTitle className="text-sm font-semibold text-foreground">
                                    {insights.length} insight{insights.length !== 1 ? "s" : ""}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-[var(--border-subtle)]">
                                    {insights.map(insight => {
                                        const meta = INSIGHT_META[insight.insightType];
                                        return (
                                            <div key={insight.id} className={cn("p-4 transition-colors hover:bg-surface-muted/50", insight.resolved && "opacity-55")}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", SEVERITY_STYLES[insight.severity])}>
                                                                {insight.severity}
                                                            </span>
                                                            <span className={cn("rounded px-2 py-0.5 text-xs font-medium", meta?.color ?? "bg-surface-muted text-muted-fg")}>
                                                                {meta?.label}
                                                            </span>
                                                            {insight.resolved && (
                                                                <span className="flex items-center gap-1 text-xs font-medium text-ok">
                                                                    <CheckCircle2 className="h-3 w-3" /> Resolved
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="font-semibold text-foreground">{insight.title}</p>
                                                        <p className="text-sm text-muted-fg">{insight.description}</p>
                                                        <div className="flex flex-wrap gap-3 pt-1 text-xs text-faint-fg">
                                                            <span>Asset: <span className="font-medium text-muted-fg">{insight.assetName || insight.assetId}</span></span>
                                                            {insight.assetTag && <span>Tag: <span className="data-mono">{insight.assetTag}</span></span>}
                                                            <span>Confidence: <span className="font-medium text-muted-fg">{Math.round((insight.confidence ?? 0) * 100)}%</span></span>
                                                            {insight.predictedDate && (
                                                                <span>Predicted: <span className="font-medium text-muted-fg">{formatDate(insight.predictedDate)}</span></span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!insight.resolved && (
                                                        <Button variant="outline" size="sm" onClick={() => handleResolve(insight.id)}
                                                            isLoading={resolvingId === insight.id}
                                                            className="h-8 shrink-0 border-ok/30 px-3 text-xs text-ok hover:bg-ok-soft">
                                                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Resolve
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            <div className="flex items-center justify-center">
                <Link href="/assets" className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                    <Activity className="h-4 w-4" /> View all assets to take action
                    <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </div>
            {ConfirmDialog}
        </div>
    );
}
