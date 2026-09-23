"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The persistent, inline half of how this app talks to a user.
 *
 * See `src/lib/notify.ts` for the whole scheme. The short version: a toast is
 * an acknowledgement you may miss without consequence; an `Alert` is a
 * condition that is still true and usually needs the user to do something. It
 * therefore lives in the page, next to whatever it is about, and stays until
 * the condition goes away.
 *
 * Accessibility:
 *   - Every tone carries an icon as well as a colour, so the meaning survives
 *     greyscale, colour-blindness and a high-contrast theme.
 *   - `danger` and `warn` announce as `role="alert"` (assertive); `info` and
 *     `ok` as `role="status"` (polite), because interrupting a screen-reader
 *     user to tell them something succeeded is rude. A purely decorative
 *     alert — one the page has already announced some other way — can opt out
 *     with `live={false}`.
 *   - `tabIndex={-1}` plus a forwarded ref lets a caller move focus here after
 *     a failure, which is how a keyboard user finds out anything happened.
 */

const TONES = {
    info: {
        icon: Info,
        role: "status" as const,
        live: "polite" as const,
        box: "border-info/40 bg-info-soft",
        mark: "text-info",
    },
    ok: {
        icon: CheckCircle2,
        role: "status" as const,
        live: "polite" as const,
        box: "border-ok/40 bg-ok-soft",
        mark: "text-ok",
    },
    warn: {
        icon: AlertTriangle,
        role: "alert" as const,
        live: "assertive" as const,
        box: "border-warn/40 bg-warn-soft",
        mark: "text-warn",
    },
    danger: {
        icon: OctagonAlert,
        role: "alert" as const,
        live: "assertive" as const,
        box: "border-danger/40 bg-danger-soft",
        mark: "text-danger",
    },
} as const;

export type AlertTone = keyof typeof TONES;

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    tone?: AlertTone;
    /** Short sentence naming the condition. Rendered as the heading line. */
    title: React.ReactNode;
    /** What the user can do about it. Buttons, links — anything actionable. */
    action?: React.ReactNode;
    /**
     * Whether this alert announces itself to a screen reader. Turn it off for
     * an alert that is rendered on first paint (nothing changed, so nothing
     * should be announced) or one the page announces another way.
     */
    live?: boolean;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    { tone = "info", title, action, live = true, className, children, ...props },
    ref,
) {
    const { icon: Icon, role, live: politeness, box, mark } = TONES[tone];
    return (
        <div
            ref={ref}
            tabIndex={-1}
            role={live ? role : undefined}
            aria-live={live ? politeness : undefined}
            data-tone={tone}
            className={cn(
                "ea-focus flex flex-col gap-3 rounded-card border px-4 py-3 text-sm text-foreground outline-none sm:flex-row sm:items-start",
                box,
                className,
            )}
            {...props}
        >
            <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0 sm:mt-0.5", mark)} />
            <div className="min-w-0 flex-1">
                <p className="font-semibold">{title}</p>
                {children ? <div className="mt-1 text-[13px] text-muted-fg">{children}</div> : null}
            </div>
            {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
        </div>
    );
});
