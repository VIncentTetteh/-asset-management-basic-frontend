"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { DataErrorState } from "@/components/patterns/DataErrorState";
import { formatLocalDate } from "@/lib/local-date";
import { cn } from "@/lib/utils";
import { useTrendsInsight } from "@/features/insights/hooks";
import {
    AsOfLine,
    Money,
    NothingFound,
    Panel,
    WithheldNote,
    formatCount,
} from "@/features/insights/shared";
import type { TrendPoint, TrendsInsight } from "@/features/insights/types";

/**
 * "What has actually changed?"
 *
 * Read from recorded snapshots, never reconstructed — and the honesty rules are
 * the feature here, not the chart:
 *
 *   - **A new tenant has no history, and the API says so.** When
 *     `sufficientHistory` is false this renders the backend's own `note` and
 *     the points it does have, and draws no chart. A flat line at zero would be
 *     a claim that the estate was empty for ninety days.
 *   - **A currency change breaks the line.** When the tenant changed base
 *     currency mid-series the snapshots are in two different units; the series
 *     is drawn as separate segments with a stated break, never a smooth line
 *     through the step.
 *   - **The chart is never the only representation.** Every series has a text
 *     summary and a full data table, so the information survives greyscale,
 *     colour-blindness and a screen reader.
 */

const WINDOWS = [30, 90, 180, 365] as const;

/** Fewer than this and there is nothing a line could usefully show. */
const MIN_DRAWABLE_POINTS = 2;

interface Metric {
    key: string;
    label: string;
    money: boolean;
    value: (point: TrendPoint) => number | null;
}

const METRICS: readonly Metric[] = [
    { key: "assetCount", label: "Assets on the books", money: false, value: (p) => p.assetCount },
    { key: "notSeenAssetCount", label: "In stock, not seen recently", money: false, value: (p) => p.notSeenAssetCount },
    { key: "unassignedInUseCount", label: "In use, nobody assigned", money: false, value: (p) => p.unassignedInUseCount },
    { key: "overdueMaintenanceCount", label: "Overdue maintenance", money: false, value: (p) => p.overdueMaintenanceCount },
    { key: "licenceSeatsUsed", label: "Licence seats in use", money: false, value: (p) => p.licenceSeatsUsed },
    { key: "netBookValue", label: "Net book value", money: true, value: (p) => p.netBookValue },
    { key: "totalCost", label: "Original cost", money: true, value: (p) => p.totalCost },
];

export function TrendsSurface() {
    const [days, setDays] = useState<number>(90);
    const [metricKey, setMetricKey] = useState<string>("assetCount");
    const { data, isLoading, error, refetch, isFetching } = useTrendsInsight(days);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label htmlFor="trends-window" className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-faint-fg">
                        Window
                    </label>
                    <Select
                        id="trends-window"
                        className="w-36"
                        value={String(days)}
                        onChange={(event) => setDays(Number(event.target.value))}
                    >
                        {WINDOWS.map((value) => (
                            <option key={value} value={value}>{`Last ${value} days`}</option>
                        ))}
                    </Select>
                </div>
                <div>
                    <label htmlFor="trends-metric" className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-faint-fg">
                        Measure
                    </label>
                    <Select
                        id="trends-metric"
                        className="w-56"
                        value={metricKey}
                        onChange={(event) => setMetricKey(event.target.value)}
                    >
                        {METRICS.map((metric) => (
                            <option key={metric.key} value={metric.key}>{metric.label}</option>
                        ))}
                    </Select>
                </div>
            </div>

            {error != null ? (
                <DataErrorState what="your recorded trends" error={error} onRetry={refetch} isRetrying={isFetching} />
            ) : isLoading || !data ? (
                <div className="space-y-4" data-testid="trends-loading">
                    <Skeleton className="h-24 rounded-card" />
                    <Skeleton className="h-72 rounded-card" />
                </div>
            ) : (
                <TrendsBody data={data} metric={METRICS.find((m) => m.key === metricKey) ?? METRICS[0]} />
            )}
        </div>
    );
}

function TrendsBody({ data, metric }: { data: TrendsInsight; metric: Metric }) {
    const currency = data.currency ?? data.currencies[data.currencies.length - 1] ?? "";
    const drawable = data.sufficientHistory && data.points.length >= MIN_DRAWABLE_POINTS;

    return (
        <div className="space-y-4">
            <AsOfLine asOf={data.asOf} generatedAt={data.generatedAt} />
            <WithheldNote sections={data.withheldSections} />

            <HistoryNote data={data} />

            {data.currencyChanged ? (
                <Alert tone="warn" live={false} title="The base currency changed during this window" data-testid="trends-currency-changed">
                    Snapshots in this window are recorded in {data.currencies.join(" and ")}. The series is drawn as
                    separate segments and the parts are not comparable as money — a single line through the change
                    would be two different units joined end to end.
                </Alert>
            ) : null}

            {data.anyIncomplete ? (
                <Alert tone="warn" live={false} title="Some snapshots are incomplete" data-testid="trends-incomplete">
                    At least one day&apos;s figures excluded an amount that had no exchange rate on that day. Those
                    points are a floor, not the full value.
                </Alert>
            ) : null}

            {data.points.length === 0 ? (
                <NothingFound>
                    There is nothing recorded for this window yet, so there is nothing to draw or list.
                </NothingFound>
            ) : (
                <>
                    {drawable ? (
                        <Panel
                            title={metric.label}
                            description={`${formatCount(data.pointCount)} day${data.pointCount === 1 ? "" : "s"} recorded in this window. Nothing is smoothed, filled in or extrapolated.`}
                        >
                            <TrendChart data={data} metric={metric} currency={currency} />
                        </Panel>
                    ) : null}

                    <ChangeSummary data={data} currency={currency} />
                    <PointsTable data={data} currency={currency} />
                </>
            )}
        </div>
    );
}

