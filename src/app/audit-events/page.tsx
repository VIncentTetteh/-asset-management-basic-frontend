"use client";

import { useEffect, useMemo, useState } from "react";
import { AuditEvent, AuditEventFilterParams } from "@/types";
import { auditEventService } from "@/services/auditEventService";
import { userService } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "react-hot-toast";
import { Activity, Filter, RotateCw, ShieldCheck } from "lucide-react";

const methodOptions = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const formatRelativeTime = (dateString: string) => {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diffInSeconds < 60) return "Just now";
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 172800) return "Yesterday";
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        return date.toLocaleDateString();
    } catch { return "N/A"; }
};

const getFriendlyAuditAction = (event: AuditEvent) => {
    const { path, method, handler } = event;
    const p = path.toLowerCase();
    
    if (p.includes("/auth/login")) return "User Login";
    if (p.includes("/auth/logout")) return "User Logout";
    
    if (p.includes("/users")) {
        if (method === "GET") return handler?.includes("list") ? "Viewed User List" : "Viewed User Details";
        if (method === "POST") return "Created User";
        if (method === "PATCH" || method === "PUT") return "Updated User";
        if (method === "DELETE") return "Deleted User";
    }
    
    if (p.includes("/assets")) {
        if (p.includes("/history")) return "Viewed Asset History";
        if (p.includes("/qrcode")) return "Generated Asset QR Code";
        if (method === "GET") return handler?.includes("list") ? "Viewed Asset Registry" : "Viewed Asset Details";
        if (method === "POST") return "Registered New Asset";
        if (method === "PATCH" || method === "PUT") return "Updated Asset";
        if (method === "DELETE") return "Deleted Asset";
    }

    if (p.includes("/cloud-assets")) {
        if (p.includes("/cost-summary")) return "Viewed Cloud Cost Summary";
        if (method === "GET") return "Viewed Cloud Inventory";
        if (method === "POST") return "Added Cloud Resource";
    }

    if (p.includes("/billing")) return "Checked Billing/Subscription";
    if (p.includes("/categories")) return "Managed Asset Categories";
    if (p.includes("/departments")) return "Managed Departments";
    if (p.includes("/locations")) return "Managed Site Locations";
    if (p.includes("/reports")) return "Generated System Report";
    if (p.includes("/audit-events")) return "Viewed Audit Logs";

    return handler?.split(".").pop()?.replace(/([A-Z])/g, " $1").trim() || `${method} ${path}`;
};

