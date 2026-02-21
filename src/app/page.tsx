"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Hexagon,
    Building2,
    Users,
    Wrench,
    AlertTriangle,
    CheckCircle2,
    Activity,
    ShoppingCart,
    Clock
} from "lucide-react";
import { assetService } from "@/services/assetService";
import { organisationService } from "@/services/organisationService";
import { userService } from "@/services/userService";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { maintenanceService } from "@/services/maintenanceService";

export default function Home() {
    const [stats, setStats] = useState({
        totalAssets: 0,
        activeAssets: 0,
        totalOrganisations: 0,
        totalUsers: 0,
        pendingPOs: 0,
        scheduledMaintenance: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // In a real app, there'd be a dedicated /dashboard endpoint. 
                // We're simulating it by calling the lists and counting them.
                const [assets, orgs, users, pos, maint] = await Promise.all([
                    assetService.getAll(),
                    organisationService.getAll(),
                    userService.getAll(),
                    purchaseOrderService.getAll(),
                    maintenanceService.getAll()
                ]);

                setStats({
                    totalAssets: assets.length,
                    activeAssets: assets.filter(a => a.status === 'AVAILABLE' || a.status === 'IN_USE').length,
                    totalOrganisations: orgs.length,
                    totalUsers: users.length,
                    pendingPOs: pos.filter(po => po.status === 'PENDING_APPROVAL').length,
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
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard Overview</h1>
                <p className="text-slate-500 mt-1">Platform metrics and system health at a glance.</p>
            </div>

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
