import api from "@/lib/axios";
import { DocumentAttachment, AttachmentEntityType } from "@/types";

export const documentService = {
    /** List all attachments for an entity (no download URLs). */
    list: async (entityType: AttachmentEntityType, entityId: string): Promise<DocumentAttachment[]> => {
        const response = await api.get<DocumentAttachment[]>("/documents", {
            params: { entityType, entityId },
        });
        return response.data;
    },

    /** Upload a file and attach it to an entity. Returns saved attachment with download URL. */
    upload: async (entityType: AttachmentEntityType, entityId: string, file: File): Promise<DocumentAttachment> => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.post<DocumentAttachment>("/documents", formData, {
            params: { entityType, entityId },
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    },

    /** Fetch a short-lived presigned URL for viewing/downloading an attachment. */
    getDownloadUrl: async (id: string): Promise<string> => {
        const response = await api.get<{ url: string }>(`/documents/${id}/url`);
        return response.data.url;
    },

    /** Delete an attachment (soft DB delete + hard S3 delete). */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/documents/${id}`);
    },
};
