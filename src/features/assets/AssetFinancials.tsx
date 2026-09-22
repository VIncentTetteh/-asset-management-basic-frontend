"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import type { Asset, Category } from "@/types";
import { assetService } from "@/services/assetService";
import { formatMoney, FALLBACK_CURRENCY } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";
import { depreciationMethodLabel, usefulLifeLabel } from "@/features/assets/depreciation";
import { MissingRatesNotice } from "@/components/currency/MissingRatesNotice";

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-xs text-muted-fg">{label}</dt>
      <dd className={`data-mono text-sm ${strong ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}

/**
 * Financials for one asset, all in the asset's own currency: cost, book value and
 * depreciation (computed server-side as of today) plus the TCO breakdown.
 */
export function AssetFinancials({ asset, category }: { asset: Asset; category?: Category }) {
  const currency = asset.currency || FALLBACK_CURRENCY;
  const money = (amount?: number | null) => (amount == null ? "—" : formatMoney(amount, currency));
  const tco = useQuery({
    queryKey: ["assets", "tco", asset.id],
    queryFn: () => assetService.getTco(asset.id as string),
    enabled: Boolean(asset.id),
  });

  const lifeFromAsset = Boolean(asset.usefulLifeMonths);
  const configured = asset.depreciationConfigured !== false;

  return (
    <div className="space-y-5">
      {!configured ? (
        <div role="status" className="flex gap-2 rounded-control border border-edge-subtle bg-surface-muted p-3 text-xs text-muted-fg">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--warning)]" />
          <p>
            Depreciation isn&apos;t configured for this asset, so it is carried at cost. Set a useful life on the
            asset, or{" "}
            <Link href="/categories" className="ea-focus rounded-sm font-semibold text-brand hover:underline">
              assign a depreciation policy
            </Link>{" "}
            to {category ? <>the <strong>{category.name}</strong> category</> : "its category"}.
            {!asset.purchaseDate ? " A purchase date is also required." : ""}
          </p>
        </div>
      ) : null}

      <section aria-labelledby="asset-value-heading">
        <h4 id="asset-value-heading" className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">
          Value ({currency})
        </h4>
        <dl className="divide-y divide-edge-subtle">
          <Row label="Purchase cost" value={money(asset.purchaseCost)} />
          <Row label="Accumulated depreciation" value={money(asset.accumulatedDepreciation)} />
          <Row label="Current book value" value={money(asset.currentBookValue)} strong />
          <Row
            label="Monthly depreciation"
            value={asset.fullyDepreciated ? `${money(0)} (fully depreciated)` : money(asset.monthlyDepreciation)}
          />
        </dl>
      </section>

      <section aria-labelledby="asset-depreciation-heading">
        <h4 id="asset-depreciation-heading" className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">
          Depreciation settings
          <span className="ml-2 text-xs font-normal text-muted-fg">
            {lifeFromAsset ? "set on the asset" : configured ? "from the category policy" : ""}
          </span>
        </h4>
        <dl className="divide-y divide-edge-subtle">
          <Row label="Method" value={depreciationMethodLabel(asset.effectiveDepreciationMethod ?? asset.depreciationMethod)} />
          <Row label="Useful life" value={usefulLifeLabel(asset.effectiveUsefulLifeMonths ?? asset.usefulLifeMonths)} />
          <Row label="Residual value" value={money(asset.effectiveResidualValue ?? asset.residualValue)} />
        </dl>
      </section>

      <section aria-labelledby="asset-tco-heading">
        <h4 id="asset-tco-heading" className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">
          Total cost of ownership
        </h4>
        {tco.isLoading ? (
          <Skeleton className="mt-2 h-24 w-full" />
        ) : tco.isError || !tco.data ? (
          <p className="py-2 text-xs text-muted-fg">Total cost of ownership is unavailable.</p>
        ) : (
          <>
          <MissingRatesNotice
            className="mt-2"
            incomplete={tco.data.complete === false}
            missingRates={tco.data.missingRates ?? []}
          />
          <dl className="divide-y divide-edge-subtle">
            <Row label="Acquisition" value={formatMoney(tco.data.acquisitionCost ?? 0, tco.data.currency || currency)} />
            <Row
              label={`Maintenance (${tco.data.maintenanceRecordCount ?? 0} record${tco.data.maintenanceRecordCount === 1 ? "" : "s"})`}
              value={formatMoney(tco.data.totalMaintenanceCost ?? 0, tco.data.currency || currency)}
            />
            <Row label="Insurance" value={formatMoney(tco.data.totalInsuranceCost ?? 0, tco.data.currency || currency)} />
            <Row
              label={`Downtime (${tco.data.downtimeDays ?? 0} day${tco.data.downtimeDays === 1 ? "" : "s"})`}
              value={formatMoney(tco.data.totalDowntimeCost ?? 0, tco.data.currency || currency)}
            />
            <Row
              label="Less disposal recovery"
              value={`- ${formatMoney(tco.data.disposalRecovery ?? 0, tco.data.currency || currency)}`}
            />
            <Row label="Net TCO" value={formatMoney(tco.data.netTco ?? 0, tco.data.currency || currency)} strong />
          </dl>
          </>
        )}
      </section>
    </div>
  );
}
