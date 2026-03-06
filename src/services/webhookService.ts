import api from "@/lib/axios";
import { Webhook, WebhookDelivery } from "@/types";

export interface WebhookTestResponse {
    webhookId: string;
    testStatus: string;
    statusCode: number;
    responseTime: number;
    testPayload: {
        event: string;
        timestamp: string;
        data: Record<string, unknown>;
    };
    response: string;
}

export const webhookService = {
    create: async (data: Partial<Webhook>): Promise<Webhook> => {
        const response = await api.post<Webhook>("/webhooks", data);
        return response.data;
    },
    list: async (): Promise<{ totalWebhooks: number; activeWebhooks: number; webhooks: Webhook[] }> => {
        const response = await api.get<{ totalWebhooks: number; activeWebhooks: number; webhooks: Webhook[] }>("/webhooks");
        return response.data;
    },
    get: async (webhookId: string): Promise<Webhook> => {
        const response = await api.get<Webhook>(`/webhooks/${webhookId}`);
        return response.data;
    },
    update: async (webhookId: string, data: Partial<Webhook>): Promise<Webhook> => {
        const response = await api.patch<Webhook>(`/webhooks/${webhookId}`, data);
        return response.data;
    },
    delete: async (webhookId: string): Promise<void> => {
        await api.delete(`/webhooks/${webhookId}`);
    },
    getDeliveries: async (webhookId: string, params?: { status?: string; limit?: number }): Promise<{ webhookId: string; totalDeliveries: number; successfulDeliveries: number; failedDeliveries: number; limit: number; deliveries: WebhookDelivery[] }> => {
        const response = await api.get(`/webhooks/${webhookId}/deliveries`, { params });
        return response.data;
    },
    testWebhook: async (webhookId: string): Promise<WebhookTestResponse> => {
        const response = await api.post<WebhookTestResponse>(`/webhooks/${webhookId}/test`);
        return response.data;
    }
};
