import type { AlertTone } from "@/components/ui/alert";
import type { ImportJobResult } from "@/services/importJobService";
import type { ImportOutcome, ImportPreviewResult, ImportRowIssue } from "@/services/importService";
import type { ImportJobPhase } from "@/features/imports/importJob";

/**
 * Turning what the server said into what the screen says.
 *
 * The rule this whole file exists to hold: **a verdict is reported, never
 * inferred.** A green tick once sat over "the server imported 0 rows"; the
 * counts said 1 row, 0 imported, 1 skipped while the list underneath said two
 * rows failed and named a row 0. The server now sends an `outcome` and holds
 * `totalRows === imported + updated + skipped`, `errors.length === failed` and
 * no row 0 — so the honest thing for the client to do is render those and stop
 * calculating.
 *
 * Where the server says nothing (an older build, a job with no result body),
 * the answer is `UNKNOWN`, which reads as "we could not tell" — not as success.
 */

const OUTCOMES: readonly ImportOutcome[] = ["SUCCESS", "PARTIAL", "FAILED", "NOTHING_TO_IMPORT"];

function asOutcome(value: unknown): ImportOutcome | null {
    const upper = typeof value === "string" ? (value.toUpperCase() as ImportOutcome) : null;
    return upper && OUTCOMES.includes(upper) ? upper : null;
}

function asIssues(value: unknown): ImportRowIssue[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => ({
            row: Number.isFinite(entry.row) ? Number(entry.row) : 0,
            message: typeof entry.message === "string" && entry.message.trim() ? entry.message.trim() : "No reason given",
            field: typeof entry.field === "string" ? entry.field : null,
            column: typeof entry.column === "string" ? entry.column : null,
            value: typeof entry.value === "string" ? entry.value : null,
        }));
}

function asNumber(value: unknown): number {
    return Number.isFinite(value) ? Number(value) : 0;
}

/** A preview as this screen uses it, plus whether the verdict came from the server. */
export interface PreviewView extends ImportPreviewResult {
    /**
     * False when the response carried no `outcome`. The check step then reports
     * the counts and nothing more — in particular it does not say "every row
     * passed", because nothing told it that.
     */
    outcomeReported: boolean;
}

/**
 * Normalises a preview response. Tolerant of a response that predates the
 * `totals`/`outcome` shape so a mid-rollout backend shows real counters rather
 * than three blank boxes — which is how this bug reached a customer.
 */
export function normalisePreview(raw: ImportPreviewResult | Record<string, unknown>): PreviewView {
    const body = (raw ?? {}) as Record<string, unknown>;
    const totalsRaw = (body.totals ?? {}) as Record<string, unknown>;
    const hasTotals = body.totals != null && typeof body.totals === "object";

    const errors = asIssues(body.errors ?? legacyRowErrors(body.rows));
    const valid = hasTotals ? asNumber(totalsRaw.valid) : asNumber(body.valid);
    const invalid = hasTotals ? asNumber(totalsRaw.invalid) : asNumber(body.invalid);
    const total = hasTotals ? asNumber(totalsRaw.total) : asNumber(body.total);

    const reported = asOutcome(body.outcome);
    const fatalError = typeof body.fatalError === "string" && body.fatalError.trim() ? body.fatalError.trim() : null;

    return {
        totals: { valid, invalid, total },
        errors,
        notes: asIssues(body.notes),
        rowsChecked: Number.isFinite(body.rowsChecked) ? Number(body.rowsChecked) : total,
        totalRowsInFile: Number.isFinite(body.totalRowsInFile) ? Number(body.totalRowsInFile) : total,
        outcome: reported ?? deriveOutcome(total, valid, fatalError),
        outcomeReported: reported != null,
        fatalError,
        wouldCreate: isRecordOfNames(body.wouldCreate) ? body.wouldCreate : {},
        wouldCreateCustomFields: Array.isArray(body.wouldCreateCustomFields)
            ? body.wouldCreateCustomFields.filter((name): name is string => typeof name === "string")
            : [],
    };
}

/** The pre-`totals` preview put its problems in `rows[].errors[]`. */
function legacyRowErrors(rows: unknown): unknown[] {
    if (!Array.isArray(rows)) return [];
    const out: unknown[] = [];
    for (const row of rows) {
        const record = row as Record<string, unknown>;
        for (const error of (record?.errors as unknown[]) ?? []) {
            out.push({ ...(error as Record<string, unknown>), row: record.rowNumber });
        }
    }
    return out;
}

function isRecordOfNames(value: unknown): value is Record<string, string[]> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Only for a response that carried no verdict of its own. It mirrors the
 * server's own rule so the tone is right, and `outcomeReported` keeps the
 * *wording* from claiming more than we were told.
 */
function deriveOutcome(total: number, valid: number, fatalError: string | null): ImportOutcome {
    if (fatalError) return "FAILED";
    if (total === 0) return "NOTHING_TO_IMPORT";
    if (valid === 0) return "FAILED";
    if (valid < total) return "PARTIAL";
    return "SUCCESS";
}

/** How a verdict should look. Colour is never the only carrier — Alert pairs each tone with an icon. */
export function outcomeTone(outcome: ImportOutcome | "CANCELLED" | "UNKNOWN"): AlertTone {
    if (outcome === "SUCCESS") return "ok";
    if (outcome === "PARTIAL") return "warn";
    return "danger";
}

