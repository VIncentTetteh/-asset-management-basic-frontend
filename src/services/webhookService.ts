import api from "@/lib/axios";
import { Webhook, WebhookDelivery } from "@/types";
import { extractList } from "@/services/responseUtils";

export interface WebhookListResponse {
    totalWebhooks: number;
    activeWebhooks: number;
    webhooks: Webhook[];
}

export interface WebhookDeliveryPageResponse {
    deliveries: WebhookDelivery[];
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    // Spring page format (if backend upgrades to paginated)
    content?: WebhookDelivery[];
    totalElements?: number;
    totalPages?: number;
    number?: number;
    size?: number;
}

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

/** Normalise the webhook list — spec says plain Array, service previously
 *  expected a custom envelope. We handle both shapes safely. */
const normalizeWebhookList = (data: unknown): WebhookListResponse => {
    if (Array.isArray(data)) {
        return {
            webhooks: data as Webhook[],
            totalWebhooks: (data as Webhook[]).length,
            activeWebhooks: (data as Webhook[]).filter((w) => w.active).length,
        };
    }
    const env = data as Partial<WebhookListResponse>;
    return {
        webhooks: env.webhooks ?? extractList<Webhook>(data),
        totalWebhooks: env.totalWebhooks ?? (env.webhooks?.length ?? 0),
        activeWebhooks: env.activeWebhooks ?? (env.webhooks?.filter((w) => w.active).length ?? 0),
    };
};

/** Normalise delivery response — handles both custom envelope and Spring page. */
const normalizeDeliveryResponse = (data: unknown): WebhookDeliveryPageResponse => {
    const d = data as Record<string, unknown>;
    // Spring Page format
    if (Array.isArray(d.content)) {
        return {
            deliveries: d.content as WebhookDelivery[],
            totalDeliveries: (d.totalElements as number) ?? (d.content as unknown[]).length,
            successfulDeliveries: (d.content as WebhookDelivery[]).filter((w) => w.status === "SUCCESS").length,
            failedDeliveries: (d.content as WebhookDelivery[]).filter((w) => w.status !== "SUCCESS").length,
            content: d.content as WebhookDelivery[],
            totalElements: d.totalElements as number,
            totalPages: d.totalPages as number,
            number: d.number as number,
            size: d.size as number,
        };
    }
    // Custom envelope format (original)
    if (Array.isArray(d.deliveries)) {
        return {
            deliveries: d.deliveries as WebhookDelivery[],
            totalDeliveries: (d.totalDeliveries as number) ?? (d.deliveries as unknown[]).length,
            successfulDeliveries: (d.successfulDeliveries as number) ?? 0,
            failedDeliveries: (d.failedDeliveries as number) ?? 0,
        };
    }
    // Plain array
    if (Array.isArray(data)) {
        const list = data as WebhookDelivery[];
        return {
            deliveries: list,
            totalDeliveries: list.length,
            successfulDeliveries: list.filter((w) => w.status === "SUCCESS").length,
            failedDeliveries: list.filter((w) => w.status !== "SUCCESS").length,
        };
    }
    return { deliveries: [], totalDeliveries: 0, successfulDeliveries: 0, failedDeliveries: 0 };
};

export const webhookService = {
    create: async (data: Partial<Webhook>): Promise<Webhook> => {
        const response = await api.post<Webhook>("/webhooks", data);
        return response.data;
    },

    /** GET /webhooks — spec returns Array<Webhook>; legacy backend may return custom envelope.
     *  Both are handled by normalizeWebhookList(). */
    list: async (): Promise<WebhookListResponse> => {
        const response = await api.get("/webhooks");
        return normalizeWebhookList(response.data);
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

    /** GET /webhooks/{id}/deliveries — spec says paginated; legacy backend may return custom envelope.
     *  Both are handled by normalizeDeliveryResponse(). */
    getDeliveries: async (
        webhookId: string,
        params?: { status?: string; page?: number; size?: number; limit?: number }
    ): Promise<WebhookDeliveryPageResponse> => {
        const queryParams: Record<string, string | number> = {};
        if (params?.status) queryParams.status = params.status;
        if (params?.page !== undefined) queryParams.page = params.page;
        if (params?.size !== undefined) queryParams.size = params.size;
        if (params?.limit !== undefined) queryParams.limit = params.limit;
        const response = await api.get(`/webhooks/${webhookId}/deliveries`, { params: queryParams });
        return normalizeDeliveryResponse(response.data);
    },

    /** POST /webhooks/{id}/test — spec returns WebhookDeliveryDto.
     *  We accept either shape. */
    testWebhook: async (webhookId: string): Promise<WebhookTestResponse | WebhookDelivery> => {
        const response = await api.post(`/webhooks/${webhookId}/test`);
        return response.data;
    },

    getDelivery: async (webhookId: string, deliveryId: string): Promise<WebhookDelivery> => {
        const response = await api.get<WebhookDelivery>(`/webhooks/${webhookId}/deliveries/${deliveryId}`);
        return response.data;
    },
};
