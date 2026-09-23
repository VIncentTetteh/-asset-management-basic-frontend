/**
 * Lifecycle of a background import job, mirroring the backend
 * `ImportJobStatus` enum (QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED).
 */
export type ImportJobPhase = "running" | "completed" | "failed" | "cancelled";

/**
 * Classifies a job status. QUEUED, PROCESSING and unknown values are treated as still running so the
 * wizard keeps polling instead of silently freezing on a new backend status.
 */
export function importJobPhase(status: string | null | undefined): ImportJobPhase {
    const s = (status ?? "").toUpperCase();
    if (s === "COMPLETED") return "completed";
    if (s === "FAILED") return "failed";
    if (s === "CANCELLED") return "cancelled";
    return "running";
}

/** True while the wizard should keep polling `GET /import-jobs/{id}`. */
export function shouldPollImportJob(jobId: string | null, status: string | null | undefined): boolean {
    return Boolean(jobId) && importJobPhase(status) === "running";
}

/** Result headings: a preview (dry run) reports what an import would do, since nothing is saved. */
export function importResultLabels(dryRun: boolean): { imported: string; skipped: string } {
    return dryRun ? { imported: "Would import", skipped: "Would skip" } : { imported: "Imported", skipped: "Skipped" };
}

/** Human wording for a job status, for the progress panel. */
export function importJobStatusLabel(status: string | null | undefined): string {
    const s = (status ?? "").toUpperCase();
    if (s === "QUEUED") return "Queued — waiting for a worker";
    if (s === "PROCESSING") return "Importing your rows…";
    if (s === "COMPLETED") return "Import finished";
    if (s === "FAILED") return "Import failed";
    if (s === "CANCELLED") return "Import cancelled";
    return s ? s.replace(/_/g, " ").toLowerCase() : "Starting…";
}

const FAST_POLLS = 6;
const FAST_POLL_MS = 500;
const STEADY_POLL_MS = 2_500;

/**
 * How long to wait before the next `GET /import-jobs/{id}`.
 *
 * A job usually leaves QUEUED within a second or two, so the first few polls
 * are quick — a user watching a spinner should see it move — and longer jobs
 * then settle to a slower cadence rather than hammering the API for minutes.
 */
export function importJobPollMs(pollsSoFar: number): number {
    return pollsSoFar < FAST_POLLS ? FAST_POLL_MS : STEADY_POLL_MS;
}
