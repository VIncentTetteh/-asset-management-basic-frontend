import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CurrencyProvider, useCurrency } from "@/contexts/CurrencyContext";
import { formatMoney } from "@/lib/currency";
import type { CurrencySettings } from "@/types";

// ── Service boundary mocks ───────────────────────────────────────────────────
const getSettings = vi.fn<() => Promise<CurrencySettings>>();
const listAll = vi.fn();

vi.mock("@/services/currencyService", () => ({
    currencyService: { getSettings: () => getSettings(), updateSettings: vi.fn() },
}));
vi.mock("@/services/exchangeRateService", () => ({
    exchangeRateService: { listAll: () => listAll() },
}));
vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({
        user: { organisationId: "7f1c2a4e-3b5d-4c6e-8f9a-0b1c2d3e4f50" },
        isAuthenticated: true,
    }),
}));

const RATES = [
    // Stored as USD->GHS; GHS->USD must come from the inverse.
    { baseCurrency: "USD", targetCurrency: "GHS", rate: 10, effectiveDate: "2026-01-01" },
];

function renderCurrency() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>
            <CurrencyProvider>{children}</CurrencyProvider>
        </QueryClientProvider>
    );
    return renderHook(() => useCurrency(), { wrapper });
}

async function renderLoaded() {
    const hook = renderCurrency();
    await waitFor(() => {
        expect(hook.result.current.baseCurrency).toBe("GHS");
        expect(hook.result.current.rates.size).toBe(1);
    });
    return hook;
}

beforeEach(() => {
    window.localStorage.clear();
    getSettings.mockResolvedValue({ baseCurrency: "GHS", availableCurrencies: ["GHS", "USD"], canEdit: true });
    listAll.mockResolvedValue(RATES);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("CurrencyContext", () => {
    it("uses the org base currency (not USD) as the default display and source currency", async () => {
        const { result } = await renderLoaded();
        expect(result.current.currency).toBe("GHS");
        expect(result.current.availableCurrencies).toEqual(["GHS", "USD"]);
        // No `from` → amount is in the base currency, shown as-is.
        expect(result.current.format(100)).toBe(formatMoney(100, "GHS"));
        expect(result.current.convert(100)).toBe(100);
    });

    it("converts base amounts into the chosen display currency via the inverse rate", async () => {
        const { result } = await renderLoaded();
        act(() => result.current.setCurrency("USD"));
        expect(result.current.currency).toBe("USD");
        expect(result.current.format(100)).toBe(formatMoney(10, "USD"));
        expect(result.current.format(5, "USD")).toBe(formatMoney(5, "USD"));
        expect(window.localStorage.getItem("assetiq_currency")).toBe("USD");
    });

    it("does not fake a missing rate: formats in the source currency and flags it", async () => {
        const { result } = await renderLoaded();
        expect(result.current.format(50, "EUR")).toBe(formatMoney(50, "EUR"));
        expect(result.current.canConvert("EUR")).toBe(false);
        expect(result.current.missingRateFor("EUR")).toBe("EUR->GHS");
        expect(result.current.tryConvert(50, "EUR")).toBeNull();
        expect(Number.isNaN(result.current.convert(50, "EUR"))).toBe(true);
    });

    it("sums mixed currencies into the display currency and marks a missing rate as partial", async () => {
        const { result } = await renderLoaded();
        const total = result.current.sum([
            { amount: 100, currency: "GHS" },
            { amount: 2, currency: "USD" },
            { amount: 9, currency: "EUR" },
        ]);
        expect(total).toMatchObject({ total: 120, currency: "GHS", complete: false, missingRates: ["EUR->GHS"] });
    });

    it("ignores a remembered display currency the org no longer offers", async () => {
        window.localStorage.setItem("assetiq_currency", "JPY");
        const { result } = await renderLoaded();
        expect(result.current.currency).toBe("GHS");
    });

    it("survives blocked localStorage", async () => {
        const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        const { result } = await renderLoaded();
        act(() => result.current.setCurrency("USD"));
        expect(result.current.currency).toBe("USD");
        spy.mockRestore();
    });

    it("reports which currencies are reachable from the base", async () => {
        getSettings.mockResolvedValue({ baseCurrency: "GHS", availableCurrencies: ["GHS", "USD", "EUR"], canEdit: true });
        const { result } = await renderLoaded();
        expect(result.current.ratesError).toBe(false);
        expect(result.current.isReachable("GHS")).toBe(true);
        expect(result.current.isReachable("USD")).toBe(true);
        expect(result.current.isReachable("EUR")).toBe(false);
    });

    it("exposes a rates failure and only allows the base currency", async () => {
        listAll.mockRejectedValue(new Error("403"));
        window.localStorage.setItem("assetiq_currency", "USD");
        const { result } = renderCurrency();
        await waitFor(() => expect(result.current.ratesError).toBe(true));
        expect(result.current.baseCurrency).toBe("GHS");
        expect(result.current.isReachable("USD")).toBe(false);
        expect(result.current.isReachable("GHS")).toBe(true);
        expect(result.current.currency).toBe("GHS");
    });
});
