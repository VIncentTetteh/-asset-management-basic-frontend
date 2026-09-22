import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { post: (...args: unknown[]) => post(...args) } }));

import { authService } from "@/services/authService";

describe("authService.registerTenant", () => {
    beforeEach(() => {
        post.mockReset();
        post.mockResolvedValue({ data: { organisationName: "Acme", email: "ama@example.com" } });
    });

    it("sends the phone as adminPhone, the field the API reads", async () => {
        await authService.registerTenant({
            organisationName: "Acme", adminEmail: "ama@example.com", adminFirstName: "Ama",
            adminLastName: "Mensah", password: "correct horse battery", adminPhone: "+233201234567",
        });

        const body = post.mock.calls[0][1] as Record<string, unknown>;
        expect(post.mock.calls[0][0]).toBe("/tenant/register");
        expect(body.adminPhone).toBe("+233201234567");
        expect(body).not.toHaveProperty("phone");
    });
});
