"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useCurrency, SupportedCurrency } from "@/contexts/CurrencyContext";
import { BillingPlan } from "@/types";

// Fallback if the public plans endpoint is not available
const FALLBACK_PLANS: BillingPlan[] = [
    {
        code: "free",
        name: "Free",
        tier: "FREE",
        interval: "MONTHLY",
        amountMinor: 0,
        currency: "GHS",
        maxAssets: 50,
        maxEmployees: 5,
        analyticsEnabled: false,
        auditRetentionDays: 7,
    },
    {
        code: "starter",
        name: "Starter",
        tier: "STARTER",
        interval: "MONTHLY",
        amountMinor: 29900,   // GHS 299 /mo
        currency: "GHS",
        maxAssets: 500,
        maxEmployees: 50,
        analyticsEnabled: false,
        auditRetentionDays: 30,
    },
    {
        code: "professional",
        name: "Professional",
        tier: "PROFESSIONAL",
        interval: "MONTHLY",
        amountMinor: 102900,  // GHS 1,029 /mo
        currency: "GHS",
        maxAssets: 2000,
        maxEmployees: 200,
        analyticsEnabled: true,
        auditRetentionDays: 90,
    },
    {
        code: "enterprise",
        name: "Enterprise",
        tier: "ENTERPRISE",
        interval: "MONTHLY",
        amountMinor: 0,       // Custom pricing
        currency: "GHS",
        maxAssets: 999999,
        maxEmployees: 999999,
        analyticsEnabled: true,
        auditRetentionDays: 365,
    },
];

function buildFeatures(plan: BillingPlan): string[] {
    const isUnlimited = plan.maxAssets >= 999999;
    return [
        isUnlimited ? "Unlimited Assets" : `Up to ${plan.maxAssets.toLocaleString()} Assets`,
        isUnlimited ? "Unlimited Employees" : `Up to ${plan.maxEmployees.toLocaleString()} Employees`,
        plan.analyticsEnabled ? "Advanced Analytics" : "Basic Tracking",
        `${plan.auditRetentionDays} Days Audit Retention`,
        ...(plan.tier.toUpperCase() === "ENTERPRISE" ? ["SAML SSO & Audit Logs", "Custom Retention Policies", "Dedicated Account Manager"] : []),
    ];
}

function isHighlight(plan: BillingPlan, allPlans: BillingPlan[]): boolean {
    const t = plan.tier.toUpperCase();
    if (t === "PROFESSIONAL" || t === "PRO") return true;
    // If no professional tier, highlight the middle paid plan
    const paid = allPlans.filter(p => p.amountMinor > 0 && p.tier.toUpperCase() !== "ENTERPRISE");
    if (paid.length > 0 && paid[Math.floor(paid.length / 2)]?.code === plan.code) return true;
    return false;
}

function isEnterprise(plan: BillingPlan): boolean {
    return plan.tier.toUpperCase() === "ENTERPRISE" || (plan.amountMinor === 0 && plan.maxAssets >= 999999);
}

