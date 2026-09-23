"use client"; // Error boundaries must be Client Components.

import { useEffect, useState } from "react";
import { ErrorScreen } from "@/components/errors/ErrorScreen";
import { hasRecentlyReloaded, isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-recovery";

/**
 * The route-level error boundary for every page in the app.
 *
 * It sits inside the root layout, so the sidebar, header and notification bell
 * stay on screen and the user keeps a working app around the broken part.
 * Only a failure in the root layout itself escapes to `global-error.tsx`.
 *
 * Next 16 passes `retry` (stable since 16.3), which re-renders the boundary's
 * children inside a transition instead of reloading the document — state in
 * client components outside the boundary survives. See
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
 */
export default function RouteError({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    // A stale-chunk failure is recovered from before the user sees anything.
    // The initialiser runs once, synchronously, so the error screen never
    // flashes on its way to the reload.
    const [recovering] = useState(
        () => typeof window !== "undefined" && isChunkLoadError(error) && !hasRecentlyReloaded(),
    );

    useEffect(() => {
        if (recoverFromChunkError(error)) return;
        // Not recoverable. Record it — this is the one place a render failure
        // is visible at all, and swallowing it is how a bug stays invisible.
        console.error("Route render failed", { digest: error.digest, message: error.message });
    }, [error]);

    if (recovering) {
        return (
            <div
                role="status"
                aria-live="polite"
                className="flex min-h-[60vh] items-center justify-center px-4 text-center text-sm text-muted-fg"
            >
                Updating AssetIQ to the latest version…
            </div>
        );
    }

    return <ErrorScreen error={error} onRetry={retry} />;
}
