"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DiscoveredDevice, DiscoveryScanDto, DiscoverySummary } from "@/types";
import { discoveryService } from "@/services/discoveryService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import {
    ScanLine, Trash2, ArrowUpRight, Wifi, WifiOff, CheckCircle2,
    Server, Monitor, Printer, Smartphone, Router, HardDrive, Globe,
    RefreshCw, ChevronDown, ChevronUp, Shield, Clock, Tag, Network,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useConfirm } from "@/hooks/useConfirm";


// ── Port → Service map ────────────────────────────────────────────────────────

const PORT_SERVICES: Record<number, { name: string; color: string }> = {
    21:   { name: "FTP",     color: "bg-slate-100 text-slate-600" },
    22:   { name: "SSH",     color: "bg-emerald-100 text-emerald-700" },
    23:   { name: "Telnet",  color: "bg-rose-100 text-rose-700" },
    25:   { name: "SMTP",    color: "bg-blue-100 text-blue-700" },
    53:   { name: "DNS",     color: "bg-indigo-100 text-indigo-700" },
    80:   { name: "HTTP",    color: "bg-sky-100 text-sky-700" },
    110:  { name: "POP3",    color: "bg-blue-100 text-blue-700" },
    143:  { name: "IMAP",    color: "bg-blue-100 text-blue-700" },
    161:  { name: "SNMP",    color: "bg-amber-100 text-amber-700" },
    389:  { name: "LDAP",    color: "bg-violet-100 text-violet-700" },
    443:  { name: "HTTPS",   color: "bg-emerald-100 text-emerald-700" },
    445:  { name: "SMB",     color: "bg-orange-100 text-orange-700" },
    514:  { name: "Syslog",  color: "bg-slate-100 text-slate-600" },
    636:  { name: "LDAPS",   color: "bg-violet-100 text-violet-700" },
    993:  { name: "IMAPS",   color: "bg-blue-100 text-blue-700" },
    995:  { name: "POP3S",   color: "bg-blue-100 text-blue-700" },
    1433: { name: "MSSQL",   color: "bg-amber-100 text-amber-700" },
    1521: { name: "Oracle",  color: "bg-orange-100 text-orange-700" },
    3306: { name: "MySQL",   color: "bg-amber-100 text-amber-700" },
    3389: { name: "RDP",     color: "bg-rose-100 text-rose-700" },
    5432: { name: "PostgreSQL", color: "bg-blue-100 text-blue-700" },
    5900: { name: "VNC",     color: "bg-purple-100 text-purple-700" },
    5985: { name: "WinRM",   color: "bg-slate-100 text-slate-600" },
    6379: { name: "Redis",   color: "bg-rose-100 text-rose-700" },
    8080: { name: "HTTP-alt",color: "bg-sky-100 text-sky-700" },
    8443: { name: "HTTPS-alt",color: "bg-emerald-100 text-emerald-700" },
    9200: { name: "Elastic", color: "bg-amber-100 text-amber-700" },
    27017:{ name: "MongoDB", color: "bg-emerald-100 text-emerald-700" },
};

const getPortService = (port: number) =>
    PORT_SERVICES[port] ?? { name: `Port ${port}`, color: "bg-slate-100 text-slate-500" };

// ── Device type meta ──────────────────────────────────────────────────────────

