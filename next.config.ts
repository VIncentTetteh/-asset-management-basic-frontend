import type { NextConfig } from "next";

/**
 * NEXT_PUBLIC_API_URL   — full origin of the Spring Boot backend, no trailing slash.
 *                         Defaults to http://localhost:8080 for local development.
 *
 * All /api/v1/* requests from the browser are rewritten through Next.js to the
 * backend, keeping CORS out of the picture and making the SPA and backend appear
 * on the same origin.
 */
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8085";

const nextConfig: NextConfig = {
    async rewrites() {
        return [
            {
                source: "/api/v1/:path*",
                destination: `${BACKEND_ORIGIN}/api/v1/:path*`,
            },
        ];
    },
};

export default nextConfig;
