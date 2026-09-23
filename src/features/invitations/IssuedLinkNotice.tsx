"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvitationIssued } from "@/types/invitations";

/**
 * The link an administrator has to pass on themselves.
 *
 * The API returns `acceptUrl` only when `emailSent` is false — that is, when
 * this environment has no mail transport — and null otherwise, because a live
 * invitation token belongs in the mailbox it was sent to and nowhere else. So
 * this renders on exactly that condition and never guesses.
 *
 * It is an `Alert` rather than a toast on purpose: the administrator has to
 * copy something and send it somewhere, which takes longer than four seconds,
 * and a link that vanishes is a colleague who never gets access.
 */
export function IssuedLinkNotice({ issued, onDismiss }: { issued: InvitationIssued; onDismiss: () => void }) {
    const [copied, setCopied] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        ref.current?.focus();
    }, [issued]);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 2_500);
        return () => window.clearTimeout(timer);
    }, [copied]);

    if (issued.emailSent || !issued.acceptUrl) return null;
    const link = issued.acceptUrl;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
        } catch {
            // No clipboard permission (or no clipboard at all, as in an insecure
            // context). Select the text so the user can copy it by hand rather
            // than being told nothing happened.
            const field = ref.current?.querySelector("input");
            field?.focus();
            field?.select();
        }
    };

    return (
        <Alert
            ref={ref}
            tone="warn"
            title="Email is switched off here — send this link yourself"
            data-testid="invite-accept-link"
            action={<Button type="button" size="sm" variant="outline" onClick={onDismiss}>Done</Button>}
        >
            <div className="space-y-2">
                <p>
                    {issued.message
                        || `We could not email ${issued.invitation.email}, so the invitation was not delivered.`}{" "}
                    Give them this one-time link. It expires with the invitation and works once.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="sr-only" htmlFor="invite-accept-url">Invitation link</label>
                    <Input
                        id="invite-accept-url"
                        readOnly
                        value={link}
                        onFocus={(event) => event.currentTarget.select()}
                        className="font-mono text-xs"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={copy} className="shrink-0">
                        {copied ? <Check aria-hidden="true" className="mr-2 h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="mr-2 h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy link"}
                    </Button>
                </div>
                <p aria-live="polite" className="text-xs text-faint-fg">
                    {copied ? "Link copied to the clipboard." : "Treat it like a password: anyone holding it can join as this person."}
                </p>
            </div>
        </Alert>
    );
}
