import { describe, expect, it } from "vitest";
import { formatPlanLimit, isUnlimitedLimit, usageRows } from "@/features/billing/lib";
import type { Subscription } from "@/types";

const INT_MAX = 2_147_483_647;

describe("plan limits", () => {
    it("renders Integer.MAX_VALUE (and null) as Unlimited", () => {
        expect(formatPlanLimit(INT_MAX)).toBe("Unlimited");
        expect(formatPlanLimit(null)).toBe("Unlimited");
        expect(isUnlimitedLimit(INT_MAX)).toBe(true);
    });

    it("formats real limits", () => {
        expect(formatPlanLimit(2500)).toBe((2500).toLocaleString());
        expect(isUnlimitedLimit(250)).toBe(false);
    });

    it("gives unlimited usage rows no cap and no bar", () => {
        const subscription: Subscription = {
            id: "sub-1",
            organisationId: "org-1",
            plan: {
                code: "ENTERPRISE", name: "Enterprise", tier: "ENTERPRISE", interval: "MONTHLY", amountMinor: 0,
                currency: "USD", maxAssets: INT_MAX, maxEmployees: INT_MAX, maxDepartments: 10,
                analyticsEnabled: true, auditRetentionDays: 3650,
            },
            status: "ACTIVE",
            autoRenew: true,
            currentPeriodStart: "2026-09-01T00:00:00Z",
            currentPeriodEnd: "2026-10-01T00:00:00Z",
            nextBillingAt: "2026-10-01T00:00:00Z",
            currentAssetCount: 12,
            currentEmployeeCount: 3,
            currentDepartmentCount: 1,
            scheduledPlan: null,
            scheduledChangeAt: null,
        };
        const rows = usageRows(subscription);
        expect(rows[0]).toMatchObject({ limit: null, percent: null });
        expect(rows[2]).toMatchObject({ limit: 10, percent: 10 });
    });
});
