"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { DataErrorState } from "@/components/patterns/DataErrorState";
import { formatLocalDate } from "@/lib/local-date";
import { useWasteInsight } from "@/features/insights/hooks";
import { insightRecordHref } from "@/features/insights/filters";
import {
    AsOfLine,
    Figure,
    FilterLink,
    IncompleteNote,
    Money,
    NothingFound,
    Panel,
    WithheldNote,
    formatCount,
} from "@/features/insights/shared";
import type { WasteFinding, WasteInsight } from "@/features/insights/types";

/**
 * "What is costing money without earning it?"
 *
 * The one thing this page must not do is add the findings up. They overlap by
 * design — an asset can be unseen *and* fully depreciated — so a grand total
 * would double-count, and the backend deliberately does not offer one. The two
 * headline figures are the de-duplicated ones it does offer:
 * `distinctAssetsFlagged` and `capitalTiedUp`, plus `licenceAnnualSavings`,
 * which is the only recurring-cash figure here.
 *
 * Each finding shows its `explanation` verbatim. "Waste" is a judgement, and a
 * manager is entitled to disagree with the rule rather than with a number they
 * cannot see the basis of.
 */

/** How long without a recorded sighting counts as "not seen". Sent as `idleDays`. */
const UNSEEN_CHOICES = [90, 180, 365] as const;

export function WasteSurface() {
    const [idleDays, setIdleDays] = useState<number>(180);
    const { data, isLoading, error, refetch, isFetching } = useWasteInsight({ idleDays, limit: 10 });

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="waste-idle-days" className="text-xs font-semibold uppercase tracking-[0.06em] text-faint-fg">
                    Count as not seen after
                </label>
                <Select
                    id="waste-idle-days"
                    className="w-40"
                    value={String(idleDays)}
                    onChange={(event) => setIdleDays(Number(event.target.value))}
                >
                    {UNSEEN_CHOICES.map((days) => (
                        <option key={days} value={days}>{`${days} days`}</option>
                    ))}
                </Select>
            </div>

            {error != null ? (
                <DataErrorState
                    what="your cost and waste findings"
                    error={error}
                    onRetry={refetch}
                    isRetrying={isFetching}
                />
            ) : isLoading || !data ? (
                <div className="space-y-4" data-testid="waste-loading">
                    <div className="grid gap-3 sm:grid-cols-3">
                        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-card" />)}
                    </div>
                    <Skeleton className="h-80 rounded-card" />
                </div>
            ) : (
                <WasteBody data={data} />
            )}
        </div>
    );
}

function WasteBody({ data }: { data: WasteInsight }) {
    return (
        <div className="space-y-4">
            <AsOfLine asOf={data.asOf} generatedAt={data.generatedAt} />
            <WithheldNote sections={data.withheldSections} />
            <IncompleteNote complete={data.complete} missingRates={data.missingRates} what="These amounts" />

            <div className="grid gap-3 sm:grid-cols-3">
                <Figure
                    label="Assets flagged"
                    value={formatCount(data.distinctAssetsFlagged)}
                    note="Counted once each, however many findings they appear in"
                    testId="waste-distinct"
                />
                {data.showsMoney ? (
                    <>
                        <Figure
                            label="Capital tied up"
                            value={<Money value={data.capitalTiedUp} currency={data.currency} />}
                            note="Remaining book value of those assets"
                        />
                        <Figure
                            label="Licence savings a year"
                            value={<Money value={data.licenceAnnualSavings} currency={data.currency} />}
                            note="Seats paid for and not used — the one recurring figure here"
                        />
                    </>
                ) : null}
            </div>

            <p className="rounded-control border border-edge-subtle bg-surface-muted px-3 py-2 text-xs text-muted-fg">
                Findings overlap on purpose: the same asset can be both fully depreciated and not seen for months.
                There is deliberately no total adding them together, because it would count those assets twice.
            </p>

            {data.findings.length === 0 ? (
                <NothingFound>
                    Nothing was flagged. Either the estate is in good order, or the sections these findings read are
                    not available to you.
                </NothingFound>
            ) : (
                <div className="space-y-3">
                    {data.findings.map((finding) => (
                        <FindingCard key={finding.key} finding={finding} currency={data.currency} />
                    ))}
                </div>
            )}
        </div>
    );
}

/** The money a finding reports, which differs by kind. Null when there is none. */
function findingMoney(finding: WasteFinding): { label: string; value: number | null } | null {
    if (finding.annualCost !== null) return { label: "Annual cost of the unused seats", value: finding.annualCost };
    if (finding.annualExposure !== null) return { label: "Annual exposure", value: finding.annualExposure };
    if (finding.netBookValue !== null) return { label: "Remaining book value", value: finding.netBookValue };
    if (finding.originalCost !== null) return { label: "Original cost", value: finding.originalCost };
    return null;
}