/** How many rows a commit would write, given the preview and the skip choice. */
export function rowsThatWouldImport(preview: PreviewView, skipInvalidRows: boolean): number {
    if (preview.fatalError) return 0;
    return skipInvalidRows ? preview.totals.valid : preview.totals.invalid > 0 ? 0 : preview.totals.valid;
}

/** Whether the Import button may be pressed at all. */
export function canCommit(preview: PreviewView, skipInvalidRows: boolean): boolean {
    if (preview.fatalError) return false;
    if (preview.outcome === "NOTHING_TO_IMPORT") return false;
    return rowsThatWouldImport(preview, skipInvalidRows) > 0;
}

/** The sentence over the check step's counts. Never "every row passed" on a guess. */
export function previewHeadline(preview: PreviewView, plural: string): string {
    const { valid, invalid, total } = preview.totals;
    if (preview.fatalError) return "This file cannot be imported as it is matched";
    if (preview.outcome === "NOTHING_TO_IMPORT") return "There are no rows to import";
    if (preview.outcome === "FAILED") {
        return `None of the ${total} ${total === 1 ? "row" : "rows"} can be imported`;
    }
    if (preview.outcome === "PARTIAL") {
        return `${valid} of ${total} rows are ready. ${invalid} ${invalid === 1 ? "has" : "have"} problems`;
    }
    if (!preview.outcomeReported) {
        return `${valid} of ${total} ${total === 1 ? "row" : "rows"} are ready to import`;
    }
    return `Every row passed. Importing will add ${total} ${plural}`;
}

// ── The result screen ────────────────────────────────────────────────────────

/** What the finished screen reports. `UNKNOWN` is a failure of reporting, not a success. */
export type ImportVerdict = ImportOutcome | "CANCELLED" | "UNKNOWN";

/**
 * The verdict for a finished job.
 *
 * The server's `outcome` wins, with one guard: a job whose *status* is FAILED
 * is never shown as a success, whatever the result body says. And a completed
 * job with no verdict at all is `UNKNOWN` rather than assumed good.
 */
export function importVerdict(phase: ImportJobPhase, result: ImportJobResult | undefined): ImportVerdict {
    if (phase === "cancelled") return "CANCELLED";
    const reported = asOutcome(result?.outcome);
    if (phase === "failed") return reported && reported !== "SUCCESS" ? reported : "FAILED";
    if (reported) return reported;
    return result ? "UNKNOWN" : "UNKNOWN";
}

/** The heading for a finished job. */
export function verdictTitle(verdict: ImportVerdict, dryRun: boolean): string {
    const ran = dryRun ? "Dry run" : "Import";
    switch (verdict) {
        case "SUCCESS":
            return `${ran} completed`;
        case "PARTIAL":
            return `${ran} partly completed`;
        case "FAILED":
            return `${ran} failed`;
        case "NOTHING_TO_IMPORT":
            return "Nothing was imported";
        case "CANCELLED":
            return `${ran} cancelled`;
        default:
            return `${ran} finished without a result`;
    }
}

/** The sentence under it, built only from numbers the server sent. */
export function verdictSummary(
    verdict: ImportVerdict,
    result: ImportJobResult | undefined,
    plural: string,
): string {
    const imported = result?.imported ?? 0;
    const updated = result?.updated ?? 0;
    const skipped = result?.skipped ?? 0;
    const written = imported + updated;
    const wrote = result?.dryRun ? "would have been" : "were";

    switch (verdict) {
        case "SUCCESS":
            return `${written} ${written === 1 ? "row" : "rows"} of ${plural} ${wrote} saved, and nothing was left out.`;
        case "PARTIAL":
            return `${written} ${written === 1 ? "row" : "rows"} of ${plural} ${wrote} saved. ${skipped} ${
                skipped === 1 ? "row was" : "rows were"
            } not.`;
        case "FAILED":
            return `Nothing was saved. Every row the server read was refused — the reasons are listed below.`;
        case "NOTHING_TO_IMPORT":
            return "The server found no rows to read in that file, so nothing was saved.";
        case "CANCELLED":
            return "The import was cancelled before it finished. Anything already saved stays saved.";
        default:
            return "The server finished but did not say what it did. Check your register before importing this file again.";
    }
}

/** `{ department: ["Finance"] }` as a list a screen can walk. */
export function createdEntries(records: Record<string, string[]> | undefined): { type: string; names: string[] }[] {
    if (!records || typeof records !== "object") return [];
    return Object.entries(records)
        .filter(([, names]) => Array.isArray(names) && names.length > 0)
        .map(([type, names]) => ({ type, names: names.filter((name) => typeof name === "string") }));
}

/**
 * "department" → "Departments", or "Department" for exactly one. These keys are
 * singular entity names, and "1 categories" on a result screen reads as a bug
 * in everything else the screen says.
 */
export function createdTypeLabel(type: string, count = 2): string {
    const words = type.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().trim();
    if (!words) return count === 1 ? "Record" : "Records";
    const singular = words.replace(/ies$/, "y").replace(/s$/, "");
    const plural = words.endsWith("s") ? words : words.endsWith("y") ? `${words.slice(0, -1)}ies` : `${words}s`;
    const chosen = count === 1 ? singular : plural;
    return chosen.charAt(0).toUpperCase() + chosen.slice(1);
}
