"use client";

import { useEffect, useMemo, useState } from "react";
import { BillingPlan, Subscription } from "@/types";
import { billingService } from "@/services/billingService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2, CreditCard, TrendingUp } from "lucide-react";
import { toast } from "react-hot-toast";

const formatMoneyMinor = (amountMinor: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format((amountMinor || 0) / 100);

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
            toast.error("Failed to initialize checkout");
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
            toast.success("Auto-renew preference updated");
        } catch (error) {
            toast.error("Failed to update auto-renew");
            console.error(error);
        } finally {
            setSavingAutoRenew(false);
        }
    };

    if (loading) {
        return <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Billing & Subscription" subtitle="Manage plan, limits, and renewal settings for your organisation." />

            {subscription && (
                <Card className="border-slate-200">
                    <CardHeader className="border-b bg-slate-50/80">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CreditCard className="h-4 w-4 text-teal-700" /> Current Subscription
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Plan</p>
                            <p className="font-semibold text-slate-900">{subscription.plan.name} ({subscription.plan.code})</p>
                            <p className="text-sm text-slate-600">{formatMoneyMinor(subscription.plan.amountMinor, subscription.plan.currency)} / {subscription.plan.interval.toLowerCase()}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Usage</p>
                            <p className="text-sm text-slate-700">Assets: {subscription.currentAssetCount} / {subscription.plan.maxAssets} ({assetUsage}%)</p>
                            <p className="text-sm text-slate-700">Employees: {subscription.currentEmployeeCount} / {subscription.plan.maxEmployees} ({employeeUsage}%)</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Subscription Controls</p>
                            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <span className="text-sm text-slate-700">Auto-renew</span>
                                <input type="checkbox" checked={subscription.autoRenew} onChange={onToggleAutoRenew} disabled={savingAutoRenew} />
                            </div>
                            <p className="text-xs text-slate-500">Status: <span className="font-semibold">{subscription.status}</span></p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((plan) => {
                    const isCurrent = subscription?.plan?.code === plan.code;
                    return (
                        <Card key={plan.code} className={`border ${isCurrent ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200"}`}>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center justify-between text-base">
                                    <span>{plan.name}</span>
                                    <span className="text-xs rounded-full border px-2 py-0.5">{plan.tier}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-2xl font-bold text-slate-900">{formatMoneyMinor(plan.amountMinor, plan.currency)}</p>
                                <p className="text-xs text-slate-500 -mt-2">{plan.interval.toLowerCase()}</p>
                                <div className="text-sm text-slate-700 space-y-1">
                                    <p>Max assets: {plan.maxAssets}</p>
                                    <p>Max employees: {plan.maxEmployees}</p>
                                    <p>Analytics: {plan.analyticsEnabled ? "Included" : "Not included"}</p>
                                    <p>Audit retention: {plan.auditRetentionDays} days</p>
                                </div>
                                <Button
                                    className="w-full"
                                    disabled={isCurrent || checkoutPlanCode === plan.code}
                                    onClick={() => onUpgrade(plan.code)}
                                >
                                    {checkoutPlanCode === plan.code ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                                    {isCurrent ? "Current Plan" : "Upgrade"}
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

