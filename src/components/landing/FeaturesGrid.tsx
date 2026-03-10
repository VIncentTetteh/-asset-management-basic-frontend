"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
    Building2, ShieldCheck, LineChart, Wrench,
    Layers, Zap
} from "lucide-react";

const features = [
    {
        title: "Enterprise Asset Lifecycle",
        description: "Track procurement, assignment, maintenance, transfer, and disposal in one governed workflow.",
        icon: Building2,
        color: "text-teal-400",
        bg: "bg-teal-500/10"
    },
    {
        title: "Audit & Compliance Ready",
        description: "Full activity traceability with role-based controls and API audit events for compliance reporting.",
        icon: ShieldCheck,
        color: "text-blue-400",
        bg: "bg-blue-500/10"
    },
    {
        title: "Operational Intelligence",
        description: "Analytics, depreciation insights, and report generation for finance, ops, and leadership teams.",
        icon: LineChart,
        color: "text-purple-400",
        bg: "bg-purple-500/10"
    },
    {
        title: "Maintenance & Reliability",
        description: "Schedule, track, and optimize maintenance work while preserving asset availability.",
        icon: Wrench,
        color: "text-orange-400",
        bg: "bg-orange-500/10"
    },
    {
        title: "Multi-Entity Management",
        description: "Manage multiple organisations, departments, and subsidiaries from a single unified control plane.",
        icon: Layers,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10"
    },
    {
        title: "Real-time Tracking",
        description: "Instant updates on asset status, location transfers, and employee assignments across the globe.",
        icon: Zap,
        color: "text-yellow-400",
        bg: "bg-yellow-500/10"
    }
];

export function FeaturesGrid() {
    return (
        <section id="features" className="py-24 bg-slate-950">
            <div className="container mx-auto px-6">
                <div className="mb-16 text-center">
                    <h2 className="text-3xl font-bold text-white md:text-4xl">
                        Everything you need to <span className="text-teal-400">master your inventory.</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-slate-400">
                        Our platform provides the specialized tools required by IT, Operations, and Finance to manage millions in organizational value.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {features.map((f, i) => (
                        <Card key={i} className="group border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 transition-all duration-300 hover:-translate-y-1">
                            <CardContent className="p-8">
                                <div className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.bg} ${f.color}`}>
                                    <f.icon className="h-6 w-6" />
                                </div>
                                <h3 className="mb-3 text-xl font-bold text-white group-hover:text-teal-400 transition-colors">{f.title}</h3>
                                <p className="text-sm leading-relaxed text-slate-400">
                                    {f.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
