import type { ApiClient } from "./api";

/**
 * API shortcuts for records a form needs in a picker. Every one takes a unique
 * (prefixed) name so the spec can select it by its visible text, and returns
 * the created row. Pair each with the matching `drop*` in teardown.
 */

export interface Created {
    id: string;
    [key: string]: unknown;
}

export async function createDepartment(api: ApiClient, name: string, extra: Record<string, unknown> = {}): Promise<Created> {
    return api.post<Created>(await api.withOrg("/departments"), { name, ...extra });
}

export async function createLocation(api: ApiClient, name: string, extra: Record<string, unknown> = {}): Promise<Created> {
    return api.post<Created>("/locations", { name, ...extra });
}

export async function createCategory(api: ApiClient, name: string, extra: Record<string, unknown> = {}): Promise<Created> {
    return api.post<Created>("/categories", { name, ...extra });
}

export async function createSupplier(api: ApiClient, name: string, extra: Record<string, unknown> = {}): Promise<Created> {
    return api.post<Created>(await api.withOrg("/suppliers"), { name, ...extra });
}

/** An in-stock asset that checkouts, transfers and disposals can act on. */
export async function createAsset(api: ApiClient, name: string, extra: Record<string, unknown> = {}): Promise<Created> {
    return api.post<Created>("/assets", {
        name,
        assetTag: name,
        status: "IN_STOCK",
        condition: "GOOD",
        purchaseCost: 1000,
        currency: "USD",
        ...extra,
    });
}

export async function createEmployee(
    api: ApiClient,
    firstName: string,
    lastName: string,
    extra: Record<string, unknown> = {},
): Promise<Created> {
    return api.post<Created>("/employees", { firstName, lastName, ...extra });
}

export const dropDepartment = async (api: ApiClient, id?: string) =>
    id ? api.tryDelete(await api.withOrg(`/departments/${id}`)) : undefined;
export const dropLocation = (api: ApiClient, id?: string) => (id ? api.tryDelete(`/locations/${id}`) : undefined);
export const dropCategory = (api: ApiClient, id?: string) => (id ? api.tryDelete(`/categories/${id}`) : undefined);
export const dropSupplier = async (api: ApiClient, id?: string) =>
    id ? api.tryDelete(await api.withOrg(`/suppliers/${id}`)) : undefined;
export const dropAsset = (api: ApiClient, id?: string) => (id ? api.tryDelete(`/assets/${id}`) : undefined);
export const dropEmployee = (api: ApiClient, id?: string) => (id ? api.tryDelete(`/employees/${id}`) : undefined);

/** YYYY-MM-DD for today plus `days` (local calendar date, as date inputs use). */
export function isoDate(days = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