/**
 * The backend's own words about how much history exists. Shown whenever it says
 * anything — a thin series is a fact about the tenant, not an error.
 */
function HistoryNote({ data }: { data: TrendsInsight }) {
    if (data.sufficientHistory && !data.note) return null;
    return (
        <Alert
            tone="info"
            live={false}
            title={data.points.length === 0 ? "No history recorded yet" : "Not enough history for a trend"}
            data-testid="trends-note"
        >
            {data.note ?? "There is too little recorded history in this window to show a trend."}
            {data.firstSnapshot ? (
                <span className="mt-1 block">
                    First snapshot: {formatLocalDate(data.firstSnapshot)} ({formatCount(data.historyDays)} day
                    {data.historyDays === 1 ? "" : "s"} of history).
                </span>
            ) : null}
        </Alert>
    );
}

// ── Chart ────────────────────────────────────────────────────────────────────

const VIEW_W = 640;
const VIEW_H = 180;
const PAD = 8;

interface Plotted {
    x: number;
    y: number;
    point: TrendPoint;
    raw: number;
}

/**
 * Splits the series into segments that may be joined by a line. A segment ends
 * at a missing value and at a change of currency — the two cases where
 * connecting the dots would assert something untrue.
 */
function segmentPoints(points: readonly TrendPoint[], metric: Metric): TrendPoint[][] {
    const segments: TrendPoint[][] = [];
    let current: TrendPoint[] = [];
    let currency: string | null = null;
    for (const point of points) {
        const value = metric.value(point);
        const breaksOnCurrency = currency !== null && point.currency !== currency;
        if (value == null || breaksOnCurrency) {
            if (current.length > 0) segments.push(current);
            current = [];
        }
        currency = point.currency;
        if (value == null) continue;
        current.push(point);
    }
    if (current.length > 0) segments.push(current);
    return segments;
}

