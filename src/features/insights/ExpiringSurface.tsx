"use client";

import { useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { DataErrorState } from "@/components/patterns/DataErrorState";
import { formatLocalDate } from "@/lib/local-date";
import { cn } from "@/lib/utils";
import { useExpiryInsight } from "@/features/insights/hooks";
import { REGISTER_LABELS, REGISTER_PATHS, insightRecordHref } from "@/features/insights/filters";
import {
    AsOfLine,
    Figure,
    IncompleteNote,
    Money,
    NothingFound,
    Panel,
    ShareBar,
    WithheldNote,
    formatCount,
} from "@/features/insights/shared";
import type { ExpiryInsight, ExpiryStream } from "@/features/insights/types";

/**
 * "What is about to bite me?"
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 *   - **The buckets come from the response.** Their keys and labels are derived
 *     server-side from `horizonDays`, so a 30-day horizon and a 365-day horizon
 *     produce different windows. Nothing here hardcodes "0-29 days"; the
 *     component renders whatever the payload names.
 *   - **A stream the caller may not read is simply absent.** It is named in
 *     `withheldSections` and rendered by {@link WithheldNote} as "you do not
 *     have access to…". It is never drawn as a stream with zero in it, because
 *     "no contracts are expiring" and "you may not see contracts" would then
 *     look identical.
 */

const HORIZONS = [30, 90, 180, 365] as const;

/** `DUE_60_90` → `[60, 90]`. `OVERDUE` and anything unparseable → null. */
function bucketRange(key: string): [number, number] | null {
    const match = /^DUE_(\d+)_(\d+)$/.exec(key);
    return match ? [Number(match[1]), Number(match[2])] : null;
}

/**
 * Drops a bucket whose day range is entirely inside an earlier bucket's.
 *
 * At every horizon the backend emits one extra trailing window — `DUE_90_90`
 * after `DUE_60_90`, `DUE_360_365` after `DUE_330_365` — and nothing can ever
 * land in it, because its own bucketing picks the *first* window containing a
 * day. Rendering it puts a permanent "Due in 90-90 days — 0" row under every
 * stream, which reads as a defect rather than as data.
 *
 * This is safe rather than clever: the dropped bucket is provably always empty,
 * so nothing is hidden. Buckets are otherwise rendered exactly as sent — the
 * keys and labels are derived from `horizonDays` server-side and are never
 * assumed here. (Reported upstream; remove this once the backend stops emitting
 * the duplicate.)
 */
function drawableBuckets<T extends { bucket: string; count: number }>(buckets: readonly T[]): T[] {
    const kept: T[] = [];
    const ranges: [number, number][] = [];
    for (const bucket of buckets) {
        const range = bucketRange(bucket.bucket);
        const covered = range != null
            && bucket.count === 0
            && ranges.some(([from, to]) => range[0] >= from && range[1] <= to);
        if (covered) continue;
        if (range) ranges.push(range);
        kept.push(bucket);
    }
    return kept;
}

export function ExpiringSurface() {
    const [horizonDays, setHorizonDays] = useState<number>(90);
    const { data, isLoading, error, refetch, isFetching } = useExpiryInsight({ horizonDays, limit: 10 });

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="expiry-horizon" className="text-xs font-semibold uppercase tracking-[0.06em] text-faint-fg">
                    Look ahead
                </label>
                <Select
                    id="expiry-horizon"
                    className="w-40"
                    value={String(horizonDays)}
                    onChange={(event) => setHorizonDays(Number(event.target.value))}
                >
                    {HORIZONS.map((days) => (
                        <option key={days} value={days}>{`${days} days`}</option>
                    ))}
                </Select>
            </div>

            {error != null ? (
                <DataErrorState
                    what="what is expiring"
                    error={error}
                    onRetry={refetch}
                    isRetrying={isFetching}
                />
            ) : isLoading || !data ? (
                <div className="space-y-4" data-testid="expiring-loading">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-24 rounded-card" />)}
                    </div>
                    <Skeleton className="h-72 rounded-card" />
                </div>
            ) : (
                <ExpiringBody data={data} />
            )}
        </div>
    );
}

function ExpiringBody({ data }: { data: ExpiryInsight }) {
    const nothingAtAll = data.totals.overdue === 0 && data.totals.dueWithinHorizon === 0;
    return (
        <div className="space-y-4">
            <AsOfLine asOf={data.asOf} generatedAt={data.generatedAt} />
            <WithheldNote sections={data.withheldSections} />
            <IncompleteNote complete={data.complete} missingRates={data.missingRates} what="The values below" />

            <div className="grid gap-3 sm:grid-cols-2">
                <Figure
                    label="Already past due"
                    value={formatCount(data.totals.overdue)}
                    note="Cover that has already lapsed, whatever the horizon"
                    tone={data.totals.overdue > 0 ? "danger" : "default"}
                    testId="expiry-overdue"
                />
                <Figure
                    label={`Due within ${formatCount(data.horizonDays)} days`}
                    value={formatCount(data.totals.dueWithinHorizon)}
                    note={data.horizonEnd ? `On or before ${formatLocalDate(data.horizonEnd)}` : undefined}
                    tone={data.totals.dueWithinHorizon > 0 ? "warn" : "default"}
                    testId="expiry-due"
                />
            </div>

            {data.streams.length === 0 ? (
                <NothingFound>
                    No streams were returned. If you expected warranties or contracts here, check the note above about
                    what your permissions hide.
                </NothingFound>
            ) : nothingAtAll ? (
                <NothingFound>
                    Nothing in the {formatCount(data.streams.length)} stream
                    {data.streams.length === 1 ? "" : "s"} you can see falls due in the next{" "}
                    {formatCount(data.horizonDays)} days, and nothing is overdue.
                </NothingFound>
            ) : (
                <div className="space-y-3">
                    {data.streams.map((stream) => (
                        <StreamPanel key={stream.key} stream={stream} currency={data.currency} showsMoney={data.showsMoney} />
                    ))}
                </div>
            )}
        </div>
    );
}

