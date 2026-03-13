"use client";

import { useState, useEffect } from "react";
import { DiscoveredDevice, DiscoveryScanDto, DiscoverySummary } from "@/types";
import { discoveryService } from "@/services/discoveryService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { ScanLine, Trash2, ArrowUpRight, Wifi, WifiOff, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";

export default function DiscoveryPage() {
    const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
    const [summary, setSummary] = useState<DiscoverySummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [promotingId, setPromotingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { register, handleSubmit, formState: { isSubmitting } } = useForm<DiscoveryScanDto & { portsInput?: string; ipAddressesInput?: string }>({
        defaultValues: { cidrRange: "192.168.1.0/24", portScan: true, timeoutMs: 1000 },
    });

    const fetchDevices = async (p = 0) => {
        try {
            setIsLoading(true);
            const [devicesResult, summaryResult] = await Promise.allSettled([
                discoveryService.getDevices({ page: p, size: 20 }),
                discoveryService.getSummary(),
            ]);
            if (devicesResult.status === "fulfilled") {
                setDevices(devicesResult.value.content ?? []);
                setTotalPages(devicesResult.value.totalPages ?? 0);
            }
            if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
        } catch {
            toast.error("Failed to load devices");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchDevices(page); }, [page]);

    const onScan = async (data: DiscoveryScanDto & { portsInput?: string; ipAddressesInput?: string }) => {
        const payload: DiscoveryScanDto = {
            cidrRange: data.cidrRange || null,
            portScan: data.portScan,
            timeoutMs: data.timeoutMs,
        };
        if (data.portsInput) {
            payload.ports = data.portsInput.split(",").map(p => parseInt(p.trim())).filter(n => !isNaN(n));
        }
        if (data.ipAddressesInput) {
            payload.ipAddresses = data.ipAddressesInput.split("\n").map(ip => ip.trim()).filter(Boolean);
            payload.cidrRange = null;
        }
        try {
            const res = await discoveryService.scan(payload);
            setIsScanModalOpen(false);
            toast.success(res.message || "Scan initiated — devices will appear as they are discovered.");
            setPage(0);
            fetchDevices(0);
        } catch {
            toast.error("Scan failed");
        }
    };

    const handlePromote = async (id: string) => {
        setPromotingId(id);
        try {
            const res = await discoveryService.promote(id);
            toast.success(`Promoted as asset: ${res.assetName}`);
            fetchDevices(page);
        } catch {
            toast.error("Failed to promote device");
        } finally {
            setPromotingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Remove this device from discovery?")) return;
        setDeletingId(id);
        try {
            await discoveryService.deleteDevice(id);
            toast.success("Device removed");
            fetchDevices(page);
        } catch {
            toast.error("Failed to remove device");
        } finally {
            setDeletingId(null);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "ONLINE": return <Wifi className="h-4 w-4 text-emerald-500" />;
            case "OFFLINE": return <WifiOff className="h-4 w-4 text-slate-400" />;
            case "PROMOTED": return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
            default: return <WifiOff className="h-4 w-4 text-slate-300" />;
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case "ONLINE": return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case "OFFLINE": return "bg-slate-100 text-slate-500 border-slate-200";
            case "PROMOTED": return "bg-blue-100 text-blue-700 border-blue-200";
            default: return "bg-slate-100 text-slate-400 border-slate-200";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">IT Asset Discovery</h1>
                    <p className="text-slate-500">Scan your network to discover and onboard IT assets.</p>
                </div>
                <Button onClick={() => setIsScanModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                    <ScanLine className="mr-2 h-4 w-4" /> Scan Network
                </Button>
            </div>

            {summary && (
                <div className="grid gap-4 md:grid-cols-4">
                    {[
                        { label: "Total Discovered", value: summary.total, color: "bg-blue-100 text-blue-600" },
                        { label: "Online", value: summary.online, color: "bg-emerald-100 text-emerald-600" },
                        { label: "Offline", value: summary.offline, color: "bg-slate-100 text-slate-500" },
                        { label: "Promoted", value: summary.promoted, color: "bg-purple-100 text-purple-600" },
                    ].map(item => (
                        <Card key={item.label} className="border-slate-200">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${item.color}`}>
                                    <ScanLine className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">{item.label}</p>
                                    <p className="text-xl font-bold text-slate-900">{item.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Card className="border-slate-200">
                <CardHeader className="pb-0">
                    <CardTitle className="text-base font-semibold text-slate-700">
                        {devices.length} device{devices.length !== 1 ? "s" : ""} found
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="h-40 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                        </div>
                    ) : devices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <ScanLine className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No devices discovered yet</h3>
                            <p className="text-slate-500 mt-1">Run a network scan to discover IT assets on your network.</p>
                            <Button onClick={() => setIsScanModalOpen(true)} className="mt-4 bg-purple-600 hover:bg-purple-700">
                                <ScanLine className="mr-2 h-4 w-4" /> Start Scan
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">IP Address</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Hostname</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">MAC Address</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Device Type</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Open Ports</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Last Seen</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                            <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {devices.map((device) => (
                                            <tr key={device.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-4 font-mono text-slate-800 font-medium">{device.ipAddress}</td>
                                                <td className="py-3 px-4 text-slate-600">{device.hostname || "—"}</td>
                                                <td className="py-3 px-4 font-mono text-xs text-slate-500">{device.macAddress || "—"}</td>
                                                <td className="py-3 px-4 text-slate-600">{device.deviceType || "Unknown"}</td>
                                                <td className="py-3 px-4 text-slate-500 text-xs">
                                                    {device.openPorts?.length ? device.openPorts.join(", ") : "—"}
                                                </td>
                                                <td className="py-3 px-4 text-slate-500 text-xs">
                                                    {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "—"}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full border ${getStatusStyles(device.status)}`}>
                                                        {getStatusIcon(device.status)}
                                                        {device.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex justify-end gap-2">
                                                        {device.status !== "PROMOTED" && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handlePromote(device.id)}
                                                                isLoading={promotingId === device.id}
                                                                className="h-7 px-2 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                                                            >
                                                                <ArrowUpRight className="h-3 w-3 mr-1" /> Promote
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(device.id)} isLoading={deletingId === device.id} className="h-7 px-2 text-red-600 hover:bg-red-50">
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
                                    <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
                                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Modal
                isOpen={isScanModalOpen}
                onClose={() => setIsScanModalOpen(false)}
                title="Scan Network"
                description="Configure and run a network discovery scan."
            >
                <form onSubmit={handleSubmit(onScan)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cidrRange">CIDR Range</Label>
                        <Input id="cidrRange" placeholder="192.168.1.0/24" {...register("cidrRange")} />
                        <p className="text-xs text-slate-400">Leave blank if using individual IP addresses below.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="ipAddressesInput">Individual IP Addresses</Label>
                        <textarea
                            id="ipAddressesInput"
                            rows={3}
                            placeholder={"192.168.1.10\n192.168.1.11"}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            {...register("ipAddressesInput")}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="portsInput">Ports (comma-separated)</Label>
                            <Input id="portsInput" placeholder="22,80,443,3389" {...register("portsInput")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="timeoutMs">Timeout (ms)</Label>
                            <Input id="timeoutMs" type="number" {...register("timeoutMs", { valueAsNumber: true })} />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="portScan" {...register("portScan")} className="h-4 w-4 rounded border-slate-300 text-purple-600" />
                        <Label htmlFor="portScan">Enable Port Scan</Label>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsScanModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                            <ScanLine className="mr-2 h-4 w-4" /> Start Scan
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
