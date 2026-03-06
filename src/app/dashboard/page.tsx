"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
    Hexagon,
    Building2,
    Users,
    Wrench,
    AlertTriangle,
    CheckCircle2,
    Activity,
    ShoppingCart,
    Clock,
    Mail,
    Phone,
    MapPin,
    Hash,
    Receipt
} from "lucide-react";
import { assetService } from "@/services/assetService";
import { organisationService } from "@/services/organisationService";
import { userService } from "@/services/userService";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { maintenanceService } from "@/services/maintenanceService";
import { authService } from "@/services/authService";
import { Organisation } from "@/types";

export default function Home() {
    const [stats, setStats] = useState({
        totalAssets: 0,
        activeAssets: 0,
        totalOrganisations: 0,
        totalUsers: 0,
        pendingPOs: 0,
        scheduledMaintenance: 0
    });
    const [myOrg, setMyOrg] = useState<Organisation | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch the user's profile first to get organisationId
                const profile = await authService.getProfile();
                const orgId = (profile as any).organisationId;

                // Construct the fetch promise array
                const fetchPromises = [
                    assetService.getAll(),
                    organisationService.getAll(),
                    userService.getAll(),
                    purchaseOrderService.getAll(),
                    maintenanceService.getAll()
                ];

                // Add fetching the specific organisation if we have an ID
                if (orgId) {
                    fetchPromises.push(organisationService.get(orgId) as Promise<any>);
                }

                const results = await Promise.allSettled(fetchPromises);

                const getResult = <T,>(result: PromiseSettledResult<T>, defaultValue: T): T => {
                    if (result.status === 'fulfilled') {
                        return result.value;
                    }
                    console.error("Dashboard fetch segment failed:", result.reason);
                    return defaultValue;
                };

                const assets = getResult(results[0] as PromiseSettledResult<any[]>, []);
                const orgs = getResult(results[1] as PromiseSettledResult<any[]>, []);
                const users = getResult(results[2] as PromiseSettledResult<any[]>, []);
                const pos = getResult(results[3] as PromiseSettledResult<any[]>, []);
                const safePos = Array.isArray(pos) ? pos : [];
                const maint = getResult(results[4] as PromiseSettledResult<any[]>, []);

                if (orgId && results[5] && results[5].status === 'fulfilled') {
                    setMyOrg(results[5].value as unknown as Organisation);
                }

                setStats({
                    totalAssets: assets.length,
                    activeAssets: assets.filter(a => a.status === 'IN_STOCK' || a.status === 'IN_USE').length,
                    totalOrganisations: orgs.length,
                    totalUsers: users.length,
                    pendingPOs: safePos.filter(po => po.status === 'SUBMITTED' || po.status === 'PENDING').length,
                    scheduledMaintenance: maint.filter(m => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS').length
                });

            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[70vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <PageHeader
                title="Dashboard Overview"
                subtitle="Platform metrics, operational alerts, and health signals at a glance."
            />

            {myOrg && (
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                            <Building2 className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-xl font-bold text-slate-900">{myOrg.name}</CardTitle>
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${myOrg.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                    myOrg.status === "SUSPENDED" ? "bg-red-100 text-red-700 border-red-200" :
                                        "bg-slate-100 text-slate-700 border-slate-200"
                                    }`}>
                                    {myOrg.status || "ACTIVE"}
                                </span>
                            </div>
                            {myOrg.industry && <p className="text-sm text-slate-500 font-medium">{myOrg.industry}</p>}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">

                            {/* Contact Section */}
                            <div className="p-5 space-y-4">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Contact Details</h4>
                                <div className="space-y-3 text-sm">
                                    {myOrg.contactEmail ? (
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <span className="font-medium truncate">{myOrg.contactEmail}</span>
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 italic text-xs">No email provided</p>
                                    )}
                                    {myOrg.contactPhone ? (
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span>{myOrg.contactPhone}</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* Location Section */}
                            <div className="p-5 space-y-4">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location & Timezone</h4>
                                <div className="space-y-3 text-sm">
                                    {(myOrg.address || myOrg.country) ? (
                                        <div className="text-slate-700">
                                            <span className="block">{myOrg.address}</span>
                                            <span className="block text-slate-500">{myOrg.country}</span>
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 italic text-xs">No location provided</p>
                                    )}
                                    {myOrg.timezone ? (
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="text-xs font-medium">{myOrg.timezone}</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* Legal/Business Section */}
                            <div className="p-5 space-y-4">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Registration & Tax</h4>
                                <div className="space-y-3 text-sm">
                                    {myOrg.registrationNumber ? (
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-500">Reg. Number</span>
                                            <span className="font-mono font-medium text-slate-800">{myOrg.registrationNumber}</span>
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 italic text-xs mb-2">No registration number provided</p>
                                    )}
                                    {myOrg.taxId ? (
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-500">Tax ID</span>
                                            <span className="font-mono font-medium text-slate-800 flex items-center gap-1.5">
                                                <Receipt className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                {myOrg.taxId}
                                            </span>
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 italic text-xs">No Tax ID provided</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white border-none shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-100">Total Assets</CardTitle>
                        <Hexagon className="h-4 w-4 text-indigo-200" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalAssets.toLocaleString()}</div>
                        <p className="text-xs text-indigo-200 mt-1">Across all tenants</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-none shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-100">Healthy Assets</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.activeAssets.toLocaleString()}</div>
                        <p className="text-xs text-emerald-200 mt-1">Currently Available or In Use</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white border-none shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-blue-100">Organisations</CardTitle>
                        <Building2 className="h-4 w-4 text-blue-200" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalOrganisations.toLocaleString()}</div>
                        <p className="text-xs text-blue-200 mt-1">Registered tenants</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-purple-700 text-white border-none shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-purple-100">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-purple-200" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</div>
                        <p className="text-xs text-purple-200 mt-1">Total provisioned accounts</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
                        <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" /> Action Required
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-sky-100 rounded-lg text-sky-600">
                                        <ShoppingCart className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">Purchase Orders</p>
                                        <p className="text-sm text-slate-500">Awaiting your approval</p>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-sky-600">{stats.pendingPOs}</div>
                            </div>
                            <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-teal-100 rounded-lg text-teal-600">
                                        <Wrench className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">Maintenance Tasks</p>
                                        <p className="text-sm text-slate-500">Scheduled or In Progress</p>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-teal-600">{stats.scheduledMaintenance}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm flex flex-col items-center justify-center">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3 w-full">
                        <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Activity className="h-5 w-5 text-indigo-500" /> System Activity Walkthrough
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="text-center space-y-4">
                            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mb-2">
                                <Clock className="h-8 w-8" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">You're all set!</h3>
                            <p className="text-slate-500 max-w-sm mx-auto">
                                The Asset Management Platform has been successfully upgraded with dynamic multi-tenancy capabilities, procurement flows, and lifecycle management.
                            </p>
                            <p className="text-xs text-slate-400 font-mono mt-4 pt-4 border-t border-slate-100 inline-block w-full">
                                SYSTEM v2.0 - READY
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
