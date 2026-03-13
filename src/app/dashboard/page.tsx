"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
    Hexagon, Building2, Users, Wrench, AlertTriangle, CheckCircle2,
    ShoppingCart, Clock, Mail, Phone, MapPin, Hash, Receipt,
    ArrowRight, ShieldCheck, TrendingUp, PackageCheck, ScanLine,
    Cpu, BarChart3, FileText, Activity
} from "lucide-react";
import { assetService } from "@/services/assetService";
import { organisationService } from "@/services/organisationService";
import { userService } from "@/services/userService";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { maintenanceService } from "@/services/maintenanceService";
import { authService } from "@/services/authService";
import { dashboardService } from "@/services/dashboardService";
import { Organisation, AssetsByDepartment, DepreciationSummary } from "@/types";

interface DashboardStats {
    totalAssets: number;
    activeAssets: number;
    inMaintenanceAssets: number;
    disposedAssets: number;
    totalOrganisations: number;
    totalUsers: number;
    pendingPOs: number;
    approvedPOs: number;
    scheduledMaintenance: number;
    inProgressMaintenance: number;
}

const QUICK_LINKS = [
    { href: "/assets", label: "All Assets", icon: Hexagon, color: "text-indigo-600 bg-indigo-50" },
    { href: "/compliance/controls", label: "Controls", icon: ShieldCheck, color: "text-teal-600 bg-teal-50" },
    { href: "/compliance/risks", label: "Risk Register", icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
    { href: "/compliance/incidents", label: "Incidents", icon: Activity, color: "text-red-600 bg-red-50" },
    { href: "/compliance/patch-records", label: "Patch Records", icon: PackageCheck, color: "text-blue-600 bg-blue-50" },
    { href: "/compliance/vulnerability-scans", label: "Vuln Scans", icon: ScanLine, color: "text-purple-600 bg-purple-50" },
    { href: "/compliance/ics-assets", label: "ICS Assets", icon: Cpu, color: "text-orange-600 bg-orange-50" },
    { href: "/analytics", label: "Analytics", icon: BarChart3, color: "text-emerald-600 bg-emerald-50" },
    { href: "/reports", label: "Reports", icon: FileText, color: "text-slate-600 bg-slate-50" },
];

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        totalAssets: 0, activeAssets: 0, inMaintenanceAssets: 0, disposedAssets: 0,
        totalOrganisations: 0, totalUsers: 0, pendingPOs: 0, approvedPOs: 0,
        scheduledMaintenance: 0, inProgressMaintenance: 0,
    });
    const [myOrg, setMyOrg] = useState<Organisation | null>(null);
    const [assetStatusBreakdown, setAssetStatusBreakdown] = useState<{ label: string; count: number; color: string }[]>([]);
    const [assetsByDepartment, setAssetsByDepartment] = useState<AssetsByDepartment | null>(null);
    const [depreciationSummary, setDepreciationSummary] = useState<DepreciationSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const profile = await authService.getProfile();
                const orgId = (profile as any).organisationId;

                const promises: Promise<any>[] = [
                    assetService.getAll(),
                    organisationService.getAll(),
                    userService.getAll(),
                    purchaseOrderService.getAll(),
                    maintenanceService.getAll(),
                ];
                if (orgId) promises.push(organisationService.get(orgId));

                const results = await Promise.allSettled(promises);
                const get = <T,>(r: PromiseSettledResult<T>, def: T): T =>
                    r.status === "fulfilled" ? r.value : def;

                const assets = get(results[0] as PromiseSettledResult<any[]>, []);
                const orgs = get(results[1] as PromiseSettledResult<any[]>, []);
                const users = get(results[2] as PromiseSettledResult<any[]>, []);
                const pos = get(results[3] as PromiseSettledResult<any[]>, []);
                const maint = get(results[4] as PromiseSettledResult<any[]>, []);
                const safePos = Array.isArray(pos) ? pos : [];

                if (orgId && results[5]?.status === "fulfilled") {
                    setMyOrg(results[5].value as unknown as Organisation);
                }

                const statusGroups: Record<string, { label: string; color: string }> = {
                    IN_USE: { label: "In Use", color: "bg-emerald-500" },
                    IN_STOCK: { label: "In Stock", color: "bg-blue-500" },
                    UNDER_MAINTENANCE: { label: "Maintenance", color: "bg-amber-500" },
                    DISPOSED: { label: "Disposed", color: "bg-red-400" },
                    RETIRED: { label: "Retired", color: "bg-slate-400" },
                };
                const counts: Record<string, number> = {};
                assets.forEach((a: any) => { counts[a.status] = (counts[a.status] || 0) + 1; });
                const breakdown = Object.entries(statusGroups)
                    .map(([key, meta]) => ({ ...meta, count: counts[key] || 0 }))
                    .filter(b => b.count > 0);
                setAssetStatusBreakdown(breakdown);

                setStats({
                    totalAssets: assets.length,
                    activeAssets: assets.filter((a: any) => a.status === "IN_STOCK" || a.status === "IN_USE").length,
                    inMaintenanceAssets: assets.filter((a: any) => a.status === "UNDER_MAINTENANCE").length,
                    disposedAssets: assets.filter((a: any) => a.status === "DISPOSED" || a.status === "RETIRED").length,
                    totalOrganisations: orgs.length,
                    totalUsers: users.length,
                    pendingPOs: safePos.filter((p: any) => p.status === "SUBMITTED" || p.status === "PENDING").length,
                    approvedPOs: safePos.filter((p: any) => p.status === "APPROVED").length,
                    scheduledMaintenance: maint.filter((m: any) => m.status === "SCHEDULED").length,
                    inProgressMaintenance: maint.filter((m: any) => m.status === "IN_PROGRESS").length,
                });
                // Fetch additional dashboard data (non-blocking)
                const [deptResult, deprResult] = await Promise.allSettled([
                    dashboardService.getAssetsByDepartment(),
                    dashboardService.getDepreciationSummary(),
                ]);
                if (deptResult.status === "fulfilled") setAssetsByDepartment(deptResult.value);
                if (deprResult.status === "fulfilled") setDepreciationSummary(deprResult.value);
            } catch (err) {
                console.error("Dashboard load failed:", err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-64 bg-slate-100 rounded-lg animate-pulse" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
                    <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
                </div>
            </div>
        );
    }

    const totalBreakdown = assetStatusBreakdown.reduce((s, b) => s + b.count, 0) || 1;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        Asset<span className="text-teal-600">IQ</span>
                        {myOrg && <span className="text-slate-400 font-normal"> | {myOrg.name}</span>}
                    </h1>
                    <p className="text-slate-500">Platform overview — assets, compliance, and operational health.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/analytics">
                        <Button variant="outline" className="gap-2"><BarChart3 className="h-4 w-4" /> Analytics</Button>
                    </Link>
                    <Link href="/reports">
                        <Button className="bg-teal-600 hover:bg-teal-700 gap-2"><FileText className="h-4 w-4" /> Reports</Button>
                    </Link>
                </div>
            </div>

            {myOrg && (
                <Card className="border-slate-200 overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-4 px-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-teal-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg font-bold text-white">{myOrg.name}</CardTitle>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${myOrg.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
                                            {myOrg.status || "ACTIVE"}
                                        </span>
                                    </div>
                                    {myOrg.industry && <p className="text-sm text-slate-400">{myOrg.industry}</p>}
                                </div>
                            </div>
                            <Link href="/organisations">
                                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-white/10 gap-1 text-xs">
                                    View Details <ArrowRight className="h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                            <div className="p-4 flex items-center gap-3">
                                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Contact</p>
                                    <p className="text-sm text-slate-700 font-medium truncate">{myOrg.contactEmail || "—"}</p>
                                    {myOrg.contactPhone && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{myOrg.contactPhone}</p>}
                                </div>
                            </div>
                            <div className="p-4 flex items-center gap-3">
                                <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Location</p>
                                    <p className="text-sm text-slate-700 font-medium">{myOrg.address || "—"}</p>
                                    {myOrg.country && <p className="text-xs text-slate-500">{myOrg.country}{myOrg.timezone ? ` · ${myOrg.timezone}` : ""}</p>}
                                </div>
                            </div>
                            <div className="p-4 flex items-center gap-3">
                                <Hash className="h-4 w-4 text-slate-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Registration</p>
                                    <p className="text-sm font-mono text-slate-700 font-medium">{myOrg.registrationNumber || "—"}</p>
                                    {myOrg.taxId && <p className="text-xs text-slate-500 flex items-center gap-1"><Receipt className="h-3 w-3" />Tax: {myOrg.taxId}</p>}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
                    <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-5">
                        <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wide">Total Assets</p>
                        <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <Hexagon className="h-4 w-4 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <div className="text-4xl font-black">{stats.totalAssets.toLocaleString()}</div>
                        <p className="text-xs text-indigo-200 mt-1">{stats.activeAssets} active · {stats.inMaintenanceAssets} in maintenance</p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
                    <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-5">
                        <p className="text-xs font-semibold text-emerald-200 uppercase tracking-wide">Healthy Assets</p>
                        <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <div className="text-4xl font-black">{stats.activeAssets.toLocaleString()}</div>
                        <div className="mt-2 bg-white/20 rounded-full h-1.5">
                            <div className="bg-white h-1.5 rounded-full" style={{ width: stats.totalAssets ? `${Math.round(stats.activeAssets / stats.totalAssets * 100)}%` : "0%" }} />
                        </div>
                        <p className="text-xs text-emerald-200 mt-1">{stats.totalAssets ? Math.round(stats.activeAssets / stats.totalAssets * 100) : 0}% of total portfolio</p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500 to-blue-700 text-white">
                    <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-5">
                        <p className="text-xs font-semibold text-blue-200 uppercase tracking-wide">Users & Orgs</p>
                        <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <Users className="h-4 w-4 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <div className="text-4xl font-black">{stats.totalUsers.toLocaleString()}</div>
                        <p className="text-xs text-blue-200 mt-1">{stats.totalOrganisations} organisation{stats.totalOrganisations !== 1 ? "s" : ""} registered</p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-5">
                        <p className="text-xs font-semibold text-amber-100 uppercase tracking-wide">Pending Actions</p>
                        <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <div className="text-4xl font-black">{stats.pendingPOs + stats.scheduledMaintenance + stats.inProgressMaintenance}</div>
                        <p className="text-xs text-amber-100 mt-1">{stats.pendingPOs} POs · {stats.scheduledMaintenance + stats.inProgressMaintenance} maintenance</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-slate-200">
                    <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-indigo-500" /> Asset Health Breakdown
                            </CardTitle>
                            <Link href="/assets">
                                <Button variant="ghost" size="sm" className="text-xs text-slate-500 h-7 gap-1">
                                    View All <ArrowRight className="h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="p-5 space-y-3">
                        {assetStatusBreakdown.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">No asset data available</p>
                        ) : assetStatusBreakdown.map(b => (
                            <div key={b.label}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-slate-600 font-medium">{b.label}</span>
                                    <span className="text-sm font-bold text-slate-800">{b.count} <span className="text-xs font-normal text-slate-400">({Math.round(b.count / totalBreakdown * 100)}%)</span></span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div className={`${b.color} h-2 rounded-full transition-all`} style={{ width: `${Math.round(b.count / totalBreakdown * 100)}%` }} />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="border-slate-200">
                    <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" /> Action Required
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            <Link href="/purchase-orders" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-sky-100 rounded-lg text-sky-600">
                                        <ShoppingCart className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Purchase Orders</p>
                                        <p className="text-xs text-slate-500">{stats.pendingPOs} pending · {stats.approvedPOs} approved</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-sky-600">{stats.pendingPOs}</span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                                </div>
                            </Link>
                            <Link href="/maintenance" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-teal-100 rounded-lg text-teal-600">
                                        <Wrench className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Maintenance Tasks</p>
                                        <p className="text-xs text-slate-500">{stats.scheduledMaintenance} scheduled · {stats.inProgressMaintenance} in progress</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-teal-600">{stats.scheduledMaintenance + stats.inProgressMaintenance}</span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                                </div>
                            </Link>
                            <Link href="/compliance/incidents" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-100 rounded-lg text-red-600">
                                        <Activity className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Compliance Incidents</p>
                                        <p className="text-xs text-slate-500">Review open security incidents</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                            </Link>
                            <Link href="/compliance/regulatory-filings" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Regulatory Filings</p>
                                        <p className="text-xs text-slate-500">Check upcoming deadlines</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {(assetsByDepartment || depreciationSummary) && (
                <div className="grid gap-6 md:grid-cols-2">
                    {assetsByDepartment && assetsByDepartment.data?.length > 0 && (
                        <Card className="border-slate-200">
                            <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-blue-500" /> Assets by Department
                                    </CardTitle>
                                    <Link href="/assets">
                                        <Button variant="ghost" size="sm" className="text-xs text-slate-500 h-7 gap-1">
                                            View All <ArrowRight className="h-3 w-3" />
                                        </Button>
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent className="p-5 space-y-3">
                                {assetsByDepartment.data.slice(0, 6).map((d, i) => {
                                    const pct = assetsByDepartment.total ? Math.round(d.count / assetsByDepartment.total * 100) : 0;
                                    return (
                                        <div key={d.departmentId ?? d.departmentName ?? i}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm text-slate-600 font-medium truncate max-w-[60%]">{d.departmentName}</span>
                                                <span className="text-sm font-bold text-slate-800">{d.count} <span className="text-xs font-normal text-slate-400">({pct}%)</span></span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2">
                                                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {depreciationSummary && (
                        <Card className="border-slate-200">
                            <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-purple-500" /> Depreciation Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5">
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: "Total Depreciation", value: depreciationSummary.totalDepreciation, prefix: "$" },
                                        { label: "Net Book Value", value: depreciationSummary.netBookValue, prefix: "$" },
                                        { label: "Monthly Depreciation", value: depreciationSummary.monthlyDepreciation, prefix: "$" },
                                        { label: "Fully Depreciated", value: depreciationSummary.assetsFullyDepreciated, prefix: "" },
                                    ].map(item => (
                                        <div key={item.label} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                                            <p className="text-lg font-bold text-slate-800">
                                                {item.prefix}{typeof item.value === "number" ? item.value.toLocaleString() : "—"}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            <Card className="border-slate-200">
                <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-base font-semibold text-slate-800">Quick Navigation</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
                        {QUICK_LINKS.map(link => (
                            <Link key={link.href} href={link.href} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-50 transition-colors group text-center">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${link.color}`}>
                                    <link.icon className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 leading-tight">{link.label}</span>
                            </Link>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
