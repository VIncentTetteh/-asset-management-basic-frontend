import { toast, type ToastOptions } from "react-hot-toast";

/**
 * How AssetIQ tells a user something. There are exactly three channels, and
 * which one you reach for is decided by the message, not by convenience.
 *
 * ┌────────────┬──────────────────────────────────┬────────────────────────────┐
 * │ Channel    │ Use it for                       │ How it behaves             │
 * ├────────────┼──────────────────────────────────┼────────────────────────────┤
 * │ Toast      │ An acknowledgement of something  │ Transient. Missing it      │
 * │ (this file)│ the user just did. "Asset        │ costs the user nothing,    │
 * │            │ created." "Downloaded X."        │ because the result is      │
 * │            │                                  │ already on screen.         │
 * ├────────────┼──────────────────────────────────┼────────────────────────────┤
 * │ Alert      │ A condition that is still true   │ Persistent, inline, next   │
 * │ (ui/alert) │ and needs action or explains     │ to the thing it is about.  │
 * │            │ why something is missing. "We    │ Stays until the condition  │
 * │            │ couldn't load your assets."      │ clears.                    │
 * │            │ "Plan limit reached."            │                            │
 * ├────────────┼──────────────────────────────────┼────────────────────────────┤
 * │ Bell       │ Something that happened while    │ Server-owned, read/unread, │
 * │ (Notifi-   │ the user was away. Approvals,    │ survives a reload.         │
 * │ cationBell)│ expiries, maintenance due.       │                            │
 * └────────────┴──────────────────────────────────┴────────────────────────────┘
 *
 * The rule that keeps them distinct: **a failure the user must act on is never
 * only a toast.** A toast that disappears after four seconds is the same as no
 * message at all for anyone who looked away, and a load failure shown that way
 * leaves an empty table with no explanation — which is exactly how three of
 * this app's bugs presented. Toast the acknowledgement; render the condition.
 *
 * Accessibility: an acknowledgement announces politely (`role="status"`), a
 * failure assertively (`role="alert"`). react-hot-toast defaults everything to
 * polite, so an error toast would be queued behind whatever the screen reader
 * was already saying. These helpers set it correctly; call them rather than
 * `toast.*` directly.
 */

/** Announced after whatever the screen reader is currently saying. */
const POLITE: ToastOptions["ariaProps"] = { role: "status", "aria-live": "polite" };

/** Interrupts. Only for things that went wrong. */
const ASSERTIVE: ToastOptions["ariaProps"] = { role: "alert", "aria-live": "assertive" };

/**
 * A failure needs longer on screen than a success: the user has to read it,
 * and often has to remember it while they fix something.
 */
const ERROR_MS = 6_000;

/** "Asset created." Something the user did, and it worked. */
export function notifySuccess(message: string, options?: ToastOptions): string {
    return toast.success(message, { ariaProps: POLITE, ...options });
}

/**
 * "That action failed." Use for a failure the user can simply retry or has
 * already seen the cause of. For a failure that leaves the page in a broken or
 * empty state, render an `<Alert>` instead — see the table above.
 */
export function notifyError(message: string, options?: ToastOptions): string {
    return toast.error(message, { duration: ERROR_MS, ariaProps: ASSERTIVE, ...options });
}

/** Neutral acknowledgement — "No changes to update." */
export function notifyInfo(message: string, options?: ToastOptions): string {
    return toast(message, { ariaProps: POLITE, ...options });
}

/**
 * The three channels as one object, so a reader of a call site can see which
 * one was chosen without checking the import.
 */
export const notify = {
    success: notifySuccess,
    error: notifyError,
    info: notifyInfo,
    dismiss: (id?: string) => toast.dismiss(id),
};
