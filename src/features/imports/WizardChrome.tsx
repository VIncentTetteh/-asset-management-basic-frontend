"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared furniture for the import wizard's steps: the progress rail and the
 * step heading.
 *
 * The heading is focusable and takes focus whenever a step mounts. Without
 * that, moving between steps leaves a keyboard or screen-reader user's focus
 * on a button that no longer exists, and the next Tab restarts at the top of
 * the document.
 */

export const IMPORT_STEPS = ["start", "upload", "map", "values", "preview", "import"] as const;
export type ImportStep = (typeof IMPORT_STEPS)[number];

const STEP_LABELS: Record<ImportStep, string> = {
    start: "Start",
    upload: "Upload",
    map: "Match columns",
    values: "Match values",
    preview: "Check",
    import: "Import",
};

export function StepRail({ current }: { current: ImportStep }) {
    const currentIndex = IMPORT_STEPS.indexOf(current);
    return (
        <nav aria-label="Import progress">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.06em]">
                {IMPORT_STEPS.map((step, index) => {
                    const state = index === currentIndex ? "current" : index < currentIndex ? "done" : "todo";
                    return (
                        <li key={step} className="flex items-center gap-2">
                            <span
                                data-testid={`import-step-${step}`}
                                data-state={state}
                                aria-current={state === "current" ? "step" : undefined}
                                className={cn(
                                    "rounded-control px-2 py-1",
                                    state === "current" && "bg-brand text-brand-contrast",
                                    state === "done" && "bg-ok-soft text-ok",
                                    state === "todo" && "text-faint-fg",
                                )}
                            >
                                <span className="sr-only">
                                    {state === "current" ? "Current step: " : state === "done" ? "Completed step: " : "Upcoming step: "}
                                </span>
                                {index + 1}. {STEP_LABELS[step]}
                            </span>
                            {index < IMPORT_STEPS.length - 1 ? (
                                <span aria-hidden="true" className="text-faint-fg">
                                    ›
                                </span>
                            ) : null}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

/** The step's title. Takes focus on mount so each step announces itself. */
export function StepHeading({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
    const ref = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        ref.current?.focus();
    }, []);
    return (
        <div className="space-y-1">
            <h4 ref={ref} tabIndex={-1} className="ea-focus text-base font-bold text-foreground outline-none">
                {children}
            </h4>
            {hint ? <p className="text-sm text-muted-fg">{hint}</p> : null}
        </div>
    );
}

/** A failure the user has to see, with a way back if one exists. */
export function StepError({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div role="alert" className="space-y-2 rounded-card border border-danger/40 bg-danger-soft p-3 text-sm text-foreground">
            <p>{message}</p>
            {onRetry ? (
                <button type="button" onClick={onRetry} className="ea-focus rounded-sm font-semibold text-danger underline">
                    Try again
                </button>
            ) : null}
        </div>
    );
}
