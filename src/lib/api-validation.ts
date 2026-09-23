import axios from "axios";
import { toast } from "react-hot-toast";
import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form";
import { extractErrorMessage } from "@/lib/error";
import { isMfaEnrolmentRequiredError, isStepUpCancelledError, toastActionError } from "@/lib/step-up";

/**
 * Backend validation errors → form field errors.
 *
 * GlobalExceptionHandler puts field-level problems in one `errors: { field: message }`
 * map, whatever caused them:
 * - a failed `@Valid`: `400 VALIDATION_FAILED`, e.g. `{ name: "size must be between 0 and 255" }`;
 * - a NOT NULL column the request left empty: `400 VALIDATION_FAILED`, `{ categoryId: "is required" }`;
 * - a unique index: `409 DUPLICATE`, `{ assetTag: "already in use" }`.
 * Database errors with no identifiable field (`VALUE_TOO_LONG`, `NUMBER_OUT_OF_RANGE`,
 * `CHECK_VIOLATION`, `IN_USE`) carry only a message.
 *
 * Forms used to show a generic "Failed to save" for these, hiding which field was
 * wrong. {@link reportApiError} puts each message on its react-hook-form field and
 * lists the fields in one toast; any other failure toasts the server's message.
 */

export const VALIDATION_FAILED = "VALIDATION_FAILED";
export const DUPLICATE = "DUPLICATE";

/** The backend `errorCode` of a failed request, if any. */
export function getApiErrorCode(error: unknown): string | undefined {
    if (!axios.isAxiosError(error)) return undefined;
    const code = (error.response?.data as { errorCode?: unknown } | undefined)?.errorCode;
    return typeof code === "string" ? code : undefined;
}

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

// ── Client-side rule failures ─────────────────────────────────────────────────

/**
 * Flattens react-hook-form's nested error tree to `{ "lineItems.0.quantity": message }`.
 * Only leaves with a `message` (or a `type`) are fields; the rest are containers.
 */
function flattenFormErrors(errors: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
    if (!errors || typeof errors !== "object") return out;
    const node = errors as Record<string, unknown> & { message?: unknown; type?: unknown };
    if (typeof node.message === "string" || typeof node.type === "string") {
        const message = typeof node.message === "string" && node.message.trim() ? node.message : "is invalid";
        if (prefix) out[prefix] = message;
        return out;
    }
    for (const [key, value] of Object.entries(node)) {
        if (key === "ref" || key === "root" || key === "types") continue;
        flattenFormErrors(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
}

/**
 * `handleSubmit`'s invalid handler, for every form in the app.
 *
 * Without one, react-hook-form silently refuses to submit: it fills `formState.errors`
 * and returns. That is only visible if the failing field happens to render a
 * {@link FieldError} right then — a field that is conditionally hidden, collapsed
 * behind a tab, scrolled far off, or (as on the purchase-order form) replaced by a
 * hint when another field is set, fails with no feedback at all and the user is left
 * clicking Save. This toasts the same "Please fix these fields" summary a server-side
 * `VALIDATION_FAILED` gets from {@link reportApiError}, so a refused save always says
 * something, and focuses the first offending field.
 *
 * Usage: `onSubmit={handleSubmit(onSubmit, reportFormErrors)}`.
 */
export function reportFormErrors<T extends FieldValues>(errors: FieldErrors<T>): void {
    const fieldErrors = flattenFormErrors(errors);
    const fields = Object.keys(fieldErrors);
    if (fields.length === 0) {
        // Defensive: react-hook-form should never call this with an empty tree.
        toast.error("Some fields need fixing before this can be saved");
        return;
    }
    const lines = describeFieldErrors(fieldErrors);
    toast.error(`Please fix ${fields.length === 1 ? "this field" : "these fields"}:\n${lines.join("\n")}`);
    focusFirstError(errors);
}

/** Scrolls to and focuses the first field with an error, so the user can see it. */
function focusFirstError(errors: unknown): void {
    if (!errors || typeof errors !== "object") return;
    const node = errors as { ref?: unknown };
    const ref = node.ref as { focus?: () => void; scrollIntoView?: (options?: ScrollIntoViewOptions) => void } | undefined;
    if (ref && typeof ref.focus === "function") {
        ref.scrollIntoView?.({ block: "center" });
        ref.focus();
        return;
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
        if (value && typeof value === "object") {
            focusFirstError(value);
            return;
        }
    }
}
