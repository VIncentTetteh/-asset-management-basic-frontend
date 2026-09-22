import api from "@/lib/axios";
import {
    BillingPlan,
    ChangePlanRequest,
    ChangePlanResponse,
    CheckoutInitRequest,
    CheckoutInitResponse,
    Subscription,
} from "@/types";
import { extractList } from "@/services/responseUtils";
import { filterAndOrderPlans } from "@/lib/plan-filter";
import { invalidateRequestCache, withRequestCache } from "@/services/requestCache";

const normalizeSubscription = (subscription: Subscription): Subscription => ({
    ...subscription,
    autoRenew: subscription.autoRenew ?? subscription.autoRenewEnabled ?? false,
});

export const billingService = {
    getPlans: async (): Promise<BillingPlan[]> => {
        return withRequestCache("billing:plans", async () => {
            const response = await api.get("/billing/plans");
            return filterAndOrderPlans(extractList<BillingPlan>(response.data));
        }, 5 * 60_000);
    },

    getSubscription: async (): Promise<Subscription> => {
        const response = await api.get<Subscription>("/billing/subscription");
        return normalizeSubscription(response.data);
    },

    initializeCheckout: async (payload: CheckoutInitRequest): Promise<CheckoutInitResponse> => {
        const response = await api.post<CheckoutInitResponse>("/billing/checkout", payload);
        return response.data;
    },

    verifyCheckout: async (reference: string): Promise<Subscription> => {
        const response = await api.post<Subscription>("/billing/checkout/verify", null, {
            params: { reference },
        });
        invalidateRequestCache("billing:");
        return normalizeSubscription(response.data);
    },

    /**
     * POST /billing/subscription/change-plan. Upgrades return CHECKOUT (redirect
     * to checkout.authorizationUrl); downgrades return SCHEDULED (effective at
     * period end, no charge). A downgrade the current usage does not fit into
     * fails with 409 and a human-readable message.
     */
    changePlan: async (payload: ChangePlanRequest): Promise<ChangePlanResponse> => {
        const response = await api.post<ChangePlanResponse>("/billing/subscription/change-plan", payload);
        invalidateRequestCache("billing:");
        return { ...response.data, subscription: normalizeSubscription(response.data.subscription) };
    },

    /** DELETE /billing/subscription/scheduled-change — keep the current plan. */
    cancelScheduledChange: async (): Promise<Subscription> => {
        const response = await api.delete<Subscription>("/billing/subscription/scheduled-change");
        invalidateRequestCache("billing:");
        return normalizeSubscription(response.data);
    },

    toggleAutoRenew: async (enabled: boolean): Promise<Pick<Subscription, "id" | "organisationId" | "status" | "autoRenew">> => {
        const response = await api.patch<Pick<Subscription, "id" | "organisationId" | "status" | "autoRenew">>(
            "/billing/subscription/auto-renew",
            { enabled }
        );
        invalidateRequestCache("billing:");
        return response.data;
    },

};
