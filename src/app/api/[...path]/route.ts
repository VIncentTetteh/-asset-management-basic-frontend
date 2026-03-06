import { NextRequest } from "next/server";

const TARGET_BASE = process.env.API_TARGET_BASE || "http://localhost:8085/api";

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
        headers.delete("host"); // Let 'fetch' handle the host automatically

        const body = req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined;

        const proxyRes = await fetch(targetUrl, {
            method: req.method,
            headers,
            body,
            redirect: "manual",
        });

        const resHeaders = new Headers(proxyRes.headers);

        // CRITICAL FIX: Delete the WWW-Authenticate header to prevent the browser's native Basic Auth popup from firing.
        resHeaders.delete("www-authenticate");

        return new Response(proxyRes.body, {
            status: proxyRes.status,
            statusText: proxyRes.statusText,
            headers: resHeaders,
        });
    } catch (error) {
        console.error("Proxy error:", error);
        return new Response(JSON.stringify({ message: "Internal server error" }), { status: 500 });
    }
}
