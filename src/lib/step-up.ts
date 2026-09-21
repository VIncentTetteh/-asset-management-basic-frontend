import axios from "axios";
import { toast } from "react-hot-toast";

/**
 * Step-up MFA bridge.
 *
 * High-impact actions (approvals, role/user admin, SSO writes) require a token
 * minted within the last few minutes of an authenticator check. When the API
 * answers 401 MFA_STEP_UP_REQUIRED, the axios interceptor asks this module for a
 * step-up; the app shell's <StepUpMfaDialog> registers the handler that shows the
 * code prompt. The interceptor never imports React, and the dialog never imports
 * axios internals — this file is the only seam between them.
 */

export const MFA_STEP_UP_REQUIRED = "MFA_STEP_UP_REQUIRED";
export const MFA_ENROLMENT_REQUIRED = "MFA_ENROLMENT_REQUIRED";
export const MFA_CODE_INVALID = "MFA_CODE_INVALID";

/** Window event raised when an action needs MFA the user has not set up. */
export const MFA_ENROLMENT_REQUIRED_EVENT = "mfa-enrolment-required";

/** Where the profile page renders its two-factor setup card. */
export const MFA_SETUP_ANCHOR = "two-factor";
export const MFA_SETUP_PATH = `/profile#${MFA_SETUP_ANCHOR}`;

export const STEP_UP_CANCELLED_MESSAGE = "Approval cancelled — authenticator code required";
const STEP_UP_CANCELLED_TOAST_ID = "step-up-cancelled";

/** Rejection used when the user dismisses the step-up prompt (or none is mounted). */
export class StepUpCancelledError extends Error {
    constructor(message: string = STEP_UP_CANCELLED_MESSAGE) {
        super(message);
        this.name = "StepUpCancelledError";
    }
}

/** The API's machine-readable `errorCode`, when the error carries one. */
export function getApiErrorCode(error: unknown): string | undefined {
    if (!axios.isAxiosError(error)) return undefined;
    const data = error.response?.data as { errorCode?: unknown } | undefined;
    return typeof data?.errorCode === "string" ? data.errorCode : undefined;
}

export const isStepUpRequiredError = (error: unknown): boolean =>
    axios.isAxiosError(error)
    && error.response?.status === 401
    && getApiErrorCode(error) === MFA_STEP_UP_REQUIRED;

export const isMfaEnrolmentRequiredError = (error: unknown): boolean =>
    axios.isAxiosError(error)
    && error.response?.status === 428
    && getApiErrorCode(error) === MFA_ENROLMENT_REQUIRED;

export const isMfaCodeInvalidError = (error: unknown): boolean =>
    axios.isAxiosError(error)
    && error.response?.status === 401
    && getApiErrorCode(error) === MFA_CODE_INVALID;

export const isStepUpCancelledError = (error: unknown): error is StepUpCancelledError =>
    error instanceof StepUpCancelledError;

// ── Handler registry ─────────────────────────────────────────────────────────

/** Resolves once a fresh MFA token is in place; rejects StepUpCancelledError otherwise. */
export type StepUpHandler = () => Promise<void>;

let activeHandler: StepUpHandler | null = null;
let pendingStepUp: Promise<void> | null = null;

/** Registers the dialog that performs step-up. Returns an unregister function. */
export function registerStepUpHandler(handler: StepUpHandler): () => void {
    activeHandler = handler;
    return () => {
        if (activeHandler === handler) activeHandler = null;
    };
}

/**
 * Asks the registered dialog for a step-up. Concurrent callers share the same
 * in-flight prompt, so several parallel approvals open exactly one dialog and all
 * retry once it succeeds (or all fail once it is cancelled).
 */
export function requestStepUp(): Promise<void> {
    if (pendingStepUp) return pendingStepUp;
    if (!activeHandler) return Promise.reject(new StepUpCancelledError());
    pendingStepUp = activeHandler().finally(() => {
        pendingStepUp = null;
    });
    return pendingStepUp;
}

/** Test seam: drop any registered handler and in-flight prompt. */
export function resetStepUpBridge(): void {
    activeHandler = null;
    pendingStepUp = null;
}

// ── Caller helper ────────────────────────────────────────────────────────────

/**
 * Error toast for an action that may have gone through step-up. A cancelled
 * prompt gets one deduplicated "cancelled" toast; an enrolment-required failure
 * is silent here because the app shell already showed the set-up-MFA toast.
 */
export function toastActionError(error: unknown, fallback: string): void {
    if (isStepUpCancelledError(error)) {
        toast.error(error.message, { id: STEP_UP_CANCELLED_TOAST_ID });
        return;
    }
    if (isMfaEnrolmentRequiredError(error)) return;
    toast.error(fallback);
}
