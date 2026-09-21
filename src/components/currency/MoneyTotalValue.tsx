"use client";

import { describeRatePair, formatMoney, type MoneyTotal } from "@/lib/currency";

/**
 * A client-side total in the display currency. When some lines could not be
 * converted the figure is marked partial — pair it with <MissingRatesNotice>.
 */
export function MoneyTotalValue({ total }: { total: MoneyTotal }) {
    const formatted = formatMoney(total.total, total.currency);
    if (total.complete) return <span className="data-mono">{formatted}</span>;
    return (
        <span
            className="data-mono"
            title={`Partial: excludes amounts without an exchange rate (${total.missingRates.map(describeRatePair).join(", ")})`}
        >
            {formatted} <span className="font-semibold text-warn">(partial)</span>
        </span>
    );
}

/** Plain-text variant for subtitles and other string-only slots. */
export const moneyTotalText = (total: MoneyTotal): string =>
    `${formatMoney(total.total, total.currency)}${total.complete ? "" : " (partial)"}`;
