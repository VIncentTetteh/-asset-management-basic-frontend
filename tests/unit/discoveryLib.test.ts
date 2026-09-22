import { describe, expect, it } from "vitest";
import { buildScanPayload, canPromoteDevice, deviceTypeKey, promotedAssetHref } from "@/features/discovery/lib";

describe("discovery helpers", () => {
    it("maps the API's free-text device types onto the icon vocabulary", () => {
        expect(deviceTypeKey("Linux Server", [])).toBe("SERVER");
        expect(deviceTypeKey("Windows Workstation/Server", [])).toBe("WORKSTATION");
        expect(deviceTypeKey("Database Server", [])).toBe("SERVER");
        expect(deviceTypeKey("Network Device", [])).toBe("ROUTER");
        expect(deviceTypeKey(null, [3389])).toBe("WORKSTATION");
        expect(deviceTypeKey(undefined, [])).toBe("UNKNOWN");
    });

    it("prefers individual IPs over the range and parses ports", () => {
        expect(buildScanPayload({ cidrRange: "10.0.0.0/24", ipAddressesInput: "10.0.0.5\n 10.0.0.6 ", portsInput: "22, 443,22", portScan: true, timeoutMs: 800 })).toEqual({
            cidrRange: null,
            ipAddresses: ["10.0.0.5", "10.0.0.6"],
            ports: [22, 443],
            portScan: true,
            timeoutMs: 800,
        });
        expect(buildScanPayload({ cidrRange: " 192.168.1.0/24 ", portScan: false, timeoutMs: Number.NaN })).toEqual({
            cidrRange: "192.168.1.0/24",
            portScan: false,
            timeoutMs: 1000,
        });
    });
});

describe("promoted devices", () => {
    it("link to their asset and are never offered Promote again", () => {
        const d = { status: "ONLINE", promotedAssetId: "a-1" };
        expect(promotedAssetHref(d)).toBe("/assets?id=a-1");
        expect(canPromoteDevice(d)).toBe(false);
    });

    it("an unpromoted device has no link and can be promoted", () => {
        const d = { status: "ONLINE", promotedAssetId: null };
        expect(promotedAssetHref(d)).toBeNull();
        expect(canPromoteDevice(d)).toBe(true);
        expect(canPromoteDevice({ status: "PROMOTED" })).toBe(false);
    });
});

describe("scan ports input", () => {
    it("rejects bad tokens, out-of-range ports and more than 32 ports instead of dropping them", async () => {
        const { parsePorts, validatePortsInput } = await import("@/features/discovery/lib");
        expect(parsePorts("22, 443")).toEqual({ ports: [22, 443] });
        expect(parsePorts("")).toEqual({ ports: [] });
        expect(validatePortsInput("22,x")).toBe('"x" is not a port number');
        expect(validatePortsInput("0")).toMatch(/outside 1-65535/);
        expect(validatePortsInput("65536")).toMatch(/outside 1-65535/);
        expect(validatePortsInput("22.5")).toMatch(/not a port number/);
        const many = Array.from({ length: 33 }, (_, i) => i + 1).join(",");
        expect(validatePortsInput(many)).toMatch(/At most 32/);
        expect(validatePortsInput("22,80")).toBe(true);
    });
});

describe("device status filter and promote", () => {
    it("counts chips from the summary so they match the server-side filter", async () => {
        const { deviceStatusCount } = await import("@/features/discovery/lib");
        const summary = { total: 10, online: 4, offline: 3, promoted: 2, unknown: 1 };
        expect(deviceStatusCount(summary, "ALL")).toBe(10);
        expect(deviceStatusCount(summary, "UNKNOWN")).toBe(1);
        expect(deviceStatusCount({ total: 10, online: 4, offline: 3, promoted: 2 }, "UNKNOWN")).toBe(1);
        expect(deviceStatusCount(null, "ONLINE")).toBeUndefined();
    });

    it("defaults the asset name to the hostname, else the IP, and omits blank choices", async () => {
        const { promoteDefaults, buildPromotePayload } = await import("@/features/discovery/lib");
        expect(promoteDefaults({ hostname: "printer-3f", ipAddress: "10.0.0.7" }).name).toBe("printer-3f");
        expect(promoteDefaults({ hostname: null, ipAddress: "10.0.0.7" }).name).toBe("10.0.0.7");
        expect(buildPromotePayload({ name: " Printer ", categoryId: "c1", locationId: "" }))
            .toEqual({ name: "Printer", categoryId: "c1" });
    });
});
