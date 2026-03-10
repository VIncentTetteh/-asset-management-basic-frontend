"use client";

import { useState, useEffect, useMemo } from "react";
import { SLAMetric, SLAMetricDto } from "@/types";
import { slaMetricService } from "@/services/complianceService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Activity, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function SLAMetricsPage() {
    const [items, setItems] = useState<SLAMetric[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<SLAMetric | null>(null);
    const [yearFilter, setYearFilter] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SLAMetricDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            setItems(await slaMetricService.getAll());
        } catch {
            toast.error("Failed to load SLA metrics");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const years = useMemo(() => [...new Set(items.map(i => i.year))].sort((a, b) => b - a), [items]);

    const stats = useMemo(() => {
        const base = yearFilter ? items.filter(i => i.year === Number(yearFilter)) : items;
        const avgUptime = base.length ? (base.reduce((s, i) => s + i.uptimePercent, 0) / base.length).toFixed(3) : "—";
        const breached = base.filter(i => i.slaBreached).length;
        const totalIncidents = base.reduce((s, i) => s + (i.incidentCount ?? 0), 0);
        return { avgUptime, breached, totalIncidents, count: base.length };
    }, [items, yearFilter]);

    const filtered = useMemo(() => {
        if (!yearFilter) return items;
        return items.filter(i => i.year === Number(yearFilter));
    }, [items, yearFilter]);

    const handleOpenCreate = () => {
        setEditing(null);
        const now = new Date();
        reset({
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            uptimePercent: 99.9,
            slaBreached: false,
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: SLAMetric) => {
        setEditing(item);
        reset({
            month: item.month,
            year: item.year,
            uptimePercent: item.uptimePercent,
            plannedDowntimeMinutes: item.plannedDowntimeMinutes,
            unplannedDowntimeMinutes: item.unplannedDowntimeMinutes,
            incidentCount: item.incidentCount,
            rtoMinutes: item.rtoMinutes,
            rpoMinutes: item.rpoMinutes,
            slaBreached: item.slaBreached ?? false,
            notes: item.notes ?? "",
        });
        setIsModalOpen(true);
    };

    const onSubmit = async (data: SLAMetricDto) => {
        try {
            data.month = Number(data.month);
            data.year = Number(data.year);
            data.uptimePercent = Number(data.uptimePercent);
            if (data.plannedDowntimeMinutes !== undefined) data.plannedDowntimeMinutes = Number(data.plannedDowntimeMinutes);
            if (data.unplannedDowntimeMinutes !== undefined) data.unplannedDowntimeMinutes = Number(data.unplannedDowntimeMinutes);
            if (data.incidentCount !== undefined) data.incidentCount = Number(data.incidentCount);
            if (data.rtoMinutes !== undefined) data.rtoMinutes = Number(data.rtoMinutes);
            if (data.rpoMinutes !== undefined) data.rpoMinutes = Number(data.rpoMinutes);

            const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "")) as SLAMetricDto;
            if (editing) {
                const patch = buildPatchPayload<SLAMetricDto>(editing as unknown as Partial<SLAMetricDto>, clean);
                if (!Object.keys(patch).length) { toast("No changes"); return; }
                await slaMetricService.update(editing.id, patch);
                toast.success("Updated");
            } else {
                await slaMetricService.create(clean);
                toast.success("SLA metric created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? "Failed to save");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">SLA Metrics</h1>
                    <p className="text-slate-500">Monthly availability metrics for SOC 2 Availability criteria.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Month
                </Button>
            </div>

            {!isLoading && items.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-teal-700">{stats.avgUptime}%</div>
                        <div className="text-xs text-teal-600 font-semibold uppercase mt-1">Avg Uptime{yearFilter ? ` (${yearFilter})` : ""}</div>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-red-700">{stats.breached}</div>
                        <div className="text-xs text-red-600 font-semibold uppercase mt-1">SLA Breaches</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-amber-700">{stats.totalIncidents}</div>
                        <div className="text-xs text-amber-600 font-semibold uppercase mt-1">Total Incidents</div>
                    </div>
                </div>
            )}

            {!isLoading && years.length > 1 && (
                <div className="flex gap-3">
                    <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700">
                        <option value="">All Years</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Activity className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No SLA metrics recorded</h3>
                        <p className="text-slate-500 mt-1">Track monthly uptime and availability for SOC 2 compliance.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">Add Month</Button>
                    </div>
                ) : filtered.map(item => (
                    <Card key={item.id} className="group border-slate-200 hover:shadow-md transition-all flex flex-col">
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-base font-bold text-slate-900">{MONTH_NAMES[item.month - 1]} {item.year}</CardTitle>
                                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wide ${item.slaBreached ? "bg-red-100 text-red-700 border-red-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                                    {item.slaBreached ? "BREACHED" : "MET"}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-teal-600" />
                                    <span className="text-lg font-bold text-slate-900">{item.uptimePercent}%</span>
                                    <span className="text-xs text-slate-500">uptime</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {item.plannedDowntimeMinutes !== undefined && (
                                        <div><span className="text-slate-400">Planned:</span> <span className="font-medium">{item.plannedDowntimeMinutes}m</span></div>
                                    )}
                                    {item.unplannedDowntimeMinutes !== undefined && (
                                        <div><span className="text-slate-400">Unplanned:</span> <span className="font-medium">{item.unplannedDowntimeMinutes}m</span></div>
                                    )}
                                    {item.incidentCount !== undefined && (
                                        <div><span className="text-slate-400">Incidents:</span> <span className="font-medium">{item.incidentCount}</span></div>
                                    )}
                                    {item.rtoMinutes !== undefined && (
                                        <div><span className="text-slate-400">RTO:</span> <span className="font-medium">{item.rtoMinutes}m</span></div>
                                    )}
                                    {item.rpoMinutes !== undefined && (
                                        <div><span className="text-slate-400">RPO:</span> <span className="font-medium">{item.rpoMinutes}m</span></div>
                                    )}
                                </div>
                                {item.notes && <p className="text-xs text-slate-500 line-clamp-2">{item.notes}</p>}
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="outline" size="sm" onClick={() => handleOpenEdit(item)} className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
                title={editing ? "Edit SLA Metric" : "Add SLA Metric"}
                description="Record monthly availability and uptime data.">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label>Month <span className="text-red-500">*</span></Label>
                            <Input type="number" min={1} max={12} {...register("month", { required: true, min: 1, max: 12 })} />
                            {errors.month && <p className="text-xs text-red-500">1–12</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Year <span className="text-red-500">*</span></Label>
                            <Input type="number" min={2000} {...register("year", { required: true })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Uptime % <span className="text-red-500">*</span></Label>
                            <Input type="number" step="0.001" min={0} max={100} {...register("uptimePercent", { required: true })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Planned Downtime (min)</Label>
                            <Input type="number" min={0} {...register("plannedDowntimeMinutes")} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Unplanned Downtime (min)</Label>
                            <Input type="number" min={0} {...register("unplannedDowntimeMinutes")} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label>Incidents</Label>
                            <Input type="number" min={0} {...register("incidentCount")} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>RTO (min)</Label>
                            <Input type="number" min={0} {...register("rtoMinutes")} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>RPO (min)</Label>
                            <Input type="number" min={0} {...register("rpoMinutes")} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Input {...register("notes")} placeholder="Monthly summary notes..." />
                    </div>
                    <div className="flex items-center gap-2 py-1">
                        <input type="checkbox" id="slaBreached" {...register("slaBreached")} className="h-4 w-4 accent-red-600 rounded" />
                        <Label htmlFor="slaBreached" className="cursor-pointer">SLA was breached this month</Label>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {editing ? "Save Changes" : "Create"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
