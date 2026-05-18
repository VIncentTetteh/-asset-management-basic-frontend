"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { documentService } from "@/services/documentService";
import { DocumentAttachment, AttachmentEntityType } from "@/types";
import api from "@/lib/axios";
import {
    File,
    FileText,
    Image,
    FileSpreadsheet,
    Trash2,
    ExternalLink,
    Upload,
    Paperclip,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function FileIcon({ contentType }: { contentType: string }) {
    if (contentType === "application/pdf") {
        return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
    }
    if (contentType.startsWith("image/")) {
        return <Image className="h-4 w-4 text-blue-500 shrink-0" />;
    }
    if (
        contentType.includes("spreadsheet") ||
        contentType.includes("excel") ||
        contentType.includes("csv")
    ) {
        return <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />;
    }
    if (contentType.includes("word") || contentType.includes("document")) {
        return <FileText className="h-4 w-4 text-blue-700 shrink-0" />;
    }
    return <File className="h-4 w-4 text-slate-400 shrink-0" />;
}

// ─── Accepted MIME types ──────────────────────────────────────────────────────
const ACCEPTED_TYPES =
    "application/pdf,image/*,.doc,.docx,.xls,.xlsx,.txt,.csv";

// ─── Props ────────────────────────────────────────────────────────────────────

interface DocumentAttachmentsProps {
    entityType: AttachmentEntityType;
    entityId: string;
    readOnly?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentAttachments({
    entityType,
    entityId,
    readOnly = false,
}: DocumentAttachmentsProps) {
    const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Load attachments on mount / when entityId changes ─────────────────────
    useEffect(() => {
        if (!entityId) return;

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const data = await documentService.list(entityType, entityId);
                if (!cancelled) setAttachments(data);
            } catch {
                if (!cancelled) toast.error("Failed to load attachments");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [entityType, entityId]);

    // ── File upload handler ───────────────────────────────────────────────────
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so selecting the same file again re-triggers onChange
        e.target.value = "";

        setUploading(true);
        try {
            const attachment = await documentService.upload(entityType, entityId, file);
            setAttachments((prev) => [attachment, ...prev]);
            toast.success(`"${file.name}" uploaded successfully`);
        } catch {
            toast.error(`Failed to upload "${file.name}"`);
        } finally {
            setUploading(false);
        }
    };

    // ── View handler — fetches URL, then opens directly (S3) or via blob (streaming) ─
    const handleView = async (attachment: DocumentAttachment) => {
        try {
            const url = await documentService.getDownloadUrl(attachment.id);

            // Presigned S3 URLs are external — no auth header needed, already signed.
            // Backend streaming URLs contain both the API path segment and the /download
            // suffix, so we detect them by both markers to avoid false-positives.
            const isExternal = !(url.includes("/api/v1/documents/") && url.includes("/download"));

            if (isExternal) {
                // S3 presigned URL — open directly (no auth needed, already signed)
                window.open(url, "_blank", "noopener,noreferrer");
            } else {
                // Backend streaming URL — must fetch with auth headers, then create blob URL
                const response = await api.get(url, { responseType: "blob" });
                const blobUrl = window.URL.createObjectURL(response.data);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.target = "_blank";
                a.download = attachment.originalName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
            }
        } catch {
            toast.error("Failed to open document");
        }
    };

    // ── Delete handler — two-step inline confirm ──────────────────────────────
    const handleDeleteRequest = (id: string) => {
        setConfirmDeleteId(id);
    };

    const handleDeleteConfirm = async (id: string) => {
        setDeletingId(id);
        setConfirmDeleteId(null);
        try {
            await documentService.delete(id);
            setAttachments((prev) => prev.filter((a) => a.id !== id));
            toast.success("Attachment deleted");
        } catch {
            toast.error("Failed to delete attachment");
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteCancel = () => {
        setConfirmDeleteId(null);
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-slate-500" />
                        Documents
                        {attachments.length > 0 && (
                            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {attachments.length}
                            </span>
                        )}
                    </CardTitle>

                    {!readOnly && (
                        <Button
                            size="sm"
                            variant="outline"
                            isLoading={uploading}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {!uploading && <Upload className="h-3.5 w-3.5 mr-1.5" />}
                            Attach file
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {/* Hidden file input */}
                {!readOnly && (
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_TYPES}
                        className="hidden"
                        onChange={handleFileChange}
                    />
                )}

                {/* Loading state */}
                {loading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                        <Spinner size="sm" />
                        <span className="text-sm">Loading attachments…</span>
                    </div>
                ) : attachments.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                        <File className="h-8 w-8 text-slate-300" />
                        <p className="text-sm">No documents attached</p>
                        {!readOnly && (
                            <p className="text-xs text-slate-400">
                                Click &ldquo;Attach file&rdquo; above to add one
                            </p>
                        )}
                    </div>
                ) : (
                    /* Attachment list */
                    <ul className="divide-y divide-slate-100">
                        {attachments.map((attachment) => (
                            <li key={attachment.id} className="py-3 first:pt-0 last:pb-0">
                                <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className="mt-0.5">
                                        <FileIcon contentType={attachment.contentType} />
                                    </div>

                                    {/* Metadata */}
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className="text-sm font-medium text-slate-800 truncate"
                                            title={attachment.originalName}
                                        >
                                            {attachment.originalName}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                                            <span>{formatBytes(attachment.fileSize)}</span>
                                            {attachment.uploadedByName && (
                                                <span>by {attachment.uploadedByName}</span>
                                            )}
                                            <span>{formatDate(attachment.createdAt)}</span>
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {confirmDeleteId === attachment.id ? (
                                            /* Inline confirm row */
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <span className="text-slate-500 hidden sm:inline">
                                                    Delete?
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="h-7 px-2 text-xs"
                                                    isLoading={deletingId === attachment.id}
                                                    onClick={() => handleDeleteConfirm(attachment.id)}
                                                >
                                                    Yes
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={handleDeleteCancel}
                                                >
                                                    No
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2 text-xs text-teal-700 hover:text-teal-800 hover:bg-teal-50"
                                                    onClick={() =>
                                                        handleView(attachment)
                                                    }
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                                    View
                                                </Button>

                                                {!readOnly && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        disabled={deletingId === attachment.id}
                                                        onClick={() => handleDeleteRequest(attachment.id)}
                                                    >
                                                        {deletingId === attachment.id ? (
                                                            <Spinner size="xs" className="text-red-500" />
                                                        ) : (
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Upload progress overlay — shown below list while uploading */}
                {uploading && (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                        <Spinner size="xs" className="text-teal-600" />
                        Uploading…
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default DocumentAttachments;
