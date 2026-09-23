"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowUpRight, Info } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { describeRatePair } from "@/lib/currency";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatLocalDate } from "@/lib/local-date";
import {
    explainInexactLink,
    insightFilterLink,
    type InsightLink,
} from "@/features/insights/filters";
import type { InsightFilter, InsightResourceType } from "@/features/insights/types";

/**
 * The pieces every operational surface is built from.
 *
 * Three rules are encoded here rather than remembered on each page:
 *
 *   - **Null is not zero.** {@link Money} and {@link Percent} render an unknown
 *     amount as the word "Unknown", with the reason on hover, and never as
 *     `$0.00` or `—%`. A figure the backend could not compute is a different
 *     fact from a figure that is genuinely nothing.
 *   - **An incomplete total says so where it is read.** {@link IncompleteNote}
 *     sits next to the number, not in a footer.
 *   - **A withheld section is named, never zeroed.** {@link WithheldNote} says
 *     "you don't have access to X", because a zero there looks like good news.
 */

// ── Money and ratios ─────────────────────────────────────────────────────────

/** Why a money figure is missing. Decides the word shown in its place. */
export type UnknownReason = "no-rate" | "withheld";

const UNKNOWN_COPY: Record<UnknownReason, { label: string; title: string }> = {
    "no-rate": {
        label: "Unknown",
        title: "This amount is held in a currency with no exchange rate, so it could not be converted. Unknown is not zero.",
    },
    withheld: {
        label: "Not shown",
        title: "You do not have permission to see valuations, so this amount was left out of the response.",
    },
};

/**
 * An amount in the insight's currency, converted into the viewer's display
 * currency. Null renders as a word, never as a number.
 */
export function Money({
    value,
    currency,
    reason = "no-rate",
    compact = false,
    className,
}: {
    value: number | null | undefined;
    /** The currency the backend reported this figure in. */
    currency: string;
    reason?: UnknownReason;
    compact?: boolean;
    className?: string;
}) {
    const { format, formatCompact } = useCurrency();
    if (value == null || !Number.isFinite(value)) {
        const copy = UNKNOWN_COPY[reason];
        return (
            <span className={cn("text-muted-fg", className)} title={copy.title} data-testid="unknown-money">
                {copy.label}
            </span>
        );
    }
    const render = compact ? formatCompact : format;
    return <span className={className}>{render(value, currency)}</span>;
}

/**
 * A percentage. Null means the ratio has no denominator — an empty estate has
 * no "share", and printing 0% for it would be a claim about the user's data.
 */
export function Percent({
    value,
    className,
    emptyLabel = "Not applicable",
    emptyTitle = "There is nothing to take a percentage of yet.",
}: {
    value: number | null | undefined;
    className?: string;
    emptyLabel?: string;
    emptyTitle?: string;
}) {
    if (value == null || !Number.isFinite(value)) {
        return (
            <span className={cn("text-muted-fg", className)} title={emptyTitle} data-testid="empty-ratio">
                {emptyLabel}
            </span>
        );
    }
    return <span className={className}>{`${value.toFixed(1)}%`}</span>;
}

/** A count, always safe to render as a number. */
export const formatCount = (value: number): string => value.toLocaleString();

// ── Honesty notices ──────────────────────────────────────────────────────────

/**
 * "This total excludes amounts we could not convert." Renders nothing when the
 * figures are complete.
 */
export function IncompleteNote({
    complete,
    missingRates,
    what = "These totals",
    className,
}: {
    complete: boolean;
    missingRates: readonly string[];
    /** What is incomplete, as a sentence subject. */
    what?: string;
    className?: string;
}) {
    if (complete) return null;
    const pairs = Array.from(new Set(missingRates)).map(describeRatePair);
    return (
        <Alert
            tone="warn"
            live={false}
            title={`${what} are incomplete`}
            className={className}
            data-testid="insight-incomplete"
            action={
                <Link
                    href="/exchange-rates"
                    className="ea-focus rounded-sm text-[13px] font-semibold text-brand underline-offset-2 hover:underline"
                >
                    Add exchange rates
                </Link>
            }
        >
            Amounts held in {pairs.length > 0 ? <span className="data-mono font-semibold">{pairs.join(", ")}</span> : "another currency"}{" "}
            could not be converted and were left out, so the figures below are a floor, not the answer.
        </Alert>
    );
}

/** "You don't have access to X." Renders nothing when nothing was withheld. */
export function WithheldNote({
    sections,
    className,
}: {
    sections: readonly string[];
    className?: string;
}) {
    if (sections.length === 0) return null;
    const list = sections.join(", ");
    return (
        <Alert
            tone="info"
            live={false}
            title="Part of this answer is hidden from you"
            className={className}
            data-testid="insight-withheld"
        >
            You do not have access to {list}. {sections.length === 1 ? "That section is" : "Those sections are"}{" "}
            left out of this page entirely rather than shown as zero — ask an administrator for the permission if you
            need {sections.length === 1 ? "it" : "them"}.
        </Alert>
    );
}

