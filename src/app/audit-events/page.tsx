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
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        Success Rate: <span className="font-semibold">{successRate}%</span>
                    </div>
                    <Button variant="outline" onClick={() => fetchEvents(filters)} className="gap-2">
                        <RotateCw className="h-4 w-4" /> Refresh
                    </Button>
                </>}
            />

            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-500" /> Filter Events
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
                    <div className="md:col-span-5 flex justify-end gap-2">
                        <Button variant="outline" onClick={onResetFilters}>Reset</Button>
                        <Button onClick={onApplyFilters} className="bg-slate-900 hover:bg-black">Apply Filters</Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4 text-slate-500" /> Event Timeline
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="h-40 flex items-center justify-center text-slate-500">Loading events...</div>
                    ) : events.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center px-6">
                            <ShieldCheck className="h-8 w-8 text-slate-300 mb-2" />
                            <p className="font-medium text-slate-900">No events match your filter</p>
                            <p className="text-sm text-slate-500">Try broadening your criteria.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-y border-slate-200">
                                    <tr className="text-left text-slate-600 font-medium">
                                        <th className="p-3">Event</th>
                                        <th className="p-3">Actor</th>
                                        <th className="p-3">Time</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.map((event) => (
                                        <tr key={event.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer group" onClick={() => openDetails(event.id)}>
                                            <td className="p-3">
                                                <div className="font-semibold text-slate-900">{getFriendlyAuditAction(event)}</div>
                                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">{event.method} {event.path}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="text-slate-700">{event.actorEmail || "System"}</div>
                                                <div className="text-[10px] text-slate-400">{event.clientIp || "Internal"}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="text-slate-600 whitespace-nowrap">{formatRelativeTime(event.createdAt)}</div>
                                                <div className="text-[10px] text-slate-400">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="p-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${event.success ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"}`}>
                                                    {event.responseStatus}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800">
                            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Activity</div>
                            <div className="text-lg font-bold">{getFriendlyAuditAction(selectedEvent)}</div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                <span className={selectedEvent.success ? "text-emerald-400" : "text-red-400"}>
                                    Status: {selectedEvent.responseStatus}
                                </span>
                                <span>•</span>
                                <span>{new Date(selectedEvent.createdAt).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-slate-500 uppercase">Actor Info</span>
                                <p className="text-slate-900 font-medium">{selectedEvent.actorEmail || "System"}</p>
                                <p className="text-xs text-slate-500">IP: {selectedEvent.clientIp || "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-slate-500 uppercase">Technical Context</span>
                                <p className="text-slate-900 font-medium">{selectedEvent.handler || "N/A"}</p>
                                <p className="text-xs text-slate-500">Method: {selectedEvent.method}</p>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-100">
                            <Label className="text-xs font-medium text-slate-500 uppercase">API Path</Label>
                            <div className="rounded-lg border bg-slate-50 p-2 font-mono text-[10px] break-all text-slate-600">
                                {selectedEvent.path}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-slate-500">Request ID</span>
                                <p className="font-mono text-[10px] break-all text-slate-500">{selectedEvent.requestId || "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-slate-500">Event ID</span>
                                <p className="font-mono text-[10px] break-all text-slate-500">{selectedEvent.id}</p>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <Button variant="outline" onClick={() => setSelectedEvent(null)} className="w-full sm:w-auto">Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
