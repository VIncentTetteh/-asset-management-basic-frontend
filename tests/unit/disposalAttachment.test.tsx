import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DisposalFormModal } from "@/features/disposals/DisposalFormModal";
import type { DisposalRecord } from "@/types";
import api from "@/lib/axios";

/**
 * The disposal form's compliance document.
 *
 * This column is the awkward one: it was "link or reference", so existing rows
 * hold certificate numbers as often as URLs. Switching to uploads must not
 * blank either — and disposals save by full replace, so a field the form stops
 * sending is a field the API clears.
 */

const DISPOSAL_ID = "99999999-8888-7777-6666-555555555555";

const disposals = vi.hoisted(() => ({
    create: vi.fn(),
    replace: vi.fn(),
    getAll: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    delete: vi.fn(),
}));
vi.mock("@/services/disposalService", () => ({ disposalService: disposals }));
vi.mock("@/services/assetService", () => ({
    assetService: { search: vi.fn().mockResolvedValue([]), getAll: vi.fn().mockResolvedValue([]) },
}));
// The server-side asset search has its own coverage; here it only needs to hand
// the form an asset the way a real pick does.
vi.mock("@/components/assets/AssetSearchPicker", () => ({
    AssetSearchPicker: ({ onChange }: { onChange: (a: { id: string; name: string }) => void }) => (
        <button type="button" onClick={() => onChange({ id: "ast-1", name: "Latitude 5420" })}>
            Pick asset
        </button>
    ),
}));
vi.mock("@/config/commercialFeatures", () => ({
    commercialFeatures: { documentAttachments: true },
    isCommercialRouteDisabled: () => false,
}));
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

const existing = (over: Partial<DisposalRecord> = {}): DisposalRecord => ({
    id: DISPOSAL_ID,
    assetId: "ast-1",
    assetName: "Latitude 5420",
    assetTag: "AST-1",
    disposalDate: "2026-09-01",
    reason: "End of life",
    disposalMethod: "SCRAP",
    status: "PENDING",
    ...over,
} as DisposalRecord);

afterEach(cleanup);
beforeEach(() => {
    disposals.create.mockReset().mockResolvedValue({ id: DISPOSAL_ID });
    disposals.replace.mockReset().mockResolvedValue({ id: DISPOSAL_ID });
    mockedApi.post.mockReset();
    mockedApi.get.mockReset().mockResolvedValue({ data: [] });
    toastFns.error.mockClear();
    toastFns.success.mockClear();
});

const renderModal = (editing: DisposalRecord | null = null) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <DisposalFormModal isOpen onClose={() => {}} editingDisposal={editing} />
        </QueryClientProvider>,
    );
};

const pdf = (name = "destruction-certificate.pdf") =>
    new File([new Uint8Array([37, 80, 68, 70])], name, { type: "application/pdf" });

const filePicker = (): HTMLInputElement => {
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error("no file picker rendered");
    return input as HTMLInputElement;
};

describe("disposal compliance document attachment", () => {
    it("attaches the held certificate to the disposal the create returned", async () => {
        mockedApi.post.mockResolvedValue({ data: { id: "doc-2", originalName: "destruction-certificate.pdf" } });
        renderModal();

        // assetId is set by the picker; the form is otherwise filled directly.
        fireEvent.change(screen.getByLabelText(/^Primary reason/), { target: { value: "Irreparable" } });
        fireEvent.change(filePicker(), { target: { files: [pdf()] } });
        expect(mockedApi.post).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: /^Pick asset$/ }));
        fireEvent.click(screen.getByRole("button", { name: /^Request disposal$/ }));

        await waitFor(() => expect(disposals.create).toHaveBeenCalled());
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith(
            "/documents",
            expect.any(FormData),
            expect.objectContaining({ params: { entityType: "DISPOSAL_RECORD", entityId: DISPOSAL_ID } }),
        ));
    });

    it("says the disposal saved but the certificate did not, when the upload fails", async () => {
        mockedApi.post.mockRejectedValue({ response: { status: 503, data: {} } });
        renderModal();
        fireEvent.change(screen.getByLabelText(/^Primary reason/), { target: { value: "Irreparable" } });
        fireEvent.change(filePicker(), { target: { files: [pdf("cert.pdf")] } });
        fireEvent.click(screen.getByRole("button", { name: /^Pick asset$/ }));
        fireEvent.click(screen.getByRole("button", { name: /^Request disposal$/ }));

        await waitFor(() => expect(mockedApi.post).toHaveBeenCalled());
        await waitFor(() => {
            const said = toastFns.error.mock.calls.map((c) => String(c[0])).join("\n");
            expect(said).toMatch(/disposal record was saved, but/i);
            expect(said).toMatch(/cert\.pdf/);
        });
    });

    it("keeps a stored certificate reference that was never a URL", async () => {
        renderModal(existing({ complianceDocumentUrl: "certificate of destruction #12345" }));

        // Not a link — shown as plain text rather than an href that cannot resolve.
        expect(await screen.findByText(/certificate of destruction #12345/)).toBeTruthy();
        expect(screen.getByText(/Currently linked/i)).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /^Save changes$/ }));
        await waitFor(() => expect(disposals.replace).toHaveBeenCalled());
        expect(disposals.replace.mock.calls[0][1]).toMatchObject({
            complianceDocumentUrl: "certificate of destruction #12345",
        });
    });
});
