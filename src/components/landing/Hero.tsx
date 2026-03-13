"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, PlayCircle, ShieldCheck, Package, CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

const mockAssets = [
    { name: 'MacBook Pro 16" M3', tag: "IT-0421", dept: "Engineering", status: "Active", statusClass: "text-emerald-400 bg-emerald-500/10" },
    { name: "Forklift Unit #7", tag: "OPS-0189", dept: "Warehouse", status: "Maintenance", statusClass: "text-blue-400 bg-blue-500/10" },
    { name: 'Dell Monitor 27"', tag: "IT-0398", dept: "Finance", status: "Active", statusClass: "text-emerald-400 bg-emerald-500/10" },
    { name: "Server Rack B2", tag: "INF-0053", dept: "IT Infrastructure", status: "Active", statusClass: "text-emerald-400 bg-emerald-500/10" },
];

export function Hero() {
    const { currency, convert } = useCurrency();

    // AUM is $2B USD; convert to active currency for display
    const aumUSD = 2_000_000_000;
    const aumDisplay = currency === "GHS"
        ? `₵${(convert(aumUSD, "USD") / 1_000_000_000).toFixed(1)}B+`
        : "$2B+";

    const socialProof = [
        { value: "50K+", label: "Assets Tracked" },
        { value: "1,200+", label: "Organizations" },
        { value: "99.9%", label: "Uptime SLA" },
        { value: aumDisplay, label: "Assets Under Management" },
    ];

    return (
        <section className="relative overflow-hidden pt-32 pb-20 md:pt-48 md:pb-32">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-full max-w-7xl">
                <div className="absolute top-10 left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-[120px]" />
                <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-blue-500/10 blur-[120px]" />
            </div>

            <div className="container relative mx-auto px-6 text-center">
                <div className="animate-fade-in space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/5 px-4 py-1.5 text-xs font-medium text-teal-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>v2.0 is now live for enterprise customers</span>
                    </div>

                    <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-white md:text-7xl lg:leading-[1.1]">
                        Govern every asset with <span className="text-gradient">absolute precision.</span>
                    </h1>

                    <p className="mx-auto max-w-2xl text-lg text-slate-400 md:text-xl">
                        A professional-grade platform for IT, operations, procurement, and finance teams to control asset risk, lifecycle cost, and compliance.
                    </p>

                    <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                        <Button size="lg" asChild className="h-12 px-8 bg-teal-600 hover:bg-teal-700 text-lg shadow-lg shadow-teal-900/20">
                            <Link href="/register-tenant">
                                Register Organisation <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="h-12 px-8 border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 text-lg">
                            <PlayCircle className="mr-2 h-5 w-5" />
                            Watch Demo
                        </Button>
                    </div>

                    {/* Social proof stats */}
                    <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 pt-2">
                        {socialProof.map((s, i) => (
                            <div key={i} className="text-center">
                                <p className="text-2xl font-extrabold text-white">{s.value}</p>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Dashboard mockup */}
                    <div className="pt-10 animate-slide-up">
                        <div className="glass rounded-2xl border border-white/10 p-2 shadow-2xl">
                            <div className="w-full rounded-xl bg-slate-900 overflow-hidden border border-white/5">
                                {/* Browser chrome */}
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-slate-900/80">
                                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                                    <div className="flex-1 mx-4 h-6 rounded-md bg-slate-800/80 flex items-center px-3">
                                        <span className="text-[10px] text-slate-500 font-mono">app.assetiq.io/dashboard</span>
                                    </div>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Stat cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { label: "Total Assets", value: "4,821", icon: Package, color: "text-teal-400", bg: "bg-teal-500/10", trend: "+12%", up: true },
                                            { label: "Active", value: "3,940", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", trend: "+5%", up: true },
                                            { label: "In Maintenance", value: "312", icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10", trend: "-3%", up: false },
                                            { label: "Flagged", value: "41", icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", trend: "-8%", up: false },
                                        ].map((card, i) => (
                                            <div key={i} className="rounded-xl bg-slate-800/60 border border-white/5 p-4 text-left">
                                                <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${card.bg} ${card.color} mb-3`}>
                                                    <card.icon className="h-4 w-4" />
                                                </div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{card.label}</p>
                                                <div className="flex items-end justify-between gap-1">
                                                    <span className="text-xl font-bold text-white">{card.value}</span>
                                                    <span className={`text-[10px] font-semibold ${card.up ? "text-emerald-400" : "text-red-400"}`}>{card.trend}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Recent assets table */}
                                    <div className="rounded-xl bg-slate-800/40 border border-white/5 overflow-hidden">
                                        <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-300">Recent Assets</span>
                                            <span className="text-[10px] text-teal-400 font-medium cursor-pointer hover:text-teal-300">View all →</span>
                                        </div>
                                        <div className="divide-y divide-white/5">
                                            {mockAssets.map((asset, i) => (
                                                <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                                                    <div className="h-7 w-7 rounded-lg bg-slate-700/60 border border-white/5 flex items-center justify-center shrink-0">
                                                        <Package className="h-3.5 w-3.5 text-slate-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <p className="text-slate-200 font-medium truncate">{asset.name}</p>
                                                        <p className="text-slate-500 text-[10px]">{asset.tag} · {asset.dept}</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${asset.statusClass}`}>{asset.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
