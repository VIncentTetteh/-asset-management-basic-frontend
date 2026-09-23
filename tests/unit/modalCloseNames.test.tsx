import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/**
 * Several dialogs (DSAR detail, a role's effective permissions, an audit event,
 * webhook deliveries, purchase order lines) end with a full-width "Close"
 * button as well as the header's icon. Both are wanted — the body scrolls, so
 * the button at the bottom is where the hand already is — but when both were
 * called exactly "Close" a screen reader's button list read "Close, Close" and
 * neither said which was which. Playwright's strict mode caught it first.
 */
describe("Modal close controls", () => {
    afterEach(cleanup);

    it("names the header control for the dialog it closes, so it never collides with a Close button in the body", () => {
        render(
            <Modal isOpen onClose={() => {}} title="DSAR detail">
                <Button variant="outline">Close</Button>
            </Modal>,
        );

        expect(screen.getByRole("button", { name: "Close DSAR detail" })).toBeTruthy();
        // Exactly one control is called plainly "Close": the one in the body.
        expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
    });

    it("gives every dialog's header control its own name", () => {
        render(
            <Modal isOpen onClose={() => {}} title="Webhook deliveries">
                <p>nothing</p>
            </Modal>,
        );
        expect(screen.getByRole("button", { name: "Close Webhook deliveries" })).toBeTruthy();
    });
});
