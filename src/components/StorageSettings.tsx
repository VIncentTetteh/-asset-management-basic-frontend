"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { getApiFieldErrors, reportApiError } from "@/lib/api-validation";
import { extractErrorMessage } from "@/lib/error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
    MAX_PRESIGN_MINUTES,
    buildStoragePayload,
    bucketNameError,
    presignMinutesError,
    storageConfigService,
    storageFormFromResponse,
    OrgStorageConfig,
} from "@/services/storageConfigService";
import { FIELD_LIMITS, limitInputProps } from "@/lib/field-limits";
import { FieldError } from "@/components/ui/field-error";
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
    const [loadError, setLoadError] = useState<string | null>(null);
    const [defaultBucket, setDefaultBucket] = useState<string | null>(null);
    const [effectiveBucket, setEffectiveBucket] = useState<string | null>(null);
    /** Server field errors from the last save, cleared as the field is edited. */
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const ttlError = presignMinutesError(config.presignMinutes);
    const bucketError = bucketNameError(config.bucketName) ?? serverErrors.bucketName ?? null;
    const fieldError = (field: keyof OrgStorageConfig) => (serverErrors[field] ? { message: serverErrors[field] } : null);

    useEffect(() => {
        if (!orgId) {
            setLoading(false);
            return;
        }
        storageConfigService
            .get(orgId)
            // The service maps 404 (no config yet) to null, so defaults stand;
            // anything else (403, 500) must not masquerade as "defaults".
            .then((c) => {
                if (!c) return;
                setConfig(storageFormFromResponse(c));
                setDefaultBucket(c.defaultBucket ?? null);
                setEffectiveBucket(c.bucketName ?? null);
            })
            .catch((err) => setLoadError(extractErrorMessage(err, "Could not load the storage settings")))
            .finally(() => setLoading(false));
    }, [orgId]);

    const handleSave = async () => {
        if (config.s3Enabled && (ttlError || bucketNameError(config.bucketName))) {
            toast.error(ttlError ?? bucketNameError(config.bucketName));
            return;
        }
        setServerErrors({});
        setSaving(true);
        try {
            const saved = await storageConfigService.save(orgId, buildStoragePayload(config));
            setConfig(storageFormFromResponse(saved));
            setDefaultBucket(saved.defaultBucket ?? null);
            setEffectiveBucket(saved.bucketName ?? null);
            toast.success("Storage settings saved");
        } catch (err) {
            setServerErrors(getApiFieldErrors(err));
            reportApiError(err, { fallback: "Failed to save storage settings" });
        } finally {
            setSaving(false);
        }
    };

    const set = <K extends keyof OrgStorageConfig>(key: K, value: OrgStorageConfig[K]) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
        setServerErrors((prev) => {
            if (!(key in prev)) return prev;
            const rest = { ...prev };
            delete rest[key];
            return rest;
        });
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center gap-2 py-8 text-faint-fg">
                    <Spinner size="sm" />
                    <span className="text-sm">Loading storage settings…</span>
                </CardContent>
            </Card>
        );
    }

    if (loadError) {
        return (
            <Card>
                <CardContent className="py-6 text-sm text-danger">
                    {loadError}. Storage settings need an organisation admin role.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="border-b border-edge-subtle pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <HardDrive className="h-4 w-4 text-faint-fg" />
                    Storage Settings
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
                <div
                    className={`flex items-start gap-3 rounded-card border px-4 py-3 text-sm ${
                        config.s3Enabled ? "border-ok/40 bg-ok-soft text-foreground" : "border-edge-subtle bg-surface-muted text-muted-fg"
                    }`}
                >
                    <Database className={`mt-0.5 h-4 w-4 shrink-0 ${config.s3Enabled ? "text-ok" : "text-faint-fg"}`} />
                    <div>
                        {config.s3Enabled ? (
                            <>
                                <span className="font-semibold">S3 Storage: Enabled</span>
                                {effectiveBucket && <span className="data-mono ml-1 text-xs">(bucket: {effectiveBucket})</span>}
                            </>
                        ) : (
                            <span className="font-semibold">
                                S3 Storage: Disabled <span className="font-normal">(using in-memory / local storage)</span>
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="s3Enabled"
                        checked={config.s3Enabled}
                        onChange={(e) => set("s3Enabled", e.target.checked)}
                        className="ea-focus h-4 w-4 rounded border-edge accent-[var(--primary)]"
                    />
                    <Label htmlFor="s3Enabled" className="cursor-pointer select-none">
                        Enable S3 storage for this organisation
                    </Label>
                </div>

                {config.s3Enabled && (
                    <div className="space-y-4 rounded-panel border border-edge-subtle bg-surface-muted p-4">
                        <div className="space-y-2">
                            <Label htmlFor="bucketName">S3 bucket override</Label>
                            <Input
                                id="bucketName"
                                placeholder={defaultBucket ? `Default: ${defaultBucket}` : "my-org-assets-bucket"}
                                {...limitInputProps(FIELD_LIMITS.storageConfig.bucketName)}
                                value={config.bucketName ?? ""}
                                onChange={(e) => set("bucketName", e.target.value)}
                                aria-invalid={bucketError ? true : undefined}
                                aria-describedby={bucketError ? "bucketName-error" : undefined}
                            />
                            {bucketError ? (
                                <FieldError id="bucketName-error" error={{ message: bucketError }} />
                            ) : (
                                <p className="text-xs text-faint-fg">Leave blank to use the default bucket.</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="reportPrefix">Report Prefix</Label>
                                <Input
                                    id="reportPrefix"
                                    placeholder="reports"
                                    {...limitInputProps(FIELD_LIMITS.storageConfig.reportPrefix)}
                                    value={config.reportPrefix}
                                    onChange={(e) => set("reportPrefix", e.target.value)}
                                />
                                <FieldError error={fieldError("reportPrefix")} />
                                <p className="text-xs text-faint-fg">S3 key prefix for generated reports</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="importPrefix">Import Prefix</Label>
                                <Input
                                    id="importPrefix"
                                    placeholder="imports"
                                    {...limitInputProps(FIELD_LIMITS.storageConfig.importPrefix)}
                                    value={config.importPrefix}
                                    onChange={(e) => set("importPrefix", e.target.value)}
                                />
                                <FieldError error={fieldError("importPrefix")} />
                                <p className="text-xs text-faint-fg">S3 key prefix for import files</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="presignMinutes">Presigned URL TTL (minutes)</Label>
                            <Input
                                id="presignMinutes"
                                type="number"
                                min={1}
                                max={MAX_PRESIGN_MINUTES}
                                step={1}
                                placeholder="15"
                                value={config.presignMinutes}
                                onChange={(e) => set("presignMinutes", Number(e.target.value))}
                                className="w-40"
                                aria-invalid={ttlError ? true : undefined}
                            />
                            {ttlError || serverErrors.presignMinutes ? (
                                <FieldError error={{ message: ttlError ?? serverErrors.presignMinutes }} />
                            ) : (
                                <p className="text-xs text-faint-fg">How long a presigned download URL remains valid (1–{MAX_PRESIGN_MINUTES} min)</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-2 rounded-card border border-info/40 bg-info-soft px-4 py-3 text-xs text-info">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                        Global S3 must be enabled on the server (<code className="data-mono">APP_STORAGE_S3_ENABLED=true</code>) for
                        S3 storage to work, regardless of this setting.
                    </span>
                </div>

                <div className="flex justify-end border-t border-edge-subtle pt-4">
                    <Button onClick={handleSave} isLoading={saving} disabled={saving || !orgId}>
                        Save Storage Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default StorageSettings;