/** "As of 21 Sep 2026 · figures built 09:14." */
export function AsOfLine({ asOf, generatedAt }: { asOf: string; generatedAt: string }) {
    const built = generatedAt ? new Date(generatedAt) : null;
    const builtLabel = built && !Number.isNaN(built.getTime())
        ? built.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : null;
    return (
        <p className="text-xs text-muted-fg">
            {asOf ? <>As of {formatLocalDate(asOf)}</> : "As of today"}
            {builtLabel ? <> · built {builtLabel}</> : null}
        </p>
    );
}

// ── Figures and links ────────────────────────────────────────────────────────

/**
 * One headline figure. `href` makes the whole tile a link through to the
 * records behind it; `note` is the caveat that belongs with this number
 * specifically.
 */
export function Figure({
    label,
    value,
    note,
    href,
    tone = "default",
    testId,
}: {
    label: string;
    value: React.ReactNode;
    note?: React.ReactNode;
    href?: string;
    tone?: "default" | "warn" | "danger";
    testId?: string;
}) {
    const body = (
        <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint-fg">{label}</p>
            <p
                className={cn(
                    "data-mono mt-1 break-words text-xl font-bold leading-tight sm:text-2xl",
                    tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-foreground",
                )}
            >
                {value}
            </p>
            {note ? <p className="mt-1 text-xs text-muted-fg">{note}</p> : null}
        </>
    );

    const shell = "rounded-card border border-edge bg-surface p-4";
    if (!href) {
        return (
            <div className={shell} data-testid={testId}>
                {body}
            </div>
        );
    }
    return (
        <Link
            href={href}
            data-testid={testId}
            className={cn(shell, "ea-focus block transition-colors hover:border-brand")}
        >
            {body}
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                View records <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </span>
        </Link>
    );
}

/**
 * The link through to a figure's records, plus — when the register cannot
 * express the filter exactly — a sentence saying so. Showing the link without
 * the sentence is how a dashboard starts lying: the user clicks "24 not seen"
 * and lands on 300 in-stock assets.
 */
export function FilterLink({
    filter,
    resource,
    countLabel,
    precision = "exact",
    recordsListed = false,
    className,
}: {
    filter: InsightFilter | undefined;
    resource: InsightResourceType;
    /** What the figure counted, e.g. "these 24 assets". */
    countLabel: string;
    /** "superset" when the rule behind the figure is finer than the filter. */
    precision?: "exact" | "superset";
    /** True when the exact records are rendered next to this link. */
    recordsListed?: boolean;
    className?: string;
}) {
    const link: InsightLink = insightFilterLink(filter, resource, countLabel, precision);
    const caveat = explainInexactLink(link, resource, filter, { recordsListed });
    return (
        <div className={cn("space-y-1", className)}>
            <Link
                href={link.href}
                data-testid="insight-filter-link"
                data-exactness={link.exactness}
                className="ea-focus inline-flex items-center gap-1 rounded-sm text-[13px] font-semibold text-brand underline-offset-2 hover:underline"
            >
                {link.label} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            {caveat ? (
                <p className="flex items-start gap-1.5 text-xs text-muted-fg">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>{caveat}</span>
                </p>
            ) : null}
        </div>
    );
}

// ── Layout helpers ───────────────────────────────────────────────────────────

/**
 * A proportion bar with its value beside it, never colour alone. Screen readers
 * and greyscale printouts get the same information from the text.
 */
export function ShareBar({
    share,
    className,
    tone = "brand",
}: {
    share: number | null;
    className?: string;
    tone?: "brand" | "warn" | "danger";
}) {
    const width = share == null ? 0 : Math.max(0, Math.min(100, share));
    const colour = tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : "bg-brand";
    return (
        <div
            aria-hidden="true"
            className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken", className)}
        >
            <div className={cn("h-full rounded-full", colour)} style={{ width: `${width}%` }} />
        </div>
    );
}

/** Section shell: a heading, an optional explanation, and the content. */
export function Panel({
    title,
    description,
    actions,
    children,
    className,
}: {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cn("rounded-card border border-edge bg-surface", className)}>
            <header className="flex flex-col gap-2 border-b border-edge-subtle px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-sm font-bold text-foreground">{title}</h2>
                    {description ? <p className="mt-1 text-xs text-muted-fg">{description}</p> : null}
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </header>
            <div className="p-4">{children}</div>
        </section>
    );
}

/** A quiet "nothing here" for a genuinely empty section — never for a failure. */
export function NothingFound({ children }: { children: React.ReactNode }) {
    return (
        <p className="rounded-control border border-dashed border-edge-subtle bg-surface-muted px-3 py-4 text-center text-[13px] text-muted-fg">
            {children}
        </p>
    );
}
