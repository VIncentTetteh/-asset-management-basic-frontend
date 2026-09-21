import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { isHandledInline, isPlanLimitError, isPlanLimitMessage } from "@/lib/plan-limit";
import { showPlanLimitNotice } from "@/components/billing/planLimitNotice";
import AnalyticsPage from "@/app/analytics/page";

const toastFn = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { dismiss: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.dismiss = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFn, default: toastFn }));

const analytics = vi.hoisted(() => ({
    getAssetAnalytics: vi.fn(),
    getFinancialAnalytics: vi.fn(),
    getPurchaseOrderAnalytics: vi.fn(),
    getMaintenanceAnalytics: vi.fn(),
    getDepreciationTrends: vi.fn(),
}));
vi.mock("@/services/analyticsService", () => ({ analyticsService: analytics }));
vi.mock("@/contexts/CurrencyContext", () => ({
    useCurrency: () => ({ format: (n?: number | null) => String(n ?? 0), formatCompact: (n?: number | null) => String(n ?? 0) }),
}));

const forbidden = (message: string): AxiosError => {
    const config = { headers: new AxiosHeaders() };
    const response = { status: 403, statusText: "Forbidden", data: { message }, headers: {}, config } as AxiosResponse;
    return new AxiosError(message, "ERR_BAD_REQUEST", config, null, response);
};

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("plan-limit classification", () => {
    it("recognises plan-limit 403s and leaves permission denials alone", () => {
        expect(isPlanLimitMessage("Advanced analytics is available on paid plans only.")).toBe(true);
        expect(isPlanLimitError(forbidden("Asset limit reached for current plan. Upgrade your subscription."))).toBe(true);
        expect(isPlanLimitError(forbidden("Access denied"))).toBe(false);
        expect(isPlanLimitError(new Error("plan"))).toBe(false);
    });

    it("treats analytics endpoints as handled inline", () => {
        expect(isHandledInline("/analytics/assets")).toBe(true);
        expect(isHandledInline("/api/v1/analytics/financial?period=month")).toBe(true);
        expect(isHandledInline("/assets")).toBe(false);
        expect(isHandledInline(undefined)).toBe(false);
    });
});

describe("showPlanLimitNotice", () => {
    it("shows one deduplicated toast (not a modal) for a create limit", () => {
        expect(showPlanLimitNotice({ message: "Asset limit reached", url: "/assets", method: "POST" })).toBe(true);
        expect(toastFn).toHaveBeenCalledTimes(1);
        expect(toastFn.mock.calls[0][1]).toMatchObject({ id: "plan-limit" });
    });

    it("stays silent for analytics, which renders its own upgrade card", () => {
        expect(showPlanLimitNotice({ message: "paid plans only", url: "/analytics/assets", method: "GET" })).toBe(false);
        expect(toastFn).not.toHaveBeenCalled();
    });
});

describe("AnalyticsPage on a free plan", () => {
    beforeEach(() => {
        const err = forbidden("Advanced analytics is available on paid plans only.");
        Object.values(analytics).forEach((fn) => fn.mockRejectedValue(err));
    });

    it("renders an inline upgrade card linking to billing instead of a blocking modal", async () => {
        render(<AnalyticsPage />);
        expect(await screen.findByText("Analytics is available on paid plans")).toBeTruthy();
        expect(screen.getByRole("link", { name: "View plans" }).getAttribute("href")).toBe("/billing");
        expect(screen.queryByText(/Plan Limit Reached/)).toBeNull();
        expect(document.querySelector(".fixed.inset-0")).toBeNull();
    });
});
