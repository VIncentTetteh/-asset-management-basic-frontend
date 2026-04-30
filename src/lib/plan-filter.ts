import type { BillingPlan } from "@/types";

const ALLOWED_PLAN_CODES = new Set(["FREEMIUM", "BASIC", "BUSINESS", "ENTERPRISE"]);
const ALLOWED_PLAN_TIERS = new Set(["FREEMIUM", "BASIC", "BUSINESS", "ENTERPRISE"]);

const TIER_ORDER: Record<string, number> = {
    FREEMIUM: 0,
    BASIC: 1,
    BUSINESS: 2,
    ENTERPRISE: 3,
};

const tierOf = (plan: BillingPlan) => (plan.tier ?? "").toString().toUpperCase();

export const isVisiblePlan = (plan: BillingPlan): boolean => {
    if (!plan?.code) return false;
    return ALLOWED_PLAN_CODES.has(plan.code) && ALLOWED_PLAN_TIERS.has(tierOf(plan));
};

export const filterAndOrderPlans = (plans: readonly BillingPlan[]): BillingPlan[] =>
    plans
        .filter(isVisiblePlan)
        .slice()
        .sort((a, b) => {
            const tierDelta = (TIER_ORDER[tierOf(a)] ?? Number.MAX_SAFE_INTEGER)
                - (TIER_ORDER[tierOf(b)] ?? Number.MAX_SAFE_INTEGER);
            return tierDelta || (a.amountMinor ?? 0) - (b.amountMinor ?? 0);
        });
