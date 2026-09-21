import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { ReactElement } from "react";
import api from "@/lib/axios";
import {
    STEP_UP_CANCELLED_MESSAGE,
    StepUpCancelledError,
    registerStepUpHandler,
    requestStepUp,
    resetStepUpBridge,
    toastActionError,
} from "@/lib/step-up";
import { INVALID_CODE_MESSAGE, MFA_ENROLMENT_MESSAGE, StepUpMfaDialog } from "@/components/security/StepUpMfaDialog";

const toastFn = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { dismiss: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.dismiss = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFn, default: toastFn }));

const mfa = vi.hoisted(() => ({ stepUp: vi.fn() }));
vi.mock("@/services/mfaService", () => ({ mfaService: mfa }));

type Reply = { status: number; data?: unknown };

/** Axios-boundary fake: scripted replies per URL, recorded calls. */
function installAdapter(script: Record<string, Reply[]>) {
    const calls: string[] = [];
    api.defaults.adapter = (config: InternalAxiosRequestConfig) => {
        const url = String(config.url);
        calls.push(url);
        const queue = script[url] ?? [];
        const reply = queue.length > 1 ? queue.shift()! : queue[0] ?? { status: 200, data: {} };
        const response = { status: reply.status, statusText: "", data: reply.data, headers: {}, config } as AxiosResponse;
        return reply.status < 400
            ? Promise.resolve(response)
            : Promise.reject(new AxiosError(`HTTP ${reply.status}`, "ERR_BAD_REQUEST", config, null, response));
    };
    return calls;
}

const stepUpRequired: Reply = { status: 401, data: { errorCode: "MFA_STEP_UP_REQUIRED", message: "Recent MFA authentication is required" } };
const approved: Reply = { status: 200, data: { id: "po-1", status: "APPROVED" } };

const codeInvalidError = (): AxiosError => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    const response = { status: 401, statusText: "", data: { errorCode: "MFA_CODE_INVALID" }, headers: {}, config } as AxiosResponse;
    return new AxiosError("HTTP 401", "ERR_BAD_REQUEST", config, null, response);
};

beforeEach(() => {
    resetStepUpBridge();
    localStorage.setItem("user", JSON.stringify({ email: "approver@example.com" }));
});

afterEach(() => {
    cleanup();
    resetStepUpBridge();
    localStorage.clear();
    vi.clearAllMocks();
});

