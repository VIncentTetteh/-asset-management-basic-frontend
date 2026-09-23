import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Suspense fallback for every route segment.
 *
 * `loading.js` is one of the few framework conventions that works unchanged in
 * a static export: it is a React Suspense boundary, not a server feature
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md).
 * Next wraps the segment in it, so a route whose code chunk is still arriving
 * shows this instead of a blank area — the app shell around it stays
 * interactive throughout.
 *
 * It is a page-shaped skeleton rather than a spinner: the user sees where the
 * heading and the table are going to be, which reads as "arriving" instead of
 * "stuck". `role="status"` announces it once, politely; the skeleton bars
 * themselves are `aria-hidden` so a screen reader is not read a wall of
 * nothing. The pulse is disabled under `prefers-reduced-motion` in globals.css.
 */
export default function Loading() {
    return (
        <div role="status" aria-live="polite" className="w-full">
            <span className="sr-only">Loading page…</span>
            <div aria-hidden="true" className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-6 w-56 max-w-full" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                    ))}
                </div>
                <div className="space-y-2 rounded-card border border-edge bg-surface p-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-9" />
                    ))}
                </div>
            </div>
        </div>
    );
}
