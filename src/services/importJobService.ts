import api from "@/lib/axios";

export interface ImportJobError {
    row?: number;
    message?: string;
}

export interface ImportJobResult {
    totalRows?: number;
    imported?: number;
    skipped?: number;
    dryRun?: boolean;
    errors?: ImportJobError[];
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

        const config: any = {
            headers: {
                "Content-Type": "multipart/form-data"
            },
            params: {}
        };

        if (options?.dryRun !== undefined) {
            config.params.dryRun = options.dryRun;
        }

        if (options?.idempotencyKey) {
            config.headers["Idempotency-Key"] = options.idempotencyKey;
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
