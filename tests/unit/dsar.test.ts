import { describe, expect, it } from "vitest";
import { dsarNextStatuses, isDsarClosed } from "@/features/dpa/dsar";

describe("DSAR status moves", () => {
    it("treats completed and rejected as final", () => {
        expect(isDsarClosed("COMPLETED")).toBe(true);
        expect(isDsarClosed("REJECTED")).toBe(true);
        expect(dsarNextStatuses("COMPLETED")).toEqual([]);
    });

    it("lets an open request move to any other API status", () => {
        expect(dsarNextStatuses("PENDING")).toEqual(["IN_PROGRESS", "COMPLETED", "REJECTED"]);
        expect(dsarNextStatuses("IN_PROGRESS")).toEqual(["PENDING", "COMPLETED", "REJECTED"]);
    });
});
