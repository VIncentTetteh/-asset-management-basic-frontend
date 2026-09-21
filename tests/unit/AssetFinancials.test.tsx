import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AssetFinancials } from "@/features/assets/AssetFinancials";
import { AssetStatsRow } from "@/features/assets/AssetStatsRow";
import type { Asset } from "@/types";

const assets = vi.hoisted(() => ({ getTco: vi.fn() }));
vi.mock("@/services/assetService", () => ({ assetService: assets }));

function renderWithQuery(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

const depreciating: Asset = {
    id: "a1",
    name: "Laptop",
    currency: "GHS",
    purchaseCost: 1200,
    purchaseDate: "2026-01-15",
    currentBookValue: 900,
    accumulatedDepreciation: 300,
    monthlyDepreciation: 100,
    depreciationConfigured: true,
    fullyDepreciated: false,
    effectiveDepreciationMethod: "STRAIGHT_LINE",
    effectiveUsefulLifeMonths: 12,
    effectiveResidualValue: 0,
};

describe("AssetFinancials", () => {
    it("shows book value, depreciation and the TCO breakdown in the asset currency", async () => {
        assets.getTco.mockResolvedValue({
            acquisitionCost: 1200, totalMaintenanceCost: 150, totalInsuranceCost: 50, totalDowntimeCost: 0,
            disposalRecovery: 0, netTco: 1400, currency: "GHS", maintenanceRecordCount: 2, downtimeDays: 0,
        });

        renderWithQuery(<AssetFinancials asset={depreciating} />);

        const valueOf = (label: string) => screen.getByText(label).nextSibling?.textContent ?? "";
        expect(valueOf("Current book value")).toMatch(/900\.00/);
        expect(valueOf("Accumulated depreciation")).toMatch(/300\.00/);
        expect(valueOf("Monthly depreciation")).toMatch(/100\.00/);
        expect(screen.getByText("Straight-line")).toBeTruthy();
        expect(await screen.findByText("Maintenance (2 records)")).toBeTruthy();
        expect(valueOf("Net TCO")).toMatch(/1,400\.00/);
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("prompts for setup when depreciation is not configured", () => {
        assets.getTco.mockReturnValue(new Promise(() => {}));
        renderWithQuery(
            <AssetFinancials
                asset={{ ...depreciating, depreciationConfigured: false, currentBookValue: 1200 }}
                category={{ id: "c1", name: "Furniture" }}
            />,
        );

        expect(screen.getByRole("status").textContent).toContain("Depreciation isn't configured");
        expect(screen.getByRole("link", { name: "assign a depreciation policy" }).getAttribute("href")).toBe("/categories");
        expect(screen.getByText("Furniture")).toBeTruthy();
    });
});

describe("AssetStatsRow", () => {
    it("labels the value tile as register-wide", () => {
        render(<AssetStatsRow stats={{ total: 3, inUse: 1, inStock: 1, maintenance: 1, retired: 0, disposed: 0,
            reserved: 0, missing: 0, assigned: 1, unassigned: 2 }} totalValueLabel="GHS 3,300.00" />);
        expect(screen.getByText("Register value")).toBeTruthy();
        expect(screen.queryByText("Page value")).toBeNull();
        expect(screen.getByText("GHS 3,300.00")).toBeTruthy();
    });
});
