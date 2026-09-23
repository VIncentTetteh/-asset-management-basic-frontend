import api from "@/lib/axios";
import type { AxiosRequestConfig } from "axios";
import { downloadBlobResponse, extractList } from "@/services/responseUtils";
import type { ImportJobResponse } from "@/services/importJobService";

/**
 * The generic, mapping-driven importer.
 *
 * The old importer (`POST /import-jobs/assets`) accepted one fixed column
 * order, so a sheet exported from another ITAM tool could not be imported at
 * all. This API instead analyses whatever file the user has, tells us which
 * columns it found, and takes an explicit `field -> column index` mapping, so
 * the user's own headings never have to match ours.
 *
 * Every call is scoped by an entity type (`assets`, `suppliers`, …) — see
 * `src/features/imports/importTypes.ts` — so one wizard serves every module.
 */

/** An importable entity, as offered by `GET /imports/types`. */
export interface ImportTypeSummary {
    type: string;
    label: string;
    description?: string;
}

/** One of *our* fields the user can map a column onto. */
export interface ImportFieldDefinition {
    name: string;
    label: string;
    required: boolean;
    dataType?: string;
    enumValues?: string[];
    example?: string;
    notes?: string;
    /** Header spellings the backend recognises automatically, shown as a hint. */
    aliases?: string[];
}

/** A column found in the user's file. */
export interface DetectedColumn {
    index: number;
    name: string;
    sampleValues?: string[];
}

/**
 * `field name -> column index`, or `null` for "not mapped". Nulls are kept
 * (rather than dropped) so an unmapped required field is a visible gap in the
 * form rather than an absent key.
 */
export type ColumnMapping = Record<string, number | null>;

export interface ImportAnalysis {
    uploadId: string;
    detectedColumns: DetectedColumn[];
    suggestedMapping: ColumnMapping;
    rowCount: number;
    /** Columns the backend could not place. Advisory: the wizard derives its own from the live mapping. */
    unmappedColumns?: Array<number | string>;
    missingRequiredFields?: string[];
}

/** Options carried through preview and commit unchanged. */
export interface ImportOptions {
    /** Import the rows that pass and report the rest, instead of refusing the batch. */
    skipInvalidRows?: boolean;
}

export interface ImportRowError {
    /** The column as the *user* labelled it, not our field name. */
    column?: string;
    message: string;
}

export interface ImportPreviewRow {
    rowNumber: number;
    errors: ImportRowError[];
}

export interface ImportPreviewResult {
    valid: number;
    invalid: number;
    total: number;
    rows: ImportPreviewRow[];
}

export interface SavedImportMapping {
    id: string;
    name: string;
    mapping: ColumnMapping;
}

export interface ImportRunRequest {
    uploadId: string;
    mapping: ColumnMapping;
    options?: ImportOptions;
}

const multipart: AxiosRequestConfig = { headers: { "Content-Type": "multipart/form-data" } };

export const importService = {
    /** GET /imports/types — the entity types this organisation may import. */
    listTypes: async (): Promise<ImportTypeSummary[]> => {
        const response = await api.get<ImportTypeSummary[]>("/imports/types");
        return extractList<ImportTypeSummary>(response.data, ["types"]);
    },

    /** GET /imports/{type}/fields — our fields, for the mapping step. */
    listFields: async (type: string): Promise<ImportFieldDefinition[]> => {
        const response = await api.get<ImportFieldDefinition[]>(`/imports/${type}/fields`);
        return extractList<ImportFieldDefinition>(response.data, ["fields"]);
    },

    /**
     * GET /imports/{type}/template — a starter workbook with our headers.
     * Returns the filename the browser saved, taken from `Content-Disposition`.
     */
    downloadTemplate: async (type: string, format: "xlsx" | "csv"): Promise<string> => {
        const response = await api.get<Blob>(`/imports/${type}/template`, {
            params: { format },
            responseType: "blob",
        });
        return downloadBlobResponse(response, `${type}-import-template.${format}`);
    },

    /** POST /imports/{type}/analyse — read the user's headers and guess the mapping. */
    analyse: async (type: string, file: File): Promise<ImportAnalysis> => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.post<ImportAnalysis>(`/imports/${type}/analyse`, formData, multipart);
        return response.data;
    },

    /** POST /imports/{type}/preview — validate every row without writing anything. */
    preview: async (type: string, request: ImportRunRequest): Promise<ImportPreviewResult> => {
        const response = await api.post<ImportPreviewResult>(`/imports/${type}/preview`, request);
        return response.data;
    },

    /** POST /imports/{type}/commit — start the import job. Poll `GET /import-jobs/{id}`. */
    commit: async (type: string, request: ImportRunRequest): Promise<ImportJobResponse> => {
        const response = await api.post<ImportJobResponse>(`/imports/${type}/commit`, request);
        return response.data;
    },

    /** GET /imports/{type}/mappings — mappings this organisation saved earlier. */
    listMappings: async (type: string): Promise<SavedImportMapping[]> => {
        const response = await api.get<SavedImportMapping[]>(`/imports/${type}/mappings`);
        return extractList<SavedImportMapping>(response.data, ["mappings"]);
    },

    /** POST /imports/{type}/mappings — save the current mapping under a name. */
    saveMapping: async (type: string, name: string, mapping: ColumnMapping): Promise<SavedImportMapping> => {
        const response = await api.post<SavedImportMapping>(`/imports/${type}/mappings`, { name, mapping });
        return response.data;
    },

    /** DELETE /imports/{type}/mappings/{id} */
    deleteMapping: async (type: string, id: string): Promise<void> => {
        await api.delete(`/imports/${type}/mappings/${id}`);
    },
};