const DEVICE_TYPE_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    SERVER:      { icon: <Server className="h-5 w-5" />,    label: "Server",      color: "text-slate-700 bg-slate-100" },
    WORKSTATION: { icon: <Monitor className="h-5 w-5" />,   label: "Workstation", color: "text-blue-700 bg-blue-100" },
    LAPTOP:      { icon: <Monitor className="h-5 w-5" />,   label: "Laptop",      color: "text-indigo-700 bg-indigo-100" },
    PRINTER:     { icon: <Printer className="h-5 w-5" />,   label: "Printer",     color: "text-amber-700 bg-amber-100" },
    MOBILE:      { icon: <Smartphone className="h-5 w-5" />,label: "Mobile",      color: "text-rose-700 bg-rose-100" },
    ROUTER:      { icon: <Router className="h-5 w-5" />,    label: "Router",      color: "text-emerald-700 bg-emerald-100" },
    SWITCH:      { icon: <Network className="h-5 w-5" />,   label: "Switch",      color: "text-teal-700 bg-teal-100" },
    NAS:         { icon: <HardDrive className="h-5 w-5" />, label: "NAS",         color: "text-purple-700 bg-purple-100" },
    FIREWALL:    { icon: <Shield className="h-5 w-5" />,    label: "Firewall",    color: "text-red-700 bg-red-100" },
    IOT:         { icon: <Globe className="h-5 w-5" />,     label: "IoT Device",  color: "text-cyan-700 bg-cyan-100" },
    UNKNOWN:     { icon: <Wifi className="h-5 w-5" />,      label: "Unknown",     color: "text-slate-500 bg-slate-100" },
};

const getDeviceMeta = (type?: string) =>
    DEVICE_TYPE_META[type?.toUpperCase() ?? "UNKNOWN"] ?? DEVICE_TYPE_META.UNKNOWN;

// ── Helpers ───────────────────────────────────────────────────────────────────

const inferDeviceType = (device: DiscoveredDevice): string => {
    if (device.deviceType) return device.deviceType;
    const ports = device.openPorts ?? [];
    if (ports.includes(3389) || ports.includes(5985)) return "WORKSTATION";
    if (ports.includes(3306) || ports.includes(5432) || ports.includes(1433) || ports.includes(1521)) return "SERVER";
    if (ports.includes(22) && ports.includes(80)) return "SERVER";
    if (ports.includes(9100)) return "PRINTER";
    if (ports.includes(161)) return "ROUTER";
    return "UNKNOWN";
};

const riskBadge = (ports: number[]) => {
    const risky = ports.filter(p => [23, 21, 3389, 5900, 445].includes(p));
    if (risky.length === 0) return null;
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-700 border border-rose-200">
            <Shield className="h-3 w-3" /> {risky.length} risky port{risky.length !== 1 ? "s" : ""}
        </span>
    );
};

