import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VulnerabilityScansPage from "@/app/compliance/vulnerability-scans/page";
import api from "@/lib/axios";

/**
 * The evidence uploader on a compliance register, through the real page.
 *
 * The five registers share ComplianceCrudPage, so the uploader is reached
 * through one generic `type: "attachment"` field spec rather than page code —
 * which means nothing in the page files proves the right entityType ever
 * reaches the request. Only rendering the page and attaching a file does, and
 * that is what this covers, along with the attach → list → remove cycle on a
 * record that already exists.
 */

const SCAN_ID = "11111111-2222-3333-4444-555555555555";

const scans = vi.hoisted(() => ({
    getAll: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
}));
vi.mock("@/services/complianceService", () => ({ vulnScanService: scans }));
vi.mock("@/contexts/PermissionContext", () => ({
    usePermissions: () => ({ hasPermission: () => true, loading: false }),
}));
vi.mock("@/config/commercialFeatures", () => ({
    commercialFeatures: { documentAttachments: true },
    isCommercialRouteDisabled: () => false,
}));
// documentService runs for real; only the axios instance beneath it is replaced,
// so the multipart request it builds is visible.
vi.mock("@/lib/axios", () => ({
    default: { post: vi.fn(), get: vi.fn(), delete: vi.fn(), put: vi.fn(), patch: vi.fn() },
}));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.success = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

const mockedApi = api as unknown as Record<"post" | "get" | "delete", ReturnType<typeof vi.fn>>;

const scan = (over: Record<string, unknown> = {}) => ({
    id: SCAN_ID,
    scanDate: "2026-09-01T12:00:00Z",
    scanType: "EXTERNAL",
    scannerTool: "Nessus",
    status: "PASS",
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    ...over,
});

const attachment = {
    id: "doc-7",
    entityType: "VULNERABILITY_SCAN",
    entityId: SCAN_ID,
    originalName: "q3-asv-scan.pdf",
    contentType: "application/pdf",
    fileSize: 204_800,
    uploadedByName: "Ama Mensah",
    createdAt: "2026-09-02T09:00:00Z",
};

afterEach(cleanup);
beforeEach(() => {
    scans.getAll.mockReset().mockResolvedValue([scan()]);
    scans.create.mockReset().mockResolvedValue(scan());
    scans.update.mockReset().mockResolvedValue(scan());
    scans.delete.mockReset().mockResolvedValue(undefined);
    mockedApi.post.mockReset();
    mockedApi.get.mockReset().mockResolvedValue({ data: [] });
    mockedApi.delete.mockReset().mockResolvedValue({ data: undefined });
    toastFns.error.mockClear();
    toastFns.success.mockClear();
});

const renderPage = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <VulnerabilityScansPage />
        </QueryClientProvider>,
    );
};

const pdf = (name = "q3-asv-scan.pdf") =>
    new File([new Uint8Array([37, 80, 68, 70])], name, { type: "application/pdf" });

const filePicker = (): HTMLInputElement => {
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error("no file picker rendered");
    return input as HTMLInputElement;
};

const openEdit = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /^Edit scan$/i }));
    await screen.findByText(/^Edit Scan$/);
};

describe("compliance register evidence attachment", () => {
    it("uploads against the scan being edited, as soon as the file is chosen", async () => {
        mockedApi.post.mockResolvedValue({ data: attachment });
        renderPage();
        await openEdit();

        fireEvent.change(filePicker(), { target: { files: [pdf()] } });

        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith(
            "/documents",
            expect.any(FormData),
            expect.objectContaining({
                params: { entityType: "VULNERABILITY_SCAN", entityId: SCAN_ID },
                headers: { "Content-Type": "multipart/form-data" },
            }),
        ));
        // The record already exists, so nothing waits for a save.
        expect(scans.update).not.toHaveBeenCalled();
    });

    it("lists what is already attached, with its size and who attached it", async () => {
        mockedApi.get.mockImplementation((url: string) =>
            url === "/documents" ? Promise.resolve({ data: [attachment] }) : Promise.resolve({ data: [] }),
        );
        renderPage();
        await openEdit();

        const list = await screen.findByTestId("attachment-list");
        expect(list.textContent).toContain("q3-asv-scan.pdf");
        expect(list.textContent).toContain("200.0 KB");
        expect(list.textContent).toContain("by Ama Mensah");
        expect(screen.getByRole("button", { name: /Download q3-asv-scan\.pdf/ })).toBeTruthy();
    });

    it("removes an attachment only after the confirm, and calls the delete endpoint", async () => {
        mockedApi.get.mockImplementation((url: string) =>
            url === "/documents" ? Promise.resolve({ data: [attachment] }) : Promise.resolve({ data: [] }),
        );
        renderPage();
        await openEdit();

        fireEvent.click(await screen.findByRole("button", { name: /Remove q3-asv-scan\.pdf/ }));
        expect(mockedApi.delete).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: /^Remove$/ }));
        await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith("/documents/doc-7"));
    });

    it("reports a failed upload instead of leaving it looking attached", async () => {
        mockedApi.post.mockRejectedValue({ response: { status: 400, data: { message: "Unsupported file type: application/zip" } } });
        renderPage();
        await openEdit();

        fireEvent.change(filePicker(), { target: { files: [pdf("broken.pdf")] } });

        await waitFor(() => expect(mockedApi.post).toHaveBeenCalled());
        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toMatch(/broken\.pdf[\s\S]*was not attached[\s\S]*Unsupported file type/);
        expect(toastFns.error).toHaveBeenCalled();
        expect(toastFns.success).not.toHaveBeenCalled();
    });

    it("still shows a report URL stored before uploads existed, as a link", async () => {
        scans.getAll.mockResolvedValue([scan({ reportUrl: "https://files.example.com/legacy-scan.pdf" })]);
        renderPage();
        await openEdit();

        const link = await screen.findByRole("link", { name: /legacy-scan\.pdf/ });
        expect(link.getAttribute("href")).toBe("https://files.example.com/legacy-scan.pdf");
        expect(screen.getByText(/Currently linked/i)).toBeTruthy();
    });

    it("keeps the stored URL on the full-replace payload when the scan is saved again", async () => {
        scans.getAll.mockResolvedValue([scan({ reportUrl: "https://files.example.com/legacy-scan.pdf" })]);
        renderPage();
        await openEdit();
        fireEvent.change(screen.getByLabelText(/^Scanner tool$/), { target: { value: "OpenVAS" } });
        fireEvent.click(screen.getByRole("button", { name: /^Save changes$/ }));

        await waitFor(() => expect(scans.update).toHaveBeenCalled());
        expect(scans.update.mock.calls[0][1]).toMatchObject({
            reportUrl: "https://files.example.com/legacy-scan.pdf",
        });
    });

    it("holds the file until a new scan exists, then attaches it to the id the create returned", async () => {
        mockedApi.post.mockResolvedValue({ data: attachment });
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: /New Scan/i }));
        const create = await screen.findByRole("button", { name: /^Create scan$/i });

        fireEvent.change(filePicker(), { target: { files: [pdf()] } });
        expect(mockedApi.post).not.toHaveBeenCalled();

        fireEvent.click(create);
        await waitFor(() => expect(scans.create).toHaveBeenCalled());
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith(
            "/documents",
            expect.any(FormData),
            expect.objectContaining({ params: { entityType: "VULNERABILITY_SCAN", entityId: SCAN_ID } }),
        ));
    });
});
