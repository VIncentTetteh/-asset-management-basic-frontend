import type { ReactNode } from "react";
import { safeExternalUrl } from "@/lib/safe-url";
import { cn } from "@/lib/utils";

/**
 * A link to a URL that came from data (a document, receipt or evidence URL).
 * Only absolute http(s) URLs become a link, opened in a new tab without an
 * opener; anything else (javascript:, data:, relative, garbage) is shown as
 * plain text so it can never run script or navigate the app.
 */
export function ExternalLink({
    href,
    children,
    className,
    title,
}: {
    href: string | null | undefined;
    /** Link text; defaults to the URL itself. */
    children?: ReactNode;
    className?: string;
    title?: string;
}) {
    const safe = safeExternalUrl(href);
    if (!safe) {
        if (!href) return null;
        return (
            <span className={cn("break-all text-muted-fg", className)} title={title ?? "Not a web link"}>
                {href}
            </span>
        );
    }
    return (
        <a href={safe} target="_blank" rel="noopener noreferrer" className={className} title={title ?? safe}>
            {children ?? safe}
        </a>
    );
}
