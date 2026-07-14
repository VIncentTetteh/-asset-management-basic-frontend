"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notificationService, resolveNotifId } from "@/services/notificationService";
import { Notification, NotificationPreferences, NotificationSummary, NOTIFICATION_TYPES } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, CheckCircle2, Trash2, Settings } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
    DEPRECATION:    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
    MAINTENANCE:    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    APPROVAL:       "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
    SYSTEM:         "bg-surface-muted text-muted-fg border-edge-subtle",
    TRANSFER:       "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30",
    DISPOSAL:       "bg-danger-soft text-danger border-danger/30",
    PURCHASE_ORDER: "bg-ok-soft text-ok border-ok/30",
};

const TYPE_LABELS: Record<string, string> = {
    DEPRECATION:    "Deprecation",
    MAINTENANCE:    "Maintenance",
    APPROVAL:       "Approval",
    SYSTEM:         "System",
    TRANSFER:       "Transfer",
    DISPOSAL:       "Disposal",
    PURCHASE_ORDER: "Purchase Order",
};

function TypeBadge({ type }: { type: string }) {
    const t = type.toUpperCase();
    return (
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", TYPE_COLORS[t] ?? "border-edge-subtle bg-surface-muted text-muted-fg")}>
            {TYPE_LABELS[t] ?? type}
        </span>
    );
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [summary, setSummary] = useState<NotificationSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const [clearingAll, setClearingAll] = useState(false);
    const [markingReadId, setMarkingReadId] = useState<string | null>(null);
    const [deletingNotifId, setDeletingNotifId] = useState<string | null>(null);
    const [filters, setFilters] = useState<{ type?: string; status?: "unread" | "read" | "all"; limit?: number }>({
        status: "all",
        limit: 20,
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async (nextFilters = filters) => {
        try {
            const [notifsResult, prefsResult, summaryResult] = await Promise.allSettled([
                notificationService.getNotifications(nextFilters),
                notificationService.getPreferences(),
                notificationService.getSummary(),
            ]);
            if (notifsResult.status === "fulfilled") {
                setNotifications(notifsResult.value.notifications ?? []);
            } else {
                toast.error("Failed to load notifications");
            }
            if (prefsResult.status === "fulfilled") setPreferences(prefsResult.value);
            if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: string) => {
        setMarkingReadId(id);
        try {
            await notificationService.markAsRead(id);
            fetchData(filters);
        } catch {
            toast.error("Action failed");
        } finally {
            setMarkingReadId(null);
        }
    };

    const markAllRead = async () => {
        setMarkingAllRead(true);
        try {
            await notificationService.markAllAsRead();
            toast.success("All caught up!");
            fetchData(filters);
        } catch {
            toast.error("Action failed");
        } finally {
            setMarkingAllRead(false);
        }
    };

    const deleteNotif = async (id: string) => {
        setDeletingNotifId(id);
        try {
            await notificationService.deleteNotification(id);
            fetchData(filters);
        } catch {
            toast.error("Delete failed");
        } finally {
            setDeletingNotifId(null);
        }
    };

    const deleteAll = async () => {
        setClearingAll(true);
        try {
            await notificationService.deleteAllNotifications();
            toast.success("All notifications deleted");
            fetchData(filters);
        } catch {
            toast.error("Delete all failed");
        } finally {
            setClearingAll(false);
        }
    };

    const updatePreference = (key: keyof NotificationPreferences, value: unknown) => {
        setPreferences((prev) => prev ? { ...prev, [key]: value } : prev);
    };

    const updateEmailPreference = (key: string, value: boolean) => {
        setPreferences((prev) => {
            if (!prev) return prev;
            return { ...prev, emailNotifications: { ...prev.emailNotifications, [key]: value } };
        });
    };

    const savePreferences = async () => {
        if (!preferences) return;
        try {
            setSavingPrefs(true);
            await notificationService.updatePreferences(preferences);
            toast.success("Preferences updated");
        } catch {
            toast.error("Failed to update preferences");
        } finally {
            setSavingPrefs(false);
        }
    };

    const applyFilters = () => fetchData(filters);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-faint-fg" /></div>;

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-6">
            <PageHeader
                title="Notifications"
                subtitle="Operational alerts, approvals, and compliance updates across your workspace."
                actions={<>
                    <Button variant="outline" onClick={markAllRead} isLoading={markingAllRead}><CheckCircle2 className="mr-2 h-4 w-4" /> Mark all read</Button>
                    <Button variant="secondary" onClick={deleteAll} isLoading={clearingAll}><Trash2 className="mr-2 h-4 w-4" /> Clear all</Button>
                </>}
            />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-faint-fg">Unread</p>
                        <p className="data-mono text-xl font-bold text-foreground">{summary?.unreadCount ?? notifications.filter(n => !n.read).length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-faint-fg">Total</p>
                        <p className="data-mono text-xl font-bold text-foreground">{summary?.totalNotifications ?? notifications.length}</p>
                    </CardContent>
                </Card>
                {summary?.byType && Object.keys(summary.byType).length > 0 && (
                    <Card className="md:col-span-2">
                        <CardContent className="p-4">
                            <p className="mb-2 text-xs text-faint-fg">By Type</p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(summary.byType).map(([type, count]) => (
                                    <span key={type} className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", TYPE_COLORS[type] ?? "border-edge-subtle bg-surface-muted text-muted-fg")}>
                                        {TYPE_LABELS[type] ?? type}: {count}
                                    </span>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Card>
                <CardContent className="grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-4">
                    <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                            value={filters.type || ""}
                            onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value || undefined }))}
                        >
                            <option value="">All types</option>
                            {NOTIFICATION_TYPES.map((t) => (
                                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select
                            value={filters.status || "all"}
                            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as "unread" | "read" | "all" }))}
                        >
                            <option value="all">All</option>
                            <option value="unread">Unread</option>
                            <option value="read">Read</option>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Limit</Label>
                        <Select
                            value={String(filters.limit || 20)}
                            onChange={(e) => setFilters((prev) => ({ ...prev, limit: Number(e.target.value) }))}
                        >
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </Select>
                    </div>
                    <Button onClick={applyFilters}>Apply</Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-3 md:col-span-2">
                    {notifications.map(n => {
                        const nid = resolveNotifId(n);
                        return (
                            <Card key={nid || n.createdAt} className={n.read ? "opacity-70" : "border-l-4 border-l-brand"}>
                                <CardContent className="flex items-start gap-4 p-4">
                                    <div className="shrink-0 rounded-full bg-surface-muted p-2">
                                        <Bell className="h-4 w-4 text-faint-fg" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-sm font-bold text-foreground">{n.title}</h3>
                                                <TypeBadge type={n.type} />
                                            </div>
                                            <span className="shrink-0 text-xs text-faint-fg">
                                                {new Date(n.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-fg">{n.message}</p>
                                        {n.read && n.readAt && (
                                            <p className="mt-1 text-[10px] text-faint-fg">
                                                Read {new Date(n.readAt).toLocaleString()}
                                            </p>
                                        )}
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {!n.read && (
                                                <Button variant="ghost" size="sm" onClick={() => markAsRead(nid)} isLoading={markingReadId === nid}>
                                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark read
                                                </Button>
                                            )}
                                            {n.actionUrl && (
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={n.actionUrl}>View Item</Link>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => deleteNotif(nid)} isLoading={deletingNotifId === nid}>
                                        <Trash2 className="h-4 w-4 text-danger" />
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {!notifications.length && (
                        <div className="rounded-card border border-dashed border-edge-subtle p-12 text-center text-muted-fg">
                            No notifications found
                        </div>
                    )}
                </div>

                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Settings className="h-4 w-4 text-faint-fg" /> Delivery Preferences
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-fg">In-App Notifications</span>
                                <input type="checkbox" checked={Boolean(preferences?.inAppNotifications)} onChange={(e) => updatePreference("inAppNotifications", e.target.checked)} className="accent-[var(--primary)]" />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-fg">Push Notifications</span>
                                <input type="checkbox" checked={Boolean(preferences?.pushNotifications)} onChange={(e) => updatePreference("pushNotifications", e.target.checked)} className="accent-[var(--primary)]" />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-fg">Daily Digest</span>
                                <input type="checkbox" checked={Boolean(preferences?.dailyDigest)} onChange={(e) => updatePreference("dailyDigest", e.target.checked)} className="accent-[var(--primary)]" />
                            </div>
                            {preferences?.dailyDigest && (
                                <div className="space-y-1">
                                    <Label className="text-xs">Digest Time</Label>
                                    <Input type="time" value={preferences?.digestTime || "09:00"} onChange={(e) => updatePreference("digestTime", e.target.value)} />
                                </div>
                            )}
                            <div className="space-y-2 border-t border-edge-subtle pt-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-faint-fg">Email by Category</p>
                                {NOTIFICATION_TYPES.map((t) => (
                                    <div key={t} className="flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-muted-fg">
                                            <span className={cn("inline-block h-2 w-2 rounded-full", TYPE_COLORS[t]?.split(" ")[0] ?? "bg-faint-fg")} />
                                            {TYPE_LABELS[t]}
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(preferences?.emailNotifications?.[t])}
                                            onChange={(e) => updateEmailPreference(t, e.target.checked)}
                                            className="accent-[var(--primary)]"
                                        />
                                    </div>
                                ))}
                            </div>
                            <Button onClick={savePreferences} disabled={savingPrefs} isLoading={savingPrefs} className="w-full">
                                Save Preferences
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
