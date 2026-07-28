"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type SupportedCurrency = "USD" | "GHS";

interface CurrencyContextValue {
    currency: SupportedCurrency;
    setCurrency: (c: SupportedCurrency) => void;
    rate: number;           // GHS per 1 USD
    rateLoading: boolean;
    rateLastUpdated: Date | null;
    convert: (amount: number, fromCurrency?: string) => number;
    format: (amount: number | null | undefined, fromCurrency?: string) => string;
    symbol: string;
}

const FALLBACK_RATE = 15.5; // approximate GHS/USD fallback
const SYMBOLS: Record<SupportedCurrency, string> = { USD: "$", GHS: "₵" };

const CurrencyContext = createContext<CurrencyContextValue>({
    currency: "USD",
    setCurrency: () => {},
    rate: FALLBACK_RATE,
    rateLoading: false,
    rateLastUpdated: null,
    convert: (a) => a,
    format: (a) => `$${(a ?? 0).toFixed(2)}`,
    symbol: "$",
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrencyState] = useState<SupportedCurrency>("USD");
    const [rate, setRate] = useState(FALLBACK_RATE);
    const [rateLoading, setRateLoading] = useState(false);
    const [rateLastUpdated, setRateLastUpdated] = useState<Date | null>(null);

    // Restore saved preference
    useEffect(() => {
        const saved = localStorage.getItem("assetiq_currency") as SupportedCurrency | null;
        if (saved === "USD" || saved === "GHS") setCurrencyState(saved);
    }, []);

    // Fetch live USD→GHS rate from our server-side cached endpoint (no direct
    // browser dependency on the external FX provider — see /api/fx/usd-ghs).
    useEffect(() => {
        const fetchRate = async () => {
            setRateLoading(true);
            try {
                const res = await fetch("/api/fx/usd-ghs");
                if (!res.ok) throw new Error();
                const data = await res.json();
                if (typeof data?.rate === "number" && data.rate > 0) {
                    setRate(data.rate);
                    setRateLastUpdated(data.updatedAt ? new Date(data.updatedAt) : null);
                }
            } catch {
                // silently keep fallback
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
        if (from === "USD" && currency === "GHS") return amount * rate;
        if (from === "GHS" && currency === "USD") return amount / rate;
        return amount;
    }, [currency, rate]);

    const format = useCallback((amount: number | null | undefined, fromCurrency?: string): string => {
        if (amount == null) return "—";
        const converted = convert(amount, fromCurrency ?? "USD");
        return `${SYMBOLS[currency]}${converted.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
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
