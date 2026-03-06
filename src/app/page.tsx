"use client";

import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, LineChart, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const highlights = [
    {
        title: "Enterprise Asset Lifecycle",
        description: "Track procurement, assignment, maintenance, transfer, and disposal in one governed workflow.",
        icon: Building2,
    },
    {
        title: "Audit & Compliance Ready",
        description: "Full activity traceability with role-based controls and API audit events for compliance reporting.",
        icon: ShieldCheck,
    },
    {
        title: "Operational Intelligence",
        description: "Analytics, depreciation insights, and report generation for finance, ops, and leadership teams.",
        icon: LineChart,
    },
    {
        title: "Maintenance & Reliability",
        description: "Schedule, track, and optimize maintenance work while preserving asset availability.",
        icon: Wrench,
    },
];

const outcomes = [
    "Reduce asset loss and shadow inventory",
    "Accelerate PO, approval, and receiving workflows",
    "Improve audit readiness across departments",
    "Standardize cross-organisation governance controls",
];

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded bg-emerald-500" />
                        <span className="font-semibold tracking-wide">Enterprise Asset Management</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" asChild className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800">
                            <Link href="/login">Login</Link>
                        </Button>
                        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                            <Link href="/register-tenant">Start Free Trial</Link>
                        </Button>
                    </div>
                </header>

                <section className="grid gap-10 py-16 md:grid-cols-2 md:items-center">
                    <div className="space-y-6">
                        <p className="inline-flex items-center rounded-full border border-emerald-800 bg-emerald-900/40 px-3 py-1 text-xs uppercase tracking-wider text-emerald-300">
                            Built for organisations and multi-entity enterprises
                        </p>
                        <h1 className="text-4xl font-bold leading-tight md:text-5xl">
                            Govern every asset from acquisition to retirement.
                        </h1>
                        <p className="max-w-xl text-slate-300">
                            A professional-grade platform for IT, operations, procurement, and finance teams to control asset risk, lifecycle cost, and compliance.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                                <Link href="/register-tenant">Register Organisation <ArrowRight className="ml-2 h-4 w-4" /></Link>
                            </Button>
                            <Button variant="outline" asChild className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800">
                                <Link href="/register">Join Existing Workspace</Link>
                            </Button>
                        </div>
                    </div>
                    <Card className="border-slate-800 bg-slate-900/80">
                        <CardContent className="space-y-4 p-6">
                            <p className="text-sm font-semibold text-slate-200">Business Outcomes</p>
                            <div className="space-y-3">
                                {outcomes.map((item) => (
                                    <div key={item} className="flex items-start gap-2 text-sm text-slate-300">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 pb-16 md:grid-cols-2">
                    {highlights.map((item) => (
                        <Card key={item.title} className="border-slate-800 bg-slate-900/60">
                            <CardContent className="p-6">
                                <item.icon className="mb-3 h-5 w-5 text-emerald-400" />
                                <h3 className="text-lg font-semibold">{item.title}</h3>
                                <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </section>
            </div>
        </div>
    );
}

