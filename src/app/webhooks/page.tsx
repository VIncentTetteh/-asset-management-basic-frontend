"use client";

import { useEffect, useState } from "react";
import { webhookService } from "@/services/webhookService";
import { Webhook, WebhookDelivery } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Webhook as WebhookIcon, Plus, CheckCircle, XCircle, Trash2, Activity, Clock, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { formatRelativeTime } from "@/lib/time";

const AVAILABLE_EVENTS = [
    "asset.created", "asset.updated", "asset.deleted",
    "asset.assigned", "asset.disposed", "asset.maintenance_due",
    "maintenance.created", "maintenance.completed",
    "purchase_order.created", "purchase_order.approved",
    "licence.expiring", "contract.expiring",
    "budget.exceeded", "user.created",
];

interface WebhookFormData {
    name: string;
    url: string;
    secret?: string;
}

export default function WebhooksPage() {
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [stats, setStats] = useState({ total: 0, active: 0 });
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
    const [eventsError, setEventsError] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectedWebhookForDeliveries, setSelectedWebhookForDeliveries] = useState<Webhook | null>(null);
    const [isDeliveriesModalOpen, setIsDeliveriesModalOpen] = useState(false);
    const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
    const [loadingDeliveries, setLoadingDeliveries] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<WebhookFormData>();

    useEffect(() => {
        fetchWebhooks();
    }, []);

    const fetchWebhooks = async () => {
        try {
            const data = await webhookService.list();
            setWebhooks(data.webhooks ?? []);
            setStats({ total: data.totalWebhooks ?? 0, active: data.activeWebhooks ?? 0 });
        } catch {
            toast.error("Failed to fetch webhooks");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        reset({ name: "", url: "", secret: "" });
        setSelectedEvents([]);
        setEventsError(false);
        setIsModalOpen(true);
    };

    const toggleEvent = (event: string) => {
        setSelectedEvents(prev =>
            prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
        );
        setEventsError(false);
    };

    const onSubmit = async (data: WebhookFormData) => {
        if (selectedEvents.length === 0) {
            setEventsError(true);
            return;
        }
        try {
            const payload: Partial<Webhook> = {
                name: data.name,
                url: data.url,
                events: selectedEvents,
                active: true,
                ...(data.secret ? { secret: data.secret } : {}),
            };
            await webhookService.create(payload);
            toast.success("Webhook created");
            setIsModalOpen(false);
            fetchWebhooks();
        } catch {
            toast.error("Failed to create webhook");
        }
    };

    const toggleWebhook = async (id: string, currentStatus: boolean) => {
        setTogglingId(id);
        try {
            await webhookService.update(id, { active: !currentStatus });
            toast.success(`Webhook ${!currentStatus ? "activated" : "deactivated"}`);
            fetchWebhooks();
        } catch {
            toast.error("Failed to update webhook");
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this webhook?")) return;
        setDeletingId(id);
        try {
            await webhookService.delete(id);
            toast.success("Webhook deleted");
            fetchWebhooks();
        } catch {
            toast.error("Failed to delete webhook");
        } finally {
            setDeletingId(null);
        }
    };

    const testWebhook = async (id: string) => {
        setTestingId(id);
        try {
            await webhookService.testWebhook(id);
            toast.success("Test payload sent successfully");
        } catch {
            toast.error("Test delivery failed");
        } finally {
            setTestingId(null);
        }
    };

    const fetchDeliveries = async (webhook: Webhook) => {
        setSelectedWebhookForDeliveries(webhook);
        setIsDeliveriesModalOpen(true);
        setSelectedDelivery(null);
        setLoadingDeliveries(true);
        try {
            const data = await webhookService.getDeliveries(webhook.id);
            setDeliveries(data.deliveries || []);
        } catch {
            toast.error("Failed to fetch deliveries");
        } finally {
            setLoadingDeliveries(false);
        }
    };

    const loadDeliveryDetail = async (webhookId: string, deliveryId: string) => {
        try {
            const detail = await webhookService.getDelivery(webhookId, deliveryId);
            setSelectedDelivery(detail);
        } catch {
            toast.error("Failed to fetch delivery detail");
        }
    };

    if (loading) return (
        <div className="flex p-10 justify-center">
            <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Webhooks</h1>
                    <p className="text-slate-500">Receive real-time HTTP notifications for events in your organisation.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" /> Add Webhook
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg"><WebhookIcon className="h-5 w-5 text-indigo-600" /></div>
                        <div>
                            <p className="text-xs text-slate-500">Total Webhooks</p>
                            <p className="text-xl font-bold text-slate-900">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
                        <div>
                            <p className="text-xs text-slate-500">Active</p>
                            <p className="text-xl font-bold text-slate-900">{stats.active}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200">
                <CardHeader className="pb-0">
                    <CardTitle className="text-base font-semibold text-slate-700">Configured Endpoints</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="text-left py-3 px-4 font-medium text-slate-600">Name & URL</th>
                                    <th className="text-left py-3 px-4 font-medium text-slate-600">Events</th>
                                    <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                    <th className="text-left py-3 px-4 font-medium text-slate-600">Deliveries</th>
                                    <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {webhooks.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="flex flex-col items-center justify-center p-12 text-center">
                                                <WebhookIcon className="h-12 w-12 text-slate-300 mb-4" />
                                                <h3 className="text-lg font-medium text-slate-900">No webhooks configured</h3>
                                                <p className="text-slate-500 mt-1">Add a webhook to receive real-time event notifications.</p>
                                                <Button onClick={handleOpenCreate} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                                                    <Plus className="w-4 h-4 mr-2" /> Add Webhook
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    webhooks.map((w) => (
                                        <tr key={w.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-slate-900">{w.name}</div>
                                                <div className="text-xs font-mono text-slate-400 truncate max-w-[220px]">{w.url || "—"}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex gap-1 flex-wrap max-w-[240px]">
                                                    {w.events.map(e => (
                                                        <span key={e} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono">{e}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                {w.active
                                                    ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" /> Active</span>
                                                    : <span className="flex items-center gap-1 text-slate-400 text-xs font-bold"><XCircle className="w-3.5 h-3.5" /> Inactive</span>
                                                }
                                            </td>
                                            <td className="py-3 px-4 text-xs text-slate-600">
                                                <span className="font-medium">{w.deliveryCount}</span> total
                                                <div className="text-slate-400">
                                                    Last: {w.lastTriggeredAt ? new Date(w.lastTriggeredAt).toLocaleString() : "Never"}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="outline" size="sm" onClick={() => fetchDeliveries(w)} className="h-7 px-2 text-xs">
                                                        <Activity className="w-3 h-3 mr-1" /> History
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => testWebhook(w.id)} isLoading={testingId === w.id} className="h-7 px-2 text-xs">Test</Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => toggleWebhook(w.id, w.active)}
                                                        isLoading={togglingId === w.id}
                                                        className={`h-7 px-2 text-xs ${w.active ? "text-amber-600 border-amber-200 hover:bg-amber-50" : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"}`}
                                                    >
                                                        {w.active ? "Disable" : "Enable"}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(w.id)} isLoading={deletingId === w.id} className="h-7 px-2 text-red-600 hover:bg-red-50">
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add Webhook"
                description="Configure an endpoint to receive event notifications."
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="wh-name">Name <span className="text-red-500">*</span></Label>
                        <Input
                            id="wh-name"
                            placeholder="e.g. Slack Alerts"
                            {...register("name", { required: "Name is required" })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="wh-url">Endpoint URL <span className="text-red-500">*</span></Label>
                        <Input
                            id="wh-url"
                            type="url"
                            placeholder="https://hooks.example.com/webhook"
                            {...register("url", { required: "URL is required" })}
                        />
                        {errors.url && <p className="text-sm text-red-500">{errors.url.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="wh-secret">
                            Secret <span className="text-xs text-slate-400">(optional — used for HMAC signature verification)</span>
                        </Label>
                        <Input
                            id="wh-secret"
                            type="password"
                            placeholder="my-webhook-secret"
                            {...register("secret")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Events <span className="text-red-500">*</span></Label>
                        <div className="grid grid-cols-2 gap-1.5 p-3 border border-slate-200 rounded-md bg-slate-50/50 max-h-48 overflow-y-auto">
                            {AVAILABLE_EVENTS.map(event => (
                                <label key={event} className="flex items-center gap-2 text-xs cursor-pointer text-slate-600 hover:text-slate-900 py-0.5">
                                    <input
                                        type="checkbox"
                                        checked={selectedEvents.includes(event)}
                                        onChange={() => toggleEvent(event)}
                                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                                    />
                                    <span className="font-mono">{event}</span>
                                </label>
                            ))}
                        </div>
                        {eventsError && <p className="text-sm text-red-500">Select at least one event.</p>}
                        {selectedEvents.length > 0 && (
                            <p className="text-xs text-slate-500">{selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""} selected</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                            Create Webhook
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Deliveries Modal */}
            <Modal
                isOpen={isDeliveriesModalOpen}
                onClose={() => setIsDeliveriesModalOpen(false)}
                title={`Delivery History: ${selectedWebhookForDeliveries?.name}`}
                description="List of recent webhook delivery attempts and their statuses."
            >
                <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
                    {loadingDeliveries ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
                        </div>
                    ) : deliveries.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No delivery attempts recorded yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {deliveries.map((d, i) => (
                                <button
                                    key={d.deliveryId || i}
                                    type="button"
                                    onClick={() => selectedWebhookForDeliveries && loadDeliveryDetail(selectedWebhookForDeliveries.id, d.deliveryId)}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${selectedDelivery?.deliveryId === d.deliveryId
                                        ? "border-indigo-300 bg-indigo-50/60"
                                        : "border-slate-100 hover:bg-slate-50"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-full ${d.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                            {d.status === 'SUCCESS' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{d.event}</p>
                                            <p className="text-[10px] text-slate-400 font-medium tracking-tight">{new Date(d.timestamp).toLocaleString()} • {formatRelativeTime(d.timestamp)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-xs font-mono font-bold ${d.statusCode >= 200 && d.statusCode < 300 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {d.statusCode}
                                        </div>
                                        <div className="text-[10px] text-slate-400">{d.responseTime}ms</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedDelivery && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-400">Selected Delivery</p>
                                <p className="font-semibold text-slate-900">{selectedDelivery.deliveryId}</p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 text-sm">
                                <div>
                                    <p className="text-slate-400">Status</p>
                                    <p className="text-slate-900">{selectedDelivery.status} ({selectedDelivery.statusCode})</p>
                                </div>
                                <div>
                                    <p className="text-slate-400">Delivered</p>
                                    <p className="text-slate-900">{selectedDelivery.deliveredAt ? new Date(selectedDelivery.deliveredAt).toLocaleString() : "—"}</p>
                                </div>
                            </div>
                            {selectedDelivery.responseBody && (
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Response Body</p>
                                    <pre className="max-h-40 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100 whitespace-pre-wrap">{selectedDelivery.responseBody}</pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex justify-end pt-4 border-t mt-4">
                    <Button variant="outline" onClick={() => setIsDeliveriesModalOpen(false)}>Close</Button>
                </div>
            </Modal>
        </div>
    );
}