function FindingCard({ finding, currency }: { finding: WasteFinding; currency: string }) {
    const [open, setOpen] = useState(false);
    const amount = findingMoney(finding);
    const seats = finding.unusedSeats ?? finding.excessSeats;
    const seatLabel = finding.unusedSeats !== null ? "seats unused" : "seats over the licence";
    const noun = finding.resourceType === "licence" ? "licence" : "asset";

    return (
        <Panel
            title={finding.title}
            description={finding.explanation}
            className={finding.count === 0 ? "opacity-70" : undefined}
        >
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <p className="data-mono text-2xl font-bold text-foreground" data-testid={`finding-count-${finding.key}`}>
                    {formatCount(finding.count)}
                    <span className="ml-1.5 text-xs font-medium uppercase tracking-[0.06em] text-faint-fg">
                        {finding.count === 1 ? noun : `${noun}s`}
                    </span>
                </p>
                {seats !== null ? (
                    <p className="text-sm text-muted-fg">
                        <span className="data-mono font-semibold text-foreground">{formatCount(seats)}</span> {seatLabel}
                    </p>
                ) : null}
                {amount ? (
                    <p className="text-sm text-muted-fg">
                        {amount.label}:{" "}
                        <Money value={amount.value} currency={currency} className="data-mono font-semibold text-foreground" />
                    </p>
                ) : null}
            </div>

            {finding.count === 0 ? (
                <p className="mt-3 text-[13px] text-muted-fg">Nothing matched this rule.</p>
            ) : (
                <>
                    <FilterLink
                        className="mt-3"
                        filter={finding.filter}
                        resource={finding.resourceType}
                        countLabel={`these ${formatCount(finding.count)} ${finding.count === 1 ? noun : `${noun}s`}`}
                        // Every finding's rule is finer than the register filter that
                        // accompanies it — "in stock" is not "in stock and not seen for
                        // 180 days" — so no cost-waste link is ever claimed as exact.
                        precision="superset"
                        recordsListed={finding.items.length > 0}
                    />

                    {finding.items.length > 0 ? (
                        <div className="mt-3">
                            <button
                                type="button"
                                onClick={() => setOpen((v) => !v)}
                                aria-expanded={open}
                                className="ea-focus inline-flex items-center gap-1 rounded-sm text-[13px] font-semibold text-foreground hover:text-brand"
                            >
                                {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                                {open ? "Hide" : "Show"}{" "}
                                {finding.truncated
                                    ? `the ${formatCount(finding.items.length)} with the most value left, of ${formatCount(finding.count)}`
                                    : `all ${formatCount(finding.items.length)} ${finding.items.length === 1 ? "record" : "records"}`}
                            </button>
                            {open ? <FindingItems finding={finding} currency={currency} /> : null}
                        </div>
                    ) : null}
                </>
            )}
        </Panel>
    );
}

function FindingItems({ finding, currency }: { finding: WasteFinding; currency: string }) {
    const isLicence = finding.resourceType === "licence";
    return (
        <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
                <caption className="sr-only">{`Records behind "${finding.title}"`}</caption>
                <thead>
                    <tr className="border-b border-edge bg-surface-muted text-left text-xs uppercase tracking-[0.06em] text-faint-fg">
                        <th scope="col" className="px-3 py-2 font-semibold">{isLicence ? "Licence" : "Asset"}</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Evidence</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold">
                            {isLicence ? "Annual amount" : "Book value"}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {finding.items.map((item) => (
                        <tr key={item.id} className="border-b border-edge-subtle last:border-b-0">
                            <th scope="row" className="px-3 py-2 text-left font-medium">
                                <Link
                                    href={insightRecordHref(item.resourceType, item.id)}
                                    className="ea-focus rounded-sm text-foreground underline-offset-2 hover:text-brand hover:underline"
                                >
                                    {item.name}
                                </Link>
                                {item.reference ? (
                                    <span className="data-mono ml-2 text-xs text-muted-fg">{item.reference}</span>
                                ) : null}
                                {item.expiryDate ? (
                                    <span className="block text-xs text-muted-fg">
                                        Expires {formatLocalDate(item.expiryDate)}
                                    </span>
                                ) : null}
                            </th>
                            <td className="px-3 py-2 text-[13px] text-muted-fg">{item.detail ?? "—"}</td>
                            <td className="data-mono px-3 py-2 text-right">
                                <Money
                                    value={isLicence ? item.amount : item.netBookValue}
                                    currency={currency}
                                />
                                {item.nativeCurrency && item.nativeCurrency !== currency ? (
                                    <span className="block text-xs text-muted-fg">held in {item.nativeCurrency}</span>
                                ) : null}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
