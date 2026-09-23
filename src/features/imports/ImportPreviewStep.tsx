"use client";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StepHeading } from "@/features/imports/WizardChrome";
import { rowLabel } from "@/features/imports/failedRows";
import {
    canCommit,
    createdEntries,
    createdTypeLabel,
    outcomeTone,
    previewHeadline,
    rowsThatWouldImport,
    type PreviewView,
} from "@/features/imports/outcome";

/**
 * The check step: a dry run of the real engine, rendered exactly as it came.
 *
 * Three things went wrong here in the deployed product and are each fixed by
 * reading the new response literally rather than reconstructing it:
 *
 *  - the counters were blank, because the numbers moved into `totals` and this
 *    screen was still reading `preview.valid`;
 *  - it said "every row passed" and the import then failed on an enum value and
 *    a missing category — the same options now drive both calls, and the
 *    verdict shown is the server's own `outcome`, never one derived here;
 *  - errors and notes were the same list. They are not the same thing: an error
 *    means the row does not import, a note means it does, with something left
 *    blank or created for it.
 *
 * Changing an option re-runs the check, because a check that describes a
 * different run than the one about to happen is the bug this step exists to
 * prevent.
 */
export function ImportPreviewStep({
    preview,
    plural,
    skipInvalidRows,
    onSkipInvalidRowsChange,
    createMissingReferences,
    onCreateMissingReferencesChange,
    plannedCustomFields,
    isRechecking,
    onBack,
    onCommit,
    isCommitting,
}: {
    preview: PreviewView;
    plural: string;
    skipInvalidRows: boolean;
    onSkipInvalidRowsChange: (value: boolean) => void;
    createMissingReferences: boolean;
    onCreateMissingReferencesChange: (value: boolean) => void;
    /** Custom fields the user asked for in the matching step, if the server did not echo them. */
    plannedCustomFields: string[];
    isRechecking: boolean;
    onBack: () => void;
    onCommit: () => void;
    isCommitting: boolean;
}) {
    const { valid, invalid, total } = preview.totals;
    const willImport = rowsThatWouldImport(preview, skipInvalidRows);
    const commitAllowed = canCommit(preview, skipInvalidRows) && !isRechecking;
    const references = createdEntries(preview.wouldCreate);
    const customFields =
        preview.wouldCreateCustomFields && preview.wouldCreateCustomFields.length > 0
            ? preview.wouldCreateCustomFields
            : plannedCustomFields;
    const createsSomething = references.length > 0 || customFields.length > 0;

    return (
        <div className="space-y-5">
            <StepHeading hint="Nothing has been saved yet. This is the same engine the import runs, so what it says here is what will happen.">
                Check your rows
            </StepHeading>

            <div className="grid grid-cols-3 gap-2 text-center sm:gap-3" data-testid="import-preview-counts">
                <Count label="Rows found" value={total} testId="import-preview-total" />
                <Count label="Ready" value={valid} tone="ok" testId="import-preview-valid" />
                <Count label="With problems" value={invalid} tone="warn" testId="import-preview-invalid" />
            </div>

            {preview.rowsChecked < preview.totalRowsInFile ? (
                <p className="text-xs text-muted-fg" data-testid="import-preview-sampled">
                    We checked the first {preview.rowsChecked} of {preview.totalRowsInFile} rows in your file. The import
                    reads all of them.
                </p>
            ) : null}

            {preview.fatalError ? (
                <Alert tone="danger" title="This file cannot be imported as it is matched" data-testid="import-preview-fatal">
                    {preview.fatalError}
                </Alert>
            ) : (
                <Alert
                    tone={outcomeTone(preview.outcome)}
                    live={false}
                    data-testid="import-preview-verdict"
                    data-outcome={preview.outcome}
                    title={previewHeadline(preview, plural)}
                >
                    {isRechecking ? "Checking again with your new options…" : null}
                </Alert>
            )}

            {invalid > 0 ? (
                <label className="flex cursor-pointer items-start gap-2 rounded-card border border-edge bg-surface-muted p-3 text-sm">
                    <input
                        type="checkbox"
                        data-testid="import-skip-invalid"
                        className="ea-focus mt-0.5 h-4 w-4"
                        checked={skipInvalidRows}
                        onChange={(event) => onSkipInvalidRowsChange(event.target.checked)}
                    />
                    <span className="text-foreground">
                        Import the {valid} {valid === 1 ? "row" : "rows"} that are ready and skip the {invalid} with
                        problems. Leave this unticked to fix your sheet and upload it again.
                    </span>
                </label>
            ) : null}

            <section
                aria-labelledby="import-will-create-heading"
                className="space-y-2 rounded-card border border-edge bg-surface-muted p-3"
                data-testid="import-will-create"
            >
                <h5 id="import-will-create-heading" className="text-sm font-bold text-foreground">
                    What this import will create in your organisation
                </h5>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                        type="checkbox"
                        data-testid="import-create-missing-references"
                        className="ea-focus mt-0.5 h-4 w-4"
                        checked={createMissingReferences}
                        onChange={(event) => onCreateMissingReferencesChange(event.target.checked)}
                    />
                    <span className="text-foreground">
                        Create categories, departments, locations and suppliers my file names but AssetIQ does not have yet.
                        Untick this and a row naming something unknown is refused instead.
                    </span>
                </label>

                {createsSomething ? (
                    <ul className="space-y-1 text-xs text-foreground" data-testid="import-would-create">
                        {references.map((entry) => (
                            <li key={entry.type}>
                                <span className="font-semibold">
                                    {entry.names.length} new {createdTypeLabel(entry.type, entry.names.length).toLowerCase()}:
                                </span>{" "}
                                {entry.names.join(", ")}
                            </li>
                        ))}
                        {customFields.length > 0 ? (
                            <li data-testid="import-would-create-custom-fields">
                                <span className="font-semibold">
                                    {customFields.length} new custom {customFields.length === 1 ? "field" : "fields"}:
                                </span>{" "}
                                {customFields.join(", ")}
                            </li>
                        ) : null}
                    </ul>
                ) : (
                    <p className="text-xs text-muted-fg" data-testid="import-would-create-nothing">
                        Nothing new — every category, department, location and supplier your file names already exists.
                    </p>
                )}
            </section>

            {preview.errors.length > 0 ? (
                <IssueList
                    testId="import-preview-errors"
                    tone="danger"
                    title={`${preview.errors.length} ${preview.errors.length === 1 ? "row" : "rows"} will not import`}
                    issues={preview.errors}
                />
            ) : null}

            {preview.notes.length > 0 ? (
                <IssueList
                    testId="import-preview-notes"
                    tone="info"
                    title={`${preview.notes.length} ${preview.notes.length === 1 ? "thing" : "things"} we will do differently`}
                    subtitle="These rows still import. Something in them was left blank or translated for you."
                    issues={preview.notes}
                />
            ) : null}

            {invalid > 0 && !skipInvalidRows ? (
                <Alert tone="danger" title="These rows are blocking the import" data-testid="import-preview-blocked">
                    Fix them in your spreadsheet and upload it again, or tick the box above to import only the rows that are
                    ready.
                </Alert>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-edge-subtle pt-3">
                <Button type="button" variant="outline" onClick={onBack}>
                    Back to matching
                </Button>
                <Button
                    type="button"
                    onClick={onCommit}
                    disabled={!commitAllowed}
                    isLoading={isCommitting}
                    data-testid="import-commit"
                >
                    {isCommitting ? null : <Upload aria-hidden="true" className="mr-2 h-4 w-4" />}
                    {willImport > 0 ? `Import ${willImport} ${willImport === 1 ? "row" : "rows"}` : "Import"}
                </Button>
            </div>
        </div>
    );
}

/**
 * Errors and notes share a shape but never a list: the heading and the colour
 * say which of "this row is out" and "this row is in, with a caveat" applies.
 */
function IssueList({
    testId,
    tone,
    title,
    subtitle,
    issues,
}: {
    testId: string;
    tone: "danger" | "info";
    title: string;
    subtitle?: string;
    issues: { row: number; message: string; column?: string | null; value?: string | null }[];
}) {
    const chip = tone === "danger" ? "text-danger" : "text-info";
    const box = tone === "danger" ? "bg-danger-soft" : "bg-info-soft";
    return (
        <section aria-labelledby={`${testId}-heading`} className="space-y-1.5" data-testid={testId}>
            <p id={`${testId}-heading`} className={`text-xs font-semibold ${chip}`}>
                {title}
            </p>
            {subtitle ? <p className="text-xs text-muted-fg">{subtitle}</p> : null}
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {issues.map((issue, index) => (
                    <li
                        key={`${issue.row}-${issue.column ?? ""}-${index}`}
                        className={`flex flex-wrap gap-x-2 gap-y-0.5 rounded-control border border-edge-subtle px-2.5 py-1.5 text-xs ${box}`}
                    >
                        {rowLabel(issue.row) ? (
                            <span className={`data-mono shrink-0 font-bold ${chip}`}>{rowLabel(issue.row)}</span>
                        ) : null}
                        {issue.column ? <span className="shrink-0 font-semibold text-foreground">{issue.column}</span> : null}
                        <span className="min-w-0 text-foreground">{issue.message}</span>
                        {issue.value ? <span className="data-mono shrink-0 text-muted-fg">“{issue.value}”</span> : null}
                    </li>
                ))}
            </ul>
        </section>
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
        <div className={`rounded-card border border-edge-subtle px-1 py-2 ${surface}`}>
            <p className="text-[10px] uppercase leading-tight tracking-wide text-faint-fg sm:text-[11px]">{label}</p>
            <p data-testid={testId} className={`data-mono text-xl font-bold ${text}`}>
                {value}
            </p>
        </div>
    );
}
