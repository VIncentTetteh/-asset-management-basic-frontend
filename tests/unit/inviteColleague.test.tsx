import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import UsersPage from "@/app/users/page";

/**
 * Inviting a colleague, rendered and submitted for real.
 *
 * The two facts worth protecting with a test are the ones a reader of the code
 * cannot check: that the body posted is the body the API documents, and that
 * the acceptance link is shown when — and only when — the email did not go out.
 * The second is a security property, not a nicety: `acceptUrl` is a live
 * credential and the API returns it exactly when there is no mailbox it
 * reached.
 */

const ids = vi.hoisted(() => ({
    role: "b2a0d4d8-0000-4000-8000-000000000002",
    department: "b2a0d4d8-0000-4000-8000-000000000003",
}));
const ROLE_ID = ids.role;
const DEPT_ID = ids.department;

const invitationsSvc = vi.hoisted(() => ({
    list: vi.fn(),
    invite: vi.fn(),
    resend: vi.fn(),
    revoke: vi.fn(),
    lookup: vi.fn(),
    accept: vi.fn(),
}));
vi.mock("@/services/invitationService", () => ({ invitationService: invitationsSvc }));

vi.mock("@/services/userService", () => ({ userService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock("@/services/departmentService", () => ({
    departmentService: { getAll: vi.fn().mockResolvedValue([{ id: ids.department, name: "Finance" }]) },
}));
vi.mock("@/services/roleService", () => ({
    roleService: { getAll: vi.fn().mockResolvedValue([{ id: ids.role, name: "Asset Manager", permissions: [] }]) },
}));
vi.mock("@/services/mfaService", () => ({ mfaService: { adminReset: vi.fn() } }));

vi.mock("@/contexts/PermissionContext", () => ({ usePermissions: () => ({ hasPermission: () => true, loading: false }) }));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & {
        success: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
        dismiss: ReturnType<typeof vi.fn>;
    };
    fn.success = vi.fn();
    fn.error = vi.fn();
    fn.dismiss = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

const INVITATION = {
    id: "6f1c2a4e-3b5d-4c6e-8f9a-0b1c2d3e4f50",
    email: "ama.mensah@acme.test",
    status: "PENDING" as const,
    roleId: ROLE_ID,
    roleName: "Asset Manager",
    departmentId: null,
    departmentName: null,
    firstName: null,
    lastName: null,
    jobTitle: null,
    note: null,
    expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    createdAt: new Date().toISOString(),
    lastSentAt: new Date().toISOString(),
    sendCount: 1,
    emailDelivered: true,
    invitedByName: "Vincent",
    acceptedAt: null,
    acceptedUserId: null,
    revokedAt: null,
};

const httpError = (status: number, data: unknown, headers: Record<string, string> = {}): AxiosError => {
    const config = { headers: new AxiosHeaders() };
    const response = { status, statusText: "", data, headers, config } as unknown as AxiosResponse;
    return new AxiosError("failed", "ERR_BAD_REQUEST", config, null, response);
};

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    invitationsSvc.list.mockResolvedValue({ items: [INVITATION], total: 1, limit: 25, offset: 0, totalPages: 1 });
});

function renderUsers() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <UsersPage />
        </QueryClientProvider>,
    );
}

/** Opens the invite modal and fills the two fields the API requires. */
async function openInviteForm() {
    renderUsers();
    fireEvent.click(await screen.findByRole("button", { name: /^Invite colleague$/i }));
    const email = await screen.findByLabelText(/Email address/);
    fireEvent.change(email, { target: { value: "ama.mensah@acme.test" } });
    fireEvent.change(screen.getByLabelText(/^Role/), { target: { value: ROLE_ID } });
}

const send = () => {
    // happy-dom does not run implicit form submission from a click on a submit
    // button, so the form event is dispatched directly.
    const button = screen.getByRole("button", { name: /^Send invitation$/ });
    fireEvent.submit(button.closest("form") as HTMLFormElement);
};

const issued = (overrides: Record<string, unknown> = {}) => ({
    invitation: INVITATION,
    emailSent: true,
    acceptUrl: null,
    message: null,
    ...overrides,
});

