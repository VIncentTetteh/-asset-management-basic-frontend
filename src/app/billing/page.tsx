"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import type { BillingInterval, BillingPlan, ChangePlanResponse, Subscription } from "@/types";
import { billingService } from "@/services/billingService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { extractErrorMessage } from "@/lib/error";
import { redirectTo } from "@/lib/navigation";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";
import {
    billingCallbackUrl,
    billingQueryKeys,
    formatBillingDate,
    formatMoneyMinor,
    hasAnnualPlans,
    intervalSuffix,
    isEnterprisePlan,
    isFreePlan,
    planDirection,
    planInterval,
    plansForInterval,
    usageRows,
} from "@/features/billing/lib";

const STATUS_STYLES: Record<Subscription["status"], string> = {
    ACTIVE: "border-ok/40 bg-ok-soft text-ok",
    PAST_DUE: "border-warn/40 bg-warn-soft text-warn",
    CANCELED: "border-edge-subtle bg-surface-muted text-muted-fg",
    EXPIRED: "border-danger/40 bg-danger-soft text-danger",
};

function Banner({ tone, children }: { tone: "warn" | "danger" | "info"; children: React.ReactNode }) {
    const styles = {
        warn: "border-warn/40 bg-warn-soft",
        danger: "border-danger/40 bg-danger-soft",
        info: "border-info/40 bg-info-soft",
    }[tone];
    return (
        <div role="status" className={cn("flex flex-wrap items-center gap-3 rounded-card border px-4 py-3 text-sm text-foreground", styles)}>
            {children}
        </div>
    );
}

