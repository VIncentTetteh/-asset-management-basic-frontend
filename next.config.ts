import type { NextConfig } from "next";

/**
 * Static export, served from S3 behind CloudFront.
 *
 * `output: "export"` emits a directory of plain HTML/JS/CSS with no Node server. That
 * suits this app: all 66 pages are client components, there are no server actions, no
 * middleware, and no use of cookies()/headers().
 *
 * What it cost, and why each was acceptable:
 *
 *   - The API proxy at src/app/api/[...path]/route.ts is gone. It existed to give the
 *     browser a same-origin /api/v1 path. CloudFront now does that job with a cache
 *     behaviour that forwards /api/* to the backend origin, so src/lib/axios.ts keeps
 *     its baseURL of "/api/v1" unchanged. Same-origin matters here beyond tidiness: the
 *     session is an HttpOnly SameSite=Strict cookie, which a browser would refuse to
 *     send to a backend on a different site.
 *
 *   - The FX route at src/app/api/fx/usd-ghs/route.ts is gone; CurrencyContext calls the
 *     provider directly, as the desktop client already did.
 *
 *   - /employees/[id] became /employees/detail?id=..., because a dynamic segment must be
 *     enumerated at build time under export and employee ids are runtime UUIDs.
 *
 * `trailingSlash: true` makes the export emit every route as <route>/index.html. Paired
 * with the CloudFront function that appends index.html to extensionless paths, this maps
 * cleanly onto an S3 REST origin, which — unlike the S3 website endpoint — does not
 * resolve index documents itself. The REST origin is what lets the bucket stay private
 * behind Origin Access Control.
 */
const nextConfig: NextConfig = {
    output: "export",
    trailingSlash: true,
    images: {
        // The default Next image optimizer needs a server; export requires this off.
        unoptimized: true,
    },
};

export default nextConfig;