export function PricingSection() {
    const { currency, setCurrency, convert, rate, rateLastUpdated } = useCurrency();
    const [plans, setPlans] = useState<BillingPlan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await fetch("/api/v1/billing/plans", {
                    headers: { "Content-Type": "application/json" },
                });
                if (!res.ok) throw new Error("not ok");
                const data = await res.json();
                const list: BillingPlan[] = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.content)
                    ? data.content
                    : Array.isArray(data?.data)
                    ? data.data
                    : [];
                setPlans(list.length > 0 ? list : FALLBACK_PLANS);
            } catch {
                setPlans(FALLBACK_PLANS);
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const formatPrice = (plan: BillingPlan): string => {
        if (isEnterprise(plan)) return "Custom";
        if (plan.amountMinor === 0) return "Free";
        const priceInPlanCurrency = plan.amountMinor / 100;
        const converted = convert(priceInPlanCurrency, plan.currency);
        return Math.round(converted).toLocaleString("en-US");
    };

    const altPrice = (plan: BillingPlan): string | null => {
        if (isEnterprise(plan) || plan.amountMinor === 0) return null;
        const priceInPlanCurrency = plan.amountMinor / 100;
        if (currency === "GHS") {
            const inUSD = plan.currency === "USD"
                ? priceInPlanCurrency
                : priceInPlanCurrency / rate;
            return `≈ $${Math.round(inUSD).toLocaleString("en-US")}/mo USD`;
        } else {
            const inGHS = plan.currency === "GHS"
                ? priceInPlanCurrency
                : priceInPlanCurrency * rate;
            return `≈ ₵${Math.round(inGHS).toLocaleString("en-US")}/mo GHS`;
        }
    };

    const symbol = currency === "GHS" ? "₵" : "$";

    return (
        <section id="pricing" className="py-24 bg-slate-900/20">
            <div className="container mx-auto px-6">
                <div className="mb-16 text-center">
                    <span className="text-xs font-bold uppercase tracking-widest text-teal-500">Pricing</span>
                    <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Simple, scalable pricing.</h2>
                    <p className="mx-auto mt-4 max-w-2xl text-slate-400">
                        Choose the plan that fits your organisation&apos;s current scale. Upgrade as you grow — no surprises.
                    </p>

                    {/* Currency toggle */}
                    <div className="mt-8 inline-flex flex-col items-center gap-2">
                        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 p-1">
                            {(["USD", "GHS"] as SupportedCurrency[]).map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCurrency(c)}
                                    className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${
                                        currency === c
                                            ? "bg-teal-600 text-white shadow-md"
                                            : "text-slate-400 hover:text-slate-200"
                                    }`}
                                >
                                    {c === "USD" ? "$ USD" : "₵ GHS"}
                                </button>
                            ))}
                        </div>
                        {currency === "GHS" && (
                            <p className="text-xs text-slate-500">
                                Live rate: 1 USD = ₵{rate.toFixed(2)}
                                {rateLastUpdated && (
                                    <span className="ml-1 text-slate-600">
                                        · updated {rateLastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                    </div>
                ) : (
                    <div className={`grid gap-6 ${
                        plans.length <= 2 ? "sm:grid-cols-2 max-w-2xl mx-auto"
                        : plans.length === 3 ? "md:grid-cols-3"
                        : "sm:grid-cols-2 lg:grid-cols-4"
                    }`}>
                        {plans.map((plan) => {
                            const highlight = isHighlight(plan, plans);
                            const enterprise = isEnterprise(plan);
                            const displayPrice = formatPrice(plan);
                            const alt = altPrice(plan);
                            const showSymbol = !enterprise && plan.amountMinor !== 0;

                            return (
                                <div
                                    key={plan.code}
                                    className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 ${
                                        highlight
                                            ? "border-teal-500 bg-slate-900 shadow-2xl shadow-teal-900/20 lg:-translate-y-2"
                                            : "border-slate-800 bg-slate-950 shadow-lg hover:border-slate-700 hover:-translate-y-1"
                                    }`}
                                >
                                    {highlight && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-teal-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white whitespace-nowrap">
                                            Most Popular
                                        </div>
                                    )}

                                    <div className="mb-8">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                                            <span className="text-[10px] font-bold uppercase tracking-wider rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">
                                                {plan.interval === "MONTHLY" ? "/mo" : plan.interval === "YEARLY" ? "/yr" : plan.interval.toLowerCase()}
                                            </span>
                                        </div>
                                        <div className="mt-5">
                                            <div className="flex items-baseline gap-1">
                                                {showSymbol && (
                                                    <span className="text-xl font-bold text-slate-400">{symbol}</span>
                                                )}
                                                <span className="text-4xl font-extrabold text-white">{displayPrice}</span>
                                            </div>
                                            {alt && (
                                                <p className="mt-1.5 text-xs text-slate-500">{alt}</p>
                                            )}
                                        </div>
                                    </div>

                                    <ul className="mb-8 flex-1 space-y-3">
                                        {buildFeatures(plan).map((f, j) => (
                                            <li key={j} className="flex gap-3 text-sm text-slate-300">
                                                <Check className="h-4 w-4 shrink-0 text-teal-500 mt-0.5" />
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        asChild
                                        variant="ghost"
                                        className={`w-full h-11 text-sm font-semibold transition-all ${
                                            highlight
                                                ? "bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-900/40"
                                                : "bg-transparent border border-slate-700 text-white hover:bg-slate-800 hover:text-white"
                                        }`}
                                    >
                                        <Link href={enterprise ? "/#contact-info" : "/register-tenant"}>
                                            {enterprise ? "Contact Sales" : plan.amountMinor === 0 ? "Get Started" : "Start Free Trial"}
                                        </Link>
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <p className="mt-10 text-center text-xs text-slate-500">
                    All plans include a 14-day free trial. No credit card required.
                </p>
            </div>
        </section>
    );
}
