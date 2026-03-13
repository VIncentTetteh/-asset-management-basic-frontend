"use client";

import { useState, useEffect, useMemo } from "react";
import { ICSAsset, ICSAssetDto, VendorSupportStatus, SecurityZone } from "@/types";
import { icsAssetService, securityZoneService } from "@/services/complianceService";
import { assetService } from "@/services/assetService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Cpu, Search, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";

const VENDOR_STATUSES: VendorSupportStatus[] = ["SUPPORTED", "END_OF_LIFE", "END_OF_SUPPORT", "UNKNOWN"];

const supportColor: Record<VendorSupportStatus, string> = {
    SUPPORTED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    END_OF_LIFE: "bg-red-100 text-red-700 border-red-200",
    END_OF_SUPPORT: "bg-orange-100 text-orange-700 border-orange-200",
    UNKNOWN: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function ICSAssetsPage() {
    const [items, setItems] = useState<ICSAsset[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [zones, setZones] = useState<SecurityZone[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<ICSAsset | null>(null);
    const [search, setSearch] = useState("");
    const [supportFilter, setSupportFilter] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ICSAssetDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [icsData, assetsData, zonesData] = await Promise.all([
                icsAssetService.getAll(),
                assetService.getAll(),
                securityZoneService.getAll(),
            ]);
            setItems(icsData);
            setAssets(assetsData);
            setZones(zonesData);
        } catch {
            toast.error("Failed to load ICS assets");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a.name])), [assets]);

    const filtered = useMemo(() => {
        let base = supportFilter ? items.filter(i => i.vendorSupportStatus === supportFilter) : items;
        if (!search.trim()) return base;
        const q = search.toLowerCase();
        return base.filter(i =>
            (i.assetName ?? assetMap.get(i.assetId) ?? "").toLowerCase().includes(q) ||
            (i.protocol ?? "").toLowerCase().includes(q) ||
            (i.securityZoneName ?? "").toLowerCase().includes(q) ||
            (i.knownVulnerabilities ?? "").toLowerCase().includes(q)
        );
    }, [items, search, supportFilter, assetMap]);

    const eolCount = useMemo(() => items.filter(i => i.vendorSupportStatus === "END_OF_LIFE" || i.vendorSupportStatus === "END_OF_SUPPORT").length, [items]);
    const vulnCount = useMemo(() => items.filter(i => i.knownVulnerabilities).length, [items]);

    const handleOpenCreate = () => {
        setEditing(null);
        reset({ assetId: "", isolated: false, vendorSupportStatus: "SUPPORTED" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: ICSAsset) => {
        setEditing(item);
        reset({
            assetId: item.assetId,
            securityZoneId: item.securityZoneId ?? "",
            firmwareVersion: item.firmwareVersion ?? "",
            protocol: item.protocol ?? "",
            vendorSupportStatus: item.vendorSupportStatus ?? "UNKNOWN",
            lastPatchedAt: item.lastPatchedAt ? item.lastPatchedAt.split("T")[0] : "",
            knownVulnerabilities: item.knownVulnerabilities ?? "",
            isolated: item.isolated ?? false,
            notes: item.notes ?? "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this ICS asset record?")) return;
        try {
            await icsAssetService.delete(id);
            toast.success("Deleted");
            fetchData();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const onSubmit = async (data: ICSAssetDto) => {
        try {
            const normalized: ICSAssetDto = {
                ...data,
                lastPatchedAt: data.lastPatchedAt
                    ? new Date(`${data.lastPatchedAt}T00:00:00Z`).toISOString()
                    : undefined,
            };
            const clean = Object.fromEntries(Object.entries(normalized).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as ICSAssetDto;
            if (editing) {
                const editingNormalized: Partial<ICSAssetDto> = {
                    ...(editing as unknown as Partial<ICSAssetDto>),
                    lastPatchedAt: editing.lastPatchedAt ? new Date(editing.lastPatchedAt).toISOString() : undefined,
                };
                const patch = buildPatchPayload<ICSAssetDto>(editingNormalized, clean);
                if (!Object.keys(patch).length) { toast("No changes to save"); return; }
                await icsAssetService.update(editing.id, patch);
                toast.success("Updated");
            } else {
                await icsAssetService.create(clean);
                toast.success("ICS asset created");
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
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">ICS Assets</h1>
                    <p className="text-slate-500">OT/ICS compliance metadata overlay for operational technology assets.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> Add ICS Asset
                </Button>
            </div>

            {!isLoading && items.length > 0 && (eolCount > 0 || vulnCount > 0) && (
                <div className="flex gap-3">
                    {eolCount > 0 && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <ShieldAlert className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-semibold text-red-700">{eolCount} asset{eolCount !== 1 ? "s" : ""} end-of-life / end-of-support</span>
                        </div>
                    )}
                    {vulnCount > 0 && (
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                            <ShieldAlert className="h-4 w-4 text-orange-600" />
                            <span className="text-sm font-semibold text-orange-700">{vulnCount} asset{vulnCount !== 1 ? "s" : ""} with known CVEs</span>
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by asset, protocol, zone..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <select value={supportFilter} onChange={e => setSupportFilter(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700">
                    <option value="">All Support Statuses</option>
                    {VENDOR_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 bg-slate-100 rounded-xl animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Cpu className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">{search ? "No ICS assets match your search" : "No ICS assets registered"}</h3>
                        <p className="text-slate-500 mt-1">Link OT/ICS compliance metadata to your operational assets.</p>
                        {!search && <Button onClick={handleOpenCreate} className="mt-6 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">Add ICS Asset</Button>}
                    </div>
                ) : filtered.map(item => (
                    <Card key={item.id} className="group border-slate-200 hover:shadow-md transition-all flex flex-col">
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Cpu className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                                        <CardTitle className="text-sm font-semibold text-slate-900 truncate">{item.assetName || assetMap.get(item.assetId) || "Unknown Asset"}</CardTitle>
                                    </div>
                                    {item.securityZoneName && <span className="text-xs text-slate-500 ml-5">{item.securityZoneName}</span>}
                                </div>
                                {item.vendorSupportStatus && (
                                    <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wide ${supportColor[item.vendorSupportStatus]}`}>
                                        {item.vendorSupportStatus.replace(/_/g, " ")}
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                            <div className="flex-1 space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {item.firmwareVersion && (
                                        <div><span className="text-slate-400">Firmware</span><div className="font-mono font-medium text-slate-700">{item.firmwareVersion}</div></div>
                                    )}
                                    {item.protocol && (
                                        <div><span className="text-slate-400">Protocol</span><div className="font-medium text-slate-700">{item.protocol}</div></div>
                                    )}
                                </div>
                                {item.lastPatchedAt && <p className="text-xs text-slate-500">Last patched: <span className="font-medium">{new Date(item.lastPatchedAt).toLocaleDateString()}</span></p>}
                                {item.knownVulnerabilities && (
                                    <div className="text-xs text-red-700 bg-red-50 rounded-md px-2 py-1.5 border border-red-100 line-clamp-2">
                                        <span className="font-semibold">CVEs: </span>{item.knownVulnerabilities}
                                    </div>
                                )}
                                <div className="flex gap-2 flex-wrap">
                                    {item.isolated && <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 border border-emerald-200">Isolated</span>}
                                </div>
                                {item.notes && <p className="text-xs text-slate-500 line-clamp-2">{item.notes}</p>}
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
                title={editing ? "Edit ICS Asset" : "Add ICS Asset"}
                description="Link OT/ICS compliance metadata to an existing asset.">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-1.5">
                        <Label>Asset <span className="text-red-500">*</span></Label>
                        <Select {...register("assetId", { required: true })} disabled={!!editing}>
                            <option value="">— Select asset —</option>
                            {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "NO-TAG"})</option>)}
                        </Select>
                        {errors.assetId && <p className="text-xs text-red-500">Required</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label>Security Zone</Label>
                        <Select {...register("securityZoneId")}>
                            <option value="">— None —</option>
                            {zones.map(z => <option key={z.id} value={z.id}>L{z.purdueLevel} — {z.name}</option>)}
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Firmware Version</Label>
                            <Input {...register("firmwareVersion")} placeholder="V3.2.7" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Protocol</Label>
                            <Input {...register("protocol")} placeholder="Modbus TCP" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Vendor Support</Label>
                            <Select {...register("vendorSupportStatus")}>
                                {VENDOR_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Last Patched</Label>
                            <Input type="date" {...register("lastPatchedAt")} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Known Vulnerabilities (CVEs)</Label>
                        <Textarea {...register("knownVulnerabilities")} placeholder="CVE-2021-37185, ..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Textarea {...register("notes")} placeholder="Maintenance windows, restrictions..." />
                    </div>
                    <div className="flex items-center gap-2 py-1">
                        <input type="checkbox" id="isolated" {...register("isolated")} className="h-4 w-4 accent-teal-600 rounded" />
                        <Label htmlFor="isolated" className="cursor-pointer">Asset is network-isolated</Label>
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
