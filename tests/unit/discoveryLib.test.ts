import { describe, expect, it } from "vitest";
import { buildScanPayload, deviceTypeKey } from "@/features/discovery/lib";

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
        expect(buildScanPayload({ cidrRange: "10.0.0.0/24", ipAddressesInput: "10.0.0.5\n 10.0.0.6 ", portsInput: "22, 443,x", portScan: true, timeoutMs: 800 })).toEqual({
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
