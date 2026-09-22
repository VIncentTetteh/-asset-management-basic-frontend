import type { FieldError as RhfFieldError } from "react-hook-form";
import { cn } from "@/lib/utils";

/**
 * The one way forms show a field's error: a react-hook-form rule failure or a
 * server error mapped onto the field by `applyApiFieldErrors` / `reportApiError`
 * (Bean Validation `VALIDATION_FAILED` and database `DUPLICATE` errors both
 * arrive as `errors: { field: message }`). Renders nothing without an error.
 *
 * `fallback` covers rules registered without a message (e.g. `required: true`).
 */
export function FieldError({
    error,
    fallback = "This field is invalid",
    id,
    className,
}: {
    error?: Pick<RhfFieldError, "message"> | { message?: unknown } | null;
    fallback?: string;
    id?: string;
    className?: string;
}) {
    if (!error) return null;
    const message = typeof error.message === "string" && error.message.trim() ? error.message : fallback;
    return (
        <p id={id} role="alert" className={cn("text-sm text-danger", className)}>
            {message}
        </p>
    );
}
