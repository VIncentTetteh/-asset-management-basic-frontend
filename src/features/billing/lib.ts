// Billing view helpers: plan classification, interval grouping, formatting.

import type { BillingInterval, BillingPlan, Subscription } from "@/types";
import { formatMoney } from "@/lib/currency";

/**
 * Where the payment provider returns the browser after checkout. The backend
 * only accepts a same-origin callback. No trailing slash: next.config.ts has
 * trailingSlash off, and CloudFront strips a trailing slash anyway.
 */
export const BILLING_CALLBACK_PATH = "/billing/callback";

export const billingCallbackUrl = (): string => `${window.location.origin}${BILLING_CALLBACK_PATH}`;

export const billingQueryKeys = {
    all: ["billing"] as const,
    plans: ["billing", "plans"] as const,
    subscription: ["billing", "subscription"] as const,
};

const TIER_RANK: Record<string, number> = { FREEMIUM: 0, BASIC: 1, BUSINESS: 2, ENTERPRISE: 3 };

export const tierOf = (plan?: BillingPlan | null): string => (plan?.tier ?? "").toUpperCase();

export const isEnterprisePlan = (plan: BillingPlan): boolean =>
    plan.code === "ENTERPRISE" || tierOf(plan) === "ENTERPRISE";

export const isFreePlan = (plan: BillingPlan): boolean =>
    plan.code === "FREEMIUM" || ((plan.amountMinor ?? 0) <= 0 && !isEnterprisePlan(plan));

export const planInterval = (plan?: BillingPlan | null): BillingInterval =>
    plan?.interval === "ANNUALLY" ? "ANNUALLY" : "MONTHLY";

/** "/ month", "/ year" — safe when the interval is missing. */
export const intervalSuffix = (plan?: BillingPlan | null): string =>
    planInterval(plan) === "ANNUALLY" ? "year" : "month";

export const formatMoneyMinor = (amountMinor: number | null | undefined, currency: string): string =>
    formatMoney((amountMinor ?? 0) / 100, currency);

export const formatBillingDate = (value?: string | null): string => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? value
        : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
};

/** Price normalised to one month, so monthly and annual plans compare fairly. */
const monthlyEquivalent = (plan: BillingPlan): number =>
    (plan.amountMinor ?? 0) / (planInterval(plan) === "ANNUALLY" ? 12 : 1);

export type PlanDirection = "current" | "upgrade" | "downgrade" | "switch";

/**
 * A label hint only — the backend decides whether a change is a checkout or a
 * scheduled downgrade. Anything bought while on a free or expired plan is an upgrade.
 */
export function planDirection(plan: BillingPlan, subscription: Subscription | null): PlanDirection {
    const current = subscription?.plan;
    if (!current || isFreePlan(current) || subscription?.status === "EXPIRED") {
        return current?.code === plan.code && subscription?.status !== "EXPIRED" ? "current" : "upgrade";
    }
    if (current.code === plan.code) return "current";
    const tierDelta = (TIER_RANK[tierOf(plan)] ?? 0) - (TIER_RANK[tierOf(current)] ?? 0);
    if (tierDelta !== 0) return tierDelta > 0 ? "upgrade" : "downgrade";
    if (planInterval(plan) !== planInterval(current)) return "switch";
    return monthlyEquivalent(plan) >= monthlyEquivalent(current) ? "upgrade" : "downgrade";
}

/**
 * One card per tier for the selected interval: the matching variant when the
 * tier has one, otherwise its only variant (e.g. Freemium, Enterprise).
 */
export function plansForInterval(plans: readonly BillingPlan[], interval: BillingInterval): BillingPlan[] {
    const byTier = new Map<string, BillingPlan>();
    for (const plan of plans) {
        const key = tierOf(plan) || plan.code;
        const existing = byTier.get(key);
        if (!existing || (planInterval(plan) === interval && planInterval(existing) !== interval)) {
            byTier.set(key, plan);
        }
    }
    return Array.from(byTier.values());
}

export const hasAnnualPlans = (plans: readonly BillingPlan[]): boolean =>
    plans.some((plan) => planInterval(plan) === "ANNUALLY");

export interface UsageRow {
    label: string;
    used: number;
    limit: number | null;
    percent: number | null;
}

/**
 * Limits at or above this are "no limit". The backend encodes Enterprise's
 * unlimited caps as Integer.MAX_VALUE (2,147,483,647); older seeds used 999,999.
 */
const UNLIMITED = 999_999;

/** True when a plan limit means "no limit" (null/undefined, or a sentinel value). */
export const isUnlimitedLimit = (limit: number | null | undefined): boolean => limit == null || limit >= UNLIMITED;

/** "Unlimited" for sentinel limits, else the grouped number ("2,500"). */
export const formatPlanLimit = (limit: number | null | undefined): string =>
    isUnlimitedLimit(limit) ? "Unlimited" : (limit as number).toLocaleString();

export function usageRows(subscription: Subscription): UsageRow[] {
    const row = (label: string, used: number | undefined, limit: number | null | undefined): UsageRow => {
        const cap = isUnlimitedLimit(limit) ? null : (limit as number);
        const count = used ?? 0;
        return { label, used: count, limit: cap, percent: cap ? Math.min(Math.round((count / cap) * 100), 999) : null };
    };
    return [
        row("Assets", subscription.currentAssetCount, subscription.plan.maxAssets),
        row("Employees", subscription.currentEmployeeCount, subscription.plan.maxEmployees),
        // No plan limits departments, so they get no usage row.
    ];
}

/** "Save 17%" for a plan with a discount, else null. */
export function planDiscountLabel(discountPercent: number | null | undefined): string | null {
    const pct = Number(discountPercent);
    if (discountPercent == null || !Number.isFinite(pct) || pct <= 0) return null;
    return `Save ${Math.round(pct)}%`;
}
