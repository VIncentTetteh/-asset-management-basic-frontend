"use client"; // Error boundaries must be Client Components.

import { useEffect, useState } from "react";
import { hasRecentlyReloaded, isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-recovery";

/**
 * The boundary of last resort: it catches failures in the root layout itself,
 * which `error.tsx` cannot, and replaces the whole document when it does.
 *
 * Two constraints come straight from the docs
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md):
 *
 *  1. It must render its own `<html>` and `<body>` — it *is* the document.
 *  2. It does not get the app's global stylesheet, and the app-level theme
 *     attribute set on `<html>` by the root layout is gone with the layout.
 *     So everything here is inline: no Tailwind classes, no tokens, no
 *     imported components. Anything imported from the app could be the very
 *     module that failed to load.
 *
 * The theme is re-derived here rather than inherited, for the same reason the
 * root layout sets it from an inline script: a dark-mode user should not be
 * flashbanged by a white error page.
 *
 * `metadata` is unavailable in a Client Component, so the tab title is set
 * with React's `<title>`.
 */

const CSS = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #f8fafc;
  color: #0f172a;
  font: 400 15px/1.55 ui-sans-serif, system-ui, "Segoe UI", sans-serif;
}
.ge-card { width: 100%; max-width: 30rem; text-align: center; }
.ge-title { margin: 0 0 8px; font-size: 19px; font-weight: 650; outline: none; }
.ge-title:focus-visible { outline: 2px solid #0f766e; outline-offset: 4px; }
.ge-body { margin: 0 0 20px; font-size: 14px; color: #475569; }
.ge-actions { display: flex; flex-direction: column; gap: 8px; }
@media (min-width: 480px) { .ge-actions { flex-direction: row; justify-content: center; } }
.ge-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 40px; padding: 0 18px; border-radius: 8px;
  font: inherit; font-weight: 600; font-size: 14px;
  cursor: pointer; text-decoration: none;
  border: 1px solid transparent; transition: opacity .15s ease;
}
.ge-btn:focus-visible { outline: 2px solid #0f766e; outline-offset: 2px; }
.ge-primary { background: #0f766e; color: #fff; }
.ge-secondary { background: transparent; color: #0f172a; border-color: #cbd5e1; }
.ge-ref { margin: 18px 0 0; font-size: 11px; color: #94a3b8; }
.ge-ref code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
@media (prefers-reduced-motion: reduce) { .ge-btn { transition: none; } }
html[data-theme="dark"] body, body[data-theme="dark"] {
  background: #0b1220; color: #e2e8f0;
}
html[data-theme="dark"] .ge-body { color: #94a3b8; }
html[data-theme="dark"] .ge-secondary { color: #e2e8f0; border-color: #334155; }
@media (prefers-color-scheme: dark) {
  html:not([data-theme="light"]) body { background: #0b1220; color: #e2e8f0; }
  html:not([data-theme="light"]) .ge-body { color: #94a3b8; }
  html:not([data-theme="light"]) .ge-secondary { color: #e2e8f0; border-color: #334155; }
}
`;

/** Mirrors the root layout's boot script; this document never ran that script. */
const THEME_SCRIPT = `
try {
  var t = localStorage.getItem("assetiq-theme");
  if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.dataset.theme = "dark";
  } else if (t === "light") {
    document.documentElement.dataset.theme = "light";
  }
} catch (e) {}
`;

export default function GlobalError({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    const staleBuild = isChunkLoadError(error);
    const [recovering] = useState(
        () => typeof window !== "undefined" && staleBuild && !hasRecentlyReloaded(),
    );

    useEffect(() => {
        if (recoverFromChunkError(error)) return;
        console.error("Root layout render failed", { digest: error.digest, message: error.message });
    }, [error]);

    const title = staleBuild
        ? "AssetIQ was updated while this tab was open"
        : "AssetIQ couldn't start";
    const body = staleBuild
        ? "This tab is still running the older version. Reloading picks up the new one."
        : "Something went wrong before the page could be drawn. Your data is safe — reloading usually fixes it.";

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <title>AssetIQ — something went wrong</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
                <style dangerouslySetInnerHTML={{ __html: CSS }} />
            </head>
            <body>
                {recovering ? (
                    <p role="status" aria-live="polite" className="ge-body">
                        Updating AssetIQ to the latest version…
                    </p>
                ) : (
                    <div className="ge-card">
                        {/* autoFocus moves focus here so a screen reader announces the
                            new document and Tab lands on the actions below. */}
                        <h1 className="ge-title" tabIndex={-1} role="alert" autoFocus>
                            {title}
                        </h1>
                        <p className="ge-body">{body}</p>
                        <div className="ge-actions">
                            <button
                                type="button"
                                className="ge-btn ge-primary"
                                onClick={() => (staleBuild ? window.location.reload() : retry())}
                            >
                                {staleBuild ? "Reload the page" : "Try again"}
                            </button>
                            <a className="ge-btn ge-secondary" href="/dashboard">
                                Go to dashboard
                            </a>
                        </div>
                        {error?.digest ? (
                            <p className="ge-ref">
                                If it keeps happening, quote reference <code>{error.digest}</code> to support.
                            </p>
                        ) : null}
                    </div>
                )}
            </body>
        </html>
    );
}
