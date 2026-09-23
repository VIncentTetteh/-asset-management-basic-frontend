import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotificationsPage from "@/app/notifications/page";
import { Alert } from "@/components/ui/alert";
import { notify } from "@/lib/notify";

/**
 * The three channels, and the line between them.
 *
 * A toast acknowledges something the user just did. An alert states a
 * condition that is still true. The bell carries what happened while they were
 * away. The failure mode this file guards against is the one that actually
 * shipped: a *load* failure announced as a four-second toast, after which the
 * page cheerfully reported "No notifications found" — telling the user the
 * opposite of what had happened.
 */

const svc = vi.hoisted(() => ({
    getNotifications: vi.fn(),
    getSummary: vi.fn(),
    getPreferences: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    deleteAllNotifications: vi.fn(),
    updatePreferences: vi.fn(),
}));
vi.mock("@/services/notificationService", () => ({
    notificationService: svc,
    resolveNotifId: (n: { id?: string }) => n.id ?? "",
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & {
        success: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
        dismiss: ReturnType<typeof vi.fn>;
    };
    fn.success = vi.fn();
    fn.error = vi.fn();
    fn.dismiss = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

beforeEach(() => {
    svc.getSummary.mockResolvedValue({ unreadCount: 0, totalNotifications: 0, byType: {} });
    svc.getPreferences.mockResolvedValue({ emailNotifications: {} });
    toastFns.mockClear();
    toastFns.success.mockClear();
    toastFns.error.mockClear();
});

afterEach(cleanup);

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <NotificationsPage />
        </QueryClientProvider>,
    );
}

describe("a failed data fetch", () => {
    it("shows an inline, retryable error instead of destroying the route", async () => {
        svc.getNotifications.mockRejectedValue(new Error("Request failed with status code 500"));

        renderPage();

        const alert = await screen.findByTestId("data-error");
        expect(alert.textContent).toMatch(/couldn't load your notifications/i);
        expect(alert.getAttribute("role")).toBe("alert");

        // The rest of the page is untouched — this is the whole point of
        // handling it here rather than letting it reach the error boundary.
        expect(screen.getByRole("heading", { name: "Notifications" })).toBeTruthy();
        expect(screen.getByRole("button", { name: /apply/i })).toBeTruthy();
        expect(screen.queryByTestId("error-screen")).toBeNull();
    });

    it("never claims the user has no notifications when the request failed", async () => {
        svc.getNotifications.mockRejectedValue(new Error("boom"));
        renderPage();
        await screen.findByTestId("data-error");
        expect(screen.queryByText("No notifications found")).toBeNull();
    });

    it("is not a toast — a message that vanishes is the same as no message", async () => {
        svc.getNotifications.mockRejectedValue(new Error("boom"));
        renderPage();
        await screen.findByTestId("data-error");
        expect(toastFns.error).not.toHaveBeenCalled();
    });

    it("retries for real, and clears once the request succeeds", async () => {
        svc.getNotifications.mockRejectedValueOnce(new Error("boom"));
        renderPage();

        await screen.findByTestId("data-error");

        svc.getNotifications.mockResolvedValue({
            notifications: [{
                id: "n-1",
                type: "MAINTENANCE",
                title: "Maintenance due",
                message: "Laptop 12 needs service",
                createdAt: "2026-09-20T10:00:00Z",
                read: false,
            }],
        });
        fireEvent.click(screen.getByRole("button", { name: /try again/i }));

        expect(await screen.findByText("Maintenance due")).toBeTruthy();
        await waitFor(() => expect(screen.queryByTestId("data-error")).toBeNull());
    });

    it("puts focus on the error so a keyboard user lands on the retry", async () => {
        svc.getNotifications.mockRejectedValue(new Error("boom"));
        renderPage();
        const alert = await screen.findByTestId("data-error");
        expect(document.activeElement).toBe(alert);
    });
});

describe("an acknowledgement", () => {
    it("is a toast, because the result is already on screen", async () => {
        svc.getNotifications.mockResolvedValue({ notifications: [] });
        svc.markAllAsRead.mockResolvedValue({});

        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: /mark all read/i }));

        await waitFor(() => expect(toastFns.success).toHaveBeenCalledWith("All caught up!", expect.anything()));
        // And it did not become a permanent alert on the page.
        expect(screen.queryByTestId("data-error")).toBeNull();
    });

    it("announces politely, while a failure interrupts", () => {
        notify.success("Asset created");
        expect(toastFns.success).toHaveBeenCalledWith(
            "Asset created",
            expect.objectContaining({ ariaProps: { role: "status", "aria-live": "polite" } }),
        );

        notify.error("Couldn't save that");
        expect(toastFns.error).toHaveBeenCalledWith(
            "Couldn't save that",
            expect.objectContaining({ ariaProps: { role: "alert", "aria-live": "assertive" } }),
        );
    });

    it("keeps a failure on screen longer than a success", () => {
        notify.error("Couldn't save that");
        const [, options] = toastFns.error.mock.calls[0] as [string, { duration: number }];
        expect(options.duration).toBeGreaterThanOrEqual(6_000);
    });
});

describe("the Alert primitive", () => {
    it("interrupts for a problem and stays polite for everything else", () => {
        const { unmount } = render(<Alert tone="danger" title="Plan limit reached" />);
        expect(screen.getByRole("alert").getAttribute("aria-live")).toBe("assertive");
        unmount();

        render(<Alert tone="ok" title="Saved" />);
        expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    });

    it("never relies on colour alone — every tone carries an icon", () => {
        for (const tone of ["info", "ok", "warn", "danger"] as const) {
            const { container, unmount } = render(<Alert tone={tone} title={`A ${tone} thing`} />);
            expect(container.querySelector("svg")).toBeTruthy();
            unmount();
        }
    });

    it("can be focused, so a caller can send the user to it", () => {
        render(<Alert tone="warn" title="Check this" />);
        const alert = screen.getByRole("alert");
        (alert as HTMLElement).focus();
        expect(document.activeElement).toBe(alert);
    });

    it("can opt out of announcing when the page already said it another way", () => {
        render(<Alert tone="danger" title="Already announced" live={false} />);
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.getByText("Already announced")).toBeTruthy();
    });
});