function TrendChart({ data, metric, currency }: { data: TrendsInsight; metric: Metric; currency: string }) {
    const segments = useMemo(() => segmentPoints(data.points, metric), [data.points, metric]);

    const values = data.points.map(metric.value).filter((v): v is number => v != null);
    if (values.length === 0) {
        return (
            <NothingFound>
                No {metric.label.toLowerCase()} was recorded on any day in this window. That is not zero — it was not
                measured, usually because valuations are not visible to you.
            </NothingFound>
        );
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.abs(max) || 1;
    const first = values[0];
    const last = values[values.length - 1];

    const xFor = (index: number) =>
        PAD + (data.points.length === 1 ? (VIEW_W - PAD * 2) / 2 : (index / (data.points.length - 1)) * (VIEW_W - PAD * 2));
    const yFor = (value: number) => VIEW_H - PAD - ((value - min) / span) * (VIEW_H - PAD * 2);

    const indexOf = new Map(data.points.map((p, i) => [p.date, i]));
    const plotted: Plotted[][] = segments.map((segment) =>
        segment.map((point) => {
            const raw = metric.value(point) as number;
            return { x: xFor(indexOf.get(point.date) ?? 0), y: yFor(raw), point, raw };
        }),
    );

    const describe = (value: number) =>
        metric.money ? `${currency} ${value.toLocaleString()}` : formatCount(value);

    const direction = last > first ? "risen" : last < first ? "fallen" : "stayed level";
    const summary =
        `${metric.label} has ${direction} from ${describe(first)} on ${formatLocalDate(data.points[0].date)} `
        + `to ${describe(last)} on ${formatLocalDate(data.points[data.points.length - 1].date)}, `
        + `over ${formatCount(data.points.length)} recorded days.`;

    return (
        <div className="space-y-3">
            {/* The chart is decorative relative to the summary and table below it:
                everything it shows is also stated in words and in a table, so a
                screen reader, a greyscale printout and a colour-blind reader all
                get the same information. */}
            <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                className="h-40 w-full"
                role="img"
                aria-label={summary}
                data-testid="trend-chart"
                data-segments={plotted.length}
            >
                <line
                    x1={PAD} y1={VIEW_H - PAD} x2={VIEW_W - PAD} y2={VIEW_H - PAD}
                    stroke="var(--border)" strokeWidth={1}
                />
                {plotted.map((segment, index) => (
                    <g key={index}>
                        <polyline
                            fill="none"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            points={segment.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                        />
                        {segment.map((p) => (
                            <circle key={p.point.date} cx={p.x} cy={p.y} r={2.5} fill="var(--primary)" />
                        ))}
                    </g>
                ))}
            </svg>

            <p className="text-[13px] text-muted-fg" data-testid="trend-summary">{summary}</p>
            {plotted.length > 1 ? (
                <p className="text-xs text-muted-fg">
                    Drawn as {formatCount(plotted.length)} separate segments: the line is broken wherever a day was not
                    measured or the base currency changed.
                </p>
            ) : null}
            <p className="text-xs text-muted-fg">
                Range over the window: {describe(min)} to {describe(max)}.
            </p>
        </div>
    );
}

// ── Change and table ─────────────────────────────────────────────────────────

function ChangeSummary({ data, currency }: { data: TrendsInsight; currency: string }) {
    const change = data.change;
    if (!change.comparable) {
        return (
            <Panel title="Change over the window">
                <p className="text-[13px] text-muted-fg" data-testid="trends-change">
                    There is only one recorded day in this window, so there is nothing to compare it against. That is
                    not &quot;no change&quot; — it is no comparison.
                </p>
            </Panel>
        );
    }

    const rows: { label: string; value: number | null; money?: boolean }[] = [
        { label: "Assets on the books", value: change.assetCount },
        { label: "In stock, not seen recently", value: change.notSeenAssetCount },
        { label: "In use, nobody assigned", value: change.unassignedInUseCount },
        { label: "Overdue maintenance", value: change.overdueMaintenanceCount },
        { label: "Licence seats in use", value: change.licenceSeatsUsed },
        { label: "Net book value", value: change.netBookValue, money: true },
        { label: "Original cost", value: change.totalCost, money: true },
    ];

    return (
        <Panel
            title="Change over the window"
            description={
                change.from && change.to
                    ? `${formatLocalDate(change.from)} to ${formatLocalDate(change.to)}, first recorded day against last.`
                    : undefined
            }
        >
            {!change.moneyComparable ? (
                <p className="mb-3 text-[13px] text-warn" data-testid="trends-money-incomparable">
                    {change.note ?? "The base currency changed during this window, so money cannot be compared."}
                </p>
            ) : null}
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {rows
                    .filter((row) => row.value !== null || (row.money && change.moneyComparable))
                    .map((row) => (
                        <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-edge-subtle py-1.5">
                            <dt className="text-[13px] text-muted-fg">{row.label}</dt>
                            <dd
                                className={cn(
                                    "data-mono text-sm font-semibold",
                                    row.value == null ? "text-muted-fg"
                                        : row.value > 0 ? "text-foreground"
                                            : row.value < 0 ? "text-foreground" : "text-muted-fg",
                                )}
                            >
                                {row.value == null ? (
                                    "Not comparable"
                                ) : row.money ? (
                                    <>
                                        {row.value >= 0 ? "+" : "−"}
                                        <Money value={Math.abs(row.value)} currency={change.currency ?? currency} />
                                    </>
                                ) : (
                                    `${row.value >= 0 ? "+" : "−"}${formatCount(Math.abs(row.value))}`
                                )}
                            </dd>
                        </div>
                    ))}
            </dl>
        </Panel>
    );
}

function PointsTable({ data, currency }: { data: TrendsInsight; currency: string }) {
    return (
        <Panel
            title="Every recorded day"
            description="The chart above is drawn from exactly these rows."
        >
            <div className="max-h-96 overflow-auto">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                    <caption className="sr-only">Recorded snapshots, one row per day.</caption>
                    <thead className="sticky top-0">
                        <tr className="border-b border-edge bg-surface-muted text-left text-xs uppercase tracking-[0.06em] text-faint-fg">
                            <th scope="col" className="px-3 py-2 font-semibold">Day</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">Assets</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">Not seen</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">Overdue</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">Seats used</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">Book value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.points.map((point) => (
                            <tr key={point.date} className="border-b border-edge-subtle last:border-b-0">
                                <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                                    {formatLocalDate(point.date)}
                                    {point.currency && point.currency !== currency ? (
                                        <span className="ml-2 text-xs text-warn">recorded in {point.currency}</span>
                                    ) : null}
                                    {!point.complete ? (
                                        <span className="block text-xs text-warn">excludes unconverted amounts</span>
                                    ) : null}
                                </th>
                                <td className="data-mono px-3 py-2 text-right">{formatCount(point.assetCount)}</td>
                                <td className="data-mono px-3 py-2 text-right">{formatCount(point.notSeenAssetCount)}</td>
                                <td className="data-mono px-3 py-2 text-right">{formatCount(point.overdueMaintenanceCount)}</td>
                                <td className="data-mono px-3 py-2 text-right">
                                    {formatCount(point.licenceSeatsUsed)}
                                    <span className="text-xs text-muted-fg">{` / ${formatCount(point.licenceSeatsTotal)}`}</span>
                                </td>
                                <td className="data-mono px-3 py-2 text-right">
                                    <Money value={point.netBookValue} currency={point.currency ?? currency} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}
