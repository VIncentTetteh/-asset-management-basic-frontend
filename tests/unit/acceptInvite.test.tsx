import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import AcceptInvitePage from "@/app/accept-invite/page";

/**
 * Redeeming an invitation, end to end inside the page: lookup → what is being
 * offered → the form → accept → login.
 *
 * Three things here are not cosmetic. The token must leave the address bar, or
 * every later navigation leaks a credential in a referrer. The redirect must
 * carry the organisation, or an address that exists in two tenants cannot sign
 * in. And an unusable token must explain itself — all four reasons — rather
 * than rendering as an error.
 */

const ORG_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const invitationsSvc = vi.hoisted(() => ({ lookup: vi.fn(), accept: vi.fn() }));
vi.mock("@/services/invitationService", () => ({ invitationService: invitationsSvc }));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.success = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

const VALID_PREVIEW = {
    valid: true,
    reason: null,
    organisationName: "Acme Manufacturing Ghana",
    email: "ama.mensah@acme.test",
    roleName: "Asset Manager",
    roleDescription: "Looks after the register day to day.",
    firstName: "Ama",
    lastName: null,
    invitedByName: "Vincent Tetteh",
    note: "You'll be looking after the Accra office register.",
    expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    permissions: [
        { key: "DISPOSE_ASSET", label: "Dispose of assets", summary: "Record write-offs, sales and scrappage.", group: "Assets", write: true, enforced: true },
        { key: "REGENERATE_QR", label: "Reissue asset QR codes", summary: "Issue a replacement QR label.", group: "Assets", write: true, enforced: false },
    ],
};

const invalid = (reason: string) => ({
    valid: false,
    reason,
    organisationName: null,
    email: null,
    roleName: null,
    roleDescription: null,
    firstName: null,
    lastName: null,
    invitedByName: null,
    note: null,
    expiresAt: null,
    permissions: [],
});

const httpError = (status: number, data: unknown): AxiosError => {
    const config = { headers: new AxiosHeaders() };
    const response = { status, statusText: "", data, headers: {}, config } as unknown as AxiosResponse;
    return new AxiosError("failed", "ERR_BAD_REQUEST", config, null, response);
};

const assign = vi.fn();
const replaceState = vi.fn();

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/accept-invite?token=tok_abc123");
    // jsdom/happy-dom will not navigate; the assignment is what is asserted.
    Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...window.location, assign, pathname: "/accept-invite", search: "?token=tok_abc123" },
    });
    window.history.replaceState = replaceState;
});

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <AcceptInvitePage />
        </QueryClientProvider>,
    );
}

const submit = () => {
    const button = screen.getByRole("button", { name: /^Join / });
    fireEvent.submit(button.closest("form") as HTMLFormElement);
};

