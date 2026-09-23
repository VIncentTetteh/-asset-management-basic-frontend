"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { extractErrorMessage } from "@/lib/error";
import { reportApiError } from "@/lib/api-validation";
import type { ImportJobResponse } from "@/services/importJobService";
import {
    importService,
    type ColumnMapping,
    type ImportAnalysis,
    type ImportFieldDefinition,
    type ImportPreviewResult,
    type SavedImportMapping,
} from "@/services/importService";
import { importEntityType, mergeImportType } from "@/features/imports/importTypes";
import { useImportFields, useImportJobPolling, useImportTypes, useSavedImportMappings, savedMappingsQueryKey } from "@/features/imports/hooks";
import { applySavedMapping, initialMapping, mappingPayload, normaliseAnalysis } from "@/features/imports/mapping";
import { importJobPhase } from "@/features/imports/importJob";
import { StepError, StepRail, type ImportStep } from "@/features/imports/WizardChrome";
import { ImportStartStep } from "@/features/imports/ImportStartStep";
import { ImportUploadStep } from "@/features/imports/ImportUploadStep";
import { ImportMapStep } from "@/features/imports/ImportMapStep";
import { ImportPreviewStep } from "@/features/imports/ImportPreviewStep";
import { ImportRunStep } from "@/features/imports/ImportRunStep";

/** Stable empty list, so the derived mapping is not recomputed on every render. */
const EMPTY_FIELDS: ImportFieldDefinition[] = [];

interface ImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    /** Entity type, e.g. `assets`. See `IMPORT_ENTITY_TYPES`. */
    type: string;
    /** Called once the server reports a completed job, for callers that want to react. */
    onImported?: () => void;
}

/**
 * One import wizard for every module.
 *
 * Driven entirely by `type` (`assets`, `suppliers`, `employees`, …): the fields
 * to map, the template, the analyser and the commit endpoint are all scoped to
 * it, so adding a module is a registry entry in `importTypes.ts` plus an entry
 * point — never another copy of this screen.
 *
 * Steps: explain → upload → map columns → check → import. Each step owns one
 * decision, and nothing is written to the organisation until the user has seen
 * the check results and pressed Import.
 *
 * Mounts only while it is open, so every open starts from step one
 * with no file, mapping or finished job left over from last time — state that
 * an effect would otherwise have to clear on the way in.
 */
export function ImportWizardModal(props: ImportWizardProps) {
    if (!props.isOpen) return null;
    return <ImportWizardBody {...props} />;
}

