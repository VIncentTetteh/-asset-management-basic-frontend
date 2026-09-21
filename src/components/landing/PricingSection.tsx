"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BillingPlan } from "@/types";
import { filterAndOrderPlans } from "@/lib/plan-filter";

/**
 * Shown only when the public plans endpoint is unreachable. These carry plan
 * shape and limits, not prices: billing currency depends on the customer's
 * country, so no currency (or amount) is claimed here — see `live` below.
 */
const FALLBACK_PLANS: BillingPlan[] = [
    {
        code: "FREEMIUM",
        name: "Freemium",
        tier: "FREEMIUM",
        interval: "MONTHLY",
        amountMinor: 0,
        currency: "",
        maxAssets: 50,
        maxEmployees: 5,
        analyticsEnabled: false,
        auditRetentionDays: 30,
    },
    {
        code: "BASIC",
        name: "Basic",
        tier: "BASIC",
        interval: "MONTHLY",
        amountMinor: 1,       // Paid tier marker only; never displayed (live=false)
        currency: "",
        maxAssets: 250,
        maxEmployees: 10,
        analyticsEnabled: false,
        auditRetentionDays: 90,
    },
    {
        code: "BUSINESS",
        name: "Business",
        tier: "BUSINESS",
        interval: "MONTHLY",
        amountMinor: 1,       // Paid tier marker only; never displayed (live=false)
        currency: "",
        maxAssets: 10_000,
        maxEmployees: 250,
        analyticsEnabled: true,
        auditRetentionDays: 1_825,
    },
    {
        code: "ENTERPRISE",
        name: "Enterprise",
        tier: "ENTERPRISE",
        interval: "MONTHLY",
        amountMinor: 0,       // Custom pricing
        currency: "",
        maxAssets: 999999,
        maxEmployees: 999999,
        analyticsEnabled: true,
        auditRetentionDays: 3_650,
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
    if (t === "BUSINESS") return true;
    // If no professional tier, highlight the middle paid plan
    const paid = allPlans.filter(p => p.amountMinor > 0 && p.tier.toUpperCase() !== "ENTERPRISE");
    if (paid.length > 0 && paid[Math.floor(paid.length / 2)]?.code === plan.code) return true;
    return false;
}

function isEnterprise(plan: BillingPlan): boolean {
    return plan.tier.toUpperCase() === "ENTERPRISE" || (plan.amountMinor === 0 && plan.maxAssets >= 999999);
}

/** Whole-unit price in the plan's own billing currency, e.g. "GH₵799" or "$49". */
function formatPlanPrice(amountMinor: number, currency: string): string {
    const amount = amountMinor / 100;
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
    }
}

const intervalBadge = (plan: BillingPlan): string => (plan.interval === "ANNUALLY" ? "/yr" : "/mo");

export function PricingSection() {
    const [plans, setPlans] = useState<BillingPlan[]>([]);
    /** All plans from the API, annual variants included (used for "billed annually" hints). */
    const [allPlans, setAllPlans] = useState<BillingPlan[]>([]);
    /** False while showing FALLBACK_PLANS, which have no real prices. */
    const [live, setLive] = useState(false);
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
                const cleaned = filterAndOrderPlans(list);
                // One card per tier: the monthly price, with any annual variant as a hint.
                const monthly = cleaned.filter((p) => p.interval !== "ANNUALLY");
                setAllPlans(cleaned);
                setPlans(monthly.length > 0 ? monthly : FALLBACK_PLANS);
                setLive(monthly.length > 0);
            } catch {
                setPlans(FALLBACK_PLANS);
                setLive(false);
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const formatPrice = (plan: BillingPlan): string => {
        if (isEnterprise(plan)) return "Custom";
        if (plan.amountMinor === 0) return "Free";
        if (!live || !plan.currency) return "Local pricing";
        return formatPlanPrice(plan.amountMinor, plan.currency);
    };

    const altPrice = (plan: BillingPlan): string | null => {
        if (!live || isEnterprise(plan) || plan.amountMinor === 0) return null;
        const annual = allPlans.find(
            (p) => p.interval === "ANNUALLY" && p.tier.toUpperCase() === plan.tier.toUpperCase() && p.amountMinor > 0,
        );
        return annual ? `or ${formatPlanPrice(annual.amountMinor, annual.currency)} billed annually` : null;
    };

    return (
        <section id="pricing" className="py-24 bg-slate-900/20">
            <div className="container mx-auto px-6">
                <div className="mb-16 text-center">
                    <span className="text-xs font-bold uppercase tracking-widest text-teal-300">Pricing</span>
                    <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Simple, scalable pricing.</h2>
                    <p className="mx-auto mt-4 max-w-2xl text-slate-400">
                        Choose the plan that fits your organisation&apos;s current scale. Upgrade as you grow — no surprises.
                    </p>

                    <p className="mt-6 text-xs text-slate-300">
                        {live
                            ? "Prices are shown in each plan's billing currency."
                            : "Live pricing is unavailable right now. You'll see prices in your billing currency when you sign up."}
                    </p>
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
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-teal-700 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white whitespace-nowrap">
                                            Most Popular
                                        </div>
                                    )}

                                    <div className="mb-8">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                                            <span className="text-[10px] font-bold uppercase tracking-wider rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">
                                                {intervalBadge(plan)}
                                            </span>
                                        </div>
                                        <div className="mt-5">
                                            <div className="flex items-baseline gap-1">
                                                <span className={`${live || enterprise || plan.amountMinor === 0 ? "text-4xl" : "text-2xl"} font-extrabold text-white`}>
                                                    {displayPrice}
                                                </span>
                                            </div>
                                            {alt && (
                                                <p className="mt-1.5 text-xs text-slate-300">{alt}</p>
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
                                                ? "bg-teal-700 hover:bg-teal-800 text-white shadow-lg shadow-teal-900/40"
                                                : "bg-transparent border border-slate-700 text-white hover:bg-slate-800 hover:text-white"
                                        }`}
                                    >
                                        <Link href={enterprise ? "/#contact-info" : "/register-tenant"}>
                                            {enterprise ? "Contact Sales" : plan.amountMinor === 0 ? "Get Started" : "Get Started"}
                                        </Link>
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <p className="mt-10 text-center text-xs text-slate-300">
                    Freemium is available without a credit card. Enterprise packages are handled by our sales team.
                </p>
            </div>
        </section>
    );
}
