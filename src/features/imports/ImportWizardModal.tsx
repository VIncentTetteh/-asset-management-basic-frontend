"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { extractErrorMessage } from "@/lib/error";
import { reportApiError } from "@/lib/api-validation";
import { notify } from "@/lib/notify";
import type { ImportJobResponse } from "@/services/importJobService";
import {
    importService,
    type ImportAnalysis,
    type ImportFieldDefinition,
    type ImportOptions,
    type SavedImportMapping,
} from "@/services/importService";
import { mergeImportType } from "@/features/imports/importTypes";
import {
    useImportFields,
    useImportJobPolling,
    useImportTypes,
    useSavedImportMappings,
    savedMappingsQueryKey,
} from "@/features/imports/hooks";
import { applySavedMapping, initialMapping, mappingPayload, normaliseAnalysis } from "@/features/imports/mapping";
import {
    applyColumnChoice,
    applyFieldChoice,
    customFieldColumnsPayload,
    customFieldNames,
    initialCustomFieldColumns,
    type ColumnPlanState,
} from "@/features/imports/columnPlan";
import {
    enumFieldViews,
    hasValuesToMap,
    initialValueChoices,
    valueMappingsPayload,
    type ValueChoices,
} from "@/features/imports/enumValues";
import { importJobPhase } from "@/features/imports/importJob";
import { importVerdict, normalisePreview, type PreviewView } from "@/features/imports/outcome";
import { StepError, StepRail, type ImportStep } from "@/features/imports/WizardChrome";
import { ImportStartStep } from "@/features/imports/ImportStartStep";
import { ImportUploadStep } from "@/features/imports/ImportUploadStep";
import { ImportMapStep } from "@/features/imports/ImportMapStep";
import { ImportValuesStep } from "@/features/imports/ImportValuesStep";
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

/** What the user has changed about a value dropdown. Presence, not truthiness, is the edit. */
type ValueEdits = Record<string, Record<string, string>>;

/** The server's suggestions with the user's decisions laid over them. */
function mergedChoices(base: ValueChoices, edits: ValueEdits): ValueChoices {
    const merged: ValueChoices = {};
    for (const [field, values] of Object.entries(base)) {
        merged[field] = { ...values };
        for (const [raw, chosen] of Object.entries(edits[field] ?? {})) {
            merged[field][raw] = chosen;
        }
    }
    return merged;
}