function ImportWizardBody({ onClose, type, onImported }: ImportWizardProps) {
    const queryClient = useQueryClient();
    const [step, setStep] = useState<ImportStep>("start");
    const [file, setFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
    // `null` means "nothing edited yet": the mapping shown is then the one
    // derived from the analyser's suggestion, which needs both this response
    // and the fields list and so cannot be set when either one lands.
    const [editedMapping, setEditedMapping] = useState<ColumnMapping | null>(null);
    const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
    const [skipInvalidRows, setSkipInvalidRows] = useState(false);
    const [job, setJob] = useState<ImportJobResponse | null>(null);
    const [downloadingFormat, setDownloadingFormat] = useState<"xlsx" | "csv" | null>(null);
    const settledJobRef = useRef<string | null>(null);

    const typesQuery = useImportTypes(true);
    const fieldsQuery = useImportFields(type, true);
    const mappingsQuery = useSavedImportMappings(type, true);
    const fields = useMemo(() => fieldsQuery.data ?? EMPTY_FIELDS, [fieldsQuery.data]);
    const entity = mergeImportType(type, typesQuery.data?.find((candidate) => candidate.type === type));

    const reset = useCallback(() => {
        setStep("start");
        setFile(null);
        setAnalysis(null);
        setEditedMapping(null);
        setPreview(null);
        setSkipInvalidRows(false);
        setJob(null);
        settledJobRef.current = null;
    }, []);

    // The mapping needs both halves — our fields and their columns — and they
    // arrive from two different requests, in either order, so it is derived
    // rather than stored until the user changes something.
    const mapping = useMemo<ColumnMapping | null>(() => {
        if (editedMapping) return editedMapping;
        if (!analysis || fields.length === 0) return null;
        return initialMapping(fields, analysis.suggestedMapping, analysis.detectedColumns);
    }, [editedMapping, analysis, fields]);

    const templateMutation = useMutation({
        mutationFn: (format: "xlsx" | "csv") => importService.downloadTemplate(type, format),
        onMutate: (format) => setDownloadingFormat(format),
        onSuccess: (filename) => toast.success(`Saved ${filename}`),
        onError: (error) => toast.error(extractErrorMessage(error, "Could not download the template")),
        onSettled: () => setDownloadingFormat(null),
    });

    const analyseMutation = useMutation({
        mutationFn: (chosen: File) => importService.analyse(type, chosen),
        onSuccess: (result) => {
            setAnalysis(normaliseAnalysis(result));
            setEditedMapping(null);
            setPreview(null);
            setStep("map");
        },
        onError: (error) => toast.error(extractErrorMessage(error, "We could not read that file")),
    });

    const previewMutation = useMutation({
        mutationFn: () =>
            importService.preview(type, {
                uploadId: analysis?.uploadId as string,
                mapping: mappingPayload(mapping ?? {}),
                options: { skipInvalidRows },
            }),
        onSuccess: (result) => {
            setPreview(result);
            setStep("preview");
        },
        onError: (error) => reportApiError(error, { fallback: "We could not check those rows" }),
    });

    const commitMutation = useMutation({
        mutationFn: () =>
            importService.commit(type, {
                uploadId: analysis?.uploadId as string,
                mapping: mappingPayload(mapping ?? {}),
                options: { skipInvalidRows },
            }),
        onSuccess: (response) => {
            settledJobRef.current = null;
            setJob({ ...response, status: response.status ?? (response.result ? "COMPLETED" : "QUEUED") });
            setStep("import");
        },
        onError: (error) => reportApiError(error, { fallback: "The import could not be started" }),
    });

    const saveMappingMutation = useMutation({
        mutationFn: (name: string) => importService.saveMapping(type, name, mapping ?? {}),
        onSuccess: (saved) => {
            toast.success(`Saved "${saved.name}" — it will be offered next time`);
            void queryClient.invalidateQueries({ queryKey: savedMappingsQueryKey(type) });
        },
        onError: (error) => reportApiError(error, { fallback: "Could not save that mapping" }),
    });

    const jobId = job?.jobId ?? null;
    const jobQuery = useImportJobPolling(jobId, job ?? undefined);
    const liveJob = jobQuery.data ?? job ?? undefined;
    const phase = importJobPhase(liveJob?.status);

    // One toast (and one invalidation) per job, when the *server* says it is done.
    useEffect(() => {
        if (step !== "import" || phase === "running") return;
        const key = jobId ?? "inline";
        if (settledJobRef.current === key) return;
        settledJobRef.current = key;
        if (phase === "completed") {
            toast.success(`Imported ${liveJob?.result?.imported ?? 0} ${entity.plural}`);
            void queryClient.invalidateQueries({ queryKey: entity.queryKey });
            onImported?.();
        } else if (phase === "cancelled") {
            toast.error("The import was cancelled before it finished");
        } else {
            toast.error("The import failed. The rows it could not take are listed below.");
        }
    }, [step, phase, jobId, liveJob, entity, queryClient, onImported]);

    const applySaved = (saved: SavedImportMapping) => {
        if (!analysis) return;
        setEditedMapping(applySavedMapping(fields, saved.mapping ?? {}, analysis.detectedColumns));
        toast.success(`Applied "${saved.name}"`);
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="wide"
            title={`Import ${entity.plural}`}
            description="Bring a spreadsheet in from any system — your column names and their order do not have to match ours."
        >
            <div className="space-y-5">
                <StepRail current={step} />

                {step === "start" ? (
                    <ImportStartStep
                        plural={entity.plural}
                        description={entity.description}
                        downloadingFormat={downloadingFormat}
                        onDownloadTemplate={(format) => templateMutation.mutate(format)}
                        onContinue={() => setStep("upload")}
                    />
                ) : null}

                {step === "upload" ? (
                    <ImportUploadStep
                        file={file}
                        onFileChosen={setFile}
                        onBack={() => setStep("start")}
                        isAnalysing={analyseMutation.isPending}
                        analyseError={
                            analyseMutation.isError
                                ? extractErrorMessage(analyseMutation.error, "We could not read that file")
                                : null
                        }
                        onAnalyse={() => {
                            if (file) analyseMutation.mutate(file);
                        }}
                    />
                ) : null}

                {step === "map" ? (
                    <MapStepGate
                        isLoading={fieldsQuery.isLoading || (Boolean(analysis) && !mapping)}
                        error={
                            fieldsQuery.isError
                                ? extractErrorMessage(fieldsQuery.error, `We could not load the ${entity.plural} fields`)
                                : null
                        }
                        onRetry={() => void fieldsQuery.refetch()}
                    >
                        {analysis && mapping ? (
                            <ImportMapStep
                                fields={fields}
                                columns={analysis.detectedColumns}
                                mapping={mapping}
                                rowCount={analysis.rowCount}
                                fileName={file?.name ?? "your file"}
                                onChange={(fieldName, columnIndex) =>
                                    setEditedMapping({ ...mapping, [fieldName]: columnIndex })
                                }
                                savedMappings={mappingsQuery.data ?? []}
                                onApplySaved={applySaved}
                                onSaveMapping={(name) => saveMappingMutation.mutate(name)}
                                isSavingMapping={saveMappingMutation.isPending}
                                onBack={() => setStep("upload")}
                                onContinue={() => previewMutation.mutate()}
                                isPreviewing={previewMutation.isPending}
                            />
                        ) : null}
                    </MapStepGate>
                ) : null}

                {step === "preview" && preview ? (
                    <ImportPreviewStep
                        preview={preview}
                        plural={entity.plural}
                        skipInvalidRows={skipInvalidRows}
                        onSkipInvalidRowsChange={setSkipInvalidRows}
                        onBack={() => setStep("map")}
                        onCommit={() => commitMutation.mutate()}
                        isCommitting={commitMutation.isPending}
                    />
                ) : null}

                {step === "import" ? (
                    <ImportRunStep
                        job={liveJob}
                        jobError={
                            jobQuery.isError
                                ? extractErrorMessage(
                                      jobQuery.error,
                                      "We lost track of the import job. Refresh the list to see what was imported.",
                                  )
                                : null
                        }
                        plural={entity.plural}
                        type={type}
                        preview={preview}
                        onClose={onClose}
                        onStartOver={reset}
                    />
                ) : null}
            </div>
        </Modal>
    );
}

/** Keeps the mapping step honest while its two requests are in flight. */
function MapStepGate({
    isLoading,
    error,
    onRetry,
    children,
}: {
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
    children: React.ReactNode;
}) {
    if (error) return <StepError message={error} onRetry={onRetry} />;
    if (isLoading) {
        return (
            <div className="flex justify-center py-10" role="status" aria-live="polite">
                <Spinner />
                <span className="sr-only">Reading your columns…</span>
            </div>
        );
    }
    return <>{children}</>;
}

/** Convenience for callers that only know a route, not a type. */
export const importWizardEntity = importEntityType;
