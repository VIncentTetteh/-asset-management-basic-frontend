import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import BillingPage from "@/app/billing/page";
import { ConfirmDialogHost } from "@/hooks/useConfirm";
import type { BillingPlan, ChangePlanResponse, Subscription } from "@/types";

// ── Service boundary mocks ───────────────────────────────────────────────────
const billing = vi.hoisted(() => ({
    getPlans: vi.fn(),
    getSubscription: vi.fn(),
    changePlan: vi.fn(),
    initializeCheckout: vi.fn(),
    cancelScheduledChange: vi.fn(),
    toggleAutoRenew: vi.fn(),
}));
vi.mock("@/services/billingService", () => ({ billingService: billing }));

const redirectTo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/navigation", () => ({ redirectTo }));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.success = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

// ── Fixtures ─────────────────────────────────────────────────────────────────
const plan = (overrides: Partial<BillingPlan>): BillingPlan => ({
    code: "BASIC",
    name: "Basic",
    tier: "BASIC",
    interval: "MONTHLY",
    amountMinor: 9900,
    currency: "GHS",
    maxAssets: 250,
    maxEmployees: 10,
    analyticsEnabled: false,
    auditRetentionDays: 90,
    ...overrides,
});

const FREEMIUM = plan({ code: "FREEMIUM", name: "Freemium", tier: "FREEMIUM", amountMinor: 0 });
const BASIC = plan({});
const BUSINESS = plan({ code: "BUSINESS", name: "Business", tier: "BUSINESS", amountMinor: 79900 });
const BUSINESS_ANNUAL = plan({
    code: "BUSINESS_ANNUAL", name: "Business (annual)", tier: "BUSINESS", interval: "ANNUALLY", amountMinor: 799000,
});

const subscriptionOn = (current: BillingPlan, overrides: Partial<Subscription> = {}): Subscription => ({
    id: "sub-1",
    organisationId: "org-1",
    plan: current,
    status: "ACTIVE",
    autoRenew: true,
    currentPeriodStart: "2026-09-01T00:00:00Z",
    currentPeriodEnd: "2026-10-01T00:00:00Z",
    nextBillingAt: "2026-10-01T00:00:00Z",
    currentAssetCount: 40,
    currentEmployeeCount: 4,
    currentDepartmentCount: 2,
    scheduledPlan: null,
    scheduledChangeAt: null,
    ...overrides,
});

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <BillingPage />
            <ConfirmDialogHost />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    billing.getPlans.mockResolvedValue([FREEMIUM, BASIC, BUSINESS, BUSINESS_ANNUAL]);
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("BillingPage plan changes", () => {
    it("CHECKOUT: redirects to the provider and keeps buttons disabled (no double submit)", async () => {
        billing.getSubscription.mockResolvedValue(subscriptionOn(FREEMIUM));
        const checkout: ChangePlanResponse = {
            action: "CHECKOUT",
            checkout: { authorizationUrl: "https://checkout.paystack.com/abc", accessCode: "abc", reference: "ref-1" },
            subscription: subscriptionOn(FREEMIUM),
        };
        billing.changePlan.mockResolvedValue(checkout);

        renderPage();
        const upgrades = await screen.findAllByRole("button", { name: /upgrade/i });
        fireEvent.click(upgrades[0]);

        await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("https://checkout.paystack.com/abc"));
        expect(billing.changePlan).toHaveBeenCalledWith({
            planCode: "BASIC",
            callbackUrl: `${window.location.origin}/billing/callback`,
        });
        // Spinner state is not cleared before navigation: every plan button stays disabled.
        for (const button of screen.getAllByRole("button", { name: /upgrade/i })) {
            expect((button as HTMLButtonElement).disabled).toBe(true);
        }
        fireEvent.click(upgrades[0]);
        expect(billing.changePlan).toHaveBeenCalledTimes(1);
    });

    it("SCHEDULED: confirms a downgrade, shows a toast and the scheduled banner", async () => {
        billing.getSubscription.mockResolvedValue(subscriptionOn(BUSINESS));
        const scheduled = subscriptionOn(BUSINESS, {
            scheduledPlan: BASIC,
            scheduledChangeAt: "2026-10-01T00:00:00Z",
        });
        billing.changePlan.mockResolvedValue({ action: "SCHEDULED", checkout: null, subscription: scheduled });

        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: /^downgrade$/i }));
        // The refresh after the change now reports the pending downgrade.
        billing.getSubscription.mockResolvedValue(scheduled);
        fireEvent.click(await screen.findByRole("button", { name: /schedule basic/i }));

        await waitFor(() =>
            expect(toastFns.success).toHaveBeenCalledWith("Your plan will switch to Basic on Oct 1, 2026. No charge today."),
        );
        expect(redirectTo).not.toHaveBeenCalled();
        expect(await screen.findByRole("button", { name: /keep business/i })).toBeTruthy();
    });

    it("shows the backend's 409 message when usage exceeds the target plan", async () => {
        billing.getSubscription.mockResolvedValue(subscriptionOn(BUSINESS));
        const response = {
            status: 409,
            statusText: "Conflict",
            data: { message: "You have 400 assets; Basic allows 250." },
            headers: {},
            config: { headers: new AxiosHeaders() },
        };
        billing.changePlan.mockRejectedValue(new AxiosError("conflict", "ERR_BAD_REQUEST", response.config, null, response));

        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: /^downgrade$/i }));
        fireEvent.click(await screen.findByRole("button", { name: /schedule basic/i }));

        await waitFor(() =>
            expect(toastFns.error).toHaveBeenCalledWith("You have 400 assets; Basic allows 250.", { duration: 8000 }),
        );
        expect((screen.getByRole("button", { name: /^downgrade$/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("PAST_DUE: Pay now falls back to a fresh checkout when change-plan reports NO_CHANGE", async () => {
        const pastDue = subscriptionOn(BUSINESS, { status: "PAST_DUE", graceEndsAt: "2026-10-08T00:00:00Z" });
        billing.getSubscription.mockResolvedValue(pastDue);
        billing.changePlan.mockResolvedValue({ action: "NO_CHANGE", checkout: null, subscription: pastDue });
        billing.initializeCheckout.mockResolvedValue({
            authorizationUrl: "https://checkout.paystack.com/pay", accessCode: "p", reference: "ref-2",
        });

        renderPage();
        expect(await screen.findByText(/Paid features stay on until Oct 8, 2026/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /pay now/i }));

        await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("https://checkout.paystack.com/pay"));
        expect(billing.initializeCheckout).toHaveBeenCalledWith({
            planCode: "BUSINESS",
            callbackUrl: `${window.location.origin}/billing/callback`,
        });
    });

    it("renders an error state with retry instead of an empty page", async () => {
        billing.getSubscription.mockRejectedValueOnce(new Error("Service unavailable"));
        renderPage();
        expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();

        billing.getSubscription.mockResolvedValue(subscriptionOn(FREEMIUM));
        fireEvent.click(screen.getByRole("button", { name: /retry/i }));
        expect(await screen.findByText(/current subscription/i)).toBeTruthy();
    });

    it("toggles monthly/annual plans", async () => {
        billing.getSubscription.mockResolvedValue(subscriptionOn(FREEMIUM));
        renderPage();
        expect(await screen.findByText("Business")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Annual" }));
        expect(await screen.findByText("Business (annual)")).toBeTruthy();
        expect(screen.queryByText("Business")).toBeNull();
    });
});
