import { describe, expect, it } from "vitest";
import { buildLabelHtml, escapeHtml } from "@/features/assets/printLabel";

describe("asset label", () => {
    it("escapes interpolated text", () => {
        expect(escapeHtml(`<b>"a"&'b'</b>`)).toBe("&lt;b&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/b&gt;");
    });

    it("renders the QR image, tag and name sized for a label", () => {
        const html = buildLabelHtml({ qrImageSrc: "data:image/png;base64,AAA", assetTag: "AST-1", name: "Desk <oak>" });
        expect(html).toContain('<img src="data:image/png;base64,AAA"');
        expect(html).toContain("AST-1");
        expect(html).toContain("Desk &lt;oak&gt;");
        expect(html).toContain("@page { size: 62mm 40mm");
    });
});
