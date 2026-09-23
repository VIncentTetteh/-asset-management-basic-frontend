"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { StepHeading } from "@/features/imports/WizardChrome";
import {
    IMPORT_IGNORE_VALUE,
    orderedValues,
    undecidedRowCount,
    undecidedValues,
    type EnumFieldView,
    type ValueChoices,
} from "@/features/imports/enumValues";

const UNDECIDED = "";

/**
 * "Laptop" means HARDWARE — said once, here, instead of in the user's
 * spreadsheet.
 *
 * Every distinct value the file holds for an enum-typed field gets one
 * dropdown, pre-filled with the server's suggestion where it had one and left
 * blank where it explicitly did not. Blank is a legitimate answer: the server
 * then falls back to its own alias table, and anything it still cannot read is
 * left empty and reported as a note on the check step. Nothing on this step
 * blocks the import.
 */
export function ImportValuesStep({
    views,
    choices,
    onChange,
    onBack,
    onContinue,
    isPreviewing,
}: {
    views: EnumFieldView[];
    choices: ValueChoices;
    onChange: (field: string, rawValue: string, chosen: string) => void;
    onBack: () => void;
    onContinue: () => void;
    isPreviewing: boolean;
}) {
    const ready = views.filter((view) => view.state === "ready");
    const restated = views.filter((view) => view.state === "restated");
    const unmapped = views.filter((view) => view.state === "unmapped");

    return (
        <div className="space-y-5">
            <StepHeading hint="Your words on the left, ours on the right. We have filled in the ones we recognised — change any of them, or leave a value out of the import altogether.">
                Match the values in your file
            </StepHeading>

            <div className="space-y-4" data-testid="import-value-fields">
                {ready.map((view) => (
                    <ValueFieldCard key={view.field} view={view} choices={choices} onChange={onChange} />
                ))}
            </div>

            {restated.length > 0 ? (
                <Alert
                    tone="warn"
                    live={false}
                    data-testid="import-values-restated"
                    title={`We read ${restated.length === 1 ? "this field" : "these fields"} from a different column`}
                >
                    {restated.map((view) => view.label).join(", ")} — you changed the column after we read your file, so we
                    cannot list its values here. We will match them automatically; anything we cannot read is left blank and
                    listed on the next step.
                </Alert>
            ) : null}

            {unmapped.length > 0 ? (
                <p className="rounded-card border border-edge bg-surface-muted p-3 text-xs text-muted-fg" data-testid="import-values-unmapped">
                    <span className="font-semibold text-foreground">Nothing to match for:</span>{" "}
                    {unmapped.map((view) => view.label).join(", ")} — no column in your file feeds{" "}
                    {unmapped.length === 1 ? "it" : "them"}, so {unmapped.length === 1 ? "it stays" : "they stay"} empty.
                </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-edge-subtle pt-3">
                <Button type="button" variant="outline" onClick={onBack}>
                    Back to matching
                </Button>
                <Button type="button" onClick={onContinue} isLoading={isPreviewing} data-testid="import-values-continue">
                    Check my rows
                </Button>
            </div>
        </div>
    );
}

/** One enum field: its column, and a dropdown per distinct value in that column. */
function ValueFieldCard({
    view,
    choices,
    onChange,
}: {
    view: EnumFieldView;
    choices: ValueChoices;
    onChange: (field: string, rawValue: string, chosen: string) => void;
}) {
    const blanks = undecidedValues(view, choices);
    const blankRows = undecidedRowCount(view, choices);
    const values = orderedValues(view, choices);

    return (
        <section
            aria-labelledby={`import-values-${view.field}-heading`}
            data-testid={`import-values-${view.field}`}
            className="space-y-3 rounded-card border border-edge-subtle bg-surface p-3"
        >
            <div>
                <h5 id={`import-values-${view.field}-heading`} className="text-sm font-bold text-foreground">
                    {view.label}
                </h5>
                <p className="mt-0.5 text-xs text-muted-fg">
                    {view.values.length} distinct {view.values.length === 1 ? "value" : "values"} in{" "}
                    <span className="font-semibold text-foreground">{view.header?.trim() || `column ${(view.liveColumn ?? 0) + 1}`}</span>
                    {blanks.length > 0 ? (
                        <>
                            {" · "}
                            <span data-testid={`import-values-${view.field}-undecided`} className="text-warn">
                                {blanks.length} not matched yet, affecting {blankRows} {blankRows === 1 ? "row" : "rows"} — those
                                cells will be left empty
                            </span>
                        </>
                    ) : null}
                </p>
            </div>

            <ul className="space-y-2">
                {values.map((value) => {
                    const selectId = `import-value-${view.field}-${slug(value.value)}`;
                    const chosen = choices[view.field]?.[value.value] ?? UNDECIDED;
                    return (
                        <li
                            key={value.value}
                            className="grid gap-1.5 rounded-control border border-edge-subtle bg-surface-muted p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-3"
                        >
                            <div className="min-w-0">
                                {/* The visible text is part of the accessible name, not
                                    replaced by it: a screen reader hears the whole
                                    question, everyone else reads the value it is about. */}
                                <label htmlFor={selectId} className="block text-sm font-semibold text-foreground">
                                    <span className="sr-only">What does </span>
                                    <span className="data-mono break-words">{value.value || "(blank)"}</span>
                                    <span className="sr-only"> mean for {view.label}?</span>
                                </label>
                                <p className="text-xs text-faint-fg">
                                    {value.rowCount} {value.rowCount === 1 ? "row" : "rows"}
                                    {value.exact ? " · exact match" : chosen && value.suggested === chosen ? " · our suggestion" : ""}
                                </p>
                            </div>
                            <Select
                                id={selectId}
                                data-testid={selectId}
                                className="pr-8"
                                value={chosen}
                                onChange={(event) => onChange(view.field, value.value, event.target.value)}
                            >
                                <option value={UNDECIDED}>— Leave it to us —</option>
                                {view.allowedValues.map((allowed) => (
                                    <option key={allowed} value={allowed}>
                                        {allowed}
                                    </option>
                                ))}
                                <option value={IMPORT_IGNORE_VALUE}>Ignore this value</option>
                            </Select>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/** A value turned into something usable in an id. Collisions only cost a duplicate id. */
function slug(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "blank"
    );
}
