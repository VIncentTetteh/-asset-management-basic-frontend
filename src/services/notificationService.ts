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

const normalizeNotifications = (payload: unknown): { totalNotifications: number; unreadCount: number; limit: number; notifications: Notification[] } => {
    if (payload && typeof payload === "object" && "notifications" in (payload as Record<string, unknown>)) {
        const obj = payload as NotificationsEnvelope;
        const notifications = Array.isArray(obj.notifications) ? obj.notifications : [];
        return {
            totalNotifications: obj.totalNotifications ?? notifications.length,
            unreadCount: obj.unreadCount ?? notifications.filter((n) => !n.read).length,
            limit: obj.limit ?? notifications.length,
            notifications,
        };
    }

    const notifications = extractList<Notification>(payload);
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
