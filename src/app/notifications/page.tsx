"use client";

import { useEffect, useState } from "react";
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

const TYPE_COLORS: Record<string, string> = {
    DEPRECATION:    "bg-orange-100 text-orange-700 border-orange-200",
    MAINTENANCE:    "bg-blue-100 text-blue-700 border-blue-200",
    APPROVAL:       "bg-purple-100 text-purple-700 border-purple-200",
    SYSTEM:         "bg-slate-100 text-slate-700 border-slate-200",
    TRANSFER:       "bg-cyan-100 text-cyan-700 border-cyan-200",
    DISPOSAL:       "bg-red-100 text-red-700 border-red-200",
    PURCHASE_ORDER: "bg-emerald-100 text-emerald-700 border-emerald-200",
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
        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${TYPE_COLORS[t] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
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

    if (loading) return <div className="flex p-10 justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <PageHeader
                title="Notifications"
                subtitle="Operational alerts, approvals, and compliance updates across your workspace."
                actions={<>
                    <Button variant="outline" onClick={markAllRead} isLoading={markingAllRead}><CheckCircle2 className="w-4 h-4 mr-2" /> Mark all read</Button>
                    <Button variant="secondary" onClick={deleteAll} isLoading={clearingAll}><Trash2 className="w-4 h-4 mr-2" /> Clear all</Button>
                </>}
            />

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-500">Unread</p>
                        <p className="text-xl font-bold">{summary?.unreadCount ?? notifications.filter(n => !n.read).length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-xl font-bold">{summary?.totalNotifications ?? notifications.length}</p>
                    </CardContent>
                </Card>
                {summary?.byType && Object.keys(summary.byType).length > 0 && (
                    <Card className="md:col-span-2">
                        <CardContent className="p-4">
                            <p className="text-xs text-slate-500 mb-2">By Type</p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(summary.byType).map(([type, count]) => (
                                    <span key={type} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[type] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                                        {TYPE_LABELS[type] ?? type}: {count}
                                    </span>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Notification list */}
                <div className="md:col-span-2 space-y-3">
                    {notifications.map(n => {
                        const nid = resolveNotifId(n);
                        return (
                            <Card key={nid || n.createdAt} className={n.read ? "opacity-70" : "border-l-4 border-l-blue-500"}>
                                <CardContent className="p-4 flex gap-4 items-start">
                                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full shrink-0">
                                        <Bell className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-sm">{n.title}</h3>
                                                <TypeBadge type={n.type} />
                                            </div>
                                            <span className="text-xs text-slate-400 shrink-0">
                                                {new Date(n.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                                        {n.read && n.readAt && (
                                            <p className="text-[10px] text-slate-400 mt-1">
                                                Read {new Date(n.readAt).toLocaleString()}
                                            </p>
                                        )}
                                        <div className="mt-2 flex gap-2 flex-wrap">
                                            {!n.read && (
                                                <Button variant="ghost" size="sm" onClick={() => markAsRead(nid)} isLoading={markingReadId === nid}>
                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark read
                                                </Button>
                                            )}
                                            {n.actionUrl && (
                                                <Button variant="outline" size="sm" asChild>
                                                    <a href={n.actionUrl}>View Item</a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => deleteNotif(nid)} isLoading={deletingNotifId === nid}>
                                        <Trash2 className="w-4 h-4 text-red-400 hover:text-red-500" />
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {!notifications.length && (
                        <div className="text-center p-12 text-muted-foreground border rounded-lg border-dashed">
                            No notifications found
                        </div>
                    )}
                </div>

                {/* Preferences panel */}
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Settings className="w-4 h-4" /> Delivery Preferences
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between items-center">
                                <span>In-App Notifications</span>
                                <input type="checkbox" checked={Boolean(preferences?.inAppNotifications)} onChange={(e) => updatePreference("inAppNotifications", e.target.checked)} />
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Push Notifications</span>
                                <input type="checkbox" checked={Boolean(preferences?.pushNotifications)} onChange={(e) => updatePreference("pushNotifications", e.target.checked)} />
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Daily Digest</span>
                                <input type="checkbox" checked={Boolean(preferences?.dailyDigest)} onChange={(e) => updatePreference("dailyDigest", e.target.checked)} />
                            </div>
                            {preferences?.dailyDigest && (
                                <div className="space-y-1">
                                    <Label className="text-xs">Digest Time</Label>
                                    <Input type="time" value={preferences?.digestTime || "09:00"} onChange={(e) => updatePreference("digestTime", e.target.value)} />
                                </div>
                            )}
                            <div className="pt-2 border-t space-y-2">
                                <p className="font-semibold text-xs text-slate-500 uppercase tracking-wide">Email by Category</p>
                                {NOTIFICATION_TYPES.map((t) => (
                                    <div key={t} className="flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full inline-block ${TYPE_COLORS[t]?.split(" ")[0] ?? "bg-slate-300"}`} />
                                            {TYPE_LABELS[t]}
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(preferences?.emailNotifications?.[t])}
                                            onChange={(e) => updateEmailPreference(t, e.target.checked)}
                                        />
                                    </div>
                                ))}
                            </div>
                            <Button onClick={savePreferences} disabled={savingPrefs} className="w-full">
                                {savingPrefs && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Save Preferences
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
