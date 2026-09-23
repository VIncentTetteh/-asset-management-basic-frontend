"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError } from "@/lib/chunk-recovery";

/**
 * What the user sees when a route has actually broken.
 *
 * This is the last resort, not the first. A failed API call is an `<Alert>`
 * inside the page; a stale chunk is recovered silently by a reload. Something
 * reaches here only when rendering itself threw, so the screen has one job:
 * say what happened in a sentence the user can act on, and give them two ways
 * out that both work.
 *
 * Deliberately absent: the error message, the stack, the component name. None
 * of it means anything to the person reading it, and in production Next.js
 * replaces a server-side message with a digest anyway. The digest is shown —
 * quietly — because support can match it to a log line.
 */

export type ErrorKind = "offline" | "stale-build" | "unknown";

/** Plain-language copy per kind. No jargon, no blame, no "unexpected error". */
const COPY: Record<ErrorKind, { title: string; body: string; retryLabel: string }> = {
    offline: {
        title: "You appear to be offline",
        body: "This page needs a connection to load. Check your network, then try again — nothing you had open has been lost.",
        retryLabel: "Try again",
    },
    "stale-build": {
        title: "AssetIQ was updated while this tab was open",
        body: "This tab is still running the older version and can't load the rest of the page. Reloading picks up the new one.",
        retryLabel: "Reload the page",
    },
    unknown: {
        title: "This page didn't load",
        body: "Something went wrong while putting this page together. Your data is safe — trying again usually fixes it.",
        retryLabel: "Try again",
    },
};

export function classifyError(error: unknown, online = true): ErrorKind {
    if (!online) return "offline";
    if (isChunkLoadError(error)) return "stale-build";
    return "unknown";
}

export interface ErrorScreenProps {
    error?: (Error & { digest?: string }) | null;
    /**
     * Re-renders the segment. `error.tsx` passes Next's `retry`, which re-runs
     * the boundary's children inside a transition rather than reloading the
     * document — see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
     */
    onRetry?: () => void;
    /** Where "back to a working page" goes. */
    homeHref?: string;
    homeLabel?: string;
}

export function ErrorScreen({
    error,
    onRetry,
    homeHref = "/dashboard",
    homeLabel = "Go to dashboard",
}: ErrorScreenProps) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    const [online, setOnline] = useState(true);
    const [retrying, setRetrying] = useState(false);

    // navigator.onLine is only readable in the browser, and reading it during
    // render would differ between the prerendered HTML and the client.
    useEffect(() => {
        const sync = () => setOnline(navigator.onLine);
        sync();
        window.addEventListener("online", sync);
        window.addEventListener("offline", sync);
        return () => {
            window.removeEventListener("online", sync);
            window.removeEventListener("offline", sync);
        };
    }, []);

    // A keyboard or screen-reader user needs to be told the page changed under
    // them. Moving focus to the heading does that, and puts Tab in the right
    // place for the two buttons below it.
    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    const kind = classifyError(error, online);
    const copy = COPY[kind];

    const retry = () => {
        setRetrying(true);
        try {
            // A stale build cannot be fixed by re-rendering — the chunk the
            // render needs is gone from the origin. Only a document reload
            // fetches a fresh manifest.
            if (kind === "stale-build" || !onRetry) {
                window.location.reload();
                return;
            }
            onRetry();
        } finally {
            // If onRetry() succeeded this component is already unmounted; if it
            // threw again, the button must not stay stuck on "Retrying…".
            setRetrying(false);
        }
    };

    return (
        <div
            data-testid="error-screen"
            data-error-kind={kind}
            className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center"
        >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
                <RotateCcw aria-hidden="true" className="h-5 w-5" />
            </div>

            <h1
                ref={headingRef}
                tabIndex={-1}
                role="alert"
                // tabIndex={-1} + focus() is for the screen-reader
                // announcement; the element is not tab-reachable, and a brand
                // ring drawn round the title of an error page looks like a
                // second fault. Verified by rendering it, not by reading it.
                className="text-lg font-semibold text-foreground outline-none"
            >
                {copy.title}
            </h1>

            <p className="text-sm text-muted-fg">{copy.body}</p>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button type="button" onClick={retry} isLoading={retrying}>
                    {!retrying ? <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" /> : null}
                    {retrying ? "Retrying…" : copy.retryLabel}
                </Button>
                <Button asChild variant="outline">
                    <Link href={homeHref}>{homeLabel}</Link>
                </Button>
            </div>

            {error?.digest ? (
                <p className="text-[11px] text-faint-fg">
                    If it keeps happening, quote reference{" "}
                    <span className="data-mono">{error.digest}</span> to support.
                </p>
            ) : null}
        </div>
    );
}
