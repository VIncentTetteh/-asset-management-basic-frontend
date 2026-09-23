"use client";

import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImportPreviewResult } from "@/services/importService";
import { flattenPreviewRows } from "@/features/imports/failedRows";
import { StepHeading } from "@/features/imports/WizardChrome";

/**
 * Validation before anything is written. The counts say whether the import is
 * safe to run; the list below names the row, the column *as the user labelled
 * it*, and what is wrong with it, so a fix can be made in their own sheet
 * without translating our field names back.
 */
export function ImportPreviewStep({
    preview,
    plural,
    skipInvalidRows,
    onSkipInvalidRowsChange,
    onBack,
    onCommit,
    isCommitting,
}: {
    preview: ImportPreviewResult;
    plural: string;
    skipInvalidRows: boolean;
    onSkipInvalidRowsChange: (value: boolean) => void;
    onBack: () => void;
    onCommit: () => void;
    isCommitting: boolean;
}) {
    const problems = flattenPreviewRows(preview.rows);
    const blocked = preview.invalid > 0 && !skipInvalidRows;
    const willImport = skipInvalidRows ? preview.valid : preview.total;

    return (
        <div className="space-y-5">
            <StepHeading hint="Nothing has been saved yet. This is what would happen if you import now.">
                Check your rows
            </StepHeading>

            <div className="grid grid-cols-3 gap-3 text-center" data-testid="import-preview-counts">
                <Count label="Rows found" value={preview.total} />
                <Count label="Ready" value={preview.valid} tone="ok" testId="import-preview-valid" />
                <Count label="With problems" value={preview.invalid} tone="warn" testId="import-preview-invalid" />
            </div>

            {preview.invalid > 0 ? (
                <div className="space-y-3">
                    <label className="flex cursor-pointer items-start gap-2 rounded-card border border-edge bg-surface-muted p-3 text-sm">
                        <input
                            type="checkbox"
                            data-testid="import-skip-invalid"
                            className="ea-focus mt-0.5 h-4 w-4"
                            checked={skipInvalidRows}
                            onChange={(event) => onSkipInvalidRowsChange(event.target.checked)}
                        />
                        <span className="text-foreground">
                            Import the {preview.valid} {preview.valid === 1 ? "row" : "rows"} that are ready and skip the{" "}
                            {preview.invalid} with problems. Leave this unticked to fix your sheet and upload it again.
                        </span>
                    </label>

                    <div className="space-y-1.5" data-testid="import-preview-errors">
                        <p className="text-xs font-semibold text-danger">
                            {problems.length} {problems.length === 1 ? "problem" : "problems"} found
                        </p>
                        <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                            {problems.map((problem, index) => (
                                <li
                                    key={`${problem.rowNumber}-${problem.column ?? ""}-${index}`}
                                    className="flex flex-wrap gap-x-2 gap-y-0.5 rounded-control border border-edge-subtle bg-danger-soft px-2.5 py-1.5 text-xs"
                                >
                                    <span className="data-mono shrink-0 font-bold text-danger">Row {problem.rowNumber}</span>
                                    {problem.column ? (
                                        <span className="shrink-0 font-semibold text-foreground">{problem.column}</span>
                                    ) : null}
                                    <span className="text-foreground">{problem.message}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : (
                <p
                    role="status"
                    data-testid="import-preview-clean"
                    className="flex items-center gap-2 rounded-card border border-ok/40 bg-ok-soft p-3 text-sm text-foreground"
                >
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-ok" />
                    Every row passed. Importing will add {preview.total} {plural}.
                </p>
            )}

            {blocked ? (
                <p
                    role="alert"
                    data-testid="import-preview-blocked"
                    className="flex items-start gap-2 rounded-card border border-danger/40 bg-danger-soft p-3 text-sm text-foreground"
                >
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                    Fix the rows above in your spreadsheet and upload it again, or tick the box to import only the rows that
                    are ready.
                </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-edge-subtle pt-3">
                <Button type="button" variant="outline" onClick={onBack}>
                    Back to matching
                </Button>
                <Button
                    type="button"
                    onClick={onCommit}
                    disabled={blocked || willImport === 0}
                    isLoading={isCommitting}
                    data-testid="import-commit"
                >
                    {isCommitting ? null : <Upload aria-hidden="true" className="mr-2 h-4 w-4" />}
                    Import {willImport} {willImport === 1 ? "row" : "rows"}
                </Button>
            </div>
        </div>
    );
}

function Count({
    label,
    value,
    tone,
    testId,
}: {
    label: string;
    value: number;
    tone?: "ok" | "warn";
    testId?: string;
}) {
    const surface = tone === "ok" ? "bg-ok-soft" : tone === "warn" ? "bg-warn-soft" : "bg-surface-muted";
    const text = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-foreground";
    return (
        <div className={`rounded-card border border-edge-subtle py-2 ${surface}`}>
            <p className="text-[11px] uppercase tracking-wide text-faint-fg">{label}</p>
            <p data-testid={testId} className={`data-mono text-xl font-bold ${text}`}>
                {value}
            </p>
        </div>
    );
}
