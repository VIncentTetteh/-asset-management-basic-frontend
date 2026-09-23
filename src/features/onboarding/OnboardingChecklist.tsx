"use client";

import Link from "next/link";
import { Rocket, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { extractErrorMessage } from "@/lib/error";
import { useDismissOnboarding, useOnboarding } from "@/features/onboarding/hooks";
import { OnboardingProgress, OnboardingSteps } from "@/features/onboarding/OnboardingSteps";

/**
 * The first-run prompt, on the dashboard.
 *
 * Renders nothing in four cases, each for its own reason: while the status is
 * loading (there is nothing true to say yet), when the request failed (a
 * checklist is a nicety and a broken one must not push the dashboard down with
 * an error), when the organisation has dismissed it, and when every required
 * step is actually done.
 *
 * Dismissing hides this prompt only. The truth stays on
 * /settings/setup, which reports the same steps whether or not the prompt is
 * hidden — the API keeps `dismissed` and `complete` apart, and so does the UI.
 */
export function OnboardingChecklist() {
    const { data, isPending, isError } = useOnboarding();
    const dismiss = useDismissOnboarding();

    if (isPending || isError || !data) return null;
    if (data.dismissed || data.complete) return null;

    const onDismiss = async () => {
        try {
            await dismiss.mutateAsync();
            notify.success("Setup checklist hidden. You can still see what's outstanding in Workspace setup.");
        } catch (error) {
            // Dismissing is a write like any other: it can be refused (it takes
            // organisation-settings authority) and the user must not be left
            // thinking a prompt that is still there has gone.
            notify.error(extractErrorMessage(error, "We couldn't hide the checklist just now."));
        }
    };

    return (
        <Card data-testid="onboarding-checklist">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Rocket aria-hidden="true" className="h-4 w-4 text-brand" />
                        Finish setting up your workspace
                    </CardTitle>
                    <p className="mt-1 text-[13px] text-muted-fg">
                        A few things make everything after them work properly — reporting, audits and depreciation all
                        depend on them.
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label="Hide the setup checklist"
                    onClick={() => void onDismiss()}
                    isLoading={dismiss.isPending}
                >
                    {dismiss.isPending ? null : <X aria-hidden="true" className="h-4 w-4" />}
                </Button>
            </CardHeader>
            <CardContent className="space-y-3">
                <OnboardingProgress completed={data.completedSteps} total={data.totalSteps} />
                <OnboardingSteps steps={data.steps} />
                <p className="text-xs text-faint-fg">
                    Hiding this keeps the list in{" "}
                    <Link href="/settings/setup" className="font-medium text-brand underline underline-offset-4">
                        Workspace setup
                    </Link>
                    .
                </p>
            </CardContent>
        </Card>
    );
}
