import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { changeMyPassword, toastFns } = vi.hoisted(() => ({
    changeMyPassword: vi.fn(),
    toastFns: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/services/userService", () => ({ userService: { changeMyPassword } }));
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

import { ChangePasswordCard } from "@/features/users/ChangePasswordCard";

const fill = (label: RegExp, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("ChangePasswordCard", () => {
    beforeEach(() => {
        changeMyPassword.mockReset();
    });
    afterEach(cleanup);

    it("posts current and new password, then asks to sign in again", async () => {
        changeMyPassword.mockResolvedValue(undefined);
        const onChanged = vi.fn();
        render(<ChangePasswordCard onChanged={onChanged} />);

        fill(/^current password/i, "old password");
        fill(/^new password/i, "brand new password");
        fill(/confirm new password/i, "brand new password");
        fireEvent.click(screen.getByRole("button", { name: /change password/i }));

        await waitFor(() => expect(onChanged).toHaveBeenCalled());
        expect(changeMyPassword).toHaveBeenCalledWith({ currentPassword: "old password", newPassword: "brand new password" });
    });

    it("refuses a password over 72 bytes and a mismatched confirmation before calling the API", async () => {
        render(<ChangePasswordCard onChanged={vi.fn()} />);

        fill(/^current password/i, "old password");
        fill(/^new password/i, "€".repeat(25));
        fill(/confirm new password/i, "something else");
        fireEvent.click(screen.getByRole("button", { name: /change password/i }));

        expect(await screen.findByText(/72 bytes/)).toBeTruthy();
        expect(screen.getByText(/do not match/)).toBeTruthy();
        expect(changeMyPassword).not.toHaveBeenCalled();
    });
});
