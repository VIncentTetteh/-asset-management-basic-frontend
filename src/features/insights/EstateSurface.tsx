"use client";

import { useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { DataErrorState } from "@/components/patterns/DataErrorState";
import { cn } from "@/lib/utils";
import { useEstateInsight } from "@/features/insights/hooks";
import {
    AsOfLine,
    Figure,
    FilterLink,
    IncompleteNote,
    Money,
    NothingFound,
    Panel,
    Percent,
    ShareBar,
    WithheldNote,
    formatCount,
} from "@/features/insights/shared";
import { ESTATE_DIMENSIONS, type EstateDimension } from "@/features/insights/types";

/**
 * "What is my estate worth, and where is it?"
 *
 * Every row is a link through to the assets behind it — that is the difference
 * between a breakdown and a picture of one. The exception is the "no
 * department / uncategorised" row, whose filter is `{ departmentId: null }`:
 * a real set of records that the asset register has no way to ask for, so the
 * row says so instead of offering a link that would show everything.
 */

const DIMENSION_LABELS: Record<EstateDimension, string> = {
    department: "Department",
    location: "Location",
    category: "Category",
    status: "Status",
    condition: "Condition",
};

export function EstateSurface() {
    const [groupBy, setGroupBy] = useState<EstateDimension>("department");
    const { data, isLoading, error, refetch, isFetching } = useEstateInsight(groupBy);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-faint-fg">Break down by</span>
                {ESTATE_DIMENSIONS.map((dimension) => (
                    <button
                        key={dimension}
                        type="button"
                        aria-pressed={groupBy === dimension}
                        onClick={() => setGroupBy(dimension)}
                        className={cn(
                            "ea-focus rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                            groupBy === dimension
                                ? "bg-brand text-white"
                                : "border border-edge bg-surface text-muted-fg hover:bg-surface-muted",
                        )}
                    >
                        {DIMENSION_LABELS[dimension]}
                    </button>
                ))}
            </div>

            {error != null ? (
                <DataErrorState
                    what="your estate valuation"
                    error={error}
                    onRetry={refetch}
                    isRetrying={isFetching}
                />
            ) : isLoading || !data ? (
                <EstateSkeleton />
            ) : (
                <EstateBody data={data} groupBy={groupBy} />
            )}
        </div>
    );
}

function EstateSkeleton() {
    return (
        <div className="space-y-4" data-testid="estate-loading">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-24 rounded-card" />
                ))}
            </div>
            <Skeleton className="h-64 rounded-card" />
        </div>
    );
}

function EstateBody({
    data,
    groupBy,
}: {
    data: NonNullable<ReturnType<typeof useEstateInsight>["data"]>;
    groupBy: EstateDimension;
}) {
    const { currency, showsMoney } = data;
    const dimensionLabel = DIMENSION_LABELS[data.groupBy] ?? DIMENSION_LABELS[groupBy];

    return (
        <div className="space-y-4">
            <AsOfLine asOf={data.asOf} generatedAt={data.generatedAt} />
            <WithheldNote sections={data.withheldSections} />
            <IncompleteNote
                complete={data.complete}
                missingRates={data.missingRates}
                what="These valuations"
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Figure
                    label="Assets on the books"
                    value={formatCount(data.assetCount)}
                    note="Everything not disposed of"
                    href="/assets"
                    testId="estate-asset-count"
                />
                {showsMoney ? (
                    <>
                        <Figure
                            label="Original cost"
                            value={<Money value={data.totalCost} currency={currency} />}
                            note="What was paid, before depreciation"
                        />
                        <Figure
                            label="Net book value"
                            value={<Money value={data.netBookValue} currency={currency} />}
                            note={
                                <>
                                    <Money value={data.accumulatedDepreciation} currency={currency} /> written off so far
                                </>
                            }
                        />
                        <Figure
                            label="Monthly depreciation"
                            value={<Money value={data.monthlyDepreciation} currency={currency} />}
                            note="The charge this estate makes every month"
                        />
                    </>
                ) : null}
            </div>

            {showsMoney && (data.assetsFullyDepreciated || data.assetsMissingDepreciationSetup) ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <Figure
                        label="Fully depreciated"
                        value={formatCount(data.assetsFullyDepreciated ?? 0)}
                        note="Still in service with no book value left"
                    />
                    <Figure
                        label="No depreciation set up"
                        value={formatCount(data.assetsMissingDepreciationSetup ?? 0)}
                        note={
                            <>
                                Carried at cost.{" "}
                                <Link href="/categories" className="ea-focus rounded-sm font-semibold text-brand hover:underline">
                                    Set a policy on the category
                                </Link>
                            </>
                        }
                        tone={data.assetsMissingDepreciationSetup ? "warn" : "default"}
                    />
                </div>
            ) : null}

            <Panel
                title={`By ${dimensionLabel.toLowerCase()}`}
                description="Every row opens the assets behind it. Rows are ordered by cost."
            >
                {data.groups.length === 0 ? (
                    <NothingFound>
                        {data.assetCount === 0
                            ? "There are no assets on the books yet, so there is nothing to break down."
                            : `No ${dimensionLabel.toLowerCase()} breakdown is available to you for this estate.`}
                    </NothingFound>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[34rem] border-collapse text-sm">
                            <caption className="sr-only">
                                {`Estate broken down by ${dimensionLabel.toLowerCase()}: count, share and value of each group.`}
                            </caption>
                            <thead>
                                <tr className="border-b border-edge bg-surface-muted text-left text-xs uppercase tracking-[0.06em] text-faint-fg">
                                    <th scope="col" className="px-3 py-2 font-semibold">{dimensionLabel}</th>
                                    <th scope="col" className="px-3 py-2 text-right font-semibold">Assets</th>
                                    <th scope="col" className="px-3 py-2 text-right font-semibold">Share</th>
                                    {showsMoney ? (
                                        <>
                                            <th scope="col" className="px-3 py-2 text-right font-semibold">Cost</th>
                                            <th scope="col" className="px-3 py-2 text-right font-semibold">Book value</th>
                                        </>
                                    ) : null}
                                </tr>
                            </thead>
                            <tbody>
                                {data.groups.map((group) => (
                                    <tr
                                        key={group.id ?? `unassigned-${group.name}`}
                                        className="border-b border-edge-subtle last:border-b-0 align-top"
                                    >
                                        <th scope="row" className="px-3 py-2.5 text-left font-medium text-foreground">
                                            <span className="block">{group.name}</span>
                                            <FilterLink
                                                className="mt-1"
                                                filter={group.filter}
                                                resource="asset"
                                                countLabel={`${formatCount(group.count)} ${group.count === 1 ? "asset" : "assets"}`}
                                            />
                                        </th>
                                        <td className="data-mono px-3 py-2.5 text-right text-foreground">
                                            {formatCount(group.count)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <Percent value={group.countShare} className="data-mono text-muted-fg" />
                                            <ShareBar share={group.countShare} className="mt-1 w-20 sm:w-24" />
                                        </td>
                                        {showsMoney ? (
                                            <>
                                                <td className="data-mono px-3 py-2.5 text-right text-foreground">
                                                    <Money value={group.cost} currency={currency} />
                                                    <span className="mt-0.5 block text-xs text-muted-fg">
                                                        <Percent value={group.costShare} emptyLabel="no share" /> of cost
                                                    </span>
                                                </td>
                                                <td className="data-mono px-3 py-2.5 text-right text-foreground">
                                                    <Money value={group.netBookValue} currency={currency} />
                                                </td>
                                            </>
                                        ) : null}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
}
