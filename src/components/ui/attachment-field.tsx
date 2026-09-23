"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { File as FileIconGeneric, FileSpreadsheet, FileText, Image as ImageIcon, Paperclip, Trash2, Upload, X } from "lucide-react";
import api from "@/lib/axios";
import { qk } from "@/lib/queryClient";
import { safeExternalUrl } from "@/lib/safe-url";
import { cn } from "@/lib/utils";
import { documentService } from "@/services/documentService";
import { commercialFeatures } from "@/config/commercialFeatures";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { AttachmentEntityType, DocumentAttachment } from "@/types";

/**
 * The one file-attachment control in the app.
 *
 * Replaces the "paste a URL to your document" inputs (contract documents,
 * licence documents, expense receipts, disposal certificates, compliance
 * evidence, scan reports): the file is uploaded to `POST /api/v1/documents`
 * and held against the record, rather than trusting a customer to host it
 * somewhere the next reader can still reach.
 *
 * Two shapes, one control:
 * - **editing** — the record has an id, so a chosen file uploads immediately
 *   and joins the list below the picker;
 * - **creating** — there is no id yet, so the file is *held* and the page
 *   uploads it with {@link AttachmentFieldState.flushPending} right after the
 *   create succeeds. The upload is never claimed until the server confirms it.
 *
 * Records created before this existed still hold a URL in their `*Url` column;
 * pass it as `legacyUrl` and it is shown as a link next to the uploader so
 * nothing a customer already stored disappears.
 */

// ── Limits (mirror DocumentAttachmentServiceImpl) ────────────────────────────

/** `DocumentAttachmentServiceImpl.MAX_FILE_SIZE`. */
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

/**
 * `DocumentAttachmentServiceImpl.ALLOWED_TYPES`, exactly. Documents and raster
 * images only — never `image/svg+xml` or `text/html`, which carry script and
 * would run in the app's origin when opened from the streaming endpoint.
 */
export const ATTACHMENT_MIME_TYPES: readonly string[] = [
    "application/pdf",
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
];

/** `accept` for the file input: the MIME types plus the extensions browsers report inconsistently. */
export const ATTACHMENT_ACCEPT = [
    ...ATTACHMENT_MIME_TYPES,
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv",
].join(",");

export const ATTACHMENT_TYPES_HINT = "PDF, image, Word, Excel, text or CSV — up to 25 MB.";

/** Human-readable size, as the attachment list shows it. */
export function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The client-side half of the server's checks, so an obviously wrong file is
 * refused before it is sent. Returns the message to show, or null when the file
 * is acceptable. Browsers leave `type` empty for some files (notably .csv on
 * Windows), so an empty type falls back to the extension.
 */
export function validateAttachmentFile(file: File): string | null {
    if (file.size === 0) return "That file is empty.";
    if (file.size > ATTACHMENT_MAX_BYTES) {
        return `${formatFileSize(file.size)} is over the 25 MB limit.`;
    }
    const type = (file.type || "").toLowerCase();
    if (type) {
        if (!ATTACHMENT_MIME_TYPES.includes(type)) {
            return `${type} files cannot be attached. ${ATTACHMENT_TYPES_HINT}`;
        }
        return null;
    }
    const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
    const known = ["pdf", "jpg", "jpeg", "png", "gif", "webp", "doc", "docx", "xls", "xlsx", "txt", "csv"];
    if (!known.includes(extension)) {
        return `That file type cannot be attached. ${ATTACHMENT_TYPES_HINT}`;
    }
    return null;
}

function IconFor({ contentType }: { contentType: string }) {
    const type = contentType ?? "";
    if (type === "application/pdf") return <FileText className="h-4 w-4 shrink-0 text-danger" aria-hidden />;
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4 shrink-0 text-brand" aria-hidden />;
    if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) {
        return <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--status-in-use)]" aria-hidden />;
    }
    if (type.includes("word") || type.includes("document")) return <FileText className="h-4 w-4 shrink-0 text-brand" aria-hidden />;
    return <FileIconGeneric className="h-4 w-4 shrink-0 text-faint-fg" aria-hidden />;
}

/**
 * Gets one attachment's bytes in front of the user.
 *
 * Module level, not a hook method, because the uploader is no longer the only
 * place a stored file has to be reachable: the expenses list opens receipts
 * straight from its rows (there is no expense detail form to open them from).
 * Both paths must behave identically, including the failure message.
 */
