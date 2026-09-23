"use client";

import { safeInternalPath } from "@/lib/safe-url";
import { useCallback, useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { notificationService, resolveNotifId } from "@/services/notificationService";
import { formatRelativeTime } from "@/lib/time";
import type { Notification } from "@/types";

const SUMMARY_REFETCH_MS = 60_000;
const LATEST_UNREAD_LIMIT = 5;
const BADGE_MAX = 99;

export const notificationQueryKeys = {
    all: ["notifications"] as const,
    summary: ["notifications", "summary"] as const,
    latestUnread: ["notifications", "latest-unread"] as const,
    preferences: ["notifications", "preferences"] as const,
    /** The /notifications list, per set of applied filters. */
    list: (filters: unknown) => ["notifications", "list", filters] as const,
};

/** Only same-app paths are navigated to from the bell; anything else is ignored. */
const internalPath = safeInternalPath;

/**
 * Header notification bell: unread badge (polled every minute) and a popover
 * with the five latest unread notifications, "Mark all as read" and "View all".
 */
export function NotificationBell() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const panelId = useId();

    const summaryQuery = useQuery({
        queryKey: notificationQueryKeys.summary,
        queryFn: notificationService.getSummary,
        refetchInterval: SUMMARY_REFETCH_MS,
    });
    const listQuery = useQuery({
        queryKey: notificationQueryKeys.latestUnread,
        queryFn: () => notificationService.getNotifications({ status: "unread", limit: LATEST_UNREAD_LIMIT }),
        enabled: open,
    });

    const refresh = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    }, [queryClient]);

    const markAll = useMutation({
        mutationFn: notificationService.markAllAsRead,
        onSuccess: refresh,
        onError: () => notify.error("Couldn't mark notifications as read"),
    });
    const markOne = useMutation({
        mutationFn: (id: string) => notificationService.markAsRead(id),
        onSettled: refresh,
    });

    const close = useCallback((restoreFocus: boolean) => {
        setOpen(false);
        if (restoreFocus) triggerRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!open) return;
        panelRef.current?.focus();
        const onPointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) close(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") close(true);
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open, close]);

    const unread = summaryQuery.data?.unreadCount ?? 0;
    const items = (listQuery.data?.notifications ?? []).filter((n) => !n.read).slice(0, LATEST_UNREAD_LIMIT);

    /**
     * "Mark all as read" used to leave the badge showing the old count for as
     * long as the round trip took, which reads as a dead button. React 19's
     * useOptimistic shows zero immediately and — this is the part a manual
     * useState cannot do — puts it back by itself if the request fails, with
     * no rollback code to get wrong. The revert is tied to the transition
     * ending, so it cannot drift out of sync with the mutation.
     */
    const [optimisticUnread, showUnreadAs] = useOptimistic(unread, (_current, next: number) => next);
    const [markingAll, startMarkingAll] = useTransition();

    const markAllAsRead = () => {
        startMarkingAll(async () => {
            showUnreadAs(0);
            // The rejection is already reported by the mutation's onError. If it
            // escaped this transition it would reach the route error boundary and
            // destroy the page over a failed bell action.
            await markAll.mutateAsync().catch(() => undefined);
        });
    };

    const openItem = (notification: Notification) => {
        const id = resolveNotifId(notification);
        if (id) markOne.mutate(id);
        const target = internalPath(notification.actionUrl);
        close(false);
        if (target) router.push(target);
    };

    return (
        <div ref={containerRef} className="relative">
            <Button
                ref={triggerRef}
                variant="outline"
                size="icon"
                aria-label={optimisticUnread > 0 ? `Notifications, ${optimisticUnread} unread` : "Notifications"}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => (open ? close(false) : setOpen(true))}
                className="relative"
            >
                <Bell className="h-4 w-4" />
                {optimisticUnread > 0 ? (
                    <span
                        data-testid="notification-badge"
                        className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white"
                    >
                        {optimisticUnread > BADGE_MAX ? `${BADGE_MAX}+` : optimisticUnread}
                    </span>
                ) : null}
            </Button>

            {open ? (
                <div
                    ref={panelRef}
                    id={panelId}
                    role="dialog"
                    aria-label="Notifications"
                    tabIndex={-1}
                    className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-edge bg-surface shadow-lg outline-none"
                >
                    <div className="flex items-center justify-between border-b border-edge-subtle px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">Notifications</p>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={optimisticUnread === 0 && items.length === 0}
                            isLoading={markingAll}
                            onClick={markAllAsRead}
                        >
                            <CheckCheck className="mr-1 h-3.5 w-3.5" />
                            Mark all as read
                        </Button>
                    </div>

                    {listQuery.isLoading ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-fg">Loading…</p>
                    ) : listQuery.isError ? (
                        // Inline and retryable, not a toast: the panel is empty
                        // because a request failed, and saying so here is the
                        // only thing that distinguishes it from "all caught up".
                        <div role="alert" className="space-y-2 px-4 py-6 text-center">
                            <p className="text-sm text-foreground">We couldn&apos;t load your notifications.</p>
                            <Button
                                variant="outline"
                                size="sm"
                                isLoading={listQuery.isFetching}
                                onClick={() => void listQuery.refetch()}
                            >
                                Try again
                            </Button>
                        </div>
                    ) : items.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-fg">You&apos;re all caught up</p>
                    ) : (
                        <ul className="max-h-80 divide-y divide-edge-subtle overflow-y-auto">
                            {items.map((n) => (
                                <li key={resolveNotifId(n) || `${n.title}-${n.createdAt}`}>
                                    <button
                                        type="button"
                                        onClick={() => openItem(n)}
                                        className="ea-focus block w-full px-4 py-3 text-left hover:bg-surface-sunken"
                                    >
                                        <span className="block text-sm font-medium text-foreground">{n.title}</span>
                                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-fg">{n.message}</span>
                                        <span className="mt-1 block text-[11px] text-faint-fg">{formatRelativeTime(n.createdAt)}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="border-t border-edge-subtle px-4 py-2 text-center">
                        <Link
                            href="/notifications"
                            onClick={() => close(false)}
                            className="ea-focus text-sm font-semibold text-brand hover:underline"
                        >
                            View all
                        </Link>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
