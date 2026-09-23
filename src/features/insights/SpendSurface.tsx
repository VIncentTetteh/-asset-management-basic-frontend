"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DataErrorState } from "@/components/patterns/DataErrorState";
import { formatLocalDate } from "@/lib/local-date";
import { cn } from "@/lib/utils";
import { useSpendInsight } from "@/features/insights/hooks";
import { insightRecordHref } from "@/features/insights/filters";
import {
    AsOfLine,
    Figure,
    IncompleteNote,
    Money,
    NothingFound,
    Panel,
    Percent,
    ShareBar,
    WithheldNote,
    formatCount,
} from "@/features/insights/shared";
import type { SpendBudget, SpendInsight } from "@/features/insights/types";

/**
 * "Where is the money going, and is it within budget?"
 *
 * The figure that makes this actionable is pace: burn compared against how much
 * of the period has elapsed. 60% spent is good news in November and bad news in
 * February, and a dashboard that shows only the 60% cannot tell you which.
 *
 * Nulls carry meaning on this surface and are rendered as words:
 *   - a percentage is null when there is no budget to be a percentage *of*;
 *   - `projectedSpendAtPeriodEnd` is null on purpose in the first 5% of a
 *     period, because extrapolating from three days produces a confident number
 *     that is worthless — the page says that rather than hiding the row;
 *   - a budget in a currency with no rate has null money but a real
 *     `burnPercent`, computed in its own currency, so the ratio still shows.
 */