describe("axios step-up interceptor", () => {
    it("prompts once, then retries the original request and resolves with its response", async () => {
        const calls = installAdapter({ "/purchase-orders/po-1/approve": [stepUpRequired, approved] });
        const handler = vi.fn().mockResolvedValue(undefined);
        registerStepUpHandler(handler);

        const response = await api.post("/purchase-orders/po-1/approve");

        expect(response.data).toEqual(approved.data);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(calls).toEqual(["/purchase-orders/po-1/approve", "/purchase-orders/po-1/approve"]);
    });

    it("retries only once and never treats the step-up 401 as an expired session", async () => {
        const calls = installAdapter({ "/expenses/e-1/approve": [stepUpRequired] });
        const handler = vi.fn().mockResolvedValue(undefined);
        registerStepUpHandler(handler);

        await expect(api.post("/expenses/e-1/approve")).rejects.toMatchObject({ response: { status: 401 } });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(calls).toEqual(["/expenses/e-1/approve", "/expenses/e-1/approve"]);
        expect(calls).not.toContain("/auth/refresh");
        expect(localStorage.getItem("user")).not.toBeNull(); // no clearAuthState / login redirect
    });

    it("rejects with a clear cancellation error when the prompt is dismissed", async () => {
        const calls = installAdapter({ "/roles/r-1": [stepUpRequired] });
        registerStepUpHandler(() => Promise.reject(new StepUpCancelledError()));

        const failure = await api.delete("/roles/r-1").catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(StepUpCancelledError);
        expect((failure as Error).message).toBe(STEP_UP_CANCELLED_MESSAGE);
        expect(calls).toEqual(["/roles/r-1"]);
        expect(localStorage.getItem("user")).not.toBeNull();

        toastActionError(failure, "Failed to delete role");
        expect(toastFn.error).toHaveBeenCalledWith(STEP_UP_CANCELLED_MESSAGE, { id: "step-up-cancelled" });
    });

    it("shares one prompt between concurrent requests", async () => {
        installAdapter({
            "/purchase-orders/a/approve": [stepUpRequired, approved],
            "/purchase-orders/b/approve": [stepUpRequired, approved],
        });
        let finish: () => void = () => undefined;
        const handler = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
        registerStepUpHandler(handler);

        const both = Promise.all([api.post("/purchase-orders/a/approve"), api.post("/purchase-orders/b/approve")]);
        await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
        finish();

        const [a, b] = await both;
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("shows the set-up-MFA toast linking to the profile card on 428 MFA_ENROLMENT_REQUIRED", async () => {
        installAdapter({ "/users/u-1/deactivate": [{ status: 428, data: { errorCode: "MFA_ENROLMENT_REQUIRED" } }] });
        render(<StepUpMfaDialog />);

        const failure = await api.put("/users/u-1/deactivate").catch((error: unknown) => error);

        expect(toastFn).toHaveBeenCalledTimes(1);
        expect(toastFn.mock.calls[0][1]).toMatchObject({ id: "mfa-enrolment-required" });
        const renderToast = toastFn.mock.calls[0][0] as (t: { id: string }) => ReactElement;
        render(renderToast({ id: "t1" }));
        expect(screen.getByText(MFA_ENROLMENT_MESSAGE)).toBeTruthy();
        expect(screen.getByRole("link", { name: "Set up" }).getAttribute("href")).toBe("/profile#two-factor");
        expect(localStorage.getItem("user")).not.toBeNull();

        // The caller's own toast stays quiet — the shell already explained it.
        toastActionError(failure, "Failed to deactivate user");
        expect(toastFn.error).not.toHaveBeenCalled();
    });
});

describe("StepUpMfaDialog", () => {
    const openDialog = () => {
        render(<StepUpMfaDialog />);
        let outcome!: Promise<void>;
        act(() => {
            outcome = requestStepUp();
        });
        return outcome;
    };

    it("is an accessible, focused dialog that submits automatically on 6 digits", async () => {
        mfa.stepUp.mockResolvedValue({ mfaAuthenticatedAt: 1_700_000_000 });
        const outcome = openDialog();

        const dialog = await screen.findByRole("dialog", { name: "Confirm it's you" });
        const input = screen.getByLabelText("Authenticator code") as HTMLInputElement;
        expect(dialog.getAttribute("aria-modal")).toBe("true");
        expect(input.getAttribute("inputmode")).toBe("numeric");
        expect(input.getAttribute("autocomplete")).toBe("one-time-code");
        await waitFor(() => expect(document.activeElement).toBe(input));

        fireEvent.change(input, { target: { value: "12a3456" } });

        await expect(outcome).resolves.toBeUndefined();
        expect(mfa.stepUp).toHaveBeenCalledWith("123456");
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("keeps the prompt open with an error for an invalid code", async () => {
        mfa.stepUp.mockRejectedValueOnce(codeInvalidError()).mockResolvedValueOnce({ mfaAuthenticatedAt: 1 });
        const outcome = openDialog();
        const input = await screen.findByLabelText("Authenticator code");

        fireEvent.change(input, { target: { value: "000000" } });

        expect((await screen.findByRole("alert")).textContent).toBe(INVALID_CODE_MESSAGE);
        expect(screen.getByRole("dialog")).toBeTruthy();
        expect((input as HTMLInputElement).value).toBe("");

        fireEvent.change(input, { target: { value: "654321" } });
        await expect(outcome).resolves.toBeUndefined();
        expect(mfa.stepUp).toHaveBeenLastCalledWith("654321");
    });

    it("cancels on Escape with a StepUpCancelledError", async () => {
        const outcome = openDialog();
        const dialog = await screen.findByRole("dialog");

        fireEvent.keyDown(dialog, { key: "Escape" });

        await expect(outcome).rejects.toBeInstanceOf(StepUpCancelledError);
        expect(mfa.stepUp).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
});
