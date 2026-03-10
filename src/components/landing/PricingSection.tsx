"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const plans = [
    {
        name: "Free",
        price: "0",
        currency: "USD",
        description: "Perfect for testing and very small teams.",
        features: [
            "Up to 50 Assets",
            "Up to 5 Employees",
            "Basic Tracking",
            "7 Days Audit Retention"
        ],
        cta: "Get Started",
        highlight: false
    },
    {
        name: "Starter",
        price: "29",
        currency: "USD",
        period: "/mo",
        description: "Standard features for small businesses.",
        features: [
            "Up to 500 Assets",
            "Up to 50 Employees",
            "Standard Reporting",
            "30 Days Audit Retention"
        ],
        cta: "Start Trial",
        highlight: false
    },
    {
        name: "Professional",
        price: "99",
        currency: "USD",
        period: "/mo",
        description: "The choice for growing organizations.",
        features: [
            "Up to 2,000 Assets",
            "Up to 200 Employees",
            "Advanced Analytics",
            "90 Days Audit Retention"
        ],
        cta: "Start Free Trial",
        highlight: true
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "For large-scale multi-entity governance.",
        features: [
            "Unlimited Assets & Employees",
            "SAML SSO & Audit Logs",
            "Custom Retention Policies",
            "Dedicated Account Manager"
        ],
        cta: "Contact Sales",
        highlight: false
    }
];

export function PricingSection() {
    return (
        <section id="pricing" className="py-24 bg-slate-900/20">
            <div className="container mx-auto px-6">
                <div className="mb-16 text-center">
                    <span className="text-xs font-bold uppercase tracking-widest text-teal-500">Pricing</span>
                    <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Simple, scalable pricing.</h2>
                    <p className="mx-auto mt-4 max-w-2xl text-slate-400">
                        Choose the plan that fits your organisation&apos;s current scale. Upgrade as you grow — no surprises.
                    </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {plans.map((p, i) => (
                        <div
                            key={i}
                            className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 ${
                                p.highlight
                                    ? "border-teal-500 bg-slate-900 shadow-2xl shadow-teal-900/20 lg:-translate-y-2"
                                    : "border-slate-800 bg-slate-950 shadow-lg hover:border-slate-700 hover:-translate-y-1"
                            }`}
                        >
                            {p.highlight && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-teal-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white whitespace-nowrap">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-lg font-bold text-white">{p.name}</h3>
                                <p className="mt-2 text-sm text-slate-400 min-h-[40px]">{p.description}</p>
                                <div className="mt-6 flex items-baseline gap-1">
                                    {p.price !== "Custom" && <span className="text-xl font-bold text-slate-400">$</span>}
                                    <span className="text-4xl font-extrabold text-white">{p.price}</span>
                                    {p.period && <span className="text-slate-400 text-sm">{p.period}</span>}
                                </div>
                            </div>

                            <ul className="mb-8 flex-1 space-y-3">
                                {p.features.map((f, j) => (
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
                                    p.highlight
                                        ? "bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-900/40"
                                        : "bg-transparent border border-slate-700 text-white hover:bg-slate-800 hover:text-white"
                                }`}
                            >
                                <Link href="/register-tenant">
                                    {p.cta}
                                </Link>
                            </Button>
                        </div>
                    ))}
                </div>

                <p className="mt-10 text-center text-xs text-slate-500">
                    All plans include a 14-day free trial. No credit card required.
                </p>
            </div>
        </section>
    );
}
