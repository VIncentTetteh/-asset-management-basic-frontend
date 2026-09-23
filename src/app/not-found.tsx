"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The 404 page.
 *
 * Under `output: "export"` this is what `next build` emits as `out/404.html`,
 * so it covers "the router found no route" and, on any origin that resolves
 * error documents, "the origin found no object" too. Previously both landed on
 * the framework default, which is a bare black-on-white "404 This page could
 * not be found" with no way back.
 *
 * The staging/production CDN is the exception: CloudFront's custom error
 * responses are per-distribution, and the distribution also fronts `/api/*`, so
 * mapping S3's 403 onto this document rewrote every API 403 into a 404. It was
 * removed deliberately — see `infra/aws/compute-cdn.yaml`. An unknown *static*
 * path there returns S3's own 403; every path the app itself routes still lands
 * here.
 *
 * It renders inside the root layout, so the sidebar and header are still there
 * and the user is never stranded.
 */
export default function NotFound() {
    const headingRef = useRef<HTMLHeadingElement>(null);

    // A client-side navigation to a missing route swaps the content without
    // moving focus; without this a screen-reader user hears nothing at all.
    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-sunken text-muted-fg">
                <Compass aria-hidden="true" className="h-5 w-5" />
            </div>
            <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-semibold text-foreground outline-none"
            >
                We couldn&apos;t find that page
            </h1>
            <p className="text-sm text-muted-fg">
                The link may be out of date, or the record it pointed to may have been removed.
                Nothing has gone wrong with your account.
            </p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button asChild>
                    <Link href="/dashboard">Go to dashboard</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/assets">Browse assets</Link>
                </Button>
            </div>
        </div>
    );
}