export function SpendSurface() {
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const params = { from: from || undefined, to: to || undefined };
    const { data, isLoading, error, refetch, isFetching } = useSpendInsight(params);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label htmlFor="spend-from" className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-faint-fg">
                        From
                    </label>
                    <Input
                        id="spend-from"
                        type="date"
                        className="w-40"
                        value={from}
                        onChange={(event) => setFrom(event.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="spend-to" className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-faint-fg">
                        To
                    </label>
                    <Input
                        id="spend-to"
                        type="date"
                        className="w-40"
                        value={to}
                        onChange={(event) => setTo(event.target.value)}
                    />
                </div>
                <p className="pb-2 text-xs text-muted-fg">Leave blank for this calendar year.</p>
            </div>

            {error != null ? (
                <DataErrorState
                    what="your budget burn"
                    error={error}
                    onRetry={refetch}
                    isRetrying={isFetching}
                />
            ) : isLoading || !data ? (
                <div className="space-y-4" data-testid="spend-loading">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-card" />)}
                    </div>
                    <Skeleton className="h-64 rounded-card" />
                </div>
            ) : (
                <SpendBody data={data} />
            )}
        </div>
    );
}

/** "12.4 points ahead of the calendar" / "on pace". Null stays null. */
function paceSentence(points: number | null): { text: string; tone: "default" | "warn" | "danger" } {
    if (points == null) return { text: "No pace — nothing to compare against yet", tone: "default" };
    if (points > 10) return { text: `${points.toFixed(1)} points ahead of the calendar`, tone: "danger" };
    if (points > 0) return { text: `${points.toFixed(1)} points ahead of the calendar`, tone: "warn" };
    return { text: `${Math.abs(points).toFixed(1)} points behind the calendar`, tone: "default" };
}

function SpendBody({ data }: { data: SpendInsight }) {
    const pace = paceSentence(data.pacePercentagePoints);
    const noBudgets = data.budgetCount === 0;

    return (
        <div className="space-y-4">
            <AsOfLine asOf={data.asOf} generatedAt={data.generatedAt} />
            <p className="text-xs text-muted-fg">
                {data.windowStart && data.windowEnd
                    ? `${formatLocalDate(data.windowStart)} to ${formatLocalDate(data.windowEnd)}`
                    : "Current period"}
                {" · draft budgets are excluded, because they commit nothing"}
            </p>
            <WithheldNote sections={data.withheldSections} />
            <IncompleteNote complete={data.complete} missingRates={data.missingRates} what="These budget totals" />

            {noBudgets ? (
                <NothingFound>
                    No approved budget covers this window, so there is nothing to burn against. Percentages are left
                    blank rather than shown as 0%.
                </NothingFound>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Figure
                    label="Budgeted"
                    value={<Money value={data.totalBudget} currency={data.currency} />}
                    note={`${formatCount(data.budgetCount)} budget${data.budgetCount === 1 ? "" : "s"} in this window`}
                    testId="spend-budget"
                />
                <Figure
                    label="Spent"
                    value={<Money value={data.spent} currency={data.currency} />}
                    note={data.spentPercent == null
                        ? "No budget in this window to compare against"
                        : <><Percent value={data.spentPercent} /> of budget</>}
                />
                <Figure
                    label="Committed"
                    value={<Money value={data.committed} currency={data.currency} />}
                    note={data.committedPercent == null
                        ? "Already promised"
                        : <>Already promised · <Percent value={data.committedPercent} /> of budget</>}
                />
                <Figure
                    label="Available"
                    value={<Money value={data.available} currency={data.currency} />}
                    note="Budget less spend and commitments"
                    tone={data.available != null && data.available < 0 ? "danger" : "default"}
                />
            </div>

            <Panel
                title="Burn against the calendar"
                description="Commitments count as gone, because for planning purposes they are."
            >
                <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint-fg">Burn</p>
                        <p className={cn(
                            "mt-1 font-bold",
                            data.burnPercent == null ? "text-[15px] text-muted-fg" : "data-mono text-2xl text-foreground",
                        )}>
                            <Percent value={data.burnPercent} emptyLabel="No budget to burn against" />
                        </p>
                        <ShareBar
                            className="mt-2"
                            share={data.burnPercent}
                            tone={data.burnPercent != null && data.burnPercent >= 100 ? "danger" : data.burnPercent != null && data.burnPercent >= 80 ? "warn" : "brand"}
                        />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint-fg">Period elapsed</p>
                        <p className={cn(
                            "mt-1 font-bold",
                            data.periodElapsedPercent == null ? "text-[15px] text-muted-fg" : "data-mono text-2xl text-foreground",
                        )}>
                            <Percent value={data.periodElapsedPercent} emptyLabel="Period has no length" />
                        </p>
                        <ShareBar className="mt-2" share={data.periodElapsedPercent} />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint-fg">Pace</p>
                        <p
                            className={cn(
                                "mt-1 text-[15px] font-semibold",
                                pace.tone === "danger" ? "text-danger" : pace.tone === "warn" ? "text-warn" : "text-foreground",
                            )}
                            data-testid="spend-pace"
                        >
                            {pace.text}
                        </p>
                        <p className="mt-2 text-xs text-muted-fg" data-testid="spend-projection">
                            {noBudgets ? (
                                "No budget covers this window, so there is nothing to project."
                            ) : data.projectedSpendAtPeriodEnd != null ? (
                                <>
                                    At this rate the period ends at{" "}
                                    <Money
                                        value={data.projectedSpendAtPeriodEnd}
                                        currency={data.currency}
                                        className="data-mono font-semibold text-foreground"
                                    />
                                    .
                                </>
                            ) : (
                                "No projection yet: too little of the period has elapsed for a straight-line estimate to mean anything."
                            )}
                        </p>
                    </div>
                </div>
            </Panel>

            {data.budgets.length > 0 ? (
                <Panel
                    title="Budgets"
                    description={
                        data.budgetsOverThreshold > 0
                            ? `${formatCount(data.budgetsOverThreshold)} past its alert threshold. Highest burn first. The budgets register has no per-budget link, so a row opens the list.`
                            : "None past its alert threshold. Highest burn first. The budgets register has no per-budget link, so a row opens the list."
                    }
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[36rem] border-collapse text-sm">
                            <caption className="sr-only">Budgets in this window, with burn, spend and commitments.</caption>
                            <thead>
                                <tr className="border-b border-edge bg-surface-muted text-left text-xs uppercase tracking-[0.06em] text-faint-fg">
                                    <th scope="col" className="px-3 py-2 font-semibold">Budget</th>
                                    <th scope="col" className="px-3 py-2 text-right font-semibold">Burn</th>
                                    <th scope="col" className="px-3 py-2 text-right font-semibold">Spent</th>
                                    <th scope="col" className="px-3 py-2 text-right font-semibold">Committed</th>
                                    <th scope="col" className="px-3 py-2 text-right font-semibold">Budget</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.budgets.map((budget) => (
                                    <BudgetRow key={budget.id} budget={budget} currency={data.currency} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            ) : null}
        </div>
    );
}

function BudgetRow({ budget, currency }: { budget: SpendBudget; currency: string }) {
    // A budget whose currency has no rate reports null money but a real burn
    // percentage, computed in its own currency where no conversion applies.
    const unconvertible = budget.total === null && budget.burnPercent !== null;
    return (
        <tr className="border-b border-edge-subtle align-top last:border-b-0">
            <th scope="row" className="px-3 py-2.5 text-left font-medium text-foreground">
                <span className="block">{budget.name}</span>
                <span className="block text-xs text-muted-fg">
                    {budget.periodStart && budget.periodEnd
                        ? `${formatLocalDate(budget.periodStart)} – ${formatLocalDate(budget.periodEnd)}`
                        : budget.status ?? ""}
                    {budget.nativeCurrency && budget.nativeCurrency !== currency ? ` · ${budget.nativeCurrency}` : ""}
                </span>
                {unconvertible ? (
                    <span className="mt-1 block text-xs text-warn">
                        No exchange rate for {budget.nativeCurrency}, so the amounts cannot be shown in {currency}. The
                        burn below is correct — it is worked out in {budget.nativeCurrency}.
                    </span>
                ) : null}
                <Link
                    href={insightRecordHref("budget", budget.id)}
                    className="ea-focus mt-1 inline-flex items-center gap-1 rounded-sm text-[13px] font-semibold text-brand underline-offset-2 hover:underline"
                >
                    Open in Budgets <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
            </th>
            <td className="px-3 py-2.5 text-right">
                <span
                    className={cn(
                        "data-mono font-semibold",
                        budget.overThreshold ? "text-danger" : "text-foreground",
                    )}
                >
                    <Percent value={budget.burnPercent} emptyLabel="No budget set" />
                </span>
                <ShareBar
                    className="mt-1 ml-auto w-20"
                    share={budget.burnPercent}
                    tone={budget.overThreshold ? "danger" : "brand"}
                />
                {budget.overThreshold && budget.alertThresholdPct != null ? (
                    <span className="mt-0.5 block whitespace-nowrap text-xs text-danger">
                        over {budget.alertThresholdPct}% alert
                    </span>
                ) : null}
            </td>
            <td className="data-mono px-3 py-2.5 text-right text-foreground">
                <Money value={budget.spent} currency={currency} />
            </td>
            <td className="data-mono px-3 py-2.5 text-right text-foreground">
                <Money value={budget.committed} currency={currency} />
            </td>
            <td className="data-mono px-3 py-2.5 text-right text-foreground">
                <Money value={budget.total} currency={currency} />
            </td>
        </tr>
    );
}
