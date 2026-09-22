import type { ApiClient } from "../../fixtures/api";
import type { FieldSpec } from "../../fixtures/forms";

/**
 * Shared bits for the lease / license / vendor-review / exchange-rate specs.
 *
 * The money forms' Currency select lists the organisation's available
 * currencies (CurrencyOptions) with no empty option, so its values are only
 * known at run time: `currencyField()` returns a spec whose value/edit are
 * filled in by `loadCurrencies()` from the suite's `setup`.
 */

interface CurrencySettings {
    baseCurrency?: string;
    availableCurrencies?: string[];
}

/** A Currency select spec; call `loadCurrencies` in `setup` before it is used. */
export function currencyField(label = "Currency"): FieldSpec {
    return { label, type: "select", value: "" };
}

/**
 * Sets the spec's create value to the org's base currency and, when the org
 * has another currency available, its edit value to that one (otherwise the
 * edit leaves it unchanged: the select cannot be cleared).
 */
export async function loadCurrencies(api: ApiClient, spec: FieldSpec): Promise<void> {
    const settings = await api.get<CurrencySettings>("/currency/settings");
    const base = settings.baseCurrency?.trim().toUpperCase();
    if (!base) throw new Error("GET /currency/settings returned no baseCurrency");
    spec.value = base;
    const other = (settings.availableCurrencies ?? [])
        .map((code) => code.trim().toUpperCase())
        .find((code) => code && code !== base);
    if (other) spec.edit = other;
}

/** Best-effort: deletes every row of `listPath` that `match` selects, via `deletePath(id)`. */
export async function dropWhere<T extends { id?: string }>(
    api: ApiClient,
    listPath: string,
    match: (row: T) => boolean,
    deletePath: (id: string) => string | Promise<string>,
): Promise<void> {
    const rows = await api.list<T>(listPath).catch(() => [] as T[]);
    for (const row of rows) {
        if (row.id && match(row)) await api.tryDelete(await deletePath(row.id));
    }
}