export async function downloadAttachment(attachment: DocumentAttachment): Promise<void> {
    try {
        const url = await documentService.getDownloadUrl(attachment.id);
        // A backend streaming URL carries both markers; anything else is a
        // presigned S3 URL that is already signed and needs no auth header.
        const isStreaming = url.includes("/api/v1/documents/") && url.includes("/download");
        if (!isStreaming) {
            const safe = safeExternalUrl(url);
            if (!safe) throw new Error("Unsupported download URL");
            window.open(safe, "_blank", "noopener,noreferrer");
            return;
        }
        const response = await api.get(url, { responseType: "blob" });
        const blobUrl = window.URL.createObjectURL(response.data as Blob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = attachment.originalName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10_000);
    } catch {
        toast.error(`"${attachment.originalName}" could not be downloaded`);
    }
}

// ── State ────────────────────────────────────────────────────────────────────

export interface AttachmentFieldState {
    entityType: AttachmentEntityType;
    entityId: string | null;
    /** False when the deployment has document attachments switched off. */
    enabled: boolean;
    attachments: DocumentAttachment[];
    isLoading: boolean;
    /** Chosen but not yet uploaded, because the record does not exist yet. */
    pendingFile: File | null;
    isUploading: boolean;
    /** 0–100 while a file is in flight, else null. */
    progress: number | null;
    /** The attachment currently being deleted. */
    removingId: string | null;
    /** The control's own error (bad file, failed upload), shown under the picker. */
    error: string | null;
    /** Validates and either uploads (editing) or holds the file (creating). */
    choose: (file: File | null) => void;
    /** Drops a held file without touching anything on the server. */
    clearPending: () => void;
    remove: (id: string) => Promise<void>;
    download: (attachment: DocumentAttachment) => Promise<void>;
    /**
     * Uploads the held file against a record that has just been created.
     * Resolves with the attachment, or null when there was nothing to upload.
     * **Rejects when the upload fails** — the caller must say so rather than
     * report a clean save.
     */
    flushPending: (entityId: string) => Promise<DocumentAttachment | null>;
    /** Forgets the held file and the error (on modal close/reopen). */
    reset: () => void;
}

/** The cache key for one record's attachments — shared so an upload refreshes every reader. */
export const documentsKey = (entityType: AttachmentEntityType, entityId: string) =>
    qk.module("documents").list({ entityType, entityId });

export function useAttachmentField({
    entityType,
    entityId,
}: {
    entityType: AttachmentEntityType;
    /** The record's id; null/undefined while it is being created. */
    entityId?: string | null;
}): AttachmentFieldState {
    const enabled = commercialFeatures.documentAttachments;
    const id = entityId ?? null;
    const queryClient = useQueryClient();
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const list = useQuery({
        queryKey: documentsKey(entityType, id ?? "none"),
        queryFn: () => documentService.list(entityType, id!),
        enabled: enabled && !!id,
    });

    const upload = useMutation({
        mutationFn: ({ target, file }: { target: string; file: File }) =>
            documentService.upload(entityType, target, file, setProgress),
        onSettled: () => setProgress(null),
    });

    const invalidate = useCallback(
        (target: string) => queryClient.invalidateQueries({ queryKey: documentsKey(entityType, target) }),
        [queryClient, entityType],
    );

    const choose = useCallback(
        (file: File | null) => {
            if (!file) return;
            const problem = validateAttachmentFile(file);
            if (problem) {
                setPendingFile(null);
                setError(problem);
                toast.error(problem);
                return;
            }
            setError(null);
            if (!id) {
                // No record yet: hold it and let the page upload it after the create.
                setPendingFile(file);
                return;
            }
            setPendingFile(null);
            upload
                .mutateAsync({ target: id, file })
                .then(() => {
                    toast.success(`Attached "${file.name}"`);
                    return invalidate(id);
                })
                .catch((err: unknown) => {
                    const message = uploadFailureMessage(err, file.name);
                    setError(message);
                    toast.error(message);
                });
        },
        [id, upload, invalidate],
    );

    const flushPending = useCallback(
        async (target: string): Promise<DocumentAttachment | null> => {
            if (!enabled || !pendingFile) return null;
            const attachment = await upload.mutateAsync({ target, file: pendingFile });
            setPendingFile(null);
            await invalidate(target);
            return attachment;
        },
        [enabled, pendingFile, upload, invalidate],
    );

    const remove = useCallback(
        async (attachmentId: string) => {
            setRemovingId(attachmentId);
            try {
                await documentService.delete(attachmentId);
                if (id) await invalidate(id);
                toast.success("Attachment removed");
            } catch {
                const message = "That attachment could not be removed. It is still on the record.";
                setError(message);
                toast.error(message);
            } finally {
                setRemovingId(null);
            }
        },
        [id, invalidate],
    );

    const download = useCallback((attachment: DocumentAttachment) => downloadAttachment(attachment), []);

    const reset = useCallback(() => {
        setPendingFile(null);
        setError(null);
        setProgress(null);
    }, []);

    return useMemo(
        () => ({
            entityType,
            entityId: id,
            enabled,
            attachments: list.data ?? [],
            isLoading: list.isLoading,
            pendingFile,
            isUploading: upload.isPending,
            progress,
            removingId,
            error,
            choose,
            clearPending: () => setPendingFile(null),
            remove,
            download,
            flushPending,
            reset,
        }),
        [entityType, id, enabled, list.data, list.isLoading, pendingFile, upload.isPending,
            progress, removingId, error, choose, remove, download, flushPending, reset],
    );
}

