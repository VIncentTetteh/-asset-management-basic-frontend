"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { storageConfigService, OrgStorageConfig } from "@/services/storageConfigService";
import { Database, HardDrive, Info } from "lucide-react";

interface StorageSettingsProps {
    orgId: string;
}

const DEFAULT_CONFIG: OrgStorageConfig = {
    s3Enabled:      false,
    bucketName:     "",
    reportPrefix:   "reports",
    importPrefix:   "imports",
    presignMinutes: 15,
};

export function StorageSettings({ orgId }: StorageSettingsProps) {
    const [config, setConfig]   = useState<OrgStorageConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);

    useEffect(() => {
        if (!orgId) {
            setLoading(false);
            return;
        }
        storageConfigService
            .get(orgId)
            .then((c) => { if (c) setConfig(c); })
            .catch(() => { /* 404 means no config yet — defaults stand */ })
            .finally(() => setLoading(false));
    }, [orgId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const saved = await storageConfigService.save(orgId, config);
            setConfig(saved);
            toast.success("Storage settings saved");
        } catch {
            toast.error("Failed to save storage settings");
        } finally {
            setSaving(false);
        }
    };

    const set = <K extends keyof OrgStorageConfig>(key: K, value: OrgStorageConfig[K]) =>
        setConfig((prev) => ({ ...prev, [key]: value }));

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8 gap-2 text-slate-400">
                    <Spinner size="sm" />
                    <span className="text-sm">Loading storage settings…</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-slate-500" />
                    Storage Settings
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
                {/* Status banner */}
                <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 text-sm ${
                    config.s3Enabled
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                }`}>
                    <Database className={`mt-0.5 h-4 w-4 shrink-0 ${config.s3Enabled ? "text-emerald-600" : "text-slate-400"}`} />
                    <div>
                        {config.s3Enabled
                            ? <>
                                <span className="font-semibold">S3 Storage: Enabled</span>
                                {config.bucketName && (
                                    <span className="ml-1 font-mono text-xs">(bucket: {config.bucketName})</span>
                                )}
                              </>
                            : <span className="font-semibold">S3 Storage: Disabled <span className="font-normal">(using in-memory / local storage)</span></span>
                        }
                    </div>
                </div>

                {/* S3 toggle */}
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="s3Enabled"
                        checked={config.s3Enabled}
                        onChange={(e) => set("s3Enabled", e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <Label htmlFor="s3Enabled" className="cursor-pointer select-none">
                        Enable S3 storage for this organisation
                    </Label>
                </div>

                {/* S3-specific fields — only visible when S3 is enabled */}
                {config.s3Enabled && (
                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="space-y-2">
                            <Label htmlFor="bucketName">S3 Bucket Name</Label>
                            <Input
                                id="bucketName"
                                placeholder="my-org-assets-bucket"
                                value={config.bucketName ?? ""}
                                onChange={(e) => set("bucketName", e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="reportPrefix">Report Prefix</Label>
                                <Input
                                    id="reportPrefix"
                                    placeholder="reports"
                                    value={config.reportPrefix}
                                    onChange={(e) => set("reportPrefix", e.target.value)}
                                />
                                <p className="text-xs text-slate-400">
                                    S3 key prefix for generated reports
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="importPrefix">Import Prefix</Label>
                                <Input
                                    id="importPrefix"
                                    placeholder="imports"
                                    value={config.importPrefix}
                                    onChange={(e) => set("importPrefix", e.target.value)}
                                />
                                <p className="text-xs text-slate-400">
                                    S3 key prefix for import files
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="presignMinutes">Presigned URL TTL (minutes)</Label>
                            <Input
                                id="presignMinutes"
                                type="number"
                                min={1}
                                max={720}
                                placeholder="15"
                                value={config.presignMinutes}
                                onChange={(e) => set("presignMinutes", Number(e.target.value))}
                                className="w-40"
                            />
                            <p className="text-xs text-slate-400">
                                How long a presigned download URL remains valid (1–720 min)
                            </p>
                        </div>
                    </div>
                )}

                {/* Server-level note */}
                <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                        Global S3 must be enabled on the server (
                        <code className="font-mono">APP_STORAGE_S3_ENABLED=true</code>
                        ) for S3 storage to work, regardless of this setting.
                    </span>
                </div>

                {/* Save button */}
                <div className="flex justify-end border-t border-slate-100 pt-4">
                    <Button
                        onClick={handleSave}
                        isLoading={saving}
                        disabled={saving || !orgId}
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                        Save Storage Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default StorageSettings;
