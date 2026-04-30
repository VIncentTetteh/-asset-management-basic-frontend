import api from "@/lib/axios";
import { BillingPlan, CheckoutInitRequest, CheckoutInitResponse, Subscription } from "@/types";
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

    toggleAutoRenew: async (enabled: boolean): Promise<Pick<Subscription, "id" | "organisationId" | "status" | "autoRenew">> => {
        const response = await api.patch<Pick<Subscription, "id" | "organisationId" | "status" | "autoRenew">>(
            "/billing/subscription/auto-renew",
            { enabled }
        );
        invalidateRequestCache("billing:");
        return response.data;
    },

    handlePaystackWebhook: async (payload: unknown): Promise<void> => {
        await api.post("/billing/webhooks/paystack", payload);
    },
};
