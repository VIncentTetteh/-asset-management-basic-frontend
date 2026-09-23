"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, ClipboardCopy, Download, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImportJobResponse } from "@/services/importJobService";
import type { ImportPreviewResult } from "@/services/importService";
import { importJobPhase, importJobStatusLabel } from "@/features/imports/importJob";
import { downloadTextFile, failedRowsCsv, failedRowsText, mergeFailedRows } from "@/features/imports/failedRows";
import { StepError, StepHeading } from "@/features/imports/WizardChrome";

/**
 * The commit step: the job is running on the server, so this reports the
 * server's own status and never claims a result it has not been given.
 *
 * QUEUED is a running state here. It was once treated as terminal, and every
 * import that sat in a queue for a second looked to the user like it had hung.
 */
export function ImportRunStep({
    job,
    jobError,
    plural,
    type,
    preview,
    onClose,
    onStartOver,
}: {
    job: ImportJobResponse | undefined;
    jobError: string | null;
    plural: string;
    type: string;
    preview: ImportPreviewResult | null;
    onClose: () => void;
    onStartOver: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const phase = importJobPhase(job?.status);
    const result = job?.result;
    const failed = mergeFailedRows(result?.errors, preview?.rows);

    const copyFailedRows = async () => {
        const text = failedRowsText(failed);
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("Failed rows copied");
        } catch {
            toast.error("Your browser blocked the copy. Use Download instead.");
        }
    };

    return (
        <div className="space-y-5">
            <StepHeading hint={jobError ? undefined : importJobStatusLabel(job?.status)}>
                {phase === "running" ? `Importing your ${plural}` : `Import ${phase}`}
            </StepHeading>

            {jobError ? (
                <StepError message={jobError} />
            ) : phase === "running" ? (
                <div
                    role="status"
                    aria-live="polite"
                    data-testid="import-running"
                    className="flex flex-col items-center justify-center rounded-panel border border-edge bg-surface-muted p-8"
                >
                    <Loader2 aria-hidden="true" className="mb-3 h-8 w-8 animate-spin text-brand" />
                    <p className="text-sm font-bold text-foreground" data-testid="import-job-status">
                        {importJobStatusLabel(job?.status)}
                    </p>
                    <p className="mt-1 text-center text-xs text-muted-fg">
                        You can leave this open — we check the server every few seconds.
                    </p>
                </div>
            ) : (
                <div className="space-y-3" data-testid="import-outcome" data-phase={phase}>
                    <p
                        role="status"
                        className={`flex items-start gap-2 rounded-card border p-3 text-sm text-foreground ${
                            phase === "completed" ? "border-ok/40 bg-ok-soft" : "border-danger/40 bg-danger-soft"
                        }`}
                    >
                        {phase === "completed" ? (
                            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                        ) : phase === "cancelled" ? (
                            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                        ) : (
                            <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                        )}
                        <span data-testid="import-summary">{summaryFor(phase, result?.imported ?? 0, plural)}</span>
                    </p>

                    {result ? (
                        <dl className="grid grid-cols-3 gap-3 text-center text-sm" data-testid="import-result-counts">
                            <Stat label="Rows" value={result.totalRows ?? 0} />
                            <Stat label="Imported" value={result.imported ?? 0} testId="import-result-imported" />
                            <Stat label="Skipped" value={result.skipped ?? 0} testId="import-result-skipped" />
                        </dl>
                    ) : null}

                    {failed.length > 0 ? (
                        <div className="space-y-2" data-testid="import-failed-rows">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-danger">
                                    {failed.length} {failed.length === 1 ? "row" : "rows"} were not imported
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void copyFailedRows()}
                                        data-testid="import-copy-failed"
                                    >
                                        <ClipboardCopy aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                        {copied ? "Copied" : "Copy"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => downloadTextFile(`${type}-import-failed-rows.csv`, failedRowsCsv(failed))}
                                        data-testid="import-download-failed"
                                    >
                                        <Download aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                        Download
                                    </Button>
                                </div>
                            </div>
                            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                                {failed.map((row, index) => (
                                    <li
                                        key={`${row.rowNumber}-${index}`}
                                        className="flex flex-wrap gap-x-2 rounded-control border border-edge-subtle bg-danger-soft px-2.5 py-1.5 text-xs"
                                    >
                                        <span className="data-mono shrink-0 font-bold text-danger">Row {row.rowNumber}</span>
                                        {row.column ? <span className="font-semibold text-foreground">{row.column}</span> : null}
                                        <span className="text-foreground">{row.message}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-edge-subtle pt-3">
                <Button type="button" variant="outline" onClick={onStartOver} disabled={phase === "running" && !jobError}>
                    Import another file
                </Button>
                <Button type="button" onClick={onClose}>
                    {phase === "running" && !jobError ? "Close and let it run" : "Done"}
                </Button>
            </div>
        </div>
    );
}

function summaryFor(phase: string, imported: number, plural: string): string {
    if (phase === "completed") return `The server imported ${imported} ${imported === 1 ? "row" : "rows"} of ${plural}.`;
    if (phase === "cancelled") return "The import was cancelled before it finished. Nothing further was written.";
    return "The import failed on the server. Any rows listed below were not saved.";
}

function Stat({ label, value, testId }: { label: string; value: number; testId?: string }) {
    return (
        <div className="rounded-card border border-edge-subtle bg-surface-muted py-2">
            <dt className="text-[11px] uppercase tracking-wide text-faint-fg">{label}</dt>
            <dd data-testid={testId} className="data-mono text-xl font-bold text-foreground">
                {value}
            </dd>
        </div>
    );
}
