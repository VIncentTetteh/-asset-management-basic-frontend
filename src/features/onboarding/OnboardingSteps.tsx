"use client";

import Link from "next/link";
import { Check, Circle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { authService } from "@/services/authService";
import { getStoredUser } from "@/lib/authContext";
import { extractErrorMessage } from "@/lib/error";
import { useMutation } from "@tanstack/react-query";
import { STEP_ROUTES } from "@/features/onboarding/hooks";
import type { OnboardingStep } from "@/types/onboarding";

/**
 * One step, rendered from what the API said and nothing else.
 *
 * `done` is never inferred — not from a count, not from a mutation that just
 * succeeded elsewhere, not from the fact that the user visited the page. If the
 * server says a step is outstanding, it is shown as outstanding.
 */
function StepRow({ step }: { step: OnboardingStep }) {
    const route = STEP_ROUTES[step.key];

    const resend = useMutation({
        mutationFn: () => {
            const email = getStoredUser()?.email;
            if (typeof email !== "string" || !email) throw new Error("We don't have your email address to hand. Sign in again and try from here.");
            return authService.resendVerification({ email });
        },
        onSuccess: (result) => {
            // The API answers identically whether or not anything was sent, on
            // purpose. Claiming "email sent!" would be inventing a fact.
            notify.info(result?.message || "If that address needs verification, a new link is on its way.");
        },
        onError: (error) => notify.error(extractErrorMessage(error, "We couldn't request a new verification link.")),
    });

    return (
        // Wraps rather than stacking: a column at phone width put the tick on a
        // line of its own above the title, so the one glyph that says whether a
        // step is done stopped reading as part of the step. Seen at 400px.
        <li className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3">
            <span className="mt-0.5 shrink-0" aria-hidden="true">
                {step.done ? (
                    <Check className="h-4 w-4 text-ok" />
                ) : (
                    <Circle className="h-4 w-4 text-faint-fg" />
                )}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                    {step.title}
                    <span className="sr-only">{step.done ? " — done" : " — still to do"}</span>
                    {step.optional ? <span className="ml-2 text-xs font-normal text-faint-fg">Optional</span> : null}
                </p>
                <p className="text-[13px] text-muted-fg">{step.description}</p>
                {step.done && step.count > 0 && step.scope === "ORGANISATION" ? (
                    <p className="mt-0.5 text-xs text-faint-fg">
                        {step.count} {step.resource.replace(/_/g, " ")}
                    </p>
                ) : null}
            </div>
            {step.done ? null : route || step.key === "verify_email" ? (
                // Full width below sm so it wraps onto its own line instead of
                // squeezing the step text into a four-word column at 400px, and
                // indented to line up with that text when it does.
                <div className="ml-7 w-full shrink-0 sm:ml-0 sm:w-auto">
                    {route ? (
                        <Button asChild size="sm" variant="outline">
                            <Link href={route.href}>{route.cta}</Link>
                        </Button>
                    ) : (
                        <Button size="sm" variant="outline" onClick={() => resend.mutate()} isLoading={resend.isPending}>
                            <Mail aria-hidden="true" className="mr-2 h-3.5 w-3.5" /> Send a new link
                        </Button>
                    )}
                </div>
            ) : null}
        </li>
    );
}

/** The checklist itself, shared by the dashboard prompt and the settings page. */
export function OnboardingSteps({ steps }: { steps: OnboardingStep[] }) {
    return (
        <ul className="divide-y divide-edge-subtle">
            {steps.map((step) => (
                <StepRow key={step.key} step={step} />
            ))}
        </ul>
    );
}

/** "3 of 5 done" plus a bar. Both read from the API's own counts. */
export function OnboardingProgress({ completed, total }: { completed: number; total: number }) {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-fg">
                <span>{completed} of {total} done</span>
                <span>{percent}%</span>
            </div>
            <div
                role="progressbar"
                aria-valuenow={completed}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label="Workspace setup progress"
                className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
            >
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}
