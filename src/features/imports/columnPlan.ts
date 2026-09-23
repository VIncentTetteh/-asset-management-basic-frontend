import type {
    ColumnMapping,
    DetectedColumn,
    ImportColumnPlan,
    ImportFieldDefinition,
} from "@/services/importService";

/**
 * The per-column half of the matching step.
 *
 * The field list answers "where does *our* Asset tag come from". This answers
 * the question a migrating customer actually asks: "what happens to *my*
 * column?" — and there are three honest answers. Feed one of our fields, keep
 * it as a custom field on the records this import creates, or ignore it.
 * Before this, anything AssetIQ had no field for was dropped silently, which is
 * safe and loses exactly the columns somebody leaving a spreadsheet cares about.
 *
 * "Create as a custom field" is only ever offered when the analyser said the
 * tenant and the record type can hold one. Offering an option the API will
 * refuse is worse than not offering it.
 */

export const COLUMN_IGNORE = "__ignore__";
export const COLUMN_CUSTOM_FIELD = "__custom_field__";
/** Not selectable: the state of a column two or more fields read. */
export const COLUMN_MULTIPLE = "__multiple__";

export type ColumnChoice = string;

/** Which of our fields are currently fed by a column. */
export function fieldsUsingColumn(
    fields: readonly ImportFieldDefinition[],
    mapping: ColumnMapping,
    index: number,
): ImportFieldDefinition[] {
    return fields.filter((field) => mapping[field.name] === index);
}

/** What the column's dropdown should show as selected. */
export function columnChoice(
    fields: readonly ImportFieldDefinition[],
    mapping: ColumnMapping,
    customFieldColumns: readonly number[],
    index: number,
): ColumnChoice {
    const used = fieldsUsingColumn(fields, mapping, index);
    if (used.length > 1) return COLUMN_MULTIPLE;
    if (used.length === 1) return used[0].name;
    if (customFieldColumns.includes(index)) return COLUMN_CUSTOM_FIELD;
    return COLUMN_IGNORE;
}

export interface ColumnPlanState {
    mapping: ColumnMapping;
    customFieldColumns: number[];
}

/**
 * Applies one column's choice. A column feeds one field, or becomes a custom
 * field, or nothing — so every change first detaches the column from wherever
 * it currently is rather than leaving it in two places.
 */
export function applyColumnChoice(
    state: ColumnPlanState,
    index: number,
    choice: ColumnChoice,
): ColumnPlanState {
    if (choice === COLUMN_MULTIPLE) return state;
    const mapping: ColumnMapping = { ...state.mapping };
    for (const [field, column] of Object.entries(mapping)) {
        if (column === index) mapping[field] = null;
    }
    const customFieldColumns = state.customFieldColumns.filter((candidate) => candidate !== index);

    if (choice === COLUMN_CUSTOM_FIELD) {
        customFieldColumns.push(index);
    } else if (choice !== COLUMN_IGNORE) {
        mapping[choice] = index;
    }
    return { mapping, customFieldColumns: customFieldColumns.sort((a, b) => a - b) };
}

/**
 * Mapping a field from the field list takes that column back from the custom
 * fields: a column cannot both fill Asset tag and become a column of its own.
 */
export function applyFieldChoice(
    state: ColumnPlanState,
    fieldName: string,
    index: number | null,
): ColumnPlanState {
    return {
        mapping: { ...state.mapping, [fieldName]: index },
        customFieldColumns:
            index == null ? state.customFieldColumns : state.customFieldColumns.filter((c) => c !== index),
    };
}

/** The columns the analyser proposed keeping as custom fields, if that is allowed at all. */
export function initialCustomFieldColumns(
    columnPlan: readonly ImportColumnPlan[] | undefined,
    customFieldsAvailable: boolean,
    mapping: ColumnMapping,
): number[] {
    if (!customFieldsAvailable) return [];
    const mapped = new Set(Object.values(mapping).filter((c): c is number => typeof c === "number"));
    return (columnPlan ?? [])
        .filter((plan) => plan?.action === "CUSTOM_FIELD" && plan.canBeCustomField && !mapped.has(plan.index))
        .map((plan) => plan.index)
        .sort((a, b) => a - b);
}

/** The plan entry for a column, if the analyser sent one. */
export function planFor(
    columnPlan: readonly ImportColumnPlan[] | undefined,
    index: number,
): ImportColumnPlan | undefined {
    return (columnPlan ?? []).find((plan) => plan?.index === index);
}

/** Whether this particular column may become a custom field. */
export function canBeCustomField(
    columnPlan: readonly ImportColumnPlan[] | undefined,
    customFieldsAvailable: boolean,
    index: number,
): boolean {
    if (!customFieldsAvailable) return false;
    const plan = planFor(columnPlan, index);
    // No plan entry is not a refusal — an older analyser sends none at all, and
    // the tenant-level flag is the authority on whether the option is legal.
    return plan ? plan.canBeCustomField : true;
}

/** The name a custom field would take: the analyser's, else the user's heading. */
export function customFieldName(
    columnPlan: readonly ImportColumnPlan[] | undefined,
    column: DetectedColumn,
): string {
    const planned = planFor(columnPlan, column.index)?.customFieldName?.trim();
    return planned || column.name?.trim() || `Column ${column.index + 1}`;
}

/** The custom-field columns in a stable order, for the request body. */
export function customFieldColumnsPayload(columns: readonly number[]): number[] {
    return [...new Set(columns)].sort((a, b) => a - b);
}

/** The headings the user chose to keep, for the "this will be created" summary. */
export function customFieldNames(
    columns: readonly DetectedColumn[],
    columnPlan: readonly ImportColumnPlan[] | undefined,
    customFieldColumns: readonly number[],
): string[] {
    return customFieldColumnsPayload(customFieldColumns)
        .map((index) => columns.find((column) => column.index === index))
        .filter((column): column is DetectedColumn => Boolean(column))
        .map((column) => customFieldName(columnPlan, column));
}
