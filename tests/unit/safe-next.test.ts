import { describe, expect, it } from "vitest";
import { DEFAULT_POST_LOGIN_PATH, loginPathWithNext, nextFromSearch, safeNextPath } from "@/lib/safe-next";

describe("safeNextPath", () => {
    it.each([
        ["/scan?a=7f1c2a4e-3b5d-4c6e-8f9a-0b1c2d3e4f50", "/scan?a=7f1c2a4e-3b5d-4c6e-8f9a-0b1c2d3e4f50"],
        ["/assets", "/assets"],
        ["/reports?tab=x#top", "/reports?tab=x#top"],
    ])("accepts same-origin path %s", (raw, expected) => {
        expect(safeNextPath(raw)).toBe(expected);
    });

    it.each([
        ["//evil.com"],
        ["///evil.com"],
        ["/\\evil.com"],
        ["/foo\\bar"],
        ["https://evil.com"],
        ["javascript:alert(1)"],
        ["evil.com"],
        [" /assets"],
        ["/assets\n"],
        ["/\tevil.com"],
        [""],
        ["/login"],
        ["/login?next=/assets"],
        [`/${"a".repeat(3000)}`],
    ])("rejects %j", (raw) => {
        expect(safeNextPath(raw)).toBe(DEFAULT_POST_LOGIN_PATH);
    });

    it("rejects null/undefined and honours a custom fallback", () => {
        expect(safeNextPath(null)).toBe(DEFAULT_POST_LOGIN_PATH);
        expect(safeNextPath(undefined, "/home")).toBe("/home");
    });
});

describe("loginPathWithNext / nextFromSearch", () => {
    it("round-trips the scan path through the login URL", () => {
        const login = loginPathWithNext("/scan?a=abc");
        expect(login).toBe("/login?next=%2Fscan%3Fa%3Dabc");
        expect(nextFromSearch(login.slice("/login".length))).toBe("/scan?a=abc");
    });

    it("drops unsafe or pointless targets", () => {
        expect(loginPathWithNext("//evil.com")).toBe("/login");
        expect(loginPathWithNext("/")).toBe("/login");
        expect(loginPathWithNext("/login")).toBe("/login");
        expect(nextFromSearch("?next=https%3A%2F%2Fevil.com")).toBe(DEFAULT_POST_LOGIN_PATH);
        expect(nextFromSearch("")).toBe(DEFAULT_POST_LOGIN_PATH);
    });
});
