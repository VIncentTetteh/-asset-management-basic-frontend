import { NextRequest } from "next/server";

/**
 * Catch-all server-side proxy route.
 *
 * All /api/* browser requests are forwarded to the Spring Boot backend.
 * Set API_TARGET_BASE in your environment to the backend base URL:
 *   API_TARGET_BASE=https://your-backend.railway.app/api   (production)
 *   API_TARGET_BASE=http://localhost:8085/api               (local dev default)
 *
 * This route takes precedence over any next.config.ts rewrites, which is why
 * the rewrite was removed — this is the single proxy entry-point.
 */

const TARGET_BASE = (process.env.API_TARGET_BASE ?? "http://localhost:8085/api").replace(/\/+$/, "");

if (!process.env.API_TARGET_BASE) {
    console.warn(
        "[proxy] API_TARGET_BASE is not set — falling back to http://localhost:8085/api. " +
        "Set API_TARGET_BASE in your environment for production deployments."
    );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleProxy(req, await params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleProxy(req, await params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleProxy(req, await params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleProxy(req, await params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleProxy(req, await params);
}

async function handleProxy(req: NextRequest, params: { path: string[] }) {
    try {
        const path = params.path ? params.path.join("/") : "";
        const url = new URL(req.url);
        const targetUrl = `${TARGET_BASE}/${path}${url.search}`;

        const headers = new Headers(req.headers);
        // Remove headers that would confuse the upstream server.
        headers.delete("host");
        // Do not forward browser cookies to the backend API.
        // This app authenticates API requests via Bearer tokens, and forwarding
        // large third-party cookies can push Tomcat over header-size limits.
        headers.delete("cookie");
        // Tell the backend NOT to compress its response.
        // If we forward the browser's "Accept-Encoding: gzip, br" the backend
        // sends a compressed body. Node fetch does not auto-decompress, so the
        // proxy pipes raw gzip bytes back to the browser which then tries (and
        // fails) to decompress them a second time → ERR_CONTENT_DECODING_FAILED.
        headers.set("accept-encoding", "identity");
        // Forward the real client IP for logging/rate-limiting on the backend.
        const clientIp = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
        if (clientIp) headers.set("x-forwarded-for", clientIp);

        const body = req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined;

        const proxyRes = await fetch(targetUrl, {
            method: req.method,
            headers,
            body,
            redirect: "manual",
        });

        const resHeaders = new Headers(proxyRes.headers);
        // Prevent the browser's native Basic Auth popup from firing on 401 responses.
        resHeaders.delete("www-authenticate");
        // Remove encoding/transfer headers so Next.js and the browser don't
        // try to decode a body that is already plain (we asked for identity above).
        resHeaders.delete("content-encoding");
        resHeaders.delete("transfer-encoding");

        return new Response(proxyRes.body, {
            status: proxyRes.status,
            statusText: proxyRes.statusText,
            headers: resHeaders,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[proxy] Failed to reach backend at ${TARGET_BASE}:`, msg);
        return new Response(
            JSON.stringify({ message: `Proxy error: could not reach backend. ${msg}` }),
            { status: 502, headers: { "Content-Type": "application/json" } }
        );
    }
}
