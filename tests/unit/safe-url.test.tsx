import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { safeExternalUrl, safeInternalPath } from "@/lib/safe-url";
import { ExternalLink } from "@/components/ui/external-link";

describe("safeExternalUrl", () => {
    it.each([
        "javascript:alert(1)",
        "JAVASCRIPT:alert(1)",
        "JaVaScRiPt:alert(1)",
        " javascript:alert(1)",
        "\u0001javascript:alert(1)",
        "\tjava\nscript:alert(1)",
        "\u0000javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "/relative/path",
        "relative.pdf",
        "//evil.example/x",
        "mailto:a@b.c",
        "ftp://files.example/x",
        "",
        "   ",
        "not a url",
    ])("rejects %j", (value) => {
        expect(safeExternalUrl(value)).toBeNull();
    });

    it("rejects null and undefined", () => {
        expect(safeExternalUrl(null)).toBeNull();
        expect(safeExternalUrl(undefined)).toBeNull();
    });

    it("accepts absolute http and https URLs", () => {
        expect(safeExternalUrl("https://docs.example.com/c.pdf")).toBe("https://docs.example.com/c.pdf");
        expect(safeExternalUrl("  HTTP://Example.com/a b ")).toBe("http://example.com/a%20b");
    });
});

describe("safeInternalPath", () => {
    it("accepts in-app paths only", () => {
        expect(safeInternalPath("/purchase-orders?id=1")).toBe("/purchase-orders?id=1");
        expect(safeInternalPath("//evil.example")).toBeNull();
        expect(safeInternalPath("/\\evil.example")).toBeNull();
        expect(safeInternalPath("/\t/evil.example")).toBeNull();
        expect(safeInternalPath("javascript:alert(1)")).toBeNull();
        expect(safeInternalPath("https://evil.example")).toBeNull();
        expect(safeInternalPath(undefined)).toBeNull();
    });
});

describe("ExternalLink", () => {
    afterEach(cleanup);

    it("renders a new-tab, no-opener link for a safe URL", () => {
        render(<ExternalLink href="https://docs.example.com/c.pdf">Document</ExternalLink>);
        const link = screen.getByRole("link", { name: "Document" });
        expect(link.getAttribute("href")).toBe("https://docs.example.com/c.pdf");
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("renders plain text, never a link, for an unsafe URL", () => {
        render(<ExternalLink href="javascript:alert(1)">Document</ExternalLink>);
        expect(screen.queryByRole("link")).toBeNull();
        expect(screen.getByText("javascript:alert(1)").tagName).toBe("SPAN");
    });

    it("renders nothing without a URL", () => {
        const { container } = render(<ExternalLink href={null}>Document</ExternalLink>);
        expect(container.innerHTML).toBe("");
    });
});
