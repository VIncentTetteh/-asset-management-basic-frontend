import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MfaStatus } from "@/features/users/MfaStatus";

describe("MfaStatus", () => {
    it("shows On when MFA is enabled", () => {
        render(<MfaStatus enabled />);
        expect(screen.getByText("On")).toBeTruthy();
    });

    it("shows Off when MFA is disabled or unknown", () => {
        render(<MfaStatus />);
        expect(screen.getByText("Off")).toBeTruthy();
    });
});
