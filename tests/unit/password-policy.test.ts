import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, validatePassword } from "@/lib/password-policy";
import { FIELD_LIMITS } from "@/lib/field-limits";

describe("password policy (mirrors the API's @ValidPassword)", () => {
    it("is 8 characters to 72 bytes", () => {
        expect(PASSWORD_MIN_LENGTH).toBe(8);
        expect(PASSWORD_MAX_BYTES).toBe(72);
        expect(validatePassword("short")).toMatch(/at least 8/);
        expect(validatePassword("a".repeat(72))).toBe(true);
        expect(validatePassword("a".repeat(73))).toMatch(/72 bytes/);
    });

    it("counts bytes like BCrypt", () => {
        expect(validatePassword("€".repeat(24))).toBe(true);
        expect(validatePassword("€".repeat(25))).toMatch(/72 bytes/);
    });

    it("leaves an empty value to the required rule", () => {
        expect(validatePassword("")).toBe(true);
    });

    it("is the limit field-limits publishes for users", () => {
        expect(FIELD_LIMITS.user.password).toEqual({ minLength: 8, maxLength: 72 });
    });
});
