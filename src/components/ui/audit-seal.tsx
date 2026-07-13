import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Signature element: the gold verification seal. Reserved strictly for
 * audit/compliance verification states — gold is never used as a general
 * accent, which is what keeps the seal meaningful.
 */
export function AuditSeal({
  verified = true,
  title,
  className,
}: {
  verified?: boolean;
  /** Tooltip, e.g. "Verified in Q2 2026 audit". */
  title?: string;
  className?: string;
}) {
  if (!verified) {
    return (
      <span className={cn("text-faint-fg", className)} title={title ?? "Not yet audit-verified"}>
        —
      </span>
    );
  }
  return (
    <span
      title={title ?? "Audit-verified"}
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded-full border-[1.5px]",
        className,
      )}
      style={{ borderColor: "var(--gold)", color: "var(--gold)", background: "var(--gold-soft)" }}
    >
      <Check className="h-2.5 w-2.5" strokeWidth={3} aria-label="Audit-verified" />
    </span>
  );
}
