import type { ImportJobError } from "@/services/importJobService";
import type { ImportPreviewRow } from "@/services/importService";

/**
 * Rows the import could not take, rendered as something the user can act on:
 * a CSV they open next to their own sheet, or text they paste into a ticket.
 *
 * A job's errors only carry a row number and a message; the preview knows
 * which of *their* columns each problem came from, so the two are merged when
 * both are available.
 */

export interface FailedRow {
    rowNumber: number;
    column?: string;
    message: string;
}

/** Job errors, given back the column names the preview found for the same rows. */
export function mergeFailedRows(
    jobErrors: readonly ImportJobError[] | undefined,
    previewRows: readonly ImportPreviewRow[] | undefined,
): FailedRow[] {
    const columnsByRow = new Map<number, string>();
    for (const row of previewRows ?? []) {
        const named = row.errors?.find((error) => error.column?.trim());
        if (named?.column) columnsByRow.set(row.rowNumber, named.column);
    }
    return (jobErrors ?? [])
        .filter((error) => error != null)
        .map((error) => ({
            rowNumber: error.row ?? 0,
            column: columnsByRow.get(error.row ?? -1),
            message: error.message?.trim() || "Rejected without a reason given",
        }));
}

/** Preview errors flattened one-per-problem, for the preview step's list. */
export function flattenPreviewRows(rows: readonly ImportPreviewRow[] | undefined): FailedRow[] {
    const out: FailedRow[] = [];
    for (const row of rows ?? []) {
        for (const error of row.errors ?? []) {
            out.push({
                rowNumber: row.rowNumber,
                column: error.column?.trim() || undefined,
                message: error.message?.trim() || "This value was rejected",
            });
        }
    }
    return out;
}

const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;

/** `Row,Column,Problem` — openable in Excel next to the sheet they uploaded. */
export function failedRowsCsv(rows: readonly FailedRow[]): string {
    const lines = ["Row,Column,Problem"];
    for (const row of rows) {
        lines.push([String(row.rowNumber), escapeCsv(row.column ?? ""), escapeCsv(row.message)].join(","));
    }
    return lines.join("\r\n");
}

/** The same list as plain text, for pasting into an email or a ticket. */
export function failedRowsText(rows: readonly FailedRow[]): string {
    return rows
        .map((row) => (row.column ? `Row ${row.rowNumber} · ${row.column}: ${row.message}` : `Row ${row.rowNumber}: ${row.message}`))
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
