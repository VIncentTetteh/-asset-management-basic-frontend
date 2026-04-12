"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PredictiveInsight, InsightSummary, InsightType, InsightSeverity } from "@/types";
import { aiInsightsService } from "@/services/aiInsightsService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import {
    Brain, RefreshCw, CheckCircle2, AlertTriangle, Calendar, Clock,
    TrendingUp, Wrench, ShieldAlert, Zap, BarChart3, ChevronRight,
    Activity, Package, FileWarning, Cpu, ArrowRight,
} from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";


// ── Meta ──────────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
    CRITICAL: "bg-red-100 text-red-700 border-red-200",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
    LOW: "bg-slate-100 text-slate-500 border-slate-200",
};

const SEVERITY_DOT: Record<InsightSeverity, string> = {
    CRITICAL: "bg-red-500",
    HIGH: "bg-orange-500",
    MEDIUM: "bg-amber-400",
    LOW: "bg-slate-300",
};

const SEVERITY_BAR: Record<InsightSeverity, string> = {
    CRITICAL: "bg-red-500",
    HIGH: "bg-orange-400",
    MEDIUM: "bg-amber-400",
    LOW: "bg-slate-300",
};

const INSIGHT_META: Record<InsightType, { label: string; color: string; icon: React.ReactNode; action: string }> = {
    MAINTENANCE_DUE: { label: "Maintenance Due", color: "bg-blue-100 text-blue-700", icon: <Wrench className="h-4 w-4" />, action: "Schedule maintenance" },
    FAILURE_RISK: { label: "Failure Risk", color: "bg-red-100 text-red-700", icon: <ShieldAlert className="h-4 w-4" />, action: "Inspect asset immediately" },
    WARRANTY_EXPIRY: { label: "Warranty Expiry", color: "bg-purple-100 text-purple-700", icon: <FileWarning className="h-4 w-4" />, action: "Review warranty renewal" },
    DEPRECIATION_COMPLETE: { label: "Fully Depreciated", color: "bg-amber-100 text-amber-700", icon: <TrendingUp className="h-4 w-4" />, action: "Plan replacement or disposal" },
    ASSET_AGING: { label: "Asset Aging", color: "bg-slate-100 text-slate-600", icon: <Clock className="h-4 w-4" />, action: "Assess replacement timeline" },
    ANOMALY: { label: "Anomaly Detected", color: "bg-pink-100 text-pink-700", icon: <Zap className="h-4 w-4" />, action: "Investigate immediately" },
    UNDERUTILIZED: { label: "Underutilized", color: "bg-emerald-100 text-emerald-700", icon: <Activity className="h-4 w-4" />, action: "Reallocate or retire" },
    LICENSE_EXPIRY: { label: "License Expiry", color: "bg-indigo-100 text-indigo-700", icon: <Package className="h-4 w-4" />, action: "Renew license" },
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
    score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600";

const healthBg = (score: number) =>
    score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";

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
            toast.success(res.message || "AI has re-analysed your asset portfolio");
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

            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Predictive Insights</h1>
                    <p className="text-slate-500">AI-powered predictions for asset maintenance, failure risk, and lifecycle events.</p>
                </div>
                <Button onClick={handleGenerate} isLoading={isGenerating} className="bg-purple-600 hover:bg-purple-700 gap-2">
                    <Brain className="h-4 w-4" /> {isGenerating ? "Analysing…" : "Re-Analyse Portfolio"}
                </Button>
            </div>

            {/* Health Score + Summary Cards */}
            <div className="grid gap-4 md:grid-cols-6">

                {/* Health Score */}
                <Card className="md:col-span-2 border-slate-200">
                    <CardContent className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Portfolio Health Score</p>
                        <div className="flex items-end gap-3">
                            <span className={`text-5xl font-black leading-none ${healthColor(healthScore)}`}>{healthScore}</span>
                            <span className="text-lg text-slate-400 mb-1">/100</span>
                        </div>
                        <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                            <div className={`h-2 rounded-full transition-all ${healthBg(healthScore)}`} style={{ width: `${healthScore}%` }} />
                        </div>
                        <p className={`mt-2 text-sm font-semibold ${healthColor(healthScore)}`}>{healthLabel(healthScore)}</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Based on {unresolvedCount} unresolved insight{unresolvedCount !== 1 ? "s" : ""} · weighted by severity and confidence
                        </p>
                    </CardContent>
                </Card>

                {/* Severity breakdown */}
                {SEVERITY_ORDER.map(sev => (
                    <Card key={sev} className="border-slate-200 cursor-pointer hover:shadow-sm transition-shadow"
                        onClick={() => setFilterSeverity(filterSeverity === sev ? "" : sev)}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[sev]}`} />
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[sev]}`}>
                                    {sev.toLowerCase()}
                                </span>
                            </div>
                            <p className="text-3xl font-black text-slate-900">{summary?.bySeverity?.[sev] ?? 0}</p>
                            <p className="text-xs text-slate-400 mt-1">unresolved</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Overdue / Coming Up alerts */}
            {(overdue.length > 0 || upcoming30.length > 0) && (
                <div className="grid gap-4 md:grid-cols-2">

                    {overdue.length > 0 && (
                        <Card className="border-red-200 bg-red-50/40">
                            <CardHeader className="pb-2 pt-4 px-4">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-red-700">
                                    <AlertTriangle className="h-4 w-4" /> {overdue.length} Overdue Prediction{overdue.length !== 1 ? "s" : ""}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 space-y-2">
                                {overdue.slice(0, 4).map(insight => (
                                    <div key={insight.id} className="flex items-center justify-between gap-3 rounded-lg bg-white border border-red-100 p-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{insight.assetName || insight.assetId}</p>
                                            <p className="text-xs text-red-600 font-medium">
                                                {INSIGHT_META[insight.insightType]?.label} · {Math.abs(daysBetween(insight.predictedDate!))}d overdue
                                            </p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => handleResolve(insight.id)}
                                            isLoading={resolvingId === insight.id}
                                            className="shrink-0 h-7 px-2 text-xs border-red-200 text-red-700 hover:bg-red-50">
                                            Resolve
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {upcoming30.length > 0 && (
                        <Card className="border-amber-200 bg-amber-50/40">
                            <CardHeader className="pb-2 pt-4 px-4">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                                    <Calendar className="h-4 w-4" /> {upcoming30.length} Event{upcoming30.length !== 1 ? "s" : ""} in Next 30 Days
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 space-y-2">
                                {upcoming30.slice(0, 4).map(insight => (
                                    <div key={insight.id} className="flex items-center justify-between gap-3 rounded-lg bg-white border border-amber-100 p-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{insight.assetName || insight.assetId}</p>
                                            <p className="text-xs text-amber-700 font-medium">
                                                {INSIGHT_META[insight.insightType]?.label} · in {insight.daysAway}d ({formatDate(insight.predictedDate!)})
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[insight.severity]}`}>
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

            {/* View Toggle */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                    {(["priority", "timeline", "byType", "list"] as const).map(v => (
                        <button key={v} onClick={() => setActiveView(v)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeView === v ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                            {v === "priority" ? "Priority" : v === "timeline" ? "Timeline" : v === "byType" ? "By Type" : "All Insights"}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <Select value={filterType} onChange={e => setFilterType(e.target.value as InsightType | "")} className="w-48 text-sm">
                        <option value="">All Types</option>
                        {INSIGHT_TYPES.map(t => <option key={t} value={t}>{INSIGHT_META[t]?.label}</option>)}
                    </Select>
                    <Select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as InsightSeverity | "")} className="w-36 text-sm">
                        <option value="">All Severities</option>
                        {SEVERITY_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                        <input type="checkbox" checked={unresolvedOnly} onChange={e => setUnresolvedOnly(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-purple-600" />
                        Unresolved only
                    </label>
                </div>
            </div>

            {/* Main content area */}
            {isLoading ? (
                <Card className="border-slate-200">
                    <CardContent className="h-64 flex items-center justify-center">
                        <PageSpinner />
                    </CardContent>
                </Card>
            ) : insights.length === 0 ? (
                <Card className="border-slate-200">
                    <CardContent className="flex flex-col items-center justify-center p-16 text-center">
                        <Brain className="h-14 w-14 text-slate-200 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-800">No insights found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">
                            {unresolvedOnly ? "All insights are resolved — your portfolio is in good shape." : 'Click "Re-Analyse Portfolio" to generate AI predictions for your assets.'}
                        </p>
                        <Button onClick={handleGenerate} isLoading={isGenerating} className="mt-4 bg-purple-600 hover:bg-purple-700 gap-2">
                            <Brain className="h-4 w-4" /> Analyse Now
                        </Button>
                    </CardContent>
                </Card>
            ) : (

                <>
                    {/* PRIORITY VIEW */}
                    {activeView === "priority" && (
                        <div className="space-y-3">
                            {prioritized.slice(0, 20).map((insight, idx) => {
                                const meta = INSIGHT_META[insight.insightType];
                                const daysAway = insight.predictedDate ? daysBetween(insight.predictedDate) : null;
                                return (
                                    <Card key={insight.id} className="border-slate-200 hover:shadow-sm transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-4">
                                                {/* Priority rank */}
                                                <div className="shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                                    {idx + 1}
                                                </div>

                                                {/* Type icon */}
                                                <div className={`shrink-0 p-2 rounded-lg ${meta?.color ?? "bg-slate-100 text-slate-600"}`}>
                                                    {meta?.icon ?? <Cpu className="h-4 w-4" />}
                                                </div>

                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${SEVERITY_STYLES[insight.severity]}`}>
                                                            {insight.severity}
                                                        </span>
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${meta?.color ?? "bg-slate-100 text-slate-600"}`}>
                                                            {meta?.label}
                                                        </span>
                                                        {insight.resolved && (
                                                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                                <CheckCircle2 className="h-3 w-3" /> Resolved
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="font-semibold text-slate-900">{insight.title}</p>
                                                    <p className="text-sm text-slate-600">{insight.description}</p>

                                                    <div className="flex flex-wrap gap-4 pt-1">
                                                        <span className="text-xs text-slate-500">
                                                            Asset: <span className="font-medium text-slate-700">{insight.assetName || insight.assetId}</span>
                                                        </span>
                                                        {insight.assetTag && (
                                                            <span className="text-xs text-slate-500">
                                                                Tag: <span className="font-mono text-slate-500">{insight.assetTag}</span>
                                                            </span>
                                                        )}
                                                        {/* Confidence bar */}
                                                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                                                            <BarChart3 className="h-3 w-3" />
                                                            Confidence:
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="inline-block h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                                                                    <span className={`block h-full rounded-full ${SEVERITY_BAR[insight.severity]}`}
                                                                        style={{ width: `${(insight.confidence ?? 0) * 100}%` }} />
                                                                </span>
                                                                <span className="font-medium text-slate-700">{Math.round((insight.confidence ?? 0) * 100)}%</span>
                                                            </span>
                                                        </span>
                                                        {daysAway !== null && (
                                                            <span className={`text-xs font-medium ${daysAway < 0 ? "text-red-600" : daysAway <= 7 ? "text-orange-600" : "text-slate-500"}`}>
                                                                {daysAway < 0 ? `${Math.abs(daysAway)}d overdue` : daysAway === 0 ? "Today" : `In ${daysAway} days`}
                                                                {insight.predictedDate ? ` (${formatDate(insight.predictedDate)})` : ""}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Recommended action */}
                                                    {meta?.action && (
                                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-700 font-medium">
                                                            <ChevronRight className="h-3 w-3" />
                                                            Recommended: {meta.action}
                                                        </div>
                                                    )}
                                                </div>

                                                {!insight.resolved && (
                                                    <Button variant="outline" size="sm" onClick={() => handleResolve(insight.id)}
                                                        isLoading={resolvingId === insight.id}
                                                        className="shrink-0 h-8 px-3 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {/* TIMELINE VIEW */}
                    {activeView === "timeline" && (
                        <Card className="border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                    <Calendar className="h-4 w-4 text-purple-500" /> Predicted Event Timeline
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {insights.filter(i => i.predictedDate && !i.resolved).length === 0 ? (
                                    <p className="p-8 text-center text-sm text-slate-400">No predicted dates available for current insights.</p>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {[...insights]
                                            .filter(i => i.predictedDate && !i.resolved)
                                            .sort((a, b) => new Date(a.predictedDate!).getTime() - new Date(b.predictedDate!).getTime())
                                            .map(insight => {
                                                const meta = INSIGHT_META[insight.insightType];
                                                const daysAway = daysBetween(insight.predictedDate!);
                                                return (
                                                    <div key={insight.id} className="flex items-start gap-4 p-4 hover:bg-slate-50/50">
                                                        {/* Date column */}
                                                        <div className="shrink-0 w-24 text-right">
                                                            <p className={`text-sm font-bold ${daysAway < 0 ? "text-red-600" : daysAway <= 7 ? "text-orange-600" : "text-slate-700"}`}>
                                                                {formatDate(insight.predictedDate!)}
                                                            </p>
                                                            <p className={`text-xs mt-0.5 ${daysAway < 0 ? "text-red-500" : "text-slate-400"}`}>
                                                                {daysAway < 0 ? `${Math.abs(daysAway)}d overdue` : daysAway === 0 ? "Today" : `${daysAway}d`}
                                                            </p>
                                                        </div>

                                                        {/* Timeline dot */}
                                                        <div className="shrink-0 flex flex-col items-center pt-1.5">
                                                            <div className={`h-3 w-3 rounded-full border-2 border-white ring-2 ${daysAway < 0 ? "bg-red-500 ring-red-200" : "bg-purple-500 ring-purple-200"}`} />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0 space-y-1 pb-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${SEVERITY_STYLES[insight.severity]}`}>
                                                                    {insight.severity}
                                                                </span>
                                                                <span className={`px-2 py-0.5 text-xs rounded ${meta?.color}`}>{meta?.label}</span>
                                                            </div>
                                                            <p className="font-medium text-slate-900">{insight.title}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {insight.assetName || insight.assetId}
                                                                {insight.assetTag ? ` · ${insight.assetTag}` : ""}
                                                                {" · "}
                                                                <span className="font-medium">{Math.round((insight.confidence ?? 0) * 100)}% confidence</span>
                                                            </p>
                                                            {meta?.action && (
                                                                <p className="text-xs text-purple-600 font-medium">{meta.action}</p>
                                                            )}
                                                        </div>

                                                        <Button variant="outline" size="sm" onClick={() => handleResolve(insight.id)}
                                                            isLoading={resolvingId === insight.id}
                                                            className="shrink-0 h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                                            <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* BY TYPE VIEW */}
                    {activeView === "byType" && (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {byType.map(([type, typeInsights]) => {
                                const meta = INSIGHT_META[type];
                                const critical = typeInsights.filter(i => i.severity === "CRITICAL").length;
                                const high = typeInsights.filter(i => i.severity === "HIGH").length;
                                return (
                                    <Card key={type} className="border-slate-200 hover:shadow-sm transition-shadow">
                                        <CardHeader className="pb-2 pt-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${meta?.color ?? "bg-slate-100 text-slate-600"}`}>
                                                        {meta?.icon ?? <Cpu className="h-4 w-4" />}
                                                    </div>
                                                    <CardTitle className="text-sm font-semibold text-slate-800">{meta?.label}</CardTitle>
                                                </div>
                                                <span className="text-2xl font-black text-slate-900">{typeInsights.length}</span>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-2 pt-0">
                                            {/* Severity mini-bar */}
                                            <div className="flex gap-1 h-2">
                                                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as InsightSeverity[]).map(sev => {
                                                    const count = typeInsights.filter(i => i.severity === sev).length;
                                                    const pct = typeInsights.length ? (count / typeInsights.length) * 100 : 0;
                                                    return pct > 0 ? (
                                                        <div key={sev} className={`h-2 rounded-full ${SEVERITY_BAR[sev]}`} style={{ width: `${pct}%` }} title={`${sev}: ${count}`} />
                                                    ) : null;
                                                })}
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {critical > 0 && <span className="text-red-600 font-semibold">{critical} critical</span>}
                                                {critical > 0 && high > 0 && <span className="mx-1">·</span>}
                                                {high > 0 && <span className="text-orange-600 font-semibold">{high} high</span>}
                                                {critical === 0 && high === 0 && "No critical or high severity"}
                                            </p>
                                            {/* Top 2 assets */}
                                            <div className="space-y-1 pt-1 border-t border-slate-100">
                                                {typeInsights.slice(0, 2).map(i => (
                                                    <div key={i.id} className="flex items-center justify-between gap-2 text-xs">
                                                        <span className="truncate text-slate-600">{i.assetName || i.assetId}</span>
                                                        <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold ${SEVERITY_STYLES[i.severity]}`}>{i.severity[0]}</span>
                                                    </div>
                                                ))}
                                                {typeInsights.length > 2 && (
                                                    <button onClick={() => { setFilterType(type); setActiveView("list"); }}
                                                        className="text-xs text-purple-600 hover:underline font-medium">
                                                        +{typeInsights.length - 2} more →
                                                    </button>
                                                )}
                                            </div>
                                            {/* Recommended action */}
                                            {meta?.action && (
                                                <div className="flex items-center gap-1 text-xs text-purple-700 font-medium pt-1 border-t border-slate-100">
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

                    {/* ALL INSIGHTS LIST */}
                    {activeView === "list" && (
                        <Card className="border-slate-200">
                            <CardHeader className="pb-2 pt-4 border-b border-slate-100 bg-slate-50/50">
                                <CardTitle className="text-sm font-semibold text-slate-700">
                                    {insights.length} insight{insights.length !== 1 ? "s" : ""}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-50">
                                    {insights.map(insight => {
                                        const meta = INSIGHT_META[insight.insightType];
                                        return (
                                            <div key={insight.id} className={`p-4 hover:bg-slate-50/50 transition-colors ${insight.resolved ? "opacity-55" : ""}`}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${SEVERITY_STYLES[insight.severity]}`}>
                                                                {insight.severity}
                                                            </span>
                                                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${meta?.color ?? "bg-slate-100 text-slate-600"}`}>
                                                                {meta?.label}
                                                            </span>
                                                            {insight.resolved && (
                                                                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                                    <CheckCircle2 className="h-3 w-3" /> Resolved
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="font-semibold text-slate-900">{insight.title}</p>
                                                        <p className="text-sm text-slate-600">{insight.description}</p>
                                                        <div className="flex flex-wrap gap-3 text-xs text-slate-400 pt-1">
                                                            <span>Asset: <span className="font-medium text-slate-600">{insight.assetName || insight.assetId}</span></span>
                                                            {insight.assetTag && <span>Tag: <span className="font-mono">{insight.assetTag}</span></span>}
                                                            <span>Confidence: <span className="font-medium text-slate-600">{Math.round((insight.confidence ?? 0) * 100)}%</span></span>
                                                            {insight.predictedDate && (
                                                                <span>Predicted: <span className="font-medium text-slate-600">{formatDate(insight.predictedDate)}</span></span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!insight.resolved && (
                                                        <Button variant="outline" size="sm" onClick={() => handleResolve(insight.id)}
                                                            isLoading={resolvingId === insight.id}
                                                            className="shrink-0 h-8 px-3 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
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

            {/* Link to asset list for follow-up */}
            <div className="flex items-center justify-center">
                <Link href="/assets" className="flex items-center gap-1.5 text-sm text-purple-600 hover:underline font-medium">
                    <Activity className="h-4 w-4" /> View all assets to take action
                    <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </div>
        {ConfirmDialog}
        </div>
    );
}
