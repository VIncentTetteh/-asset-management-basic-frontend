"use client";

import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DataErrorState } from "@/components/patterns/DataErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { notify } from "@/lib/notify";
import { extractErrorMessage } from "@/lib/error";
import { useDismissOnboarding, useOnboarding, useRestoreOnboarding } from "@/features/onboarding/hooks";
import { OnboardingProgress, OnboardingSteps } from "@/features/onboarding/OnboardingSteps";

/**
 * Workspace setup, as a settings page.
 *
 * The dashboard prompt disappears when it is dismissed or when everything is
 * done. This page does neither: `dismissed` and `complete` are independent
 * facts on the API and putting the prompt away must not make the outstanding
 * work unfindable. So the same steps are reported here, whatever their state,
 * with the prompt's visibility as an ordinary setting.
 */
export default function WorkspaceSetupPage() {
    const { data, isPending, error, refetch, isFetching } = useOnboarding();
    const dismiss = useDismissOnboarding();
    const restore = useRestoreOnboarding();

    const toggle = async () => {
        const hiding = !data?.dismissed;
        try {
            await (hiding ? dismiss.mutateAsync() : restore.mutateAsync());
            notify.success(hiding ? "The dashboard prompt is hidden." : "The dashboard prompt is back.");
        } catch (err) {
            notify.error(extractErrorMessage(err, "We couldn't change that just now."));
        }
    };

    return (
        <div className="page-enter space-y-4">
            <PageHeader
                title="Workspace setup"
                subtitle="What your organisation still needs, whether or not the dashboard prompt is showing."
            />

            {error ? (
                <DataErrorState what="your setup checklist" error={error} onRetry={refetch} isRetrying={isFetching} />
            ) : isPending || !data ? (
                <Card>
                    <CardContent className="space-y-3 p-5">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-24 w-full" />
                    </CardContent>
                </Card>
            ) : (
                <>
                    {data.complete ? (
                        <Alert tone="ok" title="Your workspace is set up" live={false}>
                            Every required step is done. Anything below marked optional is exactly that.
                        </Alert>
                    ) : null}

                    <Card>
                        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    {data.complete ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-ok" /> : null}
                                    Setup checklist
                                </CardTitle>
                                <p className="mt-1 text-[13px] text-muted-fg">
                                    Each step is checked against what is actually in your workspace, every time this page loads.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 self-start"
                                onClick={() => void toggle()}
                                isLoading={dismiss.isPending || restore.isPending}
                            >
                                {data.dismissed ? (
                                    <><Eye aria-hidden="true" className="mr-2 h-3.5 w-3.5" /> Show on the dashboard</>
                                ) : (
                                    <><EyeOff aria-hidden="true" className="mr-2 h-3.5 w-3.5" /> Hide from the dashboard</>
                                )}
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <OnboardingProgress completed={data.completedSteps} total={data.totalSteps} />
                            <OnboardingSteps steps={data.steps} />
                            {data.dismissed ? (
                                <p className="text-xs text-faint-fg">
                                    The dashboard prompt is hidden for everyone in this organisation. What is outstanding is
                                    still outstanding — hiding it changed nothing except where it is shown.
                                </p>
                            ) : null}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
