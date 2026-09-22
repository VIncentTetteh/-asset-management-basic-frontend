import { describe, expect, it } from "vitest";
import { timeZoneOptions } from "@/lib/time-zones";

describe("timeZoneOptions", () => {
    it("lists IANA zones with UTC first", () => {
        const zones = timeZoneOptions();
        expect(zones[0]).toBe("UTC");
        expect(zones).toContain("Africa/Accra");
        expect(new Set(zones).size).toBe(zones.length);
    });

    it("keeps a stored value the runtime does not list", () => {
        expect(timeZoneOptions("Legacy/Zone")).toContain("Legacy/Zone");
    });
});
