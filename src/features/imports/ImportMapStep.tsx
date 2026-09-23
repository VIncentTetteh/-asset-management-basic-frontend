"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import type {
    ColumnMapping,
    DetectedColumn,
    ImportColumnPlan,
    ImportFieldDefinition,
    SavedImportMapping,
} from "@/services/importService";
import {
    columnFor,
    describeColumn,
    duplicatedColumns,
    missingRequiredFields,
    sampleValues,
} from "@/features/imports/mapping";
import {
    COLUMN_CUSTOM_FIELD,
    COLUMN_IGNORE,
    COLUMN_MULTIPLE,
    canBeCustomField,
    columnChoice,
    customFieldName,
    fieldsUsingColumn,
} from "@/features/imports/columnPlan";
import { StepHeading } from "@/features/imports/WizardChrome";

const NOT_MAPPED = "";

/**
 * The step that makes a foreign spreadsheet importable: our fields on the
 * left, their columns in a dropdown on the right, pre-filled with whatever the
 * analyser guessed and showing a sample from their file next to each choice so
 * "Ref 2" and "Ref 3" can be told apart without opening Excel.
 */
export function ImportMapStep({
    fields,
    columns,
    mapping,
    rowCount,
    fileName,
    onChange,
    savedMappings,
    onApplySaved,
    onSaveMapping,
    isSavingMapping,
    onBack,
    onContinue,
    isPreviewing,
    continueLabel,
    columnPlan,
    customFieldsAvailable,
    customFieldsUnavailableReason,
    customFieldColumns,
    onColumnChoice,
}: {
    fields: ImportFieldDefinition[];
    columns: DetectedColumn[];
    mapping: ColumnMapping;
    rowCount: number;
    fileName: string;
    onChange: (fieldName: string, columnIndex: number | null) => void;
    savedMappings: SavedImportMapping[];
    onApplySaved: (saved: SavedImportMapping) => void;
    onSaveMapping: (name: string) => void;
    isSavingMapping: boolean;
    onBack: () => void;
    onContinue: () => void;
    isPreviewing: boolean;
    /** "Check my rows", or "Match values" when a value step stands between. */
    continueLabel: string;
    columnPlan: ImportColumnPlan[] | undefined;
    customFieldsAvailable: boolean;
    customFieldsUnavailableReason: string | undefined;
    customFieldColumns: number[];
    onColumnChoice: (index: number, choice: string) => void;
}) {
    const [attempted, setAttempted] = useState(false);
    const [mappingName, setMappingName] = useState("");
    const selectRefs = useRef<Record<string, HTMLSelectElement | null>>({});

    const missing = missingRequiredFields(fields, mapping);
    const duplicates = duplicatedColumns(fields, mapping, columns);

    const handleContinue = () => {
        setAttempted(true);
        if (missing.length > 0) {
            toast.error(
                `Tell us which column holds ${missing.length === 1 ? "this field" : "these fields"}:\n${missing
                    .map((field) => field.label)
                    .join("\n")}`,
            );
            selectRefs.current[missing[0].name]?.focus();
            return;
        }
        onContinue();
    };

    const handleSaveMapping = () => {
        const name = mappingName.trim();
        if (!name) {
            toast.error("Give this mapping a name before saving it");
            return;
        }
        onSaveMapping(name);
        setMappingName("");
    };

    return (
        <div className="space-y-5">
            <StepHeading
                hint={`We read ${columns.length} ${columns.length === 1 ? "column" : "columns"} and ${rowCount} ${
                    rowCount === 1 ? "row" : "rows"
                } from ${fileName}. Tell us what each of our fields should be filled from.`}
            >
                Match your columns to our fields
            </StepHeading>

            {savedMappings.length > 0 ? (
                <div className="space-y-1.5">
                    <Label htmlFor="import-saved-mapping">Reuse a saved mapping</Label>
                    <Select
                        id="import-saved-mapping"
                        data-testid="import-saved-mapping"
                        defaultValue=""
                        onChange={(event) => {
                            const saved = savedMappings.find((m) => m.id === event.target.value);
                            if (saved) onApplySaved(saved);
                        }}
                    >
                        <option value="">Choose a saved mapping…</option>
                        {savedMappings.map((saved) => (
                            <option key={saved.id} value={saved.id}>
                                {saved.name}
                            </option>
                        ))}
                    </Select>
                </div>
            ) : null}

            {missing.length > 0 ? (
                <div
                    role="alert"
                    data-testid="import-missing-required"
                    className="flex gap-2 rounded-card border border-danger/40 bg-danger-soft p-3 text-sm"
                >
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                    <div>
                        <p className="font-semibold text-danger">
                            {missing.length} required {missing.length === 1 ? "field has" : "fields have"} no column yet
                        </p>
                        <p className="mt-1 text-foreground">
                            {missing.map((field) => field.label).join(", ")} — the import cannot run until each one points at a
                            column in your file.
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="space-y-3" data-testid="import-field-list">
                {fields.map((field) => (
                    <MappingRow
                        key={field.name}
                        field={field}
                        columns={columns}
                        mapping={mapping}
                        attempted={attempted}
                        onChange={onChange}
                        registerRef={(element) => {
                            selectRefs.current[field.name] = element;
                        }}
                    />
                ))}
            </div>

            {duplicates.length > 0 ? (
                <p role="status" className="rounded-card border border-warn/40 bg-warn-soft p-3 text-xs text-foreground">
                    {duplicates
                        .map((entry) => `"${entry.column.name}" fills ${entry.fields.map((f) => f.label).join(" and ")}`)
                        .join("; ")}
                    . That is allowed — check it is what you meant.
                </p>
            ) : null}

            <ColumnPlanList
                fields={fields}
                columns={columns}
                mapping={mapping}
                columnPlan={columnPlan}
                customFieldsAvailable={customFieldsAvailable}
                customFieldsUnavailableReason={customFieldsUnavailableReason}
                customFieldColumns={customFieldColumns}
                onColumnChoice={onColumnChoice}
            />

            <div className="space-y-1.5 border-t border-edge-subtle pt-3">
                <Label htmlFor="import-mapping-name">Save this mapping for next time (optional)</Label>
                <div className="flex flex-wrap gap-2">
                    <Input
                        id="import-mapping-name"
                        data-testid="import-mapping-name"
                        className="max-w-xs"
                        placeholder="e.g. ServiceNow export"
                        value={mappingName}
                        onChange={(event) => setMappingName(event.target.value)}
                        maxLength={100}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleSaveMapping}
                        isLoading={isSavingMapping}
                        data-testid="import-save-mapping"
                    >
                        {isSavingMapping ? null : <Save aria-hidden="true" className="mr-2 h-4 w-4" />}
                        Save mapping
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-edge-subtle pt-3">
                <Button type="button" variant="outline" onClick={onBack}>
                    Back
                </Button>
                <Button type="button" onClick={handleContinue} isLoading={isPreviewing} data-testid="import-to-preview">
                    {continueLabel}
                </Button>
            </div>
        </div>
    );
}

/** One of our fields and the column that fills it. */
function MappingRow({
    field,
    columns,
    mapping,
    attempted,
    onChange,
    registerRef,
}: {
    field: ImportFieldDefinition;
    columns: DetectedColumn[];
    mapping: ColumnMapping;
    attempted: boolean;
    onChange: (fieldName: string, columnIndex: number | null) => void;
    registerRef: (element: HTMLSelectElement | null) => void;
}) {
    const selectId = `import-map-${field.name}`;
    const hintId = `${selectId}-hint`;
    const errorId = `${selectId}-error`;
    const value = mapping[field.name];
    const isMissing = field.required && value == null;
    const chosen = columnFor(columns, mapping, field.name);
    const samples = sampleValues(chosen);
    const hint = [field.notes, field.example ? `Example: ${field.example}` : null].filter(Boolean).join(" · ");

    return (
        <div className="grid gap-2 rounded-card border border-edge-subtle bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-start">
            <div>
                <Label htmlFor={selectId}>
                    {field.label}
                    {field.required ? (
                        <span className="ml-1 text-danger" aria-hidden="true">
                            *
                        </span>
                    ) : null}
                    {field.required ? <span className="sr-only"> (required)</span> : null}
                </Label>
                {hint ? (
                    <p id={hintId} className="mt-1 text-xs text-faint-fg">
                        {hint}
                    </p>
                ) : null}
            </div>
            <div className="space-y-1">
                <Select
                    id={selectId}
                    ref={registerRef}
                    data-testid={selectId}
                    value={value == null ? NOT_MAPPED : String(value)}
                    aria-invalid={isMissing ? true : undefined}
                    aria-describedby={[hint ? hintId : null, isMissing ? errorId : null].filter(Boolean).join(" ") || undefined}
                    onChange={(event) => onChange(field.name, event.target.value === NOT_MAPPED ? null : Number(event.target.value))}
                >
                    <option value={NOT_MAPPED}>{field.required ? "— Choose a column —" : "— Not imported —"}</option>
                    {columns.map((column) => (
                        <option key={column.index} value={String(column.index)}>
                            {describeColumn(column)}
                        </option>
                    ))}
                </Select>
                {isMissing ? (
                    <FieldError
                        id={errorId}
                        error={{
                            message: attempted
                                ? `${field.label} is required — choose the column in your file that holds it`
                                : `${field.label} is required`,
                        }}
                        className="text-xs"
                    />
                ) : samples.length > 0 ? (
                    <p className="text-xs text-muted-fg">
                        From your file: <span className="data-mono">{samples.join(", ")}</span>
                    </p>
                ) : null}
            </div>
        </div>
    );
}

/**
 * The other half of matching: what happens to each of *their* columns.
 *
 * Three honest answers — fill one of our fields, become a custom field, or be
 * ignored — and the third used to be the only one, applied silently. "Create as
 * a custom field" appears only when the analyser said this tenant and this
 * record type can hold one; where it cannot, the reason is shown once instead
 * of an option that would be refused.
 */
function ColumnPlanList({
    fields,
    columns,
    mapping,
    columnPlan,
    customFieldsAvailable,
    customFieldsUnavailableReason,
    customFieldColumns,
    onColumnChoice,
}: {
    fields: ImportFieldDefinition[];
    columns: DetectedColumn[];
    mapping: ColumnMapping;
    columnPlan: ImportColumnPlan[] | undefined;
    customFieldsAvailable: boolean;
    customFieldsUnavailableReason: string | undefined;
    customFieldColumns: number[];
    onColumnChoice: (index: number, choice: string) => void;
}) {
    const kept = customFieldColumns.length;
    const ignoredCount = columns.filter(
        (column) =>
            fieldsUsingColumn(fields, mapping, column.index).length === 0 && !customFieldColumns.includes(column.index),
    ).length;

    return (
        <section aria-labelledby="import-column-plan-heading" className="space-y-3" data-testid="import-column-plan">
            <div>
                <h5 id="import-column-plan-heading" className="text-sm font-bold text-foreground">
                    What happens to each of your columns
                </h5>
                <p className="mt-0.5 text-xs text-muted-fg" data-testid="import-column-plan-summary">
                    {kept > 0 ? `${kept} kept as custom ${kept === 1 ? "field" : "fields"} · ` : ""}
                    {ignoredCount} of {columns.length} {columns.length === 1 ? "column" : "columns"}{" "}
                    {ignoredCount === 1 ? "is" : "are"} being ignored.
                </p>
            </div>

            {!customFieldsAvailable && customFieldsUnavailableReason ? (
                <p className="text-xs text-muted-fg" data-testid="import-custom-fields-unavailable">
                    {customFieldsUnavailableReason}
                </p>
            ) : null}

            <ul className="space-y-2">
                {columns.map((column) => {
                    const selectId = `import-column-${column.index}`;
                    const choice = columnChoice(fields, mapping, customFieldColumns, column.index);
                    const allowCustom = canBeCustomField(columnPlan, customFieldsAvailable, column.index);
                    const heading = column.name?.trim() || `Column ${column.index + 1}`;
                    const samples = sampleValues(column, 2);
                    const used = fieldsUsingColumn(fields, mapping, column.index);

                    return (
                        <li
                            key={column.index}
                            className="grid gap-1.5 rounded-control border border-edge-subtle bg-surface p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-3"
                        >
                            <div className="min-w-0">
                                <label htmlFor={selectId} className="block text-sm font-semibold text-foreground">
                                    <span className="sr-only">What should we do with your column </span>
                                    <span className="break-words">{heading}</span>
                                    <span className="sr-only">?</span>
                                </label>
                                {samples.length > 0 ? (
                                    <p className="truncate text-xs text-faint-fg">
                                        <span className="data-mono">{samples.join(", ")}</span>
                                    </p>
                                ) : null}
                            </div>
                            <Select
                                id={selectId}
                                data-testid={selectId}
                                className="pr-8"
                                value={choice}
                                onChange={(event) => onColumnChoice(column.index, event.target.value)}
                            >
                                {choice === COLUMN_MULTIPLE ? (
                                    <option value={COLUMN_MULTIPLE}>
                                        Fills {used.map((field) => field.label).join(" and ")}
                                    </option>
                                ) : null}
                                <option value={COLUMN_IGNORE}>Ignore this column</option>
                                {allowCustom ? (
                                    <option value={COLUMN_CUSTOM_FIELD}>Create as a custom field</option>
                                ) : null}
                                <optgroup label="Fill one of our fields">
                                    {fields.map((field) => (
                                        <option key={field.name} value={field.name}>
                                            {field.label}
                                            {field.required ? " (required)" : ""}
                                        </option>
                                    ))}
                                </optgroup>
                            </Select>
                        </li>
                    );
                })}
            </ul>

            {kept > 0 ? (
                <Alert
                    tone="info"
                    live={false}
                    data-testid="import-custom-fields-planned"
                    title={`${kept} new custom ${kept === 1 ? "field" : "fields"} will be created in your organisation`}
                >
                    {columns
                        .filter((column) => customFieldColumns.includes(column.index))
                        .map((column) => customFieldName(columnPlan, column))
                        .join(", ")}
                    . You will see this again before anything is written.
                </Alert>
            ) : null}
        </section>
    );
}
