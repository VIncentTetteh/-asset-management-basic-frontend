import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuditsPage from "@/app/audits/page";
import { AuditStatus, type Audit } from "@/types";

/**
 * The audits page wired to its count sheet.
 *
 * `AuditCountSheet.test.tsx` renders the sheet with an audit handed straight to
 * it, so it never noticed that the page passed a snapshot taken when the sheet
 * was opened: on staging the server generated the items, the list refetched with
 * the new counts, and the panel still said "No count sheet yet". Only a test that
 * owns the page's state catches that, which is what this one does.
 */

const audits = vi.hoisted(() => ({ getAll: vi.fn() }));
const items = vi.hoisted(() => ({
    listItems: vi.fn(),
    generateItems: vi.fn(),
    verifyItem: vi.fn(),
    flagItemDiscrepancy: vi.fn(),
}));
vi.mock("@/services/auditService", () => ({ auditService: { ...audits, ...items } }));
vi.mock("@/services/departmentService", () => ({
    departmentService: { getAll: vi.fn().mockResolvedValue([{ id: "dep-1", name: "Finance" }]) },
}));
vi.mock("@/services/userService", () => ({
    userService: { getAll: vi.fn().mockResolvedValue([{ id: "usr-1", firstName: "Ama", lastName: "Mensah" }]) },
}));
vi.mock("@/contexts/PermissionContext", () => ({
    usePermissions: () => ({ hasPermission: () => true, loading: false }),
}));
vi.mock("react-hot-toast", () => {
    const fn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
    return { default: fn, toast: fn };
});

afterEach(cleanup);
beforeEach(() => {
    audits.getAll.mockReset();
    items.listItems.mockReset();
    items.generateItems.mockReset();
});

const AUDIT_ID = "11111111-2222-3333-4444-555555555555";

const audit = (over: Partial<Audit> = {}): Audit => ({
    id: AUDIT_ID,
    organisationId: "org-1",
    departmentId: "dep-1",
    departmentName: "Finance",
    auditDate: "2026-09-23",
    conductedById: "usr-1",
    status: AuditStatus.PLANNED,
    remarks: "Q3 count",
    totalItemCount: 0,
    verifiedItemCount: 0,
    discrepancyCount: 0,
    allItemsVerified: false,
    ...over,
} as Audit);

describe("audits page count sheet", () => {
    it("follows the server once the sheet is built, instead of the row it was opened from", async () => {
        // Before generate the audit has nothing on it; afterwards the list says two.
        audits.getAll
            .mockResolvedValueOnce([audit()])
            .mockResolvedValue([audit({ totalItemCount: 2 })]);
        items.listItems
            .mockResolvedValueOnce({ total: 0, limit: 20, offset: 0, items: [] })
            .mockResolvedValue({
                total: 2,
                limit: 20,
                offset: 0,
                items: [
                    { id: "i1", auditId: AUDIT_ID, assetId: "a1", assetTag: "AST-1", assetName: "Latitude", status: "PENDING" },
                    { id: "i2", auditId: AUDIT_ID, assetId: "a2", assetTag: "AST-2", assetName: "ThinkPad", status: "PENDING" },
                ],
            });
        items.generateItems.mockResolvedValue(audit({ totalItemCount: 2 }));

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <AuditsPage />
            </QueryClientProvider>,
        );

        fireEvent.click(await screen.findByRole("button", { name: /^Open count sheet$/ }));
        const sheet = await screen.findByTestId("audit-count-sheet");
        expect(screen.getByTestId("audit-progress-label").textContent).toMatch(/No count sheet yet/i);

        fireEvent.click(screen.getByTestId("audit-generate-items"));
        await waitFor(() => expect(items.generateItems).toHaveBeenCalledWith(AUDIT_ID));

        // The panel must move off "No count sheet yet" on its own.
        await waitFor(() =>
            expect(screen.getByTestId("audit-progress-label").textContent).toBe("0 / 2 verified"),
        );
        await waitFor(() => expect(sheet.querySelectorAll('[data-testid="audit-item-row"]')).toHaveLength(2));
    });
});
