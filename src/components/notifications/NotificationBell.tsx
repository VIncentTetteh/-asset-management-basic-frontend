"use client";

import { safeInternalPath } from "@/lib/safe-url";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "react-hot-toast";
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
        onError: () => toast.error("Couldn't mark notifications as read"),
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
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => (open ? close(false) : setOpen(true))}
                className="relative"
            >
                <Bell className="h-4 w-4" />
                {unread > 0 ? (
                    <span
                        data-testid="notification-badge"
                        className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white"
                    >
                        {unread > BADGE_MAX ? `${BADGE_MAX}+` : unread}
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
                            disabled={unread === 0 && items.length === 0}
                            isLoading={markAll.isPending}
                            onClick={() => markAll.mutate()}
                        >
                            <CheckCheck className="mr-1 h-3.5 w-3.5" />
                            Mark all as read
                        </Button>
                    </div>

                    {listQuery.isLoading ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-fg">Loading…</p>
                    ) : listQuery.isError ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-fg">Couldn&apos;t load notifications.</p>
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
