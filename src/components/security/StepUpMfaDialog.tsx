"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import axios from "axios";
import { toast } from "react-hot-toast";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mfaService } from "@/services/mfaService";
import { extractErrorMessage } from "@/lib/error";
import {
    MFA_ENROLMENT_REQUIRED_EVENT,
    MFA_SETUP_PATH,
    StepUpCancelledError,
    isMfaCodeInvalidError,
    isMfaEnrolmentRequiredError,
    registerStepUpHandler,
} from "@/lib/step-up";

const CODE_LENGTH = 6;
const ENROLMENT_TOAST_ID = "mfa-enrolment-required";
const ENROLMENT_TOAST_MS = 8000;
const HTTP_TOO_MANY_REQUESTS = 429;

export const MFA_ENROLMENT_MESSAGE = "Set up two-factor authentication to approve";
export const INVALID_CODE_MESSAGE = "That code didn't match. Check your authenticator app and try again.";
const RATE_LIMITED_MESSAGE = "Too many attempts. Wait a minute, then try again.";

/** Non-blocking nudge for users with no authenticator, linking to the profile setup card. */
export function showMfaEnrolmentNotice(): void {
    toast(
        (t) => (
            <span className="flex items-center gap-3 text-sm">
                <span>{MFA_ENROLMENT_MESSAGE}</span>
                <Link
                    href={MFA_SETUP_PATH}
                    onClick={() => toast.dismiss(t.id)}
                    className="shrink-0 font-semibold text-brand underline underline-offset-4"
                >
                    Set up
                </Link>
            </span>
        ),
        { id: ENROLMENT_TOAST_ID, duration: ENROLMENT_TOAST_MS },
    );
}

interface Settle {
    resolve: () => void;
    reject: (error: Error) => void;
}

/**
 * App-wide step-up MFA prompt. Mounted once in the app shell; the axios
 * interceptor opens it (via lib/step-up) when an action answers
 * 401 MFA_STEP_UP_REQUIRED, and retries the action once the code verifies.
 */
export function StepUpMfaDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const settleRef = useRef<Settle | null>(null);
    const submittingRef = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    const errorId = useId();

    const settle = useCallback((outcome: { ok: true } | { ok: false; error: Error }) => {
        const pending = settleRef.current;
        settleRef.current = null;
        setIsOpen(false);
        setCode("");
        setError(null);
        if (!pending) return;
        if (outcome.ok) pending.resolve();
        else pending.reject(outcome.error);
    }, []);

    const cancel = useCallback(() => settle({ ok: false, error: new StepUpCancelledError() }), [settle]);

    useEffect(() => {
        const unregister = registerStepUpHandler(() => new Promise<void>((resolve, reject) => {
            settleRef.current = { resolve, reject };
            setCode("");
            setError(null);
            setIsOpen(true);
        }));
        return () => {
            unregister();
            // Never leave a request hanging on a prompt that no longer exists.
            settleRef.current?.reject(new StepUpCancelledError());
            settleRef.current = null;
        };
    }, []);

    useEffect(() => {
        window.addEventListener(MFA_ENROLMENT_REQUIRED_EVENT, showMfaEnrolmentNotice);
        return () => window.removeEventListener(MFA_ENROLMENT_REQUIRED_EVENT, showMfaEnrolmentNotice);
    }, []);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const submit = async (value: string) => {
        if (value.length !== CODE_LENGTH || submittingRef.current) return;
        submittingRef.current = true;
        setIsSubmitting(true);
        setError(null);
        try {
            await mfaService.stepUp(value);
            settle({ ok: true });
        } catch (err) {
            if (isMfaEnrolmentRequiredError(err)) {
                // The interceptor has already shown the set-up toast.
                settle({ ok: false, error: err as Error });
                return;
            }
            if (isMfaCodeInvalidError(err)) {
                setError(INVALID_CODE_MESSAGE);
            } else if (axios.isAxiosError(err) && err.response?.status === HTTP_TOO_MANY_REQUESTS) {
                setError(RATE_LIMITED_MESSAGE);
            } else {
                setError(extractErrorMessage(err, "Could not verify the code. Try again."));
            }
            setCode("");
            window.setTimeout(() => inputRef.current?.focus(), 0);
        } finally {
            submittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const onChange = (event: ChangeEvent<HTMLInputElement>) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
        setCode(digits);
        if (error) setError(null);
        if (digits.length === CODE_LENGTH) void submit(digits);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            cancel();
        }
    };

    if (!isOpen || typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                onKeyDown={onKeyDown}
                className="w-full max-w-sm rounded-panel border border-edge bg-surface p-6 text-foreground shadow-lg"
            >
                <div className="mb-4 flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    <div>
                        <h2 id={titleId} className="text-lg font-bold">Confirm it&apos;s you</h2>
                        <p id={descriptionId} className="mt-1 text-sm text-muted-fg">
                            Enter the 6-digit code from your authenticator app to continue.
                        </p>
                    </div>
                </div>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit(code);
                    }}
                    className="space-y-4"
                >
                    <label htmlFor={`${titleId}-code`} className="sr-only">Authenticator code</label>
                    <Input
                        id={`${titleId}-code`}
                        ref={inputRef}
                        value={code}
                        onChange={onChange}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={CODE_LENGTH}
                        placeholder="000000"
                        disabled={isSubmitting}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        className="data-mono h-11 text-center text-lg tracking-[0.4em]"
                    />
                    {error ? (
                        <p id={errorId} role="alert" className="text-sm text-danger">{error}</p>
                    ) : null}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} disabled={code.length !== CODE_LENGTH}>
                            {isSubmitting ? "Verifying…" : "Verify"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
