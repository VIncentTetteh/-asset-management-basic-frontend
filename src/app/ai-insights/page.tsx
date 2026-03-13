"use client";

import { useState, useEffect } from "react";
import { PredictiveInsight, InsightSummary, InsightType, InsightSeverity } from "@/types";
import { aiInsightsService } from "@/services/aiInsightsService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Brain, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
    CRITICAL: "bg-red-100 text-red-700 border-red-200",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
    LOW: "bg-slate-100 text-slate-500 border-slate-200",
};

const INSIGHT_TYPE_STYLES: Record<InsightType, string> = {
    WARRANTY_EXPIRY: "bg-purple-100 text-purple-700",
    MAINTENANCE_DUE: "bg-blue-100 text-blue-700",
    FAILURE_RISK: "bg-red-100 text-red-700",
    ASSET_AGING: "bg-slate-100 text-slate-600",
    DEPRECIATION_COMPLETE: "bg-amber-100 text-amber-700",
    UNDERUTILIZED: "bg-emerald-100 text-emerald-700",
    ANOMALY: "bg-pink-100 text-pink-700",
    LICENSE_EXPIRY: "bg-indigo-100 text-indigo-700",
};

const SEVERITY_ICON_STYLES: Record<InsightSeverity, string> = {
    CRITICAL: "bg-red-100 text-red-700",
    HIGH: "bg-orange-100 text-orange-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-slate-100 text-slate-500",
};

const SEVERITY_ORDER: InsightSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const INSIGHT_TYPES: InsightType[] = ["MAINTENANCE_DUE", "FAILURE_RISK", "WARRANTY_EXPIRY", "DEPRECIATION_COMPLETE", "ASSET_AGING", "ANOMALY", "UNDERUTILIZED", "LICENSE_EXPIRY"];

export default function AiInsightsPage() {
    const [insights, setInsights] = useState<PredictiveInsight[]>([]);
    const [summary, setSummary] = useState<InsightSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [filterType, setFilterType] = useState<InsightType | "">("");
    const [filterSeverity, setFilterSeverity] = useState<InsightSeverity | "">("");
    const [unresolvedOnly, setUnresolvedOnly] = useState(true);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

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
            toast.success(res.message || "Insights generated");
            fetchAll();
        } catch {
            toast.error("Failed to generate insights");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleResolve = async (id: string) => {
        if (!confirm("Mark this insight as resolved?")) return;
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Predictive Insights</h1>
                    <p className="text-slate-500">AI-powered predictions for asset maintenance, risk, and lifecycle events.</p>
                </div>
                <Button onClick={handleGenerate} isLoading={isGenerating} className="bg-purple-600 hover:bg-purple-700">
                    <RefreshCw className="mr-2 h-4 w-4" /> Generate Insights
                </Button>
            </div>

            {summary && (
                <div className="grid gap-4 md:grid-cols-5">
                    <Card className="border-slate-200">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg"><Brain className="h-5 w-5 text-purple-600" /></div>
                            <div>
                                <p className="text-xs text-slate-500">Unresolved</p>
                                <p className="text-xl font-bold text-slate-900">{summary.totalUnresolved}</p>
                            </div>
                        </CardContent>
                    </Card>
                    {SEVERITY_ORDER.map(sev => (
                        <Card key={sev} className="border-slate-200">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${SEVERITY_ICON_STYLES[sev]}`}>
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 capitalize">{sev.toLowerCase()}</p>
                                    <p className="text-xl font-bold text-slate-900">{summary.bySeverity?.[sev] ?? 0}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap gap-3 items-center">
                <Select value={filterType} onChange={e => setFilterType(e.target.value as InsightType | "")} className="w-52">
                    <option value="">All Types</option>
                    {INSIGHT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </Select>
                <Select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as InsightSeverity | "")} className="w-40">
                    <option value="">All Severities</option>
                    {SEVERITY_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={unresolvedOnly}
                        onChange={e => setUnresolvedOnly(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-purple-600"
                    />
                    Unresolved only
                </label>
            </div>

            <Card className="border-slate-200">
                <CardHeader className="pb-0">
                    <CardTitle className="text-base font-semibold text-slate-700">
                        {insights.length} insight{insights.length !== 1 ? "s" : ""}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="h-40 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                        </div>
                    ) : insights.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <Brain className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No insights found</h3>
                            <p className="text-slate-500 mt-1">Click "Generate Insights" to analyse your asset portfolio.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {insights.map((insight) => (
                                <div key={insight.id} className={`p-4 hover:bg-slate-50/50 transition-colors ${insight.resolved ? "opacity-60" : ""}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${SEVERITY_STYLES[insight.severity]}`}>
                                                    {insight.severity}
                                                </span>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${INSIGHT_TYPE_STYLES[insight.insightType]}`}>
                                                    {insight.insightType.replace(/_/g, " ")}
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
                                                {insight.assetTag && <span>Tag: <span className="font-mono text-slate-500">{insight.assetTag}</span></span>}
                                                <span>Confidence: <span className="font-medium text-slate-600">{(insight.confidence * 100).toFixed(0)}%</span></span>
                                                {insight.predictedDate && <span>Predicted: <span className="font-medium text-slate-600">{new Date(insight.predictedDate).toLocaleDateString()}</span></span>}
                                            </div>
                                        </div>
                                        {!insight.resolved && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleResolve(insight.id)}
                                                isLoading={resolvingId === insight.id}
                                                className="shrink-0 h-8 px-3 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
