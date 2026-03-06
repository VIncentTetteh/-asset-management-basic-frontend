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
                                    <tr className="text-left text-slate-600">
                                        <th className="p-3 font-semibold">Time</th>
                                        <th className="p-3 font-semibold">Actor</th>
                                        <th className="p-3 font-semibold">Method</th>
                                        <th className="p-3 font-semibold">Path</th>
                                        <th className="p-3 font-semibold">Status</th>
                                        <th className="p-3 font-semibold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.map((event) => (
                                        <tr key={event.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                                            <td className="p-3 text-slate-600 whitespace-nowrap">{new Date(event.createdAt).toLocaleString()}</td>
                                            <td className="p-3 text-slate-800">{event.actorEmail || "System"}</td>
                                            <td className="p-3">
                                                <span className="rounded border px-2 py-0.5 font-mono text-xs">{event.method}</span>
                                            </td>
                                            <td className="p-3 font-mono text-xs text-slate-700">{event.path}</td>
                                            <td className="p-3">
                                                <span className={`rounded-full px-2 py-0.5 text-xs border ${event.success ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                                                    {event.responseStatus}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <Button variant="outline" size="sm" onClick={() => openDetails(event.id)}>
                                                    View
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
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-slate-500">Event ID</span><p className="font-mono break-all">{selectedEvent.id}</p></div>
                            <div><span className="text-slate-500">Request ID</span><p className="font-mono break-all">{selectedEvent.requestId || "N/A"}</p></div>
                            <div><span className="text-slate-500">Actor</span><p>{selectedEvent.actorEmail || "System"}</p></div>
                            <div><span className="text-slate-500">Client IP</span><p>{selectedEvent.clientIp || "N/A"}</p></div>
                            <div><span className="text-slate-500">Handler</span><p>{selectedEvent.handler || "N/A"}</p></div>
                            <div><span className="text-slate-500">Status</span><p>{selectedEvent.responseStatus}</p></div>
                        </div>
                        <div>
                            <Label>Path</Label>
                            <div className="rounded border bg-slate-50 px-3 py-2 font-mono text-xs break-all">{selectedEvent.path}</div>
                        </div>
                        <div>
                            <Label>User Agent</Label>
                            <div className="rounded border bg-slate-50 px-3 py-2 text-xs break-all">{selectedEvent.userAgent || "N/A"}</div>
                        </div>
                        <div className="pt-2 flex justify-end">
                            <Button variant="outline" onClick={() => setSelectedEvent(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
