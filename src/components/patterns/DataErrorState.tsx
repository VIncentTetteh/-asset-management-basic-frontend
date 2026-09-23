"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/lib/error";

/**
 * A failed data fetch, shown where the data was going to be.
 *
 * This is the deliberate counterpart to `ErrorScreen`. The two failures look
 * nothing alike to a user and must not look alike on screen:
 *
 *   - The *page* broke → rendering threw, the route is gone, `error.tsx` takes
 *     over the whole area.
 *   - The *data* didn't arrive → the page is fine. The table is empty because
 *     a request failed, and that one region says so and offers to try again.
 *     The header, the filters, the sidebar and everything else still work.
 *
 * React Query already keeps these apart by default — a query error is returned
 * as `isError`, not thrown at the boundary — so this component is about making
 * the distinction visible rather than about catching anything.
 *
 * `offline` is called out separately because "check your connection" and "the
 * server said no" lead the user to completely different actions.
 */
export function DataErrorState({
    error,
    what = "this",
    onRetry,
    isRetrying = false,
    className,
}: {
    error?: unknown;
    /** What failed to load, as it reads mid-sentence: "We couldn't load **your assets**." */
    what?: string;
    onRetry?: () => void | Promise<unknown>;
    isRetrying?: boolean;
    className?: string;
}) {
    const alertRef = useRef<HTMLDivElement>(null);
    const [online, setOnline] = useState(true);

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

    // Move focus to the alert the first time it appears. A screen reader
    // announces it either way via role="alert"; focus is what gives a keyboard
    // user somewhere to be, with the Try again button one Tab away.
    useEffect(() => {
        alertRef.current?.focus();
    }, []);

    const title = online ? `We couldn't load ${what}` : "You're offline";
    const detail = online
        ? extractErrorMessage(error, "The server didn't respond. This is usually temporary.")
        : `${what.charAt(0).toUpperCase()}${what.slice(1)} will load again once your connection is back.`;

    return (
        <Alert
            ref={alertRef}
            tone="danger"
            title={title}
            className={className}
            data-testid="data-error"
            action={
                onRetry ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void onRetry()} isLoading={isRetrying}>
                        {!isRetrying ? <RefreshCw aria-hidden="true" className="mr-2 h-3.5 w-3.5" /> : null}
                        {isRetrying ? "Retrying…" : "Try again"}
                    </Button>
                ) : null
            }
        >
            {detail}
        </Alert>
    );
}
