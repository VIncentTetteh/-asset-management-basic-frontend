import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "@/components/notifications/NotificationBell";

// ── Service boundary mocks ───────────────────────────────────────────────────
const svc = vi.hoisted(() => ({
    getSummary: vi.fn(),
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
}));
vi.mock("@/services/notificationService", () => ({
    notificationService: svc,
    resolveNotifId: (n: { id?: string; notificationId?: string }) => (n.id || n.notificationId) ?? "",
}));

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("react-hot-toast", () => ({
    toast: { error: toastError, success: vi.fn() },
}));

const unreadItem = {
    id: "n-1",
    type: "MAINTENANCE",
    title: "Maintenance due",
    message: "Laptop 12 needs service",
    createdAt: "2026-09-20T10:00:00Z",
    read: false,
    actionUrl: "/maintenance?id=m-1",
};

function renderBell() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <NotificationBell />
            <button type="button">outside</button>
        </QueryClientProvider>,
    );
}

const trigger = () => screen.getByRole("button", { name: /^Notifications/ });

beforeEach(() => {
    svc.getSummary.mockResolvedValue({ unreadCount: 3, totalNotifications: 10 });
    svc.getNotifications.mockResolvedValue({ totalNotifications: 1, unreadCount: 1, limit: 5, notifications: [unreadItem] });
    svc.markAsRead.mockResolvedValue({ read: true, readAt: "2026-09-21T00:00:00Z" });
    svc.markAllAsRead.mockResolvedValue({ markedAsRead: 3, markedAt: "2026-09-21T00:00:00Z" });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("NotificationBell", () => {
    it("shows the unread count badge from the summary", async () => {
        renderBell();
        expect((await screen.findByTestId("notification-badge")).textContent).toBe("3");
        expect(trigger().getAttribute("aria-label")).toBe("Notifications, 3 unread");
    });

    it("opens on click, lists latest unread, and closes on Escape and outside click", async () => {
        renderBell();
        fireEvent.click(trigger());
        expect(trigger().getAttribute("aria-expanded")).toBe("true");
        expect(await screen.findByText("Maintenance due")).toBeTruthy();
        expect(svc.getNotifications).toHaveBeenCalledWith({ status: "unread", limit: 5 });

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(trigger().getAttribute("aria-expanded")).toBe("false");

        fireEvent.click(trigger());
        expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy();
        fireEvent.mouseDown(screen.getByRole("button", { name: "outside" }));
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("marks an item read and navigates to its action URL", async () => {
        renderBell();
        fireEvent.click(trigger());
        fireEvent.click(await screen.findByText("Maintenance due"));
        await waitFor(() => expect(svc.markAsRead).toHaveBeenCalledWith("n-1"));
        expect(push).toHaveBeenCalledWith("/maintenance?id=m-1");
    });

    it("marks all as read through the service", async () => {
        renderBell();
        await screen.findByTestId("notification-badge");
        fireEvent.click(trigger());
        await screen.findByText("Maintenance due");
        fireEvent.click(screen.getByRole("button", { name: /Mark all as read/ }));
        await waitFor(() => expect(svc.markAllAsRead).toHaveBeenCalledTimes(1));
    });

    it("drops the badge to zero the moment Mark all is pressed, without waiting for the server", async () => {
        // The badge used to sit at its old count for the whole round trip,
        // which reads as a button that did nothing. useOptimistic shows the
        // result immediately; the request is still in flight here.
        let resolve: (value: unknown) => void = () => {};
        svc.markAllAsRead.mockImplementation(() => new Promise((r) => { resolve = r; }));

        renderBell();
        expect((await screen.findByTestId("notification-badge")).textContent).toBe("3");
        fireEvent.click(trigger());
        await screen.findByText("Maintenance due");

        fireEvent.click(screen.getByRole("button", { name: /Mark all as read/ }));

        await waitFor(() => expect(screen.queryByTestId("notification-badge")).toBeNull());
        expect(svc.markAllAsRead).toHaveBeenCalledTimes(1);
        resolve({ markedAsRead: 3 });
    });

    it("puts the badge back — and says so — when marking all fails", async () => {
        svc.markAllAsRead.mockRejectedValue(new Error("network"));

        renderBell();
        await screen.findByTestId("notification-badge");
        fireEvent.click(trigger());
        await screen.findByText("Maintenance due");

        fireEvent.click(screen.getByRole("button", { name: /Mark all as read/ }));

        // The optimistic zero is reverted by React when the transition ends;
        // no hand-written rollback is involved, which is why it cannot drift.
        await waitFor(() => expect(screen.getByTestId("notification-badge").textContent).toBe("3"));
        expect(toastError).toHaveBeenCalledWith("Couldn't mark notifications as read", expect.anything());
    });

    it("shows an inline retry when its own list fails, rather than an empty panel", async () => {
        svc.getNotifications.mockRejectedValueOnce(new Error("boom"));

        renderBell();
        fireEvent.click(trigger());

        expect(await screen.findByText(/couldn't load your notifications/i)).toBeTruthy();
        // Not "You're all caught up" — the difference between "nothing to see"
        // and "we could not look" is the whole message.
        expect(screen.queryByText("You're all caught up")).toBeNull();

        svc.getNotifications.mockResolvedValue({ totalNotifications: 1, unreadCount: 1, limit: 5, notifications: [unreadItem] });
        fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
        expect(await screen.findByText("Maintenance due")).toBeTruthy();
    });

    it("shows the empty state and a View all link to /notifications", async () => {
        svc.getNotifications.mockResolvedValue({ totalNotifications: 0, unreadCount: 0, limit: 5, notifications: [] });
        renderBell();
        fireEvent.click(trigger());
        expect(await screen.findByText("You're all caught up")).toBeTruthy();
        expect(screen.getByRole("link", { name: "View all" }).getAttribute("href")).toBe("/notifications");
    });
});
