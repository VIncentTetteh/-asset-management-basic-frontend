"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLicenseStatus } from "@/contexts/LicenseContext";
import { Shield, Key, RefreshCw, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
            await api.post("/license/activate", { key: newKey.trim() });
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
        valid:        "text-ok bg-ok-soft border-ok/40",
        grace_period: "text-warn bg-warn-soft border-warn/40",
        expired:      "text-danger bg-danger-soft border-danger/40",
        revoked:      "text-danger bg-danger-soft border-danger/40",
        error:        "text-muted-fg bg-surface-muted border-edge-subtle",
    }[status.status ?? "error"] ?? "text-muted-fg bg-surface-muted border-edge-subtle";

    const StatusIcon = {
        valid:        CheckCircle,
        grace_period: Clock,
        expired:      AlertTriangle,
        revoked:      AlertTriangle,
        error:        AlertTriangle,
    }[status.status ?? "error"] ?? AlertTriangle;

    return (
        <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-brand" />
                    <PageHeader title="License Management" subtitle="Manage your AssetIQ standalone license key" />
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <div className={`flex items-start gap-4 rounded-panel border px-6 py-5 ${statusColor}`}>
                <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold capitalize">{(status.status ?? "unknown").replace("_", " ")}</span>
                        {status.plan && (
                            <span className="rounded-full border border-current/20 bg-surface/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                                {status.plan}
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm opacity-80">
                        {status.message ||
                            (status.status === "valid"
                                ? `License valid — ${status.daysRemaining} day${status.daysRemaining === 1 ? "" : "s"} remaining`
                                : "")}
                    </p>
                    {status.expiresAt && (
                        <p className="mt-1 text-xs opacity-60">
                            Expires:{" "}
                            {new Date(status.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
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

            {status.limits && Object.keys(status.limits).length > 0 && (
                <div>
                    <h2 className="mb-3 text-sm font-semibold text-foreground">Plan Limits</h2>
                    <div className="grid grid-cols-3 gap-4">
                        {Object.entries(status.limits).map(([key, val]) => (
                            <div key={key} className="rounded-card border border-edge-subtle bg-surface px-4 py-3">
                                <p className="text-xs capitalize text-faint-fg">{key}</p>
                                <p className="data-mono mt-1 text-2xl font-bold text-foreground">
                                    {val === -1 ? "∞" : val?.toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {status.features && Object.keys(status.features).length > 0 && (
                <div>
                    <h2 className="mb-3 text-sm font-semibold text-foreground">Plan Features</h2>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(status.features).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2 text-sm">
                                <CheckCircle className={`h-4 w-4 ${val ? "text-ok" : "text-faint-fg"}`} />
                                <span className={val ? "capitalize text-muted-fg" : "capitalize text-faint-fg line-through"}>
                                    {key.replace(/([A-Z])/g, " $1").trim()}
                                    {typeof val === "string" ? `: ${val}` : ""}
                                    {typeof val === "number" && val > 0 ? `: ${val} days` : ""}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h2 className="mb-1 text-sm font-semibold text-foreground">Activate New Key</h2>
                <p className="mb-3 text-xs text-muted-fg">
                    After renewing at{" "}
                    <a href="https://portal.assetiq.io" target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">
                        portal.assetiq.io
                    </a>
                    , paste your new license key below.
                </p>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint-fg" />
                        <input
                            type="text"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            placeholder="ASIQ-XXXX-XXXX-XXXX-XXXX-XXXX"
                            className="ea-focus data-mono w-full rounded-control border border-edge bg-surface py-2.5 pl-9 pr-4 text-sm text-foreground"
                        />
                    </div>
                    <Button onClick={handleActivate} disabled={activating || !newKey.trim()} isLoading={activating}>
                        Activate
                    </Button>
                </div>
            </div>

            {status.lastRemoteValidationAt && (
                <p className="text-xs text-faint-fg">
                    Last verified with license server: {new Date(status.lastRemoteValidationAt).toLocaleString()}
                </p>
            )}
        </div>
    );
}
