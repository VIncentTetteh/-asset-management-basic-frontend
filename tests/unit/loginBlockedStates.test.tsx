import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";

import LoginPage from "@/app/(auth)/login/page";

/**
 * What a blocked user is told, and what they can do about it.
 *
 * The regression: an unverified account got the word "Forbidden" and nothing
 * else, because the client read `message` while the server answered under
 * `error`, and the fallback chain ended at the HTTP reason phrase. Every case
 * here asserts the server's own sentence reaches the screen, stays on the
 * screen, and — when the server says so — brings the resend control with it.
 */

const auth = vi.hoisted(() => ({ login: vi.fn(), resendVerification: vi.fn() }));
vi.mock("@/services/authService", () => ({ authService: auth }));
vi.mock("@/services/mfaService", () => ({ mfaService: { challenge: vi.fn() } }));
vi.mock("@/services/orgSsoService", () => ({ orgSsoService: { discoverByEmail: vi.fn().mockResolvedValue({ ssoEnabled: false }) } }));
vi.mock("@/services/ssoAuthService", () => ({ ssoAuthService: { getOAuth2AuthorizeUrl: vi.fn() } }));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.success = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

const httpError = (status: number, data: unknown) =>
    new AxiosError("Request failed with status code " + status, "ERR_BAD_REQUEST", undefined, null, {
        status,
        statusText: "",
        data,
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
    });

const signIn = async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter22" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    return screen.findByRole("alert");
};

beforeEach(() => {
    cleanup();
    auth.login.mockReset();
    auth.resendVerification.mockReset();
});

describe("sign-in failures", () => {
    it("shows the server's reason and a working resend control when verification is required", async () => {
        auth.login.mockRejectedValue(httpError(403, {
            message: "Please verify your email address before signing in.",
            error: "Please verify your email address before signing in.",
            emailVerificationRequired: true,
        }));
        auth.resendVerification.mockResolvedValue({
            message: "If that address needs verification, a new link is on its way.",
        });

        const alert = await signIn();
        expect(alert.textContent).toContain("Please verify your email address before signing in.");
        expect(alert.textContent).not.toContain("Forbidden");

        fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
        await waitFor(() => expect(auth.resendVerification).toHaveBeenCalledWith({ email: "sam@example.com" }));
        // The API is deliberately ambiguous so it cannot be used to discover
        // which addresses exist; the screen repeats that rather than claiming a send.
        expect(await screen.findByText("If that address needs verification, a new link is on its way."))
            .toBeTruthy();
        expect(screen.queryByText(/^sent/i)).toBeNull();
    });

    it("shows a 403 without the flag as the server worded it, and offers no resend", async () => {
        auth.login.mockRejectedValue(httpError(403, { message: "User account is suspended" }));

        const alert = await signIn();
        expect(alert.textContent).toContain("User account is suspended");
        expect(screen.queryByRole("button", { name: "Resend verification email" })).toBeNull();
    });

    it("explains a 423 lock as temporary, with a readable time", async () => {
        auth.login.mockRejectedValue(httpError(423, {
            message: "Account temporarily locked due to too many failed attempts. Try again after 2099-01-02T10:05:00Z",
        }));

        const alert = await signIn();
        expect(alert.textContent).toContain("temporarily locked");
        expect(alert.textContent).not.toContain("2099-01-02T10:05:00Z");
        expect(alert.textContent).toContain("10:05");
    });

    it("leaves ordinary invalid credentials as the server states them", async () => {
        auth.login.mockRejectedValue(httpError(401, { error: "Invalid email or password" }));

        const alert = await signIn();
        expect(alert.textContent).toContain("Invalid email or password");
        expect(screen.queryByRole("button", { name: "Resend verification email" })).toBeNull();
    });

    it("still renders a body that carries only the old `error` key", async () => {
        auth.login.mockRejectedValue(httpError(403, {
            error: "Please verify your email address before signing in.",
            emailVerificationRequired: true,
        }));

        const alert = await signIn();
        expect(alert.textContent).toContain("Please verify your email address before signing in.");
        expect(screen.getByRole("button", { name: "Resend verification email" })).toBeTruthy();
    });

    it("falls back to a sentence — never a status — when the server explains nothing", async () => {
        auth.login.mockRejectedValue(httpError(403, { timestamp: "2026-09-24T10:00:00Z", status: 403, error: "Forbidden", path: "/api/v1/auth/login" }));

        const alert = await signIn();
        expect(alert.textContent).not.toContain("Forbidden");
        expect(alert.textContent).not.toContain("403");
        expect(alert.textContent).toContain("This account cannot sign in at the moment. Ask an administrator in your organisation to check it.");
    });

    it("keeps the reason on the page instead of in a toast", async () => {
        auth.login.mockRejectedValue(httpError(401, { message: "Invalid email or password" }));

        await signIn();
        expect(toastFns.error).not.toHaveBeenCalled();
    });
});
