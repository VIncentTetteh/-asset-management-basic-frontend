import { cn } from "@/lib/utils";

/**
 * Status rendering keyed to backend enums. One visual language for state
 * everywhere: a colored dot + label, never ad-hoc pill colors per page.
 *
 * Tones map to the lifecycle tokens in src/styles/tokens.css, so they adapt
 * to dark mode automatically.
 */
type Tone =
  | "in-use"
  | "in-stock"
  | "reserved"
  | "maintenance"
  | "flagged"
  | "disposed"
  | "retired";

const TONE_VAR: Record<Tone, string> = {
  "in-use": "var(--status-in-use)",
  "in-stock": "var(--status-in-stock)",
  reserved: "var(--status-reserved)",
  maintenance: "var(--status-maintenance)",
  flagged: "var(--status-flagged)",
  disposed: "var(--status-disposed)",
  retired: "var(--status-retired)",
};

/** Backend AssetStatus → visual tone. */
const ASSET_STATUS_TONE: Record<string, Tone> = {
  PENDING_PROCUREMENT: "reserved",
  IN_STOCK: "in-stock",
  RESERVED: "reserved",
  IN_USE: "in-use",
  MAINTENANCE: "maintenance",
  UNDER_REPAIR: "maintenance",
  RETIRED: "retired",
  DISPOSED: "disposed",
  MISSING: "flagged",
};

/** Generic value → tone for common cross-module states. */
const GENERIC_TONE: Record<string, Tone> = {
  ACTIVE: "in-use",
  OPEN: "in-stock",
  PENDING: "reserved",
  IN_PROGRESS: "maintenance",
  COMPLETED: "in-use",
  RETURNED: "in-use",
  APPROVED: "in-use",
  REJECTED: "flagged",
  CANCELLED: "disposed",
  EXPIRED: "retired",
  OVERDUE: "flagged",
  FAILED: "flagged",
  TERMINATED: "retired",
  ONBOARDING: "in-stock",
  ON_LEAVE: "reserved",
  OFFBOARDING: "maintenance",
};

function labelFor(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function toneForStatus(value: string): Tone {
  return ASSET_STATUS_TONE[value] ?? GENERIC_TONE[value] ?? "retired";
}

export function StatusBadge({
  status,
  tone,
  label,
  className,
}: {
  /** Raw backend enum value, e.g. "IN_USE" or "MAINTENANCE". */
  status: string;
  /** Override the derived tone for module-specific semantics. */
  tone?: Tone;
  /** Override the derived human label. */
  label?: string;
  className?: string;
}) {
  const resolved = tone ?? toneForStatus(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap", className)}>
      <span
        aria-hidden
        className="h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: TONE_VAR[resolved] }}
      />
      {label ?? labelFor(status)}
    </span>
  );
}
