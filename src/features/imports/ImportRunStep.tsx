"use client";

import { useState } from "react";
import { ClipboardCopy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { notify } from "@/lib/notify";
import type { ImportJobResponse } from "@/services/importJobService";
import { importJobPhase, importJobStatusLabel } from "@/features/imports/importJob";
import { downloadTextFile, failedRows, failedRowsCsv, failedRowsText, rowLabel } from "@/features/imports/failedRows";
import {
    createdEntries,
    createdTypeLabel,
    importVerdict,
    outcomeTone,
    verdictSummary,
    verdictTitle,
} from "@/features/imports/outcome";
import { StepError, StepHeading } from "@/features/imports/WizardChrome";

/**
 * What the import actually did.
 *
 * This screen once put a green tick over "the server imported 0 rows of
 * assets", under the heading "Import completed", beside counts that said 1 row,
 * 0 imported, 1 skipped — while the list below it claimed two rows failed and
 * named a row 0 that does not exist in anybody's spreadsheet.
 *
 * All of that came from one habit: deciding what happened from the job status
 * and a couple of integers. The server now says `outcome`, holds
 * `totalRows === imported + updated + skipped` and `errors.length === failed`,
 * and never emits row 0. So this screen renders the verdict it was given, shows
 * every count it was given, and keeps whole-run facts — a fatal error, an early
 * stop — as their own lines rather than as rows in the failure list.
 */
export function ImportRunStep({
    job,
    jobError,
    plural,
    type,
    onClose,
    onStartOver,
}: {
    job: ImportJobResponse | undefined;
    jobError: string | null;
    plural: string;
    type: string;
    onClose: () => void;
    onStartOver: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const phase = importJobPhase(job?.status);
    const result = job?.result;
    const verdict = importVerdict(phase, result);
    const rows = failedRows(result?.errors);
    const notes = result?.notes ?? [];
    const references = createdEntries(result?.createdReferences);
    const customFields = result?.createdCustomFields ?? [];
    const dryRun = Boolean(result?.dryRun ?? job?.dryRun);

    const copyFailedRows = async () => {
        try {
            await navigator.clipboard.writeText(failedRowsText(rows));
            setCopied(true);
            notify.success("Failed rows copied");
        } catch {
            notify.error("Your browser blocked the copy. Use Download instead.");
        }
    };

    return (
        <div className="space-y-5">
            <StepHeading hint={jobError ? undefined : importJobStatusLabel(job?.status)}>
                {phase === "running" ? `Importing your ${plural}` : verdictTitle(verdict, dryRun)}
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
                <div className="space-y-3" data-testid="import-outcome" data-phase={phase} data-verdict={verdict}>
                    {/* The heading above already names the verdict; repeating it
                        here just pushed the numbers further down the phone screen. */}
                    <Alert
                        tone={outcomeTone(verdict)}
                        title={<span data-testid="import-summary">{verdictSummary(verdict, result, plural)}</span>}
                        data-testid="import-verdict"
                    />

                    {result?.fatalError ? (
                        <Alert tone="danger" live={false} title="The file could not be used" data-testid="import-fatal-error">
                            {result.fatalError}
                        </Alert>
                    ) : null}

                    {/* An early stop is a state, not a failed row. It used to be
                        rendered in the error list, inflating the failure count. */}
                    {result?.stoppedReason ? (
                        <p
                            role="status"
                            data-testid="import-stopped-reason"
                            className="rounded-card border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-foreground"
                        >
                            <span className="font-semibold">The import stopped early.</span> {result.stoppedReason}
                        </p>
                    ) : null}

                    {result ? (
                        <>
                            <dl className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4 sm:gap-3" data-testid="import-result-counts">
                                <Stat label="Rows" value={result.totalRows ?? 0} testId="import-result-total" />
                                <Stat label={dryRun ? "Would add" : "Added"} value={result.imported ?? 0} testId="import-result-imported" />
                                <Stat label={dryRun ? "Would update" : "Updated"} value={result.updated ?? 0} testId="import-result-updated" />
                                <Stat label="Skipped" value={result.skipped ?? 0} testId="import-result-skipped" />
                            </dl>
                            {(result.skipped ?? 0) > 0 ? (
                                <p className="text-xs text-muted-fg" data-testid="import-skipped-breakdown">
                                    Of the {result.skipped} skipped: {result.failed ?? 0} had problems and{" "}
                                    {result.duplicatesSkipped ?? 0} already existed.
                                </p>
                            ) : null}
                        </>
                    ) : null}

                    {references.length > 0 || customFields.length > 0 ? (
                        <section
                            aria-labelledby="import-created-heading"
                            className="space-y-1 rounded-card border border-edge bg-surface-muted p-3 text-xs"
                            data-testid="import-created"
                        >
                            <h5 id="import-created-heading" className="text-sm font-bold text-foreground">
                                {result?.wouldCreateReferences ? "What a real import would create" : "What we created for you"}
                            </h5>
                            <ul className="space-y-1 text-foreground">
                                {references.map((entry) => (
                                    <li key={entry.type}>
                                        <span className="font-semibold">
                                            {entry.names.length} {createdTypeLabel(entry.type, entry.names.length).toLowerCase()}:
                                        </span>{" "}
                                        {entry.names.join(", ")}
                                    </li>
                                ))}
                                {customFields.length > 0 ? (
                                    <li data-testid="import-created-custom-fields">
                                        <span className="font-semibold">
                                            {customFields.length} custom {customFields.length === 1 ? "field" : "fields"}:
                                        </span>{" "}
                                        {customFields.join(", ")}
                                    </li>
                                ) : null}
                            </ul>
                        </section>
                    ) : null}

                    {rows.length > 0 ? (
                        <section aria-labelledby="import-failed-heading" className="space-y-2" data-testid="import-failed-rows">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p id="import-failed-heading" className="text-xs font-semibold text-danger">
                                    {rows.length} {rows.length === 1 ? "row was" : "rows were"} not imported
                                    {result?.errorsTruncated ? " (the first of many — the rest are not listed)" : ""}
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
                                        onClick={() => downloadTextFile(`${type}-import-failed-rows.csv`, failedRowsCsv(rows))}
                                        data-testid="import-download-failed"
                                    >
                                        <Download aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                        Download
                                    </Button>
                                </div>
                            </div>
                            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                                {rows.map((row, index) => (
                                    <li
                                        key={`${row.rowNumber}-${index}`}
                                        className="flex flex-wrap gap-x-2 gap-y-0.5 rounded-control border border-edge-subtle bg-danger-soft px-2.5 py-1.5 text-xs"
                                    >
                                        {rowLabel(row.rowNumber) ? (
                                            <span className="data-mono shrink-0 font-bold text-danger">
                                                {rowLabel(row.rowNumber)}
                                            </span>
                                        ) : null}
                                        {row.column ? <span className="font-semibold text-foreground">{row.column}</span> : null}
                                        <span className="min-w-0 text-foreground">{row.message}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}

                    {notes.length > 0 ? (
                        <section aria-labelledby="import-notes-heading" className="space-y-1.5" data-testid="import-notes">
                            <p id="import-notes-heading" className="text-xs font-semibold text-info">
                                {notes.length} {notes.length === 1 ? "note" : "notes"} — these rows imported, with something
                                left out
                                {result?.notesTruncated ? " (the rest are not listed)" : ""}
                            </p>
                            <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                                {notes.map((note, index) => (
                                    <li
                                        key={`${note.row}-${index}`}
                                        className="flex flex-wrap gap-x-2 gap-y-0.5 rounded-control border border-edge-subtle bg-info-soft px-2.5 py-1.5 text-xs"
                                    >
                                        {rowLabel(note.row) ? (
                                            <span className="data-mono shrink-0 font-bold text-info">{rowLabel(note.row)}</span>
                                        ) : null}
                                        {note.column ? (
                                            <span className="font-semibold text-foreground">{note.column}</span>
                                        ) : null}
                                        <span className="min-w-0 text-foreground">{note.message}</span>
                                        {note.value ? <span className="data-mono shrink-0 text-muted-fg">“{note.value}”</span> : null}
                                    </li>
                                ))}
                            </ul>
                        </section>
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

function Stat({ label, value, testId }: { label: string; value: number; testId?: string }) {
    return (
        <div className="rounded-card border border-edge-subtle bg-surface-muted px-1 py-2">
            <dt className="text-[10px] uppercase leading-tight tracking-wide text-faint-fg sm:text-[11px]">{label}</dt>
            <dd data-testid={testId} className="data-mono text-xl font-bold text-foreground">
                {value}
            </dd>
        </div>
    );
}
