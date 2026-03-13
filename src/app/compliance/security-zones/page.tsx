"use client";

import { useState, useEffect, useMemo } from "react";
import { SecurityZone, SecurityZoneDto } from "@/types";
import { securityZoneService } from "@/services/complianceService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Network, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";

const PURDUE_LEVELS = [
    { value: 0, label: "0 — Field Devices (Sensors/Actuators)" },
    { value: 1, label: "1 — Controllers (PLCs/RTUs)" },
    { value: 2, label: "2 — Supervisory (SCADA/HMI)" },
    { value: 3, label: "3 — Operations" },
    { value: 4, label: "4 — Enterprise" },
    { value: 5, label: "5 — DMZ" },
];

const levelBg = (level: number): string => {
    const colors = [
        "bg-red-100 text-red-700 border-red-200",
        "bg-orange-100 text-orange-700 border-orange-200",
        "bg-amber-100 text-amber-700 border-amber-200",
        "bg-teal-100 text-teal-700 border-teal-200",
        "bg-blue-100 text-blue-700 border-blue-200",
        "bg-slate-100 text-slate-600 border-slate-200",
    ];
    return colors[level] ?? colors[5];
};

export default function SecurityZonesPage() {
    const [items, setItems] = useState<SecurityZone[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<SecurityZone | null>(null);
    const [search, setSearch] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SecurityZoneDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            setItems(await securityZoneService.getAll());
        } catch {
            toast.error("Failed to load security zones");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter(i =>
            i.name.toLowerCase().includes(q) ||
            (i.description ?? "").toLowerCase().includes(q) ||
            (i.networkRange ?? "").toLowerCase().includes(q)
        );
    }, [items, search]);

    const handleOpenCreate = () => {
        setEditing(null);
        reset({ name: "", purdueLevel: 0 });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: SecurityZone) => {
        setEditing(item);
        reset({
            name: item.name,
            purdueLevel: item.purdueLevel,
            description: item.description ?? "",
            allowedProtocols: item.allowedProtocols ?? "",
            networkRange: item.networkRange ?? "",
            assetCount: item.assetCount,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this security zone?")) return;
        try {
            await securityZoneService.delete(id);
            toast.success("Deleted");
            fetchData();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const onSubmit = async (data: SecurityZoneDto) => {
        try {
            data.purdueLevel = Number(data.purdueLevel);
            if (data.assetCount !== undefined) data.assetCount = Number(data.assetCount);
            const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "")) as SecurityZoneDto;
            if (editing) {
                const patch = buildPatchPayload<SecurityZoneDto>(editing as unknown as Partial<SecurityZoneDto>, clean);
                if (!Object.keys(patch).length) { toast("No changes to save"); return; }
                await securityZoneService.update(editing.id, patch);
                toast.success("Zone updated");
            } else {
                await securityZoneService.create(clean);
                toast.success("Zone created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch {
            toast.error("Failed to save");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Security Zones</h1>
                    <p className="text-slate-500">IEC 62443 Purdue-model security zone management (levels 0–5).</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Zone
                </Button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search zones..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Network className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">{search ? "No zones match your search" : "No security zones defined"}</h3>
                        <p className="text-slate-500 mt-1">Define ICS/OT security zones using the Purdue model.</p>
                        {!search && <Button onClick={handleOpenCreate} className="mt-6 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">Add Zone</Button>}
                    </div>
                ) : filtered.map(item => (
                    <Card key={item.id} className="group border-slate-200 hover:shadow-md transition-all flex flex-col">
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border mb-1.5 ${levelBg(item.purdueLevel)}`}>
                                        Level {item.purdueLevel}
                                    </span>
                                    <CardTitle className="text-sm font-semibold text-slate-900">{item.name}</CardTitle>
                                </div>
                                {item.assetCount !== undefined && (
                                    <span className="text-xs font-semibold text-slate-500 shrink-0 bg-slate-100 rounded-full px-2 py-0.5">{item.assetCount} assets</span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                            <div className="flex-1 space-y-2">
                                {item.description && <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>}
                                {item.networkRange && <p className="text-xs font-mono text-slate-600 bg-slate-50 rounded px-2 py-1 border border-slate-100">{item.networkRange}</p>}
                                {item.allowedProtocols && <p className="text-xs text-slate-500">Protocols: <span className="font-medium text-slate-700">{item.allowedProtocols}</span></p>}
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="outline" size="sm" onClick={() => handleOpenEdit(item)} className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
                title={editing ? "Edit Security Zone" : "Add Security Zone"}
                description="Define an ICS/OT security zone using the Purdue model.">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-1.5">
                        <Label>Zone Name <span className="text-red-500">*</span></Label>
                        <Input {...register("name", { required: true })} placeholder="Field Devices Zone" />
                        {errors.name && <p className="text-xs text-red-500">Required</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label>Purdue Level <span className="text-red-500">*</span></Label>
                        <Select {...register("purdueLevel", { required: true })}>
                            {PURDUE_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea {...register("description")} placeholder="Zone purpose and scope..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Allowed Protocols</Label>
                        <Textarea {...register("allowedProtocols")} placeholder="Modbus, HART, DNP3..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Network Range</Label>
                            <Input {...register("networkRange")} placeholder="10.0.0.0/24" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Asset Count</Label>
                            <Input type="number" min={0} {...register("assetCount")} placeholder="0" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {editing ? "Save Changes" : "Create Zone"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
