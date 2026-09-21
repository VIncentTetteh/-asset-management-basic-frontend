"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeRatePair } from "@/lib/currency";

/**
 * Visible warning for totals that exclude amounts because an exchange rate is
 * missing. Renders nothing when the figures are complete.
 */
export function MissingRatesNotice({
    incomplete,
    missingRates = [],
    className,
}: {
    /** True when a server aggregate reported complete=false, even with no pairs listed. */
    incomplete?: boolean;
    missingRates?: readonly string[];
    className?: string;
}) {
    if (!incomplete && missingRates.length === 0) return null;
    const pairs = Array.from(new Set(missingRates)).map(describeRatePair);
    return (
        <div
            role="status"
            className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-foreground",
                className,
            )}
        >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />
            <span>
                Some amounts excluded: missing exchange rate{pairs.length === 1 ? "" : "s"}
                {pairs.length > 0 ? <> <span className="data-mono font-semibold">{pairs.join(", ")}</span></> : null}.
            </span>
            <Link href="/exchange-rates" className="ea-focus rounded-sm font-semibold text-brand underline-offset-2 hover:underline">
                Add exchange rates
            </Link>
        </div>
    );
}
