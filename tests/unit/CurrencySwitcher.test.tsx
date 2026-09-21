import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CurrencySwitcher } from "@/components/currency/CurrencySwitcher";
import type { CurrencyContextValue } from "@/contexts/CurrencyContext";

const ctx = vi.hoisted(() => ({ value: {} as Partial<CurrencyContextValue> }));
vi.mock("@/contexts/CurrencyContext", () => ({ useCurrency: () => ctx.value }));

const base = (overrides: Partial<CurrencyContextValue>): Partial<CurrencyContextValue> => ({
    currency: "GHS",
    baseCurrency: "GHS",
    availableCurrencies: ["GHS", "USD", "EUR"],
    setCurrency: vi.fn(),
    ratesError: false,
    rateLoading: false,
    isReachable: (code: string) => code !== "EUR",
    ...overrides,
});

afterEach(cleanup);

describe("CurrencySwitcher", () => {
    it("disables a currency with no conversion path from the base", () => {
        ctx.value = base({});
        render(<CurrencySwitcher />);
        expect((screen.getByRole("button", { name: "USD" }) as HTMLButtonElement).disabled).toBe(false);
        const eur = screen.getByRole("button", { name: "EUR" });
        expect((eur as HTMLButtonElement).disabled).toBe(true);
        expect(eur.getAttribute("title")).toBe("No exchange rate GHS→EUR");
    });

    it("enables only the base currency when rates failed to load", () => {
        ctx.value = base({ ratesError: true, isReachable: (code: string) => code === "GHS" });
        render(<CurrencySwitcher />);
        expect((screen.getByRole("button", { name: "GHS" }) as HTMLButtonElement).disabled).toBe(false);
        expect((screen.getByRole("button", { name: "USD" }) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByRole("group", { name: "Display currency" }).getAttribute("title")).toMatch(/couldn't be loaded/);
    });
});