export default function BillingPage() {
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const plansQuery = useQuery({ queryKey: billingQueryKeys.plans, queryFn: billingService.getPlans });
    const subscriptionQuery = useQuery({ queryKey: billingQueryKeys.subscription, queryFn: billingService.getSubscription });
    const subscription = subscriptionQuery.data ?? null;
    const plans = plansQuery.data ?? [];

    const [intervalChoice, setIntervalChoice] = useState<BillingInterval | null>(null);
    const interval = intervalChoice ?? planInterval(subscription?.plan);
    /** Plan code whose action is in flight. Stays set through a checkout redirect. */
    const [pendingPlanCode, setPendingPlanCode] = useState<string | null>(null);
    const [redirecting, setRedirecting] = useState(false);
    const busy = pendingPlanCode !== null || redirecting;

    const storeSubscription = (next: Subscription) => {
        queryClient.setQueryData(billingQueryKeys.subscription, next);
        void queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription });
    };

    const goToCheckout = (authorizationUrl: string) => {
        // Keep the spinner and every button disabled until the browser leaves.
        setRedirecting(true);
        redirectTo(authorizationUrl);
    };

    /** Returns true when the browser is navigating away to checkout. */
    const applyChangeResult = (result: ChangePlanResponse, target: BillingPlan): boolean => {
        if (result.action === "CHECKOUT" && result.checkout?.authorizationUrl) {
            goToCheckout(result.checkout.authorizationUrl);
            return true;
        }
        storeSubscription(result.subscription);
        if (result.action === "SCHEDULED") {
            const next = result.subscription.scheduledPlan?.name ?? target.name;
            const when = formatBillingDate(result.subscription.scheduledChangeAt ?? result.subscription.currentPeriodEnd);
            toast.success(`Your plan will switch to ${next} on ${when}. No charge today.`);
        } else if (result.action === "CHECKOUT") {
            toast.error("Checkout could not be started. Please try again.");
        } else {
            toast(`You are already on ${target.name}.`);
        }
        return false;
    };

    const changePlan = async (plan: BillingPlan) => {
        if (busy) return;
        const direction = planDirection(plan, subscription);
        if (direction === "downgrade" && subscription) {
            const ok = await confirm({
                title: `Switch to ${plan.name}?`,
                message: `You keep ${subscription.plan.name} until ${formatBillingDate(subscription.currentPeriodEnd)}, then move to ${plan.name}. Nothing is charged today.`,
                confirmLabel: `Schedule ${plan.name}`,
                variant: "warning",
            });
            if (!ok) return;
        }
        setPendingPlanCode(plan.code);
        let leaving = false;
        try {
            const result = await billingService.changePlan({ planCode: plan.code, callbackUrl: billingCallbackUrl() });
            leaving = applyChangeResult(result, plan);
        } catch (error) {
            // 409: current usage exceeds the target plan's limits — the message says which.
            toast.error(extractErrorMessage(error, "Failed to change plan"), { duration: 8000 });
        } finally {
            if (!leaving) setPendingPlanCode(null);
        }
    };

    /** Re-pay the current plan (PAST_DUE / EXPIRED). */
    const payNow = async () => {
        if (!subscription || busy) return;
        const planCode = subscription.plan.code;
        const callbackUrl = billingCallbackUrl();
        setPendingPlanCode(planCode);
        let leaving = false;
        try {
            const result = await billingService.changePlan({ planCode, callbackUrl });
            if (result.action === "CHECKOUT" && result.checkout?.authorizationUrl) {
                goToCheckout(result.checkout.authorizationUrl);
                leaving = true;
            } else {
                // Same plan → NO_CHANGE; a fresh checkout settles the outstanding period.
                const checkout = await billingService.initializeCheckout({ planCode, callbackUrl });
                goToCheckout(checkout.authorizationUrl);
                leaving = true;
            }
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to start payment"), { duration: 8000 });
        } finally {
            if (!leaving) setPendingPlanCode(null);
        }
    };

    const keepCurrentPlan = useMutation({
        mutationFn: billingService.cancelScheduledChange,
        onSuccess: (next) => {
            storeSubscription(next);
            toast.success(`You will stay on ${next.plan.name}.`);
        },
        onError: (error) => toast.error(extractErrorMessage(error, "Failed to cancel the scheduled change")),
    });

    const autoRenew = useMutation({
        mutationFn: (enabled: boolean) => billingService.toggleAutoRenew(enabled),
        onSuccess: (updated, enabled) => {
            queryClient.setQueryData<Subscription | undefined>(billingQueryKeys.subscription, (prev) =>
                prev ? { ...prev, autoRenew: updated.autoRenew, status: updated.status } : prev,
            );
            void queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription });
            toast.success(enabled ? "Subscription resumed. It will renew automatically." : "Your subscription will end at the close of this period.");
        },
        onError: (error) => toast.error(extractErrorMessage(error, "Failed to update renewal")),
    });

    const onToggleRenewal = async () => {
        if (!subscription) return;
        if (subscription.autoRenew) {
            const ok = await confirm({
                title: "Cancel at period end?",
                message: `${subscription.plan.name} stays active until ${formatBillingDate(subscription.currentPeriodEnd)} and will not renew. You can resume any time before then.`,
                confirmLabel: "Cancel at period end",
                variant: "warning",
            });
            if (!ok) return;
        }
        autoRenew.mutate(!subscription.autoRenew);
    };

    if (plansQuery.isLoading || subscriptionQuery.isLoading) {
        return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-faint-fg" /></div>;
    }

    if (plansQuery.isError || subscriptionQuery.isError) {
        return (
            <div className="space-y-6">
                <PageHeader title="Billing & Subscription" subtitle="Manage plan, limits, and renewal settings for your organisation." />
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <AlertTriangle className="h-8 w-8 text-danger" />
                        <p className="font-semibold text-foreground">Billing information could not be loaded</p>
                        <p className="text-sm text-muted-fg">
                            {extractErrorMessage(subscriptionQuery.error ?? plansQuery.error, "The billing service did not respond.")}
                        </p>
                        <Button
                            onClick={() => {
                                void plansQuery.refetch();
                                void subscriptionQuery.refetch();
                            }}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" /> Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const visiblePlans = plansForInterval(plans, interval);
    const currentIsFree = subscription ? isFreePlan(subscription.plan) : true;
    const scheduledPlan = subscription?.scheduledPlan ?? null;

    return (
        <div className="space-y-6">
            <PageHeader title="Billing & Subscription" subtitle="Manage plan, limits, and renewal settings for your organisation." />

            {subscription?.status === "PAST_DUE" && (
                <Banner tone="warn">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warn" />
                    <span className="flex-1">
                        Payment for {subscription.plan.name} is overdue
                        {subscription.pastDueSince ? ` since ${formatBillingDate(subscription.pastDueSince)}` : ""}.{" "}
                        {subscription.graceEndsAt
                            ? `Paid features stay on until ${formatBillingDate(subscription.graceEndsAt)}.`
                            : "Paid features may be switched off soon."}
                    </span>
                    <Button size="sm" onClick={payNow} disabled={busy} isLoading={pendingPlanCode === subscription.plan.code}>
                        Pay now
                    </Button>
                </Banner>
            )}
            {subscription?.status === "EXPIRED" && (
                <Banner tone="danger">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
                    <span className="flex-1">
                        Your {subscription.plan.name} subscription expired on {formatBillingDate(subscription.currentPeriodEnd)}.
                        Renew it or choose another plan to restore paid features.
                    </span>
                    {!currentIsFree && (
                        <Button size="sm" onClick={payNow} disabled={busy} isLoading={pendingPlanCode === subscription.plan.code}>
                            Renew {subscription.plan.name}
                        </Button>
                    )}
                </Banner>
            )}
            {subscription?.status === "CANCELED" && (
                <Banner tone="info">
                    <span className="flex-1">
                        Subscription canceled{subscription.canceledAt ? ` on ${formatBillingDate(subscription.canceledAt)}` : ""}.
                        {" "}Access continues until {formatBillingDate(subscription.currentPeriodEnd)}. Resume it, or choose a plan below.
                    </span>
                </Banner>
            )}
            {subscription && scheduledPlan && (
                <Banner tone="info">
                    <span className="flex-1">
                        Switches to <span className="font-semibold">{scheduledPlan.name}</span> on{" "}
                        {formatBillingDate(subscription.scheduledChangeAt ?? subscription.currentPeriodEnd)}.
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => keepCurrentPlan.mutate()}
                        disabled={keepCurrentPlan.isPending || busy}
                        isLoading={keepCurrentPlan.isPending}
                    >
                        Keep {subscription.plan.name}
                    </Button>
                </Banner>
            )}

            {subscription && (
                <Card>
                    <CardHeader className="border-b border-edge-subtle bg-surface-muted/80">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CreditCard className="h-4 w-4 text-brand" /> Current subscription
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6 p-6 md:grid-cols-3">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-faint-fg">Plan</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">{subscription.plan.name}</p>
                                <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_STYLES[subscription.status] ?? STATUS_STYLES.CANCELED)}>
                                    {subscription.status.replace("_", " ")}
                                </span>
                            </div>
                            <p className="text-sm text-muted-fg">
                                {currentIsFree ? "Free" : `${formatMoneyMinor(subscription.plan.amountMinor, subscription.plan.currency)} / ${intervalSuffix(subscription.plan)}`}
                            </p>
                            {!currentIsFree && (
                                <p className="text-xs text-faint-fg">
                                    Current period {formatBillingDate(subscription.currentPeriodStart)} – {formatBillingDate(subscription.currentPeriodEnd)}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-faint-fg">Usage</p>
                            {usageRows(subscription).map((row) => (
                                <div key={row.label} className="space-y-1">
                                    <div className="flex justify-between text-sm text-muted-fg">
                                        <span>{row.label}</span>
                                        <span className="data-mono">
                                            {row.used.toLocaleString()} / {row.limit == null ? "Unlimited" : row.limit.toLocaleString()}
                                        </span>
                                    </div>
                                    {row.percent != null && (
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${Math.min(row.percent, 100)}%`,
                                                    background: row.percent >= 100 ? "var(--danger)" : row.percent >= 80 ? "var(--warning)" : "var(--primary)",
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-faint-fg">Renewal</p>
                            {currentIsFree ? (
                                <p className="text-sm text-muted-fg">Freemium has no billing and never expires.</p>
                            ) : subscription.status === "ACTIVE" || subscription.status === "CANCELED" ? (
                                <>
                                    <p className="text-sm text-muted-fg">
                                        {subscription.autoRenew
                                            ? `Renews on ${formatBillingDate(subscription.nextBillingAt ?? subscription.currentPeriodEnd)}.`
                                            : `Ends on ${formatBillingDate(subscription.currentPeriodEnd)} — will not renew.`}
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={onToggleRenewal}
                                        disabled={autoRenew.isPending || busy}
                                        isLoading={autoRenew.isPending}
                                    >
                                        {subscription.autoRenew ? "Cancel at period end" : "Resume subscription"}
                                    </Button>
                                </>
                            ) : (
                                <p className="text-sm text-muted-fg">Renewal resumes once the subscription is active again.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {hasAnnualPlans(plans) && (
                <div role="group" aria-label="Billing interval" className="inline-flex rounded-control border border-edge bg-surface-muted p-0.5">
                    {(["MONTHLY", "ANNUALLY"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={interval === value}
                            onClick={() => setIntervalChoice(value)}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                                interval === value ? "bg-brand text-brand-contrast shadow-sm" : "text-muted-fg hover:text-foreground",
                            )}
                        >
                            {value === "MONTHLY" ? "Monthly" : "Annual"}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {visiblePlans.map((plan) => (
                    <PlanCard
                        key={plan.code}
                        plan={plan}
                        subscription={subscription}
                        scheduled={scheduledPlan?.code === plan.code}
                        pending={pendingPlanCode === plan.code}
                        disabled={busy}
                        onSelect={() => void changePlan(plan)}
                    />
                ))}
            </div>
        </div>
    );
}

function PlanCard({
    plan,
    subscription,
    scheduled,
    pending,
    disabled,
    onSelect,
}: {
    plan: BillingPlan;
    subscription: Subscription | null;
    scheduled: boolean;
    pending: boolean;
    disabled: boolean;
    onSelect: () => void;
}) {
    const enterprise = isEnterprisePlan(plan);
    const free = isFreePlan(plan);
    const direction = planDirection(plan, subscription);
    const isCurrent = direction === "current";
    const label = isCurrent
        ? "Current plan"
        : scheduled
            ? "Scheduled"
            : direction === "downgrade"
                ? free ? "Downgrade to Freemium" : "Downgrade"
                : direction === "switch"
                    ? planInterval(plan) === "ANNUALLY" ? "Switch to annual" : "Switch to monthly"
                    : "Upgrade";

    return (
        <Card className={isCurrent ? "border-ok/40 bg-ok-soft shadow-sm" : undefined}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                    <span>{plan.name}</span>
                    {isCurrent ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-ok/40 bg-surface px-2 py-0.5 text-xs text-ok">
                            <CheckCircle2 className="h-3 w-3" /> Current
                        </span>
                    ) : null}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-2xl font-bold text-foreground">
                    {enterprise ? "Contact sales" : free ? "Free" : formatMoneyMinor(plan.amountMinor, plan.currency)}
                </p>
                {!enterprise && !free && <p className="-mt-2 text-xs text-faint-fg">per {intervalSuffix(plan)}</p>}
                <div className="space-y-1 text-sm text-muted-fg">
                    <p>Max assets: {plan.maxAssets.toLocaleString()}</p>
                    <p>Max employees: {plan.maxEmployees.toLocaleString()}</p>
                    {plan.maxDepartments != null && <p>Max departments: {plan.maxDepartments.toLocaleString()}</p>}
                    <p>Analytics: {plan.analyticsEnabled ? "Included" : "Not included"}</p>
                    <p>Audit retention: {plan.auditRetentionDays} days</p>
                </div>
                {enterprise && !isCurrent ? (
                    <Button asChild className="w-full" variant="secondary">
                        <a href="mailto:sales@assetiq.io?subject=Enterprise%20plan%20enquiry">Contact sales</a>
                    </Button>
                ) : (
                    <Button
                        className="w-full"
                        variant={direction === "downgrade" ? "outline" : "default"}
                        disabled={isCurrent || scheduled || disabled}
                        onClick={onSelect}
                    >
                        {pending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : direction === "downgrade" ? (
                            <TrendingDown className="mr-2 h-4 w-4" />
                        ) : !isCurrent ? (
                            <TrendingUp className="mr-2 h-4 w-4" />
                        ) : null}
                        {label}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
