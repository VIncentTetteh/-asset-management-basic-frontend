import { describe, expect, it } from "vitest";
import {
    buildMaintenancePayload,
    canCompleteMaintenance,
    defaultMaintenanceCurrency,
} from "@/features/maintenance/payload";

describe("maintenance payload", () => {
    const form = {
        assetId: "a1",
        maintenanceType: "CORRECTIVE",
        status: "IN_PROGRESS",
        description: "Replace fan",
        scheduledDate: "2026-09-01",
        performedDate: "",
        nextDueDate: "2027-03-01",
        cost: "120.50",
        currency: "GHS",
        vendorId: "v1",
    };

    it("sends every field so a PUT keeps untouched values", () => {
        expect(buildMaintenancePayload(form)).toEqual({
            assetId: "a1",
            maintenanceType: "CORRECTIVE",
            status: "IN_PROGRESS",
            description: "Replace fan",
            scheduledDate: "2026-09-01",
            performedDate: null,
            nextDueDate: "2027-03-01",
            cost: 120.5,
            currency: "GHS",
            vendorId: "v1",
        });
    });

    it("sends null for cleared optional fields so the vendor can be removed", () => {
        const body = buildMaintenancePayload({ ...form, vendorId: "", description: " ", cost: "" });
        expect(body.vendorId).toBeNull();
        expect(body.description).toBeNull();
        expect(body.cost).toBeNull();
    });

    it("defaults the currency to the asset's, then the base currency", () => {
        expect(defaultMaintenanceCurrency({ currency: "EUR" }, "GHS")).toBe("EUR");
        expect(defaultMaintenanceCurrency({ currency: undefined }, "GHS")).toBe("GHS");
        expect(defaultMaintenanceCurrency(undefined, "GHS")).toBe("GHS");
    });

    it("only offers Mark done on open work", () => {
        expect(canCompleteMaintenance("SCHEDULED")).toBe(true);
        expect(canCompleteMaintenance("IN_PROGRESS")).toBe(true);
        expect(canCompleteMaintenance("COMPLETED")).toBe(false);
        expect(canCompleteMaintenance("CANCELLED")).toBe(false);
    });
});

describe("maintenance defaults", () => {
    it("fills today's completion date when saved as completed without one", async () => {
        const { todayLocal } = await import("@/lib/local-date");
        const body = buildMaintenancePayload({ assetId: "a1", maintenanceType: "ROUTINE", status: "COMPLETED", scheduledDate: "2026-09-01" });
        expect(body.performedDate).toBe(todayLocal());
        const open = buildMaintenancePayload({ assetId: "a1", maintenanceType: "ROUTINE", status: "SCHEDULED", scheduledDate: "2026-09-01" });
        expect(open.performedDate).toBeNull();
    });

    it("offers only assets that can still take maintenance, keeping the record's own asset", async () => {
        const { maintainableAssets } = await import("@/features/maintenance/payload");
        const assets = [
            { id: "a", status: "IN_USE" }, { id: "b", status: "DISPOSED" }, { id: "c", status: "RETIRED" },
        ];
        expect(maintainableAssets(assets).map((a) => a.id)).toEqual(["a"]);
        expect(maintainableAssets(assets, "c").map((a) => a.id)).toEqual(["a", "c"]);
    });
});
