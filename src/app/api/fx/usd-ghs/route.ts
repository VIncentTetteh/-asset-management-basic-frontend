import { NextResponse } from "next/server";

/**
 * Server-side USD -> GHS exchange-rate endpoint.
 *
 * The currency toggle used to fetch open.er-api.com directly from the browser
 * on every page load. That put an external network dependency on the critical
 * render path (a blocked network, a slow upstream, or a demo behind a firewall
 * would leave the app on a stale hard-coded fallback with no caching). Moving
 * the call server-side means one upstream request is shared across all users
 * and cached, with a graceful fallback that never fails the request.
 */

const UPSTREAM = "https://open.er-api.com/v6/latest/USD";
const FALLBACK_RATE = 15.5; // approximate GHS per 1 USD — keep in sync with CurrencyContext
const CACHE_SECONDS = 43_200; // 12h — FX for display conversion does not need to be real-time

// Revalidate the cached upstream response at most twice a day.
export const revalidate = 43_200;

export async function GET() {
    try {
        const res = await fetch(UPSTREAM, {
            next: { revalidate: CACHE_SECONDS },
        });
        if (!res.ok) throw new Error(`upstream ${res.status}`);
        const data = await res.json();
        const rate = data?.rates?.GHS;
        if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
            throw new Error("upstream returned no usable GHS rate");
        }
        return NextResponse.json({
            rate,
            updatedAt: new Date().toISOString(),
            source: "open.er-api.com",
            fallback: false,
        });
    } catch {
        // Never fail the request — the UI degrades to a sane static rate.
        return NextResponse.json({
            rate: FALLBACK_RATE,
            updatedAt: null,
            source: "fallback",
            fallback: true,
        });
    }
}
