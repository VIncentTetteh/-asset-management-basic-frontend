"use client";

import { useEffect, useMemo, useState } from "react";
import { BillingPlan, Subscription } from "@/types";
import { billingService } from "@/services/billingService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CheckCircle2, CreditCard, Loader2, RefreshCw, TrendingDown, TrendingUp, Undo2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { extractErrorMessage } from "@/lib/error";

const formatMoneyMinor = (amountMinor: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format((amountMinor || 0) / 100);

const isEnterprisePlan = (plan: BillingPlan) =>
    plan.code === "ENTERPRISE" || plan.tier?.toUpperCase() === "ENTERPRISE";

const isFreePlan = (plan: BillingPlan) =>
    plan.code === "FREEMIUM" || ((plan.amountMinor ?? 0) <= 0 && !isEnterprisePlan(plan));

const planRank = (plan?: BillingPlan | null) => {
    const tier = plan?.tier?.toUpperCase();
    if (tier === "FREEMIUM") return 0;
    if (tier === "BASIC") return 1;
    if (tier === "BUSINESS") return 2;
    if (tier === "ENTERPRISE") return 3;
    return plan?.amountMinor ?? 0;
};

const formatDate = (value?: string | null) => {
    if (!value) return "Not scheduled";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
};

export default function BillingPage() {
    const [plans, setPlans] = useState<BillingPlan[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkoutPlanCode, setCheckoutPlanCode] = useState("");
    const [savingAutoRenew, setSavingAutoRenew] = useState(false);

    const refresh = async () => {
        try {
            setLoading(true);
            const [plansData, subData] = await Promise.all([
                billingService.getPlans(),
                billingService.getSubscription(),
            ]);
            setPlans(plansData);
            setSubscription(subData);
        } catch (error) {
            toast.error("Failed to load billing data");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const assetUsage = useMemo(() => {
        if (!subscription?.plan?.maxAssets) return 0;
        return Math.round((subscription.currentAssetCount / subscription.plan.maxAssets) * 100);
    }, [subscription]);

    const employeeUsage = useMemo(() => {
        if (!subscription?.plan?.maxEmployees) return 0;
        return Math.round((subscription.currentEmployeeCount / subscription.plan.maxEmployees) * 100);
    }, [subscription]);

    const onUpgrade = async (planCode: string) => {
        try {
            setCheckoutPlanCode(planCode);
            const callbackUrl = `${window.location.origin}/billing/callback`;
            const checkout = await billingService.initializeCheckout({ planCode, callbackUrl });
            window.location.href = checkout.authorizationUrl;
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to initialize checkout"), { duration: 6000 });
            console.error(error);
        } finally {
            setCheckoutPlanCode("");
        }
    };

    const onToggleAutoRenew = async () => {
        if (!subscription) return;
        try {
            setSavingAutoRenew(true);
            const updated = await billingService.toggleAutoRenew(!subscription.autoRenew);
            setSubscription((prev) => (prev ? { ...prev, autoRenew: updated.autoRenew, status: updated.status } : prev));
            toast.success(
                !subscription.autoRenew
                    ? "Auto-renew enabled. Your subscription will renew automatically."
                    : "Auto-renew disabled. Your plan will downgrade to Freemium at period end."
            );
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to update auto-renew"));
            console.error(error);
        } finally {
            setSavingAutoRenew(false);
        }
    };

    const onDowngradeToFree = async () => {
        if (!subscription) return;
        if (!subscription.autoRenew) {
            toast.success("Downgrade to Freemium is already scheduled for the end of this period.");
            return;
        }
        await onToggleAutoRenew();
    };

    if (loading) {
        return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-faint-fg" /></div>;
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Billing & Subscription" subtitle="Manage plan, limits, and renewal settings for your organisation." />

            {subscription && (
                <Card>
                    <CardHeader className="border-b border-edge-subtle bg-surface-muted/80">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CreditCard className="h-4 w-4 text-brand" /> Current Subscription
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-6 md:grid-cols-3">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-faint-fg">Plan</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">{subscription.plan.name} ({subscription.plan.code})</p>
                                <span className="inline-flex items-center gap-1 rounded-full border border-ok/40 bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">
                                    <CheckCircle2 className="h-3 w-3" /> Current package
                                </span>
                            </div>
                            <p className="text-sm text-muted-fg">{formatMoneyMinor(subscription.plan.amountMinor, subscription.plan.currency)} / {subscription.plan.interval.toLowerCase()}</p>
                            <p className="text-xs text-faint-fg">Status: <span className="font-semibold text-muted-fg">{subscription.status}</span></p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-faint-fg">Usage</p>
                            <p className="text-sm text-muted-fg">Assets: {subscription.currentAssetCount} / {subscription.plan.maxAssets} ({assetUsage}%)</p>
                            <p className="text-sm text-muted-fg">Employees: {subscription.currentEmployeeCount} / {subscription.plan.maxEmployees} ({employeeUsage}%)</p>
                            <p className="text-xs text-faint-fg">
                                {subscription.autoRenew ? "Renews" : "Downgrades"} on {formatDate(subscription.currentPeriodEnd)}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-faint-fg">Subscription Controls</p>
                            <div className="flex items-center justify-between rounded-control border border-edge-subtle bg-surface-muted px-3 py-2">
                                <span className="text-sm text-muted-fg">
                                    {subscription.autoRenew ? "Auto-renew enabled" : "Auto-renew disabled"}
                                </span>
                                <input aria-label="Toggle auto-renew" type="checkbox" checked={subscription.autoRenew} onChange={onToggleAutoRenew} disabled={savingAutoRenew} className="accent-[var(--primary)]" />
                            </div>
                            <p className="text-xs text-faint-fg">
                                {subscription.autoRenew
                                    ? `Next billing: ${formatDate(subscription.nextBillingAt ?? subscription.currentPeriodEnd)}`
                                    : "Your paid package remains active until the period ends."}
                            </p>
                            {subscription.plan.amountMinor > 0 && (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={onDowngradeToFree}
                                    disabled={savingAutoRenew || !subscription.autoRenew}
                                >
                                    {savingAutoRenew ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
                                    {subscription.autoRenew ? "Downgrade to Freemium" : "Downgrade scheduled"}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((plan) => {
                    const isCurrent = subscription?.plan?.code === plan.code;
                    const isEnterprise = isEnterprisePlan(plan);
                    const isFree = isFreePlan(plan);
                    const action = subscription && planRank(plan) < planRank(subscription.plan) ? "Downgrade" : "Upgrade";
                    const canCheckout = !isCurrent && !isEnterprise && !isFree;
                    return (
                        <Card key={plan.code} className={isCurrent ? "border-ok/40 bg-ok-soft shadow-sm" : undefined}>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center justify-between text-base">
                                    <span>{plan.name}</span>
                                    <span className={`rounded-full border px-2 py-0.5 text-xs ${isCurrent ? "border-ok/40 bg-surface text-ok" : "border-edge-subtle text-muted-fg"}`}>
                                        {isCurrent ? "Purchased" : plan.tier}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-2xl font-bold text-foreground">
                                    {isEnterprise ? "Contact sales" : isFree ? "Free" : formatMoneyMinor(plan.amountMinor, plan.currency)}
                                </p>
                                <p className="-mt-2 text-xs text-faint-fg">{plan.interval.toLowerCase()}</p>
                                <div className="space-y-1 text-sm text-muted-fg">
                                    <p>Max assets: {plan.maxAssets}</p>
                                    <p>Max employees: {plan.maxEmployees}</p>
                                    <p>Analytics: {plan.analyticsEnabled ? "Included" : "Not included"}</p>
                                    <p>Audit retention: {plan.auditRetentionDays} days</p>
                                </div>
                                {isEnterprise && !isCurrent ? (
                                    <Button asChild className="w-full" variant="secondary">
                                        <a href="mailto:sales@assetiq.io?subject=Enterprise%20plan%20enquiry">Contact sales</a>
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full"
                                        variant={action === "Downgrade" ? "outline" : "default"}
                                        disabled={!canCheckout || checkoutPlanCode === plan.code}
                                        onClick={() => onUpgrade(plan.code)}
                                    >
                                        {checkoutPlanCode === plan.code ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : action === "Downgrade" ? (
                                            <TrendingDown className="mr-2 h-4 w-4" />
                                        ) : isFree ? (
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                        ) : (
                                            <TrendingUp className="mr-2 h-4 w-4" />
                                        )}
                                        {isCurrent ? "Current Package" : isFree ? "Included by default" : action}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
