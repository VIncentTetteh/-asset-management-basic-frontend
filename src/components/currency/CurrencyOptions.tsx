"use client";

import { useCurrency } from "@/contexts/CurrencyContext";
import { currencyName, normalizeCurrencyCode } from "@/lib/currency";

/**
 * `<option>` list for a currency `<Select>`: the organisation's available
 * currencies, plus the record's current currency when editing so an existing
 * value is never silently swapped for another.
 */
export function CurrencyOptions({ current }: { current?: string | null }) {
    const { availableCurrencies } = useCurrency();
    const extra = normalizeCurrencyCode(current);
    const codes = extra && !availableCurrencies.includes(extra) ? [...availableCurrencies, extra] : availableCurrencies;
    return (
        <>
            {codes.map((code) => (
                <option key={code} value={code} title={currencyName(code)}>
                    {code}
                </option>
            ))}
        </>
    );
}
