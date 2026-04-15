"use client";

/**
 * License Management Page — standalone mode only
 * Route: /settings/license
 *
 * Shows: current plan, expiry, usage vs limits, and key re-entry field.
 * In cloud mode this page redirects to /settings (not applicable).
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLicenseStatus } from "@/contexts/LicenseContext";
import { Shield, Key, RefreshCw, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/axios";
import toast from "react-hot-toast";

export default function LicensePage() {
    const router            = useRouter();
    const { status, refresh } = useLicenseStatus();
    const [newKey, setNewKey]     = useState("");
    const [activating, setActivating] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Redirect cloud mode users — this page is standalone-only
    useEffect(() => {
        if (status.mode === "cloud") router.replace("/settings");
    }, [status.mode, router]);

    if (status.mode === "cloud") return null;

    const handleActivate = async () => {
        if (!newKey.trim()) return;
        setActivating(true);
        try {
            await api.post("/api/v1/license/activate", { key: newKey.trim() });
            await refresh();
            setNewKey("");
            toast.success("License key activated successfully.");
        } catch (err: unknown) {
            const message =
                typeof err === "object" &&
                err !== null &&
                "response" in err &&
                typeof (err as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
                    ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
                    : undefined;
            toast.error(message ?? "Failed to activate license key.");
        } finally {
            setActivating(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
        toast.success("License status refreshed.");
    };

    const statusColor = {
        valid:        "text-emerald-600 bg-emerald-50 border-emerald-200",
        grace_period: "text-amber-600  bg-amber-50  border-amber-200",
        expired:      "text-red-600    bg-red-50    border-red-200",
        revoked:      "text-red-600    bg-red-50    border-red-200",
        error:        "text-gray-600   bg-gray-50   border-gray-200",
    }[status.status ?? "error"] ?? "text-gray-600 bg-gray-50 border-gray-200";

    const StatusIcon = {
        valid:        CheckCircle,
        grace_period: Clock,
        expired:      AlertTriangle,
        revoked:      AlertTriangle,
        error:        AlertTriangle,
    }[status.status ?? "error"] ?? AlertTriangle;

    return (
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-teal-600" />
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">License Management</h1>
                        <p className="text-sm text-slate-500">Manage your AssetIQ standalone license key</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Status card */}
            <div className={`rounded-xl border px-6 py-5 flex items-start gap-4 ${statusColor}`}>
                <StatusIcon className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold capitalize">
                            {(status.status ?? "unknown").replace("_", " ")}
                        </span>
                        {status.plan && (
                            <span className="text-xs font-bold uppercase tracking-wide bg-white/60 border border-current/20 rounded-full px-2 py-0.5">
                                {status.plan}
                            </span>
                        )}
                    </div>
                    <p className="text-sm mt-1 opacity-80">
                        {status.message || (status.status === "valid"
                            ? `License valid — ${status.daysRemaining} day${status.daysRemaining === 1 ? "" : "s"} remaining`
                            : "")}
                    </p>
                    {status.expiresAt && (
                        <p className="text-xs mt-1 opacity-60">
                            Expires: {new Date(status.expiresAt).toLocaleDateString("en-GB", {
                                day: "numeric", month: "long", year: "numeric"
                            })}
                        </p>
                    )}
                </div>
                {status.daysRemaining !== undefined && status.daysRemaining <= 30 && status.daysRemaining > 0 && (
                    <a
                        href="https://portal.assetiq.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline"
                    >
                        Renew →
                    </a>
                )}
            </div>

            {/* Plan limits */}
            {status.limits && Object.keys(status.limits).length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">Plan Limits</h2>
                    <div className="grid grid-cols-3 gap-4">
                        {Object.entries(status.limits).map(([key, val]) => (
                            <div key={key} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                                <p className="text-xs text-slate-500 capitalize">{key}</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">
                                    {val === -1 ? "∞" : val?.toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Features */}
            {status.features && Object.keys(status.features).length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">Plan Features</h2>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(status.features).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2 text-sm">
                                <CheckCircle className={`h-4 w-4 ${val ? "text-emerald-500" : "text-slate-300"}`} />
                                <span className={`capitalize ${val ? "text-slate-700" : "text-slate-400 line-through"}`}>
                                    {key.replace(/([A-Z])/g, " $1").trim()}
                                    {typeof val === "string" ? `: ${val}` : ""}
                                    {typeof val === "number" && val > 0 ? `: ${val} days` : ""}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Key re-entry */}
            <div>
                <h2 className="text-sm font-semibold text-slate-700 mb-1">Activate New Key</h2>
                <p className="text-xs text-slate-500 mb-3">
                    After renewing at{" "}
                    <a href="https://portal.assetiq.io" target="_blank" rel="noopener noreferrer"
                       className="text-teal-600 underline underline-offset-2">
                        portal.assetiq.io
                    </a>
                    , paste your new license key below.
                </p>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            placeholder="ASIQ-XXXX-XXXX-XXXX-XXXX-XXXX"
                            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg
                                       font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <Button
                        onClick={handleActivate}
                        disabled={activating || !newKey.trim()}
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                        {activating ? "Activating…" : "Activate"}
                    </Button>
                </div>
            </div>

            {/* Last validation info */}
            {status.lastRemoteValidationAt && (
                <p className="text-xs text-slate-400">
                    Last verified with license server:{" "}
                    {new Date(status.lastRemoteValidationAt).toLocaleString()}
                </p>
            )}
        </div>
    );
}
