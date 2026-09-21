import axios from "axios";
import { toast } from "react-hot-toast";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { extractErrorMessage } from "@/lib/error";
import { isMfaEnrolmentRequiredError, isStepUpCancelledError, toastActionError } from "@/lib/step-up";

/**
 * Backend validation errors → form field errors.
 *
 * GlobalExceptionHandler answers a failed `@Valid` with
 * `400 { errorCode: "VALIDATION_FAILED", message: "Validation failed", errors: { field: message } }`.
 * Forms used to show a generic "Failed to save" for that, hiding which field was
 * wrong. {@link reportApiError} puts each message on its react-hook-form field and
 * lists the fields in one toast; any other failure toasts the server's message.
 */

export const VALIDATION_FAILED = "VALIDATION_FAILED";

/** The `errors` map of a backend validation failure, or `{}` for any other error. */
export function getApiFieldErrors(error: unknown): Record<string, string> {
    if (!axios.isAxiosError(error)) return {};
    const data = error.response?.data as { errors?: unknown } | undefined;
    const errors = data?.errors;
    if (!errors || typeof errors !== "object" || Array.isArray(errors)) return {};
    const out: Record<string, string> = {};
    for (const [field, message] of Object.entries(errors as Record<string, unknown>)) {
        if (typeof message === "string" && message.trim()) out[field] = message;
        else if (message != null) out[field] = "is invalid";
    }
    return out;
}

/** "periodStart" → "Period start"; nested paths use their last segment. */
export function humaniseField(field: string): string {
    const leaf = field.split(".").pop() ?? field;
    const spaced = leaf.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** One line per field, e.g. `Period start: must not be null`. */
export function describeFieldErrors(
    fieldErrors: Record<string, string>,
    labels: Record<string, string> = {},
): string[] {
    return Object.entries(fieldErrors).map(([field, message]) => `${labels[field] ?? humaniseField(field)}: ${message}`);
}

export interface ReportApiErrorOptions<T extends FieldValues> {
    /** Shown when the server gives no usable message. */
    fallback: string;
    /** Puts each server field error on the matching form field. */
    setError?: UseFormSetError<T>;
    /** Friendly names for fields whose API name differs from the label, e.g. `{ notes: "Key terms" }`. */
    labels?: Record<string, string>;
    /** Maps an API field to the form field that renders it, e.g. `{ name: "productName" }`. */
    fieldMap?: Record<string, Path<T>>;
}

/**
 * Puts each server field error on its form field (no toast). Use when a shared
 * mutation hook already toasts. Returns how many fields were marked.
 */
export function applyApiFieldErrors<T extends FieldValues>(
    error: unknown,
    setError: UseFormSetError<T>,
    fieldMap: Record<string, Path<T>> = {},
): number {
    const fieldErrors = getApiFieldErrors(error);
    const fields = Object.keys(fieldErrors);
    for (const field of fields) {
        setError((fieldMap[field] ?? field) as Path<T>, { type: "server", message: fieldErrors[field] });
    }
    return fields.length;
}

/**
 * Reports a failed save. Returns true when the failure was a field-level
 * validation error (already mapped onto the form and toasted).
 */
export function reportApiError<T extends FieldValues>(error: unknown, options: ReportApiErrorOptions<T>): boolean {
    if (isStepUpCancelledError(error) || isMfaEnrolmentRequiredError(error)) {
        toastActionError(error, options.fallback);
        return false;
    }
    const fieldErrors = getApiFieldErrors(error);
    const fields = Object.keys(fieldErrors);
    if (fields.length === 0) {
        toast.error(extractErrorMessage(error, options.fallback));
        return false;
    }
    if (options.setError) {
        applyApiFieldErrors(error, options.setError, options.fieldMap);
    }
    const lines = describeFieldErrors(fieldErrors, options.labels);
    toast.error(`Please fix ${fields.length === 1 ? "this field" : "these fields"}:\n${lines.join("\n")}`);
    return true;
}
