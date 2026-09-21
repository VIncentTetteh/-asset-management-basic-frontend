"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { exchangeRateService } from "@/services/exchangeRateService";
import { currencyService } from "@/services/currencyService";
import { useAuth } from "@/contexts/AuthContext";
import { extractOrganisationId, getOrganisationIdFromStorage } from "@/lib/authContext";
import {
    FALLBACK_CURRENCY,
    buildRateMap,
    convertAmount,
    currencySymbol,
    formatMoney,
    hasConversionPath,
    normalizeCurrencyCode,
    ratePair,
    sumMoney,
    type MoneyLine,
    type MoneyTotal,
    type RateMap,
    type RatePair,
} from "@/lib/currency";

const DISPLAY_CURRENCY_STORAGE_KEY = "assetiq_currency";
const SETTINGS_STALE_MS = 5 * 60_000;

/** Query keys owned by this context. Exchange-rate keys sit under the
 *  "exchange-rates" prefix so the exchange-rates page's invalidation refreshes them. */
export const currencyQueryKeys = {
    all: ["currency"] as const,
    settings: (orgId?: string) => ["currency", "settings", orgId] as const,
    ratesAll: ["exchange-rates", "currency-context"] as const,
    rates: (orgId?: string) => ["exchange-rates", "currency-context", orgId] as const,
};

export interface CurrencyContextValue {
    /** The organisation's reporting currency; server aggregates arrive in it. */
    baseCurrency: string;
    /** The currency the viewer chose to display amounts in. */
    currency: string;
    setCurrency: (currency: string) => void;
    /** baseCurrency plus every currency with a rate to/from it. */
    availableCurrencies: string[];
    /** Whether the viewer may change the base currency. */
    canEditBaseCurrency: boolean;
    settingsLoading: boolean;
    settingsError: boolean;
    rateLoading: boolean;
    /** True when the exchange-rate list failed to load; only the base currency is usable. */
    ratesError: boolean;
    rates: RateMap;
    /** True when amounts in the base currency can be shown in `code` (a rate path exists). */
    isReachable: (code: string) => boolean;
    /** Converts into `to` (default: display currency); null when no rate exists. */
    tryConvert: (amount: number, fromCurrency?: string | null, to?: string) => number | null;
    /** Legacy numeric API: NaN when no rate exists. */
    convert: (amount: number, fromCurrency?: string | null) => number;
    /** True when `fromCurrency` (default base) can be shown in the display currency. */
    canConvert: (fromCurrency?: string | null) => boolean;
    /** The pair that blocks display conversion ("USD->GHS"), or null. */
    missingRateFor: (fromCurrency?: string | null) => RatePair | null;
    /** Formats in the display currency; falls back to the SOURCE currency, never a faked rate. */
    format: (amount: number | null | undefined, fromCurrency?: string | null) => string;
    formatCompact: (amount: number | null | undefined, fromCurrency?: string | null) => string;
    /** Sums mixed-currency lines into the display currency, flagging exclusions. */
    sum: (lines: readonly MoneyLine[]) => MoneyTotal;
    symbol: string;
}

const noopTotal = (currency: string): MoneyTotal => ({
    total: 0, currency, complete: true, missingRates: [], byCurrency: {},
});

const CurrencyContext = createContext<CurrencyContextValue>({
    baseCurrency: FALLBACK_CURRENCY,
    currency: FALLBACK_CURRENCY,
    setCurrency: () => {},
    availableCurrencies: [FALLBACK_CURRENCY],
    canEditBaseCurrency: false,
    settingsLoading: false,
    settingsError: false,
    rateLoading: false,
    ratesError: false,
    rates: new Map(),
    isReachable: () => true,
    tryConvert: (amount) => amount,
    convert: (amount) => amount,
    canConvert: () => true,
    missingRateFor: () => null,
    format: (amount) => formatMoney(amount ?? 0, FALLBACK_CURRENCY),
    formatCompact: (amount) => formatMoney(amount ?? 0, FALLBACK_CURRENCY, { compact: true }),
    sum: () => noopTotal(FALLBACK_CURRENCY),
    symbol: "$",
});

const readStoredCurrency = (): string | null => {
    try {
        return normalizeCurrencyCode(window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY));
    } catch {
        return null;
    }
};