/**
 * "The record saved but the file did not" is the one message this control must
 * never get wrong, so upload failures carry the server's own reason when it
 * gives one.
 */
export function uploadFailureMessage(error: unknown, fileName: string): string {
    const response = (error as { response?: { data?: { message?: unknown }; status?: number } } | undefined)?.response;
    const server = response?.data?.message;
    if (typeof server === "string" && server.trim()) return `"${fileName}" was not attached: ${server.trim()}`;
    if (response?.status === 404 || response?.status === 403) {
        return `"${fileName}" was not attached: file attachments are not enabled for this organisation.`;
    }
    return `"${fileName}" was not attached. Nothing was uploaded — try again.`;
}

/**
 * The create half of create-then-attach: the record has just been saved, so the
 * held file finally has something to hang off.
 *
 * Returns true when there was nothing to upload or the upload succeeded. On a
 * failure it says exactly what happened — the record *is* saved, the file is
 * *not* attached — because the alternative (a bare "Created" toast) claims an
 * attachment that does not exist. Never throws: the record is already created,
 * so the caller must not retry the save.
 */
export async function attachAfterCreate(
    state: AttachmentFieldState,
    entityId: string | undefined,
    entityLabel: string,
): Promise<boolean> {
    if (!state.pendingFile) return true;
    const fileName = state.pendingFile.name;
    if (!entityId) {
        toast.error(`The ${entityLabel} was saved, but "${fileName}" could not be attached — reopen it and attach the file.`);
        return false;
    }
    try {
        await state.flushPending(entityId);
        return true;
    } catch (error) {
        toast.error(
            `The ${entityLabel} was saved, but ${uploadFailureMessage(error, fileName)} Reopen the ${entityLabel} and attach the file again.`,
        );
        return false;
    }
}

// ── Control ──────────────────────────────────────────────────────────────────

export interface AttachmentFieldProps {
    state: AttachmentFieldState;
    /** Visible label, e.g. "Contract document". */
    label: string;
    /**
     * A URL stored before uploads existed; rendered as "Currently linked".
     * Pass the **form's** current value, not the loaded record's, so the line
     * always shows what a save would write — see `onClearLegacy`.
     */
    legacyUrl?: string | null;
    /**
     * Lets the user drop a stored link that has gone stale. The field owns the
     * value (these forms save by full replace), so this clears it in form state
     * and the next save writes the cleared value; nothing is deleted here and
     * now. Omit it where the value is not the caller's to clear.
     */
    onClearLegacy?: () => void;
    /** Extra guidance under the picker. */
    hint?: string;
    /** Hides the picker and the remove buttons (a locked or read-only record). */
    readOnly?: boolean;
    /**
     * Rendered instead of the uploader when the deployment has attachments
     * switched off — the legacy URL input, so no form loses its field.
     */
    fallback?: React.ReactNode;
    className?: string;
}

