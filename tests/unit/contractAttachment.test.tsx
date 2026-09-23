import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContractsPage from "@/app/contracts/page";
import api from "@/lib/axios";

/**
 * The contract document uploader, rendered and driven through the real page.
 *
 * The create-then-attach ordering is the whole risk here: a file chosen on the
 * create form has no contract to hang off until the POST returns an id, so the
 * upload happens afterwards and can fail on its own. A payload-builder test
 * cannot see any of that — it never renders the picker, never sees which
 * entityId the multipart request carried, and never sees what the user is told
 * when the contract saves and the file does not. Two features shipped broken
 * this week through exactly that gap.
 */

const CONTRACT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const contracts = vi.hoisted(() => ({
    getAll: vi.fn(),
    create: vi.fn(),
    replace: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getExpiringSoon: vi.fn(),
}));
vi.mock("@/services/contractService", () => ({ contractService: contracts }));
vi.mock("@/services/supplierService", () => ({
    supplierService: { getAll: vi.fn().mockResolvedValue([{ id: "sup-1", name: "Acme Supplies" }]) },
}));
vi.mock("@/services/assetService", () => ({
    assetService: { getAll: vi.fn().mockResolvedValue([{ id: "ast-1", name: "Latitude", assetTag: "AST-1" }]) },
}));
vi.mock("@/lib/authContext", () => ({ getOrganisationIdFromStorage: () => "org-1" }));
vi.mock("@/contexts/CurrencyContext", () => ({
    useCurrency: () => ({
        baseCurrency: "USD",
        availableCurrencies: ["USD", "GHS"],
        format: (amount: number, currency = "USD") => `${currency} ${amount}`,
        sum: () => ({ total: 0, currency: "USD", complete: true, missingRates: [] }),
    }),
}));
// Attachments are behind a commercial flag; these tests are about the flag being on.
vi.mock("@/config/commercialFeatures", () => ({
    commercialFeatures: { documentAttachments: true },
    isCommercialRouteDisabled: () => false,
}));
// documentService is deliberately NOT mocked: the point is to see the multipart
// request it builds, so only the axios instance underneath it is replaced.
vi.mock("@/lib/axios", () => ({
    default: { post: vi.fn(), get: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.success = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

const mockedApi = api as unknown as {
    post: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
};

afterEach(cleanup);
beforeEach(() => {
    contracts.getAll.mockReset().mockResolvedValue([]);
    contracts.create.mockReset().mockResolvedValue({ id: CONTRACT_ID, title: "Support" });
    contracts.replace.mockReset().mockResolvedValue({ id: CONTRACT_ID, title: "Support" });
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
            <ContractsPage />
        </QueryClientProvider>,
    );
};

const pdf = (name = "msa.pdf") =>
    new File([new Uint8Array([37, 80, 68, 70])], name, { type: "application/pdf" });

/** Opens the create form and fills the fields the API insists on. */
async function openCreateForm() {
    fireEvent.click(await screen.findByRole("button", { name: /New contract/i }));
    const title = await screen.findByLabelText(/^Title/);
    fireEvent.change(title, { target: { value: "Support" } });
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(/^End date/), { target: { value: "2026-12-31" } });
}

/** The single file input the uploader renders. */
const filePicker = (): HTMLInputElement => {
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error("no file picker rendered");
    return input as HTMLInputElement;
};

describe("contract document attachment", () => {
    it("uploads the chosen file against the contract the create returned", async () => {
        mockedApi.post.mockResolvedValue({ data: { id: "doc-1", originalName: "msa.pdf" } });
        renderPage();
        await openCreateForm();

        const file = pdf();
        fireEvent.change(filePicker(), { target: { files: [file] } });
        // Nothing is uploaded yet — there is no contract to attach it to.
        expect(mockedApi.post).not.toHaveBeenCalled();
        expect(await screen.findByText(/will be attached when this is saved/i)).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /^Create contract$/ }));

        await waitFor(() => expect(contracts.create).toHaveBeenCalled());
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith(
            "/documents",
            expect.any(FormData),
            expect.objectContaining({
                params: { entityType: "CONTRACT", entityId: CONTRACT_ID },
                headers: { "Content-Type": "multipart/form-data" },
            }),
        ));
        // The part the backend reads is named `file` and carries the chosen file.
        const body = mockedApi.post.mock.calls[0][1] as FormData;
        expect(body.get("file")).toBe(file);
    });

    it("says the contract saved but the file did not, instead of reporting a clean save", async () => {
        mockedApi.post.mockRejectedValue({ response: { status: 500, data: { message: "Storage unavailable" } } });
        renderPage();
        await openCreateForm();
        fireEvent.change(filePicker(), { target: { files: [pdf("evidence.pdf")] } });
        fireEvent.click(screen.getByRole("button", { name: /^Create contract$/ }));

        await waitFor(() => expect(mockedApi.post).toHaveBeenCalled());
        await waitFor(() => {
            const said = toastFns.error.mock.calls.map((c) => String(c[0])).join("\n");
            expect(said).toMatch(/contract was saved, but/i);
            expect(said).toMatch(/evidence\.pdf/);
            expect(said).toMatch(/Storage unavailable/);
        });
    });

    it("refuses a file the server would reject, without sending it", async () => {
        renderPage();
        await openCreateForm();
        const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
        fireEvent.change(filePicker(), { target: { files: [svg] } });

        expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringMatching(/cannot be attached/i));
        expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it("still shows a document URL stored before uploads existed, as a link", async () => {
        contracts.getAll.mockResolvedValue([
            {
                id: CONTRACT_ID,
                title: "Support",
                contractType: "MAINTENANCE",
                status: "ACTIVE",
                startDate: "2026-01-01",
                endDate: "2026-12-31",
                documentUrl: "https://files.example.com/legacy-msa.pdf",
            },
        ]);
        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: /^Edit contract$/i }));
        const link = await screen.findByRole("link", { name: /legacy-msa\.pdf/ });
        expect(link.getAttribute("href")).toBe("https://files.example.com/legacy-msa.pdf");
        expect(screen.getByText(/Currently linked/i)).toBeTruthy();
    });

    it("clears a stored link, and the cleared value is what the save carries", async () => {
        const withLink = {
            id: CONTRACT_ID,
            title: "Support",
            contractType: "MAINTENANCE",
            status: "ACTIVE",
            startDate: "2026-01-01",
            endDate: "2026-12-31",
            documentUrl: "https://files.example.com/dead-link.pdf",
        };
        contracts.getAll.mockResolvedValue([withLink]);
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: /^Edit contract$/i }));
        expect(await screen.findByText(/Currently linked/i)).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /Clear stored link/i }));

        // The line is driven by form state, so it goes at once. Reading it from
        // the loaded record instead would leave a "cleared" link on screen.
        await waitFor(() => expect(screen.queryByText(/Currently linked/i)).toBeNull());
        expect(screen.queryByRole("link", { name: /dead-link\.pdf/ })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /^Save changes$/ }));
        await waitFor(() => expect(contracts.replace).toHaveBeenCalled());
        // Contracts save by full replace, and optionalString("") is null: the
        // column is actually cleared rather than left as it was.
        expect(contracts.replace.mock.calls[0][1]).toMatchObject({ documentUrl: null });
    });

    it("shows the link gone when the record is reopened after a clear", async () => {
        const withLink = {
            id: CONTRACT_ID,
            title: "Support",
            contractType: "MAINTENANCE",
            status: "ACTIVE",
            startDate: "2026-01-01",
            endDate: "2026-12-31",
            documentUrl: "https://files.example.com/dead-link.pdf",
        };
        contracts.getAll.mockResolvedValueOnce([withLink]).mockResolvedValue([{ ...withLink, documentUrl: null }]);
        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: /^Edit contract$/i }));
        fireEvent.click(await screen.findByRole("button", { name: /Clear stored link/i }));
        fireEvent.click(screen.getByRole("button", { name: /^Save changes$/ }));
        await waitFor(() => expect(contracts.replace).toHaveBeenCalled());

        // Reopen from the refetched list: the clear survived the round trip.
        fireEvent.click(await screen.findByRole("button", { name: /^Edit contract$/i }));
        await screen.findByLabelText(/^Title/);
        expect(screen.queryByText(/Currently linked/i)).toBeNull();
    });

    it("does not let a clear look saved when the save fails", async () => {
        contracts.getAll.mockResolvedValue([
            {
                id: CONTRACT_ID,
                title: "Support",
                contractType: "MAINTENANCE",
                status: "ACTIVE",
                startDate: "2026-01-01",
                endDate: "2026-12-31",
                documentUrl: "https://files.example.com/dead-link.pdf",
            },
        ]);
        contracts.replace.mockRejectedValue({ response: { status: 500, data: { message: "Save failed" } } });
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: /^Edit contract$/i }));
        fireEvent.click(await screen.findByRole("button", { name: /Clear stored link/i }));
        fireEvent.click(screen.getByRole("button", { name: /^Save changes$/ }));

        await waitFor(() => expect(contracts.replace).toHaveBeenCalled());
        await waitFor(() => expect(toastFns.error).toHaveBeenCalled());
        // The form stays open with the clear still pending, so the user can see
        // it did not go through and retry — nothing says the link is gone.
        expect(screen.getByRole("button", { name: /^Save changes$/ })).toBeTruthy();
        expect(toastFns.success).not.toHaveBeenCalled();
    });

    it("keeps the stored URL on the payload when the contract is saved again", async () => {
        contracts.getAll.mockResolvedValue([
            {
                id: CONTRACT_ID,
                title: "Support",
                contractType: "MAINTENANCE",
                status: "ACTIVE",
                startDate: "2026-01-01",
                endDate: "2026-12-31",
                documentUrl: "https://files.example.com/legacy-msa.pdf",
            },
        ]);
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: /^Edit contract$/i }));
        fireEvent.change(await screen.findByLabelText(/^Title/), { target: { value: "Support renewed" } });
        fireEvent.click(screen.getByRole("button", { name: /^Save changes$/ }));

        // Contracts save by full replace: a dropped field would blank the column.
        await waitFor(() => expect(contracts.replace).toHaveBeenCalled());
        expect(contracts.replace.mock.calls[0][1]).toMatchObject({
            documentUrl: "https://files.example.com/legacy-msa.pdf",
        });
    });
});
