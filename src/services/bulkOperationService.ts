import api from "@/lib/axios";
import { ExportJobRequest } from "@/types";
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
    exportPurchaseOrders: async (request: ExportJobRequest): Promise<string> => {
        const response = await api.post<Blob>("/bulk/purchase-orders/export", request, { responseType: "blob" });
        return downloadBlobResponse(response, `purchase-orders-export.${extensionFor(request.format)}`);
    },
    exportSuppliers: async (request: ExportJobRequest): Promise<string> => {
        const response = await api.post<Blob>("/bulk/suppliers/export", request, { responseType: "blob" });
        return downloadBlobResponse(response, `suppliers-export.${extensionFor(request.format)}`);
    }
};
