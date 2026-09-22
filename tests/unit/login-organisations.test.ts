import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { organisationChoicesFromError } from "@/lib/login-organisations";

function axiosError(status: number, data: unknown): AxiosError {
    return new AxiosError("fail", "ERR", undefined, undefined, {
        status, data, statusText: "", headers: {}, config: { headers: new AxiosHeaders() },
    });
}

describe("organisationChoicesFromError", () => {
    it("reads the organisations from a 409 ORGANISATION_REQUIRED", () => {
        const choices = organisationChoicesFromError(axiosError(409, {
            code: "ORGANISATION_REQUIRED",
            organisations: [{ id: "a", name: "Alpha" }, { id: "b", name: "Beta" }],
        }));
        expect(choices).toEqual([{ id: "a", name: "Alpha" }, { id: "b", name: "Beta" }]);
    });

    it("ignores other statuses, codes and malformed entries", () => {
        expect(organisationChoicesFromError(axiosError(401, { error: "Invalid email or password" }))).toBeNull();
        expect(organisationChoicesFromError(axiosError(409, { code: "OTHER", organisations: [] }))).toBeNull();
        expect(organisationChoicesFromError(axiosError(409, {
            code: "ORGANISATION_REQUIRED", organisations: [{ id: 1 }],
        }))).toBeNull();
        expect(organisationChoicesFromError(new Error("x"))).toBeNull();
    });
});