describe("inviting a colleague", () => {
    it("posts exactly what the API documents, omitting the optional fields left blank", async () => {
        invitationsSvc.invite.mockResolvedValue(issued());
        await openInviteForm();
        fireEvent.change(screen.getByLabelText(/Department/), { target: { value: DEPT_ID } });
        fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "  Ama  " } });
        fireEvent.change(screen.getByLabelText(/Note/), { target: { value: "Welcome aboard" } });
        send();

        await waitFor(() => expect(invitationsSvc.invite).toHaveBeenCalledTimes(1));
        expect(invitationsSvc.invite.mock.calls[0][0]).toEqual({
            email: "ama.mensah@acme.test",
            roleId: ROLE_ID,
            departmentId: DEPT_ID,
            firstName: "Ama",
            note: "Welcome aboard",
        });
    });

    it("refuses to send without a role, and says which field is missing", async () => {
        renderUsers();
        fireEvent.click(await screen.findByRole("button", { name: /^Invite colleague$/i }));
        fireEvent.change(await screen.findByLabelText(/Email address/), { target: { value: "ama@acme.test" } });
        send();

        expect(await screen.findByText(/Choose the role this person should have/)).toBeTruthy();
        expect(invitationsSvc.invite).not.toHaveBeenCalled();
    });

    it("shows the link to pass on by hand when the environment could not send the email", async () => {
        const acceptUrl = "https://app.assetiq.test/accept-invite?token=0f9d4c2a8b7e";
        invitationsSvc.invite.mockResolvedValue(
            issued({ emailSent: false, acceptUrl, message: "Email is not configured in this environment." }),
        );
        await openInviteForm();
        send();

        const notice = await screen.findByTestId("invite-accept-link");
        expect(within(notice).getByText(/Email is switched off here/)).toBeTruthy();
        expect((within(notice).getByLabelText(/Invitation link/) as HTMLInputElement).value).toBe(acceptUrl);
        // And no false claim that anything was sent.
        expect(toastFns.success).not.toHaveBeenCalled();
    });

    it("never shows a link when the email went out — the API returns none, and none is displayed", async () => {
        invitationsSvc.invite.mockResolvedValue(issued({ emailSent: true, acceptUrl: null }));
        await openInviteForm();
        send();

        await waitFor(() => expect(toastFns.success).toHaveBeenCalledWith(
            expect.stringContaining("ama.mensah@acme.test"),
            expect.anything(),
        ));
        expect(screen.queryByTestId("invite-accept-link")).toBeNull();
        expect(screen.queryByText(/accept-invite\?token/)).toBeNull();
    });

    it("keeps the form open and repeats the API's own words when the person is already a member", async () => {
        invitationsSvc.invite.mockRejectedValue(httpError(409, {
            message: "Someone with that email address is already a member of your organisation.",
        }));
        await openInviteForm();
        send();

        const alert = await screen.findByTestId("invite-error");
        expect(alert.textContent).toContain("already a member of your organisation");
        // The form is still there, with what was typed still in it.
        expect((screen.getByLabelText(/Email address/) as HTMLInputElement).value).toBe("ama.mensah@acme.test");
    });

    it("reports a refused escalation rather than a generic failure", async () => {
        invitationsSvc.invite.mockRejectedValue(httpError(403, {
            message: "You cannot invite someone as 'Organisation Admin': it grants permissions you do not hold.",
        }));
        await openInviteForm();
        send();

        expect((await screen.findByTestId("invite-error")).textContent)
            .toContain("grants permissions you do not hold");
    });

    it("adds how long to wait to a rate-limited send, which the message alone cannot say", async () => {
        invitationsSvc.invite.mockRejectedValue(httpError(
            429,
            { message: "That invitation was just sent.", errorCode: "RATE_LIMITED" },
            { "retry-after": "45" },
        ));
        await openInviteForm();
        send();

        expect((await screen.findByTestId("invite-error")).textContent).toMatch(/Try again in 45 seconds/);
    });

    it("puts a field-level rejection on its own control", async () => {
        invitationsSvc.invite.mockRejectedValue(httpError(400, {
            errorCode: "VALIDATION_FAILED",
            errors: { email: "Enter a valid email address" },
        }));
        await openInviteForm();
        send();

        expect(await screen.findByText("Enter a valid email address")).toBeTruthy();
    });
});

describe("the invitation list", () => {
    it("offers resend and revoke on a pending invitation and neither on an accepted one", async () => {
        invitationsSvc.list.mockResolvedValue({
            items: [INVITATION, { ...INVITATION, id: "other", email: "kwabena@acme.test", status: "ACCEPTED" }],
            total: 2,
            limit: 25,
            offset: 0,
            totalPages: 1,
        });
        renderUsers();

        expect(await screen.findByRole("button", { name: /Resend the invitation to ama.mensah@acme.test/i })).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Resend the invitation to kwabena@acme.test/i })).toBeNull();
        expect(screen.queryByRole("button", { name: /Revoke the invitation to kwabena@acme.test/i })).toBeNull();
    });

    it("says why a resend failed instead of appearing to have worked", async () => {
        invitationsSvc.resend.mockRejectedValue(httpError(409, {
            message: "That invitation has expired. Send a new invitation instead.",
        }));
        renderUsers();
        fireEvent.click(await screen.findByRole("button", { name: /Resend the invitation to ama.mensah@acme.test/i }));

        expect((await screen.findByTestId("invitation-action-error")).textContent).toContain("has expired");
        expect(toastFns.success).not.toHaveBeenCalled();
    });

    it("renders a failed load as a failure, never as an empty list", async () => {
        invitationsSvc.list.mockRejectedValue(new Error("network down"));
        renderUsers();

        const failure = await screen.findByText(/We couldn't load your invitations/i);
        expect(failure).toBeTruthy();
        expect(screen.queryByText(/No invitations yet/i)).toBeNull();
    });
});
