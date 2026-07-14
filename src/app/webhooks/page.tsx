"use client";

import { useEffect, useState } from "react";
import { webhookService } from "@/services/webhookService";
import { Webhook, WebhookDelivery } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2, Webhook as WebhookIcon, Plus, CheckCircle, XCircle, Trash2, Activity, Clock, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { formatRelativeTime } from "@/lib/time";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";

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
    const { confirm, ConfirmDialog } = useConfirm();

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
        if (!await confirm({ message: "Delete this webhook?", variant: "danger" })) return;
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
        <div className="flex justify-center p-10">
            <Loader2 className="h-8 w-8 animate-spin text-faint-fg" />
        </div>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Webhooks"
                subtitle="Receive real-time HTTP notifications for events in your organisation."
                actions={
                    <Button onClick={handleOpenCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Add Webhook
                    </Button>
                }
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-control bg-brand-soft p-2"><WebhookIcon className="h-5 w-5 text-brand" /></div>
                        <div>
                            <p className="text-xs text-faint-fg">Total Webhooks</p>
                            <p className="data-mono text-xl font-bold text-foreground">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-control bg-ok-soft p-2"><CheckCircle className="h-5 w-5 text-ok" /></div>
                        <div>
                            <p className="text-xs text-faint-fg">Active</p>
                            <p className="data-mono text-xl font-bold text-foreground">{stats.active}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-0">
                    <CardTitle className="text-base font-semibold text-foreground">Configured Endpoints</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-edge-subtle bg-surface-muted/50">
                                    <th className="px-4 py-3 text-left font-medium text-muted-fg">Name & URL</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-fg">Events</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-fg">Status</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-fg">Deliveries</th>
                                    <th className="px-4 py-3 text-right font-medium text-muted-fg">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {webhooks.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="flex flex-col items-center justify-center p-12 text-center">
                                                <WebhookIcon className="mb-4 h-12 w-12 text-faint-fg" />
                                                <h3 className="text-lg font-medium text-foreground">No webhooks configured</h3>
                                                <p className="mt-1 text-muted-fg">Add a webhook to receive real-time event notifications.</p>
                                                <Button onClick={handleOpenCreate} className="mt-4">
                                                    <Plus className="mr-2 h-4 w-4" /> Add Webhook
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    webhooks.map((w) => (
                                        <tr key={w.id} className="border-b border-edge-subtle transition-colors hover:bg-surface-muted/50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-foreground">{w.name}</div>
                                                <div className="data-mono max-w-[220px] truncate text-xs text-faint-fg">{w.url || "—"}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex max-w-[240px] flex-wrap gap-1">
                                                    {w.events.map(e => (
                                                        <span key={e} className="data-mono rounded bg-surface-muted px-2 py-0.5 text-xs text-muted-fg">{e}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {w.active
                                                    ? <span className="flex items-center gap-1 text-xs font-bold text-ok"><CheckCircle className="h-3.5 w-3.5" /> Active</span>
                                                    : <span className="flex items-center gap-1 text-xs font-bold text-faint-fg"><XCircle className="h-3.5 w-3.5" /> Inactive</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-fg">
                                                <span className="font-medium">{w.deliveryCount}</span> total
                                                <div className="text-faint-fg">
                                                    Last: {w.lastTriggeredAt ? new Date(w.lastTriggeredAt).toLocaleString() : "Never"}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="outline" size="sm" onClick={() => fetchDeliveries(w)} className="h-7 px-2 text-xs">
                                                        <Activity className="mr-1 h-3 w-3" /> History
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => testWebhook(w.id)} isLoading={testingId === w.id} className="h-7 px-2 text-xs">Test</Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => toggleWebhook(w.id, w.active)}
                                                        isLoading={togglingId === w.id}
                                                        className={cn("h-7 px-2 text-xs", w.active ? "border-warn/40 text-warn hover:bg-warn-soft" : "border-ok/40 text-ok hover:bg-ok-soft")}
                                                    >
                                                        {w.active ? "Disable" : "Enable"}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(w.id)} isLoading={deletingId === w.id} className="h-7 px-2 text-danger hover:bg-danger-soft">
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
                <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="wh-name">Name <span className="text-danger">*</span></Label>
                        <Input
                            id="wh-name"
                            placeholder="e.g. Slack Alerts"
                            {...register("name", { required: "Name is required" })}
                        />
                        {errors.name && <p className="text-sm text-danger">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="wh-url">Endpoint URL <span className="text-danger">*</span></Label>
                        <Input
                            id="wh-url"
                            type="url"
                            placeholder="https://hooks.example.com/webhook"
                            {...register("url", { required: "URL is required" })}
                        />
                        {errors.url && <p className="text-sm text-danger">{errors.url.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="wh-secret">
                            Secret <span className="text-xs text-faint-fg">(optional — used for HMAC signature verification)</span>
                        </Label>
                        <Input
                            id="wh-secret"
                            type="password"
                            placeholder="my-webhook-secret"
                            {...register("secret")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Events <span className="text-danger">*</span></Label>
                        <div className="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto rounded-control border border-edge-subtle bg-surface-muted/50 p-3">
                            {AVAILABLE_EVENTS.map(event => (
                                <label key={event} className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-muted-fg hover:text-foreground">
                                    <input
                                        type="checkbox"
                                        checked={selectedEvents.includes(event)}
                                        onChange={() => toggleEvent(event)}
                                        className="h-3.5 w-3.5 rounded border-edge accent-[var(--primary)]"
                                    />
                                    <span className="data-mono">{event}</span>
                                </label>
                            ))}
                        </div>
                        {eventsError && <p className="text-sm text-danger">Select at least one event.</p>}
                        {selectedEvents.length > 0 && (
                            <p className="text-xs text-faint-fg">{selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""} selected</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting}>
                            Create Webhook
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isDeliveriesModalOpen}
                onClose={() => setIsDeliveriesModalOpen(false)}
                title={`Delivery History: ${selectedWebhookForDeliveries?.name}`}
                description="List of recent webhook delivery attempts and their statuses."
            >
                <div className="max-h-[60vh] space-y-4 overflow-y-auto px-1">
                    {loadingDeliveries ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-faint-fg" />
                        </div>
                    ) : deliveries.length === 0 ? (
                        <div className="py-10 text-center text-faint-fg">
                            <Clock className="mx-auto mb-2 h-10 w-10 opacity-20" />
                            <p className="text-sm">No delivery attempts recorded yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {deliveries.map((d, i) => (
                                <button
                                    key={d.deliveryId || i}
                                    type="button"
                                    onClick={() => selectedWebhookForDeliveries && loadDeliveryDetail(selectedWebhookForDeliveries.id, d.deliveryId)}
                                    className={cn(
                                        "flex w-full items-center justify-between rounded-card border p-3 transition-colors",
                                        selectedDelivery?.deliveryId === d.deliveryId
                                            ? "border-brand/40 bg-brand-soft"
                                            : "border-edge-subtle hover:bg-surface-muted",
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn("rounded-full p-1.5", d.status === "SUCCESS" ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
                                            {d.status === "SUCCESS" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{d.event}</p>
                                            <p className="text-[10px] font-medium tracking-tight text-faint-fg">{new Date(d.timestamp).toLocaleString()} • {formatRelativeTime(d.timestamp)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn("data-mono text-xs font-bold", d.statusCode >= 200 && d.statusCode < 300 ? "text-ok" : "text-danger")}>
                                            {d.statusCode}
                                        </div>
                                        <div className="text-[10px] text-faint-fg">{d.responseTime}ms</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedDelivery && (
                        <div className="space-y-3 rounded-panel border border-edge-subtle bg-surface-muted p-4">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-faint-fg">Selected Delivery</p>
                                <p className="data-mono font-semibold text-foreground">{selectedDelivery.deliveryId}</p>
                            </div>
                            <div className="grid gap-3 text-sm md:grid-cols-2">
                                <div>
                                    <p className="text-faint-fg">Status</p>
                                    <p className="text-foreground">{selectedDelivery.status} ({selectedDelivery.statusCode})</p>
                                </div>
                                <div>
                                    <p className="text-faint-fg">Delivered</p>
                                    <p className="text-foreground">{selectedDelivery.deliveredAt ? new Date(selectedDelivery.deliveredAt).toLocaleString() : "—"}</p>
                                </div>
                            </div>
                            {selectedDelivery.responseBody && (
                                <div>
                                    <p className="mb-1 text-xs uppercase tracking-wide text-faint-fg">Response Body</p>
                                    <pre className="data-mono max-h-40 overflow-auto whitespace-pre-wrap rounded-card bg-slate-900 p-3 text-xs text-slate-100">{selectedDelivery.responseBody}</pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="mt-4 flex justify-end border-t border-edge-subtle pt-4">
                    <Button variant="outline" onClick={() => setIsDeliveriesModalOpen(false)}>Close</Button>
                </div>
                {ConfirmDialog}
            </Modal>
        </div>
    );
}