export function AttachmentField({
    state,
    label,
    legacyUrl,
    onClearLegacy,
    hint,
    readOnly = false,
    fallback,
    className,
}: AttachmentFieldProps) {
    const reactId = useId();
    const inputId = `attach-${reactId}`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

    // A file cleared elsewhere (modal reopened) must not linger in the picker.
    useEffect(() => {
        if (!state.pendingFile && inputRef.current) inputRef.current.value = "";
    }, [state.pendingFile]);

    if (!state.enabled) {
        return <>{fallback ?? null}</>;
    }

    const describedBy = [hint || state.pendingFile ? hintId : null, state.error ? errorId : null]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
        <div className={cn("space-y-2", className)}>
            <Label htmlFor={inputId} className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-muted-fg" aria-hidden />
                {label}
            </Label>

            {legacyUrl ? (
                <div className="space-y-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-fg">
                        <span>
                            Currently linked:{" "}
                            <ExternalLink href={legacyUrl} className="text-brand underline-offset-2 hover:underline" />
                        </span>
                        {onClearLegacy && !readOnly ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs text-danger"
                                title="Removes the stored link from this record. Attached files are not deleted."
                                onClick={onClearLegacy}
                            >
                                <X className="mr-1 h-3 w-3" aria-hidden /> Clear stored link
                            </Button>
                        ) : null}
                    </p>
                    {onClearLegacy && !readOnly ? (
                        <p className="text-[11px] text-faint-fg">
                            Clearing removes the link only — it does not delete any attached file, and it takes
                            effect when you save.
                        </p>
                    ) : null}
                </div>
            ) : null}

            {!readOnly && (
                <div
                    data-testid="attachment-dropzone"
                    onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        setIsDragging(false);
                        state.choose(event.dataTransfer.files?.[0] ?? null);
                    }}
                    className={cn(
                        "rounded-control border border-dashed px-3 py-3 transition-colors",
                        isDragging ? "border-brand bg-brand/5" : "border-edge bg-surface-sunken",
                        state.error && "border-danger",
                    )}
                >
                    <input
                        ref={inputRef}
                        id={inputId}
                        type="file"
                        accept={ATTACHMENT_ACCEPT}
                        disabled={state.isUploading}
                        aria-invalid={state.error ? true : undefined}
                        aria-describedby={describedBy}
                        onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            // Let the same file be picked again after a failure.
                            event.target.value = "";
                            state.choose(file);
                        }}
                        className="ea-focus block w-full cursor-pointer rounded-control text-sm text-muted-fg file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-contrast hover:file:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p id={hintId} className="mt-2 text-[11px] text-faint-fg">
                        {state.pendingFile
                            ? `"${state.pendingFile.name}" (${formatFileSize(state.pendingFile.size)}) will be attached when this is saved.`
                            : hint ?? `Drag a file here or choose one. ${ATTACHMENT_TYPES_HINT}`}
                    </p>
                    {state.pendingFile && !state.isUploading ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-7 px-2 text-xs text-danger"
                            onClick={state.clearPending}
                        >
                            <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Remove chosen file
                        </Button>
                    ) : null}
                </div>
            )}

            {state.isUploading ? (
                <div className="space-y-1" role="status" aria-live="polite">
                    <p className="flex items-center gap-2 text-xs text-brand">
                        <Spinner size="xs" />
                        Uploading{state.progress != null ? ` — ${state.progress}%` : "…"}
                    </p>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                        <div
                            data-testid="attachment-progress"
                            className="h-full rounded-full bg-brand transition-[width]"
                            style={{ width: `${state.progress ?? 10}%` }}
                        />
                    </div>
                </div>
            ) : null}

            {state.error ? (
                <p id={errorId} role="alert" className="text-sm text-danger">
                    {state.error}
                </p>
            ) : null}

            {state.entityId ? (
                state.isLoading ? (
                    <p className="flex items-center gap-2 text-xs text-faint-fg">
                        <Spinner size="xs" /> Loading attachments…
                    </p>
                ) : state.attachments.length === 0 ? (
                    <p className="text-xs text-faint-fg">No files attached yet.</p>
                ) : (
                    <ul data-testid="attachment-list" className="divide-y divide-edge-subtle rounded-control border border-edge">
                        {state.attachments.map((attachment) => (
                            <li key={attachment.id} className="flex items-start gap-2.5 px-3 py-2">
                                <span className="mt-0.5">
                                    <IconFor contentType={attachment.contentType} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-foreground" title={attachment.originalName}>
                                        {attachment.originalName}
                                    </span>
                                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-faint-fg">
                                        <span>{formatFileSize(attachment.fileSize)}</span>
                                        {attachment.uploadedByName ? <span>by {attachment.uploadedByName}</span> : null}
                                        {attachment.createdAt ? (
                                            <span>{new Date(attachment.createdAt).toLocaleDateString()}</span>
                                        ) : null}
                                    </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1">
                                    {confirmRemoveId === attachment.id ? (
                                        <>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="destructive"
                                                className="h-7 px-2 text-xs"
                                                isLoading={state.removingId === attachment.id}
                                                onClick={() => {
                                                    setConfirmRemoveId(null);
                                                    void state.remove(attachment.id);
                                                }}
                                            >
                                                Remove
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => setConfirmRemoveId(null)}
                                            >
                                                Keep
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-xs text-brand"
                                                aria-label={`Download ${attachment.originalName}`}
                                                onClick={() => void state.download(attachment)}
                                            >
                                                <Upload className="mr-1 h-3.5 w-3.5 rotate-180" aria-hidden /> Download
                                            </Button>
                                            {!readOnly && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0 text-danger"
                                                    aria-label={`Remove ${attachment.originalName}`}
                                                    onClick={() => setConfirmRemoveId(attachment.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )
            ) : null}
        </div>
    );
}
