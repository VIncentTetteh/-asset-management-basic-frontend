import type { DiscoveryScanDto } from "@/types";

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

/** Individual IPs win over the CIDR range; the API caps a scan at 256 hosts and 32 ports. */
export function buildScanPayload(form: ScanForm): DiscoveryScanDto {
  const ips = (form.ipAddressesInput ?? "").split(/[\n,]/).map((ip) => ip.trim()).filter(Boolean);
  const ports = (form.portsInput ?? "")
    .split(",")
    .map((p) => parseInt(p.trim(), 10))
    .filter((n) => Number.isInteger(n));
  const payload: DiscoveryScanDto = {
    cidrRange: ips.length ? null : form.cidrRange?.trim() || null,
    portScan: !!form.portScan,
    timeoutMs: Number.isFinite(form.timeoutMs) ? form.timeoutMs : 1000,
  };
  if (ips.length) payload.ipAddresses = ips;
  if (ports.length) payload.ports = ports;
  return payload;
}
