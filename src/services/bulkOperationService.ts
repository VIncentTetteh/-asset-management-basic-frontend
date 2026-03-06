import api from "@/lib/axios";
import { ImportJobStatus, ExportJobRequest, ExportJobResponse } from "@/types";

export const bulkOperationService = {
    importAssets: async (file: File, dryRun?: boolean): Promise<ImportJobStatus> => {
        const formData = new FormData();
        formData.append("file", file);
        if (dryRun !== undefined) {
            formData.append("dryRun", dryRun.toString());
        }
        const response = await api.post<ImportJobStatus>("/bulk/assets/import", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return response.data;
    },
    getImportJobStatus: async (jobId: string): Promise<ImportJobStatus> => {
        const response = await api.get<ImportJobStatus>(`/bulk/assets/import/${jobId}`);
        return response.data;
    },
    getImportErrorReport: async (jobId: string): Promise<string> => {
        // Returns CSV text
        const response = await api.get<string>(`/bulk/assets/import/${jobId}/errors`, {
            responseType: "text",
        });
        return response.data;
    },
    exportAssets: async (request: ExportJobRequest): Promise<ExportJobResponse> => {
        const response = await api.post<ExportJobResponse>("/bulk/assets/export", request);
        return response.data;
    }
};
