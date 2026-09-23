/**
 * What the importer accepts, mirrored from the backend so a file that would be
 * rejected server-side is refused here with a sentence the user can act on
 * (`spring.servlet.multipart.max-file-size`, default 25MB, and the xlsx/csv
 * parsers behind `/imports/{type}/analyse`).
 */

export const IMPORT_MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Extensions the analyser can read. */
export const IMPORT_ACCEPTED_EXTENSIONS = [".xlsx", ".csv"] as const;

/** The `accept` attribute for the file input, extensions plus their media types. */
export const IMPORT_FILE_ACCEPT = [
    ".xlsx",
    ".csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
].join(",");

export function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} bytes`;
}

/**
 * Why a chosen file cannot be used, or `null` when it can.
 *
 * `.xls` is called out on its own: it is the single most common wrong choice
 * and "unsupported file type" does not tell the user what to do about it.
 */
export function rejectImportFile(file: File): string | null {
    const name = file.name ?? "";
    const lower = name.toLowerCase();
    if (lower.endsWith(".xls")) {
        return "AssetIQ cannot read the older .xls format. Open the file in Excel and use File → Save As → Excel Workbook (.xlsx).";
    }
    if (!IMPORT_ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
        return `${name || "That file"} is not a spreadsheet AssetIQ can read. Choose an .xlsx or .csv file.`;
    }
    if (file.size === 0) {
        return `${name} is empty — there are no rows to import.`;
    }
    if (file.size > IMPORT_MAX_FILE_BYTES) {
        return `${name} is ${formatBytes(file.size)}. The limit is ${formatBytes(
            IMPORT_MAX_FILE_BYTES,
        )} — split the sheet and import it in parts.`;
    }
    return null;
}
