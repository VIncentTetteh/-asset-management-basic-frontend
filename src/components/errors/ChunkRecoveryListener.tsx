"use client";

import { useEffect } from "react";
import { recoverFromChunkError } from "@/lib/chunk-recovery";

/**
 * Catches stale-chunk failures that never reach a React error boundary.
 *
 * `error.tsx` only sees a failure thrown *during render*. A large share of
 * chunk failures are not: the router loads a route's code with a dynamic
 * `import()` on navigation, and when that import rejects the rejection
 * surfaces as an unhandled promise rejection, or as a window `error` event —
 * with nothing rendered and no boundary entered. The symptom is a sidebar
 * click that does nothing at all, which is the worst failure mode this app
 * has: indistinguishable from a slow network or a dead button.
 *
 * Mounted once, in the root layout. The one-reload guard lives in
 * `chunk-recovery.ts` and is shared with the error boundaries, so a chunk
 * error caught here and one caught in render cannot each spend an attempt.
 *
 * Only genuine JavaScript exceptions are inspected. Resource-level `error`
 * events (a failed `<link rel="prefetch">`, an image 404) do not bubble here
 * and are deliberately not listened for: reloading the page out from under
 * someone because a speculative prefetch missed is not recovery.
 */
export function ChunkRecoveryListener() {
    useEffect(() => {
        const onRejection = (event: PromiseRejectionEvent) => {
            if (recoverFromChunkError(event.reason)) event.preventDefault();
        };
        const onError = (event: ErrorEvent) => {
            if (recoverFromChunkError(event.error ?? event.message)) event.preventDefault();
        };

        window.addEventListener("unhandledrejection", onRejection);
        window.addEventListener("error", onError);
        return () => {
            window.removeEventListener("unhandledrejection", onRejection);
            window.removeEventListener("error", onError);
        };
    }, []);

    return null;
}
