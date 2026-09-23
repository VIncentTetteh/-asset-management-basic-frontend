import type { Page } from "@playwright/test";
import type { ApiClient } from "../../fixtures/api";
import type { FieldSpec } from "../../fixtures/forms";
import type { Created } from "../../fixtures/prereqs";
import { isoDate } from "../../fixtures/prereqs";

/**
 * Shared bits for the finance form specs (suppliers, purchase orders, contracts,
 * budgets, expenses): the tenant's currencies, budgets as prerequisites, and the
 * organisation id for API calls that carry it in the body.
 */

export interface OrgCurrencies {
    /** The tenant's base currency (what a currency select defaults to). */
    base: string;
    /** Another currency the select offers, when the tenant has exchange rates. */
    other?: string;
}

/**
 * The currencies a CurrencyOptions select lists (GET /currency/settings): the
 * base currency plus every one with a rate. Staging's set is not fixed, so the
 * currency field's values are filled in at setup from this.
 */
export async function orgCurrencies(api: ApiClient): Promise<OrgCurrencies> {
    const settings = await api.get<{ baseCurrency?: string; availableCurrencies?: string[] }>("/currency/settings");
    const base = (settings.baseCurrency ?? "USD").toUpperCase();
    const other = (settings.availableCurrencies ?? []).map((c) => c.toUpperCase()).find((c) => c !== base);
    return { base, other };
}

/**
 * Points a currency FieldSpec at the tenant's currencies: create with the base
 * currency, edit to another one when there is one (else the field is left as is,
 * since the select has no empty option to clear to).
 */
export function applyCurrencies(spec: FieldSpec, currencies: OrgCurrencies, changeOnEdit = true): void {
    spec.value = currencies.base;
    spec.edit = changeOnEdit ? currencies.other : undefined;
}

/** An ACTIVE budget in `currency`, open for a year, that POs and expenses can link to. */
export async function createBudget(
    api: ApiClient,
    name: string,
    currency: string,
    extra: Record<string, unknown> = {},
): Promise<Created> {
    return api.post<Created>("/budgets", {
        name,
        totalAmount: 100_000,
        currency,
        status: "ACTIVE",
        periodStart: isoDate(-1),
        periodEnd: isoDate(365),
        ...extra,
    });
}

/** Best-effort budget delete (refused once ledger entries hold it; the prefix marks leftovers). */
export const dropBudget = (api: ApiClient, id?: string) => (id ? api.tryDelete(`/budgets/${id}`) : undefined);

/** The organisation the signed-in session is pinned to (localStorage `verifiedOrganisationId`). */
export async function organisationIdOf(page: Page): Promise<string> {
    const state = await page.context().storageState();
    for (const origin of state.origins) {
        const entry = origin.localStorage.find((item) => item.name === "verifiedOrganisationId");
        if (entry?.value) return entry.value;
    }
    throw new Error("No verifiedOrganisationId in the saved session");
}

/** A DRAFT contract for a year, for tests that need one to attach documents to. */
export async function createContract(
    api: ApiClient,
    title: string,
    extra: Record<string, unknown> = {},
): Promise<Created> {
    return api.post<Created>("/contracts", {
        title,
        contractType: "MAINTENANCE",
        status: "DRAFT",
        startDate: isoDate(0),
        endDate: isoDate(365),
        ...extra,
    });
}

/** Best-effort contract delete (the prefix marks anything the API refuses to remove). */
export const dropContract = (api: ApiClient, id?: string) => (id ? api.tryDelete(`/contracts/${id}`) : undefined);