function StreamPanel({
    stream,
    currency,
    showsMoney,
}: {
    stream: ExpiryStream;
    currency: string;
    showsMoney: boolean;
}) {
    const total = stream.overdue + stream.dueWithinHorizon;
    const buckets = drawableBuckets(stream.buckets);
    const busiest = Math.max(1, ...buckets.map((b) => b.count));
    const registerHref = REGISTER_PATHS[stream.resourceType];

    return (
        <Panel
            title={stream.label}
            description={
                total === 0
                    ? "Nothing due in this window."
                    : `Value shown is the ${stream.valueMeaning}.`
            }
            actions={
                <Link
                    href={registerHref}
                    className="ea-focus rounded-sm text-[13px] font-semibold text-brand underline-offset-2 hover:underline"
                >
                    Open {REGISTER_LABELS[stream.resourceType]}
                </Link>
            }
            className={total === 0 ? "opacity-75" : undefined}
        >
            {total === 0 ? (
                <p className="text-[13px] text-muted-fg">
                    Nothing is overdue and nothing falls due inside the horizon.
                </p>
            ) : (
                <div className="space-y-4">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[26rem] border-collapse text-sm">
                            <caption className="sr-only">
                                {`${stream.label} by how soon they fall due. Value is the ${stream.valueMeaning}.`}
                            </caption>
                            <thead>
                                <tr className="border-b border-edge bg-surface-muted text-left text-xs uppercase tracking-[0.06em] text-faint-fg">
                                    <th scope="col" className="px-3 py-2 font-semibold">When</th>
                                    <th scope="col" className="px-3 py-2 text-right font-semibold">Count</th>
                                    {showsMoney ? (
                                        <th scope="col" className="px-3 py-2 text-right font-semibold">Value</th>
                                    ) : null}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Bucket keys and labels are whatever the horizon produced — read, never assumed. */}
                                {buckets.map((bucket) => (
                                    <tr key={bucket.bucket} className="border-b border-edge-subtle last:border-b-0">
                                        <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                                            <span className={cn(bucket.bucket === "OVERDUE" && bucket.count > 0 && "text-danger")}>
                                                {bucket.label}
                                            </span>
                                            <ShareBar
                                                className="mt-1 max-w-40"
                                                share={(bucket.count / busiest) * 100}
                                                tone={bucket.bucket === "OVERDUE" ? "danger" : "brand"}
                                            />
                                        </th>
                                        <td className="data-mono px-3 py-2 text-right text-foreground">
                                            {formatCount(bucket.count)}
                                        </td>
                                        {showsMoney ? (
                                            <td className="data-mono px-3 py-2 text-right text-foreground">
                                                <Money value={bucket.value} currency={currency} />
                                                {!bucket.valueComplete ? (
                                                    <span
                                                        className="block text-xs text-warn"
                                                        title="At least one amount in this bucket had no exchange rate and was left out."
                                                    >
                                                        excludes some amounts
                                                    </span>
                                                ) : null}
                                            </td>
                                        ) : null}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {stream.items.length > 0 ? (
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-faint-fg">
                                Soonest first
                            </p>
                            <ul className="divide-y divide-edge-subtle">
                                {stream.items.map((item) => (
                                    <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                                        <div className="min-w-0">
                                            <Link
                                                href={insightRecordHref(item.resourceType, item.id)}
                                                className="ea-focus rounded-sm text-[13px] font-semibold text-foreground underline-offset-2 hover:text-brand hover:underline"
                                            >
                                                {item.name}
                                            </Link>
                                            {item.relatedName ? (
                                                <span className="ml-2 text-xs text-muted-fg">{item.relatedName}</span>
                                            ) : null}
                                        </div>
                                        <div className="text-right text-xs">
                                            <p className={cn("font-semibold", item.overdue ? "text-danger" : "text-muted-fg")}>
                                                {item.overdue
                                                    ? `${formatCount(Math.abs(item.daysUntil))} days overdue`
                                                    : item.daysUntil === 0
                                                        ? "Due today"
                                                        : `in ${formatCount(item.daysUntil)} days`}
                                            </p>
                                            <p className="text-muted-fg">
                                                {formatLocalDate(item.dueDate)}
                                                {showsMoney ? (
                                                    <>
                                                        {" · "}
                                                        <Money value={item.value} currency={currency} className="data-mono" />
                                                    </>
                                                ) : null}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            {stream.truncated ? (
                                <p className="mt-2 text-xs text-muted-fg">
                                    Showing {formatCount(stream.items.length)} of {formatCount(total)}.
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            )}
        </Panel>
    );
}