/**
 * One import wizard for every module.
 *
 * Driven entirely by `type` (`assets`, `suppliers`, `employees`, …): the fields
 * to map, the template, the analyser and the commit endpoint are all scoped to
 * it, so adding a module is a registry entry in `importTypes.ts` plus an entry
 * point — never another copy of this screen.
 *
 * Steps: explain → upload → match columns → match values → check → import. The
 * value step is skipped when the file has no enum values to decide about.
 *
 * The rule that holds the last three steps together: **preview and commit are
 * sent the identical body.** Every option lives here, in one place, and
 * changing one on the check step re-runs the check. A check that describes a
 * different run than the one about to happen is how this wizard once said
 * "every row passed" and then failed the import on an enum value.
 *
 * Mounts only while it is open, so every open starts from step one with no
 * file, mapping or finished job left over from last time.
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
    // `null` means "nothing edited yet": the plan shown is then the one derived
    // from the analyser's suggestion, which needs both this response and the
    // fields list and so cannot be set when either one lands.
    const [editedPlan, setEditedPlan] = useState<ColumnPlanState | null>(null);
    const [valueEdits, setValueEdits] = useState<ValueEdits>({});
    const [preview, setPreview] = useState<PreviewView | null>(null);
    const [skipInvalidRows, setSkipInvalidRows] = useState(false);
    const [editedCreateMissing, setEditedCreateMissing] = useState<boolean | null>(null);
    const [job, setJob] = useState<ImportJobResponse | null>(null);
    const [downloadingFormat, setDownloadingFormat] = useState<"xlsx" | "csv" | null>(null);
    const settledJobRef = useRef<string | null>(null);

    const typesQuery = useImportTypes();
    const fieldsQuery = useImportFields(type);
    const mappingsQuery = useSavedImportMappings(type);
    const fields = useMemo(() => fieldsQuery.data ?? EMPTY_FIELDS, [fieldsQuery.data]);
    const entity = mergeImportType(type, typesQuery.data?.find((candidate) => candidate.type === type));

    // An analyser that says nothing about custom fields is taken to mean "no".
    // Offering an option the API will refuse is worse than not offering it.
    const customFieldsAvailable = analysis?.customFieldsAvailable === true;

    const reset = useCallback(() => {
        setStep("start");
        setFile(null);
        setAnalysis(null);
        setEditedPlan(null);
        setValueEdits({});
        setPreview(null);
        setSkipInvalidRows(false);
        setEditedCreateMissing(null);
        setJob(null);
        settledJobRef.current = null;
    }, []);

    // The plan needs both halves — our fields and their columns — and they
    // arrive from two different requests, in either order, so it is derived
    // rather than stored until the user changes something.
    const plan = useMemo<ColumnPlanState | null>(() => {
        if (editedPlan) return editedPlan;
        if (!analysis || fields.length === 0) return null;
        const mapping = initialMapping(fields, analysis.suggestedMapping, analysis.detectedColumns);
        return {
            mapping,
            customFieldColumns: initialCustomFieldColumns(analysis.columnPlan, customFieldsAvailable, mapping),
        };
    }, [editedPlan, analysis, fields, customFieldsAvailable]);

    const enumViews = useMemo(
        () => enumFieldViews(analysis?.enumFields, plan?.mapping ?? {}),
        [analysis?.enumFields, plan?.mapping],
    );
    const choices = useMemo(
        () => mergedChoices(initialValueChoices(enumViews), valueEdits),
        [enumViews, valueEdits],
    );
    const needsValueStep = hasValuesToMap(enumViews);
    const createMissingReferences = editedCreateMissing ?? analysis?.createMissingReferencesDefault ?? true;

    /**
     * The body both preview and commit are sent. One function, called by both,
     * is the whole reason the check and the import cannot disagree.
     */
    const runOptions = useCallback(
        (overrides?: Partial<Pick<ImportOptions, "skipInvalidRows" | "createMissingReferences">>): ImportOptions => ({
            skipInvalidRows,
            createMissingReferences,
            customFieldColumns: customFieldColumnsPayload(plan?.customFieldColumns ?? []),
            valueMappings: valueMappingsPayload(enumViews, choices),
            ...overrides,
        }),
        [skipInvalidRows, createMissingReferences, plan?.customFieldColumns, enumViews, choices],
    );

    const templateMutation = useMutation({
        mutationFn: (format: "xlsx" | "csv") => importService.downloadTemplate(type, format),
        onMutate: (format) => setDownloadingFormat(format),
        onSuccess: (filename) => notify.success(`Saved ${filename}`),
        onError: (error) => notify.error(extractErrorMessage(error, "Could not download the template")),
        onSettled: () => setDownloadingFormat(null),
    });

    const analyseMutation = useMutation({
        mutationFn: (chosen: File) => importService.analyse(type, chosen),
        onSuccess: (result) => {
            setAnalysis(normaliseAnalysis(result));
            setEditedPlan(null);
            setValueEdits({});
            setPreview(null);
            setEditedCreateMissing(null);
            setStep("map");
        },
        onError: (error) => notify.error(extractErrorMessage(error, "We could not read that file")),
    });

    const previewMutation = useMutation({
        mutationFn: (overrides?: Partial<Pick<ImportOptions, "skipInvalidRows" | "createMissingReferences">>) =>
            importService.preview(type, {
                uploadId: analysis?.uploadId as string,
                mapping: mappingPayload(plan?.mapping ?? {}),
                options: runOptions(overrides),
            }),
        onSuccess: (result) => {
            setPreview(normalisePreview(result));
            setStep("preview");
        },
        onError: (error) => reportApiError(error, { fallback: "We could not check those rows" }),
    });

    const commitMutation = useMutation({
        mutationFn: () =>
            importService.commit(type, {
                uploadId: analysis?.uploadId as string,
                mapping: mappingPayload(plan?.mapping ?? {}),
                options: runOptions(),
            }),
        onSuccess: (response) => {
            settledJobRef.current = null;
            setJob({ ...response, status: response.status ?? (response.result ? "COMPLETED" : "QUEUED") });
            setStep("import");
        },
        onError: (error) => reportApiError(error, { fallback: "The import could not be started" }),
    });

    const saveMappingMutation = useMutation({
        mutationFn: (name: string) => importService.saveMapping(type, name, plan?.mapping ?? {}),
        onSuccess: (saved) => {
            notify.success(`Saved "${saved.name}" — it will be offered next time`);
            void queryClient.invalidateQueries({ queryKey: savedMappingsQueryKey(type) });
        },
        onError: (error) => reportApiError(error, { fallback: "Could not save that mapping" }),
    });

    const jobId = job?.jobId ?? null;
    const jobQuery = useImportJobPolling(jobId, job ?? undefined);
    const liveJob = jobQuery.data ?? job ?? undefined;
    const phase = importJobPhase(liveJob?.status);
    const verdict = importVerdict(phase, liveJob?.result);

    // One announcement (and one invalidation) per job, when the *server* says
    // it is done — and the announcement is the server's verdict, not ours. A
    // run that wrote nothing has never been a success, however green the tick.
    useEffect(() => {
        if (step !== "import" || phase === "running") return;
        const key = jobId ?? "inline";
        if (settledJobRef.current === key) return;
        settledJobRef.current = key;

        const result = liveJob?.result;
        const written = (result?.imported ?? 0) + (result?.updated ?? 0);
        if (verdict === "SUCCESS") {
            notify.success(`Imported ${written} ${entity.plural}`);
        } else if (verdict === "PARTIAL") {
            notify.info(`Imported ${written} ${entity.plural}. ${result?.skipped ?? 0} rows were not imported.`);
        } else if (verdict === "NOTHING_TO_IMPORT") {
            notify.error("Nothing was imported — the server found no rows to read in that file.");
        } else if (verdict === "CANCELLED") {
            notify.error("The import was cancelled before it finished");
        } else {
            notify.error("Nothing was imported. The rows the server refused are listed below.");
        }
        if (verdict === "SUCCESS" || verdict === "PARTIAL") {
            void queryClient.invalidateQueries({ queryKey: entity.queryKey });
            onImported?.();
        }
    }, [step, phase, verdict, jobId, liveJob, entity, queryClient, onImported]);

    const applySaved = (saved: SavedImportMapping) => {
        if (!analysis || !plan) return;
        const mapping = applySavedMapping(fields, saved.mapping ?? {}, analysis.detectedColumns);
        const mapped = new Set(Object.values(mapping).filter((c): c is number => typeof c === "number"));
        setEditedPlan({
            mapping,
            customFieldColumns: plan.customFieldColumns.filter((column) => !mapped.has(column)),
        });
        notify.success(`Applied "${saved.name}"`);
    };

    /** Both option toggles re-run the check, so what is on screen is the run about to happen. */
    const recheck = (overrides: Partial<Pick<ImportOptions, "skipInvalidRows" | "createMissingReferences">>) => {
        previewMutation.mutate(overrides);
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="wide"
            title={`Import ${entity.plural}`}
            description="Bring a spreadsheet in from any system — your column names, their order and the words inside them do not have to match ours."
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
                        isLoading={fieldsQuery.isLoading || (Boolean(analysis) && !plan)}
                        error={
                            fieldsQuery.isError
                                ? extractErrorMessage(fieldsQuery.error, `We could not load the ${entity.plural} fields`)
                                : null
                        }
                        onRetry={() => void fieldsQuery.refetch()}
                    >
                        {analysis && plan ? (
                            <ImportMapStep
                                fields={fields}
                                columns={analysis.detectedColumns}
                                mapping={plan.mapping}
                                rowCount={analysis.rowCount}
                                fileName={file?.name ?? "your file"}
                                onChange={(fieldName, columnIndex) =>
                                    setEditedPlan(applyFieldChoice(plan, fieldName, columnIndex))
                                }
                                columnPlan={analysis.columnPlan}
                                customFieldsAvailable={customFieldsAvailable}
                                customFieldsUnavailableReason={analysis.customFieldsUnavailableReason}
                                customFieldColumns={plan.customFieldColumns}
                                onColumnChoice={(index, choice) => setEditedPlan(applyColumnChoice(plan, index, choice))}
                                savedMappings={mappingsQuery.data ?? []}
                                onApplySaved={applySaved}
                                onSaveMapping={(name) => saveMappingMutation.mutate(name)}
                                isSavingMapping={saveMappingMutation.isPending}
                                onBack={() => setStep("upload")}
                                onContinue={() => (needsValueStep ? setStep("values") : previewMutation.mutate(undefined))}
                                isPreviewing={previewMutation.isPending}
                                continueLabel={needsValueStep ? "Match my values" : "Check my rows"}
                            />
                        ) : null}
                    </MapStepGate>
                ) : null}

                {step === "values" ? (
                    <ImportValuesStep
                        views={enumViews}
                        choices={choices}
                        onChange={(field, rawValue, chosen) =>
                            setValueEdits((current) => ({
                                ...current,
                                [field]: { ...(current[field] ?? {}), [rawValue]: chosen },
                            }))
                        }
                        onBack={() => setStep("map")}
                        onContinue={() => previewMutation.mutate(undefined)}
                        isPreviewing={previewMutation.isPending}
                    />
                ) : null}

                {step === "preview" && preview ? (
                    <ImportPreviewStep
                        preview={preview}
                        plural={entity.plural}
                        skipInvalidRows={skipInvalidRows}
                        onSkipInvalidRowsChange={(value) => {
                            setSkipInvalidRows(value);
                            recheck({ skipInvalidRows: value });
                        }}
                        createMissingReferences={createMissingReferences}
                        onCreateMissingReferencesChange={(value) => {
                            setEditedCreateMissing(value);
                            recheck({ createMissingReferences: value });
                        }}
                        plannedCustomFields={customFieldNames(
                            analysis?.detectedColumns ?? [],
                            analysis?.columnPlan,
                            plan?.customFieldColumns ?? [],
                        )}
                        isRechecking={previewMutation.isPending}
                        onBack={() => setStep(needsValueStep ? "values" : "map")}
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