const writeStoredCurrency = (currency: string): void => {
    try {
        window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, currency);
    } catch {
        // Private mode / blocked storage: the choice simply isn't remembered.
    }
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const orgId = extractOrganisationId(user) ?? (isAuthenticated ? getOrganisationIdFromStorage() : undefined);
    const enabled = isAuthenticated && Boolean(orgId);

    const settingsQuery = useQuery({
        queryKey: currencyQueryKeys.settings(orgId),
        queryFn: currencyService.getSettings,
        enabled,
        staleTime: SETTINGS_STALE_MS,
    });
    const ratesQuery = useQuery({
        queryKey: currencyQueryKeys.rates(orgId),
        queryFn: exchangeRateService.listAll,
        enabled,
        staleTime: SETTINGS_STALE_MS,
    });

    // Lazy initializer: localStorage is only touched in the browser.
    const [preferred, setPreferred] = useState<string | null>(() =>
        typeof window === "undefined" ? null : readStoredCurrency(),
    );

    const baseCurrency = settingsQuery.data?.baseCurrency ?? FALLBACK_CURRENCY;
    const availableCurrencies = useMemo(
        () => settingsQuery.data?.availableCurrencies ?? [baseCurrency],
        [settingsQuery.data, baseCurrency],
    );

    const rates = useMemo<RateMap>(() => buildRateMap(ratesQuery.data ?? []), [ratesQuery.data]);
    const ratesError = ratesQuery.isError;
    const isReachable = useCallback(
        (code: string) => {
            const target = normalizeCurrencyCode(code);
            if (!target) return false;
            if (target === baseCurrency) return true;
            return !ratesError && hasConversionPath(baseCurrency, target, rates);
        },
        [baseCurrency, rates, ratesError],
    );
    // A remembered choice only applies while it is still offered for this org
    // and (once rates have settled) still reachable from the base currency.
    const currency =
        preferred
        && availableCurrencies.includes(preferred)
        && (ratesQuery.isLoading || isReachable(preferred))
            ? preferred
            : baseCurrency;

    const setCurrency = useCallback((next: string) => {
        const code = normalizeCurrencyCode(next);
        if (!code) return;
        setPreferred(code);
        writeStoredCurrency(code);
    }, []);

    const sourceOf = useCallback(
        (from?: string | null) => normalizeCurrencyCode(from) ?? baseCurrency,
        [baseCurrency],
    );

    const tryConvert = useCallback(
        (amount: number, from?: string | null, to?: string) =>
            convertAmount(amount, sourceOf(from), normalizeCurrencyCode(to) ?? currency, rates, baseCurrency),
        [sourceOf, currency, rates, baseCurrency],
    );

    const value = useMemo<CurrencyContextValue>(() => {
        const missingRateFor = (from?: string | null): RatePair | null => {
            const source = sourceOf(from);
            return convertAmount(1, source, currency, rates, baseCurrency) == null ? ratePair(source, currency) : null;
        };
        const render = (amount: number | null | undefined, from: string | null | undefined, compact: boolean) => {
            if (amount == null || !Number.isFinite(amount)) return "—";
            const converted = tryConvert(amount, from);
            return converted == null
                ? formatMoney(amount, sourceOf(from), { compact })
                : formatMoney(converted, currency, { compact });
        };
        return {
            baseCurrency,
            currency,
            setCurrency,
            availableCurrencies,
            canEditBaseCurrency: settingsQuery.data?.canEdit ?? false,
            settingsLoading: settingsQuery.isLoading,
            settingsError: settingsQuery.isError,
            rateLoading: ratesQuery.isLoading,
            ratesError,
            rates,
            isReachable,
            tryConvert,
            convert: (amount, from) => tryConvert(amount, from) ?? Number.NaN,
            canConvert: (from) => missingRateFor(from) === null,
            missingRateFor,
            format: (amount, from) => render(amount, from, false),
            formatCompact: (amount, from) => render(amount, from, true),
            sum: (lines) => sumMoney(lines, currency, rates, { fallbackCurrency: baseCurrency, pivot: baseCurrency }),
            symbol: currencySymbol(currency),
        };
    }, [
        baseCurrency, currency, setCurrency, availableCurrencies, settingsQuery.data, settingsQuery.isLoading,
        settingsQuery.isError, ratesQuery.isLoading, ratesError, rates, isReachable, tryConvert, sourceOf,
    ]);

    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
    return useContext(CurrencyContext);
}
