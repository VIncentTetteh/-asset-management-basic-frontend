import { ShieldCheck, ShieldAlert } from "lucide-react";

/** Whether a user has TOTP MFA switched on, so admins can see who lacks it. */
export function MfaStatus({ enabled }: { enabled?: boolean }) {
    return enabled ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok">
            <ShieldCheck className="h-3 w-3" aria-hidden /> On
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
            <ShieldAlert className="h-3 w-3" aria-hidden /> Off
        </span>
    );
}
