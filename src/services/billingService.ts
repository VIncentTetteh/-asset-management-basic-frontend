import api from "@/lib/axios";
import { BillingPlan, CheckoutInitRequest, CheckoutInitResponse, Subscription } from "@/types";
import { extractList } from "@/services/responseUtils";

const normalizeSubscription = (subscription: Subscription): Subscription => ({
    ...subscription,
    autoRenew: subscription.autoRenew ?? subscription.autoRenewEnabled ?? false,
});

export const billingService = {
    getPlans: async (): Promise<BillingPlan[]> => {
        const response = await api.get("/billing/plans");
        return extractList<BillingPlan>(response.data);
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
        return normalizeSubscription(response.data);
    },

    toggleAutoRenew: async (enabled: boolean): Promise<Pick<Subscription, "id" | "organisationId" | "status" | "autoRenew">> => {
        const response = await api.patch<Pick<Subscription, "id" | "organisationId" | "status" | "autoRenew">>(
            "/billing/subscription/auto-renew",
            { enabled }
        );
        return response.data;
    },

    handlePaystackWebhook: async (payload: unknown): Promise<void> => {
        await api.post("/billing/webhooks/paystack", payload);
    },
};
