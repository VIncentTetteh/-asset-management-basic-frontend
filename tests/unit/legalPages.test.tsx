import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { matchesRoute, PUBLIC_PATHS } from "@/lib/route-path";

// The landing navbar reads scroll position and auth links; it is not under test.
vi.mock("@/components/landing/Navbar", () => ({ Navbar: () => null }));

afterEach(cleanup);

describe("public legal routes", () => {
    it.each(["/privacy", "/terms", "/privacy/", "/terms/"])(
        "%s renders without a session",
        (path) => {
            // Store reviewers open these from the mobile app while signed out;
            // a private route would bounce them to /login.
            expect(matchesRoute(path, [...PUBLIC_PATHS])).toBe(true);
        },
    );

    it("keeps account pages private", () => {
        expect(matchesRoute("/dashboard", [...PUBLIC_PATHS])).toBe(false);
    });
});

describe("legal pages", () => {
    it("privacy policy shows the draft banner, a contact, and camera usage", () => {
        render(<PrivacyPage />);
        expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
        expect(screen.getByRole("note").textContent).toMatch(/pending legal review/i);
        expect(screen.getByRole("link", { name: "privacy@assetiq.io" }).getAttribute("href")).toBe(
            "mailto:privacy@assetiq.io",
        );
        expect(screen.getByText(/Camera access in the mobile app/i)).toBeTruthy();
    });

    it("terms link back to the privacy policy", () => {
        render(<TermsPage />);
        expect(screen.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy");
    });

    it("footer links to both documents", () => {
        render(<PrivacyPage />);
        const footer = screen.getByRole("navigation", { name: "Footer" });
        expect(footer.querySelector('a[href="/privacy"]')).not.toBeNull();
        expect(footer.querySelector('a[href="/terms"]')).not.toBeNull();
    });
});
