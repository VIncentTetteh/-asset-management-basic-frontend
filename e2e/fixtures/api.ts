import type { APIResponse, Page } from "@playwright/test";

/**
 * Thin JSON client over the page's authenticated request context (it shares the
 * HttpOnly session cookie with the browser). Used to create prerequisites a form
 * needs in a picker (an asset, a supplier, ...) and to clean up leftovers.
 *
 * API root: E2E_API_URL when set, else `${E2E_BASE_URL}/api/v1` (same-origin behind CloudFront).
 */
export class ApiClient {
    private orgId: string | undefined;

    constructor(private readonly page: Page) {}

    private get root(): string {
        const explicit = process.env.E2E_API_URL?.trim();
        if (explicit) return explicit.replace(/\/$/, "");
        const base = process.env.E2E_BASE_URL?.trim().replace(/\/$/, "");
        if (!base) throw new Error("E2E_BASE_URL is required");
        return `${base}/api/v1`;
    }

    /** The organisation the app pinned in localStorage after login (sent as X-Organisation-Id). */
    private async organisationId(): Promise<string | undefined> {
        if (this.orgId) return this.orgId;
        const state = await this.page.context().storageState();
        for (const origin of state.origins) {
            const entry = origin.localStorage.find((item) => item.name === "verifiedOrganisationId");
            if (entry?.value) {
                this.orgId = entry.value;
                break;
            }
        }
        return this.orgId;
    }

    /** `path` with `organisationId=<current org>` appended, for endpoints that take it as a query param. */
    async withOrg(path: string): Promise<string> {
        const orgId = await this.organisationId();
        if (!orgId) return path;
        return `${path}${path.includes("?") ? "&" : "?"}organisationId=${encodeURIComponent(orgId)}`;
    }

    private async headers(): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            // The API refuses cookie-authenticated writes without the app's Origin
            // (CSRF defence); a browser sends it, Playwright's request context doesn't.
            Origin: new URL(this.root).origin,
        };
        const orgId = await this.organisationId();
        if (orgId) headers["X-Organisation-Id"] = orgId;
        return headers;
    }

    private async send<T>(method: string, path: string, data?: unknown): Promise<T> {
        const response: APIResponse = await this.page.request.fetch(`${this.root}${path}`, {
            method,
            headers: await this.headers(),
            data: data === undefined ? undefined : JSON.stringify(data),
            failOnStatusCode: false,
        });
        const text = await response.text();
        if (!response.ok()) {
            throw new Error(`${method} ${path} -> ${response.status()}: ${text.slice(0, 500)}`);
        }
        return (text ? JSON.parse(text) : undefined) as T;
    }

    get<T = unknown>(path: string): Promise<T> {
        return this.send<T>("GET", path);
    }

    post<T = unknown>(path: string, data?: unknown): Promise<T> {
        return this.send<T>("POST", path, data ?? {});
    }

    put<T = unknown>(path: string, data?: unknown): Promise<T> {
        return this.send<T>("PUT", path, data ?? {});
    }

    patch<T = unknown>(path: string, data?: unknown): Promise<T> {
        return this.send<T>("PATCH", path, data ?? {});
    }

    delete(path: string): Promise<unknown> {
        return this.send("DELETE", path);
    }

    /** Best-effort delete for cleanup: never fails the test. */
    async tryDelete(path: string): Promise<void> {
        await this.delete(path).catch(() => undefined);
    }

    /** A list endpoint's rows, whether it answers a bare array or a Spring page (`content`). */
    async list<T = Record<string, unknown>>(path: string): Promise<T[]> {
        const body = await this.get<unknown>(path);
        if (Array.isArray(body)) return body as T[];
        const record = body as { content?: unknown; data?: unknown; items?: unknown } | null;
        for (const candidate of [record?.content, record?.data, record?.items]) {
            if (Array.isArray(candidate)) return candidate as T[];
        }
        return [];
    }
}
