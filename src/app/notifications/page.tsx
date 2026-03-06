"use client";

import { useEffect, useState } from "react";
import { notificationService } from "@/services/notificationService";
import { Notification, NotificationPreferences, NotificationSummary } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, CheckCircle2, Trash2, Settings } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "react-hot-toast";

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [summary, setSummary] = useState<NotificationSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [filters, setFilters] = useState<{ type?: string; status?: "unread" | "read" | "all"; limit?: number }>({
        status: "unread",
        limit: 20,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async (nextFilters = filters) => {
        try {
            const [notifsData, prefsData, summaryData] = await Promise.all([
                notificationService.getNotifications(nextFilters),
                notificationService.getPreferences(),
                notificationService.getSummary()
            ]);
            setNotifications(notifsData.notifications);
            setPreferences(prefsData);
            setSummary(summaryData);
        } catch (e) {
            toast.error("Failed to load notifications");
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            await notificationService.markAsRead(id);
            fetchData(filters);
        } catch {
            toast.error("Action failed");
        }
    };

    const markAllRead = async () => {
        try {
            await notificationService.markAllAsRead();
            toast.success("All caught up!");
            fetchData(filters);
        } catch {
            toast.error("Action failed");
        }
    };

    const deleteNotif = async (id: string) => {
        try {
            await notificationService.deleteNotification(id);
            fetchData(filters);
        } catch {
            toast.error("Delete failed");
        }
    };

    const deleteAll = async () => {
        try {
            await notificationService.deleteAllNotifications();
            toast.success("All notifications deleted");
            fetchData(filters);
        } catch {
            toast.error("Delete all failed");
        }
    };

    const updatePreference = (key: keyof NotificationPreferences, value: unknown) => {
        setPreferences((prev) => prev ? { ...prev, [key]: value } : prev);
    };

    const updateEmailPreference = (key: string, value: boolean) => {
        setPreferences((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                emailNotifications: {
                    ...prev.emailNotifications,
                    [key]: value,
                },
            };
        });
    };

    const savePreferences = async () => {
        if (!preferences) return;
        try {
            setSavingPrefs(true);
            await notificationService.updatePreferences(preferences);
            toast.success("Preferences updated");
            fetchData(filters);
        } catch {
            toast.error("Failed to update preferences");
        } finally {
            setSavingPrefs(false);
        }
    };

    const applyFilters = () => {
        fetchData(filters);
    };

    if (loading) return <div className="flex p-10 justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <PageHeader
                title="Notifications"
                subtitle="Operational alerts, approvals, and compliance updates across your workspace."
                actions={<>
                    <Button variant="outline" onClick={markAllRead}><CheckCircle2 className="w-4 h-4 mr-2" /> Mark all read</Button>
                    <Button variant="secondary" onClick={deleteAll}><Trash2 className="w-4 h-4 mr-2" /> Clear all</Button>
                </>}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Unread</p><p className="text-xl font-bold">{summary?.unreadCount ?? notifications.filter(n => !n.read).length}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total</p><p className="text-xl font-bold">{summary?.totalNotifications ?? notifications.length}</p></CardContent></Card>
                <Card className="md:col-span-2">
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                        <div className="space-y-1">
                            <Label className="text-xs">Type</Label>
                            <Input value={filters.type || ""} placeholder="maintenance, approval..." onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value || undefined }))} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Status</Label>
                            <Select value={filters.status || "all"} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as "unread" | "read" | "all" }))}>
                                <option value="all">All</option>
                                <option value="unread">Unread</option>
                                <option value="read">Read</option>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Limit</Label>
                            <Select value={String(filters.limit || 20)} onChange={(e) => setFilters((prev) => ({ ...prev, limit: Number(e.target.value) }))}>
                                <option value="20">20</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </Select>
                        </div>
                        <Button onClick={applyFilters}>Apply</Button>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    {notifications.map(n => (
                        <Card key={n.notificationId} className={n.read ? "opacity-75" : "border-l-4 border-l-blue-500"}>
                            <CardContent className="p-4 flex gap-4 items-start">
                                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
                                    <Bell className="w-5 h-5 text-slate-500" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <h3 className="font-bold text-sm">{n.title}</h3>
                                        <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
                                    <div className="mt-3 space-x-2">
                                        {!n.read && <Button variant="ghost" size="sm" onClick={() => markAsRead(n.notificationId)}>Mark read</Button>}
                                        {n.actionUrl && <Button variant="outline" size="sm" asChild><a href={n.actionUrl}>View Item</a></Button>}
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => deleteNotif(n.notificationId)}>
                                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-500" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                    {!notifications.length && (
                        <div className="text-center p-12 text-muted-foreground border rounded-lg border-dashed">
                            No new notifications
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2"><Settings className="w-4 h-4" /> Delivery Preferences</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="flex justify-between">
                                    <span>In-App Notifications</span>
                                    <input type="checkbox" checked={Boolean(preferences?.inAppNotifications)} onChange={(e) => updatePreference("inAppNotifications", e.target.checked)} />
                                </div>
                                <div className="flex justify-between">
                                    <span>Push Notifications</span>
                                    <input type="checkbox" checked={Boolean(preferences?.pushNotifications)} onChange={(e) => updatePreference("pushNotifications", e.target.checked)} />
                                </div>
                                <div className="flex justify-between">
                                    <span>Daily Digest</span>
                                    <input type="checkbox" checked={Boolean(preferences?.dailyDigest)} onChange={(e) => updatePreference("dailyDigest", e.target.checked)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Digest Time</Label>
                                    <Input type="time" value={preferences?.digestTime || "09:00"} onChange={(e) => updatePreference("digestTime", e.target.value)} />
                                </div>
                                <div className="pt-2 border-t space-y-2">
                                    <p className="font-semibold text-xs text-slate-600 uppercase">Email Categories</p>
                                    {Object.entries(preferences?.emailNotifications || {}).map(([k, v]) => (
                                        <div key={k} className="flex items-center justify-between">
                                            <span className="capitalize">{k}</span>
                                            <input type="checkbox" checked={Boolean(v)} onChange={(e) => updateEmailPreference(k, e.target.checked)} />
                                        </div>
                                    ))}
                                </div>
                                <Button onClick={savePreferences} disabled={savingPrefs} className="w-full">
                                    {savingPrefs ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Save Preferences
                                </Button>
                            </CardContent>
                        </Card>
                </div>
            </div>
        </div>
    );
}
