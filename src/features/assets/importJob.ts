/**
 * Lifecycle of a background asset import job, mirroring the backend
 * `ImportJobStatus` enum (QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED).
 */
export type ImportJobPhase = "running" | "completed" | "failed" | "cancelled";

/**
 * Classifies a job status. QUEUED, PROCESSING and unknown values are treated as still running so the
 * modal keeps polling instead of silently freezing on a new backend status.
 */
export function importJobPhase(status: string | null | undefined): ImportJobPhase {
    const s = (status ?? "").toUpperCase();
    if (s === "COMPLETED") return "completed";
    if (s === "FAILED") return "failed";
    if (s === "CANCELLED") return "cancelled";
    return "running";
}

/** True while the modal should keep polling `GET /import-jobs/{id}`. */
export function shouldPollImportJob(jobId: string | null, status: string | null | undefined): boolean {
    return Boolean(jobId) && importJobPhase(status) === "running";
}

/** Result headings: a preview (dry run) reports what an import would do, since nothing is saved. */
export function importResultLabels(dryRun: boolean): { imported: string; skipped: string } {
    return dryRun ? { imported: "Would import", skipped: "Would skip" } : { imported: "Imported", skipped: "Skipped" };
}
