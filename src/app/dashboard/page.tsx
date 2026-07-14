"use client";

import { AlertTriangle, PackagePlus, FileText } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useDashboardData } from "@/features/dashboard/hooks";
import {
  KpiRow,
  AssetHealthCard,
  ActionRequiredCard,
  DepartmentsCard,
  DepreciationCard,
  MaintenanceAlertsCard,
  QuickNav,
} from "@/features/dashboard/sections";

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { format } = useCurrency();
  const { data, isLoading, isError, refetch } = useDashboardData();

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-danger" />
        <h2 className="text-xl font-bold text-foreground">Dashboard failed to load</h2>
        <p className="text-sm text-muted-fg">An error occurred while fetching dashboard data.</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (isLoading || !data) return <DashboardSkeleton />;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="page-enter space-y-4">
      <PageHeader
        title={data.myOrg ? data.myOrg.name : "Dashboard"}
        subtitle={`${today} · your estate at a glance`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/reports">
                <FileText className="mr-2 h-4 w-4" /> Reports
              </Link>
            </Button>
            <Button asChild>
              <Link href="/assets">
                <PackagePlus className="mr-2 h-4 w-4" /> Add asset
              </Link>
            </Button>
          </>
        }
      />

      <KpiRow stats={data.stats} budgetStats={data.budgetStats} format={format} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AssetHealthCard breakdown={data.assetStatusBreakdown} />
        <ActionRequiredCard stats={data.stats} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DepartmentsCard assetsByDepartment={data.assetsByDepartment} format={format} />
        <DepreciationCard summary={data.depreciationSummary} format={format} />
      </div>

      <MaintenanceAlertsCard alerts={data.maintenanceAlerts} />

      <QuickNav />
    </div>
  );
}
