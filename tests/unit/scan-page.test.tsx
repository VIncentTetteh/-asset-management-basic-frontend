import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import ScanPage from "@/app/scan/page";
import { nextMaintenanceDate, parseScannedAssetId } from "@/features/assets/scan";

const ASSET_ID = "7f1c2a4e-3b5d-4c6e-8f9a-0b1c2d3e4f50";

// ── Boundary mocks ───────────────────────────────────────────────────────────
const nav = vi.hoisted(() => ({ replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
    useSearchParams: () => nav.params,
}));

const auth = vi.hoisted(() => ({ value: { isReady: true, isAuthenticated: true } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/contexts/PermissionContext", () => ({ usePermission: () => true }));
vi.mock("@/contexts/CurrencyContext", () => ({ useCurrency: () => ({ baseCurrency: "GHS" }) }));

const assets = vi.hoisted(() => ({ getByQrPayload: vi.fn(), getHistory: vi.fn() }));
vi.mock("@/services/assetService", () => ({ assetService: assets }));
const maintenance = vi.hoisted(() => ({ getAll: vi.fn() }));
vi.mock("@/services/maintenanceService", () => ({ maintenanceService: maintenance }));
vi.mock("@/services/categoryService", () => ({ categoryService: { get: async () => ({ name: "Laptops" }) } }));
vi.mock("@/services/locationService", () => ({ locationService: { get: async () => ({ name: "Accra HQ" }) } }));
vi.mock("@/services/departmentService", () => ({ departmentService: { get: async () => ({ name: "Finance" }) } }));
vi.mock("@/services/userService", () => ({
    userService: { get: async () => ({ firstName: "Ama", lastName: "Mensah", email: "ama@example.com" }) },
}));

const httpError = (status: number): AxiosError => {
    const config = { headers: new AxiosHeaders() };
    const response = { status, statusText: "", data: {}, headers: {}, config } as AxiosResponse;
    return new AxiosError(String(status), "ERR_BAD_REQUEST", config, null, response);
};

function renderScan(query: string) {
    nav.params = new URLSearchParams(query);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <ScanPage />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    auth.value = { isReady: true, isAuthenticated: true };
    assets.getByQrPayload.mockResolvedValue({
        id: ASSET_ID,
        name: "MacBook Pro 14",
        assetTag: "AST-0042",
        status: "IN_USE",
        condition: "GOOD",
        categoryId: "c1",
        locationId: "l1",
        departmentId: "d1",
        assignedUserId: "u1",
        purchaseCost: 25000,
        currency: "GHS",
        currentBookValue: 18000,
        warrantyExpiryDate: "2027-03-01",
    });
    assets.getHistory.mockResolvedValue([
        { id: "h1", assetId: ASSET_ID, eventType: "asset.created", occurredAt: "2026-01-01T00:00:00Z" },
    ]);
    maintenance.getAll.mockResolvedValue([]);
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("ScanPage", () => {
    it("sends a signed-out visitor to login with the scan link as next", async () => {
        auth.value = { isReady: true, isAuthenticated: false };
        renderScan(`a=${ASSET_ID}`);
        await waitFor(() =>
            expect(nav.replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent(`/scan?a=${ASSET_ID}`)}`),
        );
        expect(assets.getByQrPayload).not.toHaveBeenCalled();
    });

    it("shows the asset summary when found", async () => {
        renderScan(`a=${ASSET_ID}`);
        expect(await screen.findByRole("heading", { name: "MacBook Pro 14" })).toBeTruthy();
        expect(assets.getByQrPayload).toHaveBeenCalledWith(ASSET_ID);
        expect(screen.getByText("AST-0042")).toBeTruthy();
        expect(await screen.findByText("Laptops")).toBeTruthy();
        expect(await screen.findByText("Ama Mensah")).toBeTruthy();
        expect(await screen.findByText("Asset Created")).toBeTruthy();
        const open = screen.getByRole("link", { name: /Open full asset/ });
        expect(open.getAttribute("href")).toContain(`id=${ASSET_ID}`);
    });

    it.each([404, 403])("shows the not-found message on %i", async (status) => {
        assets.getByQrPayload.mockRejectedValue(httpError(status));
        renderScan(`a=${ASSET_ID}`);
        expect(await screen.findByText("Asset not found or you don't have access to it.")).toBeTruthy();
    });

    it("explains an invalid or missing id without calling the API", async () => {
        renderScan("a=not-a-uuid");
        expect(await screen.findByText("This QR code isn't a valid asset label.")).toBeTruthy();
        cleanup();
        renderScan("");
        expect(await screen.findByText("No asset in this link.")).toBeTruthy();
        expect(assets.getByQrPayload).not.toHaveBeenCalled();
    });
});

describe("scan helpers", () => {
    it("parses only UUIDs", () => {
        expect(parseScannedAssetId(` ${ASSET_ID.toUpperCase()} `)).toBe(ASSET_ID);
        expect(parseScannedAssetId("asset:123")).toBeNull();
        expect(parseScannedAssetId(null)).toBeNull();
    });

    it("picks the earliest upcoming open maintenance date", () => {
        const today = new Date("2026-09-21T00:00:00Z");
        expect(nextMaintenanceDate([
            { id: "1", assetId: "a", maintenanceType: "X", scheduledDate: "2026-12-01", status: "SCHEDULED" },
            { id: "2", assetId: "a", maintenanceType: "X", scheduledDate: "2026-10-01", status: "COMPLETED", nextDueDate: "2027-01-01" },
            { id: "3", assetId: "a", maintenanceType: "X", scheduledDate: "2026-01-01", status: "SCHEDULED" },
        ], today)).toBe("2026-12-01");
        expect(nextMaintenanceDate([], today)).toBeNull();
    });
});
