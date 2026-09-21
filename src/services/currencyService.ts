import api from "@/lib/axios";
import type { CurrencySettings } from "@/types";
import { normalizeCurrencyCode } from "@/lib/currency";

/**
 * Normalises the settings payload so the UI never has to defend against a
 * lower-case code or a base currency missing from the available list.
 */
const normalizeSettings = (raw: CurrencySettings): CurrencySettings => {
    const baseCurrency = normalizeCurrencyCode(raw.baseCurrency) ?? raw.baseCurrency;
    const available = (Array.isArray(raw.availableCurrencies) ? raw.availableCurrencies : [])
        .map((code) => normalizeCurrencyCode(code))
        .filter((code): code is string => code !== null);
    return {
        baseCurrency,
        availableCurrencies: Array.from(new Set([baseCurrency, ...available])),
        canEdit: Boolean(raw.canEdit),
    };
};

export const currencyService = {
    /** GET /currency/settings */
    getSettings: async (): Promise<CurrencySettings> => {
        const response = await api.get<CurrencySettings>("/currency/settings");
        return normalizeSettings(response.data);
    },

    /** PUT /currency/settings — org admins only (403 otherwise). */
    updateSettings: async (baseCurrency: string): Promise<CurrencySettings> => {
        const response = await api.put<CurrencySettings>("/currency/settings", { baseCurrency });
        return normalizeSettings(response.data);
    },
};
