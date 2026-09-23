import api from "@/lib/axios";
import type { AxiosRequestConfig } from "axios";

import type { ImportOutcome, ImportRowIssue } from "@/services/importService";

/** @deprecated Use {@link ImportRowIssue}; kept because older callers name this type. */
export type ImportJobError = ImportRowIssue;

/**
 * What an import actually did.
 *
 * Two invariants the server holds and this screen relies on:
 * `totalRows === imported + updated + skipped`, and `errors.length === failed`
 * unless `errorsTruncated`. A third: no error carries `row: 0`. Between them
 * they are why the result screen can render these numbers straight instead of
 * reconciling four counts that used to contradict each other.
 */
export interface ImportJobResult {
    totalRows?: number;
    imported?: number;
    /** Rows that patched an existing record rather than creating one. */
    updated?: number;
    /** Every row not written: `failed + duplicatesSkipped`. */
    skipped?: number;
    /** The part of `skipped` that went wrong. Matches `errors.length`. */
    failed?: number;
    /** The part of `skipped` that already existed. */
    duplicatesSkipped?: number;
    dryRun?: boolean;
    /** The server's own verdict. The screen renders this rather than guessing. */
    outcome?: ImportOutcome;
    errors?: ImportRowIssue[];
    errorsTruncated?: boolean;
    /** Leniencies, not failures: a value ignored, a reference created, a column dropped. */
    notes?: ImportRowIssue[];
    notesTruncated?: boolean;
    /** A whole-file or whole-mapping problem. Never an entry in `errors`. */
    fatalError?: string | null;
    /** Why the run stopped before the end of the file. A state, not an error row. */
    stoppedReason?: string | null;
    stoppedEarly?: boolean;
    /** Records created on the user's behalf, by type. */
    createdReferences?: Record<string, string[]>;
    createdCustomFields?: string[];
    /** True on a dry run: `createdReferences` names what *would* be created. */
    wouldCreateReferences?: boolean;
}

export interface ImportJobResponse {
    jobId?: string;
    status?: string;
    dryRun?: boolean;
    result?: ImportJobResult;
}

export const importJobService = {
    /** 
     * POST /import-jobs/assets
     * Upload an asset CSV for import.
     */
    importAssets: async (file: File, options?: { dryRun?: boolean; idempotencyKey?: string }): Promise<ImportJobResponse> => {
        const formData = new FormData();
        formData.append("file", file);

        const headers: Record<string, string> = { "Content-Type": "multipart/form-data" };
        const params: { dryRun?: boolean } = {};
        const config: AxiosRequestConfig = { headers, params };

        if (options?.dryRun !== undefined) {
            params.dryRun = options.dryRun;
        }

        if (options?.idempotencyKey) {
            headers["Idempotency-Key"] = options.idempotencyKey;
        }

        const response = await api.post<ImportJobResponse>("/import-jobs/assets", formData, config);
        return response.data;
    },

    /** 
     * GET /import-jobs/{jobId}
     * Check the status / results of an import job.
     */
    getJobDetails: async (jobId: string): Promise<ImportJobResponse> => {
        const response = await api.get<ImportJobResponse>(`/import-jobs/${jobId}`);
        return response.data;
    }
};
