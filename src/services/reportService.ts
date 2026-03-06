import api from "@/lib/axios";
import { ReportRequest, ReportResponse, ReportHistory } from "@/types";
import { extractList } from "@/services/responseUtils";

const normalizeHistory = (payload: unknown): ReportHistory => {
    if (payload && typeof payload === "object" && "reports" in (payload as Record<string, unknown>)) {
        const obj = payload as Record<string, unknown>;
        return {
            totalReports: Number(obj.totalReports || 0),
            limit: Number(obj.limit || 10),
            offset: Number(obj.offset || 0),
            reports: extractList<ReportResponse>(obj.reports ?? []),
        };
    }

    const reports = extractList<ReportResponse>(payload);
    return {
        totalReports: reports.length,
        limit: reports.length,
        offset: 0,
        reports,
    };
};

const readBlobPrefix = async (blob: Blob, length = 16): Promise<string> => {
    const buffer = await blob.slice(0, length).arrayBuffer();
    return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
};

const decodeBase64ToBytes = (base64: string): number[] => {
    const clean = base64.replace(/\s/g, "");
    if (typeof atob === "function") {
        const binary = atob(clean);
        const bytes: number[] = [];
        for (let i = 0; i < binary.length; i += 1) bytes.push(binary.charCodeAt(i));
        return bytes;
    }
    // Fallback for non-browser environments.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = (globalThis as any).Buffer.from(clean, "base64");
    return Array.from(buf.values());
};

const base64ToBlob = (base64: string, mimeType = "application/octet-stream"): Blob => {
    return new Blob([new Uint8Array(decodeBase64ToBytes(base64))], { type: mimeType });
};

const tryExtractBase64 = (payload: unknown): string | undefined => {
    if (!payload) return undefined;
    if (typeof payload === "string") return payload;
    if (typeof payload !== "object") return undefined;

    const candidates = ["file", "data", "content", "bytes", "payload", "base64"];
    for (const key of candidates) {
        const value = (payload as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim()) return value;
    }
    return undefined;
};

const normalizeDownloadBlob = async (blob: Blob, expectedFormat?: string): Promise<Blob> => {
    const type = (blob.type || "").toLowerCase();
    const prefix = (await readBlobPrefix(blob, 16)).trim();
    const format = (expectedFormat || "").toUpperCase();

    // Already a valid PDF stream.
    if (format === "PDF" && prefix.startsWith("%PDF")) return blob;

    // Backend may return base64 as plain text.
    if (format === "PDF" && prefix.startsWith("JVBER")) {
        const text = (await blob.text()).trim().replace(/^"+|"+$/g, "");
        return base64ToBlob(text, "application/pdf");
    }

    // Backend may return JSON wrapper with base64 payload.
    if (type.includes("json") || prefix.startsWith("{")) {
        const text = await blob.text();
        try {
            const parsed = JSON.parse(text);
            const maybeBase64 = tryExtractBase64(parsed);
            if (format === "PDF" && maybeBase64) {
                const cleaned = maybeBase64.replace(/^data:application\/pdf;base64,/, "");
                return base64ToBlob(cleaned, "application/pdf");
            }
            throw new Error(parsed?.message || "Server returned JSON instead of file bytes.");
        } catch {
            throw new Error(text || "Server returned invalid JSON file payload.");
        }
    }

    // HTML error payload.
    if (type.includes("text/html") || prefix.startsWith("<!DOCTYPE") || prefix.startsWith("<html")) {
        const text = await blob.text();
        throw new Error(text || "Server returned an HTML error page instead of file bytes.");
    }

    // Last validation gate for PDF.
    if (format === "PDF") {
        const normalizedPrefix = await readBlobPrefix(blob, 16);
        if (!normalizedPrefix.startsWith("%PDF")) {
            throw new Error("Downloaded file is not a valid PDF payload.");
        }
    }

    return blob;
};

export const reportService = {
    generateAssetReport: async (data: ReportRequest): Promise<ReportResponse> => {
        const response = await api.post<ReportResponse>("/reports/assets", data);
        return response.data;
    },

    generateFinancialReport: async (data: ReportRequest): Promise<ReportResponse> => {
        const response = await api.post<ReportResponse>("/reports/financial", data);
        return response.data;
    },

    generateMaintenanceReport: async (data: ReportRequest): Promise<ReportResponse> => {
        const response = await api.post<ReportResponse>("/reports/maintenance", data);
        return response.data;
    },

    // Download report returns Blob + optional filename from content-disposition
    downloadReport: async (reportId: string, expectedFormat?: string): Promise<{ blob: Blob; fileName?: string }> => {
        const response = await api.get<Blob>(`/reports/${reportId}/download`, { responseType: "blob" });
        const normalizedBlob = await normalizeDownloadBlob(response.data, expectedFormat);
        const disposition = response.headers["content-disposition"] as string | undefined;
        const fileNameMatch = disposition?.match(/filename\*?=(?:UTF-8'')?\"?([^\";]+)/i);
        return { blob: normalizedBlob, fileName: fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1]) : undefined };
    },

    // Use when backend history gives a downloadUrl but no reportId
    downloadFromUrl: async (downloadUrl: string, expectedFormat?: string): Promise<{ blob: Blob; fileName?: string }> => {
        const normalizedPath = downloadUrl.startsWith("/api/v1") ? downloadUrl.replace("/api/v1", "") : downloadUrl;
        const response = await api.get<Blob>(normalizedPath, { responseType: "blob" });
        const normalizedBlob = await normalizeDownloadBlob(response.data, expectedFormat);
        const disposition = response.headers["content-disposition"] as string | undefined;
        const fileNameMatch = disposition?.match(/filename\*?=(?:UTF-8'')?\"?([^\";]+)/i);
        return { blob: normalizedBlob, fileName: fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1]) : undefined };
    },

    getReportHistory: async (params?: { type?: string; limit?: number; offset?: number }): Promise<ReportHistory> => {
        const response = await api.get("/reports/history", { params });
        return normalizeHistory(response.data);
    }
};
