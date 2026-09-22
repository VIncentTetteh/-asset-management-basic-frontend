import { afterEach, describe, expect, it, vi } from "vitest";
import { formatLocalDate, parseLocalDate, toDateInputValue, todayLocal, toLocalIsoDate } from "@/lib/local-date";

// Node re-reads process.env.TZ on assignment, so each case can pin a zone.
const ZONES = ["UTC", "America/Los_Angeles", "Pacific/Kiritimati", "Africa/Accra", "Asia/Tokyo"];
const originalTz = process.env.TZ;

afterEach(() => {
    process.env.TZ = originalTz;
    vi.useRealTimers();
});

describe.each(ZONES)("local-date in %s", (zone) => {
    it("formats a date-only value as the same calendar day", () => {
        process.env.TZ = zone;
        expect(formatLocalDate("2026-03-05", { locale: "en-GB", day: "numeric", month: "short", year: "numeric" }))
            .toBe("5 Mar 2026");
    });

    it("parses a date-only value as local midnight", () => {
        process.env.TZ = zone;
        const d = parseLocalDate("2026-01-01")!;
        expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 0, 1, 0]);
    });

    it("todayLocal is the viewer's calendar day, not the UTC one", () => {
        process.env.TZ = zone;
        vi.useFakeTimers();
        // 23:30 UTC on 31 Dec: already 1 Jan in Tokyo and Kiritimati, still 31 Dec in LA.
        vi.setSystemTime(new Date("2025-12-31T23:30:00Z"));
        const expected = new Date().getDate() === 1 ? "2026-01-01" : "2025-12-31";
        expect(todayLocal()).toBe(expected);
        expect(todayLocal()).toBe(toLocalIsoDate(new Date()));
    });

    it("keeps a date-only input value unchanged", () => {
        process.env.TZ = zone;
        expect(toDateInputValue("2026-07-09")).toBe("2026-07-09");
    });
});

describe("local-date edge cases", () => {
    it("todayLocal differs from the UTC day where it should", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2025-12-31T23:30:00Z"));
        process.env.TZ = "Asia/Tokyo";
        expect(todayLocal()).toBe("2026-01-01");
        process.env.TZ = "America/Los_Angeles";
        expect(todayLocal()).toBe("2025-12-31");
    });

    it("falls back for empty or invalid values", () => {
        expect(formatLocalDate(undefined)).toBe("—");
        expect(formatLocalDate(null, { fallback: "N/A" })).toBe("N/A");
        expect(formatLocalDate("not a date")).toBe("—");
        expect(parseLocalDate("")).toBeNull();
        expect(toDateInputValue(undefined)).toBe("");
    });

    it("shows a timestamp as its local calendar day", () => {
        process.env.TZ = "America/Los_Angeles";
        expect(toDateInputValue("2026-03-05T02:00:00Z")).toBe("2026-03-04");
        process.env.TZ = "Asia/Tokyo";
        expect(toDateInputValue("2026-03-05T20:00:00Z")).toBe("2026-03-06");
    });
});
