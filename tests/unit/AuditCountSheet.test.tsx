import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuditCountSheet } from "@/features/audits/AuditCountSheet";
import { AuditItemStatus, AuditStatus, type Audit, type AuditItem } from "@/types";

const service = vi.hoisted(() => ({
    listItems: vi.fn(),
    generateItems: vi.fn(),
    verifyItem: vi.fn(),
    flagItemDiscrepancy: vi.fn(),
}));
vi.mock("@/services/auditService", () => ({ auditService: service }));
vi.mock("react-hot-toast", () => ({
    default: { success: vi.fn(), error: vi.fn() },
    toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);

const AUDIT_ID = "11111111-2222-3333-4444-555555555555";

const item = (over: Partial<AuditItem> = {}): AuditItem => ({
    id: "item-1",
    auditId: AUDIT_ID,
    assetId: "asset-1",
    assetTag: "AST-0001",
    assetName: "Dell Latitude",
    status: AuditItemStatus.PENDING,
    expectedLocation: "Accra HQ",
    ...over,
} as AuditItem);

const audit = (over: Partial<Audit> = {}): Audit => ({
    id: AUDIT_ID,
    auditDate: "2026-09-01",
    status: AuditStatus.IN_PROGRESS,
    totalItemCount: 2,
    verifiedItemCount: 1,
    discrepancyCount: 0,
    allItemsVerified: false,
    ...over,
} as Audit);

function renderSheet(value: Audit, items: AuditItem[] = [item()]) {
    service.listItems.mockResolvedValue({ total: items.length, limit: 20, offset: 0, items });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <AuditCountSheet audit={value} />
        </QueryClientProvider>,
    );
}

describe("audit count sheet", () => {
    it("shows the progress the API reports, and no seal until everything is verified", async () => {
        renderSheet(audit());
        expect(screen.getByTestId("audit-progress-label").textContent).toBe("1 / 2 verified");
        expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
        expect(screen.queryByLabelText("Audit-verified")).toBeNull();
        await waitFor(() => expect(service.listItems).toHaveBeenCalled());
    });

    it("shows the seal only when the API says every item is verified", () => {
        renderSheet(audit({ totalItemCount: 2, verifiedItemCount: 2, allItemsVerified: true }));
        expect(screen.getByLabelText("Audit-verified")).toBeTruthy();
    });

    it("offers to build the sheet when the audit has none", () => {
        renderSheet(audit({ totalItemCount: 0, verifiedItemCount: 0 }), []);
        expect(screen.getByTestId("audit-progress-label").textContent).toBe("No count sheet yet");
        expect(screen.getByTestId("audit-generate-items")).toBeTruthy();
    });

    it("generates the sheet on demand", async () => {
        service.generateItems.mockResolvedValue(audit({ totalItemCount: 5 }));
        renderSheet(audit({ totalItemCount: 0 }), []);
        fireEvent.click(screen.getByTestId("audit-generate-items"));
        await waitFor(() => expect(service.generateItems).toHaveBeenCalledWith(AUDIT_ID));
    });

    it("sends whatever was scanned straight to the server, which parses it", async () => {
        service.verifyItem.mockResolvedValue(item({ status: AuditItemStatus.VERIFIED }));
        renderSheet(audit());
        const input = screen.getByTestId("audit-scan-input");
        fireEvent.change(input, { target: { value: "  https://app.test/scan?a=asset-1  " } });
        fireEvent.click(screen.getByTestId("audit-verify-scan"));
        await waitFor(() =>
            expect(service.verifyItem).toHaveBeenCalledWith(AUDIT_ID, { scan: "https://app.test/scan?a=asset-1" }),
        );
    });

    it("verifies on Enter, the way a barcode wedge types", async () => {
        service.verifyItem.mockResolvedValue(item({ status: AuditItemStatus.VERIFIED }));
        renderSheet(audit());
        const input = screen.getByTestId("audit-scan-input");
        fireEvent.change(input, { target: { value: "AST-0001" } });
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() => expect(service.verifyItem).toHaveBeenCalledWith(AUDIT_ID, { scan: "AST-0001" }));
    });

    it("lists the sheet and verifies one row by its asset id", async () => {
        service.verifyItem.mockResolvedValue(item({ status: AuditItemStatus.VERIFIED }));
        renderSheet(audit());
        await screen.findByTestId("audit-item-row");
        expect(screen.getByText("AST-0001")).toBeTruthy();
        fireEvent.click(screen.getByLabelText("Verify AST-0001"));
        await waitFor(() => expect(service.verifyItem).toHaveBeenCalledWith(AUDIT_ID, { scan: "asset-1" }));
    });

    it("requires a reason before a discrepancy can be recorded", async () => {
        service.flagItemDiscrepancy.mockResolvedValue(item({ status: AuditItemStatus.DISCREPANCY }));
        renderSheet(audit());
        await screen.findByTestId("audit-item-row");
        fireEvent.click(screen.getByLabelText("Flag AST-0001"));

        const save = await screen.findByTestId("audit-discrepancy-save");
        expect((save as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: "Not at the desk" } });
        fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: "WRONG_LOCATION" } });
        expect((save as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(save);

        await waitFor(() =>
            expect(service.flagItemDiscrepancy).toHaveBeenCalledWith(AUDIT_ID, "item-1", {
                discrepancyType: "WRONG_LOCATION",
                reason: "Not at the desk",
                actualLocation: null,
            }),
        );
    });

    it("filters the sheet by status and search, resetting to the first page", async () => {
        renderSheet(audit());
        await waitFor(() => expect(service.listItems).toHaveBeenCalled());
        fireEvent.change(screen.getByTestId("audit-item-search"), { target: { value: "AST-0001" } });
        await waitFor(() =>
            expect(service.listItems).toHaveBeenLastCalledWith(AUDIT_ID, {
                search: "AST-0001",
                status: undefined,
                page: 0,
                size: 20,
            }),
        );
    });

    it("locks the sheet once the audit is a final record", async () => {
        renderSheet(audit({ status: AuditStatus.COMPLETED }));
        await screen.findByTestId("audit-item-row");
        expect(screen.queryByTestId("audit-scan-input")).toBeNull();
        expect(screen.queryByLabelText("Verify AST-0001")).toBeNull();
        expect(screen.getByText(/final record/i)).toBeTruthy();
    });
});
