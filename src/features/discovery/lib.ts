import type { DiscoveryScanDto } from "@/types";
import { matchesFormat } from "@/lib/field-limits";

/**
 * The API reports free-text device types ("Linux Server", "Windows
 * Workstation/Server", "Database Server", "Web Server", "Linux Device",
 * "Network Device"); the page's icon map is keyed by a small vocabulary. Maps
 * one onto the other, falling back to port hints when no type was inferred.
 */
export function deviceTypeKey(deviceType: string | null | undefined, openPorts: number[] | null | undefined): string {
  const t = (deviceType ?? "").toUpperCase();
  if (t) {
    if (t.includes("WORKSTATION") || t.includes("WINDOWS")) return "WORKSTATION";
    if (t.includes("SERVER")) return "SERVER";
    if (t.includes("PRINTER")) return "PRINTER";
    if (t.includes("ROUTER") || t.includes("NETWORK")) return "ROUTER";
    if (t.includes("LINUX")) return "SERVER";
    const direct = t.replace(/\s+/g, "_");
    return direct;
  }
  const ports = openPorts ?? [];
  if (ports.includes(3389) || ports.includes(5985)) return "WORKSTATION";
  if (ports.some((p) => [3306, 5432, 1433, 1521].includes(p))) return "SERVER";
  if (ports.includes(22) && ports.includes(80)) return "SERVER";
  if (ports.includes(9100)) return "PRINTER";
  if (ports.includes(161)) return "ROUTER";
  return "UNKNOWN";
}

export interface ScanForm {
  cidrRange?: string | null;
  ipAddressesInput?: string;
  portsInput?: string;
  portScan?: boolean;
  timeoutMs?: number;
}

/** The API scans at most this many ports per request. */
export const MAX_SCAN_PORTS = 32;
const MAX_PORT = 65535;

/**
 * Parses the comma-separated ports input. Every token must be a whole number
 * 1-65535 (a bad token is an error, not silently dropped), duplicates collapse,
 * and at most {@link MAX_SCAN_PORTS} distinct ports are allowed.
 */
export function parsePorts(input: string | undefined): { ports: number[] } | { error: string } {
  const tokens = (input ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const ports: number[] = [];
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) return { error: `"${token}" is not a port number` };
    const port = Number(token);
    if (port < 1 || port > MAX_PORT) return { error: `Port ${token} is outside 1-${MAX_PORT}` };
    if (!ports.includes(port)) ports.push(port);
  }
  if (ports.length > MAX_SCAN_PORTS) return { error: `At most ${MAX_SCAN_PORTS} ports per scan (${ports.length} given)` };
  return { ports };
}

/** The API scans at most this many hosts per request (a /24). */
export const MAX_SCAN_HOSTS = 256;

/**
 * react-hook-form rule for the CIDR input. The same shape the API enforces
 * (NetworkScanRequestDto.IPV4_CIDR): the range used to be checked server-side
 * only, so a typo came back as a bare 400 with nothing marked.
 */
export const validateCidrInput = (input: string | null | undefined): true | string =>
  matchesFormat(input, "ipv4Cidr") || "Enter an IPv4 range such as 192.168.1.0/24";

/** react-hook-form rule for the IP list: every line must be an IPv4 address. */
export const validateIpListInput = (input: string | undefined): true | string => {
  const ips = (input ?? "").split(/[\n,]/).map((ip) => ip.trim()).filter(Boolean);
  const bad = ips.find((ip) => !matchesFormat(ip, "ipv4"));
  if (bad) return `"${bad}" is not an IPv4 address`;
  if (ips.length > MAX_SCAN_HOSTS) return `At most ${MAX_SCAN_HOSTS} addresses per scan (${ips.length} given)`;
  return true;
};

/** react-hook-form rule for the ports input: true, or the first problem. */
export const validatePortsInput = (input: string | undefined): true | string => {
  const parsed = parsePorts(input);
  return "error" in parsed ? parsed.error : true;
};

/** Individual IPs win over the CIDR range; the API caps a scan at 256 hosts and 32 ports. */
export function buildScanPayload(form: ScanForm): DiscoveryScanDto {
  const ips = (form.ipAddressesInput ?? "").split(/[\n,]/).map((ip) => ip.trim()).filter(Boolean);
  const parsed = parsePorts(form.portsInput);
  // The form blocks invalid ports before submit; never send a partial list.
  const ports = "ports" in parsed ? parsed.ports : [];
  const payload: DiscoveryScanDto = {
    cidrRange: ips.length ? null : form.cidrRange?.trim() || null,
    portScan: !!form.portScan,
    timeoutMs: Number.isFinite(form.timeoutMs) ? form.timeoutMs : 1000,
  };
  if (ips.length) payload.ipAddresses = ips;
  if (ports.length) payload.ports = ports;
  return payload;
}

/**
 * Where a discovered row links: the asset it was promoted to, or nothing. A
 * device keeps its asset link across rescans (the API keeps it PROMOTED).
 */
export function promotedAssetHref(device: { promotedAssetId?: string | null }): string | null {
  return device.promotedAssetId ? `/assets?id=${encodeURIComponent(device.promotedAssetId)}` : null;
}

/** Promote is offered only for devices not already linked to an asset. */
export function canPromoteDevice(device: { status?: string | null; promotedAssetId?: string | null }): boolean {
  return device.status !== "PROMOTED" && !device.promotedAssetId;
}

/** Device status buckets; GET /devices?status= and /summary use the same ones. */
export const DEVICE_STATUS_FILTERS = ["ALL", "ONLINE", "OFFLINE", "PROMOTED", "UNKNOWN"] as const;
export type DeviceStatusFilter = (typeof DEVICE_STATUS_FILTERS)[number];

/** The count shown on a status chip, from the server-side summary (not the loaded page). */
export function deviceStatusCount(
  summary: { total: number; online: number; offline: number; promoted: number; unknown?: number } | null,
  status: DeviceStatusFilter,
): number | undefined {
  if (!summary) return undefined;
  switch (status) {
    case "ALL": return summary.total;
    case "ONLINE": return summary.online;
    case "OFFLINE": return summary.offline;
    case "PROMOTED": return summary.promoted;
    case "UNKNOWN": return summary.unknown ?? Math.max(0, summary.total - summary.online - summary.offline - summary.promoted);
  }
}

export interface PromoteForm {
  name: string;
  categoryId: string;
  locationId: string;
}

/** The promote dialog's starting values: the device's hostname, else its IP. */
export function promoteDefaults(device: { hostname?: string | null; ipAddress: string }): PromoteForm {
  return { name: device.hostname?.trim() || device.ipAddress, categoryId: "", locationId: "" };
}

/** POST /discovery/devices/{id}/promote body; blank choices are omitted. */
export function buildPromotePayload(form: PromoteForm): { name?: string; categoryId?: string; locationId?: string } {
  const body: { name?: string; categoryId?: string; locationId?: string } = {};
  if (form.name.trim()) body.name = form.name.trim();
  if (form.categoryId) body.categoryId = form.categoryId;
  if (form.locationId) body.locationId = form.locationId;
  return body;
}
