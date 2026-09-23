import {
    IMPORT_IGNORE_VALUE,
    type ColumnMapping,
    type ImportEnumField,
    type ImportValueSuggestion,
} from "@/services/importService";

/**
 * The value-matching step's rules.
 *
 * A file that says `Asset type = "Laptop"` used to fail the row with a list of
 * six constants and no way to say that Laptop means HARDWARE. The user was sent
 * back to Excel to rewrite their own data. These helpers turn the analyser's
 * `enumFields` into one decision per distinct value, made once, in AssetIQ.
 *
 * Two rules the rest of the step is built on:
 *   - a `suggested` of `null` is *not* a guess to be filled in. It is left
 *     blank and the user decides, because a wrong silent translation is worse
 *     than a blank field;
 *   - nothing here is required. An undecided value is sent as nothing at all,
 *     and the server falls back to its own alias table and then to leaving the
 *     field blank with a note — which the check step then shows.
 */

export { IMPORT_IGNORE_VALUE };

/** `field -> raw value -> chosen constant (or `__IGNORE__`, or "" for undecided)`. */
export type ValueChoices = Record<string, Record<string, string>>;

/**
 * How a given enum field stands relative to the mapping now on screen.
 *
 * `restated` is the awkward one: `enumFields` is computed when the file is
 * analysed, from the mapping suggested at that moment. If the user then points
 * the field at a *different* column, the distinct values we were given belong
 * to a column that no longer feeds it, and offering them would be a lie. We say
 * so instead of guessing, and let the check step report whatever the server
 * makes of the new column.
 */
export type EnumFieldState = "ready" | "restated" | "unmapped";

export interface EnumFieldView extends ImportEnumField {
    state: EnumFieldState;
    /** The column feeding this field right now, per the live mapping. */
    liveColumn: number | null;
}

/** The enum fields to render, each tagged with how the live mapping leaves it. */
export function enumFieldViews(
    enumFields: readonly ImportEnumField[] | undefined,
    mapping: ColumnMapping,
): EnumFieldView[] {
    return (enumFields ?? []).filter(Boolean).map((enumField) => {
        const live = mapping[enumField.field];
        const liveColumn = typeof live === "number" ? live : null;
        const values = Array.isArray(enumField.values) ? enumField.values : [];
        let state: EnumFieldState = "unmapped";
        if (liveColumn != null) {
            state = liveColumn === enumField.column && values.length > 0 ? "ready" : "restated";
        }
        return { ...enumField, values, allowedValues: enumField.allowedValues ?? [], state, liveColumn };
    });
}

/** True when at least one field has values the user can actually decide about. */
export function hasValuesToMap(views: readonly EnumFieldView[]): boolean {
    return views.some((view) => view.state === "ready");
}

/**
 * The step's starting state: the server's suggestion where it has one, blank
 * where it explicitly does not.
 */
export function initialValueChoices(views: readonly EnumFieldView[]): ValueChoices {
    const choices: ValueChoices = {};
    for (const view of views) {
        if (view.state !== "ready") continue;
        const forField: Record<string, string> = {};
        for (const value of view.values) {
            forField[value.value] = value.suggested ?? "";
        }
        choices[view.field] = forField;
    }
    return choices;
}

/**
 * The `valueMappings` sent to preview and commit.
 *
 * Only decided values for fields still fed by the column they were read from:
 * an empty choice is "we did not say", which is not the same as `__IGNORE__`,
 * and a field whose column changed has no trustworthy values to send.
 */
export function valueMappingsPayload(
    views: readonly EnumFieldView[],
    choices: ValueChoices,
): Record<string, Record<string, string>> {
    const payload: Record<string, Record<string, string>> = {};
    for (const view of views) {
        if (view.state !== "ready") continue;
        const decided: Record<string, string> = {};
        for (const value of view.values) {
            const chosen = choices[view.field]?.[value.value];
            if (chosen) decided[value.value] = chosen;
        }
        if (Object.keys(decided).length > 0) payload[view.field] = decided;
    }
    return payload;
}

/** Values still undecided for a field — the count shown beside its heading. */
export function undecidedValues(view: EnumFieldView, choices: ValueChoices): ImportValueSuggestion[] {
    if (view.state !== "ready") return [];
    return view.values.filter((value) => !choices[view.field]?.[value.value]);
}

/** Rows affected by the undecided values of a field. What "blank" will cost. */
export function undecidedRowCount(view: EnumFieldView, choices: ValueChoices): number {
    return undecidedValues(view, choices).reduce((total, value) => total + (value.rowCount || 0), 0);
}

/**
 * Values ordered so the ones worth attention come first: undecided, then the
 * ones the server was unsure about, then by how many rows they touch.
 */
export function orderedValues(view: EnumFieldView, choices: ValueChoices): ImportValueSuggestion[] {
    const weight = (value: ImportValueSuggestion) => {
        if (!choices[view.field]?.[value.value]) return 0;
        if (!value.exact) return 1;
        return 2;
    };
    return [...view.values].sort((a, b) => weight(a) - weight(b) || (b.rowCount || 0) - (a.rowCount || 0));
}
