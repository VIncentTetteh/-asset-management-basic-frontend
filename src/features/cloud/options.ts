import type { CloudAssetDto, CloudEnvironment, CloudMonthlyCostDto, CloudResourceType } from "@/types";

/** The API's `CloudEnvironment` values. Blank means "not set", never a silent PROD. */
export const CLOUD_ENVIRONMENTS: readonly CloudEnvironment[] = ["PROD", "STAGING", "DEV", "TEST", "OTHER"];

/** Every `CloudResourceType` the API accepts, in its order. */
export const CLOUD_RESOURCE_TYPES: readonly CloudResourceType[] = [
    "VIRTUAL_MACHINE", "STORAGE_BUCKET", "DATABASE", "LOAD_BALANCER", "CONTAINER", "SERVERLESS_FUNCTION",
    "NETWORK", "CDN", "DNS", "KUBERNETES_CLUSTER", "VPN_GATEWAY", "CACHE", "MESSAGE_QUEUE", "OTHER",
];

export const resourceTypeLabel = (t: string | null | undefined): string =>
    t ? t.replace(/_/g, " ") : "—";

const blank = (v: unknown): boolean => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const optionalString = (v: unknown): string | null => (blank(v) ? null : String(v).trim());

/** Raw form values: inputs give strings, and a blank number input gives NaN. */
export type CloudAssetForm = Omit<CloudAssetDto, "environment" | "monthlyCostEstimate"> & {
    environment?: string | null;
    monthlyCostEstimate?: number | string | null;
};

/**
 * Full body for POST and PUT /cloud-assets. A blank environment is sent as null
 * ("not set"); it used to default to PROD, so an edit of an asset without one
 * silently marked it production.
 */
export function buildCloudAssetPayload(form: CloudAssetForm): CloudAssetDto {
    const cost = form.monthlyCostEstimate;
    const n = blank(cost) ? NaN : Number(cost);
    return {
        name: String(form.name ?? "").trim(),
        provider: form.provider,
        region: String(form.region ?? "").trim(),
        resourceId: String(form.resourceId ?? "").trim(),
        resourceType: form.resourceType,
        status: form.status,
        accountId: optionalString(form.accountId),
        monthlyCostEstimate: Number.isFinite(n) ? n : null,
        currency: optionalString(form.currency),
        environment: optionalString(form.environment) as CloudEnvironment | null,
        tags: optionalString(form.tags),
        description: optionalString(form.description),
    };
}

/**
 * Body of POST /cloud-assets/{id}/cost. A blank service name is null (the asset
 * as a whole); recording the same month and service again replaces the amount.
 */
export function buildCloudCostPayload(form: { billingMonth?: string; amount?: number | string; serviceName?: string | null }): CloudMonthlyCostDto {
    return {
        billingMonth: String(form.billingMonth ?? ""),
        amount: Number(form.amount),
        serviceName: optionalString(form.serviceName),
    };
}

/** "2026-09" as "Sep 2026" (no Date parsing, so no time-zone shift). */
export function formatBillingMonth(month: string | null | undefined): string {
    const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
    if (!m) return month || "—";
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${names[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** One row of the tag editor. */
export interface TagRow {
    key: string;
    value: string;
}

/**
 * Tags as stored (a JSON object of text values) turned into editor rows. Text
 * that is not such an object (legacy or provider-specific) becomes one row
 * under "tags" so nothing is silently lost when the asset is edited.
 */
export function parseTags(tags: string | null | undefined): TagRow[] {
    if (!tags || !tags.trim()) return [];
    try {
        const parsed: unknown = JSON.parse(tags);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
                key,
                value: typeof value === "string" ? value : JSON.stringify(value),
            }));
        }
    } catch {
        // fall through: not JSON
    }
    return [{ key: "tags", value: tags.trim() }];
}

/** The first problem with the rows (blank or repeated name), or null when they can be saved. */
export function tagRowsError(rows: TagRow[]): string | null {
    const seen = new Set<string>();
    for (const row of rows) {
        const key = row.key.trim();
        if (!key && !row.value.trim()) continue;
        if (!key) return "Every tag needs a name";
        if (seen.has(key)) return `Tag "${key}" is listed twice`;
        seen.add(key);
    }
    return null;
}

/** Editor rows as the API's tags JSON; empty rows are skipped, no tags is null. */
export function serializeTags(rows: TagRow[]): string | null {
    const entries = rows
        .map((r) => [r.key.trim(), r.value.trim()] as const)
        .filter(([key]) => key.length > 0);
    return entries.length ? JSON.stringify(Object.fromEntries(entries)) : null;
}
