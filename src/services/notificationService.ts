import api from "@/lib/axios";
import { Notification, NotificationPreferences, NotificationSummary, NOTIFICATION_TYPES } from "@/types";
import { extractList } from "@/services/responseUtils";

export interface NotificationReadResponse {
    id?: string;
    notificationId?: string;
    read: boolean;
    readAt: string;
}

export interface MarkAllReadResponse {
    markedAsRead: number;
    markedAt: string;
}

interface NotificationsEnvelope {
    totalNotifications?: number;
    unreadCount?: number;
    limit?: number;
    notifications?: Notification[];
}

/** Resolve id from either `id` or `notificationId` field */
export const resolveNotifId = (n: Notification): string =>
    (n.id || n.notificationId) ?? "";

/** Transform backend API URLs to frontend UI URLs */
export const transformActionUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    
    // Normalize absolute URLs or API paths
    let path = url;
    if (url.includes("/api/v1/")) {
        path = url.split("/api/v1/")[1];
    } else if (url.startsWith("/api/")) {
        path = url.split("/api/")[1];
    } else if (url.startsWith("http")) {
        // External or absolute URL but not containing our API pattern
        return url;
    }

    // path is now something like "assets/uuid" or "purchase-orders/uuid"
    const parts = path.split("?")[0].split("/"); // ignore query params from backend if any
    
    if (parts.length >= 2) {
        const resource = parts[0]; // e.g. "assets"
        const id = parts[1];       // e.g. "123-uuid"
        
        // Map common resources to their frontend routes + deep link query param
        const resourceMap: Record<string, string> = {
            "assets": "assets",
            "purchase-orders": "purchase-orders",
            "departments": "departments",
            "locations": "locations",
            "categories": "categories",
            "suppliers": "suppliers",
            "contracts": "contracts",
            "licenses": "licenses",
            "maintenance": "maintenance",
            "disposals": "disposals",
            "audit-events": "audit-events"
        };
        
        const uiResource = resourceMap[resource] || resource;
        return `/${uiResource}?id=${id}`;
    }
    
    return url.startsWith("/") ? url : `/${url}`;
};

const normalizeNotifications = (payload: unknown): { totalNotifications: number; unreadCount: number; limit: number; notifications: Notification[] } => {
    if (payload && typeof payload === "object" && "notifications" in (payload as Record<string, unknown>)) {
        const obj = payload as NotificationsEnvelope;
        const notifications = (Array.isArray(obj.notifications) ? obj.notifications : []).map(n => ({
            ...n,
            actionUrl: transformActionUrl(n.actionUrl)
        }));
        return {
            totalNotifications: obj.totalNotifications ?? notifications.length,
            unreadCount: obj.unreadCount ?? notifications.filter((n) => !n.read).length,
            limit: obj.limit ?? notifications.length,
            notifications,
        };
    }

    const notifications = extractList<Notification>(payload).map(n => ({
        ...n,
        actionUrl: transformActionUrl(n.actionUrl)
    }));
    return {
        totalNotifications: notifications.length,
        unreadCount: notifications.filter((n) => !n.read).length,
        limit: notifications.length,
        notifications,
    };
};

/** Ensure every known notification type has an entry in emailNotifications */
const seedEmailPrefs = (prefs: NotificationPreferences): NotificationPreferences => {
    const seeded: Record<string, boolean> = {};
    for (const t of NOTIFICATION_TYPES) {
        seeded[t] = prefs.emailNotifications?.[t] ?? true;
    }
    return { ...prefs, emailNotifications: { ...seeded, ...prefs.emailNotifications } };
};

export const notificationService = {
    getNotifications: async (params?: { type?: string; status?: "unread" | "read" | "all"; limit?: number }): Promise<{ totalNotifications: number; unreadCount: number; limit: number; notifications: Notification[] }> => {
        const response = await api.get("/notifications", { params });
        return normalizeNotifications(response.data);
    },

    markAsRead: async (notificationId: string): Promise<NotificationReadResponse> => {
        const response = await api.patch<NotificationReadResponse>(`/notifications/${notificationId}/read`);
        return response.data;
    },

    markAllAsRead: async (): Promise<MarkAllReadResponse> => {
        const response = await api.patch<MarkAllReadResponse>("/notifications/mark-all-read");
        return response.data;
    },

    deleteNotification: async (notificationId: string): Promise<void> => {
        await api.delete(`/notifications/${notificationId}`);
    },

    deleteAllNotifications: async (): Promise<void> => {
        await api.delete("/notifications");
    },

    getPreferences: async (): Promise<NotificationPreferences> => {
        const response = await api.get<NotificationPreferences>("/notifications/preferences");
        return seedEmailPrefs(response.data);
    },

    updatePreferences: async (data: Partial<NotificationPreferences>): Promise<{ updated: boolean; updatedAt: string; preferences: NotificationPreferences }> => {
        const response = await api.patch("/notifications/preferences", data);
        return response.data;
    },

    getSummary: async (): Promise<NotificationSummary> => {
        const response = await api.get<NotificationSummary>("/notifications/summary");
        return response.data;
    },
};
