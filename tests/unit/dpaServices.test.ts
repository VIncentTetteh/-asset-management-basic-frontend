import { beforeEach, describe, expect, it, vi } from "vitest";

const { post, patch } = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/axios", () => ({ default: { post, patch } }));

import { dsarService } from "@/services/dsarService";
import { dpaConsentService } from "@/services/dpaConsentService";

describe("DPA services", () => {
    beforeEach(() => {
        post.mockReset().mockResolvedValue({ data: {} });
        patch.mockReset().mockResolvedValue({ data: {} });
    });

    it("sends a DSAR update as a JSON body, never in the URL", async () => {
        await dsarService.updateStatus("d1", { status: "COMPLETED", responseSummary: "Sent the export" });
        const [url, body, config] = patch.mock.calls[0];
        expect(url).toBe("/dpa/dsar/d1/status");
        expect(body).toEqual({ status: "COMPLETED", responseSummary: "Sent the export" });
        expect(config).toBeUndefined();
    });

    it("records consent without client-supplied evidence (the API reads it from the request)", async () => {
        await dpaConsentService.record("MARKETING", true);
        expect(post.mock.calls[0][1]).toEqual({ purpose: "MARKETING", granted: true });
    });
});
