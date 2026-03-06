"use client";

import { useEffect, useState } from "react";
import { analyticsService } from "@/services/analyticsService";
import { AssetAnalytics, FinancialAnalytics, PurchaseOrderAnalytics } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, ShoppingCart } from "lucide-react";

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [assetAnalytics, setAssetAnalytics] = useState<AssetAnalytics | null>(null);
    const [financialAnalytics, setFinancialAnalytics] = useState<FinancialAnalytics | null>(null);
    const [poAnalytics, setPoAnalytics] = useState<PurchaseOrderAnalytics | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [asset, financial, po] = await Promise.all([
                    analyticsService.getAssetAnalytics(),
                    analyticsService.getFinancialAnalytics(),
                    analyticsService.getPurchaseOrderAnalytics(),
                ]);
                setAssetAnalytics(asset);
                setFinancialAnalytics(financial);
                setPoAnalytics(po);
            } catch (err) {
                console.error("Failed to fetch analytics", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Asset Analytics */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Assets Assessed</CardTitle>
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{assetAnalytics?.total || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Value: ${assetAnalytics?.totalValue?.toLocaleString() || "0"}
                        </p>
                    </CardContent>
                </Card>

                {/* Financial Analytics */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Net Book Value</CardTitle>
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${financialAnalytics?.netBookValue?.toLocaleString() || "0"}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Depreciation: ${financialAnalytics?.totalDepreciation?.toLocaleString() || "0"}
                        </p>
                    </CardContent>
                </Card>

                {/* Purchase Order Analytics */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total PO Value</CardTitle>
                        <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${poAnalytics?.totalPOValue?.toLocaleString() || "0"}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {poAnalytics?.totalPOs || 0} POs in total
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Asset Breakdown */}
            {assetAnalytics && assetAnalytics.data && assetAnalytics.data.length > 0 && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Asset Breakdown by {assetAnalytics.groupBy}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-muted text-muted-foreground">
                                    <tr>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3 text-right">Count</th>
                                        <th className="px-6 py-3 text-right">Value ($)</th>
                                        <th className="px-6 py-3 text-right">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assetAnalytics.data.map((item, idx) => (
                                        <tr key={idx} className="border-b">
                                            <td className="px-6 py-4 font-medium">{item.name}</td>
                                            <td className="px-6 py-4 text-right">{item.count}</td>
                                            <td className="px-6 py-4 text-right">{item.value.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right">{item.percentage}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
