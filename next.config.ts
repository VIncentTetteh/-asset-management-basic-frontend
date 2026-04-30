import type { NextConfig } from "next";

/**
 * API proxying is handled by the catch-all Next.js API route at
 * src/app/api/[...path]/route.ts, which reads the API_TARGET_BASE env var.
 *
 * Set API_TARGET_BASE to the full base of your Spring Boot API, e.g.:
 *   API_TARGET_BASE=https://your-backend.railway.app/api
 *
 * Defaults to http://localhost:8080/api for local development.
 *
 * NOTE: A next.config.ts rewrite for /api/v1/* was previously present here but
 * was dead code — Next.js App Router API routes always take precedence over
 * rewrites when the path matches. The proxy route is the single source of truth.
 */

const nextConfig: NextConfig = {};

export default nextConfig;
