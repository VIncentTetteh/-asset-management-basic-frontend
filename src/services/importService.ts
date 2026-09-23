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

/** One distinct value found in an enum-typed column, and the server's reading of it. */
export interface ImportValueSuggestion {
    /** The cell exactly as it appears in the user's file. */
    value: string;
    /**
     * The constant the server thinks it means, or `null` for "we do not know".
     * Explicitly null rather than absent — the wizard leaves the dropdown blank
     * instead of guessing, which is the difference between asking the user and
     * quietly importing the wrong thing.
     */
    suggested: string | null;
    /** True when the raw value *is* one of the allowed constants, punctuation aside. */
    exact: boolean;
    /** How many rows carry this value — what a choice here affects. */
    rowCount: number;
}

/** An enum-typed field, its allowed constants, and what the file actually says. */
export interface ImportEnumField {
    field: string;
    label: string;
    /** The column feeding it at analysis time, or `null` when nothing does. */
    column: number | null;
    header?: string | null;
    allowedValues: string[];
    values: ImportValueSuggestion[];
}

/** What may happen to one of the user's columns. */
export type ImportColumnAction = "FIELD" | "CUSTOM_FIELD" | "IGNORE";

/** The backend's proposal for one column of the file. Every part of it is a default. */
export interface ImportColumnPlan {
    index: number;
    header?: string | null;
    action: ImportColumnAction;
    field?: string | null;
    customFieldName?: string | null;
    inferredType?: string | null;
    canBeCustomField: boolean;
}

export interface ImportAnalysis {
    uploadId: string;
    detectedColumns: DetectedColumn[];
    suggestedMapping: ColumnMapping;
    rowCount: number;
    /** Columns the backend could not place. Advisory: the wizard derives its own from the live mapping. */
    unmappedColumns?: Array<number | string>;
    missingRequiredFields?: string[];
    truncated?: boolean;
    expiresAt?: string;
    /** Per enum-typed field: the constants we accept and the values their file holds. */
    enumFields?: ImportEnumField[];
    /** What the backend proposes for each column. */
    columnPlan?: ImportColumnPlan[];
    /** False when this type or this tenant cannot hold a custom field at all. */
    customFieldsAvailable?: boolean;
    /** Why, in words the wizard can show, when `customFieldsAvailable` is false. */
    customFieldsUnavailableReason?: string;
    /** What "create missing categories, departments…" should start as. */
    createMissingReferencesDefault?: boolean;
}

/** The sentinel a value dropdown sends for "do not import this value". */
export const IMPORT_IGNORE_VALUE = "__IGNORE__";

/**
 * Options carried through preview and commit unchanged — that identity is why
 * the check step and the import cannot disagree.
 */
export interface ImportOptions {
    /** SKIP, UPDATE or FAIL. Omitted leaves the server's default (SKIP). */
    duplicateStrategy?: string;
    /** Create categories, departments, locations and suppliers the sheet names. Defaults to true. */
    createMissingReferences?: boolean;
    /** Import the rows that pass and report the rest, instead of refusing the batch. */
    skipInvalidRows?: boolean;
    /** Validate and report without writing anything. */
    dryRun?: boolean;
    /** 0-based columns to keep as custom fields rather than ignore. */
    customFieldColumns?: number[];
    /**
     * What the user decided each unfamiliar value means, e.g.
     * `{ assetType: { Laptop: "HARDWARE", Sundry: "__IGNORE__" } }`. Inner keys
     * are the raw cell values as they appear in the file; the server matches
     * them case- and punctuation-insensitively.
     */
    valueMappings?: Record<string, Record<string, string>>;
}

/** What a run — real or dry — should be reported as. Never inferred client-side. */
export type ImportOutcome = "SUCCESS" | "PARTIAL" | "FAILED" | "NOTHING_TO_IMPORT";

/**
 * One thing that happened to one row. An *error* means the row does not import;
 * a *note* means it does, with something left out or created for it.
 */
export interface ImportRowIssue {
    /** 1-based row in the user's file. The backend guarantees it is never 0. */
    row: number;
    message: string;
    /** Our internal field name, for pointing back at the mapping row. */
    field?: string | null;
    /** The heading as the *user* wrote it, so they can find the cell. */
    column?: string | null;
    /** The offending cell, for a note. */
    value?: string | null;
}

export interface ImportPreviewTotals {
    valid: number;
    invalid: number;
    total: number;
}

/**
 * A dry run of the real engine. Its job is to agree with the commit, so the
 * wizard renders it verbatim and never re-derives a verdict from the counts.
 */
export interface ImportPreviewResult {
    totals: ImportPreviewTotals;
    errors: ImportRowIssue[];
    notes: ImportRowIssue[];
    rowsChecked: number;
    totalRowsInFile: number;
    outcome: ImportOutcome;
    /** A problem with the file or the mapping rather than with any row. */
    fatalError?: string | null;
    /** Records a real run would create on the user's behalf, by type. */
    wouldCreate?: Record<string, string[]>;
    /** Custom field definitions a real run would create from column headers. */
    wouldCreateCustomFields?: string[];
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