export default function AuditEventsPage() {
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
    const [filters, setFilters] = useState<AuditEventFilterParams>({});
    const [actors, setActors] = useState<{ id: string; label: string }[]>([]);

    const fetchEvents = async (params?: AuditEventFilterParams) => {
        try {
            setIsLoading(true);
            const data = await auditEventService.getAll(params);
            setEvents(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        } catch (error) {
            toast.error("Failed to load audit events");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        const fetchActors = async () => {
            try {
                const users = await userService.getAll();
                setActors(users.map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName} (${u.email})` })));
            } catch {
                // Actor lookup is optional for this page.
            }
        };
        fetchActors();
    }, []);

    const successRate = useMemo(() => {
        if (events.length === 0) return 0;
        const successCount = events.filter((event) => event.success).length;
        return Math.round((successCount / events.length) * 100);
    }, [events]);

    const onApplyFilters = () => {
        const normalized: AuditEventFilterParams = {
            ...filters,
            start: filters.start ? new Date(filters.start).toISOString() : undefined,
            end: filters.end ? new Date(filters.end).toISOString() : undefined,
        };
        fetchEvents(normalized);
    };

    const onResetFilters = () => {
        setFilters({});
        fetchEvents();
    };

    const openDetails = async (id: string) => {
        try {
            const item = await auditEventService.get(id);
            setSelectedEvent(item);
        } catch (error) {
            toast.error("Failed to load event details");
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Audit Events"
                subtitle="Compliance-grade API event stream with actor and request tracing."
                actions={<>
                    <div className="rounded-control border border-ok/40 bg-ok-soft px-3 py-2 text-sm text-ok">
                        Success Rate: <span className="font-semibold">{successRate}%</span>
                    </div>
                    <Button variant="outline" onClick={() => fetchEvents(filters)} className="gap-2">
                        <RotateCw className="h-4 w-4" /> Refresh
                    </Button>
                </>}
            />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Filter className="h-4 w-4 text-faint-fg" /> Filter Events
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-5">
                    <div className="space-y-2">
                        <Label>Actor</Label>
                        <Select value={filters.actorId || ""} onChange={(e) => setFilters((prev) => ({ ...prev, actorId: e.target.value || undefined }))}>
                            <option value="">All Actors</option>
                            {actors.map((actor) => (
                                <option key={actor.id} value={actor.id}>{actor.label}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Method</Label>
                        <Select value={filters.method || ""} onChange={(e) => setFilters((prev) => ({ ...prev, method: e.target.value || undefined }))}>
                            <option value="">All Methods</option>
                            {methodOptions.map((method) => (
                                <option key={method} value={method}>{method}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Success</Label>
                        <Select
                            value={filters.success === undefined ? "" : String(filters.success)}
                            onChange={(e) => setFilters((prev) => ({ ...prev, success: e.target.value === "" ? undefined : e.target.value === "true" }))}
                        >
                            <option value="">All</option>
                            <option value="true">Successful</option>
                            <option value="false">Failed</option>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Start (UTC)</Label>
                        <Input type="datetime-local" value={filters.start || ""} onChange={(e) => setFilters((prev) => ({ ...prev, start: e.target.value || undefined }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>End (UTC)</Label>
                        <Input type="datetime-local" value={filters.end || ""} onChange={(e) => setFilters((prev) => ({ ...prev, end: e.target.value || undefined }))} />
                    </div>
                    <div className="flex justify-end gap-2 md:col-span-5">
                        <Button variant="outline" onClick={onResetFilters}>Reset</Button>
                        <Button onClick={onApplyFilters}>Apply Filters</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="h-4 w-4 text-faint-fg" /> Event Timeline
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex h-40 items-center justify-center text-muted-fg">Loading events...</div>
                    ) : events.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center px-6 text-center">
                            <ShieldCheck className="mb-2 h-8 w-8 text-faint-fg" />
                            <p className="font-medium text-foreground">No events match your filter</p>
                            <p className="text-sm text-muted-fg">Try broadening your criteria.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-y border-edge-subtle bg-surface-muted">
                                    <tr className="text-left font-medium text-muted-fg">
                                        <th className="p-3">Event</th>
                                        <th className="p-3">Actor</th>
                                        <th className="p-3">Time</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.map((event) => (
                                        <tr key={event.id} className="group cursor-pointer border-b border-edge-subtle transition-colors hover:bg-surface-muted/60" onClick={() => openDetails(event.id)}>
                                            <td className="p-3">
                                                <div className="font-semibold text-foreground">{getFriendlyAuditAction(event)}</div>
                                                <div className="data-mono mt-0.5 text-[10px] text-faint-fg">{event.method} {event.path}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="text-muted-fg">{event.actorEmail || "System"}</div>
                                                <div className="text-[10px] text-faint-fg">{event.clientIp || "Internal"}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="whitespace-nowrap text-muted-fg">{formatRelativeTime(event.createdAt)}</div>
                                                <div className="text-[10px] text-faint-fg">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="p-3">
                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${event.success ? "border-ok/30 bg-ok-soft text-ok" : "border-danger/30 bg-danger-soft text-danger"}`}>
                                                    {event.responseStatus}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <Button variant="ghost" size="sm" className="opacity-0 transition-opacity group-hover:opacity-100">
                                                    Details
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal
                isOpen={Boolean(selectedEvent)}
                onClose={() => setSelectedEvent(null)}
                title="Audit Event Detail"
                description="Full event payload for incident triage and compliance."
            >
                {selectedEvent && (
                    <div className="space-y-4">
                        <div className="rounded-panel border border-slate-800 bg-slate-900 p-4 text-white shadow-sm">
                            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Activity</div>
                            <div className="text-lg font-bold">{getFriendlyAuditAction(selectedEvent)}</div>
                            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                                <span className={selectedEvent.success ? "text-emerald-400" : "text-red-400"}>
                                    Status: {selectedEvent.responseStatus}
                                </span>
                                <span>•</span>
                                <span>{new Date(selectedEvent.createdAt).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <span className="text-xs font-medium uppercase text-faint-fg">Actor Info</span>
                                <p className="font-medium text-foreground">{selectedEvent.actorEmail || "System"}</p>
                                <p className="text-xs text-faint-fg">IP: {selectedEvent.clientIp || "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium uppercase text-faint-fg">Technical Context</span>
                                <p className="font-medium text-foreground">{selectedEvent.handler || "N/A"}</p>
                                <p className="text-xs text-faint-fg">Method: {selectedEvent.method}</p>
                            </div>
                        </div>

                        <div className="space-y-2 border-t border-edge-subtle pt-2">
                            <Label className="text-xs font-medium uppercase text-faint-fg">API Path</Label>
                            <div className="data-mono break-all rounded-card border border-edge-subtle bg-surface-muted p-2 text-[10px] text-muted-fg">
                                {selectedEvent.path}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-edge-subtle pt-2">
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-faint-fg">Request ID</span>
                                <p className="data-mono break-all text-[10px] text-faint-fg">{selectedEvent.requestId || "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-faint-fg">Event ID</span>
                                <p className="data-mono break-all text-[10px] text-faint-fg">{selectedEvent.id}</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button variant="outline" onClick={() => setSelectedEvent(null)} className="w-full sm:w-auto">Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
