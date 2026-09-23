import type {
    ColumnMapping,
    DetectedColumn,
    ImportAnalysis,
    ImportFieldDefinition,
} from "@/services/importService";

/**
 * The mapping step's rules, kept out of the component so they can be reasoned
 * about (and tested) on their own: which of our fields a column feeds, which
 * required fields are still empty, and which of the user's columns nothing
 * reads.
 */

/**
 * The mapping the wizard opens with: the backend's suggestion for every field
 * it could place, `null` for the rest.
 *
 * A suggestion pointing at a column the file does not have is dropped rather
 * than trusted — a stale saved mapping applied to a different sheet would
 * otherwise silently import the wrong column.
 */
export function initialMapping(
    fields: ImportFieldDefinition[],
    suggested: ColumnMapping | undefined,
    columns: DetectedColumn[],
): ColumnMapping {
    const valid = new Set(columns.map((c) => c.index));
    const mapping: ColumnMapping = {};
    for (const field of fields) {
        const candidate = suggested?.[field.name];
        mapping[field.name] = typeof candidate === "number" && valid.has(candidate) ? candidate : null;
    }
    return mapping;
}

/** The same rules applied to a saved mapping the user picked from the list. */
export function applySavedMapping(
    fields: ImportFieldDefinition[],
    saved: ColumnMapping,
    columns: DetectedColumn[],
): ColumnMapping {
    return initialMapping(fields, saved, columns);
}

/** Required fields with no column behind them. These block the preview step. */
export function missingRequiredFields(
    fields: ImportFieldDefinition[],
    mapping: ColumnMapping,
): ImportFieldDefinition[] {
    return fields.filter((field) => field.required && mapping[field.name] == null);
}

/**
 * Columns feeding more than one field. Legitimate occasionally (one column
 * used as both name and description), so it warns rather than blocks.
 */
export function duplicatedColumns(
    fields: ImportFieldDefinition[],
    mapping: ColumnMapping,
    columns: DetectedColumn[],
): { column: DetectedColumn; fields: ImportFieldDefinition[] }[] {
    const byIndex = new Map<number, ImportFieldDefinition[]>();
    for (const field of fields) {
        const index = mapping[field.name];
        if (typeof index !== "number") continue;
        byIndex.set(index, [...(byIndex.get(index) ?? []), field]);
    }
    return columns
        .filter((column) => (byIndex.get(column.index)?.length ?? 0) > 1)
        .map((column) => ({ column, fields: byIndex.get(column.index) as ImportFieldDefinition[] }));
}

/**
 * The mapping sent to preview and commit: only the fields the user actually
 * mapped, so the backend is never asked to read column `null`.
 */
export function mappingPayload(mapping: ColumnMapping): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [field, index] of Object.entries(mapping)) {
        if (typeof index === "number") out[field] = index;
    }
    return out;
}

/** A column's heading with its first sample value, e.g. `Asset Name — "Latitude 5540"`. */
export function describeColumn(column: DetectedColumn): string {
    const sample = column.sampleValues?.find((value) => value != null && String(value).trim() !== "");
    const heading = column.name?.trim() || `Column ${column.index + 1}`;
    return sample ? `${heading} — e.g. ${String(sample).trim()}` : heading;
}

/** Up to `limit` non-empty samples, for the hint under a mapped field. */
export function sampleValues(column: DetectedColumn | undefined, limit = 3): string[] {
    if (!column?.sampleValues) return [];
    return column.sampleValues
        .filter((value) => value != null && String(value).trim() !== "")
        .slice(0, limit)
        .map((value) => String(value).trim());
}

/** The column a field is mapped to, if any. */
export function columnFor(
    columns: DetectedColumn[],
    mapping: ColumnMapping,
    fieldName: string,
): DetectedColumn | undefined {
    const index = mapping[fieldName];
    return typeof index === "number" ? columns.find((c) => c.index === index) : undefined;
}

/**
 * Normalises an analysis response. The wizard treats a missing/odd
 * `detectedColumns` or `suggestedMapping` as "nothing detected" rather than
 * throwing inside render.
 */
export function normaliseAnalysis(analysis: ImportAnalysis): ImportAnalysis {
    return {
        ...analysis,
        detectedColumns: Array.isArray(analysis.detectedColumns) ? analysis.detectedColumns : [],
        suggestedMapping:
            analysis.suggestedMapping && typeof analysis.suggestedMapping === "object"
                ? analysis.suggestedMapping
                : {},
        rowCount: Number.isFinite(analysis.rowCount) ? analysis.rowCount : 0,
    };
}
