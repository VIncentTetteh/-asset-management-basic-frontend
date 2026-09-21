"use client";

import { useCurrency } from "@/contexts/CurrencyContext";
import { currencyName } from "@/lib/currency";

/** Beyond this many currencies the header switcher becomes a dropdown. */
const MAX_CURRENCY_BUTTONS = 3;

const RATES_UNAVAILABLE = "Exchange rates couldn't be loaded, so amounts can only be shown in the base currency.";

/**
 * Header display-currency switcher: the org's base currency plus every
 * currency the settings offer. A currency with no conversion path from the
 * base (or every non-base currency, when rates failed to load) is shown but
 * disabled, with a tooltip explaining why — never silently selectable.
 */
export function CurrencySwitcher() {
    const { currency, setCurrency, availableCurrencies, baseCurrency, isReachable, ratesError, rateLoading } =
        useCurrency();

    if (availableCurrencies.length <= 1) return null;

    const disabledReason = (code: string): string | null => {
        if (code === baseCurrency) return null;
        if (ratesError) return RATES_UNAVAILABLE;
        if (rateLoading) return null;
        return isReachable(code) ? null : `No exchange rate ${baseCurrency}→${code}`;
    };

    if (availableCurrencies.length <= MAX_CURRENCY_BUTTONS) {
        return (
            <div
                role="group"
                aria-label="Display currency"
                title={ratesError ? RATES_UNAVAILABLE : undefined}
                className="flex items-center rounded-control border border-edge bg-surface-muted p-0.5"
            >
                {availableCurrencies.map((c) => {
                    const reason = disabledReason(c);
                    const label = c === baseCurrency ? `${currencyName(c)} (base currency)` : currencyName(c);
                    return (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setCurrency(c)}
                            disabled={reason !== null}
                            aria-pressed={currency === c}
                            title={reason ?? label}
                            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                                currency === c
                                    ? "bg-brand text-brand-contrast shadow-sm"
                                    : "text-muted-fg hover:text-foreground"
                            }`}
                        >
                            {c}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <select
            aria-label="Display currency"
            value={currency}
            title={ratesError ? RATES_UNAVAILABLE : undefined}
            onChange={(e) => setCurrency(e.target.value)}
            className="ea-focus h-8 rounded-control border border-edge bg-surface-muted px-2 text-xs font-bold text-foreground"
        >
            {availableCurrencies.map((c) => {
                const reason = disabledReason(c);
                return (
                    <option key={c} value={c} disabled={reason !== null} title={reason ?? undefined}>
                        {c}{c === baseCurrency ? " (base)" : ""}{reason && !ratesError ? " (no rate)" : ""}
                    </option>
                );
            })}
        </select>
    );
}
