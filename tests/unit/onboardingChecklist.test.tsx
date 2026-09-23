import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnboardingChecklist } from "@/features/onboarding/OnboardingChecklist";
import WorkspaceSetupPage from "@/app/settings/setup/page";
import type { OnboardingStatus } from "@/types/onboarding";

/**
 * The first-run checklist.
 *
 * The property under test throughout is that the UI reports what the API said
 * and nothing more: a step the server calls outstanding is never shown as done,
 * dismissing never turns into "finished", and a dismissal the server refuses
 * never looks as though it worked.
 */

const onboardingSvc = vi.hoisted(() => ({ getStatus: vi.fn(), dismiss: vi.fn(), restore: vi.fn() }));
vi.mock("@/services/onboardingService", () => ({ onboardingService: onboardingSvc }));
vi.mock("@/services/authService", () => ({ authService: { resendVerification: vi.fn() } }));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.success = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

const status = (overrides: Partial<OnboardingStatus> = {}): OnboardingStatus => ({
    dismissed: false,
    dismissedAt: null,
    complete: false,
    completedSteps: 1,
    totalSteps: 5,
    nextStepKey: "add_categories",
    steps: [
        { key: "verify_email", title: "Confirm your email address", description: "Confirming it keeps your account recoverable.", done: false, count: 0, scope: "YOU", resource: "users", apiPath: "/api/v1/auth/resend-verification", optional: false },
        { key: "add_locations", title: "Add your sites and locations", description: "Assets live somewhere.", done: true, count: 3, scope: "ORGANISATION", resource: "locations", apiPath: "/api/v1/locations", optional: false },
        { key: "add_categories", title: "Set up asset categories", description: "Categories drive depreciation.", done: false, count: 0, scope: "ORGANISATION", resource: "categories", apiPath: "/api/v1/categories", optional: false },
        { key: "invite_team", title: "Invite your colleagues", description: "Other people need their own logins.", done: false, count: 0, scope: "ORGANISATION", resource: "users", apiPath: "/api/v1/invitations", optional: true },
    ],
    ...overrides,
});

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderChecklist = () =>
    render(
        <QueryClientProvider client={client()}>
            <OnboardingChecklist />
        </QueryClientProvider>,
    );

const renderSettings = () =>
    render(
        <QueryClientProvider client={client()}>
            <WorkspaceSetupPage />
        </QueryClientProvider>,
    );

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    onboardingSvc.getStatus.mockResolvedValue(status());
});

describe("the dashboard prompt", () => {
    it("shows each step exactly as the API reported it", async () => {
        renderChecklist();
        const card = await screen.findByTestId("onboarding-checklist");

        expect(within(card).getByText("1 of 5 done")).toBeTruthy();
        // The done step carries its count; the outstanding ones carry a way to act.
        expect(within(card).getByText("3 locations")).toBeTruthy();
        expect(within(card).getByRole("link", { name: /Add a category/i }).getAttribute("href")).toBe("/categories");
        expect(within(card).getByRole("link", { name: /Invite a colleague/i }).getAttribute("href")).toBe("/users");
    });

    it("marks a step done only when the API says so, for a screen reader too", async () => {
        renderChecklist();
        const card = await screen.findByTestId("onboarding-checklist");

        expect(within(card).getByText("Add your sites and locations").textContent).toContain("done");
        expect(within(card).getByText("Set up asset categories").textContent).toContain("still to do");
        // An optional step is named as optional rather than counted as missing.
        expect(within(card).getByText("Invite your colleagues").textContent).toContain("Optional");
    });

    it("stays out of the way once the work is actually finished", async () => {
        onboardingSvc.getStatus.mockResolvedValue(status({ complete: true, completedSteps: 5 }));
        renderChecklist();

        await waitFor(() => expect(onboardingSvc.getStatus).toHaveBeenCalled());
        expect(screen.queryByTestId("onboarding-checklist")).toBeNull();
    });

    it("stays hidden once dismissed, without claiming anything was completed", async () => {
        onboardingSvc.getStatus.mockResolvedValue(status({ dismissed: true }));
        renderChecklist();

        await waitFor(() => expect(onboardingSvc.getStatus).toHaveBeenCalled());
        expect(screen.queryByTestId("onboarding-checklist")).toBeNull();
    });

    it("does not push an error onto the dashboard when the checklist cannot load", async () => {
        onboardingSvc.getStatus.mockRejectedValue(new Error("network down"));
        const { container } = renderChecklist();

        await waitFor(() => expect(onboardingSvc.getStatus).toHaveBeenCalled());
        expect(container.textContent).toBe("");
    });

    it("says so when the server refuses to hide it", async () => {
        onboardingSvc.dismiss.mockRejectedValue(new Error("Forbidden"));
        renderChecklist();
        fireEvent.click(await screen.findByRole("button", { name: /Hide the setup checklist/i }));

        await waitFor(() => expect(toastFns.error).toHaveBeenCalled());
        // Still on screen, which is the truth.
        expect(screen.getByTestId("onboarding-checklist")).toBeTruthy();
    });
});

describe("workspace setup in settings", () => {
    it("keeps reporting what is outstanding after the prompt has been dismissed", async () => {
        onboardingSvc.getStatus.mockResolvedValue(status({ dismissed: true, dismissedAt: new Date().toISOString() }));
        renderSettings();

        expect(await screen.findByText("Set up asset categories")).toBeTruthy();
        expect(screen.getByText("1 of 5 done")).toBeTruthy();
        expect(screen.getByRole("button", { name: /Show on the dashboard/i })).toBeTruthy();
        expect(screen.getByText(/hiding it changed nothing except where it is shown/i)).toBeTruthy();
    });

    it("brings the prompt back through the API, not by guessing the new state", async () => {
        onboardingSvc.getStatus.mockResolvedValue(status({ dismissed: true }));
        onboardingSvc.restore.mockResolvedValue(status({ dismissed: false }));
        renderSettings();
        fireEvent.click(await screen.findByRole("button", { name: /Show on the dashboard/i }));

        await waitFor(() => expect(onboardingSvc.restore).toHaveBeenCalledTimes(1));
        expect(await screen.findByRole("button", { name: /Hide from the dashboard/i })).toBeTruthy();
    });

    it("renders a failed load as a failure rather than an empty checklist", async () => {
        onboardingSvc.getStatus.mockRejectedValue(new Error("network down"));
        renderSettings();

        expect(await screen.findByText(/We couldn't load your setup checklist/i)).toBeTruthy();
        expect(screen.queryByText(/Setup checklist/)).toBeNull();
    });

    it("never calls a workspace complete when a required step is outstanding", async () => {
        renderSettings();

        await screen.findByText("Set up asset categories");
        expect(screen.queryByText(/Your workspace is set up/i)).toBeNull();
    });
});
