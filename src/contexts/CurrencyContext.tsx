"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { exchangeRateService } from "@/services/exchangeRateService";

export type SupportedCurrency = "USD" | "GHS";

interface CurrencyContextValue {
    currency: SupportedCurrency;
    setCurrency: (c: SupportedCurrency) => void;
    rate: number | null;    // governed GHS per 1 USD; null when unavailable
    rateLoading: boolean;
    rateLastUpdated: Date | null;
    convert: (amount: number, fromCurrency?: string) => number;
    format: (amount: number | null | undefined, fromCurrency?: string) => string;
    symbol: string;
}

const SYMBOLS: Record<SupportedCurrency, string> = { USD: "$", GHS: "₵" };

const CurrencyContext = createContext<CurrencyContextValue>({
    currency: "USD",
    setCurrency: () => {},
    rate: null,
    rateLoading: false,
    rateLastUpdated: null,
    convert: (a) => a,
    format: (a) => `$${(a ?? 0).toFixed(2)}`,
    symbol: "$",
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrencyState] = useState<SupportedCurrency>("USD");
    const [rate, setRate] = useState<number | null>(null);
    const [rateLoading, setRateLoading] = useState(false);
    const [rateLastUpdated, setRateLastUpdated] = useState<Date | null>(null);

    // Restore saved preference
    useEffect(() => {
        const saved = localStorage.getItem("assetiq_currency") as SupportedCurrency | null;
        if (saved === "USD" || saved === "GHS") setCurrencyState(saved);
    }, []);

    // Only tenant-governed, dated server rates may drive display conversion.
    useEffect(() => {
        const fetchRate = async () => {
            setRateLoading(true);
            try {
                const rates = await exchangeRateService.listAll();
                const direct = rates
                    .filter(r => r.baseCurrency === "USD" && r.targetCurrency === "GHS" && (r.rate ?? 0) > 0)
                    .sort((a, b) => (b.effectiveDate ?? "").localeCompare(a.effectiveDate ?? ""))[0];
                const inverse = rates
                    .filter(r => r.baseCurrency === "GHS" && r.targetCurrency === "USD" && (r.rate ?? 0) > 0)
                    .sort((a, b) => (b.effectiveDate ?? "").localeCompare(a.effectiveDate ?? ""))[0];
                const governed = direct?.rate ?? (inverse?.rate ? 1 / inverse.rate : null);
                if (governed != null && Number.isFinite(governed)) {
                    setRate(governed);
                    setRateLastUpdated(new Date());
                }
            } catch {
                setRate(null);
            } finally {
                setRateLoading(false);
            }
        };
        fetchRate();
    }, []);

    const setCurrency = useCallback((c: SupportedCurrency) => {
        setCurrencyState(c);
        localStorage.setItem("assetiq_currency", c);
    }, []);

    const convert = useCallback((amount: number, fromCurrency?: string): number => {
        const from = ((fromCurrency ?? "USD").toUpperCase()) as SupportedCurrency;
        if (from === currency) return amount;
        if (rate != null && from === "USD" && currency === "GHS") return amount * rate;
        if (rate != null && from === "GHS" && currency === "USD") return amount / rate;
        return Number.NaN;
    }, [currency, rate]);

    const format = useCallback((amount: number | null | undefined, fromCurrency?: string): string => {
        if (amount == null) return "—";
        const source = ((fromCurrency ?? "GHS").toUpperCase()) as SupportedCurrency;
        const converted = convert(amount, source);
        const displayCurrency = Number.isFinite(converted) ? currency : source;
        const displayAmount = Number.isFinite(converted) ? converted : amount;
        return new Intl.NumberFormat("en-US", {
            style: "currency", currency: displayCurrency,
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(displayAmount);
    }, [convert, currency]);

    return (
        <CurrencyContext.Provider value={{
            currency,
            setCurrency,
            rate,
            rateLoading,
            rateLastUpdated,
            convert,
            format,
            symbol: SYMBOLS[currency],
        }}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    return useContext(CurrencyContext);
}
