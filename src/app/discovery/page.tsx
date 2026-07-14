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
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import {
    ScanLine, Trash2, ArrowUpRight, Wifi, WifiOff, CheckCircle2,
    Server, Monitor, Printer, Smartphone, Router, HardDrive, Globe,
    RefreshCw, ChevronDown, ChevronUp, Shield, Clock, Tag, Network,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";

// ── Port → Service map ────────────────────────────────────────────────────────

const PORT_SERVICES: Record<number, { name: string; color: string }> = {
    21:   { name: "FTP",     color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300" },
    22:   { name: "SSH",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    23:   { name: "Telnet",  color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
    25:   { name: "SMTP",    color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
    53:   { name: "DNS",     color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
    80:   { name: "HTTP",    color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
    110:  { name: "POP3",    color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
    143:  { name: "IMAP",    color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
    161:  { name: "SNMP",    color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
    389:  { name: "LDAP",    color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
    443:  { name: "HTTPS",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    445:  { name: "SMB",     color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
    514:  { name: "Syslog",  color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300" },
    636:  { name: "LDAPS",   color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
    993:  { name: "IMAPS",   color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
    995:  { name: "POP3S",   color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
    1433: { name: "MSSQL",   color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
    1521: { name: "Oracle",  color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
    3306: { name: "MySQL",   color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
    3389: { name: "RDP",     color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
    5432: { name: "PostgreSQL", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
    5900: { name: "VNC",     color: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300" },
    5985: { name: "WinRM",   color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300" },
    6379: { name: "Redis",   color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
    8080: { name: "HTTP-alt",color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
    8443: { name: "HTTPS-alt",color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    9200: { name: "Elastic", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
    27017:{ name: "MongoDB", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

const getPortService = (port: number) =>
    PORT_SERVICES[port] ?? { name: `Port ${port}`, color: "bg-surface-muted text-faint-fg" };

// ── Device type meta ──────────────────────────────────────────────────────────

const DEVICE_TYPE_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    SERVER:      { icon: <Server className="h-5 w-5" />,    label: "Server",      color: "text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-500/15" },
    WORKSTATION: { icon: <Monitor className="h-5 w-5" />,   label: "Workstation", color: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-500/15" },
    LAPTOP:      { icon: <Monitor className="h-5 w-5" />,   label: "Laptop",      color: "text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/15" },
    PRINTER:     { icon: <Printer className="h-5 w-5" />,   label: "Printer",     color: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15" },
    MOBILE:      { icon: <Smartphone className="h-5 w-5" />,label: "Mobile",      color: "text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-500/15" },
    ROUTER:      { icon: <Router className="h-5 w-5" />,    label: "Router",      color: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15" },
    SWITCH:      { icon: <Network className="h-5 w-5" />,   label: "Switch",      color: "text-teal-700 bg-teal-100 dark:text-teal-300 dark:bg-teal-500/15" },
    NAS:         { icon: <HardDrive className="h-5 w-5" />, label: "NAS",         color: "text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-500/15" },
    FIREWALL:    { icon: <Shield className="h-5 w-5" />,    label: "Firewall",    color: "text-danger bg-danger-soft" },
    IOT:         { icon: <Globe className="h-5 w-5" />,     label: "IoT Device",  color: "text-cyan-700 bg-cyan-100 dark:text-cyan-300 dark:bg-cyan-500/15" },
    UNKNOWN:     { icon: <Wifi className="h-5 w-5" />,      label: "Unknown",     color: "text-faint-fg bg-surface-muted" },
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
        <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">
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

const STATUS_BADGE: Record<string, string> = {
    ONLINE: "bg-ok-soft text-ok border-ok/30",
    OFFLINE: "bg-surface-muted text-faint-fg border-edge-subtle",
    PROMOTED: "bg-info-soft text-info border-info/30",
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
            <PageHeader
                title="IT Asset Discovery"
                subtitle={
                    lastScanned
                        ? `Scan your network to discover, inspect, and onboard IT assets. Last scanned ${timeSince(lastScanned.toISOString())}`
                        : "Scan your network to discover, inspect, and onboard IT assets."
                }
                actions={<>
                    <Button variant="outline" onClick={() => fetchDevices(page)} className="gap-2">
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                    <Button onClick={() => setIsScanModalOpen(true)} className="gap-2">
                        <ScanLine className="h-4 w-4" /> Scan Network
                    </Button>
                </>}
            />

            {summary && (
                <div className="grid gap-4 md:grid-cols-4">
                    {[
                        { label: "Total Discovered", value: summary.total, icon: <ScanLine className="h-5 w-5" />, color: "bg-info-soft text-info" },
                        { label: "Online", value: summary.online, icon: <Wifi className="h-5 w-5" />, color: "bg-ok-soft text-ok" },
                        { label: "Offline", value: summary.offline, icon: <WifiOff className="h-5 w-5" />, color: "bg-surface-muted text-faint-fg" },
                        { label: "Promoted to Assets", value: summary.promoted, icon: <CheckCircle2 className="h-5 w-5" />, color: "bg-brand-soft text-brand" },
                    ].map(item => (
                        <Card key={item.label}>
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className={cn("rounded-control p-2", item.color)}>{item.icon}</div>
                                <div>
                                    <p className="text-xs text-faint-fg">{item.label}</p>
                                    <p className="data-mono text-2xl font-black text-foreground">{item.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Card>
                <CardHeader className="border-b border-edge-subtle bg-surface-muted/50 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <CardTitle className="text-base font-semibold text-foreground">
                            {filteredDevices.length} device{filteredDevices.length !== 1 ? "s" : ""}
                            {statusFilter !== "ALL" && ` · ${statusFilter.toLowerCase()}`}
                        </CardTitle>

                        <div className="flex gap-1 rounded-control border border-edge-subtle bg-surface p-1">
                            {(["ALL", "ONLINE", "OFFLINE", "PROMOTED"] as const).map(s => (
                                <button key={s} onClick={() => setStatusFilter(s)}
                                    className={cn(
                                        "rounded-control px-3 py-1 text-xs font-semibold transition-colors",
                                        statusFilter === s ? "bg-brand text-white" : "text-muted-fg hover:text-foreground",
                                    )}>
                                    {s} <span className="ml-1 opacity-60">({statusCounts[s]})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex h-48 items-center justify-center">
                            <PageSpinner />
                        </div>
                    ) : filteredDevices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <ScanLine className="mb-4 h-12 w-12 text-faint-fg" />
                            <h3 className="text-lg font-semibold text-foreground">
                                {devices.length === 0 ? "No devices discovered yet" : `No ${statusFilter.toLowerCase()} devices`}
                            </h3>
                            <p className="mt-1 max-w-sm text-muted-fg">
                                {devices.length === 0
                                    ? "Run a network scan to discover IT assets on your network."
                                    : `Try selecting a different status filter.`}
                            </p>
                            {devices.length === 0 && (
                                <Button onClick={() => setIsScanModalOpen(true)} className="mt-4 gap-2">
                                    <ScanLine className="h-4 w-4" /> Start Scan
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border-subtle)]">
                            {filteredDevices.map(device => {
                                const inferredType = inferDeviceType(device);
                                const devMeta = getDeviceMeta(inferredType);
                                const ports = device.openPorts ?? [];
                                const isExpanded = expandedId === device.id;

                                return (
                                    <div key={device.id} className="transition-colors hover:bg-surface-muted/50">
                                        <div className="flex items-center gap-3 p-4">
                                            <div className={cn("shrink-0 rounded-xl p-2", devMeta.color)}>
                                                {devMeta.icon}
                                            </div>

                                            <div className="w-36 min-w-0 shrink-0">
                                                <p className="data-mono text-sm font-bold text-foreground">{device.ipAddress}</p>
                                                <p className="truncate text-xs text-faint-fg">{device.hostname || "No hostname"}</p>
                                            </div>

                                            <div className="hidden w-32 min-w-0 shrink-0 sm:block">
                                                <p className="text-xs font-semibold text-muted-fg">{devMeta.label}</p>
                                                <p className="data-mono text-[10px] text-faint-fg">{device.macAddress || "—"}</p>
                                            </div>

                                            <div className="hidden min-w-0 flex-1 md:block">
                                                {ports.length === 0 ? (
                                                    <span className="text-xs text-faint-fg">No open ports</span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {ports.slice(0, 6).map(port => {
                                                            const svc = getPortService(port);
                                                            return (
                                                                <span key={port} className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", svc.color)} title={`Port ${port}`}>
                                                                    {svc.name}
                                                                </span>
                                                            );
                                                        })}
                                                        {ports.length > 6 && (
                                                            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-faint-fg">
                                                                +{ports.length - 6}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {riskBadge(ports)}
                                            </div>

                                            <div className="hidden w-24 shrink-0 text-right lg:block">
                                                <p className="text-xs text-faint-fg">
                                                    {device.lastSeenAt ? timeSince(device.lastSeenAt) : "—"}
                                                </p>
                                            </div>

                                            <div className="shrink-0">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold",
                                                    STATUS_BADGE[device.status] ?? "border-edge-subtle bg-surface-muted text-faint-fg",
                                                )}>
                                                    {device.status === "ONLINE" ? <Wifi className="h-3 w-3" /> :
                                                     device.status === "OFFLINE" ? <WifiOff className="h-3 w-3" /> :
                                                     <CheckCircle2 className="h-3 w-3" />}
                                                    {device.status}
                                                </span>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-1">
                                                <button onClick={() => setExpandedId(isExpanded ? null : device.id)}
                                                    className="rounded-control p-1.5 text-faint-fg transition-colors hover:bg-surface-muted hover:text-foreground">
                                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </button>
                                                {device.status !== "PROMOTED" && (
                                                    <Button variant="outline" size="sm" onClick={() => handlePromote(device.id)}
                                                        isLoading={promotingId === device.id}
                                                        className="h-7 border-brand/30 px-2 text-xs text-brand hover:bg-brand-soft">
                                                        <ArrowUpRight className="mr-1 h-3 w-3" /> Promote
                                                    </Button>
                                                )}
                                                <button onClick={() => handleDelete(device.id)}
                                                    className="rounded-control p-1.5 text-danger/70 transition-colors hover:bg-danger-soft hover:text-danger">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="grid gap-4 border-t border-edge-subtle bg-surface-muted/60 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
                                                <div className="space-y-2">
                                                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-faint-fg">
                                                        <Network className="h-3 w-3" /> Network
                                                    </p>
                                                    <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-faint-fg">IP Address</span>
                                                            <span className="data-mono font-semibold text-foreground">{device.ipAddress}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-faint-fg">MAC Address</span>
                                                            <span className="data-mono text-muted-fg">{device.macAddress || "Unknown"}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-faint-fg">Hostname</span>
                                                            <span className="font-medium text-muted-fg">{device.hostname || "Not resolved"}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-faint-fg">
                                                        <Tag className="h-3 w-3" /> Device Info
                                                    </p>
                                                    <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-faint-fg">Device Type</span>
                                                            <span className="font-medium text-muted-fg">{devMeta.label}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-faint-fg">OS / Platform</span>
                                                            <span className="font-medium text-muted-fg">{(device as any).os || "Unknown"}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-faint-fg">Vendor / OUI</span>
                                                            <span className="font-medium text-muted-fg">{(device as any).vendor || "Unknown"}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-faint-fg">
                                                        <Globe className="h-3 w-3" /> Open Services ({ports.length})
                                                    </p>
                                                    {ports.length === 0 ? (
                                                        <p className="text-xs text-faint-fg">No open ports detected</p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {ports.map(port => {
                                                                const svc = getPortService(port);
                                                                return (
                                                                    <span key={port} className={cn("inline-flex flex-col items-center rounded px-2 py-1 text-[10px] font-bold", svc.color)}>
                                                                        <span>{svc.name}</span>
                                                                        <span className="font-normal opacity-70">{port}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-faint-fg">
                                                        <Clock className="h-3 w-3" /> Scan Timing
                                                    </p>
                                                    <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-faint-fg">Last Seen</span>
                                                            <span className="font-medium text-muted-fg">
                                                                {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "—"}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-faint-fg">Status</span>
                                                            <span className={cn("text-xs font-bold", device.status === "ONLINE" ? "text-ok" : device.status === "PROMOTED" ? "text-info" : "text-faint-fg")}>
                                                                {device.status}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {ports.some(p => [23, 21, 5900].includes(p)) && (
                                                        <div className="mt-2 rounded-control border border-danger/30 bg-danger-soft p-2">
                                                            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold text-danger">
                                                                <Shield className="h-3 w-3" /> Security Risks
                                                            </p>
                                                            <ul className="space-y-0.5">
                                                                {ports.includes(23) && <li className="text-[10px] text-danger">· Telnet (port 23) — unencrypted</li>}
                                                                {ports.includes(21) && <li className="text-[10px] text-danger">· FTP (port 21) — unencrypted</li>}
                                                                {ports.includes(5900) && <li className="text-[10px] text-danger">· VNC (port 5900) — exposed desktop</li>}
                                                                {ports.includes(3389) && <li className="text-[10px] text-warn">· RDP (port 3389) — verify access controls</li>}
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

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-edge-subtle px-4 py-3">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
                            <span className="text-sm text-muted-fg">Page {page + 1} of {totalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal isOpen={isScanModalOpen} onClose={() => setIsScanModalOpen(false)}
                title="Scan Network" description="Configure and run a network discovery scan to find IT assets.">
                <form onSubmit={handleSubmit(onScan)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cidrRange">CIDR Range</Label>
                        <Input id="cidrRange" placeholder="192.168.1.0/24" {...register("cidrRange")} />
                        <p className="text-xs text-faint-fg">Common ranges: 10.0.0.0/24, 172.16.0.0/24, 192.168.1.0/24. Leave blank to use individual IPs below.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="ipAddressesInput">Individual IP Addresses (one per line)</Label>
                        <textarea id="ipAddressesInput" rows={3}
                            placeholder={"192.168.1.10\n192.168.1.11\n10.0.0.5"}
                            className="ea-focus data-mono w-full rounded-control border border-edge bg-surface px-3 py-2 text-sm text-foreground placeholder:text-faint-fg"
                            {...register("ipAddressesInput")} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="portsInput">Ports (comma-separated)</Label>
                            <Input id="portsInput" placeholder="22,80,443,3389,3306" {...register("portsInput")} />
                            <p className="text-xs text-faint-fg">Leave blank to scan common ports.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="timeoutMs">Timeout per host (ms)</Label>
                            <Input id="timeoutMs" type="number" min={100} max={10000} {...register("timeoutMs", { valueAsNumber: true })} />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-control border border-edge-subtle bg-surface-muted p-3">
                        <input type="checkbox" id="portScan" {...register("portScan")} className="h-4 w-4 rounded border-edge accent-[var(--primary)]" />
                        <div>
                            <Label htmlFor="portScan" className="cursor-pointer">Enable Port Scanning</Label>
                            <p className="text-xs text-faint-fg">Detect open services and identify device types.</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsScanModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="gap-2">
                            <ScanLine className="h-4 w-4" /> Start Scan
                        </Button>
                    </div>
                </form>
            </Modal>
            {ConfirmDialog}
        </div>
    );
}
