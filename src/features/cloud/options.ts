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
