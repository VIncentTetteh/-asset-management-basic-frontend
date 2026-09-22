/**
 * Guards for URLs that come from data (API records, user input) and end up in an
 * `href` or `window.open`.
 *
 * A stored `javascript:` (or `data:` / `vbscript:`) URL rendered as a link runs
 * script in the app's origin when clicked: stored XSS. Browsers ignore leading
 * whitespace and control characters and match the scheme case-insensitively, so
 * a prefix check is not enough; the value is parsed with the WHATWG URL parser
 * (which applies the same normalisation) and only absolute http(s) URLs pass.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * The URL, normalised, when it is an absolute http: or https: URL; otherwise null
 * (javascript:, data:, vbscript:, mailto:, relative paths, garbage).
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return null;
    }
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.href : null;
}

/**
 * An in-app path ("/purchase-orders?id=…") safe for router navigation; null for
 * anything else, including protocol-relative ("//evil.example") and backslash
 * ("/\\evil.example") forms that browsers treat as another origin.
 */
export function safeInternalPath(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
    // Control characters (e.g. a tab after the slash) are stripped by URL parsers.
    if (/[\u0000-\u001f\u007f]/.test(value)) return null;
    return value;
}
