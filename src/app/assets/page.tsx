"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { assetService } from "@/services/assetService";
import { Search, FileSpreadsheet, PackagePlus } from "lucide-react";
import type { Asset } from "@/types";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSpinner } from "@/components/ui/spinner";
import { AssetDetailModal } from "@/components/assets/AssetDetailModal";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { MissingRatesNotice } from "@/components/currency/MissingRatesNotice";
import {
  useAssetFilters,
  usePagedAssets,
  useAssetStats,
  useAssetMasterData,
  useDeleteAsset,
} from "@/features/assets/hooks";
import { AssetStatsRow } from "@/features/assets/AssetStatsRow";
import { AssetFilterBar } from "@/features/assets/AssetFilterBar";
import { AssetRegisterTable } from "@/features/assets/AssetRegisterTable";
import { AssetFormModal } from "@/features/assets/AssetFormModal";
import { AssignUserModal } from "@/features/assets/AssignUserModal";
import { ImportAssetsModal } from "@/features/assets/ImportAssetsModal";

function AssetsPageInner() {
  const { filters, searchInput, setSearchInput, setParam, clearAdvanced, queryParams, hasAdvancedFilters } =
    useAssetFilters();
  const { data: paged, isLoading } = usePagedAssets(queryParams);
  const { data: stats } = useAssetStats();
  const master = useAssetMasterData();
  const deleteAsset = useDeleteAsset();
  const { format } = useCurrency();
  const { confirm, ConfirmDialog } = useConfirm();

  const [formAsset, setFormAsset] = useState<Asset | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [assignAsset, setAssignAsset] = useState<Asset | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);

  // Deep link (`/assets?id=<uuid>`, used by scanned QR labels and notifications):
  // open that asset's detail once, until the user closes it.
  const deepLinkId = useSearchParams().get("id");
  const [dismissedDeepLink, setDismissedDeepLink] = useState<string | null>(null);
  const { data: deepLinkAsset } = useQuery({
    queryKey: ["assets", "detail", deepLinkId],
    queryFn: () => assetService.get(deepLinkId as string),
    enabled: Boolean(deepLinkId),
    retry: false,
  });
  const shownAsset =
    detailAsset ?? (deepLinkAsset && dismissedDeepLink !== deepLinkId ? deepLinkAsset : null);
  const closeDetail = () => {
    setDetailAsset(null);
    setDismissedDeepLink(deepLinkId);
  };
  const [isImportOpen, setIsImportOpen] = useState(false);

  const lookups = useMemo(() => {
    const deptMap = new Map(master.departments.map((d) => [d.id, d.name]));
    const locMap = new Map(master.locations.map((l) => [l.id, l.name]));
    const userMap = new Map(master.users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return {
      deptName: (id?: string) => deptMap.get(id ?? "") ?? "—",
      locName: (id?: string) => locMap.get(id ?? "") ?? "—",
      userName: (id?: string) => userMap.get(id ?? "") ?? "Unassigned",
    };
  }, [master.departments, master.locations, master.users]);

  // Register-wide value, aggregated server-side in the base currency (not just this page).
  const registerValueLabel =
    stats?.totalValue === undefined ? undefined : format(stats.totalValue, stats.currency);

  const handleDelete = async (asset: Asset) => {
    if (!(await confirm({ message: `Delete "${asset.name}"? This cannot be undone.`, variant: "danger" }))) return;
    deleteAsset.mutate(asset.id!);
  };

  const openCreate = () => {
    setFormAsset(null);
    setIsFormOpen(true);
  };

  return (
    <ListPageTemplate
      title="Asset register"
      subtitle={
        stats
          ? `${stats.total.toLocaleString()} assets · ${stats.assigned.toLocaleString()} assigned`
          : "Loading register…"
      }
      actions={
        <>
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel
          </Button>
          <Button onClick={openCreate}>
            <PackagePlus className="mr-2 h-4 w-4" /> Add asset
          </Button>
        </>
      }
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input
            type="search"
            placeholder="Search name, tag, or model…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      <div className="space-y-4">
        <MissingRatesNotice incomplete={stats?.complete === false} missingRates={stats?.missingRates ?? []} />

        <AssetStatsRow stats={stats} totalValueLabel={registerValueLabel} />

        <AssetFilterBar
          stats={stats}
          filters={filters}
          setParam={setParam}
          clearAdvanced={clearAdvanced}
          hasAdvancedFilters={hasAdvancedFilters}
          departments={master.departments}
          locations={master.locations}
          categories={master.categories}
        />

        <AssetRegisterTable
          paged={paged}
          isLoading={isLoading}
          page={filters.page}
          onPageChange={(p) => setParam("page", String(p))}
          sort={filters.sort}
          onSortChange={(sort) => setParam("sort", sort)}
          lookups={lookups}
          format={format}
          onView={setDetailAsset}
          onAssign={setAssignAsset}
          onEdit={(a) => {
            setFormAsset(a);
            setIsFormOpen(true);
          }}
          onDelete={handleDelete}
          onCreate={openCreate}
          onImport={() => setIsImportOpen(true)}
          // Derived from the org-wide stats rather than the current page, so a filter
          // that happens to match nothing is never mistaken for an empty tenant.
          isFirstRun={stats?.total === 0}
          canCreate
        />
      </div>

      <AssetFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editingAsset={formAsset}
        categories={master.categories}
        departments={master.departments}
        locations={master.locations}
        suppliers={master.suppliers}
        purchaseOrders={master.purchaseOrders}
      />

      <AssignUserModal
        isOpen={assignAsset !== null}
        onClose={() => setAssignAsset(null)}
        asset={assignAsset}
        users={master.users}
      />

      <ImportAssetsModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />

      <AssetDetailModal
        isOpen={shownAsset !== null}
        onClose={closeDetail}
        asset={shownAsset}
        departments={master.departments}
        locations={master.locations}
        categories={master.categories}
        users={master.users}
        organisations={master.organisations}
        suppliers={master.suppliers}
        purchaseOrders={master.purchaseOrders}
      />
      {ConfirmDialog}
    </ListPageTemplate>
  );
}

export default function AssetsPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<PageSpinner label="Loading assets…" />}>
      <AssetsPageInner />
    </Suspense>
  );
}
