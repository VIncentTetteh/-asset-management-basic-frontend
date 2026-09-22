/**
 * Calendar dates (backend `LocalDate`, sent as "YYYY-MM-DD") without timezone
 * shifts.
 *
 * `new Date("2026-03-05")` is parsed as UTC midnight, so west of UTC it displays
 * as 4 March; and `new Date().toISOString().split("T")[0]` is the UTC day, so a
 * form opened in the evening in the Americas (or after midnight east of UTC)
 * defaults to the wrong day. These helpers keep calendar dates in local time.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number): string => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for the given instant in the viewer's timezone. */
export function toLocalIsoDate(date: Date = new Date()): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today in the viewer's timezone, as "YYYY-MM-DD" (the value a date input expects). */
export function todayLocal(): string {
    return toLocalIsoDate(new Date());
}

/**
 * Parses a date-only string as local midnight. Full timestamps (instants) are
 * parsed normally. Returns null for empty or invalid input.
 */
export function parseLocalDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const m = DATE_ONLY.exec(value.trim());
    if (m) {
        const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export interface FormatLocalDateOptions extends Intl.DateTimeFormatOptions {
    /** BCP 47 locale; defaults to the browser's. */
    locale?: string;
    /** Returned for empty or unparseable input. Defaults to "—". */
    fallback?: string;
}

/**
 * Formats a calendar date ("YYYY-MM-DD") for display without a UTC shift. Also
 * accepts full ISO timestamps, which are shown in the viewer's timezone.
 */
export function formatLocalDate(value: string | null | undefined, options: FormatLocalDateOptions = {}): string {
    const { locale, fallback = "—", ...intl } = options;
    const date = parseLocalDate(value);
    return date ? date.toLocaleDateString(locale, intl) : fallback;
}

/**
 * Value for an `<input type="date">` from a stored date: a date-only string is
 * kept as is, a timestamp becomes its local calendar day, anything else "".
 */
export function toDateInputValue(value: string | null | undefined): string {
    if (!value) return "";
    const trimmed = value.trim();
    if (DATE_ONLY.test(trimmed)) return trimmed;
    const date = parseLocalDate(trimmed);
    return date ? toLocalIsoDate(date) : "";
}
