import { cn } from "@/lib/utils";
import { toneForStatus } from "@/components/ui/status-badge";

/**
 * Signature element: a five-segment custody trail showing how far through
 * its lifecycle an asset is — procurement → stock → assignment → service
 * events → end of life — without opening the record.
 */
const STAGE_OF_STATUS: Record<string, number> = {
  PENDING_PROCUREMENT: 0,
  IN_STOCK: 1,
  RESERVED: 1,
  IN_USE: 2,
  MAINTENANCE: 3,
  UNDER_REPAIR: 3,
  RETIRED: 4,
  DISPOSED: 4,
  MISSING: 4,
};

const TONE_VAR: Record<string, string> = {
  "in-use": "var(--status-in-use)",
  "in-stock": "var(--status-in-stock)",
  reserved: "var(--status-reserved)",
  maintenance: "var(--status-maintenance)",
  flagged: "var(--status-flagged)",
  disposed: "var(--status-disposed)",
  retired: "var(--status-retired)",
};

export function LifecycleTrail({
  status,
  className,
}: {
  /** Backend AssetStatus value. */
  status: string;
  className?: string;
}) {
  const stage = STAGE_OF_STATUS[status] ?? 0;
  const currentColor = TONE_VAR[toneForStatus(status)];

  return (
    <span
      className={cn("inline-flex items-center gap-[3px]", className)}
      role="img"
      aria-label={`Lifecycle stage ${stage + 1} of 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="h-1 w-3.5 rounded-sm"
          style={{
            background:
              i < stage
                ? "color-mix(in srgb, var(--primary) 55%, var(--border))"
                : i === stage
                  ? currentColor
                  : "var(--border-subtle)",
          }}
        />
      ))}
    </span>
  );
}