describe("accepting an invitation", () => {
    it("looks the token up by POST and takes it out of the address bar", async () => {
        invitationsSvc.lookup.mockResolvedValue(VALID_PREVIEW);
        renderPage();

        await waitFor(() => expect(invitationsSvc.lookup).toHaveBeenCalledWith("tok_abc123"));
        expect(replaceState).toHaveBeenCalledWith(null, "", "/accept-invite");
    });

    it("shows which company, which role, and what the person will be able to do — in words", async () => {
        invitationsSvc.lookup.mockResolvedValue(VALID_PREVIEW);
        renderPage();

        expect(await screen.findByText(/Vincent Tetteh invited you to join Acme Manufacturing Ghana/)).toBeTruthy();
        expect(screen.getByText(/You will join as Asset Manager/)).toBeTruthy();
        expect(screen.getByText("Dispose of assets")).toBeTruthy();
        // Never an authority string.
        expect(screen.queryByText(/DISPOSE_ASSET/)).toBeNull();
    });

    it("leaves out a permission the API says is not enforced, rather than promising it", async () => {
        invitationsSvc.lookup.mockResolvedValue(VALID_PREVIEW);
        renderPage();

        await screen.findByText("Dispose of assets");
        expect(screen.queryByText("Reissue asset QR codes")).toBeNull();
    });

    it("accepts with the token and the chosen password, then sends them to login with the organisation", async () => {
        invitationsSvc.lookup.mockResolvedValue(VALID_PREVIEW);
        invitationsSvc.accept.mockResolvedValue({
            userId: "u-1",
            email: "ama.mensah@acme.test",
            organisationId: ORG_ID,
            organisationName: "Acme Manufacturing Ghana",
            roleName: "Asset Manager",
            message: "Welcome.",
        });
        renderPage();

        const last = await screen.findByLabelText(/Last name/);
        // The invitation pre-filled the first name; the invitee supplies the rest.
        expect((screen.getByLabelText(/First name/) as HTMLInputElement).value).toBe("Ama");
        fireEvent.change(last, { target: { value: "Mensah" } });
        fireEvent.change(screen.getByLabelText(/Choose a password/), { target: { value: "correct horse battery" } });
        fireEvent.change(screen.getByLabelText(/Job title/), { target: { value: "Procurement Lead" } });
        submit();

        await waitFor(() => expect(invitationsSvc.accept).toHaveBeenCalledTimes(1));
        expect(invitationsSvc.accept.mock.calls[0][0]).toEqual({
            token: "tok_abc123",
            firstName: "Ama",
            lastName: "Mensah",
            password: "correct horse battery",
            jobTitle: "Procurement Lead",
        });
        expect(assign).toHaveBeenCalledWith(
            `/login?org=${ORG_ID}&email=${encodeURIComponent("ama.mensah@acme.test")}`,
        );
    });

    it("refuses a short password before it reaches the server", async () => {
        invitationsSvc.lookup.mockResolvedValue(VALID_PREVIEW);
        renderPage();

        fireEvent.change(await screen.findByLabelText(/Last name/), { target: { value: "Mensah" } });
        fireEvent.change(screen.getByLabelText(/Choose a password/), { target: { value: "short" } });
        submit();

        expect(await screen.findByText(/at least 8 characters/i)).toBeTruthy();
        expect(invitationsSvc.accept).not.toHaveBeenCalled();
    });

    it("says why the account was not created and does not pretend to redirect", async () => {
        invitationsSvc.lookup.mockResolvedValue(VALID_PREVIEW);
        invitationsSvc.accept.mockRejectedValue(httpError(400, {
            message: "That invitation has expired. Ask for a new one.",
        }));
        renderPage();

        fireEvent.change(await screen.findByLabelText(/Last name/), { target: { value: "Mensah" } });
        fireEvent.change(screen.getByLabelText(/Choose a password/), { target: { value: "correct horse battery" } });
        submit();

        expect((await screen.findByTestId("accept-error")).textContent).toContain("That invitation has expired");
        expect(assign).not.toHaveBeenCalled();
    });
});

describe("a token that cannot be redeemed", () => {
    const CASES: [string, RegExp][] = [
        ["EXPIRED", /This invitation has expired/],
        ["REVOKED", /This invitation was withdrawn/],
        ["ACCEPTED", /This invitation has already been used/],
        ["UNKNOWN", /We don't recognise this link/],
    ];

    for (const [reason, expected] of CASES) {
        it(`explains ${reason} rather than showing an error`, async () => {
            invitationsSvc.lookup.mockResolvedValue(invalid(reason));
            renderPage();

            expect((await screen.findByTestId("invalid-title")).textContent).toMatch(expected);
            // No form: there is nothing to fill in.
            expect(screen.queryByLabelText(/Choose a password/)).toBeNull();
        });
    }

    it("keeps a failed lookup separate from an invalid token", async () => {
        // A request that did not complete says nothing about the link.
        invitationsSvc.lookup.mockRejectedValue(new Error("network down"));
        renderPage();

        expect(await screen.findByText(/We couldn't check your invitation/)).toBeTruthy();
        expect(screen.queryByTestId("invalid-title")).toBeNull();
    });

    it("asks for the link when the page is opened without one", async () => {
        Object.defineProperty(window, "location", {
            configurable: true,
            value: { ...window.location, assign, pathname: "/accept-invite", search: "" },
        });
        renderPage();

        expect(await screen.findByText(/This page needs an invitation link/)).toBeTruthy();
        expect(invitationsSvc.lookup).not.toHaveBeenCalled();
    });
});
