"use client";

import { useQuery } from "@tanstack/react-query";
import { importJobService, type ImportJobResponse } from "@/services/importJobService";
import { importService, type ImportTypeSummary } from "@/services/importService";
import { importJobPollMs, shouldPollImportJob } from "@/features/imports/importJob";

/**
 * Data the import wizard reads. Every one of these is scoped to an entity type
 * so the same hooks serve assets, suppliers, employees and the rest. They are
 * only ever called from inside the open wizard, which is why none of them take
 * an `enabled` flag.
 */

const key = {
    types: ["imports", "types"] as const,
    fields: (type: string) => ["imports", type, "fields"] as const,
    mappings: (type: string) => ["imports", type, "mappings"] as const,
    job: (jobId: string | null) => ["import-jobs", jobId] as const,
};

/**
 * `GET /imports/types`. Used only to enrich the local registry's label and
 * description, so a failure is not worth a toast or a blocked wizard.
 */
export function useImportTypes() {
    return useQuery<ImportTypeSummary[]>({
        queryKey: key.types,
        queryFn: () => importService.listTypes(),
        retry: false,
        staleTime: 300_000,
    });
}

/**
 * `GET /imports/{type}/fields`. The mapping step cannot be drawn without this,
 * so its error is surfaced in the step with a Retry.
 */
export function useImportFields(type: string) {
    return useQuery({
        queryKey: key.fields(type),
        queryFn: () => importService.listFields(type),
        staleTime: 300_000,
    });
}

/** `GET /imports/{type}/mappings`. Optional convenience; a failure leaves the list empty. */
export function useSavedImportMappings(type: string) {
    return useQuery({
        queryKey: key.mappings(type),
        queryFn: () => importService.listMappings(type),
        retry: false,
    });
}

export const savedMappingsQueryKey = key.mappings;

/**
 * Polls `GET /import-jobs/{jobId}` until the job reaches a terminal status.
 *
 * QUEUED is deliberately *not* terminal: an earlier version of this screen
 * stopped polling on it and every queued import looked like it had hung
 * forever. `shouldPollImportJob` treats QUEUED, PROCESSING and any status it
 * does not recognise as still running.
 */
export function useImportJobPolling(jobId: string | null, seed?: ImportJobResponse) {
    return useQuery<ImportJobResponse>({
        queryKey: key.job(jobId),
        queryFn: () => importJobService.getJobDetails(jobId as string),
        enabled: Boolean(jobId),
        initialData: jobId && seed ? seed : undefined,
        retry: false,
        gcTime: 0,
        refetchInterval: (query) =>
            shouldPollImportJob(jobId, query.state.data?.status)
                ? importJobPollMs(query.state.dataUpdateCount)
                : false,
    });
}