const timeSince = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiscoveryPage() {
    const router = useRouter();
    const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
    const [summary, setSummary] = useState<DiscoverySummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [promotingId, setPromotingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<"ALL" | "ONLINE" | "OFFLINE" | "PROMOTED">("ALL");
    const [lastScanned, setLastScanned] = useState<Date | null>(null);

    const { register, handleSubmit, formState: { isSubmitting } } = useForm<DiscoveryScanDto & { portsInput?: string; ipAddressesInput?: string }>({
        defaultValues: { cidrRange: "192.168.1.0/24", portScan: true, timeoutMs: 1000 },
    });

    const { confirm, ConfirmDialog } = useConfirm();
    const fetchDevices = useCallback(async (p = 0) => {
        try {
            setIsLoading(true);
            const [devicesResult, summaryResult] = await Promise.allSettled([
                discoveryService.getDevices({ page: p, size: 50 }),
                discoveryService.getSummary(),
            ]);
            if (devicesResult.status === "fulfilled") {
                setDevices(devicesResult.value.items ?? devicesResult.value.content ?? []);
                setTotalPages(devicesResult.value.totalPages ?? 0);
            }
            if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
        } catch {
            toast.error("Failed to load devices");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchDevices(page); }, [page, fetchDevices]);

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
            setLastScanned(new Date());
            toast.success(`Scan completed: ${res.length} device${res.length === 1 ? "" : "s"} discovered.`);
            setTimeout(() => { setPage(0); fetchDevices(0); }, 2000);
        } catch {
            toast.error("Scan failed — check your network range and try again.");
        }
    };

    const handlePromote = async (id: string) => {
        setPromotingId(id);
        try {
            const res = await discoveryService.promote(id);
            toast.success(`Promoted as asset: ${res.assetName}`);
            fetchDevices(page);
            if (res.assetId && await confirm({ message: `Open "${res.assetName}" in the asset registry?`, variant: "info" })) {
                router.push(`/assets?id=${res.assetId}`);
            }
        } catch {
            toast.error("Failed to promote device to asset");
        } finally {
            setPromotingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ message: "Remove this device from discovery records?", variant: "danger" })) return;
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

    const filteredDevices = statusFilter === "ALL"
        ? devices
        : devices.filter(d => d.status === statusFilter);

    const statusCounts = {
        ALL: devices.length,
        ONLINE: devices.filter(d => d.status === "ONLINE").length,
        OFFLINE: devices.filter(d => d.status === "OFFLINE").length,
        PROMOTED: devices.filter(d => d.status === "PROMOTED").length,
    };

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">IT Asset Discovery</h1>
                    <p className="text-slate-500">
                        Scan your network to discover, inspect, and onboard IT assets.
                        {lastScanned && <span className="ml-2 text-xs text-slate-400">Last scanned {timeSince(lastScanned.toISOString())}</span>}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => fetchDevices(page)} className="gap-2">
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                    <Button onClick={() => setIsScanModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 gap-2">
                        <ScanLine className="h-4 w-4" /> Scan Network
                    </Button>
                </div>
            </div>

            {/* Summary stat cards */}
            {summary && (
                <div className="grid gap-4 md:grid-cols-4">
                    {[
                        { label: "Total Discovered", value: summary.total, icon: <ScanLine className="h-5 w-5" />, color: "bg-blue-100 text-blue-600" },
                        { label: "Online", value: summary.online, icon: <Wifi className="h-5 w-5" />, color: "bg-emerald-100 text-emerald-600" },
                        { label: "Offline", value: summary.offline, icon: <WifiOff className="h-5 w-5" />, color: "bg-slate-100 text-slate-500" },
                        { label: "Promoted to Assets", value: summary.promoted, icon: <CheckCircle2 className="h-5 w-5" />, color: "bg-purple-100 text-purple-600" },
                    ].map(item => (
                        <Card key={item.label} className="border-slate-200">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${item.color}`}>{item.icon}</div>
                                <div>
                                    <p className="text-xs text-slate-500">{item.label}</p>
                                    <p className="text-2xl font-black text-slate-900">{item.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Device list */}
            <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <CardTitle className="text-base font-semibold text-slate-700">
                            {filteredDevices.length} device{filteredDevices.length !== 1 ? "s" : ""}
                            {statusFilter !== "ALL" && ` · ${statusFilter.toLowerCase()}`}
                        </CardTitle>

                        {/* Status filter tabs */}
                        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
                            {(["ALL", "ONLINE", "OFFLINE", "PROMOTED"] as const).map(s => (
                                <button key={s} onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${statusFilter === s ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}>
                                    {s} <span className="ml-1 opacity-60">({statusCounts[s]})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="h-48 flex items-center justify-center">
                            <PageSpinner />
                        </div>
                    ) : filteredDevices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <ScanLine className="h-12 w-12 text-slate-200 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-800">
                                {devices.length === 0 ? "No devices discovered yet" : `No ${statusFilter.toLowerCase()} devices`}
                            </h3>
                            <p className="text-slate-500 mt-1 max-w-sm">
                                {devices.length === 0
                                    ? "Run a network scan to discover IT assets on your network."
                                    : `Try selecting a different status filter.`}
                            </p>
                            {devices.length === 0 && (
                                <Button onClick={() => setIsScanModalOpen(true)} className="mt-4 bg-purple-600 hover:bg-purple-700 gap-2">
                                    <ScanLine className="h-4 w-4" /> Start Scan
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {filteredDevices.map(device => {
                                const inferredType = inferDeviceType(device);
                                const devMeta = getDeviceMeta(inferredType);
                                const ports = device.openPorts ?? [];
                                const isExpanded = expandedId === device.id;

                                return (
                                    <div key={device.id} className="hover:bg-slate-50/50 transition-colors">
                                        {/* Main row */}
                                        <div className="flex items-center gap-3 p-4">

                                            {/* Device type icon */}
                                            <div className={`shrink-0 p-2 rounded-xl ${devMeta.color}`}>
                                                {devMeta.icon}
                                            </div>

                                            {/* IP + hostname */}
                                            <div className="min-w-0 w-36 shrink-0">
                                                <p className="font-mono text-sm font-bold text-slate-900">{device.ipAddress}</p>
                                                <p className="text-xs text-slate-500 truncate">{device.hostname || "No hostname"}</p>
                                            </div>

                                            {/* Type + MAC */}
                                            <div className="min-w-0 w-32 shrink-0 hidden sm:block">
                                                <p className="text-xs font-semibold text-slate-700">{devMeta.label}</p>
                                                <p className="font-mono text-[10px] text-slate-400">{device.macAddress || "—"}</p>
                                            </div>

                                            {/* Open ports / services */}
                                            <div className="flex-1 min-w-0 hidden md:block">
                                                {ports.length === 0 ? (
                                                    <span className="text-xs text-slate-400">No open ports</span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {ports.slice(0, 6).map(port => {
                                                            const svc = getPortService(port);
                                                            return (
                                                                <span key={port} className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${svc.color}`} title={`Port ${port}`}>
                                                                    {svc.name}
                                                                </span>
                                                            );
                                                        })}
                                                        {ports.length > 6 && (
                                                            <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded">
                                                                +{ports.length - 6}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {riskBadge(ports)}
                                            </div>

                                            {/* Last seen */}
                                            <div className="shrink-0 text-right hidden lg:block w-24">
                                                <p className="text-xs text-slate-500">
                                                    {device.lastSeenAt ? timeSince(device.lastSeenAt) : "—"}
                                                </p>
                                            </div>

                                            {/* Status badge */}
                                            <div className="shrink-0">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full border ${
                                                    device.status === "ONLINE"   ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                                    device.status === "OFFLINE"  ? "bg-slate-100 text-slate-500 border-slate-200" :
                                                    device.status === "PROMOTED" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                                    "bg-slate-100 text-slate-400 border-slate-200"
                                                }`}>
                                                    {device.status === "ONLINE" ? <Wifi className="h-3 w-3" /> :
                                                     device.status === "OFFLINE" ? <WifiOff className="h-3 w-3" /> :
                                                     <CheckCircle2 className="h-3 w-3" />}
                                                    {device.status}
                                                </span>
                                            </div>

                                            {/* Actions */}
                                            <div className="shrink-0 flex items-center gap-1">
                                                <button onClick={() => setExpandedId(isExpanded ? null : device.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </button>
                                                {device.status !== "PROMOTED" && (
                                                    <Button variant="outline" size="sm" onClick={() => handlePromote(device.id)}
                                                        isLoading={promotingId === device.id}
                                                        className="h-7 px-2 text-xs text-purple-700 border-purple-200 hover:bg-purple-50">
                                                        <ArrowUpRight className="h-3 w-3 mr-1" /> Promote
                                                    </Button>
                                                )}
                                                <button onClick={() => handleDelete(device.id)}
                                                    className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-50 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded detail panel */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                                                {/* Network */}
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                        <Network className="h-3 w-3" /> Network
                                                    </p>
                                                    <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">IP Address</span>
                                                            <span className="font-mono font-semibold text-slate-800">{device.ipAddress}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">MAC Address</span>
                                                            <span className="font-mono text-slate-700">{device.macAddress || "Unknown"}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Hostname</span>
                                                            <span className="font-medium text-slate-700">{device.hostname || "Not resolved"}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Device */}
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                        <Tag className="h-3 w-3" /> Device Info
                                                    </p>
                                                    <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Device Type</span>
                                                            <span className="font-medium text-slate-700">{devMeta.label}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">OS / Platform</span>
                                                            <span className="font-medium text-slate-700">{(device as any).os || "Unknown"}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Vendor / OUI</span>
                                                            <span className="font-medium text-slate-700">{(device as any).vendor || "Unknown"}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Open services */}
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                        <Globe className="h-3 w-3" /> Open Services ({ports.length})
                                                    </p>
                                                    {ports.length === 0 ? (
                                                        <p className="text-xs text-slate-400">No open ports detected</p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {ports.map(port => {
                                                                const svc = getPortService(port);
                                                                return (
                                                                    <span key={port} className={`inline-flex flex-col items-center px-2 py-1 text-[10px] rounded font-bold ${svc.color}`}>
                                                                        <span>{svc.name}</span>
                                                                        <span className="font-normal opacity-70">{port}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Timing + risk */}
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> Scan Timing
                                                    </p>
                                                    <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Last Seen</span>
                                                            <span className="font-medium text-slate-700">
                                                                {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "—"}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Status</span>
                                                            <span className={`font-bold text-xs ${device.status === "ONLINE" ? "text-emerald-600" : device.status === "PROMOTED" ? "text-blue-600" : "text-slate-500"}`}>
                                                                {device.status}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Security risk indicators */}
                                                    {ports.some(p => [23, 21, 5900].includes(p)) && (
                                                        <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-100">
                                                            <p className="text-[10px] font-bold text-rose-700 mb-1 flex items-center gap-1">
                                                                <Shield className="h-3 w-3" /> Security Risks
                                                            </p>
                                                            <ul className="space-y-0.5">
                                                                {ports.includes(23) && <li className="text-[10px] text-rose-600">· Telnet (port 23) — unencrypted</li>}
                                                                {ports.includes(21) && <li className="text-[10px] text-rose-600">· FTP (port 21) — unencrypted</li>}
                                                                {ports.includes(5900) && <li className="text-[10px] text-rose-600">· VNC (port 5900) — exposed desktop</li>}
                                                                {ports.includes(3389) && <li className="text-[10px] text-orange-600">· RDP (port 3389) — verify access controls</li>}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
                            <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Scan Modal */}
            <Modal isOpen={isScanModalOpen} onClose={() => setIsScanModalOpen(false)}
                title="Scan Network" description="Configure and run a network discovery scan to find IT assets.">
                <form onSubmit={handleSubmit(onScan)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cidrRange">CIDR Range</Label>
                        <Input id="cidrRange" placeholder="192.168.1.0/24" {...register("cidrRange")} />
                        <p className="text-xs text-slate-400">Common ranges: 10.0.0.0/24, 172.16.0.0/24, 192.168.1.0/24. Leave blank to use individual IPs below.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="ipAddressesInput">Individual IP Addresses (one per line)</Label>
                        <textarea id="ipAddressesInput" rows={3}
                            placeholder={"192.168.1.10\n192.168.1.11\n10.0.0.5"}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            {...register("ipAddressesInput")} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="portsInput">Ports (comma-separated)</Label>
                            <Input id="portsInput" placeholder="22,80,443,3389,3306" {...register("portsInput")} />
                            <p className="text-xs text-slate-400">Leave blank to scan common ports.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="timeoutMs">Timeout per host (ms)</Label>
                            <Input id="timeoutMs" type="number" min={100} max={10000} {...register("timeoutMs", { valueAsNumber: true })} />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <input type="checkbox" id="portScan" {...register("portScan")} className="h-4 w-4 rounded border-slate-300 text-purple-600" />
                        <div>
                            <Label htmlFor="portScan" className="cursor-pointer">Enable Port Scanning</Label>
                            <p className="text-xs text-slate-400">Detect open services and identify device types.</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsScanModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-purple-600 hover:bg-purple-700 gap-2">
                            <ScanLine className="h-4 w-4" /> Start Scan
                        </Button>
                    </div>
                </form>
        {ConfirmDialog}
            </Modal>
        </div>
    );
}
