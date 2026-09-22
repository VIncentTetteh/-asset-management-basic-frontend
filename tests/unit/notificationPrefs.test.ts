import { describe, expect, it } from "vitest";
import { seedEmailPrefs, toApiPreferences } from "@/services/notificationService";
import type { NotificationPreferences } from "@/types";

describe("notification email preference keys", () => {
    it("reads the API's lower-case keys", () => {
        const prefs = seedEmailPrefs({ emailNotifications: { maintenance: false, purchase_order: true } } as unknown as NotificationPreferences);
        const email = prefs.emailNotifications as unknown as Record<string, boolean>;
        expect(email.MAINTENANCE).toBe(false);
        expect(email.PURCHASE_ORDER).toBe(true);
        expect(email.SYSTEM).toBe(true);
    });

    it("sends lower-case keys the API applies", () => {
        const body = toApiPreferences({ emailNotifications: { MAINTENANCE: false } } as unknown as NotificationPreferences);
        expect(body.emailNotifications).toEqual({ maintenance: false });
    });
});
