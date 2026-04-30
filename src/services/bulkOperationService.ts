import api from "@/lib/axios";
import { ImportJobStatus, ExportJobRequest } from "@/types";
import { downloadBlobResponse } from "@/services/responseUtils";

const extensionFor = (format: string): string => {
    switch (format.toUpperCase()) {
        case "EXCEL":
        case "XLSX":
            return "xlsx";
        case "PDF":
            return "pdf";
        default:
            return "csv";
    }
};

export const bulkOperationService = {
    importAssets: async (file: File, dryRun?: boolean): Promise<ImportJobStatus> => {
        const formData = new FormData();
        formData.append("file", file);
        if (dryRun !== undefined) {
            formData.append("dryRun", dryRun.toString());
        }
        const response = await api.post<ImportJobStatus>("/import-jobs/assets", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return response.data;
    },
    getImportJobStatus: async (jobId: string): Promise<ImportJobStatus> => {
        const response = await api.get<ImportJobStatus>(`/import-jobs/${jobId}`);
        return response.data;
    },
    getImportErrorReport: async (jobId: string): Promise<ImportJobStatus> => {
        const response = await api.get<ImportJobStatus>(`/import-jobs/${jobId}`);
        return response.data;
    },
    exportAssets: async (request: ExportJobRequest): Promise<string> => {
        const response = await api.post<Blob>("/bulk/assets/export", request, { responseType: "blob" });
        return downloadBlobResponse(response, `assets-export.${extensionFor(request.format)}`);
    },
    exportPurchaseOrders: async (request: ExportJobRequest): Promise<string> => {
        const response = await api.post<Blob>("/bulk/purchase-orders/export", request, { responseType: "blob" });
        return downloadBlobResponse(response, `purchase-orders-export.${extensionFor(request.format)}`);
    },
    exportSuppliers: async (request: ExportJobRequest): Promise<string> => {
        const response = await api.post<Blob>("/bulk/suppliers/export", request, { responseType: "blob" });
        return downloadBlobResponse(response, `suppliers-export.${extensionFor(request.format)}`);
    }
};
