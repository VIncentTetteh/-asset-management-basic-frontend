import type { ImportRowIssue } from "@/services/importService";

/**
 * Rows the import could not take, rendered as something the user can act on:
 * a CSV they open next to their own sheet, or text they paste into a ticket.
 *
 * Errors now arrive from the server already carrying the heading *as the user
 * wrote it*, so nothing is merged or reconstructed here any more. The one
 * defensive act left is row 0: the API guarantees it never sends one, and if
 * one ever appears it is shown without a row number rather than as a row the
 * user will go looking for and never find.
 */

export interface FailedRow {
    /** 1-based row in the user's file. 0 means "the server did not say which row". */
    rowNumber: number;
    column?: string;
    message: string;
}

/** A row's label, or null when there is no row number worth showing. */
export function rowLabel(rowNumber: number): string | null {
    return rowNumber > 0 ? `Row ${rowNumber}` : null;
}

/** Row issues as the failed-row list, copy and download all read. */
export function failedRows(issues: readonly ImportRowIssue[] | undefined): FailedRow[] {
    return (issues ?? [])
        .filter((issue) => issue != null)
        .map((issue) => ({
            rowNumber: Number.isFinite(issue.row) ? Number(issue.row) : 0,
            column: issue.column?.trim() || undefined,
            message: issue.message?.trim() || "Rejected without a reason given",
        }));
}

const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;

/** `Row,Column,Problem` — openable in Excel next to the sheet they uploaded. */
export function failedRowsCsv(rows: readonly FailedRow[]): string {
    const lines = ["Row,Column,Problem"];
    for (const row of rows) {
        lines.push([row.rowNumber > 0 ? String(row.rowNumber) : "", escapeCsv(row.column ?? ""), escapeCsv(row.message)].join(","));
    }
    return lines.join("\r\n");
}

/** The same list as plain text, for pasting into an email or a ticket. */
export function failedRowsText(rows: readonly FailedRow[]): string {
    return rows
        .map((row) => [rowLabel(row.rowNumber), row.column, row.message].filter(Boolean).join(" · "))
        .join("\n");
}

/** Saves text to the user's machine. No-op outside a browser (static export prerender). */
export function downloadTextFile(filename: string, contents: string, mimeType = "text/csv"): void {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}
