import type { ApiClient } from "../../fixtures/api";
import type { Created } from "../../fixtures/prereqs";

/**
 * Shared prerequisites for the core-register form specs (assets, locations,
 * departments, depreciation policies, checkouts, maintenance).
 */

/**
 * The organisation's base currency (GET /currency/settings). Currency selects
 * only list the org's available currencies, so specs pick this one rather than
 * hard-coding USD.
 */
export async function baseCurrency(api: ApiClient): Promise<string> {
    const settings = await api.get<{ baseCurrency?: string }>("/currency/settings");
    return (settings?.baseCurrency ?? "USD").trim().toUpperCase();
}

/** A draft purchase order, so the asset form's "Purchase order" picker has a real value. */
export async function createPurchaseOrder(
    api: ApiClient,
    poNumber: string,
    departmentId: string,
    supplierId: string,
    currency: string,
): Promise<Created> {
    return api.post<Created>(await api.withOrg("/purchase-orders"), {
        poNumber,
        totalAmount: 1000,
        currency,
        departmentId,
        supplierId,
    });
}

export const dropPurchaseOrder = async (api: ApiClient, id?: string): Promise<void> =>
    id ? api.tryDelete(await api.withOrg(`/purchase-orders/${id}`)) : undefined;

/** How the checkout table prints a calendar date: "Oct 6, 2026" (en-US, short month). */
export function tableDate(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
